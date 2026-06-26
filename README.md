# Seeing Graphics Clearly - SciPy 2026

Standalone Reveal/Vite deck for the SciPy version of the GoFish talk. It uses
`gofish-graphics@nightly` from npm and includes the small copied demo dataset it
needs under `data/`.

## Prerequisites

- Node.js 20 or newer
- pnpm 10
- GitHub access to this private repository

If pnpm is not already available:

```bash
corepack enable
```

## Running the presentation locally

```bash
git clone git@github.com:gofish-graphics/scipy-2026-talk.git
cd scipy-2026-talk
pnpm install
pnpm dev
```

Opens at **http://localhost:4001**. Navigate with arrow keys; press `S` for
speaker notes.

During install, pnpm may print a warning about ignored build scripts for
`esbuild`. The deck still installs and builds normally.

## Building and previewing

```bash
pnpm build
pnpm preview
```

`pnpm build` writes the static site to `dist/`. `pnpm preview` serves that built
output locally, usually at **http://localhost:4173**.

## Editing

- Slide content: `index.html`
- Live chart specs/renderers: `charts.ts`
- Visual skin and layout: `style.css`
- Demo data: `data/catch.ts`
- Original PyData planning notes: `20260316-talk-outline.md`,
  `20260317-talk-outline.md`, `20260317-schema.md`
