# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A self-hosted VitePress static site that republishes the open Markdown docs from the
upstream Pi project (`github.com/earendil-works/pi`, path `packages/coding-agent/docs/`).
It is **not** a clone of the official `pi.dev` website — only the open docs are rebuilt.
There is no application server, database, test suite, or linter; the output is static
HTML/CSS/JS in `dist/`.

Requires Node.js >= 20 (CI runs on 22). Only dev dependency is `vitepress`.

## Commands

```bash
npm install
npm run sync -- /path/to/pi        # copy upstream docs into docs/ (path = Pi repo ROOT)
npm run generate-sidebar            # rebuild .vitepress/sidebar.generated.json from docs/docs.json
npm run build                       # vitepress build (prebuild auto-runs generate-sidebar)
npm run dev                         # dev server bound to 127.0.0.1 (also auto-runs generate-sidebar)
./site-server.sh start|stop|restart|status   # serve built dist/ via python http.server (default :8766)
npm audit --omit=dev                # should report no production vulnerabilities
```

`prebuild` runs `generate-sidebar` automatically, so manual sidebar regeneration is only
needed when debugging that step. `site-server.sh` requires `dist/index.html` to exist
(run `npm run build` first); it finds a free port in the 8766–8865 range and writes a
PID file.

## Architecture: The Content Pipeline

The build is a three-stage transform from upstream Pi docs to static site. Understanding
this pipeline (spread across `scripts/` and `.vitepress/config.ts`) is the key to working
here:

1. **Sync** (`scripts/sync-pi-docs.mjs`) — `npm run sync -- <pi-repo-root>`. **Wipes
   `docs/` entirely** (`rmSync` recursive) then copies `packages/coding-agent/docs/`
   from the given Pi checkout. Fails hard if `docs.json` is missing at the source. The
   argument is the Pi *repository root*, not the docs directory. After copying, the
   script also adapts upstream image refs for VitePress: it moves `docs/images/` to
   `docs/public/images/` and rewrites HTML `<img src="images/...">` in the Markdown to
   `src="/images/..."`. Upstream's sibling-relative HTML `<img>` refs break Rollup at
   build time; under the `public/` + absolute-path model VitePress auto-prepends `base`,
   so images resolve correctly under both `/` (custom domain) and `/repo/` (project
   Pages) deploy paths.

2. **Sidebar generation** (`scripts/generate-sidebar.mjs`) — reads `docs/docs.json`
   (upstream navigation format: `{ navigation: [{ title, items: [{ title, path }] }] }`)
   and emits `.vitepress/sidebar.generated.json` in VitePress sidebar format. Path
   mapping: `index.md` → `/`, any other `x.md` → `/x` (extension stripped).

3. **Build** (`.vitepress/config.ts` + vitepress) — `config.ts` loads the committed
   `sidebar.generated.json`, sets `srcDir: "docs"`, `outDir: "dist"`, `cleanUrls: true`,
   `ignoreDeadLinks: true`, and computes `base` dynamically (see below).

### Base URL auto-detection (`.vitepress/config.ts`)

`getBase()` precedence: `SITE_BASE` env var → else derive from `GITHUB_REPOSITORY`:
`owner/owner.github.io` → `/`, any other `owner/repo` → `/repo/`. This is why the
GitHub Actions workflow (`.github/workflows/pages.yml`) forwards `SITE_BASE` from
repository variables — set `SITE_BASE=/` for custom domains or `SITE_BASE=/your-base/`
when the deploy path differs from the default.

## Conventions & Editing Rules

- **`docs/` is upstream-derived.** It is currently a placeholder (`index.md` +
  `docs.json` with one nav entry); real content arrives via `npm run sync`. Hand-edits
  to `docs/` content will be overwritten on the next sync, but synced `docs/` *may* be
  committed to keep the repo self-contained.
- **Commit `.vitepress/sidebar.generated.json`** so local and CI builds are
  deterministic — CI does not sync from upstream, it builds from the committed tree.
- **Keep this repo independent** from the Pi source tree; never add a path dependency
  on a Pi checkout for `npm run build` to succeed.
- Do not commit `node_modules/` or `dist/` (see `.gitignore`).
- The `dev` server must stay bound to localhost — do not expose it publicly.

## Common Failure Modes

- Broken CSS/asset links on GitHub Pages → fix `SITE_BASE`.
- Empty/wrong sidebar → run `npm run generate-sidebar`, inspect
  `.vitepress/sidebar.generated.json`.
- Sync fails → confirm the Pi checkout contains
  `packages/coding-agent/docs/docs.json`.
- GitHub Pages skipped → confirm `Settings → Pages → Source = GitHub Actions`.
- Vite/esbuild advisory in full `npm audit` → dev-server only; ignore unless it appears
  in `npm audit --omit=dev`.
