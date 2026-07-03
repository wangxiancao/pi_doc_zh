#!/usr/bin/env node
// prepare-docs.mjs — 从 content/* 生成 VitePress 构建树 docs/
// 边界：只负责把 content/<dir> 拷贝到 docs/<prefix 对应子目录>。不翻译、不生成 sidebar。
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const localesPath = resolve(projectRoot, "locales.json");
const contentDir = resolve(projectRoot, "content");
const docsDir = resolve(projectRoot, "docs");

if (!existsSync(localesPath)) {
  console.error(`[prepare-docs] 缺少 ${localesPath}`);
  process.exit(1);
}

const { locales } = JSON.parse(readFileSync(localesPath, "utf8"));

// docs/ 是纯派生构建树，每次整体重建，避免陈旧页面残留
rmSync(docsDir, { recursive: true, force: true });
mkdirSync(docsDir, { recursive: true });

for (const locale of locales) {
  const src = resolve(contentDir, locale.dir);
  if (!existsSync(src)) {
    console.warn(`[prepare-docs] 跳过 locale "${locale.key}": 内容目录不存在 ${src}`);
    continue;
  }

  // prefix "/"  -> docs/        (英文根)
  // prefix "/zh/" -> docs/zh/   (locale 子目录)
  const subDir =
    locale.prefix === "/" ? "" : locale.prefix.replace(/^\/|\/$/g, "");
  const dest = subDir ? resolve(docsDir, subDir) : docsDir;
  mkdirSync(dest, { recursive: true });

  // 逐条目拷贝，避免 cpSync(src, existingDir) 把 src 整体放进 dest/src 目录
  for (const entry of readdirSync(src)) {
    cpSync(resolve(src, entry), resolve(dest, entry), { recursive: true });
  }
  console.log(`[prepare-docs] ${locale.key}: ${src} -> ${dest}`);
}

console.log(`[prepare-docs] docs/ 构建树就绪`);
