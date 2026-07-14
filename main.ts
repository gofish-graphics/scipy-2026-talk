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

// Slides live in ./sections/*.html; assemble them before Reveal initializes.
const slidesEl = document.querySelector(".slides");
if (slidesEl) {
  slidesEl.innerHTML = [
    openingHtml,
    walkthroughHtml,
    glyphsHtml,
    closingHtml,
  ].join("\n");

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
