#!/usr/bin/env node
// generate-sidebar.mjs — content/*/docs.json -> .vitepress/sidebars.generated.json
// 输出: { <localeKey>: [ { text, collapsed, items: [{text, link}] } ] }
// 缺少某 locale 的 docs.json 时 fallback 英文 navigation（标题英文，链接仍用该 locale 前缀）。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const localesPath = resolve(projectRoot, "locales.json");
const contentDir = resolve(projectRoot, "content");
const outputPath = resolve(projectRoot, ".vitepress/sidebars.generated.json");

if (!existsSync(localesPath)) {
  console.error(`[generate-sidebar] 缺少 ${localesPath}`);
  process.exit(1);
}

const { locales } = JSON.parse(readFileSync(localesPath, "utf8"));

const enDocsJsonPath = resolve(contentDir, "en/docs.json");
const enNavigation = existsSync(enDocsJsonPath)
  ? JSON.parse(readFileSync(enDocsJsonPath, "utf8")).navigation
  : null;

function linkFor(prefix, itemPath) {
  if (itemPath === "index.md") {
    return prefix === "/" ? "/" : prefix;
  }
  const base = itemPath.replace(/\.md$/, "");
  return `${prefix}${base}`;
}

const sidebars = {};
for (const locale of locales) {
  const docsJsonPath = resolve(contentDir, locale.dir, "docs.json");
  let navigation;
  if (existsSync(docsJsonPath)) {
    navigation = JSON.parse(readFileSync(docsJsonPath, "utf8")).navigation;
  } else if (enNavigation) {
    console.warn(
      `[generate-sidebar] locale "${locale.key}" 缺 docs.json，用英文标题 fallback`
    );
    navigation = enNavigation;
  } else {
    console.warn(`[generate-sidebar] 跳过 locale "${locale.key}"（无 docs.json）`);
    continue;
  }

  if (!Array.isArray(navigation)) {
    console.error(`[generate-sidebar] ${docsJsonPath} 的 navigation 非数组`);
    process.exit(1);
  }

  sidebars[locale.key] = navigation.map((group) => ({
    text: group.title,
    collapsed: false,
    items: group.items.map((item) => ({
      text: item.title,
      link: linkFor(locale.prefix, item.path)
    }))
  }));
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(sidebars, null, 2)}\n`);
console.log(`[generate-sidebar] 生成 ${outputPath}`);
