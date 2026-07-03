#!/usr/bin/env node
// translate-locale.mjs — 阶段 3 实现
// content/en -> content/<locale>，可插拔 provider：
//   providers/local-command.mjs  本地 Qwen（/root/soft/llama.cpp/qwen36-client），并发 1
//   providers/deepseek-api.mjs    远程 DeepSeek API（后备）
// 用法: TRANSLATION_PROVIDER=local-command LOCAL_LLM_COMMAND=... npm run translate -- zh
// 当前为占位。
console.log("[translate-locale] 尚未实现（计划阶段 3）");
console.log(
  "[translate-locale] 用法: TRANSLATION_PROVIDER=local-command LOCAL_LLM_COMMAND=/root/soft/llama.cpp/qwen36-client npm run translate -- zh"
);
