#!/usr/bin/env node
// validate-i18n.mjs — 多语种一致性校验
//
// 用法:
//   npm run validate-i18n              # 校验 content/ 源；dist/ 存在时一并校验产物
//   node scripts/validate-i18n.mjs      # 同上
//
// 校验项:
//   1. 每个非 root locale 必须有 index.md 和 docs.json            (ERROR)
//   2. locale 文件覆盖率 vs content/en                            (WARNING)
//   3. 已翻译文件的 fenced code block 数量 == 英文源               (ERROR，仅完整 locale)
//   4. 站内 .md 链接目标存在                                       (ERROR 完整 locale / WARNING 否则)
//   5. dist/ 的 <img src> 可解析                                    (ERROR，dist 存在时)
//   6. dist/ 资源路径含 Pages base 前缀                            (ERROR，base 非 / 时)
//
// 渐进式严格：locale 覆盖率 <100% 时，代码块/链接校验降级，只报覆盖率 warning。
// 这样翻译过程中校验逐步收紧，而非在占位阶段持续 fail。
//
// TODO(阶段3): heading hash anchor 校验（配合翻译时写入显式 {#english-slug}）
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const contentDir = resolve(projectRoot, "content");
const distDir = resolve(projectRoot, "dist");
const localesPath = resolve(projectRoot, "locales.json");

const errors = [];
const warnings = [];

if (!existsSync(localesPath)) {
  console.error(`[validate-i18n] 缺少 ${localesPath}`);
  process.exit(1);
}
const { locales } = JSON.parse(readFileSync(localesPath, "utf8"));

function listMd(dir) {
  return existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort()
    : [];
}

// 围栏代码块数量（``` 开头的行成对计数）
function countFenced(text) {
  const m = text.match(/^```[^\n]*$/gm);
  return m ? m.length / 2 : 0;
}

// 提取站内 Markdown 链接目标（相对 .md 路径，去掉 hash/query，排除外部）
function extractMdLinks(text) {
  const out = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].split(/\s/)[0];
    const target = raw.split("#")[0].split("?")[0];
    if (!target) continue;
    if (/^https?:|^mailto:|^#|^\/\//.test(target)) continue; // 外部/纯锚点/协议相对
    if (!target.endsWith(".md")) continue; // 仅校验 .md 链接，其他资源跳过
    out.push(target);
  }
  return out;
}

function getBase() {
  if (process.env.SITE_BASE) return process.env.SITE_BASE;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return "/";
  const name = repo.split("/")[1] ?? "";
  return name.endsWith(".github.io") ? "/" : `/${name}/`;
}

// ---------- 源级校验 ----------
const enMd = listMd(resolve(contentDir, "en"));

for (const loc of locales) {
  if (loc.key === "root") continue;
  const ldir = resolve(contentDir, loc.dir);
  const lMd = listMd(ldir);
  const lSet = new Set(lMd);

  // 1. 结构
  if (!existsSync(resolve(ldir, "index.md")))
    errors.push(`[${loc.key}] 缺少 index.md`);
  if (!existsSync(resolve(ldir, "docs.json")))
    errors.push(`[${loc.key}] 缺少 docs.json`);

  // 2. 覆盖率
  const missing = enMd.filter((f) => !lSet.has(f));
  const extra = lMd.filter((f) => !enMd.includes(f));
  const pct = enMd.length ? Math.round((lMd.length / enMd.length) * 100) : 0;
  if (missing.length) {
    const sample = missing.slice(0, 5).join(", ");
    warnings.push(
      `[${loc.key}] 覆盖率 ${pct}% (${lMd.length}/${enMd.length})，缺失 ${missing.length} 个: ${sample}${missing.length > 5 ? " …" : ""}`
    );
  }
  if (extra.length) {
    warnings.push(`[${loc.key}] 多出英文源没有的文件: ${extra.join(", ")}`);
  }

  const localeComplete = missing.length === 0;
  if (!localeComplete) continue; // 未完整翻译时，下面的严格校验降级

  // 3. 代码块数量（仅完整 locale）
  for (const f of lMd) {
    const lc = countFenced(readFileSync(resolve(ldir, f), "utf8"));
    const ec = countFenced(readFileSync(resolve(contentDir, "en", f), "utf8"));
    if (lc !== ec) {
      errors.push(`[${loc.key}] ${f}: fenced code block ${lc} != 英文 ${ec}`);
    }
  }

  // 4. 站内链接（完整 locale 为 ERROR；英文源同位置也断则视为上游固有问题，跳过）
  for (const f of lMd) {
    const text = readFileSync(resolve(ldir, f), "utf8");
    for (const link of extractMdLinks(text)) {
      const target = resolve(ldir, link);
      if (existsSync(target)) continue;
      if (!existsSync(resolve(contentDir, "en", link))) continue;
      errors.push(`[${loc.key}] ${f}: 站内链接 "${link}" 目标不存在`);
    }
  }
}

// ---------- 产物校验（dist/ 存在时）----------
if (existsSync(distDir)) {
  const base = getBase();

  function walkHtml(dir) {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) out.push(...walkHtml(p));
      else if (e.name.endsWith(".html")) out.push(p);
    }
    return out;
  }
  const htmls = walkHtml(distDir);

  // 5. <img src> 可解析
  let imgIssues = 0;
  for (const h of htmls) {
    const text = readFileSync(h, "utf8");
    const re = /<img[^>]+src="([^"]+)"/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const src = m[1];
      if (/^https?:|^data:/.test(src)) continue;
      let rel = src;
      if (base !== "/" && rel.startsWith(base)) rel = rel.slice(base.length);
      else rel = rel.replace(/^\//, "");
      if (!existsSync(resolve(distDir, rel))) {
        imgIssues++;
        if (imgIssues <= 5)
          errors.push(`[dist] ${h.replace(distDir, "")}: 图片不可解析 ${src}`);
      }
    }
  }
  if (imgIssues > 5)
    errors.push(`[dist] 另有 ${imgIssues - 5} 处图片不可解析（省略）`);

  // 6. 资源前缀（base 非 / 时）
  if (base !== "/" && htmls.length) {
    const idx = readFileSync(resolve(distDir, "index.html"), "utf8");
    if (!idx.includes(`href="${base}`) && !idx.includes(`src="${base}`)) {
      errors.push(`[dist] index.html 资源未含 base 前缀 "${base}"`);
    }
  }
} else {
  warnings.push("[dist] dist/ 不存在，跳过产物校验（先 npm run build）");
}

// ---------- 汇总 ----------
console.log("=== validate-i18n 报告 ===");
if (warnings.length) {
  console.log(`\n⚠️  WARNING (${warnings.length}):`);
  warnings.forEach((w) => console.log("  " + w));
}
if (errors.length) {
  console.log(`\n✖  ERROR (${errors.length}):`);
  errors.forEach((e) => console.log("  " + e));
  console.log(`\n校验失败：${errors.length} 个错误`);
  process.exit(1);
}
console.log(`\n✓ 校验通过${warnings.length ? `（${warnings.length} 个 warning）` : ""}`);
