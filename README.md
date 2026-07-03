# Pi Documentation GitHub Pages Template

This repository is a self-hosted documentation template for the Pi project.

**Live site:** <https://wangxiancao.github.io/pi_doc_zh/>

It does not try to reproduce the official `pi.dev` website. The official site
uses a separate website implementation that is not included in
`earendil-works/pi`. This template only builds the open Markdown documentation
from:

```text
packages/coding-agent/docs/
```

The output is a static VitePress site that can be deployed to GitHub Pages.

## What This Template Contains

- VitePress site configuration in `.vitepress/config.ts`
- GitHub Pages workflow in `.github/workflows/pages.yml`
- Pi docs sync script in `scripts/sync-pi-docs.mjs`
- Sidebar generation script in `scripts/generate-sidebar.mjs`
- Local static server helper in `site-server.sh`
- Agent execution instructions in `AGENTS.md`

## Requirements

- Node.js 20 or newer
- npm
- A local checkout of `https://github.com/earendil-works/pi`
- A GitHub repository where this folder is pushed

## Quick Start

From this directory:

```bash
npm install
npm run sync -- /path/to/pi
npm run build
```

Example if the Pi repository is cloned next to this folder:

```bash
npm run sync -- ../pi
npm run build
```

The generated site is written to:

```text
dist/
```

Preview locally:

```bash
./site-server.sh start
./site-server.sh status
./site-server.sh stop
```

During development, use:

```bash
npm run dev
```

The development server binds to `127.0.0.1` by default. Do not expose it to the
public internet. For reviewing the built static site, prefer `npm run build`
followed by `./site-server.sh start`.

## GitHub Pages Deployment

1. Push this `pi_doc` folder as its own GitHub repository.
2. In GitHub, open the repository settings.
3. Go to `Settings -> Pages`.
4. Under `Build and deployment`, set `Source` to `GitHub Actions`.
5. Push to the default branch, usually `main`.
6. Wait for the `Deploy Pi docs` workflow to finish.

The workflow builds `dist/` and deploys it using GitHub's official Pages
artifact flow.

## Base URL Rules

VitePress must know the base URL where the site is served.

The default behavior is:

- For a project Pages repository such as `USERNAME/pi_doc`, base is `/pi_doc/`.
- For a user or organization Pages repository such as `USERNAME.github.io`, base
  is `/`.

If this is wrong, set a GitHub Actions repository variable:

```text
SITE_BASE=/your-base/
```

For a custom domain, use:

```text
SITE_BASE=/
```

## Updating From Upstream Pi

When Pi documentation changes:

```bash
git clone https://github.com/earendil-works/pi.git
cd pi_doc
npm run sync -- ../pi
npm run build
```

Then commit the changed files under `docs/` and push.

## Important Boundary

This template publishes documentation content. It does not include:

- The official `pi.dev` homepage
- The official `pi.dev` visual design
- News, packages, models pages from `pi.dev`
- The official site's search implementation

Those pieces are outside the public Pi repository.

## Troubleshooting

If the site builds but links are broken on GitHub Pages, check `SITE_BASE`.

If the site returns 404 right after enabling Pages, GitHub may have added a starter
workflow `static.yml` ("Deploy static content to Pages") that deploys the repo root
with no build step — and `dist/` is gitignored, so the root has no `index.html`.
Delete `.github/workflows/static.yml`, keep only `pages.yml`, then push to `main`.

If the sidebar is missing, run:

```bash
npm run generate-sidebar
```

If syncing fails, confirm that the path you pass contains:

```text
packages/coding-agent/docs/docs.json
```

If GitHub Pages does not deploy, confirm:

- Repository `Settings -> Pages -> Source` is set to `GitHub Actions`
- Actions are enabled for the repository
- The workflow has `pages: write` and `id-token: write` permissions

## Dependency Audit Note

`npm audit --omit=dev` should report no production vulnerabilities. VitePress is
a build-time dependency, so its packages are not served as Node dependencies on
GitHub Pages. If full `npm audit` reports a Vite/esbuild development-server
advisory, do not expose `npm run dev` beyond localhost. The published site is
static HTML, CSS, and JavaScript under `dist/`.
