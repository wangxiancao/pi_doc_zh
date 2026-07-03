# 使用 Pi

本页汇集了快速入门页面未涵盖的日常使用细节。

## 交互模式 {#interactive-mode}

<p align="center"><img src="/images/interactive-mode.png" alt="交互模式" width="600"></p>

界面主要分为四个区域：

- **启动页眉** - 快捷键、已加载的上下文文件、提示词模板、技能和扩展
- **消息** - 用户消息、助手回复、工具调用、工具结果、通知、错误和扩展 UI
- **编辑器** - 输入区域；边框颜色表示当前的思考级别
- **页脚** - 工作目录、会话名称、token/缓存用量、成本、上下文用量和当前模型

编辑器可被内置 UI（如 `/settings`）或自定义扩展 UI 临时替换。

### 编辑器功能 {#editor-features}

| 功能 | 操作方式 |
|---------|-----|
| 文件引用 | 输入 `@` 对工程文件进行模糊搜索 |
| 路径补全 | 按 Tab 键补全路径 |
| 多行输入 | Shift+Enter，或在 Windows Terminal 上按 Ctrl+Enter |
| 图片 | Ctrl+V 粘贴，Windows 上 Alt+V，或拖入终端 |
| Shell 命令 | `!command` 执行并将输出发送给模型 |
| 隐藏 Shell 命令 | `!!command` 执行但不将输出发送给模型 |
| 外部编辑器 | Ctrl+G 打开 `externalEditor`、`$VISUAL`、`$EDITOR`，Windows 上为记事本，其他平台为 `nano` |

查看所有快捷键和自定义设置，请参阅 [Keybindings](keybindings.md)。

## 斜杠命令 {#slash-commands}

在编辑器中输入 `/` 以打开命令补全。扩展可以注册自定义命令，技能可通过 `/skill:name` 使用，提示词模板可通过 `/templatename` 展开。

| 命令 | 描述 |
|---------|-------------|
| `/login`, `/logout` | 管理 OAuth 或 API 密钥凭据 |
| `/model` | 切换模型 |
| `/scoped-models` | 启用/禁用用于 Ctrl+P 循环的模型 |
| `/settings` | 思考级别、主题、消息传递、传输方式 |
| `/resume` | 从之前的会话中选择 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置会话显示名称 |
| `/session` | 显示会话文件、ID、消息、token 和成本 |
| `/tree` | 跳转到会话中的任意点并从此处继续 |
| `/trust` | 保存项目信任决策以供后续会话使用 |
| `/fork` | 从之前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制到新会话中 |
| `/compact [prompt]` | 手动压缩上下文，可选择附带自定义指令 |
| `/copy` | 将最后一条助手消息复制到剪贴板 |
| `/export [file]` | 将会话导出为 HTML 或 JSONL |
| `/import <file>` | 从 JSONL 文件导入并恢复会话 |
| `/share` | 上传为私有 GitHub gist，并提供可分享的 HTML 链接 |
| `/reload` | 重新加载快捷键、扩展、技能、提示词和上下文文件 |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit` | 退出 pi |

## 消息队列 {#message-queue}

在代理仍在工作时，你可以提交消息：

- **Enter** 排队一条转向消息，在当前助手回合完成执行其工具调用后传递。
- **Alt+Enter** 排队一条跟进消息，在代理完成所有工作后传递。
- **Escape** 中止并将排队的消息恢复到编辑器。
- **Alt+Up** 将排队的消息检索回编辑器。

在 Windows Terminal 中，Alt+Enter 默认为全屏模式。如果你希望 pi 接收该快捷键，请按照 [终端设置](terminal-setup.md) 中的描述重新映射它。

在 [设置](settings.md) 中通过 `steeringMode` 和 `followUpMode` 配置传递行为。

## 会话 {#sessions}

会话会自动保存到 `~/.pi/agent/sessions/`，按工作目录组织。

```bash
pi -c                  # 继续最近的会话
pi -r                  # 浏览并选择会话
pi --no-session        # 临时模式；不保存
pi --name "my task"    # 在启动时设置会话显示名称
pi --session <path|id> # 使用特定的会话文件或会话 ID
pi --fork <path|id>    # 将会话分支到新会话文件中
```

有用的会话命令：

- `/session` 显示当前会话文件和 ID。
- `/tree` 导航文件内的会话树，并可以总结被放弃的分支。
- `/fork` 从较早的用户消息创建新会话。
- `/clone` 将当前活动分支复制到新会话文件中。
- `/compact` 总结较旧的消息以释放上下文。

详见 [Sessions](sessions.md) 和 [Compaction](compaction.md)。

## 上下文文件 {#context-files}

Pi 在启动时从以下位置加载 `AGENTS.md` 或 `CLAUDE.md`：

- `~/.pi/agent/AGENTS.md` 用于全局指令
- 父目录，从当前工作目录向上遍历
- 当前目录

使用上下文文件来定义项目约定、命令、安全规则和偏好。使用 `--no-context-files` 或 `-nc` 禁用加载。

### 系统提示词文件 {#system-prompt-files}

使用以下文件替换默认系统提示词：

- `.pi/SYSTEM.md` 用于特定项目
- `~/.pi/agent/SYSTEM.md` 用于全局

在任一位置使用 `APPEND_SYSTEM.md` 向默认提示词追加内容，而不替换它。

### 项目信任 {#project-trust}

在交互启动时，如果项目文件夹包含项目本地设置、资源或项目 `.agents/skills`，且 `~/.pi/agent/trust.json` 中对该文件夹或其父文件夹没有已保存的决策，pi 会在信任之前询问。信任项目允许 pi 加载 `.pi/settings.json` 和 `.pi` 资源，安装缺失的项目包，并执行项目扩展。

在做出信任决策之前，pi 仅加载上下文文件、用户/全局扩展和 CLI `-e` 扩展，以便它们可以处理 `project_trust` 事件。项目本地扩展、项目包管理的扩展和项目设置仅在项目被信任后加载。当切换到来自不同 cwd（其信任在当前进程中尚未解决）的会话时，此分离也适用。

非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不会显示信任提示。如果没有适用的已保存信任决策，它们使用全局设置中的 `defaultProjectTrust`：`ask`（默认）和 `never` 会忽略那些项目资源，而 `always` 则信任它们。传递 `--approve`/`-a` 或 `--no-approve`/`-na` 以覆盖单次运行的项目信任。

如果没有扩展或已保存的决策适用，`defaultProjectTrust` 控制回退行为。在 `~/.pi/agent/settings.json` 中将其设置为 `"ask"`、`"always"` 或 `"never"`，或通过 `/settings` 更改它。

`pi config` 和包命令使用相同的项目信任流程，除了 `pi update` 从不提示。传递 `--approve` 以信任单次命令的项目本地设置，或 `--no-approve` 以忽略它们。

在交互模式下使用 `/trust` 保存项目信任决策以供后续会话使用，包括对直接父文件夹的信任。它仅写入 `~/.pi/agent/trust.json`；当前会话不会重新加载，因此请重启 pi 以使更改生效。


## 导出和共享会话 {#exporting-and-sharing-sessions}

使用 `/export [file]` 将会话写入 HTML。

使用 `/share` 上传带有可分享 HTML 链接的私有 GitHub gist。

如果你使用 pi 进行开源工作并希望发布会话以用于模型、提示词、工具和评估研究，请参阅 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。它将会话发布到 Hugging Face 数据集。

## CLI 参考 {#cli-reference}

```bash
pi [options] [@files...] [messages...]
```

### 包命令 {#package-commands}

```bash
pi install <source> [-l]     # 安装包，-l 表示项目本地
pi remove <source> [-l]      # 移除包
pi uninstall <source> [-l]   # remove 的别名
pi update [source|self|pi]   # 仅更新 pi，或一个包源
pi update --all              # 更新 pi 和包；协调固定的 git 引用
pi update --extensions       # 仅更新包；协调固定的 git 引用
pi update --self             # 仅更新 pi
pi update --extension <src>  # 更新一个包
pi list                      # 列出已安装的包
pi config                    # 启用/禁用包资源
```

这些命令管理 pi 包，`pi update` 可以更新 pi CLI 安装。要卸载 pi 本身，请参阅 [Quickstart](quickstart.md#uninstall)。`pi config` 和项目包命令接受 `--approve`/`--no-approve` 以信任或忽略单次命令的项目本地设置。`pi update` 从不提示项目信任。

有关包源和安全说明，请参阅 [Pi Packages](packages.md)。

### 模式 {#modes}

| 标志 | 描述 |
|------|-------------|
| default | 交互模式 |
| `-p`, `--print` | 打印响应并退出 |
| `--mode json` | 将所有事件输出为 JSON 行；见 [JSON 模式](json.md) |
| `--mode rpc` | 通过 stdin/stdout 的 RPC 模式；见 [RPC 模式](rpc.md) |
| `--export <in> [out]` | 将会话导出为 HTML |

在打印模式下，pi 还读取管道输入的 stdin 并将其合并到初始提示词中：

```bash
cat README.md | pi -p "Summarize this text"
```

### 模型选项 {#model-options}

| 选项 | 描述 |
|--------|-------------|
| `--provider <name>` | 提供方，如 `anthropic`、`openai` 或 `google` |
| `--model <pattern>` | 模型模式或 ID；支持 `provider/id` 和可选的 `:<thinking>` |
| `--api-key <key>` | API 密钥，覆盖环境变量 |
| `--thinking <level>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh` |
| `--models <patterns>` | 用于 Ctrl+P 循环的逗号分隔模式 |
| `--list-models [search]` | 列出可用模型 |

### 会话选项 {#session-options}

| 选项 | 描述 |
|--------|-------------|
| `-c`, `--continue` | 继续最近的会话 |
| `-r`, `--resume` | 浏览并选择会话 |
| `--session <path|id>` | 使用特定的会话文件或部分 UUID |
| `--fork <path|id>` | 将会话文件或部分 UUID 分支到新会话 |
| `--session-dir <dir>` | 自定义会话存储目录 |
| `--no-session` | 临时模式；不保存 |
| `--name <name>`, `-n <name>` | 在启动时设置会话显示名称 |

### 工具选项 {#tool-options}

| 选项 | 描述 |
|--------|-------------|
| `--tools <list>`, `-t <list>` | 允许特定的内置、扩展和自定义工具 |
| `--exclude-tools <list>`, `-xt <list>` | 禁用特定的内置、扩展和自定义工具 |
| `--no-builtin-tools`, `-nbt` | 禁用内置工具但保持扩展/自定义工具启用 |
| `--no-tools`, `-nt` | 禁用所有工具 |

内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`。

### 资源选项 {#resource-options}

| 选项 | 描述 |
|--------|-------------|
| `-e`, `--extension <source>` | 从路径、npm 或 git 加载扩展；可重复 |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <path>` | 加载技能；可重复 |
| `--no-skills` | 禁用技能发现 |
| `--prompt-template <path>` | 加载提示词模板；可重复 |
| `--no-prompt-templates` | 禁用提示词模板发现 |
| `--theme <path>` | 加载主题；可重复 |
| `--no-themes` | 禁用主题发现 |
| `--no-context-files`, `-nc` | 禁用 `AGENTS.md` 和 `CLAUDE.md` 发现 |

将 `--no-*` 与显式标志结合使用，以仅加载所需内容，忽略设置。示例：

```bash
pi --no-extensions -e ./my-extension.ts
```

### 其他选项 {#other-options}

| 选项 | 描述 |
|--------|-------------|
| `--system-prompt <text>` | 替换默认提示词；上下文文件和技能仍会追加 |
| `--append-system-prompt <text>` | 追加到系统提示词 |
| `--verbose` | 强制详细启动 |
| `-a`, `--approve` | 信任本次运行的项目本地文件 |
| `-na`, `--no-approve` | 忽略本次运行的项目本地文件 |
| `-h`, `--help` | 显示帮助 |
| `-v`, `--version` | 显示版本 |

### 文件参数 {#file-arguments}

在文件前添加 `@` 以将其包含在消息中：

```bash
pi @prompt.md "Answer this"
pi -p @screenshot.png "What's in this image?"
pi @code.ts @test.ts "Review these files"
```

### 示例 {#examples}

```bash
# 交互模式，带有初始提示词
pi "List all .ts files in src/"

# 非交互模式
pi -p "Summarize this codebase"

# 非交互模式，带有管道输入
cat README.md | pi -p "Summarize this text"

# 命名的一次性会话
pi --name "release audit" -p "Audit this repository"

# 不同模型
pi --provider openai --model gpt-4o "Help me refactor"

# 带有提供方前缀的模型
pi --model openai/gpt-4o "Help me refactor"

# 带有思考级别简写的模型
pi --model sonnet:high "Solve this complex problem"

# 限制模型循环
pi --models "claude-*,gpt-4o"

# 只读模式
pi --tools read,grep,find,ls -p "Review the code"

# 禁用一个扩展或内置工具，同时保留其余可用
pi --exclude-tools ask_question
```

### 环境变量 {#environment-variables}

| 变量 | 描述 |
|----------|-------------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录；默认为 `~/.pi/agent` |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖会话存储目录；可被 `--session-dir` 覆盖 |
| `PI_PACKAGE_DIR` | 覆盖包目录，对 Nix/Guix 存储路径有用 |
| `PI_OFFLINE` | 禁用启动网络操作，包括更新检查、包更新检查和安装/更新遥测 |
| `PI_SKIP_VERSION_CHECK` | 跳过启动时的 Pi 版本更新检查。这会阻止 `pi.dev` 最新版本的请求 |
| `PI_TELEMETRY` | 覆盖安装/更新遥测和提供方归属头：`1`/`true`/`yes` 或 `0`/`false`/`no`。这不会禁用更新检查 |
| `PI_CACHE_RETENTION` | 在支持的情况下设置为 `long` 以延长提示词缓存 |
| `VISUAL`, `EDITOR` | 当 `externalEditor` 未设置时，Ctrl+G 的回退外部编辑器；Windows 上默认为记事本，其他平台为 `nano` |

## 设计原则 {#design-principles}

Pi 保持核心精简，并将工作流特定行为推送到扩展、技能、提示词模板和包中。

它有意不包含内置 MCP、子代理、权限弹窗、计划模式、待办事项或后台 bash。你可以将这些工作流构建或安装为扩展或包，或使用容器和 tmux 等外部工具。

完整理由，请阅读 [博客文章](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。
