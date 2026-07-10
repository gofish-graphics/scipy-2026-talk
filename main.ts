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
