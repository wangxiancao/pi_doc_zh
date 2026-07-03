import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitepress";

type LocaleEntry = {
  key: string;
  dir: string;
  label: string;
  lang: string;
  prefix: string;
};

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

const projectRoot = resolve(__dirname, "..");
const localesConfig = JSON.parse(
  readFileSync(resolve(projectRoot, "locales.json"), "utf8")
).locales as LocaleEntry[];

const sidebarsPath = resolve(__dirname, "sidebars.generated.json");
const sidebars: Record<string, unknown> = existsSync(sidebarsPath)
  ? JSON.parse(readFileSync(sidebarsPath, "utf8"))
  : {};

// locale 特有的 UI 文案（title/description/themeConfig 覆盖）。root 用默认英文。
const localeUI: Record<string, Record<string, unknown>> = {
  zh: {
    title: "Pi 文档",
    description: "自托管的 Pi 文档",
    themeConfig: {
      nav: [{ text: "文档", link: "/zh/" }],
      outline: { level: [2, 3], label: "本页内容" },
      docFooter: { prev: "上一页", next: "下一页" },
      lastUpdated: { text: "最后更新于" },
      returnToTopLabel: "回到顶部",
      sidebarMenuLabel: "目录",
      darkModeSwitchLabel: "主题",
      lightModeSwitchTitle: "切换到浅色模式",
      darkModeSwitchTitle: "切换到深色模式"
    }
  }
};

function buildLocales() {
  const result: Record<string, Record<string, unknown>> = {};
  for (const loc of localesConfig) {
    const sidebar = sidebars[loc.key] ?? [];
    const isRoot = loc.key === "root";
    const entry: Record<string, unknown> = {
      label: loc.label,
      lang: loc.lang,
      themeConfig: {
        nav: [{ text: isRoot ? "Docs" : "文档", link: loc.prefix }],
        sidebar
      }
    };
    if (!isRoot) {
      entry.link = loc.prefix;
    }
    const ui = localeUI[loc.key];
    if (ui) {
      if (ui.title) entry.title = ui.title;
      if (ui.description) entry.description = ui.description;
      if (ui.themeConfig) {
        entry.themeConfig = { ...ui.themeConfig, sidebar };
      }
    }
    result[loc.key] = entry;
  }
  return result;
}

export default defineConfig({
  title: "Pi Docs",
  description: "Self-hosted Pi documentation",
  base: getBase(),
  srcDir: "docs",
  outDir: "dist",
  cleanUrls: true,
  ignoreDeadLinks: true,
  locales: buildLocales(),
  themeConfig: {
    search: {
      provider: "local",
      options: {
        locales: {
          zh: {
            translations: {
              button: { buttonText: "搜索", buttonAriaLabel: "搜索" },
              modal: {
                displayDetails: "显示详细列表",
                resetButtonTitle: "重置搜索",
                noResultsText: "没有结果",
                footer: {
                  selectText: "选择",
                  navigateText: "导航",
                  closeText: "关闭"
                }
              }
            }
          }
        }
      }
    },
    outline: { level: [2, 3] },
    socialLinks: [
      { icon: "github", link: "https://github.com/earendil-works/pi" }
    ]
  }
});
