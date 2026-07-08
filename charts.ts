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
  blank as scaffold,
  line,
  selectAll as select,
  clock,
  polar,
  linear,
  Constraint,
  area,
  group as gofishGroup,
  layer as markLayer,
  Frame,
  stackX,
  ellipse,
  petal,
  wavy,
  palette,
  gradient,
} from "gofish-graphics";
import _ from "lodash";
import chroma from "chroma-js";
import {
  seafood,
  catchLocations,
} from "@gofish-data/catch";
import barleyRaw from "./data/barley.json";

const CHART_W = 480;
const CHART_H = 320;

const Chart = (data?: unknown, options: Record<string, unknown> = {}) =>
  data === undefined
    ? gofishChart()
    : gofishChart(data, { axes: true, ...options });

const spread = (byOrOptions: string | Record<string, unknown>, options = {}) =>
  typeof byOrOptions === "string"
    ? gofishSpread({ by: byOrOptions, ...options })
    : gofishSpread(byOrOptions);

const stack = (byOrOptions: string | Record<string, unknown>, options = {}) =>
  typeof byOrOptions === "string"
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
  Chart(barley, vizChartOptions)
    .flow(spread("site", { dir: "x" }))
    .mark(rect({ h: 1, fill: "#dff1e5" }))
    .render(el, VIZ_RENDER_OPTIONS);
}

function renderVizSiteYield(id = "chart-viz-site-yield") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(spread("site", { dir: "x" }))
    .mark(rect({ h: "yield", fill: "#68a9d8" }))
    .render(el, VIZ_RENDER_OPTIONS);
}

function renderVizSiteVariety(id = "chart-viz-site-variety") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("site", { dir: "x", spacing: 24 }),
      spread("variety", { dir: "x", spacing: 4 })
    )
    .mark(rect({ h: "yield", fill: "variety" }))
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

function renderVizStacked(id = "chart-viz-stacked") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(spread("variety", { dir: "x" }), stack("site", { dir: "y" }))
    .mark(rect({ h: "yield", fill: "site" }))
    .render(el, VIZ_RENDER_OPTIONS);
}

function renderVizYearSorted() {
  const el = getContainer("chart-viz-year-sorted");
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(
      spread("variety", { dir: "x", spacing: 24 }),
      spread("year", { dir: "x", spacing: 4 }),
      derive((d) => _.orderBy(d, "yield", "asc")),
      stack("site", { dir: "y" })
    )
    .mark(rect({ h: "yield", fill: "site" }))
    .render(el, VIZ_RENDER_OPTIONS);
}

function renderVizRibbon(id = "chart-viz-ribbon", highlight = false) {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  const chartOptions = highlight
    ? {
        color: palette({
          Waseca: "#d7dadd",
          Morris: "#49a66a",
          "Grand Rapids": "#d7dadd",
          Crookston: "#d7dadd",
          Duluth: "#d7dadd",
        }),
        legend: false,
      }
    : vizChartOptions;
  Layer([
    Chart(barley, chartOptions)
      .flow(
        spread("variety", { dir: "x", spacing: 38 }),
        spread("year", { dir: "x", spacing: 8 }),
        derive((d) => _.orderBy(d, "yield", "asc")),
        stack("site", { dir: "y" })
      )
      .mark(rect({ w: 16, h: "yield", fill: "site" }).name("bars")),
    Chart(select("bars"))
      .flow(group("variety"), group("site"))
      .mark(area({ opacity: highlight ? 0.78 : 0.5 })),
  ]).render(el, VIZ_RENDER_OPTIONS);
}

// ── Closing beat: the Morris sentence, compiled ────────────────────────────
// Two structures for the same takeaway ("every variety fell at every site
// except Morris, where every variety rose"): Trellis-style slope panels
// (magnitude-precise, reader aggregates sign per panel) and a Δ heatmap
// (sign-precise via one preattentive scan, magnitude imprecise).

const SLOPE_W = 940;
const SLOPE_H = 220;

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
function renderVizBarleySlopePanels(id = "chart-viz-barley-slope") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley, vizChartOptions)
    .flow(spread("site", { dir: "x", spacing: 20 }))
    .mark((data) => {
      const pointName = `slope-pts-${(data as BarleyRow[])[0].site}`;
      return markLayer([
        Chart(data, vizChartOptions)
          .flow(group("variety"), scatter({ x: "year", y: "yield" }))
          .mark(rect({ w: 0, h: 0, fill: "variety" }).name(pointName)),
        Chart(select(pointName), vizChartOptions)
          .flow(group("variety"))
          .mark(line({ strokeWidth: 2 })),
      ]);
    })
    .render(el, { w: SLOPE_W, h: SLOPE_H, axes: true, legend: false });
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
  .scale(["#c0503f", "#f7f2e8", "#49a66a"])
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

function renderVizBarleyDeltaHeatmap(id = "chart-viz-barley-delta") {
  const el = getContainer(id);
  if (!el || el.children.length > 0) return;
  Chart(barley)
    .flow(derive(pairYears), table("variety", "site", { spacing: 4 }))
    .mark(rect({ fill: "deltaColor" }))
    .render(el, { w: 960, h: 300, axes: true, legend: false });
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

function renderScatterPieChart() {
  const el = getContainer("chart-scatter-pie");
  if (!el || el.children.length > 0) return;
  Chart(scatterByLake)
    .flow(scatter("lake", { x: "x", y: "y" }))
    .mark((data) =>
      Chart(data[0].collection, { coord: clock(), axes: false })
        .flow(stack("species", { dir: "x", h: 20 }))
        .mark(rect({ w: "count", fill: "species" }))
    )
    .render(el, { w: CHART_W, h: CHART_H, axes: true });
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
        .flow(stack("variety", { dir: "x", h: barleyPieRadius(totalYield) }))
        .mark(rect({ w: "yield", fill: "variety" }));
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

// ── Public API ────────────────────────────────────────────────────────────
export function renderCharts() {
  renderFranconeriA();
  renderFranconeriAColor();
  renderFranconeriAColorKey();
  renderFranconeriB();
  renderFranconeriC();
  renderFranconeriAKey();
  renderFranconeriBKey();
  renderVizSiteSlots();
  renderVizSiteYield();
  renderVizSiteYield("chart-viz-site-yield-transform");
  renderVizSiteVariety();
  renderVizSiteVarietyMini();
  renderVizVarietySiteMini();
  renderVizStacked();
  renderVizYearSorted();
  renderVizRibbon();
  renderVizRibbon("chart-viz-ribbon-highlight", true);
  renderScatterPieChart();
  renderBarleyScatterPie(1931, "chart-viz-barley-pie-1931");
  renderBarleyScatterPie(1932, "chart-viz-barley-pie-1932");
  renderVizBarleySlopePanels();
  renderVizBarleyDeltaHeatmap();
  renderFlowerChart();
  renderBalloonChart();
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
  "chart-viz-site-variety": () => renderVizSiteVariety(),
  "chart-viz-site-variety-mini": renderVizSiteVarietyMini,
  "chart-viz-variety-site-mini": renderVizVarietySiteMini,
  "chart-viz-stacked": () => renderVizStacked(),
  "chart-viz-year-sorted": renderVizYearSorted,
  "chart-viz-ribbon": () => renderVizRibbon(),
  "chart-viz-ribbon-highlight": () =>
    renderVizRibbon("chart-viz-ribbon-highlight", true),
  "chart-viz-barley-pie-1931": () =>
    renderBarleyScatterPie(1931, "chart-viz-barley-pie-1931"),
  "chart-viz-barley-pie-1932": () =>
    renderBarleyScatterPie(1932, "chart-viz-barley-pie-1932"),
  "chart-viz-barley-slope": renderVizBarleySlopePanels,
  "chart-viz-barley-delta": renderVizBarleyDeltaHeatmap,
  "chart-franconeri-a": renderFranconeriA,
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
      .flow(spread("lake", { dir: "x" }), stack("species", { dir: "y" }))
      .mark(rect({ h: "count", fill: "species" }))
      .render(el, { w: 280, h: 220, axes: true });
  },
  "chart-kv-stacked": () => {
    const el = getContainer("chart-kv-stacked");
    if (!el || el.children.length > 0) return;
    Chart(seafood)
      .flow(spread("lake", { dir: "x" }), stack("species", { dir: "y" }))
      .mark(rect({ h: "count", fill: "species" }))
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
  "chart-kv-heatmap": () => {
    const el = getContainer("chart-kv-heatmap");
    if (!el || el.children.length > 0) return;
    Chart(seafood, { color: gradient(["#e8f4f8", "#1a5276"]) })
      .flow(table("lake", "species", { spacing: 4 }))
      .mark(rect({ fill: "count" }))
      .render(el, { w: 280, h: 220, axes: true, legend: false });
  },
  "chart-scatter-pie": renderScatterPieChart,
  "chart-flower": renderFlowerChart,
  "chart-balloon": renderBalloonChart,
};
