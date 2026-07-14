import {
  chart as gofishChart,
  Layer,
  color,
  value,
  spread as gofishSpread,
  stack as gofishStack,
  scatter as gofishScatter,
  derive,
  table as gofishTable,
  rect,
  circle,
  blank as scaffold,
  line,
  selectAll as select,
  clock,
  polar,
  linear,
  Constraint,
  ribbon,
  project,
  group as gofishGroup,
  layer as markLayer,
  Frame,
  stackX,
  ellipse,
  petal,
  wavy,
  palette,
  gradient,
  gray,
  neutral,
  stackY,
  spreadX,
  spreadY,
  For,
  ref,
  paint,
  image,
  text,
  v,
  field,
  FieldExpr,
  repeat,
  datum,
} from "gofish-graphics";
import _ from "lodash";
import chroma from "chroma-js";
import {
  seafood,
  catchLocations,
} from "@gofish-data/catch";
import { titanic } from "@gofish-data/titanic";
import { nightingale } from "@gofish-data/nightingale";
import barleyRaw from "./data/barley.json";
import bottlePng from "./source-images/wilsonblanco.png";

const CHART_W = 480;
const CHART_H = 320;

const Chart = (data?: unknown, options: Record<string, unknown> = {}) =>
  data === undefined
    ? gofishChart()
    : gofishChart(data, { axes: true, ...options });

// A `by` slot is either a bare field name or a `field(...)` expression carrying
// domain ops (`.sort()`, `.reverse()`, `.bin()`); anything else is an options bag.
type By = string | FieldExpr;
const isBy = (x: unknown): x is By =>
  typeof x === "string" || x instanceof FieldExpr;

const spread = (byOrOptions: By | Record<string, unknown>, options = {}) =>
  isBy(byOrOptions)
    ? gofishSpread({ by: byOrOptions, ...options })
    : gofishSpread(byOrOptions);

const stack = (byOrOptions: By | Record<string, unknown>, options = {}) =>
  isBy(byOrOptions)
    ? gofishStack({ by: byOrOptions, ...options })
    : gofishStack(byOrOptions);

const scatter = (byOrOptions: string | Record<string, unknown>, options = {}) =>
  typeof byOrOptions === "string"
    ? gofishScatter({ by: byOrOptions, ...options })
    : gofishScatter(byOrOptions);

const group = (byOrOptions: string | Record<string, unknown>) =>
  typeof byOrOptions === "string"
    ? gofishGroup({ by: byOrOptions })
    : gofishGroup(byOrOptions);

const table = (
  xOrOptions: string | Record<string, unknown>,
  y?: string,
  options = {}
) =>
  typeof xOrOptions === "string"
    ? gofishTable({ by: { x: xOrOptions, y }, ...options })
    : gofishTable(xOrOptions);

const color6 = [
  "#4190c5",
  "#f2cf57",
  "#a181c8",
  "#ff9666",
  "#43b780",
  "#d45e83",
];

// Tableau10: any chart with more than five categorical colors uses this
// palette instead of a hand-picked one.
const TABLEAU10 = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ac",
];

const vizStepColors = {
  Manchuria: TABLEAU10[0],
  Glabron: TABLEAU10[1],
  Svansota: TABLEAU10[2],
  Velvet: TABLEAU10[3],
  Trebi: TABLEAU10[4],
  "No. 457": TABLEAU10[5],
  "No. 462": TABLEAU10[6],
  Peatland: TABLEAU10[7],
  "No. 475": TABLEAU10[8],
  "Wisconsin No. 38": TABLEAU10[9],
  "University Farm": TABLEAU10[0],
  Waseca: TABLEAU10[1],
  Morris: TABLEAU10[2],
  Crookston: TABLEAU10[3],
  "Grand Rapids": TABLEAU10[4],
  Duluth: TABLEAU10[5],
};

type BarleyRow = {
  year: 1931 | 1932;
  variety: string;
  site: string;
  yield: number;
};

const barley = barleyRaw as BarleyRow[];
const barleySeries = barley.map((row) => ({
  ...row,
  series: `${row.site}|${row.variety}`,
}));

// Anonymized aggregate for the Boger/Franconeri opening ONLY, so the audience's
// first read of the grouping swap isn't primed by recognizing the barley
// dataset. Same numbers as barley (total yield per site per year), just
// relabeled to cities / years / "sales". Everything after the intro uses the
// real barley data.
const OPENING_CITY: Record<string, string> = {
  "University Farm": "Raleigh",
  Waseca: "Fresno",
  Morris: "Boulder",
  Crookston: "Portland",
  "Grand Rapids": "Austin",
  Duluth: "Denver",
};
const OPENING_YEAR: Record<number, number> = { 1931: 2018, 1932: 2019 };
const cityYearData = Object.values(
  _.groupBy(barley, (r) => `${r.site}|${r.year}`)
).map((rows) => ({
  city: OPENING_CITY[rows[0].site],
  year: OPENING_YEAR[rows[0].year],
  sales: _.sumBy(rows, "yield"),
}));

// The example region the "each line of the spec is a cut" slide's chips and
// chart boundaries both point at: Morris, the famous 1932 anomaly site (its
// total yield rises while every other site's falls).
const CUT_FOCUS_SITE = "Morris";
const CUT_FOCUS_YEAR = "1932";
// Chart size on the stepped cut slides: each step is one chart | spec | chip
// row, so the chart gets most of the width. (GoFish adds axis padding beyond
// this, so the emitted SVG is wider than CUT_CHART_W.) The colored cut charts
// get their legend stripped (see stripLegend) so all three steps share the
// same footprint and the row fits 1280px with the code at full size.
const CUT_CHART_W = 400;
const CUT_CHART_H = 270;

function getContainer(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// GoFish's `.render()` promise can resolve a tick before the SVG is actually
// committed to the DOM (the insertion appears to happen on a later
// microtask/frame). Poll briefly for a child to appear rather than assuming
// it's there the instant `await ...render()` returns.
function waitForChild(
  el: HTMLElement,
  selector: string,
  timeoutMs = 500
): Promise<SVGSVGElement | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const found = el.querySelector<SVGSVGElement>(selector);
      if (found || performance.now() - start > timeoutMs) {
        resolve(found);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// Draws a subtle rounded border behind each OUTER split group's bars, to make
// the Gestalt containment structure visible on the "back to those bar charts"
// spec tiles. GoFish's `enclose` operator draws a box around its children,
// but its style (stroke color/width, fill) isn't exposed as an option — only
// `padding`/`rx`/`ry` are — so it can't match this slide's muted-stroke look.
// Instead this measures the rendered bars' own x/y/width/height attributes
// (no layout/getBBox needed, so it works even while the slide is off-screen)
// and clusters them by the gap between bars: the outer spread's spacing is
// much wider than the inner spread's, so a gap threshold between the two
// cleanly separates outer groups from the bars within them.
function addOuterGroupBoxes(id: string, numOuterGroups: number) {
  const el = getContainer(id);
  if (!el) return;
  waitForChild(el, "svg").then((svg) => {
    if (!svg || svg.querySelector(".outer-group-box")) return;
    const bars = Array.from(svg.querySelectorAll("rect")).filter((r) => {
      const fill = r.getAttribute("fill");
      return fill !== "gray" && fill !== "none" && r.height.baseVal.value > 15;
    });
    if (bars.length === 0) return;

    const boxes = bars
      .map((r) => ({
        x0: r.x.baseVal.value,
        x1: r.x.baseVal.value + r.width.baseVal.value,
        y0: r.y.baseVal.value,
        y1: r.y.baseVal.value + r.height.baseVal.value,
      }))
      .sort((a, b) => a.x0 - b.x0);

    const GAP_THRESHOLD = 15; // between inner spacing (6px) and outer (24px+)
    const clusters: (typeof boxes)[number][][] = [[boxes[0]]];
    for (let i = 1; i < boxes.length; i++) {
      const prev = boxes[i - 1];
      const cur = boxes[i];
      if (cur.x0 - prev.x1 > GAP_THRESHOLD) clusters.push([]);
      clusters[clusters.length - 1].push(cur);
    }

    if (clusters.length !== numOuterGroups) {
      console.warn(
        `addOuterGroupBoxes(${id}): expected ${numOuterGroups} outer groups, found ${clusters.length}`
      );
    }

    const PAD = 4;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "outer-group-boxes");
    for (const cluster of clusters) {
      const x0 = Math.min(...cluster.map((c) => c.x0)) - PAD;
      const y0 = Math.min(...cluster.map((c) => c.y0)) - PAD;
      const x1 = Math.max(...cluster.map((c) => c.x1)) + PAD;
      const y1 = Math.max(...cluster.map((c) => c.y1)) + PAD;
      const box = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      box.setAttribute("class", "outer-group-box");
      box.setAttribute("x", String(x0));
      box.setAttribute("y", String(y0));
      box.setAttribute("width", String(x1 - x0));
      box.setAttribute("height", String(y1 - y0));
      box.setAttribute("rx", "6");
      box.setAttribute("ry", "6");
      box.setAttribute("fill", "none");
      box.setAttribute("stroke", "#b0a999");
      box.setAttribute("stroke-width", "1.5");
      g.appendChild(box);
    }
    svg.insertBefore(g, svg.firstChild);
  });
}

// ── Opening: Franconeri — same data, two groupings ────────────────────────
type HeightSample = {
  age: string;
  person: "Charlie" | "River";
  height: number;
};

const franconeriHeights: HeightSample[] = [
  { age: "8", person: "Charlie", height: 50 },
  { age: "8", person: "River", height: 48 },
  { age: "10", person: "Charlie", height: 54 },
  { age: "10", person: "River", height: 53 },
  { age: "12", person: "Charlie", height: 58 },
  { age: "12", person: "River", height: 51 }, // slight but real decrease
];

const FRANCONERI_BAR_COLOR = "#7c8a99";

function renderFranconeriA() {
  const el = getContainer("chart-franconeri-a");
  if (!el || el.children.length > 0) return;
  // Outer: age. Inner: Charlie vs River side-by-side via inner spread.
  // Easy query: "who is taller at each age?"
  Chart(franconeriHeights)
    .flow(
      spread("age", { dir: "x", spacing: 32 }),
      spread("person", { dir: "x", spacing: 8 })
    )
    .mark(rect({ h: "height", fill: FRANCONERI_BAR_COLOR }))
    .render(el, { w: CHART_W, h: CHART_H, axes: true });
}

const KEY_W = 280;
const KEY_H = 190;

function renderFranconeriAKey() {
  const el = getContainer("chart-franconeri-a-key");
  if (!el || el.children.length > 0) return;
  Chart(franconeriHeights)
    .flow(
      spread("age", { dir: "x", spacing: 16 }),
      spread("person", { dir: "x", spacing: 4 })
    )
    .mark(rect({ h: "height", fill: FRANCONERI_BAR_COLOR }))
    .render(el, { w: KEY_W, h: KEY_H, axes: true });
}

function renderFranconeriAColor() {
  const el = getContainer("chart-franconeri-a-color");
  if (!el || el.children.length > 0) return;
  Chart(franconeriHeights)
    .flow(
      spread("age", { dir: "x", spacing: 16 }),
      spread("person", { dir: "x", spacing: 4 })
    )
    .mark(rect({ h: "height", fill: "person" }))
    .render(el, { w: CHART_W, h: CHART_H, axes: true });
}

function renderFranconeriAColorKey() {
  const el = getContainer("chart-franconeri-a-color-key");
  if (!el || el.children.length > 0) return;
  Chart(franconeriHeights)
    .flow(
      spread("age", { dir: "x", spacing: 16 }),
      spread("person", { dir: "x", spacing: 4 })
    )
    .mark(rect({ h: "height", fill: "person" }))
    .render(el, { w: KEY_W, h: KEY_H, axes: true });
}

function renderFranconeriC() {
  const el = getContainer("chart-franconeri-c");
  if (!el || el.children.length > 0) return;
  // Line chart over age, one line per person, color encodes person.
  // Easy query: "how does each person's height change over time?"
  Layer([
    Chart(franconeriHeights)
      .flow(group("person"), scatter("age", { x: "age", y: "height" }))
      .mark(scaffold().name("franconeri-pts")),
    Chart(select("franconeri-pts"))
      .flow(group("person"))
      .mark(line({ strokeWidth: 2 })),
  ]).render(el, { w: CHART_W, h: CHART_H, axes: true });
}

// Opening swap: total yield per site by year (height auto-sums over variety).
// site -> year makes each site's change two adjacent bars (Morris rises while
// the other five fall); year -> site scatters the change across two year blocks.
// The demo bars are colorless — matching the Boger & Franconeri stimuli, and
// so the audience can't use color to match bars across the two groupings.
// #ccc is GoFish's palette-fallback gray, the same gray the highlight
// variant's non-Boulder bars fall back to, so the highlight slide reads as
// the SAME chart with Boulder painted orange rather than a recolor.
const DEMO_BAR_GRAY = "#ccc";
function renderAggSiteYear(
  id = "chart-viz-agg-site-year",
  w = CHART_W,
  h = CHART_H,
  axes: boolean | { x: boolean; y: boolean } = true
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const miniAxes = typeof axes === "object" && axes.x === false;
  // The outermost spread's ordinal axis is claimed by the chart ROOT, so the
  // chart-level `axes` option (not the operator-level override) governs it.
  Chart(cityYearData, { axes })
    .flow(
      spread("city", { dir: "x", spacing: 24, ...(miniAxes ? { axes: { x: false } } : {}) }),
      spread("year", { dir: "x", spacing: 6, ...(miniAxes ? { axes: { x: false } } : {}) })
    )
    .mark(rect({ h: "sales", fill: DEMO_BAR_GRAY }))
    .render(el, { w, h, axes, legend: false });
}
// Same site -> year pairing, with Boulder pulled out of the gray field. Every
// city not named in the palette falls back to GoFish's #ccc.
function renderAggSiteYearHighlight(
  id = "chart-viz-agg-site-year-highlight",
  w = CHART_W,
  h = CHART_H,
  axes: boolean | { x: boolean; y: boolean } = true
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const miniAxes = typeof axes === "object" && axes.x === false;
  Chart(cityYearData, { color: palette({ Boulder: "#e08214" }), legend: false, axes })
    .flow(
      spread("city", { dir: "x", spacing: 24, ...(miniAxes ? { axes: { x: false } } : {}) }),
      spread("year", { dir: "x", spacing: 6, ...(miniAxes ? { axes: { x: false } } : {}) })
    )
    .mark(rect({ h: "sales", fill: "city" }))
    .render(el, { w, h, axes, legend: false });
}
function renderAggYearSite(
  id = "chart-viz-agg-year-site",
  w = CHART_W,
  h = CHART_H,
  axes: boolean | { x: boolean; y: boolean } = true
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const miniAxes = typeof axes === "object" && axes.x === false;
  Chart(cityYearData, { axes })
    .flow(
      spread("year", { dir: "x", spacing: 24, ...(miniAxes ? { axes: { x: false } } : {}) }),
      spread("city", { dir: "x", spacing: 6, ...(miniAxes ? { axes: { x: false } } : {}) })
    )
    .mark(rect({ h: "sales", fill: DEMO_BAR_GRAY }))
    .render(el, { w, h, axes, legend: false });
}

// ── Opening concession: "and often that's fine" — a standard scatter plot
// and a standard bar chart, deliberately plain, paralleling the complex
// versions on the long-tail montage that follows (jointplot on the left,
// UpSet on the right). Hardcoded innocuous data — NOT barley/cityYearData;
// the audience must not see the demo data before the grouped-bar exercise.
const plainScatterData = [
  { x: 1.5, y: 2.4 },
  { x: 2.2, y: 3.1 },
  { x: 3.0, y: 2.7 },
  { x: 3.8, y: 4.2 },
  { x: 4.5, y: 3.9 },
  { x: 5.3, y: 5.1 },
  { x: 6.1, y: 4.7 },
];
const plainBarData = [
  { flavor: "vanilla", scoops: 28 },
  { flavor: "chocolate", scoops: 35 },
  { flavor: "strawberry", scoops: 19 },
  { flavor: "mint", scoops: 24 },
];

function renderPlainScatter(id = "chart-plain-scatter") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(plainScatterData)
    .flow(scatter({ x: "x", y: "y" }))
    .mark(circle({ r: 5, fill: FRANCONERI_BAR_COLOR }))
    .render(el, { w: 380, h: 260, axes: true, legend: false });
}

function renderPlainBars(id = "chart-plain-bars") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(plainBarData)
    .flow(spread("flavor", { dir: "x", spacing: 16 }))
    .mark(rect({ h: "scoops", fill: FRANCONERI_BAR_COLOR }))
    .render(el, { w: 380, h: 260, axes: true, legend: false });
}

// "each line of the spec is a cut" slide, column 1: everything below the
// outer spread("site") collapses into one neutral gray bar per site — the
// same auto-summing renderVizSiteYear relies on (height auto-sums over any
// grouping level not given its own spread), just with the year spread
// dropped entirely instead of only the variety level. One flat fill instead
// of fill: "site" keeps the collapsed bars visually neutral/summary-like.
// Uses the raw barley dataset (real site names, 1931/1932) so the cut slides
// read as a native continuation of the walkthrough, not the opening's
// anonymized city/sales stand-in.
function renderCutSiteCollapsed(
  id = "chart-viz-cut-site",
  w = CUT_CHART_W,
  h = CUT_CHART_H,
  axes: boolean | { x: boolean; y: boolean } = true
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, { axes })
    .flow(spread("site", { dir: "x", spacing: 24 }))
    .mark(rect({ h: "yield", fill: "#9aa5b1" }))
    .render(el, { w, h, axes, legend: false });
}

// Removes GoFish's auto-seated color legend from a rendered chart. The
// `legend: false` option is a no-op for categorical fills (see the barley
// scatter-pie comment further down), and on the cut slides the legend is
// redundant (site names are already the x-axis labels) and makes the colored
// steps a wider footprint than the collapsed gray step 1. GoFish emits a FLAT
// svg — no legend <g> — so legend entries are identified structurally: a
// legend label is a <text> whose immediately preceding sibling is a small
// COLORED swatch <rect> (~10px, palette fill). Axis tick marks are also
// small rects followed by their label text, but they're fill="gray"
// (verified by DOM inspection), so the fill check keeps them. Removing the
// elements alone leaves the svg still reserving the legend's width (a
// phantom ~150px of dead space inside the chart container, since
// fitContainerToSvg sizes containers off the svg's declared size), so the
// width attribute and container are trimmed back to just left of where the
// legend column began. GoFish emits NO viewBox (verified by DOM
// inspection), so user units are CSS px and shrinking the width attribute
// simply crops the now-empty right strip — do not synthesize a viewBox
// here; svg.viewBox.baseVal reports height 0 for the missing attribute and
// writing that back blanks the chart. Returns a promise so callers can
// sequence work (e.g. addFocusBox) after the legend text nodes are gone.
async function stripLegend(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  let minLegendX = Infinity;
  svg.querySelectorAll("text").forEach((t) => {
    const prev = t.previousElementSibling;
    const fill = prev?.getAttribute("fill");
    if (
      prev instanceof SVGRectElement &&
      prev.width.baseVal.value < 16 &&
      prev.height.baseVal.value < 16 &&
      fill !== "none" &&
      fill !== "gray"
    ) {
      minLegendX = Math.min(minLegendX, prev.x.baseVal.value);
      prev.remove();
      t.remove();
    }
  });
  if (minLegendX !== Infinity) {
    const newW = Math.max(1, Math.ceil(minLegendX - 6));
    svg.setAttribute("width", String(newW));
    el.style.width = `${newW}px`;
  }
}

// "each line of the spec is a cut" slide: marks the focused region with a
// DRAWN BOUNDARY (Gestalt common region) instead of graying out the rest of
// the chart, so the cut is visible as containment rather than as salience.
// GoFish's rects carry no class/data attributes to select on (verified by
// inspecting the rendered markup — plain <rect fill="...">, no group
// transforms), so bars are found by fill/size like addOuterGroupBoxes above,
// then clustered by the same inner-vs-outer x-gap heuristic. A specific
// site's cluster (or a specific site+year bar within it) is picked out by
// matching against GoFish's own axis tick <text> labels — the one reliable
// per-datum label GoFish does emit — rather than by hardcoding a fill color
// or a positional index that would silently go stale if the data or the
// palette changed.
function addFocusBox(
  id: string,
  target: { site?: string; year?: string; allGroups?: boolean } = {}
) {
  const el = getContainer(id);
  if (!el) return;
  waitForChild(el, "svg").then((svg) => {
    if (!svg || svg.querySelector(".cut-focus-box")) return;
    const bars = Array.from(svg.querySelectorAll("rect")).filter((r) => {
      const fill = r.getAttribute("fill");
      return fill !== "gray" && fill !== "none" && r.height.baseVal.value > 15;
    });
    if (bars.length === 0) return;

    const boxes = bars
      .map((r) => ({
        x0: r.x.baseVal.value,
        x1: r.x.baseVal.value + r.width.baseVal.value,
        y0: r.y.baseVal.value,
        y1: r.y.baseVal.value + r.height.baseVal.value,
      }))
      .sort((a, b) => a.x0 - b.x0);

    let targets = boxes;

    if (!target.allGroups && target.site) {
      const GAP_THRESHOLD = 15; // between inner spacing (6px) and outer (24px+)
      const clusters: (typeof boxes)[number][][] = [[boxes[0]]];
      for (let i = 1; i < boxes.length; i++) {
        const prev = boxes[i - 1];
        const cur = boxes[i];
        if (cur.x0 - prev.x1 > GAP_THRESHOLD) clusters.push([]);
        clusters[clusters.length - 1].push(cur);
      }

      // reveal.js hides every non-active slide with display:none, and these
      // charts all render eagerly on load — so getBBox() (which needs a
      // layout box) silently returns 0 for the axis labels here. Read the
      // "x" attribute GoFish already writes instead: it's the label's
      // text-anchor-start left edge, a few px before the bar/cluster it
      // labels. Match each label to its NEAREST candidate by that left
      // edge rather than a fixed-tolerance window — the inner (year) bars
      // sit only 6px apart, narrower than a generous tolerance window, so
      // two neighboring bars' windows can both contain one label's x and a
      // first-match lookup would silently grab the wrong one.
      const texts = Array.from(svg.querySelectorAll("text"));
      const leftEdgeOf = (t: SVGTextElement) =>
        parseFloat(t.getAttribute("x") ?? "NaN");
      const nearest = <T extends { x0: number }>(
        items: T[],
        labelXs: number[]
      ): T | undefined =>
        items.reduce<{ item: T | undefined; dist: number }>(
          (best, item) => {
            const dist = Math.min(
              ...labelXs.map((lx) => Math.abs(item.x0 - lx))
            );
            return dist < best.dist ? { item, dist } : best;
          },
          { item: undefined, dist: Infinity }
        ).item;

      const siteLabelXs = texts
        .filter((t) => t.textContent === target.site)
        .map(leftEdgeOf);
      const clusterStarts = clusters.map((c) => ({ x0: c[0].x0, cluster: c }));
      const matchedStart = nearest(clusterStarts, siteLabelXs);
      if (!matchedStart) {
        console.warn(
          `addFocusBox(${id}): no bar cluster matched site "${target.site}"`
        );
        return;
      }
      const cluster = matchedStart.cluster;
      targets = cluster;

      if (target.year) {
        const yearLabelXs = texts
          .filter((t) => t.textContent === target.year)
          .map(leftEdgeOf);
        const bar = nearest(cluster, yearLabelXs);
        if (!bar) {
          console.warn(
            `addFocusBox(${id}): no bar matched year "${target.year}" within site "${target.site}"`
          );
          return;
        }
        targets = [bar];
      }
    }

    const PAD = 5;
    const x0 = Math.min(...targets.map((c) => c.x0)) - PAD;
    const y0 = Math.min(...targets.map((c) => c.y0)) - PAD;
    const x1 = Math.max(...targets.map((c) => c.x1)) + PAD;
    const y1 = Math.max(...targets.map((c) => c.y1)) + PAD;
    const box = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    box.setAttribute("class", "cut-focus-box");
    box.setAttribute("x", String(x0));
    box.setAttribute("y", String(y0));
    box.setAttribute("width", String(x1 - x0));
    box.setAttribute("height", String(y1 - y0));
    box.setAttribute("rx", "4");
    box.setAttribute("fill", "none");
    box.setAttribute("stroke", "#4a7fb5");
    box.setAttribute("stroke-width", "1.5");
    box.setAttribute("stroke-dasharray", "5 3");
    svg.appendChild(box);
  });
}

// Data-shape reveal: the opening's grouped bars re-shown with the anonymized
// city/sales labels, then swapped to the real barley site/yield labels. Same
// numbers, same layout, neutral fill, so only the labels change.
function renderRevealChart(id: string, real: boolean) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const opts = { w: CHART_W, h: CHART_H, axes: true, legend: false };
  if (real) {
    Chart(barley)
      .flow(
        spread("site", { dir: "x", spacing: 24 }),
        spread("year", { dir: "x", spacing: 6 })
      )
      .mark(rect({ h: "yield", fill: FRANCONERI_BAR_COLOR }))
      .render(el, opts);
  } else {
    Chart(cityYearData)
      .flow(
        spread("city", { dir: "x", spacing: 24 }),
        spread("year", { dir: "x", spacing: 6 })
      )
      .mark(rect({ h: "sales", fill: FRANCONERI_BAR_COLOR }))
      .render(el, opts);
  }
}

function renderFranconeriB() {
  const el = getContainer("chart-franconeri-b");
  if (!el || el.children.length > 0) return;
  // Outer: person. Inner: ages side-by-side via inner spread.
  // Easy query: "how does height change across ages for each person?"
  Chart(franconeriHeights)
    .flow(
      spread("person", { dir: "x", spacing: 32 }),
      spread("age", { dir: "x", spacing: 8 })
    )
    .mark(rect({ h: "height", fill: FRANCONERI_BAR_COLOR }))
    .render(el, { w: CHART_W, h: CHART_H, axes: true });
}

function renderFranconeriBKey() {
  const el = getContainer("chart-franconeri-b-key");
  if (!el || el.children.length > 0) return;
  Chart(franconeriHeights)
    .flow(
      spread("person", { dir: "x", spacing: 16 }),
      spread("age", { dir: "x", spacing: 4 })
    )
    .mark(rect({ h: "height", fill: FRANCONERI_BAR_COLOR }))
    .render(el, { w: KEY_W, h: KEY_H, axes: true });
}

// ── VizChitra-style walkthrough — native GoFish charts (barley) ──────────
const VIZ_W = 470;
const VIZ_H = 300;
const VIZ_COMPARE_W = 250;
const VIZ_COMPARE_H = 150;
const VIZ_RENDER_OPTIONS = { w: VIZ_W, h: VIZ_H, axes: true, legend: false };
const VIZ_COMPARE_RENDER_OPTIONS = {
  w: VIZ_COMPARE_W,
  h: VIZ_COMPARE_H,
  axes: true,
  legend: false,
};
const vizChartOptions = { color: palette(vizStepColors), legend: false };

// ── Operator summary table: tiny horizontal "shape" previews ───────────────
// One real GoFish render per row of the "each operator makes one query
// cheap" table (03-glyphs.html). Toy inline data, no axes, ~150x40 — just
// enough for the operator's characteristic arrangement to read at a glance.
const OP_VIZ_W = 150;
const OP_VIZ_H = 40;
const opVizColors = ["#4190c5", "#a181c8", "#43b780", "#d45e83"];

const opSpreadData = [{ k: "a" }, { k: "b" }, { k: "c" }, { k: "d" }];

function renderVizOpSpread(id = "chart-viz-op-spread") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(opSpreadData, { axes: false, legend: false })
    .flow(spread("k", { dir: "x", spacing: 10 }))
    .mark(rect({ h: datum(1), fill: opVizColors[0] }))
    .render(el, { w: OP_VIZ_W, h: OP_VIZ_H, axes: false, legend: false });
}

// `fill` carries a literal "#"-prefixed hex value per row rather than a bare
// category name — GoFish passes literal colors straight through instead of
// resolving them against a categorical scale, so no legend gets generated
// (see the barleyDeltaScale comment above for the same literal-vs-scaled
// distinction).
const opStackData = [
  { k: "a", v: 3, fill: opVizColors[0] },
  { k: "b", v: 2, fill: opVizColors[1] },
  { k: "c", v: 4, fill: opVizColors[2] },
  { k: "d", v: 2, fill: opVizColors[3] },
];

function renderVizOpStack(id = "chart-viz-op-stack") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(opStackData, { axes: false, legend: false })
    .flow(stack("k", { dir: "x", size: "v" }))
    .mark(rect({ h: 26, fill: "fill" }))
    .render(el, { w: OP_VIZ_W, h: OP_VIZ_H, axes: false, legend: false });
}

// Deliberately clumpy 2-D values — two tight clusters and a loner — so the
// preview cannot be mistaken for spread's equal slots: scatter's dots sit
// at their VALUES, unevenly, which is the whole semantic difference.
const opScatterData = [
  { x: 2, y: 1 },
  { x: 3.2, y: 2.4 },
  { x: 3.8, y: 1.4 },
  { x: 9, y: 3.4 },
  { x: 13.5, y: 0.8 },
  { x: 14, y: 2 },
];

function renderVizOpScatter(id = "chart-viz-op-scatter") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  // Rendered a touch smaller than the 150x40 preview box: GoFish scales the
  // domain to the full frame, so the extreme points' circles sit exactly on
  // the SVG boundary and get half-clipped by the default svg overflow.
  // Letting the SVG overflow visibly (with slack from the smaller frame)
  // keeps every dot whole.
  Chart(opScatterData, { axes: false, legend: false })
    .flow(scatter({ x: "x", y: "y" }))
    .mark(circle({ r: 3, fill: opVizColors[2] }))
    .render(el, { w: 140, h: 30, axes: false, legend: false });
  waitForChild(el, "svg").then((svg) => {
    if (svg) svg.style.overflow = "visible";
  });
}

// Two short stacks (left/right) connected by a ribbon — the same "name it,
// select it, group it, connect it" idiom as the barley ribbon slide
// (renderVizStackChart above), radically simplified to a 2x2 toy. The wide
// spacing keeps the two stacks visually distinct little columns; the low
// ribbon opacity keeps the connecting bands clearly lighter than the solid
// segment rects so the flow reads as "stacks joined by translucent bands"
// rather than one mass. The segment order flips between the sides (blue on
// the bottom at left, on top at right), so the two bands CROSS in the
// middle — the rank-change/overtake read that ribbons price, matching the
// "read crossings as overtakes" line in the chip beside it.
const opRibbonData = [
  { side: "left", seg: "a", v: 3, fill: opVizColors[0] },
  { side: "left", seg: "b", v: 2, fill: opVizColors[1] },
  { side: "right", seg: "b", v: 3, fill: opVizColors[1] },
  { side: "right", seg: "a", v: 2, fill: opVizColors[0] },
];

function renderVizOpRibbon(id = "chart-viz-op-ribbon") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Layer([
    Chart(opRibbonData, { axes: false, legend: false })
      .flow(
        spread("side", { dir: "x", spacing: 96 }),
        stack("seg", { dir: "y", size: "v" })
      )
      .mark(rect({ w: 16, fill: "fill" }).name("op-ribbon-bars")),
    Chart(select("op-ribbon-bars"), { axes: false, legend: false })
      .flow(group("seg"))
      .mark(ribbon({ opacity: 0.25 })),
  ]).render(el, { w: OP_VIZ_W, h: OP_VIZ_H, axes: false, legend: false });
}

const opTableData = [
  { row: "r1", col: "c1" },
  { row: "r1", col: "c2" },
  { row: "r2", col: "c1" },
  { row: "r2", col: "c2" },
];

// Rendered nearly square (not the full 150px row width) so the 2x2 reads as
// a grid with two independent axes — equal gaps both ways — instead of four
// wide flat bars; the flex-centered container box supplies the rest of the
// row width.
function renderVizOpTable(id = "chart-viz-op-table") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(opTableData, { axes: false, legend: false })
    .flow(table("row", "col", { spacing: 6 }))
    .mark(rect({ fill: opVizColors[1] }))
    .render(el, { w: 42, h: 36, axes: false, legend: false });
}

function renderVizSiteSlots() {
  const el = getContainer("chart-viz-site-slots");
  if (!el || el.children.length > 0) return;
  // Fixed-height slots (no `h` data field) make the y scale meaningless, so
  // this render overrides axes to keep only the site labels (x). The y axis
  // is governed by the chart-level `axes` option, not render()'s, so both
  // need the override (see renderAggSiteYear's comment on the same split).
  Chart(barley, { ...vizChartOptions, axes: { x: true, y: false } })
    .flow(spread("site", { dir: "x" }))
    .mark(
      rect({
        h: datum(1),
        fill: "none",
        stroke: "#d02670",
        strokeWidth: 1.5,
        strokeDasharray: "6 4",
      }),
    )
    .render(el, { ...VIZ_RENDER_OPTIONS, axes: { x: true, y: false } });
}

function renderVizSiteYield(id = "chart-viz-site-yield") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(spread("site", { dir: "x" }))
    .mark(rect({ h: "yield", fill: "#68a9d8" }))
    .render(el, VIZ_RENDER_OPTIONS);
}

function renderVizSiteYear(id = "chart-viz-site-year", w = VIZ_W, h = VIZ_H) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("site", { dir: "x", spacing: 24 }),
      spread("year", { dir: "x", spacing: 4 })
    )
    .mark(rect({ h: "yield", fill: "site" }))
    .render(el, { w, h, axes: true, legend: false });
}

function renderVizSiteVarietyMini() {
  const el = getContainer("chart-viz-site-variety-mini");
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("site", { dir: "x", spacing: 14 }),
      spread("variety", { dir: "x", spacing: 2 })
    )
    .mark(rect({ h: "yield", fill: "variety" }))
    .render(el, VIZ_COMPARE_RENDER_OPTIONS);
}

function renderVizVarietySiteMini() {
  const el = getContainer("chart-viz-variety-site-mini");
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("variety", { dir: "x", spacing: 14 }),
      spread("site", { dir: "x", spacing: 2 })
    )
    .mark(rect({ h: "yield", fill: "site" }))
    .render(el, VIZ_COMPARE_RENDER_OPTIONS);
}

// One renderer for the stack -> sort -> connect progression. `sort` orders each
// stack by yield; `connect` adds the ribbon (with Morris drawn on top); the plain
// stack is the same variety x year x site structure with neither.
function renderVizStackChart(
  id: string,
  {
    sort = false,
    connect = false,
    highlight = false,
  }: { sort?: boolean; connect?: boolean; highlight?: boolean } = {}
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const chartOptions = highlight
    ? { color: palette({ Morris: "#e08214" }), legend: false }
    : vizChartOptions;
  const barsFlow: any[] = [
    spread("variety", { dir: "x", spacing: 24 }),
    spread("year", { dir: "x", spacing: 16 }),
    stack(sort ? field("site").sort("yield") : "site", {
      dir: "y",
      size: "yield",
    }),
  ];
  const layers: any[] = [
    Chart(barley, chartOptions)
      .flow(...barsFlow)
      .mark(rect({ w: 8, fill: "site" }).name("bars")),
  ];
  if (connect) {
    layers.push(
      Chart(select("bars"))
        .flow(group("variety"), group("site"))
        .mark(
          ribbon({ opacity: highlight ? 0.78 : 0.5 }).zOrder((a: any) =>
            project(a, "site") === "Morris" ? 1 : 0
          )
        )
    );
  }
  Layer(layers).render(el, VIZ_RENDER_OPTIONS);
}

// `chart-viz-stacked` no longer uses this — see `renderVizVarietyStack` below,
// which now backs the composition beat's two slides. Left in place because
// `renderVizStackedSorted` and `renderVizRibbon`/`-highlight` (still live)
// share this same helper, and `chart-viz-stacked`'s OLD (variety-outer,
// site-stacked) spec may still back a `data-visibility="hidden"` slide.
function renderVizStacked(id = "chart-viz-stacked") {
  renderVizStackChart(id, {});
}
function renderVizStackedSorted(id = "chart-viz-stacked-sorted") {
  renderVizStackChart(id, { sort: true });
}

// The composition beat, in TWO slides over ONE structure: spread site ->
// spread year -> stack variety. The slides are visually identical except for
// the y-extent, because the ONLY thing that changes between them is `stack`'s
// `size` argument — normalization reads to the audience as a one-line edit.
//
//   1. `chart-viz-stacked` (raw, `size: "yield"`) — introduces `stack()`. Bar
//      height is the site-year's TOTAL yield, each segment a variety's
//      contribution: the totals visibly moved between 1931 and 1932.
//   2. `chart-viz-stacked-share` (`size: field("yield").normalize()`) —
//      introduces `field().normalize()`, the same `size` idiom the Titanic
//      mosaic and the `stack("species", ...)` species chart already use.
//      Every bar is 100% tall, so "the bands line up between a site's 1931 and
//      1932 bars" now means the variety MIX held — which it did. Answers "did
//      the mix change, or just the total?".
//
// Facet nesting and spacing (64 between sites / 26 between the year pair
// inside a site — widened from `renderVizSiteYear`'s 24/4 so the "1931"/
// "1932" tick labels, each ~24px wide, don't overprint into "19311932";
// the site gap stays clearly bigger than the year gap so the pair still
// reads as nested inside its site) loosely follows `renderVizSiteYear`
// above, the deck's other site-then-year chart at this same VIZ_W/VIZ_H
// canvas. Legend stays on (`legend: true`),
// matching how the slope panels keep a real variety legend once gofish#686
// stopped blocking it (see the comment above `renderVizBarleySlopePanels`'s
// own `panels.render`).
function renderVizVarietyStack(
  id: string,
  { normalize = false, w = VIZ_W, h = VIZ_H } = {}
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("site", { dir: "x", spacing: 64 }),
      spread("year", { dir: "x", spacing: 26 }),
      stack("variety", {
        dir: "y",
        size: normalize ? field("yield").normalize() : "yield",
      })
    )
    .mark(rect({ w: 10, fill: "variety" }))
    .render(el, { w, h, axes: true, legend: true });
}

function renderVizVarietyStackRaw(id = "chart-viz-stacked") {
  renderVizVarietyStack(id, {});
}
function renderVizVarietyShare(id = "chart-viz-stacked-share") {
  renderVizVarietyStack(id, { normalize: true });
}

// The strongest plain-spread answer to the query: make site the outer panel,
// variety the comparison unit inside each site, and year the adjacent pair
// inside each variety. The earlier site -> year -> variety ordering put nine
// unrelated bars between a variety's two years, needlessly weakening the
// comparison before the deck introduced connection. This site -> variety ->
// year order fixes that grouping problem while preserving the honest limit
// that every change still has to be inferred from two separate bar heights.
//
// Width budget for the 470px VIZ_W canvas: 6 sites × 2 years × 10 varieties
// = 120 leaf bars, and unlike `renderVizVarietyStack` (which fixes the bar's
// x-extent with an explicit `w`, independent of layout), this mark leaves
// `w` unset, so each bar's width IS the innermost spread's allocated cell —
// the spacings below directly divide up the canvas. Budgeting off a
// conservative ~420px of usable plot width (470 minus axis/legend chrome):
//   site cell    = (420 − 5×10) / 6   ≈ 61.7px
//   variety cell = (61.7 − 9×1) / 10  ≈ 5.3px
//   year/bar     = 5.3 / 2            ≈ 2.6px
// The larger site gap and smaller variety gap make the hierarchy visible;
// zero year spacing makes each 1931/1932 pair read as one comparison unit.
// Both inner ordinal axes stay off because neither ten variety labels nor
// sixty repeated year labels fit at this scale. Only the outer site spread
// keeps its ticks. The y axis stays on because it carries the two values from
// which the viewer must still estimate change.
function renderVizVarietySpread(id = "chart-viz-spread-variety") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("site", { dir: "x", spacing: 10 }),
      spread("variety", { dir: "x", spacing: 1, axes: { x: false } }),
      spread("year", { dir: "x", spacing: 0, axes: { x: false } })
    )
    .mark(rect({ h: "yield", fill: "variety" }))
    .render(el, { w: VIZ_W, h: VIZ_H, axes: true, legend: true });
}

// The pie beat: literally `renderVizVarietyStack`'s normalized flow with ONE
// option changed, `coord: clock()` — same data, same query, same variety
// palette. `table("site", "year")` lays out a 6-site-wide x 2-year-tall grid
// of pies, one per site-year cell, directly under/over its own-site partner
// for the across-year comparison the query asks for.
//
// Each cell's pie is built the chart-as-glyph way `renderBarleyScatterPie`
// uses (see above): `.mark((data) => ...)` receives that leaf facet's own
// matching barley rows directly, and the callback resolves a fully
// independent nested `Chart` in `clock()` coordinates. Every pie gets the
// SAME fixed radius (`PIE_RADIUS`) — unlike the scatter-pie map, which sizes
// radius by total yield, this slide is comparing PROPORTIONS only (the same
// thing the normalized bars compare), so encoding total yield in radius here
// would smuggle a second, distracting variable back in. `size: "yield"` (not
// normalized) still gives each wedge the correct SHARE of its own pie:
// `clock()` maps whatever the stack sums to a full turn regardless of the
// raw total, so per-cell normalization is already implicit in the coordinate
// transform — no `field("yield").normalize()` needed here (that normalize
// call in the bars version earns its keep by controlling bar HEIGHT, a
// channel pies don't have).
const PIE_RADIUS = 15;

// The glyph rendered into each `table()` cell below — fixed radius,
// `size: "yield"` (not normalized; `clock()` already turns whatever the
// stack sums to into a full turn, so per-cell normalization is implicit),
// and the same variety palette as the rest of the barley beat.
function varietyPieGlyph(data: typeof barley) {
  return Chart(data, {
    coord: clock(),
    axes: false,
    color: palette(vizStepColors),
    legend: false,
  })
    .flow(stack("variety", { dir: "x", h: PIE_RADIUS, size: "yield" }))
    .mark(rect({ fill: "variety" }));
}

// Rows = year (2), columns = site (6), laid out with a single `table()` call.
//
// `table()` does NOT avoid the chart-as-glyph tick bug a `spread`-based
// layout would hit — it has its own version, on both axes (see
// `realignSitePieTicks` above). So this needs both realign hacks, not
// neither.
function renderVizVarietyPiesTable(
  id = "chart-viz-variety-pies-table",
  { w = 620, h = 190 } = {}
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    // `spacing: 64` gives sites like "University Farm" (~75 units wide)
    // enough room to avoid overlapping their neighbors once correctly
    // centered — at `table()`'s default (4), the column pitch is just
    // `PIE_RADIUS*2 + spacing` = 34 units, too narrow for that; this isn't
    // the tick-position bug below, it's a real
    // too-many-pixels-of-text-for-too-few-pixels-of-column problem.
    .flow(table("site", "year", { spacing: 64 }))
    .mark(varietyPieGlyph)
    .render(el, { w, h, axes: true, legend: true });
  realignYearPieTicks(id); // HACK: see realignYearPieTicks above
  realignSitePieTicks(id); // HACK: see realignSitePieTicks above
}

// NEW BUG (not in the known list): nesting a chart-as-glyph mark (the pie)
// inside a `spread(..., { dir: "y" })` facet is an untested combination —
// every OTHER `spread`/`stack` on `year` in this file spreads on "x"; this
// is the only "y" case paired with a chart-as-glyph mark. Confirmed by DOM
// inspection: the "1931"/"1932" row tick <text>s land at a fixed y that is
// ~93 user units above where the pies for that row actually render (both
// rows off by the same ~93px, regardless of `spread` operator order or an
// explicit inner `w`/`h`/`padding: 0` on the nested chart — ruled out as
// causes by direct experiment), so the labels read as floating above empty
// space while the actual pie rows sit lower, unlabeled. Rather than papering
// over a GoFish layout bug blindly, this re-measures where the pies
// ACTUALLY rendered (clustering wedge `<path>` bboxes into two y-bands, the
// same gap-threshold clustering `realignSiteTicks` above uses for x) and
// moves each row's tick text down to match — the same "don't trust the
// emitted tick position, trust the rendered marks" move as
// `realignSiteTicks`, just on the y axis instead of x.
async function realignYearPieTicks(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  await waitForVisible(svg);
  const wedgeCenters = Array.from(svg.querySelectorAll("path"))
    .filter((p) => (p.getAttribute("fill") ?? "").startsWith("#"))
    .map((p) => {
      const b = p.getBBox();
      return b.y + b.height / 2;
    })
    .sort((a, b) => a - b);
  if (wedgeCenters.length === 0) return;
  const GAP_THRESHOLD = 20; // between one pie's own wedges and the next row down
  const rows: number[][] = [[wedgeCenters[0]]];
  for (let i = 1; i < wedgeCenters.length; i++) {
    if (wedgeCenters[i] - wedgeCenters[i - 1] > GAP_THRESHOLD) rows.push([]);
    rows[rows.length - 1].push(wedgeCenters[i]);
  }
  const rowCenters = rows.map((r) => r.reduce((a, b) => a + b, 0) / r.length);
  const yearTexts = Array.from(svg.querySelectorAll("text")).filter((t) =>
    /^19\d\d$/.test(t.textContent?.trim() ?? "")
  );
  const tickYs = [...new Set(yearTexts.map((t) => t.y.baseVal.getItem(0).value))].sort(
    (a, b) => a - b
  );
  yearTexts.forEach((t) => {
    const tickY = t.y.baseVal.getItem(0).value;
    const rowIndex = tickYs.indexOf(tickY);
    const target = rowCenters[rowIndex];
    if (target === undefined) return;
    t.y.baseVal.getItem(0).value = target + 4; // +4: roughly centers the text's cap-height on the pie row
  });
}

// NEW BUG (not in the known list, and table()'s own version of the bug
// above): swapping the two nested `spread`s for a single `table("site",
// "year")` call does NOT sidestep the chart-as-glyph tick problem — it just
// moves it to BOTH axes. DOM inspection on the table layout: the "1931"/
// "1932" row ticks land ~70-90 user units above the wedge rows they label
// (same failure as `realignYearPieTicks` above, so that helper is reused
// as-is — it already re-measures from rendered wedge geometry rather than
// trusting either operator's emitted position, so it isn't specific to
// `spread`). The site COLUMN ticks have a distinct failure: `table()` emits
// six site labels bunched together near the left edge instead of one per
// column — evenly-spaced ~34-unit-wide pie columns, but tick x's 38, 91,
// 128, 153, 179, 230 (uneven gaps, nothing like the columns' actual
// spacing), so the six names crowd into unreadable overlapping text at the
// grid's top-left instead of sitting over their own column. Same fix
// shape as `realignYearPieTicks`: cluster wedge `<path>` bboxes into
// column x-bands and move each site tick to its own column's measured
// center, rather than trusting `table()`'s emitted tick x.
async function realignSitePieTicks(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  await waitForVisible(svg);
  const wedgeCenters = Array.from(svg.querySelectorAll("path"))
    .filter((p) => (p.getAttribute("fill") ?? "").startsWith("#"))
    .map((p) => {
      const b = p.getBBox();
      return b.x + b.width / 2;
    })
    .sort((a, b) => a - b);
  if (wedgeCenters.length === 0) return;
  // table()'s columns sit closer together (~19 units apart) than spread's
  // rows did, while within-pie wedge spread is ~8 units at most — the 20
  // threshold `realignYearPieTicks`/`realignSiteTicks` use elsewhere in this
  // file is tuned for a wider gap and merges all six columns into one
  // cluster here. 12 sits cleanly between the two (confirmed against the
  // measured wedge-center gaps for this layout).
  const GAP_THRESHOLD = 12;
  const cols: number[][] = [[wedgeCenters[0]]];
  for (let i = 1; i < wedgeCenters.length; i++) {
    if (wedgeCenters[i] - wedgeCenters[i - 1] > GAP_THRESHOLD) cols.push([]);
    cols[cols.length - 1].push(wedgeCenters[i]);
  }
  const colCenters = cols.map((c) => c.reduce((a, b) => a + b, 0) / c.length);
  const siteTexts = Array.from(svg.querySelectorAll("text")).filter((t) =>
    BARLEY_SITE_ORDER.includes(t.textContent?.trim() ?? "")
  );
  const tickXs = [...new Set(siteTexts.map((t) => t.x.baseVal.getItem(0).value))].sort(
    (a, b) => a - b
  );
  siteTexts.forEach((t) => {
    const tickX = t.x.baseVal.getItem(0).value;
    const colIndex = tickXs.indexOf(tickX);
    const target = colCenters[colIndex];
    if (target === undefined) return;
    const width = t.getBBox().width;
    t.x.baseVal.getItem(0).value = target - width / 2;
  });
}

function renderVizYearSorted() {
  const el = getContainer("chart-viz-year-sorted");
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("variety", { dir: "x", spacing: 24 }),
      spread("year", { dir: "x", spacing: 4 }),
      stack(field("site").sort("yield"), { dir: "y", size: "yield" })
    )
    .mark(rect({ fill: "site" }))
    .render(el, VIZ_RENDER_OPTIONS);
}

function renderVizRibbon(id = "chart-viz-ribbon", highlight = false) {
  renderVizStackChart(id, { sort: true, connect: true, highlight });
}

// ── Closing beat: the Morris sentence, compiled ────────────────────────────
// Two structures for the same takeaway ("every variety fell at every site
// except Morris, where every variety rose"): Trellis-style slope panels
// (magnitude-precise, reader aggregates sign per panel) and a Δ heatmap
// (sign-precise via one preattentive scan, magnitude imprecise).

const SLOPE_W = 940;
const SLOPE_H = 220;
// Gap between site facets for the SLOPE and ANCHORED SLOPE charts (see the
// comment above `renderVizBarleySlopePanels`'s flow — the outer (site)
// spread's `spacing` only controls the GAP BETWEEN facets, not a facet's own
// inner width, so this is the lever against site-label overlap/clipping, not
// against readable tilt — see `SLOPE_YEAR_SPACING` below for that). Wide
// enough to clear "University Farm", the widest site label, with room either
// side.
const SITE_SLOPE_SPACING = 66;
// Gap between the two year columns WITHIN each site facet, for the SLOPE and
// ANCHORED SLOPE charts. The original (pre-port) spec placed the two years
// with a bare `scatter({ x: "year", y: "yield" })`, which spread them across
// the full facet width — each variety's line got a long horizontal run and
// an obvious tilt. Porting to the two-nested-spreads flow (`spread(site)` ->
// `spread(year)` -> `scatter`, needed to dodge gofish#770's panel-collapse
// bug) initially kept the OLD spacing value (6),
// a leftover from when it just nudged two dots apart inside a
// scatter-defined width. At `spacing: 6` the two year columns sit almost on
// top of each other, so every line renders nearly vertical — the tilt (the
// entire point of a slope chart) became unreadable, a visual regression
// confirmed against the pre-port screenshot. Fix: widen this spread's own
// spacing so the facet's inner content is wide enough to read the slope,
// independent of `SITE_SLOPE_SPACING` above (which only governs inter-facet
// gap). 60 gives each panel a long horizontal run comparable to the
// original's `scatter(x=year)` spread, without the panels touching.
const SLOPE_YEAR_SPACING = 60;

// The slope chart's first layer, rendered on its own: same facets and same
// per-variety points, with circles instead of the later relational line.
function renderVizBarleySlopePoints(
  id = "chart-viz-barley-slope-points",
  w = SLOPE_W,
  h = SLOPE_H
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barleySeries, vizChartOptions)
    .flow(
      spread("site", { dir: "x", spacing: SITE_SLOPE_SPACING }),
      spread("year", { dir: "x", spacing: SLOPE_YEAR_SPACING }),
      scatter({ by: "variety", y: "yield" })
    )
    .mark(circle({ r: 3, fill: "variety" }))
    .render(el, { w, h, axes: true, legend: false });
}

// One line per variety per site, connecting its 1931 -> 1932 yield. The
// relational line consumes the placed points directly. Its key must include
// both site and variety: a variety-only key would join identically named
// varieties across all six panels into a single zigzag.
//
// This flow (spread, spread, scatter) is NOT hit by gofish#770 (the
// spread+scatter panel-collapse bug documented below on the delta-dots
// chart) — confirmed by rendering: nesting a second spread ahead of the
// scatter sidesteps whatever sizing computation the single-spread case gets
// wrong. So this chart keeps the real site names, no short-code relabeling
// needed.
//
// `legend: false` is a no-op for a categorical `fill` (gofish #686) — an
// unsuppressable variety/site legend would eat about half the canvas, so
// `stripLegend` (see above) removes it by DOM surgery after render.
// The inner (year) spread's two tick labels ("1931", "1932") sit close
// enough together (spacing: 6) that they render on top of each other,
// smearing into an unreadable "1931932"/"19332"-looking mess — the exact
// bug called out in this port's brief. Suppressed the same way the variety
// ticks are suppressed on the delta charts: DOM removal after render, rather
// than fighting the operator's own tick-placement math.
async function stripYearTicks(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  svg.querySelectorAll("text").forEach((t) => {
    const txt = t.textContent?.trim() ?? "";
    if (txt === "1931" || txt === "1932") t.remove();
  });
}

// NEW BUG (not in the known list, and CSS-side rather than GoFish's):
// `.viz-gofish-chart > svg` in style.css forces `width: 91% !important` on
// every rendered chart's <svg> (presumably to trim a bit of dead space on
// charts whose real content was already narrower than the requested render
// width). GoFish's emitted <svg> carries no `viewBox` (see the `stripLegend`
// comment above), so shrinking its CSS width does NOT rescale the content —
// it just narrows the visible viewport, and `.chart-container`'s own
// `overflow: hidden` then hard-clips whatever falls outside that narrower
// box. For a chart whose real content already fills its full declared
// width (the slope/anchored panels here, once `SITE_SLOPE_SPACING` gave
// them enough room — see that comment), the 91% rule silently guillotines
// the rightmost ~9% of the chart (Duluth). HACK: after
// `fitContainerToSvg` (main.ts) has already sized the container to the
// svg's true content width, override the 91% down to 100% inline — an
// inline `!important` beats the external stylesheet's `!important` by
// cascade order — so the container's full (already-correct) width is what
// actually gets shown instead of being clipped for a spacing reason that
// doesn't apply to this chart.
function unclipSvgWidth(id: string) {
  const el = getContainer(id);
  if (!el) return;
  waitForChild(el, "svg").then((svg) => {
    if (!svg) return;
    svg.style.setProperty("width", "100%", "important");
  });
}

// The "call it out" slide's takeaway note, formerly an absolutely-positioned
// HTML overlay div on the slide, is drawn by GoFish itself when `annotate` is
// set: component-level annotation tiers per AnnotationLayer.stories.tsx —
// `.layer(mark)` stacks a datumless bare mark over the chart in the chart's
// own frame, so the text lives inside the rendered SVG. There is no box: the
// sentence is plain orange (Morris-orange, #e08214 — same hex the highlight
// variant uses to fill Morris's points/lines) text sitting directly over the
// Morris facet, so the callout reads as "this text belongs to that cluster"
// rather than a caption pinned to a corner. Anchoring uses literal world-frame
// x/cy rather than a constraint/ref to a named node inside the facet's
// markLayer — gofish#753 makes inner-spread label anchoring flaky, and an
// earlier attempt at constraint-anchoring inside the facet clipped and
// mis-positioned. The Morris facet's world x-extent was read off the
// rendered SVG rather than derived purely from arithmetic: with six equal-
// width facets at 20px spacing (site order Univ Farm, Waseca, Morris,
// Crookston, Grand Rapids, Duluth), Morris's slope lines land at SVG
// x=[375,515]; subtracting the chart's ~55px y-axis-gutter offset
// (svg_x = world_x + 55, confirmed against the old box's own placement) gives
// world x=[320,460], i.e. a 140px-wide facet centered at world x=390. Vertical
// placement uses the same measured affine map for cy (svg_y = 260 - world_cy
// at this w=940,h=220 — read off the three lines of the old corner note),
// placed above the Morris cluster (whose slope lines occupy SVG y=124..214)
// so the three short lines mostly clear the lines rather than sit under them.
// `text` is a single-line mark with no fontWeight channel, so the sentence is
// wrapped by hand to fit the ~140px-wide facet at 15px Shantell Sans (three
// lines, each individually centered on the facet by its measured pixel
// width), and the bold "every" is faked with a same-color stroke on a mark of
// its own, x-offset by the measured width of "Morris rose for ".
//
// (1) SLOPE:
//   Chart(barleySeries, vizChartOptions)
//     .flow(
//       spread({ by: "site", dir: "x", spacing: SITE_SLOPE_SPACING }),
//       spread({ by: "year", dir: "x", spacing: SLOPE_YEAR_SPACING }),
//       scatter({ by: "variety", y: "yield" })
//     )
//     .mark(line({ by: "series", fill: "variety", strokeWidth: 2 }))
//     .render(el, { w, h, axes: true, legend: true });
function renderVizBarleySlopePanels(
  id = "chart-viz-barley-slope",
  highlight = false,
  w = SLOPE_W,
  h = SLOPE_H,
  annotate = false
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const chartOptions = highlight
    ? { color: palette({ Morris: "#e08214" }), legend: false }
    : vizChartOptions;
  const panels = Chart(barleySeries, chartOptions)
    .flow(
      // `spacing: 20` (the original value) packs facets ~49px apart center to
      // center — narrower than "University Farm"'s own rendered label width
      // (~75px), so adjacent site labels overprinted ("University
      // FarmWaseca") and the last facet (Duluth) ran past the canvas's
      // auto-fit width. `spacing` here sets the GAP BETWEEN facets, not
      // facet width (that's `SLOPE_YEAR_SPACING` on the inner spread below).
      // `SITE_SLOPE_SPACING` is picked to clear the widest site label with
      // room to spare; it's the same constant this chart and (2) ANCHORED
      // SLOPE share, so both stay in sync.
      spread({ by: "site", dir: "x", spacing: SITE_SLOPE_SPACING }),
      spread({ by: "year", dir: "x", spacing: SLOPE_YEAR_SPACING }), // see SLOPE_YEAR_SPACING comment above
      scatter({ by: "variety", y: "yield" })
    )
    .mark(
      line({
        by: "series",
        fill: highlight ? "site" : "variety",
        strokeWidth: 2,
      })
    );
  // `highlight`'s color scale only distinguishes Morris from "every other
  // site" (2 effective groups already named by the slide's own color-key
  // sentence/callout) — a 10-variety legend would be non-sequitur there, so
  // that variant keeps suppressing it via `stripLegend`. The base
  // (non-highlight) variety-colored chart gets its legend back for real:
  // gofish#686 turned out to only block the *render-level* `legend: false`
  // no-op reported in the earlier port; passing `legend: true` at the
  // `.render()` call (rather than trying to un-suppress it via the
  // `Chart()`-level `vizChartOptions`, which still says `legend: false` and
  // is left alone since other charts share that constant) does render a
  // real legend, and — confirmed by screenshot — GoFish already lays it out
  // as a compact swatch column at the right without ballooning the canvas,
  // so no hand-drawn DOM replacement was needed after all.
  panels.render(el, { w, h, axes: true, legend: !highlight });
  if (highlight) stripLegend(id);
  stripYearTicks(id);
  unclipSvgWidth(id); // HACK: see unclipSvgWidth above
  if (annotate) addSlopeCallout(id);
}

// The callout text used to be positioned with hardcoded literal x/cy pixel
// values, hand-measured once against the OLD `markLayer`-based
// implementation's rendered output (see git history). Porting to the fused
// `line({ by })` mark changed the chart's internal frame/margins enough that
// those literals now land completely wrong — in our testing, off the plot
// entirely, into the dead space beside a `legend: false`-defying auto
// legend (gofish#686 again). Worse, `stripLegend`'s heuristic (small colored
// rect immediately followed by a text sibling) then deleted the misplaced
// annotation text outright, having mistaken it for a legend label sitting
// next to a swatch. NEW BUG, not in the known list: `.layer(text({x, cy}))`
// component-level annotations are only as stable as the chart's internal
// coordinate frame, which isn't part of the public API and shifted under an
// otherwise-unrelated mark-API change.
// HACK: skip GoFish's own coordinate system for this note entirely. Measure
// the Morris line paths' actual rendered SVG bounding box (stroke/fill
// "#e08214", the highlight color) — the same DOM-measurement trick
// `addFocusBox`/`addOuterGroupBoxes` already use elsewhere in this file —
// and draw the three lines of plain SVG `<text>` above it directly, using
// `text-anchor: middle` instead of hand-measured per-line pixel widths. The
// "every" bold-by-stroke fakeout is dropped for the same reason: not worth
// re-deriving a per-run pixel offset against a frame that isn't guaranteed
// stable across versions.
// NEW BUG (not in the known list): `renderCharts()` eagerly renders every
// chart on every slide right after `deck.initialize()` — including slides
// that aren't the current one, which Reveal keeps in the DOM but hidden
// (`display: none` on the containing `<section>`/stack). `getBBox()` on an
// element inside a `display: none` subtree returns an all-zero rect (no
// layout box exists to measure), so measuring the Morris paths' bbox while
// this slide is still hidden silently yields `minX = maxX = 0` — the
// callout still gets drawn (so `morrisPaths.length === 0` doesn't catch it),
// just centered on x=0 instead of the Morris facet, so it spills off the
// left edge of the chart with only its tail end visible. That's the actual
// mechanism behind the "callout overlaps Waseca" symptom this port's brief
// flagged: the text isn't too WIDE, it's centered on the wrong point
// entirely, and its right half happens to land in Waseca's territory.
// HACK: poll (rAF) for a non-degenerate bbox instead of measuring once —
// this naturally waits out both the hidden-slide case (resolves once the
// user navigates here and the section becomes visible) and any ordinary
// render-not-settled-yet race, without depending on Reveal's own
// slide-visibility events.
// Polls (rAF) until `el` is actually laid out — `getClientRects()` comes
// back empty for anything under a `display: none` ancestor, which is
// exactly the "still on a slide the presenter hasn't navigated to yet"
// case this exists for. Uncapped in practice (a ~33-minute rAF budget):
// a real presentation may sit on an earlier slide far longer than any
// small timeout would tolerate, and rAF costs nothing while idle.
function waitForVisible(el: Element, maxFrames = 120000): Promise<void> {
  return new Promise((resolve) => {
    let frame = 0;
    function tick() {
      if (el.getClientRects().length > 0 || frame++ >= maxFrames) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  });
}

async function addSlopeCallout(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  const morrisPaths = Array.from(svg.querySelectorAll("path")).filter(
    (p) =>
      p.getAttribute("stroke") === "#e08214" ||
      p.getAttribute("fill") === "#e08214"
  ) as unknown as SVGGraphicsElement[];
  if (morrisPaths.length === 0) return;
  await waitForVisible(svg);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  morrisPaths.forEach((p) => {
    const b = p.getBBox();
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.width);
    minY = Math.min(minY, b.y);
  });
  const centerX = (minX + maxX) / 2;
  const noteColor = "#e08214"; // Morris orange, same hex the highlight variant fills Morris with
  const lines = ["Morris rose for every", "variety, the only", "site that did."];
  const lineHeight = 18;
  const startY = Math.max(16, minY - lineHeight * lines.length - 6);
  const ns = "http://www.w3.org/2000/svg";
  lines.forEach((lineText, i) => {
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", String(centerX));
    t.setAttribute("y", String(startY + i * lineHeight));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", noteColor);
    t.setAttribute("font-family", "'Shantell Sans', sans-serif");
    t.setAttribute("font-size", "14");
    t.setAttribute("font-weight", i === 0 ? "700" : "400");
    t.textContent = lineText;
    svg.appendChild(t);
  });
}

// (2) ANCHORED SLOPE — same skeleton as (1); the ONLY diff is what `y` is
// bound to. Each variety's 1931 yield is normalized to 0 so its line runs
// from 0 to its delta — still a line (still "up is more"), but the length
// already IS the delta the next two charts extract on their own. Precomputed
// once as `barleyAnchored` rather than inline in `derive`, so the flow below
// reads identically to (1) apart from the data variable and the y field name.
function anchorYears(rows: BarleyRow[]): (BarleyRow & { yieldAnchored: number })[] {
  const y1931 = new Map<string, number>();
  for (const r of rows) {
    if (r.year === 1931) y1931.set(`${r.site}|${r.variety}`, r.yield);
  }
  return rows.map((r) => ({
    ...r,
    yieldAnchored: r.yield - y1931.get(`${r.site}|${r.variety}`)!,
  }));
}
const barleyAnchored = anchorYears(barley);
const barleyAnchoredSeries = barleyAnchored.map((row) => ({
  ...row,
  series: `${row.site}|${row.variety}`,
}));

function renderVizBarleySlopeAnchored(
  id = "chart-viz-barley-slope-anchored",
  w = SLOPE_W,
  h = SLOPE_H
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barleyAnchoredSeries, vizChartOptions)
    .flow(
      spread({ by: "site", dir: "x", spacing: SITE_SLOPE_SPACING }), // see SITE_SLOPE_SPACING comment above (1)
      spread({ by: "year", dir: "x", spacing: SLOPE_YEAR_SPACING }), // see SLOPE_YEAR_SPACING comment above (1)
      scatter({ by: "variety", y: "yieldAnchored" }) // <- only diff from (1): y field
    )
    .mark(line({ by: "series", fill: "variety", strokeWidth: 2 }))
    // `yieldAnchored` is the internal derived-field name (see `anchorYears`)
    // — it must not leak onto the axis, so the title is overridden with what
    // the quantity actually is. `legend: true` restores the real
    // variety legend (see the comment above `renderVizBarleySlopePanels`'s
    // own `panels.render` call — same fix, same reasoning).
    .render(el, { w, h, axes: { x: true, y: { title: "Δ from 1931" } }, legend: true });
  stripYearTicks(id);
  unclipSvgWidth(id); // HACK: see unclipSvgWidth above
}

// ── gofish#770: single spread + scatter collapses the panels ────────────
// A nested spread + scatter renders cleanly (see (1)/(2) above), but a
// SINGLE spread's split field feeding straight into a scatter with no
// explicit `x` — no second facet spread ahead of it — collapses all six
// site panels into an ~80px sliver of a 940px canvas, tick labels smeared
// on top of each other. We first assumed (following an earlier, unverified
// experiment's notes) that this was purely a long-label sizing bug, fixable
// by feeding short site codes ("A".."F") to the spread/scatter and
// relabeling the axis text afterward. That did NOT fix it in our testing —
// the collapse reproduced identically with codes, with and without an
// intervening `derive`, so whatever's wrong is not (only) about label
// length. That's a discrepancy from the earlier notes worth flagging
// upstream alongside the bug itself. The DOTS/BARS charts below dodge the
// whole bug by never calling `scatter` in the first place (see the comment
// above `deltaPanelsFlow`).
//
// Δyield(site, variety) = yield(1932) - yield(1931), then a diverging color
// for it. `gradient()` only interpolates a config over its data's actual
// min/max (see createGradientScale in colorSchemes.ts) — there's no domain
// override, so it can't be recentered at 0 for an asymmetric spread of
// deltas. The diverging scale is built by hand instead (chroma, domain
// [-maxAbs, 0, maxAbs], anchored on Morris green) and baked into a literal
// hex-string field. Because no chart-level `color` config is passed, the
// "no colorConfig" resolution path treats each row's literal `#`-prefixed
// value as a pass-through color rather than a categorical key to cycle
// through color6 (see the isLiteralColor check in _node.ts) — the same
// literal-vs-scaled distinction the barley-pie legend-stripping comment
// above relies on.
const barleyDeltaMaxAbs = _.max(
  Object.values(_.groupBy(barley, (d) => `${d.site}|${d.variety}`)).map(
    (pair) =>
      Math.abs(
        pair.find((r) => r.year === 1932)!.yield -
          pair.find((r) => r.year === 1931)!.yield
      )
  )
) as number;
const barleyDeltaScale = chroma
  .scale(["#2c7bb6", "#f7f2e8", "#e08214"])
  .domain([-barleyDeltaMaxAbs, 0, barleyDeltaMaxAbs]);

function deltaFromYears(rows: BarleyRow[]) {
  const [y1931, y1932] = rows;
  const delta = y1932.yield - y1931.yield;
  return [
    {
      site: y1931.site,
      variety: y1931.variety,
      delta,
      deltaColor: barleyDeltaScale(delta).hex(),
        // For a SIGNED bar (renderVizBarleyDeltaBars): rect's `h` channel
        // does not grow a bar upward from a zero baseline for a negative
        // value the way every other (always-positive) `h`-bound rect in
        // this file assumes — confirmed by rendering: a plain
        // `rect({ h: "delta" })` hangs every bar from the domain's top edge
        // instead, so Morris's positive deltas render as near-invisible
        // slivers and every negative-delta bar looks the same regardless of
        // magnitude (a real gofish bug, not covered by the known-bugs list).
        // HACK: bypass `h`'s baseline handling entirely — precompute an
        // explicit top edge (`barTop`, 0 for a rise, the delta itself for a
        // fall) and a magnitude (`barHeight`), and bind `y`/`h` to those
        // instead. `y: "<field>"` as a literal position channel is already
        // proven correct (see the DOTS chart's zero-baseline rect above).
      barTop: Math.min(0, delta),
      barHeight: Math.abs(delta),
    },
  ];
}

// (3) DELTA DOTS / (4) DELTA BARS — the year spread collapses into
// `deltaFromYears`'s computed delta; one mark per (site, variety), with a dashed
// zero baseline so "above the line" reads as "rose". The connecting line
// from (1)/(2) is gone: with only one point left per (site, variety), there
// is nothing left to connect.
//
// The spec we WISH we could write for the dots is a single spread (site)
// feeding a scatter (variety, y: delta) — mirroring the heatmap's
// site-spread/variety-scatter shape one level up. That shape is exactly what
// gofish#770 collapses: a spread's split field feeding a scatter with no
// explicit `x` renders all six site panels into an ~80px sliver, and short
// site codes ("A".."F") did NOT fix it in our testing (confirmed both with
// and without an intervening `derive`) — contrary to what an earlier
// experiment's notes claimed, so that's a discrepancy worth flagging
// upstream too. HACK: sidestep `scatter` entirely. A second nested spread
// (site, then variety — the same shape (1)/(2)'s slope panels already use
// safely) positions each variety's slot, and `rect`'s own `y` channel (a
// literal position, not a size) places a small rounded square at the delta
// value — same trick a zero-height `rect({ y, h: 0 })` already uses for the
// dashed baseline below. This also means (3) and (4) end up sharing the
// EXACT same flow, differing only in the mark: a small rounded rect (dot)
// positioned by `y`, vs. a full-height signed rect (bar) sized by `h`.
//
// The inner (variety) spread's tick labels need suppressing — ten variety
// names at 2px spacing overlap into an unreadable smear, the same
// "1931932" problem the slope panels' year ticks have, just worse with ten
// labels instead of two. The obvious fix, `axes: { x: false }` on the inner
// spread operator, is a NEW bug of its own: it throws off whatever arithmetic
// positions the OUTER (site) tick labels, and they drift progressively
// further right of their own panels the further right the panel is
// (confirmed by comparing rendered tick-label x to each panel's own bar x
// extents — verified correct with no override, and increasingly wrong site
// labels start once `axes: { x: false }` is added to the inner spread).
// HACK: leave both spreads' axes alone (so the outer labels stay put) and
// remove the inner tick text nodes by DOM surgery afterward instead — the
// same strategy `stripLegend` already uses for gofish#686. Variety names are
// a fixed, known set, so `stripVarietyTicks` below just deletes any tick
// <text> whose content is one of them — EXCEPT the real legend's own
// variety labels, which share the exact same strings (see `markLegendSwatches`
// just below: it tags the legend so `stripVarietyTicks`/`realignSiteTicks`
// can skip it instead of the old approach of deleting it outright).
//
// `stripLegend`'s heuristic (small colored rect immediately followed by a
// text sibling) misfires on the DOTS chart below: its own data marks ARE
// small (8x8) colored rects, so whichever one happens to sit right before an
// axis-tick <text> in DOM order gets mistaken for a legend swatch. A real
// legend is a vertical STACK of swatches sharing one x (see the raw swatch
// dump in this file's dev notes); a stray data dot never repeats another
// mark's exact x. This finder requires >= 3 swatch candidates at the same x
// before treating them as a legend, which a single coincidental data-dot
// match can't satisfy.
//
// Earlier this DELETED the matched swatches/labels outright (the same
// "legend eats the canvas" workaround `stripLegend` uses) — but the brief
// calls for keeping a real legend on this chart, just not letting it corrupt
// the OTHER DOM-surgery hacks downstream (`stripVarietyTicks` deletes any
// text matching a variety name, which would eat the legend's own labels
// too; `realignSiteTicks` clusters colored rects by x-gap to re-derive site
// centers, which would treat the legend's swatch column as one more
// "site"). So this now just TAGS matches with `data-legend-swatch` and
// leaves them in the DOM — the legend renders normally, and the two
// downstream hacks skip anything carrying that tag.
async function markLegendSwatches(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  const candidates: { rect: SVGRectElement; text: Element }[] = [];
  svg.querySelectorAll("text").forEach((t) => {
    const prev = t.previousElementSibling;
    const fill = prev?.getAttribute("fill");
    if (
      prev instanceof SVGRectElement &&
      prev.width.baseVal.value < 16 &&
      prev.height.baseVal.value < 16 &&
      fill !== "none" &&
      fill !== "gray"
    ) {
      candidates.push({ rect: prev, text: t });
    }
  });
  const byX = _.groupBy(candidates, (c) => c.rect.x.baseVal.value);
  for (const group of Object.values(byX)) {
    if (group.length < 3) continue; // a real legend column, not a coincidental data-dot match
    for (const { rect, text } of group) {
      rect.setAttribute("data-legend-swatch", "1");
      text.setAttribute("data-legend-swatch", "1");
    }
  }
}

const BARLEY_VARIETIES = new Set(barley.map((d) => d.variety));
async function stripVarietyTicks(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  svg.querySelectorAll("text").forEach((t) => {
    if (t.hasAttribute("data-legend-swatch")) return; // keep the legend's own labels
    if (BARLEY_VARIETIES.has(t.textContent?.trim() ?? "")) t.remove();
  });
}

// NEW BUG (not in the known list): the outer (site) tick label's x position
// is computed independently of the actual rendered mark geometry. For this
// two-level spread(site)+spread(variety) flow, whatever per-item slot width
// the label-placement math assumes doesn't match the marks' real rendered
// width (an explicit `w: 8` dot vs. an auto-width bar), so each site's label
// drifts further right of its own panel the further right the panel sits —
// confirmed by measuring rendered tick x against each panel's own mark
// cluster: the drift grows roughly monotonically site over site, and by
// Crookston/Grand Rapids it has drifted a full panel-width, mislabeling
// Morris's panel as Crookston. HACK: don't trust the emitted tick x at all.
// Measure each panel's own colored marks (grouped by an x-gap threshold —
// the same clustering trick `addOuterGroupBoxes` already uses elsewhere in
// this file) and overwrite each site tick's x with its own panel's measured
// center instead.
const BARLEY_SITE_ORDER = [
  "University Farm",
  "Waseca",
  "Morris",
  "Crookston",
  "Grand Rapids",
  "Duluth",
];
async function realignSiteTicks(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  const markCenters = Array.from(svg.querySelectorAll("rect"))
    .filter((r) => {
      if (r.hasAttribute("data-legend-swatch")) return false; // see markLegendSwatches
      const fill = r.getAttribute("fill");
      return !!fill && fill.startsWith("#") && r.width.baseVal.value > 0;
    })
    .map((r) => r.x.baseVal.value + r.width.baseVal.value / 2)
    .sort((a, b) => a - b);
  if (markCenters.length === 0) return;
  const GAP_THRESHOLD = 15; // between inner (variety) spacing and outer (site) spacing
  const clusters: number[][] = [[markCenters[0]]];
  for (let i = 1; i < markCenters.length; i++) {
    if (markCenters[i] - markCenters[i - 1] > GAP_THRESHOLD) clusters.push([]);
    clusters[clusters.length - 1].push(markCenters[i]);
  }
  const centers = clusters.map(
    (c) => c.reduce((a, b) => a + b, 0) / c.length
  );
  const ticks = Array.from(svg.querySelectorAll("text"))
    .filter((t) => BARLEY_SITE_ORDER.includes(t.textContent?.trim() ?? ""))
    .sort((a, b) => a.x.baseVal.getItem(0).value - b.x.baseVal.getItem(0).value);
  ticks.forEach((t, i) => {
    if (centers[i] === undefined) return;
    const width = t.getBBox().width;
    t.x.baseVal.getItem(0).value = centers[i] - width / 2;
  });
}
//
// The zero-reference rows share the SAME field name ("delta", not a
// differently-named "zero") as the main chart's position channel: gofish's
// overlay union check rejects two `Layer([...])`d charts whose position
// channels are backed by different field names (it can't tell whether
// they're meant to share a scale or are different units).
// `barTop` is included alongside `delta` (both 0 here) so the BARS chart's
// zero-baseline overlay can bind the SAME field name its main chart uses
// (`barTop`) — the union check above cares about the field name, not just
// its values being compatible.
const barleyZeroRows = _.uniqBy(barley, "site").map((d) => ({
  site: d.site,
  delta: 0,
  barTop: 0,
}));
// TWO stacked bugs conspired to make the zero baseline totally invisible
// (confirmed by DOM inspection — the emitted <rect> for this mark had
// `height="0"`, `stroke-width="0"`, and no `stroke-dasharray` attribute at
// all, so there was nothing to paint even before the dash pattern):
//   1. `rect`'s channel set (see `Rect`/`baseRect` in ast/shapes/rect.d.ts)
//      has `strokeWidth` but no `strokeDasharray` — the latter isn't a
//      recognized prop, so passing it is silently dropped.
//   2. NEW BUG (not in the known list, and the more fundamental one): a
//      literal `h: 0` isn't just "zero thickness" — the SVG spec says a
//      `<rect>` with height (or width) of exactly 0 is excluded from
//      rendering ENTIRELY, so no stroke would show even with strokeWidth
//      fixed. `h: 0` cannot be used to draw a hairline; it has to be a real
//      (if small) positive height.
// HACK: `h: 1` gives the rect actual (if minimal) area so it paints at all;
// `strokeWidth` is set for real (it IS a supported channel) as a further
// belt-and-suspenders fix; `stroke-dasharray` — still not a channel — is
// patched onto the rendered <rect> by DOM surgery in `dashZeroBaseline`
// below, the same "GoFish won't take the option, so mutate the emitted SVG"
// move `stripYearTicks`/`stripVarietyTicks` already use elsewhere in this
// file.
const zeroBaselineMark = (field: "delta" | "barTop") =>
  rect({
    y: field,
    h: 1,
    fill: "none",
    stroke: "#888",
    strokeWidth: 1.5,
  });

// HACK: see the comment on `zeroBaselineMark` above — `strokeDasharray` isn't
// a real `rect` channel, so the zero-baseline rects render solid; this finds
// them by their (fill:none, stroke:#888) signature, which no data mark in
// these charts shares.
//
// NEW BUG (not in the known list): stamping `stroke-dasharray` straight onto
// the `h: 1` rect (the original version of this function) does NOT produce a
// clean dashed rule. An SVG `<rect>`'s stroke traces its full outline — all
// four sides — so a 1px-tall rect gets its dash pattern applied to BOTH the
// top and bottom edges (a hairline apart), and at real render scale those two
// dashed traces don't line up dash-for-dash (rounding in exactly where each
// dash starts along the perimeter), so the two nearly-overlapping dashed
// lines beat against each other into a scruffy zigzag/squiggle rather than a
// single clean dashed rule — confirmed by screenshot at real slide scale.
// HACK: don't dash the rect's stroke at all; replace the rect outright with a
// single hand-drawn `<line>` at its vertical center — a `<line>` has exactly
// one edge to dash, so `stroke-dasharray` on it can only ever produce one
// clean dashed trace.
//
// NEW BUG (not in the known list, and related to the one `realignSiteTicks`
// already works around): the zero-baseline overlay is a SEPARATE single-level
// `spread({ by: "site" })` (see `barleyZeroRows`'s flow) laid over the main
// chart's two-level `spread(site) -> spread(variety)`. Even with both spreads
// given the identical `DELTA_SITE_SPACING`, GoFish's per-slot width math
// comes out slightly different between a single-level and a nested spread —
// confirmed by measuring both the baseline rects' and the data marks'
// rendered x-extents: the two start in rough agreement at University Farm but
// drift apart site over site, and by Duluth the baseline segment is ~30px
// short of the panel it's supposed to underline. HACK: don't trust the
// baseline rects' own x-extent at all (same move `realignSiteTicks` already
// makes for the tick labels) — measure each panel's own colored marks
// (excluding the legend, tagged by `markLegendSwatches`) clustered by site,
// and stretch each dashed line to match its own panel's real extent, with a
// small pad so the line reads as underlining the panel rather than exactly
// bracketing its outermost mark.
async function dashZeroBaseline(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  const ns = "http://www.w3.org/2000/svg";
  const PAD = 10;
  const markXs = Array.from(svg.querySelectorAll("rect"))
    .filter((r) => {
      if (r.hasAttribute("data-legend-swatch")) return false;
      const fill = r.getAttribute("fill");
      return !!fill && fill.startsWith("#") && r.width.baseVal.value > 0;
    })
    .map((r) => ({
      x0: r.x.baseVal.value,
      x1: r.x.baseVal.value + r.width.baseVal.value,
    }))
    .sort((a, b) => a.x0 - b.x0);
  const GAP_THRESHOLD = 15; // between inner (variety) spacing and outer (site) spacing
  const clusters: (typeof markXs)[number][][] = markXs.length
    ? [[markXs[0]]]
    : [];
  for (let i = 1; i < markXs.length; i++) {
    if (markXs[i].x0 - clusters[clusters.length - 1].at(-1)!.x1 > GAP_THRESHOLD) {
      clusters.push([]);
    }
    clusters[clusters.length - 1].push(markXs[i]);
  }
  const panelRanges = clusters.map((c) => ({
    x0: Math.min(...c.map((m) => m.x0)),
    x1: Math.max(...c.map((m) => m.x1)),
  }));
  const baselineRects = Array.from(svg.querySelectorAll("rect")).filter(
    (r) => r.getAttribute("fill") === "none" && r.getAttribute("stroke") === "#888"
  );
  baselineRects.sort((a, b) => a.x.baseVal.value - b.x.baseVal.value);
  baselineRects.forEach((r, i) => {
    const midY = r.y.baseVal.value + r.height.baseVal.value / 2;
    const panel = panelRanges[i];
    const x0 = panel ? panel.x0 - PAD : r.x.baseVal.value;
    const x1 = panel ? panel.x1 + PAD : r.x.baseVal.value + r.width.baseVal.value;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(x0));
    line.setAttribute("x2", String(x1));
    line.setAttribute("y1", String(midY));
    line.setAttribute("y2", String(midY));
    line.setAttribute("stroke", "#888");
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("stroke-dasharray", "4 3");
    r.replaceWith(line);
  });
}
// Site/variety spacing trimmed from the original 20/2 (see `deltaPanelsFlow`'s
// former values) once the legend came back (see the comment above
// `markLegendSwatches`): unlike the SLOPE charts, whose content is 2 fixed
// points per line regardless of the outer `w`, these panels' own footprint is
// dominated by 10 fixed-size marks per site (an explicit 8x8 dot, or an
// auto-width bar) and does NOT shrink just because a smaller `w` is
// requested — confirmed by measuring the rendered svg's own `width`
// attribute at several requested `w`s. With the legend now real (not
// DOM-deleted), the sum of (10-marks-per-site content) + legend overhead
// pushed the natural rendered width past the 1280px slide (1264px for dots,
// 1491px for bars at the old spacing/w), so BOTH the per-mark footprint
// (spacing here, and the dot size in `renderVizBarleyDeltaDots`) and the
// requested `w` (see the `w` defaults on both render functions below) were
// trimmed to bring the natural width back under the slide width with the
// legend included.
// Shared with the zero-baseline overlay's OWN `spread({ by: "site" })` below
// (`barleyZeroRows`'s flow, in both renderVizBarleyDeltaDots and
// renderVizBarleyDeltaBars) — the baseline is a separate `Layer([...])`ed
// chart, so if its site spacing ever drifted from this one, the dashed
// zero-baseline would stop lining up under its own panel's marks.
const DELTA_SITE_SPACING = 14;
const deltaPanelsFlow = [
  spread({ by: "site", dir: "x", spacing: DELTA_SITE_SPACING }),
  spread({ by: "variety", dir: "x", spacing: 1 }),
] as const;

function renderVizBarleyDeltaDots(
  id = "chart-viz-barley-delta-dots",
  w = 780,
  h = SLOPE_H
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Layer([
    Chart(barleyZeroRows)
      .flow(spread({ by: "site", dir: "x", spacing: DELTA_SITE_SPACING }))
      .mark(zeroBaselineMark("delta")),
    Chart(barley, vizChartOptions)
      .flow(...deltaPanelsFlow, derive(deltaFromYears))
      // HACK (gofish#770 workaround): a small rounded `rect` positioned by
      // `y` stands in for a "dot" — `scatter` was the natural mark here,
      // but it collapses the panels (see comment above).
      .mark(rect({ w: 6, h: 6, rx: 3, ry: 3, y: "delta", fill: "variety" })),
  ]).render(el, {
    w,
    h,
    axes: { x: true, y: { title: "Δ yield (bu/acre)" } },
    legend: true,
  });
  // Sequenced (not fire-and-forget) so `realignSiteTicks`/`stripVarietyTicks`
  // see the legend already tagged before they run.
  markLegendSwatches(id) // HACK: gofish#686; stripLegend's heuristic misfires on this chart's own dot marks, see comment above — this tags the legend instead of deleting it
    .then(() => stripVarietyTicks(id)) // HACK: see stripVarietyTicks above
    .then(() => realignSiteTicks(id)) // HACK: see realignSiteTicks above
    .then(() => dashZeroBaseline(id)) // HACK: see dashZeroBaseline above
    .then(() => unclipSvgWidth(id)); // HACK: see unclipSvgWidth above
}

// Same data, same panel flow as (3) — signed bars from a zero baseline
// instead of dots (bars read sign faster than dots do). Plain signed bars,
// NOT stacked, positioned by the precomputed `barTop`/`barHeight` fields
// (see the comment in `pairYears`) rather than a plain `h: "delta"` — being
// a spread+spread flow (not spread+scatter), it was never at risk from
// gofish#770, but it did hit a different, new sign-handling bug (see below).
// The Morris "color for emphasis" and "annotation" beats (previously on the
// slope panels — see `renderVizBarleySlopePanels`'s `highlight`/`annotate`
// params and `addSlopeCallout`) moved to THIS chart instead: signed bars read
// sign faster than slope lines do, so the "every variety rose at Morris,
// fell everywhere else" sentence lands harder here. `highlight` mirrors the
// slope panels' own highlight variant move-for-move — `palette({ Morris:
// "#e08214" })` + `legend: false` at the chart-options level, with the
// mark's `fill` switched from "variety" to "site" so the palette actually
// keys on the field it names (non-Morris sites fall back to GoFish's default
// gray). `markLegendSwatches` only makes sense when a legend is actually
// rendered, so it's skipped in the no-legend (`highlight`) branch.
function renderVizBarleyDeltaBars(
  id = "chart-viz-barley-delta-bars",
  { highlight = false, annotate = false, w = 560, h = SLOPE_H } = {}
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const chartOptions = highlight
    ? { color: palette({ Morris: "#e08214" }), legend: false }
    : vizChartOptions;
  Layer([
    Chart(barleyZeroRows)
      .flow(spread({ by: "site", dir: "x", spacing: DELTA_SITE_SPACING }))
      .mark(zeroBaselineMark("barTop")),
    Chart(barley, chartOptions)
      .flow(...deltaPanelsFlow, derive(deltaFromYears))
      .mark(
        rect({
          y: "barTop",
          h: "barHeight",
          fill: highlight ? "site" : "variety",
        })
      ), // HACK: see barTop/barHeight comment in deltaFromYears
  ]).render(el, {
    w,
    h,
    // `barTop` is the internal precomputed-top-edge hack field (see the
    // `deltaFromYears` comment) — it must never leak onto the axis as a label, so
    // the axis title is overridden with the real quantity it displays.
    axes: { x: true, y: { title: "Δ yield (bu/acre)" } },
    legend: !highlight,
  });
  // `highlight`'s legend is suppressed by `legend: !highlight` at the
  // render() level (a no-op — see `stripLegend`'s own doc comment on why
  // `legend: false` doesn't hold for categorical fills), so `stripLegend`
  // is still needed here. BUT calling it *before* `stripVarietyTicks` (the
  // naive "belt and suspenders, mirror the slope panels" order) crops the
  // svg to a ~160px sliver showing only the first site — confirmed by
  // instrumenting `stripLegend`'s own match loop: GoFish emits a stray
  // per-datum `<text>` (the variety name, e.g. "Manchuria") immediately
  // after some of THIS chart's small `<rect>` bars, an artifact that
  // `stripVarietyTicks` (below) is specifically there to strip. Before that
  // cleanup runs, `stripLegend`'s "small rect followed by text" heuristic
  // can't tell a real legend swatch (x~1001, 10x10) from one of those
  // stray bar+label pairs (x~156/312/935, ~7x3-10px, under the same <16
  // threshold) and matches the leftmost one, cropping everything to its
  // right. Sequencing `stripLegend` AFTER `stripVarietyTicks` removes the
  // false positives before the legend heuristic ever sees them — verified
  // by instrumenting the match loop, which then reports exactly the 6
  // true legend entries. `markLegendSwatches` still only makes sense when
  // a legend is actually rendered, so it stays skipped in the `highlight`
  // branch.
  const legendStep = highlight ? Promise.resolve() : markLegendSwatches(id); // HACK: gofish#686, see the comment above markLegendSwatches
  legendStep
    .then(() => stripVarietyTicks(id))
    .then(() => {
      if (highlight) return stripLegend(id);
    })
    .then(() => realignSiteTicks(id)) // HACK: see realignSiteTicks above
    .then(() => dashZeroBaseline(id)) // HACK: see dashZeroBaseline above
    .then(() => unclipSvgWidth(id)) // HACK: see unclipSvgWidth above
    .then(() => {
      if (annotate) addDeltaBarsCallout(id);
    });
}

// Modeled closely on `addSlopeCallout` above — same DOM-measurement move
// (find the Morris-colored marks' rendered bbox, draw plain SVG `<text>`
// above them), adapted for `<rect>` marks instead of `<path>` lines: the
// highlight variant fills Morris's bars (and the zero baseline's `<line>`,
// which never carries this fill) with the same "#e08214", so `rect` is
// enough to find them. Positioned above the Morris cluster since its bars
// are the only ones that go UP (positive delta) — that's the sentence's own
// point, so the callout sits where the rise is, guarded against running off
// the canvas top the same way `addSlopeCallout` guards `startY`.
async function addDeltaBarsCallout(id: string) {
  const el = getContainer(id);
  if (!el) return;
  const svg = await waitForChild(el, "svg");
  if (!svg) return;
  const morrisMarks = Array.from(
    svg.querySelectorAll("rect, path")
  ).filter(
    (p) =>
      p.getAttribute("fill") === "#e08214" ||
      p.getAttribute("stroke") === "#e08214"
  ) as unknown as SVGGraphicsElement[];
  if (morrisMarks.length === 0) return;
  await waitForVisible(svg);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  morrisMarks.forEach((p) => {
    const b = p.getBBox();
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.width);
    minY = Math.min(minY, b.y);
  });
  const centerX = (minX + maxX) / 2;
  const noteColor = "#e08214"; // Morris orange, same hex the highlight variant fills Morris with
  const lines = [
    "Morris is the only site",
    "where every variety rose.",
    "Everywhere else, they fell.",
  ];
  const lineHeight = 18;
  const startY = Math.max(16, minY - lineHeight * lines.length - 6);
  const ns = "http://www.w3.org/2000/svg";
  lines.forEach((lineText, i) => {
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", String(centerX));
    t.setAttribute("y", String(startY + i * lineHeight));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", noteColor);
    t.setAttribute("font-family", "'Shantell Sans', sans-serif");
    t.setAttribute("font-size", "14");
    t.setAttribute("font-weight", i === 0 ? "700" : "400");
    t.textContent = lineText;
    svg.appendChild(t);
  });
}

// ── Part 2: Scatter pie ───────────────────────────────────────────────────
const scatterByLake = _(seafood)
  .groupBy("lake")
  .map((lakeData, lake) => ({
    lake,
    x: catchLocations[lake as keyof typeof catchLocations].x,
    y: catchLocations[lake as keyof typeof catchLocations].y,
    collection: lakeData.map((item) => ({
      species: item.species,
      count: item.count,
    })),
  }))
  .value();

function renderScatterPieChart(
  id = "chart-scatter-pie",
  w = CHART_W,
  h = CHART_H
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(scatterByLake)
    .flow(scatter("lake", { x: "x", y: "y" }))
    .mark((data) =>
      Chart(data[0].collection, { coord: clock(), axes: false })
        .flow(stack("species", { dir: "x", h: 20, size: "count" }))
        .mark(rect({ fill: "species" }))
    )
    .render(el, { w, h, axes: true });
}

// ── Waffle chart (a composed mark) ─────────────────────────────────────────
// The helper reads like a waffle mark at the call site, but it is only a
// reusable composition: repeat turns counts into unit rows, chunk makes grid
// rows, two spreads position those rows and their cells, and rect draws them.
function waffle({
  count = "count",
  fill,
  columns = 5,
  cell = 8,
}: {
  count?: string;
  fill: string;
  columns?: number;
  cell?: number;
}) {
  return (data: any[]) => {
    return Chart(data, { axes: false })
      .flow(
        derive((rows: any) => _.flatMap(rows, (row) => repeat(row, count))),
        derive((rows: any) => _.chunk(rows, columns)),
        spread({ spacing: 2, dir: "y", reverse: true }),
        spread({ spacing: 2, dir: "x" })
      )
      .mark(rect({ w: cell, h: cell, fill }));
  };
}

// Bottom-aligned lake columns (alignment: "end" in y-down space) fill upward
// from a shared baseline. The waffle helper parks the ragged partial row at
// the top by reversing its row spread.
function renderWaffleChart(id = "chart-q-waffle", w = 340, h = 260) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(seafood, { axes: { x: { side: "end" } } })
    .flow(spread("lake", { spacing: 8, dir: "x", axes: false, alignment: "end" }))
    .mark(waffle({ fill: "species" }))
    .render(el, { w, h });
}

// Barley analog of scatterByLake: one glyph per site, per year, placed at the
// site's real Minnesota geography (approximate lon/lat scaled to chart
// units) — the same "pies on a 2D map" shape as the seafood scatter-pie.
// Pie radius (h) is scaled by each site's total yield that year — using a
// shared min/max across both years so 1931 and 1932 read on the same scale.
// That radius encoding is what makes the Morris anomaly visible: Morris is
// the only site whose total yield *rises* from 1931 to 1932 while every
// other site's total falls, so its pie visibly grows while the rest shrink.
//
// Approximate coordinates of the Minnesota trial sites:
//   University Farm (St. Paul)  44.98 N,  93.18 W
//   Waseca                      44.08 N,  93.51 W
//   Morris                      45.59 N,  95.90 W
//   Crookston                   47.77 N,  96.61 W
//   Grand Rapids                47.24 N,  93.53 W
//   Duluth                      46.79 N,  92.10 W
const barleySiteGeo: Record<string, { lon: number; lat: number }> = {
  "University Farm": { lon: -93.18, lat: 44.98 },
  Waseca: { lon: -93.51, lat: 44.08 },
  Morris: { lon: -95.9, lat: 45.59 },
  Crookston: { lon: -96.61, lat: 47.77 },
  "Grand Rapids": { lon: -93.53, lat: 47.24 },
  Duluth: { lon: -92.1, lat: 46.79 },
};

function barleyScatterByYear(year: 1931 | 1932) {
  return _(barley)
    .filter((d) => d.year === year)
    .groupBy("site")
    .map((siteData, site) => ({
      site,
      // Scale degrees to chart units (1 degree ~ 60 units). Longitude is
      // negative (west of Greenwich), so offset it positive. At ~46 N one
      // degree of longitude covers ~0.7x the ground distance of a degree of
      // latitude, so squash x by that factor to keep the map's aspect
      // roughly honest.
      x: (barleySiteGeo[site].lon + 97) * 60 * 0.7,
      y: (barleySiteGeo[site].lat - 43.5) * 60,
      collection: siteData.map((item) => ({
        variety: item.variety,
        yield: item.yield,
      })),
    }))
    .value();
}

const barleySiteYearTotalYield: Record<string, number> = {};
for (const row of barley) {
  const key = `${row.year}|${row.site}`;
  barleySiteYearTotalYield[key] = (barleySiteYearTotalYield[key] ?? 0) + row.yield;
}
const barleyMaxTotalYield = _.max(Object.values(barleySiteYearTotalYield)) as number;
const barleyMinTotalYield = _.min(Object.values(barleySiteYearTotalYield)) as number;
const BARLEY_PIE_MIN_H = 10;
const BARLEY_PIE_MAX_H = 26;

function barleyPieRadius(totalYield: number) {
  const t =
    (totalYield - barleyMinTotalYield) /
    (barleyMaxTotalYield - barleyMinTotalYield);
  return BARLEY_PIE_MIN_H + t * (BARLEY_PIE_MAX_H - BARLEY_PIE_MIN_H);
}

async function renderBarleyScatterPie(year: 1931 | 1932, id: string) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  await Chart(barleyScatterByYear(year), {
    color: palette(vizStepColors),
    legend: false,
    axes: false,
  })
    .flow(scatter("site", { x: "x", y: "y" }))
    .mark((data) => {
      const site = data[0].site as string;
      const totalYield = barleySiteYearTotalYield[`${year}|${site}`];
      return Chart(data[0].collection, {
        coord: clock(),
        axes: false,
        color: palette(vizStepColors),
        legend: false,
      })
        .flow(
          stack("variety", {
            dir: "x",
            h: barleyPieRadius(totalYield),
            size: "yield",
          })
        )
        .mark(rect({ fill: "variety" }));
    })
    .render(el, { w: 230, h: 230, axes: false, legend: false });

  // GoFish auto-seats a color legend the first time a nested chart-as-glyph
  // mark (like these pies) introduces a given categorical domain in the
  // render session, regardless of the (undocumented / no-op) `legend: false`
  // option above — so only one of the two years ends up with a swatch
  // column, which breaks the side-by-side comparison. Strip it: the pies
  // themselves never render text, so any <text> matching a variety name is
  // legend chrome — remove its nearest ancestor <g> whose siblings include
  // the swatch <rect>s.
  const svg = await waitForChild(el, "svg");
  const varietyNames = new Set(Object.keys(vizStepColors));
  svg?.querySelectorAll("text").forEach((t) => {
    if (!varietyNames.has(t.textContent ?? "")) return;
    const column = t.parentElement?.parentElement;
    column?.remove();
  });
}

function renderFlowerChart() {
  const el = getContainer("chart-flower");
  if (!el || el.children.length > 0) return;

  const FLOWER_RADIUS = 40;
  const stemData = seafood.map((d) => ({
    ...d,
    x: catchLocations[d.lake as keyof typeof catchLocations].x,
  }));

  Layer([
    gofishChart(stemData)
      .flow(gofishScatter({ by: "lake", x: "x" }))
      .mark(rect({ w: 4, h: "count", fill: color.green[5] }).name("stems")),
    gofishChart(select("stems"))
      .flow(gofishGroup({ by: "lake" }))
      .mark(((d: any[]) =>
        gofishSpread(
          { dir: "y", alignment: "middle", spacing: -FLOWER_RADIUS },
          [
            d[0],
            markLayer({ coord: polar() }, [
              stackX(
                {
                  h: FLOWER_RADIUS,
                  spacing: 0,
                  alignment: "start",
                  sharedScale: true,
                },
                (d[0].datum as { species: string; count: number }[]).map((r) =>
                  petal({
                    w: value(r.count),
                    fill: value(r.species).lighten(0.5),
                  })
                )
              ),
            ]),
          ]
        )) as any),
  ]).render(el, { w: CHART_W, h: CHART_H, axes: false });
}

// ── Part 2: Balloon chart ─────────────────────────────────────────────────
// Species appear in seafood in this order → map to color6 indices
const speciesColorMap: Record<string, string> = {
  Bass: color6[0],
  Trout: color6[1],
  Catfish: color6[2],
  Perch: color6[3],
  Salmon: color6[4],
};

function renderBalloonChart() {
  const el = getContainer("chart-balloon");
  if (!el || el.children.length > 0) return;

  const Balloon = (colors: {
    body: string;
    highlight: string;
    knot: string;
  }) =>
    Frame({ box: true }, [
      markLayer({ coord: linear() }, [
        ellipse({
          cx: 0,
          cy: 19,
          w: 24,
          h: 30,
          fill: colors.body,
        }).name("body"),
        ellipse({
          cx: -3,
          cy: 23,
          w: 7,
          h: 11,
          fill: colors.highlight,
        }),
        rect({
          cx: 0,
          cy: 2,
          w: 8,
          h: 4,
          fill: colors.knot,
          rx: 3,
          ry: 2,
        }).name("knot"),
        rect({
          cx: 0,
          cy: 2,
          w: 5,
          h: 2.4,
          fill: colors.knot,
          rx: 2,
          ry: 1,
        }),
      ]).constrain(({ body, knot }) => [
        Constraint.align({ x: "middle", y: ["start", "end"] }, [body, knot]),
      ]),
    ]);

  Layer(
    { coord: wavy(), x: 0, y: 0 },
    [
      Chart(scatterByLake)
        .flow(scatter("lake", { x: "x" }))
        .mark(rect({ w: 1, h: "y", emY: true, fill: "#333" }).name("strings")),
      Chart(select("strings"))
        .flow(group("lake"))
        .mark(((d: any[]) => {
          const datum = d[0].datum as
            | { collection: { species: string; count: number }[] }
            | { collection: { species: string; count: number }[] }[];
          const collection = Array.isArray(datum)
            ? datum[0]?.collection
            : datum.collection;
          const top3 = _.orderBy(collection ?? [], "count", "desc").slice(0, 3);
          const colors = {
            body: speciesColorMap[top3[0]?.species] ?? color6[0],
            highlight: speciesColorMap[top3[1]?.species] ?? color6[1],
            knot: speciesColorMap[top3[2]?.species] ?? color6[2],
          };
          return gofishSpread({ dir: "y", alignment: "middle", spacing: 0 }, [
            d[0],
            Balloon(colors),
          ]);
        }) as any),
    ]
  ).render(el, { w: CHART_W, h: CHART_H, axes: false });
}

// ── Titanic mosaic (nested stack, alternating axes, normalized) ───────────
// Ported from NestedMosaicChart.stories.tsx. Three nested stacks on alternating
// axes; each level's `size: field("count").normalize()` makes that entry's share
// of its parent a data-driven size claim, so the fill composes marginal ×
// conditional × conditional off one raw field. Was pre-rendered while the npm
// nightly predated #675; 0.1.0-nightly.20260709 has it, so this renders live.
// Rows read Crew → First top-to-bottom, matching the retired pre-rendered SVG;
// the .mosaic-row-label offsets in 04-closing.html are measured off this layout.
function renderTitanicMosaic(id = "chart-viz-titanic-mosaic", w = 480, h = 400) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(titanic, {
    axes: false,
    color: palette({ Yes: "#2b8cbe", No: "#c9c2b5" }),
  })
    .flow(
      stack("class", { dir: "y", size: field("count").normalize() }).label(
        "class",
        { position: "center", fontSize: 12, color: "white" }
      ),
      stack("sex", { dir: "x", size: field("count").normalize() }),
      stack("survived", { dir: "y", size: field("count").normalize() })
    )
    .mark(rect({ fill: "survived", stroke: "white", strokeWidth: 1 }))
    .render(el, { w, h, axes: false });
}

// ── Sankey tree (v1 layer/spreadX/stackY/spreadY tree API) ────────────────
// Ported from SankeyTree.stories.tsx: three tiers (class, then sex, then
// survived) laid out as tapering bands with `ribbon`s connecting each named
// source/target pair across tiers.
function renderSankeyTree(id = "chart-viz-ex-sankey", w = 340, h = 230) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const classColor: Record<string, string> = {
    First: color6[0],
    Second: color6[1],
    Third: color6[2],
    Crew: color6[3],
  };
  const layerSpacing = 64;
  const internalSpacing = 2;
  markLayer([
    spreadX({ spacing: layerSpacing, alignment: "middle" }, [
      stackY(
        { spacing: 0, alignment: "middle", reverse: true },
        For(_.groupBy(titanic, "class"), (items, cls) =>
          rect({
            w: 40,
            h: _.sumBy(items, "count") / 10,
            fill: neutral,
          }).name(`${cls}-src`)
        )
      ),
      spreadY(
        { spacing: internalSpacing, alignment: "middle", reverse: true },
        For(_.groupBy(titanic, "class"), (items, cls) =>
          spreadX({ spacing: layerSpacing, alignment: "middle" }, [
            stackY(
              { spacing: 0, alignment: "middle", reverse: true },
              For(_.groupBy(items, "sex"), (items, sex) =>
                rect({
                  w: 40,
                  h: _.sumBy(items, "count") / 10,
                  fill: classColor[cls],
                }).name(`${cls}-${sex}-src`)
              )
            ).name(`${cls}-tgt`),
            spreadY(
              {
                h: _.sumBy(items, "count") / 10,
                spacing: internalSpacing * 2,
                alignment: "middle",
                reverse: true,
              },
              For(_.groupBy(items, "sex"), (items, sex) =>
                spreadX({ spacing: layerSpacing, alignment: "middle" }, [
                  stackY(
                    { spacing: 0, alignment: "middle", reverse: true },
                    For(_.groupBy(items, "survived"), (survivedItems, survived) =>
                      rect({
                        w: 40,
                        h: _.sumBy(survivedItems, "count") / 10,
                        fill: sex === "Female" ? color6[4] : color6[5],
                      }).name(`${cls}-${sex}-${survived}-src`)
                    )
                  ).name(`${cls}-${sex}-tgt`),
                  spreadY(
                    {
                      w: 40,
                      spacing: internalSpacing * 4,
                      alignment: "middle",
                      reverse: true,
                    },
                    For(_.groupBy(items, "survived"), (survivedItems, survived) =>
                      rect({
                        h: _.sumBy(survivedItems, "count") / 10,
                        fill:
                          sex === "Female"
                            ? survived === "No"
                              ? gray
                              : color6[4]
                            : survived === "No"
                              ? gray
                              : color6[5],
                      }).name(`${cls}-${sex}-${survived}-tgt`)
                    )
                  ),
                ])
              )
            ),
          ])
        )
      ),
    ]),
    For(_.groupBy(titanic, "class"), (items, cls) => [
      ribbon(
        {
          dir: "x",
          fill: classColor[cls],
          curve: "bezier",
          opacity: 0.7,
          mixBlendMode: "multiply",
        },
        [ref(`${cls}-src`), ref(`${cls}-tgt`)]
      ),
      For(_.groupBy(items, "sex"), (sexItems, sex) => [
        ribbon(
          {
            dir: "x",
            fill: sex === "Female" ? color6[4] : color6[5],
            curve: "bezier",
            opacity: 0.7,
            mixBlendMode: "multiply",
          },
          [ref(`${cls}-${sex}-src`), ref(`${cls}-${sex}-tgt`)]
        ),
        For(_.groupBy(sexItems, "survived"), (survivedItems, survived) =>
          ribbon(
            {
              dir: "x",
              fill:
                sex === "Female"
                  ? survived === "No"
                    ? gray
                    : color6[4]
                  : survived === "No"
                    ? gray
                    : color6[5],
              curve: "bezier",
              opacity: 0.7,
              mixBlendMode: "multiply",
            },
            [ref(`${cls}-${sex}-${survived}-src`), ref(`${cls}-${sex}-${survived}-tgt`)]
          )
        ),
      ]),
    ]),
  ]).render(el, { w, h, axes: false });
}

// ── Nightingale rose (polar-area diagram, coord: clock()) ──────────────────
// Ported from the "Rose" story in forwardsyntax/Pie.stories.tsx: months
// spread around the clock, cause-of-death stacked radially, magnitude
// square-rooted so wedge area (not radius) encodes death count.
function renderNightingaleRose(id = "chart-viz-ex-rose", w = 230, h = 230) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(nightingale, { coord: clock() })
    .flow(
      spread("Month", { dir: "x", spacing: 0, axes: { x: false, y: true } }),
      // The sqrt must land before `stack`, which now reads `Death` off the data
      // for its own `size` channel rather than leaving it to the mark's `h`.
      derive((d: any[]) => d.map((d) => ({ ...d, Death: Math.sqrt(d.Death) }))),
      stack("Type", { dir: "y", size: "Death" })
    )
    .mark(rect({ w: (Math.PI * 2) / 12, emX: true, fill: "Type" }))
    .render(el, { w, h });
}

// ── Bottle pictorial (paint compositing over an image, constrained label) ──
// Ported from piccl/Bottle.stories.tsx: a row of bottles filled to a
// percentage, the fill rect composited onto the bottle image with a "color"
// blend mode, a fill-line rect and a percent label constrained to align with
// it.
const bottleData = [
  { category: "a", amount: 30 },
  { category: "d", amount: 60 },
  { category: "b", amount: 75 },
  { category: "c", amount: 100 },
];

function renderBottleChart(id = "chart-viz-ex-bottle", w = 380, h = 210) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(bottleData, { axes: false })
    .flow(spread("category", { dir: "x", spacing: 20, axes: { x: false } }))
    .mark(
      markLayer([
        paint({ blendMode: "color" }, [
          image({ href: bottlePng, h: v(100) }),
          rect({ h: "amount", w: 175, fill: "#00ff00" }),
        ]).name("bottle"),
        rect({ h: 1, fill: "#666", w: 175, y: "amount" }).name("line"),
        text({ fontSize: 35, fill: "#666", text: (d: any) => `${d.amount}%` }).name(
          "label"
        ),
      ]).constrain(({ line, label, bottle }: any) => [
        Constraint.align({ x: "start" }, [bottle, line]),
        Constraint.distribute({ dir: "y", spacing: 0 }, [line, label]),
        Constraint.align({ x: "end" }, [label, line]),
      ])
    )
    .render(el, { w, h });
}

// ── Base-form counterparts for the "before/after" query-gallery pairs ──────
// Same datasets and helpers as the four chart-q-* renderers above, minus the
// one structural move that buys the partner's extra query clause. Used by
// the "moves that change the query" / "a move that doesn't" slides.

// Pair 1: gridded small-multiple pies. Same per-lake pie glyph as
// renderScatterPieChart, just spread along a plain row instead of scattered
// at each lake's real (x, y) map location.
// Middle step of the scatterpie triptych: the same shares as a row of pies.
// stack -> clock coords is a pure restyle (the query is unchanged); the
// scatterpie step after it is what adds placement in space.
function renderScatterPieSpreadMid(
  id = "chart-q-scatterpie-mid",
  w = 340,
  h = 260
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(scatterByLake, { axes: false })
    .flow(spread("lake", { dir: "x", spacing: 50 }))
    .mark((data) =>
      Chart(data[0].collection, { coord: clock(), axes: false })
        .flow(stack("species", { dir: "x", h: 20, size: "count" }))
        .mark(rect({ fill: "species" }))
    )
    .render(el, { w, h, axes: false });
}

// The scatterpie's "before": normalized stacked bars over the same seafood
// data. Pies read shares, so a share-scaled stack is the faithful base —
// the scatterpie move then purely adds position in space.
function renderScatterPieGridBase(
  id = "chart-q-scatterpie-base",
  w = 340,
  h = 260
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(seafood, { axes: { x: true, y: true } })
    .flow(
      spread("lake", { spacing: 24, dir: "x" }),
      stack("species", { dir: "y", size: field("count").normalize() })
    )
    .mark(rect({ w: 36, fill: "species" }))
    .render(el, { w, h, axes: { x: true, y: true } });
}

// Pair 2: plain stacked bar. Same seafood counts and stack-by-species move
// as renderWaffleChart, but sized continuously (`size: "count"`) instead of
// unitized into unit squares via repeat()/chunk().
function renderStackedBarBase(id = "chart-q-waffle-base", w = 340, h = 260) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(seafood, { axes: { x: true, y: true } })
    .flow(
      spread("lake", { spacing: 24, dir: "x" }),
      stack("species", { dir: "y", size: "count" })
    )
    .mark(rect({ w: 36, fill: "species" }))
    .render(el, { w, h, axes: { x: true, y: true } });
}

// Pair 3: single normalized stack. Same `share` field expression as
// renderTitanicMosaic minus the sex level: a TWO-level mosaic (class rows,
// survival split within each row). This is the Simpson's-paradox "before":
// it reads Third (25.2%) surviving at a higher rate than Crew (24.0%).
// Adding the sex level (the three-level partner chart) reverses it — Crew
// beats Third within BOTH sexes (men 22.3% vs 17.3%, women 87.0% vs 45.9%).
function renderMosaicSingleStackBase(
  id = "chart-q-mosaic-base",
  w = 300,
  h = 250
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(titanic, {
    axes: false,
    color: palette({ Yes: "#2b8cbe", No: "#c9c2b5" }),
  })
    .flow(
      stack("class", { dir: "y", size: field("count").normalize() }).label(
        "class",
        { position: "center", fontSize: 12, color: "white" }
      ),
      stack("survived", { dir: "x", size: field("count").normalize() })
    )
    .mark(rect({ fill: "survived", stroke: "white", strokeWidth: 1 }))
    .render(el, { w, h, axes: false });
}

// Slide B pair: the bottle's base form. A gray capacity bar sits behind a
// green fill bar, using the same small mark layer as the pictorial's paint
// composition but without the bottle image.

function renderBottleBarBase(id = "chart-q-bottle-base", w = 220, h = 210) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(bottleData, {
    axes: { x: true, y: true },
    legend: false,
  })
    .flow(spread("category", { dir: "x", spacing: 12 }))
    .mark(
      markLayer([
        rect({ w: 36, h: datum(100), fill: "#e0ded4" }),
        rect({ w: 36, h: "amount", fill: "#5aa66c" }),
      ])
    )
    .render(el, { w, h, axes: { x: true, y: true }, legend: false });
}

// ── Move 4: sort + connect, composed (closing "moves" slide) ───────────────
// vendor-gofish/src/data/energy.ts turned out to be Sankey flow data (nodes +
// links for a single-year UK energy diagram) with no period dimension at
// all — unusable for a "for each year" ribbon. Real figures instead: UK
// share of electricity generation (%), Our World in Data / Ember yearly
// electricity data. Verified by script: between 2014 and 2018 Wind passes
// Coal (and Nuclear passes Coal too, as Coal collapses 29.6 -> 5.0); between
// 2018 and 2022 Wind passes Nuclear; Solar passes Coal by 2022. Five
// sources, so no top-N filtering was needed.
type EnergyMixRow = { year: number; source: string; amount: number };
const energyMix: EnergyMixRow[] = [
  { year: 2010, source: "Gas", amount: 46.0 },
  { year: 2010, source: "Coal", amount: 28.2 },
  { year: 2010, source: "Nuclear", amount: 16.3 },
  { year: 2010, source: "Wind", amount: 2.7 },
  { year: 2010, source: "Solar", amount: 0.0 },

  { year: 2014, source: "Gas", amount: 29.8 },
  { year: 2014, source: "Coal", amount: 29.6 },
  { year: 2014, source: "Nuclear", amount: 18.9 },
  { year: 2014, source: "Wind", amount: 9.5 },
  { year: 2014, source: "Solar", amount: 1.2 },

  { year: 2018, source: "Gas", amount: 39.4 },
  { year: 2018, source: "Coal", amount: 5.0 },
  { year: 2018, source: "Nuclear", amount: 19.5 },
  { year: 2018, source: "Wind", amount: 17.1 },
  { year: 2018, source: "Solar", amount: 3.8 },

  { year: 2022, source: "Gas", amount: 38.5 },
  { year: 2022, source: "Coal", amount: 1.8 },
  { year: 2022, source: "Nuclear", amount: 14.6 },
  { year: 2022, source: "Wind", amount: 24.7 },
  { year: 2022, source: "Solar", amount: 4.1 },
];

const energyPalette = palette({
  Gas: "#c78755",
  Coal: "#5b4a42",
  Nuclear: "#a181c8",
  Wind: "#49a66a",
  Solar: "#f0bf4d",
});

// One renderer for all three charts on the move-3 slide. `sort` orders each
// year's stack by amount (rank as position); `.layer(ribbon(...))` connects
// each source across years (identity as continuity). The slide composes the
// two moves: base = sort only; area = a fixed-order stack fused directly
// into solid ribbon bands; ribbon = sort + connect, where a crossing is a
// rank inversion.
function renderEnergyStackChart(
  id: string,
  {
    sort = false,
    connect = false,
    area = false,
    w = 340,
    h = 260,
    barW = 36,
    spacing = 30,
  }: {
    sort?: boolean;
    connect?: boolean;
    area?: boolean;
    w?: number;
    h?: number;
    barW?: number;
    spacing?: number;
  } = {}
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const chartOptions = { axes: { x: true, y: true }, color: energyPalette };
  const flow = [
    spread("year", { dir: "x", spacing }),
    stack(sort ? field("source").sort("amount") : "source", {
      dir: "y",
    }),
  ];
  const base = Chart(energyMix, chartOptions).flow(...flow);
  const result = area
    ? base.mark(
        ribbon({ by: "source", h: "amount", fill: "source", opacity: 0.8 })
      )
    : (() => {
        const bars = base.mark(rect({ w: barW, h: "amount", fill: "source" }));
        return connect ? bars.layer(ribbon({ by: "source", opacity: 0.5 })) : bars;
      })();
  result.render(el, { w, h, axes: { x: true, y: true } });
}

// Left-column ingredient charts render smaller (they stack vertically);
// the ribbon is the payoff and renders at the full pair size.
function renderEnergyRibbonBase(id = "chart-move-ribbon-base") {
  renderEnergyStackChart(id, { sort: true, w: 280, h: 180, barW: 26 });
}
function renderEnergyRibbonMid(id = "chart-move-ribbon-mid") {
  renderEnergyStackChart(id, { area: true, w: 420, h: 180, spacing: 90 });
}
function renderEnergyRibbon(id = "chart-move-ribbon") {
  renderEnergyStackChart(id, { sort: true, connect: true, w: 400, h: 320 });
}

// ── Public API ────────────────────────────────────────────────────────────
export function renderCharts() {
  renderFranconeriA();
  renderPlainScatter();
  renderPlainBars();
  renderAggSiteYear();
  renderAggSiteYearHighlight();
  renderAggYearSite();
  renderRevealChart("chart-viz-reveal-anon", false);
  renderRevealChart("chart-viz-reveal-real", true);
  // Mini thumbnails: suppress the x-axis category labels — at 300x210 they
  // don't fit under/inside the grouped bars — but keep the y-axis.
  renderAggSiteYear("chart-viz-agg-site-year-mini", 300, 210, { x: false, y: true });
  renderAggYearSite("chart-viz-agg-year-site-mini", 300, 210, { x: false, y: true });
  renderAggSiteYearHighlight(
    "chart-viz-agg-site-year-highlight-mini",
    300,
    210,
    { x: false, y: true }
  );
  renderAggSiteYear("chart-viz-agg-site-year-spec", 300, 210);
  renderAggYearSite("chart-viz-agg-year-site-spec", 300, 210);
  addOuterGroupBoxes("chart-viz-agg-site-year-spec", 6);
  addOuterGroupBoxes("chart-viz-agg-year-site-spec", 2);
  // "each line of the spec is a cut" (now in the walkthrough section, right
  // after "nesting order matters"): one stepped section per cut stop
  // (chart | spec | chip in a row), advanced top-to-bottom. The focused
  // region is a drawn boundary (Gestalt common region), not the
  // gray-fallback dimming renderAggSiteYearHighlight uses elsewhere — it
  // shrinks from the whole plot (step 1) to one bar (step 3) as the cut
  // descends, mirroring the chips' bindings growing over the same span.
  renderCutSiteCollapsed("chart-viz-cut-site", CUT_CHART_W, CUT_CHART_H);
  addFocusBox("chart-viz-cut-site", { allGroups: true });
  renderVizSiteYear("chart-viz-cut-year", CUT_CHART_W, CUT_CHART_H);
  stripLegend("chart-viz-cut-year").then(() =>
    addFocusBox("chart-viz-cut-year", { site: CUT_FOCUS_SITE })
  );
  renderVizSiteYear("chart-viz-cut-mark", CUT_CHART_W, CUT_CHART_H);
  stripLegend("chart-viz-cut-mark").then(() =>
    addFocusBox("chart-viz-cut-mark", {
      site: CUT_FOCUS_SITE,
      year: CUT_FOCUS_YEAR,
    })
  );
  renderFranconeriAColor();
  renderFranconeriAColorKey();
  renderFranconeriB();
  renderFranconeriC();
  renderFranconeriAKey();
  renderFranconeriBKey();
  renderVizSiteSlots();
  renderVizSiteYield();
  renderVizSiteYield("chart-viz-site-yield-transform");
  renderVizSiteYear();
  renderVizSiteVarietyMini();
  renderVizVarietySiteMini();
  renderVizVarietyStackRaw();
  renderVizVarietyShare();
  renderVizVarietyPiesTable();
  renderVizStackedSorted();
  renderVizYearSorted();
  renderVizRibbon();
  renderVizRibbon("chart-viz-ribbon-highlight", true);
  renderScatterPieChart();
  renderScatterPieChart("chart-q-scatterpie", 340, 260);
  renderScatterPieGridBase();
  renderScatterPieSpreadMid();
  renderWaffleChart();
  renderStackedBarBase();
  renderTitanicMosaic("chart-q-mosaic", 300, 250);
  renderMosaicSingleStackBase();
  renderBottleChart("chart-q-bottle");
  renderBottleBarBase();
  renderEnergyRibbonBase();
  renderEnergyRibbonMid();
  renderEnergyRibbon();
  renderBarleyScatterPie(1931, "chart-viz-barley-pie-1931");
  renderBarleyScatterPie(1932, "chart-viz-barley-pie-1932");
  renderVizBarleySlopePoints();
  renderVizBarleySlopePanels();
  renderVizBarleySlopePanels("chart-viz-barley-slope-highlight", true);
  renderVizBarleySlopePanels(
    "chart-viz-barley-slope-annotated",
    true,
    SLOPE_W,
    SLOPE_H,
    true
  );
  renderVizBarleySlopePanels("chart-viz-barley-slope-restate");
  // Morph waypoints (2026-07-11): slope -> anchored slope -> delta dots/bars.
  // See charts.ts comments above renderVizBarleySlopePanels.
  renderVizBarleySlopeAnchored();
  renderVizBarleyDeltaDots();
  renderVizBarleyDeltaBars();
  renderVizBarleyDeltaBars("chart-viz-barley-delta-bars-highlight", {
    highlight: true,
  });
  renderVizBarleyDeltaBars("chart-viz-barley-delta-bars-annotated", {
    highlight: true,
    annotate: true,
  });
  renderFlowerChart();
  renderBalloonChart();
  renderSankeyTree();
  renderTitanicMosaic();
  renderNightingaleRose();
  renderBottleChart();
  renderVizOpSpread();
  renderVizOpStack();
  renderVizOpScatter();
  renderVizOpRibbon();
  renderVizOpTable();
}

function renderChartById(id: string) {
  const fn = chartRenderers[id];
  if (fn) fn();
}

export const chartRenderers: Record<string, () => void> = {
  "chart-viz-site-slots": renderVizSiteSlots,
  "chart-viz-site-yield": () => renderVizSiteYield(),
  "chart-viz-site-yield-transform": () =>
    renderVizSiteYield("chart-viz-site-yield-transform"),
  "chart-viz-site-year": () => renderVizSiteYear(),
  "chart-viz-site-variety-mini": renderVizSiteVarietyMini,
  "chart-viz-variety-site-mini": renderVizVarietySiteMini,
  "chart-viz-spread-variety": () => renderVizVarietySpread(),
  "chart-viz-stacked": () => renderVizVarietyStackRaw(),
  "chart-viz-stacked-share": () => renderVizVarietyShare(),
  "chart-viz-variety-pies-table": () => renderVizVarietyPiesTable(),
  "chart-viz-stacked-sorted": () => renderVizStackedSorted(),
  "chart-viz-year-sorted": renderVizYearSorted,
  "chart-viz-ribbon": () => renderVizRibbon(),
  "chart-viz-ribbon-highlight": () =>
    renderVizRibbon("chart-viz-ribbon-highlight", true),
  "chart-viz-barley-pie-1931": () =>
    renderBarleyScatterPie(1931, "chart-viz-barley-pie-1931"),
  "chart-viz-barley-pie-1932": () =>
    renderBarleyScatterPie(1932, "chart-viz-barley-pie-1932"),
  "chart-viz-barley-slope-points": renderVizBarleySlopePoints,
  "chart-viz-barley-slope": renderVizBarleySlopePanels,
  "chart-viz-barley-slope-highlight": () =>
    renderVizBarleySlopePanels("chart-viz-barley-slope-highlight", true),
  "chart-viz-barley-slope-annotated": () =>
    renderVizBarleySlopePanels(
      "chart-viz-barley-slope-annotated",
      true,
      SLOPE_W,
      SLOPE_H,
      true
    ),
  // Re-states the same chart as "chart-viz-barley-slope" on the "simplify
  // your message" slide, right after the section break — same underlying
  // spec, a second DOM container (duplicate `id`s across slides silently
  // break `getContainer`'s `getElementById` lookup, see main.ts).
  "chart-viz-barley-slope-restate": () =>
    renderVizBarleySlopePanels("chart-viz-barley-slope-restate"),
  "chart-viz-barley-slope-anchored": renderVizBarleySlopeAnchored,
  "chart-viz-barley-delta-dots": renderVizBarleyDeltaDots,
  "chart-viz-barley-delta-bars": () => renderVizBarleyDeltaBars(),
  "chart-viz-barley-delta-bars-highlight": () =>
    renderVizBarleyDeltaBars("chart-viz-barley-delta-bars-highlight", {
      highlight: true,
    }),
  "chart-viz-barley-delta-bars-annotated": () =>
    renderVizBarleyDeltaBars("chart-viz-barley-delta-bars-annotated", {
      highlight: true,
      annotate: true,
    }),
  "chart-franconeri-a": renderFranconeriA,
  "chart-plain-scatter": () => renderPlainScatter(),
  "chart-plain-bars": () => renderPlainBars(),
  "chart-viz-agg-site-year": renderAggSiteYear,
  "chart-viz-agg-site-year-highlight": renderAggSiteYearHighlight,
  "chart-viz-agg-year-site": renderAggYearSite,
  "chart-viz-reveal-anon": () => renderRevealChart("chart-viz-reveal-anon", false),
  "chart-viz-reveal-real": () => renderRevealChart("chart-viz-reveal-real", true),
  "chart-viz-agg-site-year-mini": () =>
    renderAggSiteYear("chart-viz-agg-site-year-mini", 300, 210, {
      x: false,
      y: true,
    }),
  "chart-viz-agg-year-site-mini": () =>
    renderAggYearSite("chart-viz-agg-year-site-mini", 300, 210, {
      x: false,
      y: true,
    }),
  "chart-viz-agg-site-year-highlight-mini": () =>
    renderAggSiteYearHighlight(
      "chart-viz-agg-site-year-highlight-mini",
      300,
      210,
      { x: false, y: true }
    ),
  "chart-viz-agg-site-year-spec": () => {
    renderAggSiteYear("chart-viz-agg-site-year-spec", 300, 210);
    addOuterGroupBoxes("chart-viz-agg-site-year-spec", 6);
  },
  "chart-viz-agg-year-site-spec": () => {
    renderAggYearSite("chart-viz-agg-year-site-spec", 300, 210);
    addOuterGroupBoxes("chart-viz-agg-year-site-spec", 2);
  },
  "chart-viz-cut-site": () => {
    renderCutSiteCollapsed("chart-viz-cut-site", CUT_CHART_W, CUT_CHART_H);
    addFocusBox("chart-viz-cut-site", { allGroups: true });
  },
  "chart-viz-cut-year": () => {
    renderVizSiteYear("chart-viz-cut-year", CUT_CHART_W, CUT_CHART_H);
    stripLegend("chart-viz-cut-year").then(() =>
      addFocusBox("chart-viz-cut-year", { site: CUT_FOCUS_SITE })
    );
  },
  "chart-viz-cut-mark": () => {
    renderVizSiteYear("chart-viz-cut-mark", CUT_CHART_W, CUT_CHART_H);
    stripLegend("chart-viz-cut-mark").then(() =>
      addFocusBox("chart-viz-cut-mark", {
        site: CUT_FOCUS_SITE,
        year: CUT_FOCUS_YEAR,
      })
    );
  },
  "chart-franconeri-a-color": renderFranconeriAColor,
  "chart-franconeri-a-color-key": renderFranconeriAColorKey,
  "chart-franconeri-a-key-2": () => {
    const el = getContainer("chart-franconeri-a-key-2");
    if (!el || el.children.length > 0) return;
    Chart(franconeriHeights)
      .flow(
        spread("age", { dir: "x", spacing: 16 }),
        spread("person", { dir: "x", spacing: 4 })
      )
      .mark(rect({ h: "height", fill: FRANCONERI_BAR_COLOR }))
      .render(el, { w: KEY_W, h: KEY_H, axes: true });
  },
  "chart-franconeri-b-key-2": () => {
    const el = getContainer("chart-franconeri-b-key-2");
    if (!el || el.children.length > 0) return;
    Chart(franconeriHeights)
      .flow(
        spread("person", { dir: "x", spacing: 16 }),
        spread("age", { dir: "x", spacing: 4 })
      )
      .mark(rect({ h: "height", fill: FRANCONERI_BAR_COLOR }))
      .render(el, { w: KEY_W, h: KEY_H, axes: true });
  },
  "chart-franconeri-a-color-key-2": () => {
    const el = getContainer("chart-franconeri-a-color-key-2");
    if (!el || el.children.length > 0) return;
    Chart(franconeriHeights)
      .flow(
        spread("age", { dir: "x", spacing: 16 }),
        spread("person", { dir: "x", spacing: 4 })
      )
      .mark(rect({ h: "height", fill: "person" }))
      .render(el, { w: KEY_W, h: KEY_H, axes: true });
  },
  "chart-franconeri-b": renderFranconeriB,
  "chart-franconeri-c": renderFranconeriC,
  "chart-franconeri-a-key": renderFranconeriAKey,
  "chart-franconeri-b-key": renderFranconeriBKey,
  // retrospective — three Franconeri charts with specs
  "chart-retro-a": () => {
    const el = getContainer("chart-retro-a");
    if (!el || el.children.length > 0) return;
    Chart(franconeriHeights)
      .flow(
        spread("age", { dir: "x", spacing: 16 }),
        spread("person", { dir: "x", spacing: 4 })
      )
      .mark(rect({ h: "height", fill: FRANCONERI_BAR_COLOR }))
      .render(el, { w: CHART_W, h: CHART_H, axes: true });
  },
  "chart-retro-b": () => {
    const el = getContainer("chart-retro-b");
    if (!el || el.children.length > 0) return;
    Chart(franconeriHeights)
      .flow(
        spread("person", { dir: "x", spacing: 16 }),
        spread("age", { dir: "x", spacing: 4 })
      )
      .mark(rect({ h: "height", fill: FRANCONERI_BAR_COLOR }))
      .render(el, { w: CHART_W, h: CHART_H, axes: true });
  },
  "chart-retro-c": () => {
    const el = getContainer("chart-retro-c");
    if (!el || el.children.length > 0) return;
    Layer([
      Chart(franconeriHeights)
        .flow(group("person"), scatter("age", { x: "age", y: "height" }))
        .mark(scaffold().name("retro-pts")),
      Chart(select("retro-pts"))
        .flow(group("person"))
        .mark(line({ strokeWidth: 2 })),
    ]).render(el, { w: CHART_W, h: CHART_H, axes: true });
  },
  // ── Key/value structure digression ──────────────────────────────────────
  "chart-kv-stacked-2": () => {
    const el = getContainer("chart-kv-stacked-2");
    if (!el || el.children.length > 0) return;
    Chart(seafood)
      .flow(
        spread("lake", { dir: "x" }),
        stack("species", { dir: "y", size: "count" })
      )
      .mark(rect({ fill: "species" }))
      .render(el, { w: 280, h: 220, axes: true });
  },
  "chart-kv-stacked": () => {
    const el = getContainer("chart-kv-stacked");
    if (!el || el.children.length > 0) return;
    Chart(seafood)
      .flow(
        spread("lake", { dir: "x" }),
        stack("species", { dir: "y", size: "count" })
      )
      .mark(rect({ fill: "species" }))
      .render(el, { w: 280, h: 220, axes: true });
  },
  "chart-kv-grouped": () => {
    const el = getContainer("chart-kv-grouped");
    if (!el || el.children.length > 0) return;
    Chart(seafood)
      .flow(
        spread("lake", { dir: "x" }),
        spread("species", { dir: "x", spacing: 2 })
      )
      .mark(rect({ h: "count", fill: "species" }))
      .render(el, { w: 280, h: 220, axes: true });
  },
  "chart-kv-grouped-r": () => {
    const el = getContainer("chart-kv-grouped-r");
    if (!el || el.children.length > 0) return;
    Chart(seafood)
      .flow(
        spread("species", { dir: "x" }),
        spread("lake", { dir: "x", spacing: 2 })
      )
      .mark(rect({ h: "count", fill: "species" }))
      .render(el, { w: 280, h: 220, axes: true });
  },
  "chart-viz-nest-stacked": () => {
    const el = getContainer("chart-viz-nest-stacked");
    if (!el || el.children.length > 0) return;
    Chart(barley, vizChartOptions)
      .flow(
        spread("variety", { dir: "x" }),
        stack("site", { dir: "y", size: "yield" })
      )
      .mark(rect({ fill: "site" }))
      .render(el, { w: 280, h: 220, axes: true, legend: false });
  },
  "chart-viz-nest-grouped": () => {
    const el = getContainer("chart-viz-nest-grouped");
    if (!el || el.children.length > 0) return;
    Chart(barley, vizChartOptions)
      .flow(
        spread("year", { dir: "x" }),
        spread("site", { dir: "x", spacing: 2 })
      )
      .mark(rect({ h: "yield", fill: "site" }))
      .render(el, { w: 280, h: 220, axes: true, legend: false });
  },
  "chart-viz-nest-grouped-r": () => {
    const el = getContainer("chart-viz-nest-grouped-r");
    if (!el || el.children.length > 0) return;
    Chart(barley, vizChartOptions)
      .flow(
        spread("site", { dir: "x" }),
        spread("year", { dir: "x", spacing: 2 })
      )
      .mark(rect({ h: "yield", fill: "site" }))
      .render(el, { w: 280, h: 220, axes: true, legend: false });
  },
  "chart-viz-nest-heatmap": () => {
    const el = getContainer("chart-viz-nest-heatmap");
    if (!el || el.children.length > 0) return;
    Chart(barley, { color: gradient(["#e8f4f8", "#1a5276"]) })
      .flow(table("site", "year", { spacing: 4 }))
      .mark(rect({ fill: "yield" }))
      .render(el, { w: 280, h: 220, axes: true, legend: false });
  },
  // Repeat of the 3-panel "nesting order matters" slide, shown again after
  // the "each line of the spec is a cut" slides with new-notation chips.
  // Distinct ids from the first showing — charts render eagerly by id, so
  // reusing chart-viz-nest-grouped-r/-grouped/-heatmap here would leave this
  // slide's containers empty (already rendered once = never re-rendered).
  "chart-viz-nest-grouped-r-q": () => {
    const el = getContainer("chart-viz-nest-grouped-r-q");
    if (!el || el.children.length > 0) return;
    Chart(barley, vizChartOptions)
      .flow(
        spread("site", { dir: "x" }),
        spread("year", { dir: "x", spacing: 2 })
      )
      .mark(rect({ h: "yield", fill: "site" }))
      .render(el, { w: 280, h: 220, axes: true, legend: false });
  },
  "chart-viz-nest-grouped-q": () => {
    const el = getContainer("chart-viz-nest-grouped-q");
    if (!el || el.children.length > 0) return;
    Chart(barley, vizChartOptions)
      .flow(
        spread("year", { dir: "x" }),
        spread("site", { dir: "x", spacing: 2 })
      )
      .mark(rect({ h: "yield", fill: "site" }))
      .render(el, { w: 280, h: 220, axes: true, legend: false });
  },
  "chart-viz-nest-heatmap-q": () => {
    const el = getContainer("chart-viz-nest-heatmap-q");
    if (!el || el.children.length > 0) return;
    Chart(barley, { color: gradient(["#e8f4f8", "#1a5276"]) })
      .flow(table("site", "year", { spacing: 4 }))
      .mark(rect({ fill: "yield" }))
      .render(el, { w: 280, h: 220, axes: true, legend: false });
  },
  // Larger solo instances for the one-at-a-time build-up before the 3-panel slide
  "chart-viz-nest-grouped-r-solo": () => {
    const el = getContainer("chart-viz-nest-grouped-r-solo");
    if (!el || el.children.length > 0) return;
    Chart(barley, vizChartOptions)
      .flow(spread("site", { dir: "x" }), spread("year", { dir: "x", spacing: 2 }))
      .mark(rect({ h: "yield", fill: "site" }))
      .render(el, { w: 560, h: 360, axes: true, legend: false });
  },
  "chart-viz-nest-grouped-solo": () => {
    const el = getContainer("chart-viz-nest-grouped-solo");
    if (!el || el.children.length > 0) return;
    Chart(barley, vizChartOptions)
      .flow(spread("year", { dir: "x" }), spread("site", { dir: "x", spacing: 2 }))
      .mark(rect({ h: "yield", fill: "site" }))
      .render(el, { w: 560, h: 360, axes: true, legend: false });
  },
  "chart-viz-nest-heatmap-solo": () => {
    const el = getContainer("chart-viz-nest-heatmap-solo");
    if (!el || el.children.length > 0) return;
    Chart(barley, { color: gradient(["#e8f4f8", "#1a5276"]) })
      .flow(table("site", "year", { spacing: 4 }))
      .mark(rect({ fill: "yield" }))
      .render(el, { w: 560, h: 360, axes: true, legend: false });
  },
  "chart-arc-bars": () => renderPlainBars("chart-arc-bars"),
  "chart-arc-slope": () =>
    renderVizBarleySlopePanels("chart-arc-slope", true, 540, 280),
  "chart-arc-delta-bars": () =>
    renderVizBarleyDeltaBars("chart-arc-delta-bars"),
  "chart-arc-waffle": () => renderWaffleChart("chart-arc-waffle", 300, 220),
  "chart-arc-mosaic": () =>
    renderTitanicMosaic("chart-arc-mosaic", 300, 220),
  "chart-arc-ribbon": () => renderEnergyRibbon("chart-arc-ribbon"),
  "chart-arc-bottle": () => renderBottleChart("chart-arc-bottle", 300, 200),
  "chart-arc-sankey": () => renderSankeyTree("chart-arc-sankey"),
  "chart-kv-heatmap": () => {
    const el = getContainer("chart-kv-heatmap");
    if (!el || el.children.length > 0) return;
    Chart(seafood, { color: gradient(["#e8f4f8", "#1a5276"]) })
      .flow(table("lake", "species", { spacing: 4 }))
      .mark(rect({ fill: "count" }))
      .render(el, { w: 280, h: 220, axes: true, legend: false });
  },
  "chart-scatter-pie": renderScatterPieChart,
  "chart-q-scatterpie": () => renderScatterPieChart("chart-q-scatterpie", 340, 260),
  "chart-q-scatterpie-base": () => renderScatterPieGridBase(),
  "chart-q-scatterpie-mid": () => renderScatterPieSpreadMid(),
  "chart-q-waffle": () => renderWaffleChart(),
  "chart-q-waffle-base": () => renderStackedBarBase(),
  "chart-q-mosaic": () => renderTitanicMosaic("chart-q-mosaic", 300, 250),
  "chart-q-mosaic-base": () => renderMosaicSingleStackBase(),
  "chart-q-bottle": () => renderBottleChart("chart-q-bottle"),
  "chart-q-bottle-base": () => renderBottleBarBase(),
  "chart-move-ribbon-base": () => renderEnergyRibbonBase(),
  "chart-move-ribbon-mid": () => renderEnergyRibbonMid(),
  "chart-move-ribbon": () => renderEnergyRibbon(),
  "chart-flower": renderFlowerChart,
  "chart-balloon": renderBalloonChart,
  "chart-viz-ex-sankey": () => renderSankeyTree(),
  "chart-viz-titanic-mosaic": () => renderTitanicMosaic(),
  "chart-viz-ex-rose": () => renderNightingaleRose(),
  "chart-viz-ex-bottle": () => renderBottleChart(),
  "chart-viz-op-spread": renderVizOpSpread,
  "chart-viz-op-stack": renderVizOpStack,
  "chart-viz-op-scatter": renderVizOpScatter,
  "chart-viz-op-ribbon": renderVizOpRibbon,
  "chart-viz-op-table": renderVizOpTable,
};
