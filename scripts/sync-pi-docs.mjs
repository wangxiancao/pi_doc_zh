#!/usr/bin/env node
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
const targetDocs = resolve(projectRoot, "docs");

if (!existsSync(docsJson)) {
  console.error(`Could not find Pi docs at: ${sourceDocs}`);
  console.error("Expected file: packages/coding-agent/docs/docs.json");
  process.exit(1);
}

rmSync(targetDocs, { recursive: true, force: true });
mkdirSync(targetDocs, { recursive: true });
cpSync(sourceDocs, targetDocs, { recursive: true });

// Adapt upstream image references to VitePress's public/ static-asset model.
// Upstream Markdown uses HTML <img src="images/..."> with a sibling images/ dir,
// which Vite/Rollup cannot resolve at build time. Move images/ under public/ and
// rewrite the relative refs to absolute "/images/..." so they resolve correctly.
const imagesDir = resolve(targetDocs, "images");
if (existsSync(imagesDir)) {
  const publicDir = resolve(targetDocs, "public");
  mkdirSync(publicDir, { recursive: true });
  renameSync(imagesDir, resolve(publicDir, "images"));

  for (const file of readdirSync(targetDocs)) {
    if (!file.endsWith(".md")) continue;
    const filePath = resolve(targetDocs, file);
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
console.log(`Wrote docs to ${targetDocs}`);

