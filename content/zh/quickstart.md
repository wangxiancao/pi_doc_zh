# 快速上手 {#quickstart}

本页面将引导你从安装到完成第一个有用的 pi 会话。

## 安装 {#install}

Pi 作为 npm 包分发：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 在安装期间禁用依赖的生命周期脚本。Pi 在常规 npm 安装中不需要安装脚本。

### 卸载 {#uninstall}

使用安装 pi 的包管理器。curl 安装程序全局使用 npm，因此 curl 和 npm 安装均通过 npm 移除：

```bash
# curl 安装程序或 npm install -g
npm uninstall -g @earendil-works/pi-coding-agent

# pnpm
pnpm remove -g @earendil-works/pi-coding-agent

# Yarn
yarn global remove @earendil-works/pi-coding-agent

# Bun
bun uninstall -g @earendil-works/pi-coding-agent
```

卸载 pi 后，设置、凭据、会话和已安装的 pi 包仍保留在 `~/.pi/agent/` 中。

然后在你要 pi 工作的项目目录中启动 pi：

```bash
cd /path/to/project
pi
```

## 身份验证 {#authenticate}

Pi 可以通过 `/login` 使用订阅提供方，或通过环境变量或 auth 文件使用 API 密钥提供方。

### 选项 1：订阅登录 {#option-1-subscription-login}

启动 pi 并运行：

```text
/login
```

然后选择一个提供方。内置的订阅登录包括 Claude Pro/Max、ChatGPT Plus/Pro (Codex) 和 GitHub Copilot。

### 选项 2：API 密钥 {#option-2-api-key}

在启动 pi 之前设置 API 密钥：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

你也可以运行 `/login` 并选择一个 API 密钥提供方，将密钥存储在 `~/.pi/agent/auth.json` 中。

有关所有支持的提供方、环境变量和云提供方设置，请参阅 [Providers](providers.md)。

## 首次会话 {#first-session}

一旦 pi 启动，输入请求并按 Enter：

```text
Summarize this repository and tell me how to run its checks.
```

默认情况下，pi 为模型提供四个工具：

- `read` - 读取文件
- `write` - 创建或覆盖文件
- `edit` - 修补文件
- `bash` - 运行 shell 命令

额外的内置只读工具（`grep`、`find`、`ls`）可通过工具选项使用。Pi 在你的当前工作目录中运行，并可以修改该目录中的文件。如果你想要轻松回滚，请使用 git 或其他检入工作流。

## 向 pi 提供项目指令 {#give-pi-project-instructions}

Pi 在启动时加载上下文文件。添加 `AGENTS.md` 文件以告知它如何在项目中工作：

```markdown
# Project Instructions

- Run `npm run check` after code changes.
- Do not run production migrations locally.
- Keep responses concise.
```

Pi 加载：

- `~/.pi/agent/AGENTS.md` 用于全局指令
- 父目录和当前目录中的 `AGENTS.md` 或 `CLAUDE.md`

更改上下文文件后，请重启 pi 或运行 `/reload`。

## 常见尝试事项 {#common-things-to-try}

### 引用文件 {#reference-files}

在编辑器中输入 `@` 以模糊搜索文件，或在命令行上传递文件：

```bash
pi @README.md "Summarize this"
pi @src/app.ts @src/app.test.ts "Review these together"
```

图片可以通过 Ctrl+V（Windows 上为 Alt+V）粘贴或拖入支持的终端中。

### 运行 shell 命令 {#run-shell-commands}

在交互模式下：

```text
!npm run lint
```

命令输出将发送给模型。使用 `!!command` 运行命令而不将其输出添加到模型上下文。

### 切换模型 {#switch-models}

使用 `/model` 或 Ctrl+L 选择模型。使用 Shift+Tab 循环思考级别。使用 Ctrl+P / Shift+Ctrl+P 循环遍历作用域模型。

### 稍后继续 {#continue-later}

会话会自动保存：

```bash
pi -c                  # 继续最近的会话
pi -r                  # 浏览以前的会话
pi --name "my task"    # 在启动时设置会话显示名称
pi --session <path|id> # 打开特定会话
```

在 pi 内部，使用 `/resume`、`/new`、`/tree`、`/fork` 和 `/clone` 来管理会话。

### 非交互模式 {#non-interactive-mode}

对于一次性提示：

```bash
pi -p "Summarize this codebase"
cat README.md | pi -p "Summarize this text"
pi -p @screenshot.png "What's in this image?"
```

使用 `--mode json` 进行 JSON 事件输出，或使用 `--mode rpc` 进行进程集成。

## 后续步骤 {#next-steps}

- [Using Pi](usage.md) - 交互模式、斜杠命令、会话、上下文文件和 CLI 参考。
- [Providers](providers.md) - 身份验证和模型设置。
- [Settings](settings.md) - 全局和项目配置。
- [Keybindings](keybindings.md) - 快捷键和自定义。
- [Pi Packages](packages.md) - 安装共享扩展、技能、提示词模板和主题。

平台说明：[Windows](windows.md)、[Termux](termux.md)、[tmux](tmux.md)、[Terminal setup](terminal-setup.md)、[Shell aliases](shell-aliases.md)。
