#!/usr/bin/env node
// sync-pi-docs.mjs — 上游 Pi docs -> content/en/（英文内容源）
// 边界：只负责 content/en。不生成 docs/、不翻译、不改 VitePress 配置。
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { resolve } from "node:path";

const piRootArg = process.argv[2];

if (!piRootArg) {
  console.error("Usage: npm run sync -- /path/to/pi");
  process.exit(1);
}

const projectRoot = resolve(import.meta.dirname, "..");
const piRoot = resolve(process.cwd(), piRootArg);
const sourceDocs = resolve(piRoot, "packages/coding-agent/docs");
const docsJson = resolve(sourceDocs, "docs.json");
const targetEn = resolve(projectRoot, "content/en");

if (!existsSync(docsJson)) {
  console.error(`Could not find Pi docs at: ${sourceDocs}`);
  console.error("Expected file: packages/coding-agent/docs/docs.json");
  process.exit(1);
}

// 清空重建 content/en/
rmSync(targetEn, { recursive: true, force: true });
mkdirSync(targetEn, { recursive: true });
cpSync(sourceDocs, targetEn, { recursive: true });

// 图片适配：上游 images/ 是与 md 同级的目录，HTML <img src="images/..."> 的相对引用
// 会让 Rollup 构建失败。把 images/ 移到 public/images/，并把 src 重写为绝对 /images/...，
// VitePress 会在构建时按 base 自动加前缀。
const imagesDir = resolve(targetEn, "images");
if (existsSync(imagesDir)) {
  const publicDir = resolve(targetEn, "public");
  mkdirSync(publicDir, { recursive: true });
  renameSync(imagesDir, resolve(publicDir, "images"));

  for (const file of readdirSync(targetEn)) {
    if (!file.endsWith(".md")) continue;
    const filePath = resolve(targetEn, file);
    const original = readFileSync(filePath, "utf8");
    const updated = original
      .replace(/src="(images\/)/g, 'src="/$1')
      .replace(/src='(images\/)/g, "src='/$1");
    if (updated !== original) {
      writeFileSync(filePath, updated);
    }
  }
}

console.log(`Synced Pi docs from ${sourceDocs}`);
console.log(`Wrote English source to ${targetEn}`);
console.log(`If upstream changed, re-run: npm run translate -- zh`);
