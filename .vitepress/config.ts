import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitepress";

function getBase(): string {
  if (process.env.SITE_BASE) {
    return process.env.SITE_BASE;
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return "/";
  }

  const repoName = repository.split("/")[1] ?? "";
  if (repoName.endsWith(".github.io")) {
    return "/";
  }

  return `/${repoName}/`;
}

function loadSidebar() {
  const sidebarPath = resolve(__dirname, "sidebar.generated.json");
  if (!existsSync(sidebarPath)) {
    return [
      {
        text: "Start here",
        items: [{ text: "Overview", link: "/" }]
      }
    ];
  }

  return JSON.parse(readFileSync(sidebarPath, "utf8"));
}

export default defineConfig({
  title: "Pi Docs",
  description: "Self-hosted Pi documentation",
  base: getBase(),
  srcDir: "docs",
  outDir: "dist",
  cleanUrls: true,
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [{ text: "Docs", link: "/" }],
    sidebar: loadSidebar(),
    search: {
      provider: "local"
    },
    outline: {
      level: [2, 3]
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/earendil-works/pi" }
    ]
  }
});

