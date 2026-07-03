#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const docsJsonPath = resolve(projectRoot, "docs/docs.json");
const outputPath = resolve(projectRoot, ".vitepress/sidebar.generated.json");

function pathToLink(path) {
  if (path === "index.md") {
    return "/";
  }

  return `/${path.replace(/\.md$/, "")}`;
}

if (!existsSync(docsJsonPath)) {
  console.error(`Missing ${docsJsonPath}`);
  console.error("Run: npm run sync -- /path/to/pi");
  process.exit(1);
}

const docsConfig = JSON.parse(readFileSync(docsJsonPath, "utf8"));

if (!Array.isArray(docsConfig.navigation)) {
  console.error("docs/docs.json does not contain a navigation array.");
  process.exit(1);
}

const sidebar = docsConfig.navigation.map((group) => ({
  text: group.title,
  collapsed: false,
  items: group.items.map((item) => ({
    text: item.title,
    link: pathToLink(item.path)
  }))
}));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(sidebar, null, 2)}\n`);

console.log(`Generated ${outputPath}`);

