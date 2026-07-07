# Seeing Graphics Clearly - SciPy draft

Full Reveal/Vite deck adapted from the `pydata-meetup-2026` branch of `/Users/jmp/gofish-20250316`.

This version keeps the PyData slide sequence, speaker notes, live GoFish-rendered chart examples, and code/spec slides, then adds the SciPy framing:

- lake/data setup
- direct perception before chart-type judgment
- rules are brittle
- stylistic anarchism
- grammar vs elements of style

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
