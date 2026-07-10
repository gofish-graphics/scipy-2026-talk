# Seeing Graphics Clearly - SciPy draft

Full Reveal/Vite deck adapted from the `pydata-meetup-2026` branch of `/Users/jmp/gofish-20250316`.

This version keeps the PyData slide sequence, speaker notes, live GoFish-rendered chart examples, and code/spec slides, then adds the SciPy framing:

- lake/data setup
- direct perception before chart-type judgment
- rules are brittle
- stylistic anarchism
- grammar vs elements of style

## High-priority TODO: make perceptual query plans explicit

The talk's chart sequence should more clearly carry the framing developed in
[`../notes/predicate-to-spec.md`](../notes/predicate-to-spec.md):

```text
question about the data
    ↓
logical perceptual plan
    ↓
visual execution plan
    ↓
GoFish spec
```

This feels central to the talk, not like optional future-work material. GoFish's
structure explains *why* one chart is clearer for a question than another: the
operator tree determines which scans, comparisons, sums, lookups, and identity
traversals the viewer can execute cheaply.

- [ ] Introduce the database-query-planning analogy: **the viewer is the
      executor**, and a GoFish spec is a visual execution plan.
- [ ] Use the grouped-bar nesting swap as the clearest complete example:
      `EACH site → EACH variety → COMPARE yield` versus
      `EACH variety → EACH site → COMPARE yield`. Show the corresponding
      `spread` swap and say explicitly that the inner field becomes adjacent.
- [ ] Annotate the main chart transformations with the question and perceptual
      plan they answer, rather than showing only the spec transformation:
      grouped → within-group comparison; stacked → sum; normalized → share;
      heatmap → lookup/uniformity/exception; sorted ribbon → identity and rank
      change.
- [ ] Make the barley scatter-pie misfire a plan mismatch: the question asks
      for magnitude/total comparison, while the chart executes a composition
      query whose variation is nearly absent in this dataset.
- [ ] Contrast the ribbon's `TEST Δrank` plan with the Morris claim's
      `TEST sign(Δyield)` plan. The ribbon is not bad; it answers an adjacent
      question. Use this to motivate the Δ-heatmap.
- [ ] Consider one compact recurring three-column device on slides:
      **Question | Perceptual query | GoFish plan**. Reuse it rather than
      introducing the full predicate formalism.
- [ ] Land the concise claim near the takeaway:
      **The data determines whether a claim is true. The chart determines how
      the reader can check.**
- [ ] Keep the SciPy version chart-focused. Do not burden it with the model,
      startup, "verified chart," Python Tutor, or pulley generalizations except
      perhaps as one sentence of future work.

## Revision plan (notes from 2026-07-10)

This turns the morning notes into an ordered plan. It refines the TODO section
above rather than replacing it. The core framing for the talk:

> Graphics are visual data structures that we query with our eyes.

That framing needs two languages, and the talk should name both:

1. A language for visual data structures. This is GoFish, available today in
   alpha.
2. A language for the queries. This is speculative research, and the talk
   should ask the audience for feedback on it.

### Segment 1: framing (done 2026-07-10)

- [x] Open the framing with the line above: graphics are visual data
      structures that we query with our eyes. (Statement slide after the
      "Key idea" slide.)
- [x] Introduce the two languages and their different maturity levels. Be
      explicit that GoFish exists and the query language is a proposal.
      (The query chips use a dashed border everywhere to signal "proposal".)
- [x] Use a screenshot of the GoFish home page to show the range of charts it
      can express and the general feel of the project.
      (motivational-images/gofish-homepage.png, captured 2026-07-10.)

### Segment 2: return to the bar charts (done 2026-07-10)

- [x] Return to the opening bar charts and describe their structure in GoFish.
      Show the specs. ("back to those bar charts" slide at the end of the
      opening section, with the two city/year specs and query chips.)
- [x] Show that the two grouped bar charts are nested spreads that differ only
      in order, then show how that changes the query each one supports.
      (Query chips added to the solo nesting slides and the three-column
      "nesting order matters" slide.)
- [x] Present the other structures we have besides nested spreads. The
      heatmap and the stack now carry query chips in the walkthrough. A
      dedicated scatter beat is still open if we want one.

### Segment 3: query-first chart building on the barley data

- [x] Flip the direction: start from a query we want to support. (The "is it
      one variety, or all of them?" slide now shows the Δ-yield query and the
      line "start from the query, then build the structure that answers it".)
- [ ] Use highlighting to walk through the intermediate changes.
- [ ] Land on the limitation directly: this chart only shows relative ranking.
      Decide whether the slope chart or the heatmap comes first in this
      sequence.
- ~~Try pie charts as the candidate for relative change and show why they
  fail here.~~ Dropped 2026-07-10: too much at this point in the talk.
- [ ] Pose the driving question: is one variety driving this, or all of them?
      The query is "for each variety, how do the site yields change relative
      to each other?". The slope chart wins because the reader can compare
      slopes.
- [ ] Add color to highlight the change, and consider adding a label.
- [ ] Time this segment. After reviewing the PyData run (~30 min for roughly
      this material), timing looks workable with practice; expect to trim
      rather than add.

### Segment 4: other queries, other datasets (done 2026-07-10)

- [x] Show a few more structures with the query each one supports. ("other
      data, other queries" 2×2 gallery at the top of the closing section:
      scatterpie, stacked waffle (new live renderer), nested mosaic, and the
      bottle pictorial, each with a question and a query chip; tiles 2 to 4
      are fragments so they can be introduced one at a time if the slide
      moves too fast.)

### Segment 5: closing teaser

- [ ] Close with a "just skimming the surface" list: discrete versus
      continuous areas, spread versus connection, infographics, and diagrams.
- [x] The pulley paragraph versus the pulley diagram. ("diagrams are visual
      data structures too" slide after the montage: the verbatim Larkin &
      Simon 1987 problem text next to the GoFish-rendered pulley diagram.)
- [ ] Other candidates, if there is time:
  - the bottle chart versus a plain bar chart of the same data, to show that
    the form can change while the structure stays intact
  - varying the tree structure to get alternative structures that show the
    same thing
  - converting a chart to a unit visualization

## Running

From this directory:

```bash
./node_modules/.bin/vite --host 127.0.0.1
```

The dev server is configured for `http://localhost:4001/`.

Dependencies are already installed in `node_modules/`. If you reinstall with
the bundled pnpm, it may print an `esbuild` build-script approval warning even
after placing the dependencies on disk; invoking Vite directly avoids rerunning
that wrapper check.

The deck uses a local vendored copy of the GoFish source from the PyData branch:

```text
presentation-scipy/vendor-gofish/src/lib.ts
```

This is intentional: the current `/Users/jmp/gofish-20250316` checkout may be on a newer branch whose exported API no longer matches the talk.


## Editing

- Slide content: `index.html`
- Live chart specs/renderers: `charts.ts`
- Thesis-style visual skin: bottom section of `style.css`
- Original PyData planning notes: `20260316-talk-outline.md`, `20260317-talk-outline.md`, `20260317-schema.md`

Press `S` in Reveal for speaker notes.
