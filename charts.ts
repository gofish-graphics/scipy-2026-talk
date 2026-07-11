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

const vizStepColors = {
  Manchuria: "#f0bf4d",
  Glabron: "#e86f5d",
  Svansota: "#d45e83",
  Velvet: "#68a9d8",
  Trebi: "#8fcf8f",
  "No. 457": "#a181c8",
  "No. 462": "#ff9666",
  Peatland: "#b58cd9",
  "No. 475": "#5aa6a6",
  "Wisconsin No. 38": "#c78755",
  "University Farm": "#9aa3ad",
  Waseca: "#f0bf4d",
  Morris: "#49a66a",
  Crookston: "#68a9d8",
  "Grand Rapids": "#4e79a7",
  Duluth: "#e86f5d",
};

type BarleyRow = {
  year: 1931 | 1932;
  variety: string;
  site: string;
  yield: number;
};

const barley = barleyRaw as BarleyRow[];

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
    .mark(rect({ h: "sales", fill: "city" }))
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
    .mark(rect({ h: "sales", fill: "city" }))
    .render(el, { w, h, axes, legend: false });
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

function renderVizSiteYear(id = "chart-viz-site-year") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("site", { dir: "x", spacing: 24 }),
      spread("year", { dir: "x", spacing: 4 })
    )
    .mark(rect({ h: "yield", fill: "site" }))
    .render(el, VIZ_RENDER_OPTIONS);
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

function renderVizStacked(id = "chart-viz-stacked") {
  renderVizStackChart(id, {});
}
function renderVizStackedSorted(id = "chart-viz-stacked-sorted") {
  renderVizStackChart(id, { sort: true });
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

// Same facet skeleton as the stacked-bar charts (renderVizSiteYear above:
// spread site 24 / year 4), just with the mark swapped from a stacked rect
// to a scattered circle: this is literally the slope chart's first layer,
// rendered on its own — the bridge slide before the connecting line gets
// drawn. One flat pipeline, no nested chart: spread facets by site, spread
// facets by year within each site, then scatter positions each remaining
// row (one per variety) by yield — `by` is omitted because a bare scatter
// already splits its input one entry per row.
function renderVizBarleySlopePoints(
  id = "chart-viz-barley-slope-points",
  w = SLOPE_W,
  h = SLOPE_H
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("site", { dir: "x", spacing: 24 }),
      spread("year", { dir: "x", spacing: 6 }),
      scatter({ y: "yield" })
    )
    .mark(circle({ r: 3, fill: "variety" }))
    .render(el, { w, h, axes: true, legend: false });
}

// One line per variety per site, connecting its 1931 -> 1932 yield. Facets
// by site with the mark-as-function pattern (see FacetedChart.stories.tsx);
// within each site's facet, points are named then re-selected and grouped by
// variety to draw the connecting line — the same "name it, select it, group
// it, connect it" idiom as the ribbon (renderVizRibbon above), just with
// `line` standing in for `area`. The installed `gofish-graphics` build's
// `markLayer` mark-combinator form does NOT give each facet call its own
// local name registry — it inherits the enclosing chart's `layerContext`, so
// a single literal name like "slope-pts" would collide across all six site
// facets (each `selectAll` picking up all 6 sites' points, not just its own
// panel's). Naming the points per site (`slope-pts-${site}`) keeps each
// panel's connecting line scoped to that panel even though the registry
// itself is effectively global.
function renderVizBarleySlopePanels(
  id = "chart-viz-barley-slope",
  highlight = false,
  w = SLOPE_W,
  h = SLOPE_H
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(spread("site", { dir: "x", spacing: 20 }))
    .mark((data) => {
      const site = (data as BarleyRow[])[0].site;
      const pointName = `slope-pts-${site}${highlight ? "-hl" : ""}`;
      // Lines inherit their color from the point rects. Highlight colors each
      // panel's points by its site with the Morris-green palette from the ribbon
      // (Morris green, every other site gray); default colors by variety.
      const pointFill = highlight
        ? site === "Morris"
          ? "#e08214"
          : "#d7dadd"
        : "variety";
      return markLayer([
        Chart(data, vizChartOptions)
          .flow(group("variety"), scatter({ x: "year", y: "yield" }))
          .mark(rect({ w: 0, h: 0, fill: pointFill }).name(pointName)),
        Chart(select(pointName), vizChartOptions)
          .flow(group("variety"))
          .mark(line({ strokeWidth: 2 })),
      ]);
    })
    .render(el, { w, h, axes: true, legend: false });
}

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

function pairYears(rows: BarleyRow[]) {
  return Object.values(_.groupBy(rows, (d) => `${d.site}|${d.variety}`)).map(
    (pair) => {
      const delta =
        pair.find((r) => r.year === 1932)!.yield -
        pair.find((r) => r.year === 1931)!.yield;
      return {
        site: pair[0].site,
        variety: pair[0].variety,
        delta,
        deltaColor: barleyDeltaScale(delta).hex(),
      };
    }
  );
}

function renderVizBarleyDeltaHeatmap(id = "chart-viz-barley-delta", w = 960, h = 300) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley)
    .flow(derive(pairYears), table("variety", "site", { spacing: 4 }))
    .mark(rect({ fill: "deltaColor" }))
    .render(el, { w, h, axes: true, legend: false });
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

// ── Waffle chart (unit squares; ported from forwardsyntax/WaffleChart) ────
// Each catch row becomes `count` unit squares via repeat(); chunks of five
// squares form the rows of each lake's column. Bottom-aligned lake columns
// (alignment: "end" in y-down space) fill upward from a shared baseline, and
// the reversed row spread parks the ragged partial row at the top.
function renderWaffleChart(id = "chart-q-waffle", w = 340, h = 260) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(seafood, { axes: { x: { side: "end" } } })
    .flow(
      spread("lake", { spacing: 8, dir: "x", axes: false, alignment: "end" }),
      derive((d: any[]) => d.flatMap((row) => repeat(row, "count"))),
      derive((d: any[]) => _.chunk(d, 5)),
      spread({ spacing: 2, dir: "y", reverse: true }),
      spread({ spacing: 2, dir: "x" })
    )
    .mark(rect({ w: 8, h: 8, fill: "species" }))
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
  // Each level normalizes the same raw field; `field(...)` is immutable, so one
  // expression can fill all three `size` slots.
  const share = field("count").normalize();
  Chart(titanic, {
    axes: false,
    color: palette({ Yes: "#2b8cbe", No: "#c9c2b5" }),
  })
    .flow(
      stack("class", { dir: "y", size: share }),
      stack("sex", { dir: "x", size: share }),
      stack("survived", { dir: "y", size: share })
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
  const share = field("count").normalize();
  Chart(titanic, {
    axes: false,
    color: palette({ Yes: "#2b8cbe", No: "#c9c2b5" }),
  })
    .flow(
      stack("class", { dir: "y", size: share }),
      stack("survived", { dir: "x", size: share })
    )
    .mark(rect({ fill: "survived", stroke: "white", strokeWidth: 1 }))
    .render(el, { w, h, axes: false });
}

// Slide B pair: the bottle's base form. An ordinary normalized bar — filled
// vs. empty, sharing the bottle's own green fill — instead of the
// pictorial's paint-composited bottle image.
// One filled/empty bar per bottle category, mirroring bottleData's fill levels.
const bottleBarData = bottleData.flatMap(({ category, amount }) => [
  { category, part: "filled", amount },
  { category, part: "empty", amount: 100 - amount },
]);

function renderBottleBarBase(id = "chart-q-bottle-base", w = 220, h = 210) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(bottleBarData, {
    axes: { x: true, y: true },
    legend: false,
    color: palette({ filled: "#5aa66c", empty: "#e0ded4" }),
  })
    .flow(
      spread("category", { dir: "x", spacing: 12 }),
      stack("part", { dir: "y", size: field("amount").normalize() })
    )
    .mark(rect({ w: 36, fill: "part" }))
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

// One renderer for all three charts on the move-4 slide, mirroring
// renderVizStackChart's stack -> sort -> connect idiom: `sort` orders each
// year's stack by amount (rank-as-position), `connect` adds the area/ribbon
// layer tracking each source across years (identity-as-continuity). The
// slide composes the two moves: base = sort only (sorted stacks — rank
// reads as position, no connection); mid = connect only (stacked area,
// fixed order — the bands carry identity but never cross); ribbon = both
// (sorted + connected — now a crossing is a rank inversion, an overtake).
function renderEnergyStackChart(
  id: string,
  {
    sort = false,
    connect = false,
    w = 340,
    h = 260,
    barW = 36,
  }: {
    sort?: boolean;
    connect?: boolean;
    w?: number;
    h?: number;
    barW?: number;
  } = {}
) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const chartOptions = { axes: { x: true, y: true }, color: energyPalette };
  const barsFlow: any[] = [
    spread("year", { dir: "x", spacing: 30 }),
    stack(sort ? field("source").sort("amount") : "source", {
      dir: "y",
      size: "amount",
    }),
  ];
  const layers: any[] = [
    Chart(energyMix, chartOptions)
      .flow(...barsFlow)
      .mark(rect({ w: barW, fill: "source" }).name("bars")),
  ];
  if (connect) {
    layers.push(
      Chart(select("bars"))
        .flow(group("source"))
        .mark(ribbon({ opacity: 0.5 }))
    );
  }
  Layer(layers).render(el, { w, h, axes: { x: true, y: true } });
}

// Left-column ingredient charts render smaller (they stack vertically);
// the ribbon is the payoff and renders at the full pair size.
function renderEnergyRibbonBase(id = "chart-move-ribbon-base") {
  renderEnergyStackChart(id, { sort: true, w: 280, h: 180, barW: 26 });
}
function renderEnergyRibbonMid(id = "chart-move-ribbon-mid") {
  renderEnergyStackChart(id, { connect: true, w: 280, h: 180, barW: 26 });
}
function renderEnergyRibbon(id = "chart-move-ribbon") {
  renderEnergyStackChart(id, { sort: true, connect: true, w: 400, h: 320 });
}

// ── Bars vs. line (Zacks & Tversky) ─────────────────────────────────────────
// Same two-datum dataset (average adult height by sex, cm) shown as a plain
// bar chart and as a two-point line chart, for the connection-vs-comparison
// framing.
const connHeights = [
  { sex: "female", height: 162 },
  { sex: "male", height: 175 },
];

function renderConnBars(id = "chart-conn-bars", w = 380, h = 280) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(connHeights)
    .flow(spread("sex", { dir: "x", spacing: 32 }))
    .mark(rect({ h: "height", fill: FRANCONERI_BAR_COLOR }))
    .render(el, { w, h, axes: true });
}

function renderConnLine(id = "chart-conn-line", w = 380, h = 280) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  // Same two data points as chart-conn-bars, scattered by an index (scatter
  // needs a numeric x for the categorical position) and joined by `.connect`
  // — the LineChart.stories.tsx idiom (`.mark(blank()).connect(line())`).
  // Axes off: the numeric index axis would read "xIndex 0..1"; the slide
  // overlays female/male labels under the endpoints instead.
  const indexed = connHeights.map((d, i) => ({ ...d, xIndex: i }));
  Chart(indexed, { axes: false })
    .flow(scatter("xIndex", { x: "xIndex", y: "height" }))
    .mark(scaffold())
    .connect(line({ strokeWidth: 2.5, stroke: FRANCONERI_BAR_COLOR }))
    .render(el, { w, h: h - 40, axes: false });
}

// ── Public API ────────────────────────────────────────────────────────────
export function renderCharts() {
  renderFranconeriA();
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
  renderVizStacked();
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
  renderVizBarleySlopePanels("chart-viz-barley-slope-annotated", true);
  renderVizBarleyDeltaHeatmap();
  renderVizBarleySlopePanels("chart-viz-barley-slope-cmp", false, 820, 180);
  renderVizBarleyDeltaHeatmap("chart-viz-barley-delta-cmp", 820, 230);
  renderFlowerChart();
  renderBalloonChart();
  renderSankeyTree();
  renderTitanicMosaic();
  renderNightingaleRose();
  renderBottleChart();
  renderConnBars();
  renderConnLine();
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
  "chart-viz-stacked": () => renderVizStacked(),
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
    renderVizBarleySlopePanels("chart-viz-barley-slope-annotated", true),
  "chart-viz-barley-delta": renderVizBarleyDeltaHeatmap,
  "chart-viz-barley-slope-cmp": () =>
    renderVizBarleySlopePanels("chart-viz-barley-slope-cmp", false, 820, 180),
  "chart-viz-barley-delta-cmp": () =>
    renderVizBarleyDeltaHeatmap("chart-viz-barley-delta-cmp", 820, 230),
  "chart-franconeri-a": renderFranconeriA,
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
  "chart-conn-bars": () => renderConnBars(),
  "chart-conn-line": () => renderConnLine(),
};
