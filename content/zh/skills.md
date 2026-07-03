pi 可以创建技能。让它根据你的用例构建一个。

# 技能

技能是自我包含的能力包，代理按需加载。技能为特定任务提供专门的工作流、设置说明、辅助脚本和参考文档。

Pi 实现了 [Agent Skills 标准](https://agentskills.io/specification)，会对大多数违规发出警告，但保持宽容。尽管标准禁止这样做，但 Pi 允许技能名称与其父目录不同；该规则对于在多个代理运行程序之间共享的技能目录来说并非最优。

## 目录 {#table-of-contents}

- [位置](#locations)
- [技能工作原理](#how-skills-work)
- [技能命令](#skill-commands)
- [技能结构](#skill-structure)
- [Frontmatter](#frontmatter)
- [验证](#validation)
- [示例](#example)
- [技能仓库](#skill-repositories)

## 位置 {#locations}

> **安全：** 技能可以指示模型执行任何操作，并可能包含模型调用的可执行代码。使用前请审查技能内容。

Pi 从以下位置加载技能：

- 全局：
  - `~/.pi/agent/skills/`
  - `~/.agents/skills/`
- 项目（仅在项目受信任后）：
  - `.pi/skills/`
  - `cwd` 及其祖先目录中的 `.agents/skills/`（最多到 git 仓库根目录，如果不在仓库中则到文件系统根目录）
- 包：`package.json` 中的 `skills/` 目录或 `pi.skills` 条目
- 设置：包含文件或目录的 `skills` 数组
- CLI：`--skill <path>`（可重复，即使使用 `--no-skills` 也是累加的）

发现规则：
- 在 `~/.pi/agent/skills/` 和 `.pi/skills/` 中，直接根目录下的 `.md` 文件被发现为单独的技能
- 在所有技能位置中，包含 `SKILL.md` 的目录会被递归发现
- 在 `~/.agents/skills/` 和项目 `.agents/skills/` 中，根目录下的 `.md` 文件被忽略

使用 `--no-skills` 禁用发现（显式的 `--skill` 路径仍会加载）。

### 使用来自其他运行程序的技能 {#using-skills-from-other-harnesses}

要使用来自 Claude Code 或 OpenAI Codex 的技能，请将它们的目录添加到设置中：

```json
{
  "skills": [
    "~/.claude/skills",
    "~/.codex/skills"
  ]
}
```

对于项目级别的 Claude Code 技能，添加到 `.pi/settings.json`：

```json
{
  "skills": ["../.claude/skills"]
}
```

## 技能工作原理 {#how-skills-work}

1. 启动时，pi 扫描技能位置并提取名称和描述
2. 系统提示符按 [规范](https://agentskills.io/integrate-skills) 以 XML 格式包含可用技能
3. 当任务匹配时，代理使用 `read` 加载完整的 SKILL.md（模型并不总是这样做；请使用提示词或 `/skill:name` 强制加载）
4. 代理遵循说明，使用相对路径引用脚本和资源

这是渐进式披露：只有描述始终在上下文中，完整说明按需加载。

## 技能命令 {#skill-commands}

技能注册为 `/skill:name` 命令：

```bash
/skill:brave-search           # 加载并执行技能
/skill:pdf-tools extract      # 带参数加载技能
```

命令后的参数作为 `User: <args>` 附加到技能内容中。

在交互模式或通过 `settings.json` 通过 `/settings` 切换技能命令：

```json
{
  "enableSkillCommands": true
}
```

## 技能结构 {#skill-structure}

技能是一个包含 `SKILL.md` 文件的目录。其余部分自由定义。

```
my-skill/
├── SKILL.md              # 必需：frontmatter + 说明
├── scripts/              # 辅助脚本
│   └── process.sh
├── references/           # 按需加载的详细文档
│   └── api-reference.md
└── assets/
    └── template.json
```

### SKILL.md 格式 {#skillmd-format}

````markdown
---
name: my-skill
description: 此技能的作用及使用场景。请具体说明。
---

# 我的技能

## 设置

首次使用前运行一次：
```bash
cd /path/to/skill && npm install
```

## 用法

```bash
./scripts/process.sh <input>
```
````

使用相对于技能目录的路径：

```markdown
详见 [参考指南](references/REFERENCE.md)。
```

## Frontmatter {#frontmatter}

根据 [Agent Skills 规范](https://agentskills.io/specification#frontmatter-required)：

| 字段 | 必需 | 描述 |
|-------|----------|-------------|
| `name` | 是 | 最多 64 个字符。小写 a-z、0-9、连字符。与标准不同，Pi 不要求此名称与父目录匹配，因为该标准要求对于共享技能目录来说并非最优。 |
| `description` | 是 | 最多 1024 个字符。技能的作用及使用场景。 |
| `license` | 否 | 许可证名称或捆绑文件的引用。 |
| `compatibility` | 否 | 最多 500 个字符。环境要求。 |
| `metadata` | 否 | 任意的键值映射。 |
| `allowed-tools` | 否 | 预批准的工具列表，以空格分隔（实验性功能）。 |
| `disable-model-invocation` | 否 | 当为 `true` 时，技能从系统提示中隐藏。用户必须使用 `/skill:name`。 |

### 名称规则 {#name-rules}

- 1-64 个字符
- 仅小写字母、数字、连字符
- 无前导/尾随连字符
- 无连续连字符

Pi 不要求名称与父目录匹配。Agent Skills 标准要求如此，但该要求对于由多个工具使用的共享技能目录来说并非最优。

有效：`pdf-processing`、`data-analysis`、`code-review`
无效：`PDF-Processing`、`-pdf`、`pdf--processing`

### 描述最佳实践 {#description-best-practices}

描述决定代理何时加载技能。请具体说明。

良好：
```yaml
description: 从 PDF 文件中提取文本和表格，填写 PDF 表单，并合并多个 PDF。在处理 PDF 文档时使用。
```

差劲：
```yaml
description: 帮助处理 PDF。
```

## 验证 {#validation}

Pi 根据 Agent Skills 标准验证技能。大多数问题会产生警告但仍会加载技能：

- 名称超过 64 个字符或包含无效字符
- 名称以连字符开头/结尾或有连续连字符
- 描述超过 1024 个字符

未知的 frontmatter 字段将被忽略。

**例外：** 缺少描述的技能不会被加载。

名称冲突（来自不同位置的相同名称）会发出警告并保留第一个找到的技能。

## 示例 {#example}

```
brave-search/
├── SKILL.md
├── search.js
└── content.js
```

**SKILL.md：**
````markdown
---
name: brave-search
description: 通过 Brave Search API 进行网页搜索和内容提取。用于搜索文档、事实或任何网页内容。
---

# Brave Search

## 设置

```bash
cd /path/to/brave-search && npm install
```

## 搜索

```bash
./search.js "query"              # 基本搜索
./search.js "query" --content    # 包含页面内容
```

## 提取页面内容

```bash
./content.js https://example.com
```
````

## 技能仓库 {#skill-repositories}

- [Anthropic Skills](https://github.com/anthropics/skills) - 文档处理（docx, pdf, pptx, xlsx）、Web 开发
- [Pi Skills](https://github.com/badlogic/pi-skills) - 网页搜索、浏览器自动化、Google API、转录
