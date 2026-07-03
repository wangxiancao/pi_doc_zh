pi 可以创建提示词模板。请让它为你的工作流构建一个。

# 提示词模板 {#prompt-templates}

提示词模板是 Markdown 片段，会展开为完整的提示词。在编辑器中输入 `/name` 即可调用模板，其中 `name` 是去掉 `.md` 后缀的文件名。

## 位置 {#locations}

Pi 从以下位置加载提示词模板：

- 全局：`~/.pi/agent/prompts/*.md`
- 项目：`.pi/prompts/*.md`（仅在项目被信任后）
- 包：`prompts/` 目录或 `package.json` 中的 `pi.prompts` 条目
- 设置：包含文件或目录的 `prompts` 数组
- CLI：`--prompt-template <path>`（可重复使用）

使用 `--no-prompt-templates` 禁用发现功能。

## 格式 {#format}

```markdown
---
description: 审查暂存的 git 更改
---
审查暂存的更改（`git diff --cached`）。重点关注：
- 错误和逻辑问题
- 安全问题
- 错误处理缺失
```

- 文件名成为命令名。`review.md` 变为 `/review`。
- `description` 是可选的。如果缺失，则使用第一个非空行。
- `argument-hint` 是可选的。设置后，提示将在自动补全下拉框的描述之前显示。

### 参数提示 {#argument-hints}

在 frontmatter 中使用 `argument-hint` 在自动补全中显示预期参数。使用 `<尖括号>` 表示必需参数，使用 `[方括号]` 表示可选参数：

```markdown
---
description: 审查来自 URL 的 PR，并结构化分析问题和代码
argument-hint: "<PR-URL>"
---
```

这在自动补全下拉框中渲染为：

```
→ pr   <PR-URL>       — 审查来自 URL 的 PR，并结构化分析问题和代码
  is   <issue>        — 分析 GitHub 问题（错误修复或功能请求）
  wr   [instructions] — 端到端完成当前任务
  cl   — 在发布前审计更改日志条目
```

## 用法 {#usage}

在编辑器中输入 `/` 后跟模板名称。自动补全会显示可用的模板及其描述。

```
/review                           # 展开 review.md
/component Button                 # 带参数展开
/component Button "click handler" # 多个参数
```

## 参数 {#arguments}

模板支持位置参数、默认值和简单切片：

- `$1`, `$2`, ... 位置参数
- `$@` 或 `$ARGUMENTS` 用于连接所有参数
- `${1:-default}` 当存在/非空时使用参数 1，否则使用 `default`
- `${@:N}` 用于从第 N 个位置开始的参数（索引从 1 开始）
- `${@:N:L}` 用于从 N 开始的 `L` 个参数

示例：

```markdown
---
description: 创建组件
---
创建一个名为 $1 的 React 组件，功能包括：$@
```

默认值对于可选参数很有用：

```markdown
用 ${1:-7} 个要点总结当前状态。
```

用法：`/component Button "onClick handler" "disabled support"`

## 加载规则 {#loading-rules}

- `prompts/` 中的模板发现是非递归的。
- 如果你希望子目录中的模板可用，请通过 `prompts` 设置或包清单显式添加它们。
