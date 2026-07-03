#!/usr/bin/env node
// translate-locale.mjs — content/en -> content/<locale>
//
// 用法:
//   npm run translate -- zh
//   TRANSLATION_PROVIDER=local-command npm run translate -- zh          # 默认，本地 Qwen
//   TRANSLATION_PROVIDER=deepseek-api DEEPSEEK_API_KEY=... npm run translate -- zh
//
// 边界: 只写 content/<locale>，不写 docs/、不改 VitePress 配置。
// 并发: 串行（local-command supervisor 单 worker，真实推理并发为 1）。
// 缓存: content/.i18n-cache/<locale>.json（英文源 sha256），未变文件跳过（gitignore）。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWED_PROVIDERS = ["local-command", "deepseek-api"];
const TERM_TABLE = `术语对照（Pi 一律保留原文不译）：
extension=扩展, skill=技能, session=会话, provider=提供方,
prompt template=提示词模板, theme=主题, sandbox=沙箱, keybinding=快捷键,
compaction=上下文压缩, package=包, model=模型.`;

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

// 提取非围栏内的标题，返回 [{text, slug}]
function extractHeadings(text) {
  const out = [];
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ text: m[2], slug: slugify(m[2]) });
  }
  return out;
}

function buildMdPrompt(enText) {
  const headings = extractHeadings(enText);
  const headingMap = headings.length
    ? `\n标题锚点映射（每个标题译后必须写成“中文标题 {#slug}”，slug 取自这里）：\n${headings
        .map((h) => `- "${h.text}" => {#${h.slug}}`)
        .join("\n")}\n`
    : "";
  const instruction = [
    "你是专业技术文档翻译，把 Markdown 从英文译为简体中文。",
    "严格要求：",
    "1. 只翻译自然语言文字（散文）。",
    "2. 字节级保留：fenced code blocks（```）、inline code（`）、shell 命令、URL、frontmatter、HTML 标签及属性、VitePress 自定义容器（:::）。",
    "3. Markdown 链接的目标路径和锚点保持不变，只译链接显示文字，例如 [文字](quickstart.md#anchor) 仅译“文字”。",
    "4. Markdown 结构（标题层级、列表、表格、引用）保持不变。",
    "5. 每个标题译后必须写成：中文标题 {#原英文slug}（见下方映射），以保持页内锚点链接有效。",
    "6. 直接输出整篇翻译后的 Markdown，不要加任何解释、前后缀、代码块包裹。",
    TERM_TABLE,
    headingMap
  ].join("\n");
  return `${instruction}\n\n==== 待翻译 Markdown 开始 ====\n${enText}\n==== 待翻译 Markdown 结束 ====`;
}

async function main() {
  const locale = process.argv[2];
  if (!locale) {
    console.error("用法: npm run translate -- <locale>  (例如 zh)");
    process.exit(1);
  }

  const projectRoot = resolve(import.meta.dirname, "..");
  const contentDir = resolve(projectRoot, "content");
  const enDir = resolve(contentDir, "en");

  const localesConfig = JSON.parse(
    readFileSync(resolve(projectRoot, "locales.json"), "utf8")
  ).locales;
  const loc = localesConfig.find((l) => l.dir === locale || l.key === locale);
  if (!loc || loc.key === "root") {
    console.error(`未找到 locale "${locale}"，或不能翻译 root。locales.json: ${localesConfig.map((l) => l.dir).join(", ")}`);
    process.exit(1);
  }

  const providerName = process.env.TRANSLATION_PROVIDER || "local-command";
  if (!ALLOWED_PROVIDERS.includes(providerName)) {
    console.error(`不支持的 TRANSLATION_PROVIDER="${providerName}"，可选: ${ALLOWED_PROVIDERS.join(", ")}`);
    process.exit(1);
  }
  const providerPath = resolve(import.meta.dirname, "providers", `${providerName}.mjs`);
  const provider = (await import(pathToFileURL(providerPath).href)).translate;

  const localeDir = resolve(contentDir, loc.dir);
  const cacheDir = resolve(contentDir, ".i18n-cache");
  const cachePath = resolve(cacheDir, `${loc.dir}.json`);
  mkdirSync(localeDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};

  const enFiles = readdirSync(enDir).filter((f) => f.endsWith(".md"));

  const maxRetries = Number(process.env.TRANSLATE_MAX_RETRIES || 2);
  async function callProvider(prompt) {
    let lastErr;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return (await provider({ prompt, env: process.env })).trim();
      } catch (e) {
        lastErr = e;
        if (attempt <= maxRetries) console.warn(`  [重试 ${attempt}/${maxRetries}] ${e.message}`);
      }
    }
    throw lastErr;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (const file of enFiles) {
    const enText = readFileSync(resolve(enDir, file), "utf8");
    const hash = createHash("sha256").update(enText).digest("hex");
    const existing = existsSync(resolve(localeDir, file))
      ? readFileSync(resolve(localeDir, file), "utf8")
      : null;
    if (existing && cache[file] && cache[file].sourceHash === hash) {
      console.log(`[skip] ${file}（英文未变化）`);
      skipped++;
      continue;
    }
    try {
      console.log(`[translate] ${file} ...`);
      const out = await callProvider(buildMdPrompt(enText));
      writeFileSync(resolve(localeDir, file), out.endsWith("\n") ? out : out + "\n");
      cache[file] = { sourceHash: hash, status: "translated" };
      ok++;
    } catch (e) {
      console.error(`[fail] ${file}: ${e.message}`);
      failures.push(file);
      failed++;
    }
  }

  // docs.json 导航标题：一次性整批翻译再回填
  const enDocs = JSON.parse(readFileSync(resolve(enDir, "docs.json"), "utf8"));
  const titles = enDocs.navigation.flatMap((g) => [g.title, ...g.items.map((i) => i.title)]);
  try {
    console.log("[translate] docs.json 导航标题 ...");
    const inst = [
      "把下列英文导航标题逐行译为简体中文。每行输入对应一行输出，保持顺序与行数。",
      "不要编号、不要解释、不要加引号。术语：" + TERM_TABLE
    ].join("\n");
    const prompt = `${inst}\n\n==== 开始 ====\n${titles.join("\n")}\n==== 结束 ====`;
    const out = (await callProvider(prompt)).split("\n").map((s) => s.trim()).filter((s) => s);
    if (out.length !== titles.length) {
      throw new Error(`标题行数不匹配 (${out.length} != ${titles.length})`);
    }
    let idx = 0;
    const navigation = enDocs.navigation.map((g) => ({
      title: out[idx++],
      items: g.items.map((it) => ({ title: out[idx++], path: it.path }))
    }));
    writeFileSync(
      resolve(localeDir, "docs.json"),
      JSON.stringify({ navigation, redirects: enDocs.redirects }, null, 2) + "\n"
    );
    console.log("[translate] docs.json 完成");
  } catch (e) {
    console.error(`[fail] docs.json: ${e.message}`);
    failures.push("docs.json");
    failed++;
  }

  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n");

  console.log(`\n=== 翻译结束: ${loc.label} ===`);
  console.log(`成功 ${ok}，跳过 ${skipped}，失败 ${failed}`);
  if (failures.length) console.log(`失败: ${failures.join(", ")}`);
  if (providerName === "local-command" && failed === enFiles.length + 1) {
    console.error("\n全部失败：请确认 qwen36-supervisor 已启动（/root/soft/llama.cpp/qwen36-supervisor）。");
  }
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`[translate-locale] 致命错误: ${e.message}`);
  process.exit(1);
});
