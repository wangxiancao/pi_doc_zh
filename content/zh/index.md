# Pi 文档 {#pi-documentation}

Pi 是一个轻量级的终端编码工具。它旨在保持核心精简，同时通过 TypeScript 扩展、技能、提示词模板、主题和 pi 包进行扩展。

## 快速入门 {#quick-start}

使用 npm 安装 Pi：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 会在安装期间禁用依赖的生命周期脚本。对于常规的 npm 安装，Pi 不需要安装脚本。

在 Linux 或 macOS 上，你也可以使用安装脚本：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

要卸载 pi 本身，请使用 npm 处理 curl 和 npm 安装的情况：

```bash
npm uninstall -g @earendil-works/pi-coding-agent
```

对于 pnpm、Yarn 或 Bun 安装，请使用对应的全局移除命令：`pnpm remove -g @earendil-works/pi-coding-agent`、`yarn global remove @earendil-works/pi-coding-agent` 或 `bun uninstall -g @earendil-works/pi-coding-agent`。

然后在项目目录中运行它：

```bash
pi
```

对于订阅型提供方，请使用 `/login` 进行身份验证，或者在启动 pi 之前设置 API 密钥，例如 `ANTHROPIC_API_KEY`。

有关完整的初次运行流程，请参阅 [快速入门](quickstart.md)。

## 从这里开始 {#start-here}

- [快速入门](quickstart.md) - 安装、身份验证和运行首次会话。
- [使用 Pi](usage.md) - 交互模式、斜杠命令、上下文文件和 CLI 参考。
- [提供方](providers.md) - 内置提供方的订阅和 API 密钥设置。
- [安全](security.md) - 项目信任、沙箱边界和漏洞报告。
- [容器化](containerization.md) - 使用 Gondolin、Docker 或 OpenShell 将 pi 沙箱化。
- [设置](settings.md) - 全局和项目设置。
- [快捷键](keybindings.md) - 默认快捷键和自定义快捷键。
- [会话](sessions.md) - 会话管理、分支和树形导航。
- [上下文压缩](compaction.md) - 上下文压缩和分支摘要。

## 自定义 {#customization}

- [扩展](extensions.md) - 用于工具、命令、事件和自定义 UI 的 TypeScript 模块。
- [技能](skills.md) - 可复用的按需能力代理技能。
- [提示词模板](prompt-templates.md) - 可从斜杠命令扩展的可复用提示词。
- [主题](themes.md) - 内置和自定义终端主题。
- [Pi 包](packages.md) - 打包和共享扩展、技能、提示词和主题。
- [自定义模型](models.md) - 为支持的提供方 API 添加模型条目。
- [自定义提供方](custom-provider.md) - 实现自定义 API 和 OAuth 流程。

## 编程使用 {#programmatic-usage}

- [SDK](sdk.md) - 在 Node.js 应用程序中嵌入 pi。
- [RPC 模式](rpc.md) - 通过 stdin/stdout JSONL 进行集成。
- [JSON 事件流模式](json.md) - 带有结构化事件的打印模式。
- [TUI 组件](tui.md) - 为扩展构建自定义终端 UI。

## 参考 {#reference}

- [会话格式](session-format.md) - JSONL 会话文件格式、条目类型和 SessionManager API。

## 平台设置 {#platform-setup}

- [Windows](windows.md)
- [Android 上的 Termux](termux.md)
- [tmux](tmux.md)
- [终端设置](terminal-setup.md)
- [Shell 别名](shell-aliases.md)

## 开发 {#development}

- [开发](development.md) - 本地设置、项目结构和调试。
