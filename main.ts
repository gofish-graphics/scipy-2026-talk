import Reveal from "reveal.js";
import RevealHighlight from "reveal.js/plugin/highlight/highlight";
import RevealNotes from "reveal.js/plugin/notes/notes";
import "reveal.js/dist/reveal.css";
import "reveal.js/dist/theme/white.css";
import "./hljs-github-light.css";
import "./style.css";
import { renderCharts, chartRenderers } from "./charts";
import openingHtml from "./sections/01-opening.html?raw";
import walkthroughHtml from "./sections/02-walkthrough.html?raw";
import glyphsHtml from "./sections/03-glyphs.html?raw";
import closingHtml from "./sections/04-closing.html?raw";
import closingPolarRibbonUrl from "./gallery-images/polar-ribbon-chart.png";
import closingInsertionSortUrl from "./gallery-images/insertion-sort.png";
import closingSilhouetteTreeUrl from "./gallery-images/multilevel-silhouette-tree.png";
import closingLayeredBarsAreaUrl from "./gallery-images/layered-bars-and-area.png";
import closingTitanicCircleTreemapUrl from "./gallery-images/titanic-fare-circle-treemap.png";
import closingFlowerChartUrl from "./gallery-images/flower-chart.png";

// Slides live in ./sections/*.html; assemble them before Reveal initializes.
const slidesEl = document.querySelector(".slides");
if (slidesEl) {
  slidesEl.innerHTML = [
    openingHtml,
    walkthroughHtml,
    glyphsHtml,
    closingHtml,
  ].join("\n");

  const closingExampleUrls: Record<string, string> = {
    "polar-ribbon": closingPolarRibbonUrl,
    "insertion-sort": closingInsertionSortUrl,
    "silhouette-tree": closingSilhouetteTreeUrl,
    "layered-bars-area": closingLayeredBarsAreaUrl,
    "titanic-circle-treemap": closingTitanicCircleTreemapUrl,
    "flower-chart": closingFlowerChartUrl,
  };
  slidesEl.querySelectorAll<HTMLImageElement>("img[data-closing-example]").forEach((img) => {
    const key = img.dataset.closingExample;
    if (key && closingExampleUrls[key]) img.src = closingExampleUrls[key];
  });

  // Introduce the conventional grammar immediately after GoFish, then teach
  // its Gestalt basis before showing how far the same structure scales.
  const grammarOfGraphicsSlide = slidesEl.querySelector<HTMLElement>(
    '[data-slide-key="grammar-of-graphics"]'
  );
  const chartSpaceSlide = slidesEl.querySelector<HTMLElement>(
    '[data-slide-key="chart-space-map"]'
  );
  const gestaltSlides = [
    slidesEl.querySelector<HTMLElement>('[data-slide-key="gofish-gestalt"]'),
    slidesEl.querySelector<HTMLElement>(
      '[data-slide-key="gofish-gestalt-example"]'
    ),
  ];
  if (chartSpaceSlide && gestaltSlides.every((slide) => slide)) {
    chartSpaceSlide.before(...(gestaltSlides as HTMLElement[]));
    if (grammarOfGraphicsSlide) {
      gestaltSlides[0]!.before(grammarOfGraphicsSlide);
    }
  }

  // Give the points → annotations run one stable chart edge. Measure each
  // natural-width code column, then use the widest one for every slide in the
  // sequence (while retaining the 430px cap that protects the chart column).
  const alignVizStepChartEdges = () => {
    const steps = Array.from(
      slidesEl.querySelectorAll<HTMLElement>(".viz-step-side-by-side")
    );
    slidesEl.style.removeProperty("--viz-step-left-column-width");
    const widestCodeColumn = Math.min(
      430,
      Math.max(
        0,
        ...steps.map((step) => {
          const codeColumn = step.querySelector<HTMLElement>(
            ":scope > .viz-code, :scope > .annotation-code-row"
          );
          return codeColumn?.offsetWidth ?? 0;
        })
      )
    );
    if (widestCodeColumn > 0) {
      slidesEl.style.setProperty(
        "--viz-step-left-column-width",
        `${widestCodeColumn}px`
      );
    }
  };
  requestAnimationFrame(alignVizStepChartEdges);
  document.fonts?.ready.then(alignVizStepChartEdges);

  // The audience-facing deck no longer shows the experimental query grammar.
  // Remove its Reveal fragment classes as well as hiding it in CSS, otherwise
  // invisible query chips would still consume advance clicks.
  slidesEl
    .querySelectorAll(".viz-query.fragment, .viz-query .fragment")
    .forEach((el) => el.classList.remove("fragment"));
}

// Mini reference table pinned to the upper-right of the walkthrough slides
// that build up the GoFish spec incrementally, so the presenter doesn't have
// to hold the barley fields (variety, site, year, yield) in their head while
// reading the spec aloud. Same columns/rows as the full .data-table on the
// "start with the data" slide; injected once per marked section rather than
// pasted into the HTML source repeatedly.
const MINI_TABLE_HTML = `
  <div class="mini-data-table">
    <table>
      <thead>
        <tr>
          <th>variety</th>
          <th>site</th>
          <th>year</th>
          <th>yield</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Manchuria</td>
          <td>University Farm</td>
          <td>1931</td>
          <td>27.00</td>
        </tr>
        <tr>
          <td>Manchuria</td>
          <td>Waseca</td>
          <td>1931</td>
          <td>48.87</td>
        </tr>
        <tr>
          <td>Manchuria</td>
          <td>Morris</td>
          <td>1931</td>
          <td>27.43</td>
        </tr>
        <tr>
          <td>&hellip;</td>
          <td>&hellip;</td>
          <td>&hellip;</td>
          <td>&hellip;</td>
        </tr>
      </tbody>
    </table>
  </div>
`;
if (slidesEl) {
  slidesEl.querySelectorAll("section.mini-table-slide").forEach((section) => {
    section.insertAdjacentHTML("beforeend", MINI_TABLE_HTML);
  });
}

// GoFish adds padding for axes/labels, so the size passed to render() is not
// the size of the returned SVG. Size each chart container to its SVG's viewBox
// (0 0 W H, the actual rendered size) so slides lay out around the real chart.
function fitContainerToSvg(container: HTMLElement) {
  const svg = container.querySelector("svg");
  if (!(svg instanceof SVGSVGElement)) return;
  const vb = svg.viewBox?.baseVal;
  const w = vb && vb.width ? vb.width : parseFloat(svg.getAttribute("width") || "");
  const h = vb && vb.height ? vb.height : parseFloat(svg.getAttribute("height") || "");
  if (w && h) {
    // The points → annotations sequence places the full-width barley charts
    // beside their specs. GoFish currently emits these SVGs with fixed width
    // and height attributes but no viewBox, so CSS width alone crops the later
    // site panels instead of scaling the complete chart into the right column.
    if (container.closest(".viz-step-side-by-side") && !svg.hasAttribute("viewBox")) {
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }
    container.style.width = `${w}px`;
    container.style.height = `${h}px`;
    container.style.maxWidth = "none";
    container.style.maxHeight = "none";
  }
}

const chartFitObserver = new MutationObserver((records) => {
  for (const rec of records) {
    for (const node of rec.addedNodes) {
      if (!(node instanceof Element)) continue;
      const svg =
        node instanceof SVGSVGElement ? node : node.querySelector?.("svg");
      const container = svg?.closest("[id^='chart-']");
      if (container) fitContainerToSvg(container as HTMLElement);
    }
  }
});
chartFitObserver.observe(document.body, { childList: true, subtree: true });

const deck = new Reveal({
  hash: true,
  transition: "none",
  navigationMode: "linear",
  center: false,
  width: 1280,
  height: 720,
  margin: 0.06,
  slideNumber: true,
  plugins: [RevealHighlight, RevealNotes],
  highlight: {
    highlightOnLoad: true,
  },
});

deck.initialize().then(() => {
  (window as any).scipyDeck = deck;
  // Render all charts once reveal is ready
  renderCharts();
});

// Re-render charts on slide change in case containers weren't visible on init
deck.on("slidechanged", () => {
  // Find all chart containers in the current slide
  const currentSlide = deck.getCurrentSlide();
  if (!currentSlide) return;
  const containers = currentSlide.querySelectorAll("[id^='chart-']");
  containers.forEach((el) => {
    const id = el.id;
    // Only re-render if the container is empty (not yet rendered)
    if (el.children.length === 0 && chartRenderers[id]) {
      chartRenderers[id]();
    }
  });
});
