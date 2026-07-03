# Agent Instructions

This project builds and deploys a self-hosted copy of the public Pi
documentation to GitHub Pages.

## Goal

Maintain a static VitePress documentation site generated from the upstream Pi
Markdown docs at:

```text
packages/coding-agent/docs/
```

Do not attempt to recreate the full official `pi.dev` website. That website
source is not present in `earendil-works/pi`.

## Standard Execution Flow

1. Install dependencies:

   ```bash
   npm install
   ```

2. Sync docs from a local Pi checkout:

   ```bash
   npm run sync -- /absolute/or/relative/path/to/pi
   ```

3. Generate the sidebar:

   ```bash
   npm run generate-sidebar
   ```

4. Build the static site:

   ```bash
   npm run build
   ```

5. Confirm output exists:

   ```bash
   test -f dist/index.html
   ```

6. Preview if needed:

   ```bash
   ./site-server.sh start
   ```

7. Check production dependency exposure:

   ```bash
   npm audit --omit=dev
   ```

## Deployment Flow

GitHub Pages deployment is handled by:

```text
.github/workflows/pages.yml
```

The repository owner must set:

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

The workflow deploys `dist/` using GitHub's official Pages artifact actions.

## Base URL Decision

The VitePress base URL is computed in `.vitepress/config.ts`.

Default behavior:

- `owner/repo` deploys at `/repo/`
- `owner/owner.github.io` deploys at `/`

If the deployment path is different, set a repository variable:

```text
SITE_BASE=/custom-base/
```

For custom domains, set:

```text
SITE_BASE=/
```

## Common Failure Modes

- Broken CSS or assets on GitHub Pages: fix `SITE_BASE`.
- Empty or poor sidebar: run `npm run generate-sidebar` and check
  `.vitepress/sidebar.generated.json`.
- Sync failure: verify the Pi checkout contains
  `packages/coding-agent/docs/docs.json`.
- GitHub Pages skipped: verify Pages source is `GitHub Actions`.
- Vite/esbuild audit advisory: treat it as a development-server issue unless it
  appears in `npm audit --omit=dev`; keep `npm run dev` bound to localhost.

## Editing Rules

- Keep this project independent from the Pi source tree.
- Do not commit `node_modules/` or `dist/`.
- Commit synced `docs/` content if the repository should be self-contained.
- Keep generated sidebar committed so CI and local builds are deterministic.
