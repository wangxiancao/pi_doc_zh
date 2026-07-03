# 设置

Pi 使用 JSON 设置文件，项目设置会覆盖全局设置。

| 位置 | 范围 |
|----------|-------|
| `~/.pi/agent/settings.json` | 全局（所有项目） |
| `.pi/settings.json` | 项目（当前目录） |

可以直接编辑，或使用 `/settings` 命令进行常见选项的配置。

## 项目信任 {#project-trust}

在交互式启动时，如果项目文件夹包含项目本地设置、资源或项目 `.agents/skills`，且 `~/.pi/agent/trust.json` 中未保存对该文件夹或父文件夹的信任决策，Pi 会在信任该文件夹之前进行询问。信任一个项目允许 Pi 加载 `.pi/settings.json` 和 `.pi` 资源，安装缺失的项目包，并执行项目扩展。

非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不会显示信任提示。如果没有适用的已保存信任决策，它们将使用全局设置中的 `defaultProjectTrust`：`ask`（默认）和 `never` 会忽略这些项目资源，而 `always` 则会信任它们。传递 `--approve`/`-a` 或 `--no-approve`/`-na` 可以覆盖单次运行的项目信任设置。

如果没有扩展或已保存的决策适用，`defaultProjectTrust` 控制回退行为。在 `~/.pi/agent/settings.json` 中将其设置为 `"ask"`、`"always"` 或 `"never"`，或通过 `/settings` 更改它。

`pi config` 和包命令使用相同的项目信任流程，但 `pi update` 从不提示。传递 `--approve` 以信任单次命令的项目本地设置，或传递 `--no-approve` 以忽略它们。

在交互模式下使用 `/trust` 保存项目信任决策以供未来会话使用，包括对直接父文件夹的信任。它仅写入 `~/.pi/agent/trust.json`；当前会话不会重新加载，因此请重启 Pi 以使更改生效。

## 所有设置 {#all-settings}

### 模型与思考 {#model-thinking}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `defaultProvider` | string | - | 默认提供方（例如，`"anthropic"`、`"openai"`） |
| `defaultModel` | string | - | 默认模型 ID |
| `defaultThinkingLevel` | string | - | `"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"` |
| `hideThinkingBlock` | boolean | `false` | 在输出中隐藏思考块 |
| `thinkingBudgets` | object | - | 每个思考级别的自定义 token 预算 |

#### thinkingBudgets {#thinkingbudgets}

```json
{
  "thinkingBudgets": {
    "minimal": 1024,
    "low": 4096,
    "medium": 10240,
    "high": 32768
  }
}
```

### UI 与显示 {#ui-display}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `theme` | string | `"dark"` | 主题名称（`"dark"`、`"light"` 或自定义） |
| `externalEditor` | string | `$VISUAL`，然后是 `$EDITOR`，Windows 上为 Notepad，其他为 `nano` | Ctrl+G 外部编辑器命令；优先于环境变量 |
| `quietStartup` | boolean | `false` | 隐藏启动头部信息 |
| `defaultProjectTrust` | string | `"ask"` | 回退项目信任行为：`"ask"`、`"always"` 或 `"never"`。仅限全局设置 |
| `collapseChangelog` | boolean | `false` | 更新后显示压缩后的更新日志 |
| `enableInstallTelemetry` | boolean | `true` | 首次安装或检测到更新日志更新后的匿名安装/更新版本 ping。这不会控制更新检查 |
| `enableAnalytics` | boolean | `false` | 选择加入的分析数据共享。目前仅在实验性首次设置（`PI_EXPERIMENTAL=1`）时询问 |
| `trackingId` | string | - | 分析跟踪标识符，在启用 `enableAnalytics` 时生成 |
| `doubleEscapeAction` | string | `"tree"` | 双 Escape 键的操作：`"tree"`、`"fork"` 或 `"none"` |
| `treeFilterMode` | string | `"default"` | `/tree` 的默认过滤器：`"default"`、`"no-tools"`、`"user-only"`、`"labeled-only"`、`"all"` |
| `editorPaddingX` | number | `0` | 输入编辑器的水平填充（0-3） |
| `outputPad` | number | `1` | 用户消息、助手消息和思考的水平填充（0 或 1） |
| `autocompleteMaxVisible` | number | `5` | 自动补全下拉列表中最大可见项目数（3-20） |
| `showHardwareCursor` | boolean | `false` | 在 TUI 为 IME 支持定位光标时显示终端光标 |

对于 VS Code，包含 `--wait` 以便 Pi 在编辑器退出后恢复：

```json
{
  "externalEditor": "code --wait"
}
```

### 遥测与更新检查 {#telemetry-and-update-checks}

`enableInstallTelemetry` 仅控制向 `https://pi.dev/api/report-install` 发送的匿名安装/更新 ping。选择退出遥测不会禁用更新检查；Pi 仍可以获取 `https://pi.dev/api/latest-version` 以查找最新版本。

设置 `PI_SKIP_VERSION_CHECK=1` 以禁用 Pi 版本更新检查。使用 `--offline` 或 `PI_OFFLINE=1` 以禁用此处描述的所有启动网络操作，包括更新检查、包更新检查和安装/更新遥测。

### 网络 {#network}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `httpProxy` | string | - | 作为 `HTTP_PROXY` 和 `HTTPS_PROXY` 应用的 HTTP 代理 URL。仅限全局设置。 |

```json
{
  "httpProxy": "http://127.0.0.1:7890"
}
```

### 警告 {#warnings}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `warnings.anthropicExtraUsage` | boolean | `true` | 当 Anthropic 订阅认证可能使用付费额外用量时显示警告 |

```json
{
  "warnings": {
    "anthropicExtraUsage": false
  }
}
```

### 上下文压缩 {#compaction}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `compaction.enabled` | boolean | `true` | 启用自动上下文压缩 |
| `compaction.reserveTokens` | number | `16384` | 为 LLM 响应保留的 token 数 |
| `compaction.keepRecentTokens` | number | `20000` | 保留的近期 token 数（不进行摘要） |

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

### 分支摘要 {#branch-summary}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `branchSummary.reserveTokens` | number | `16384` | 为分支摘要保留的 token 数 |
| `branchSummary.skipPrompt` | boolean | `false` | 在 `/tree` 导航时跳过“摘要分支？”提示（默认为不摘要） |

### 重试 {#retry}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `retry.enabled` | boolean | `true` | 在瞬态错误时启用自动代理级重试 |
| `retry.maxRetries` | number | `3` | 最大代理级重试次数 |
| `retry.baseDelayMs` | number | `2000` | 代理级指数退避的基础延迟（2s, 4s, 8s） |
| `retry.provider.timeoutMs` | number | SDK 默认值 | 提供方/SDK 请求超时（毫秒） |
| `retry.provider.maxRetries` | number | `0` | 提供方/SDK 重试次数 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | 失败前最大服务器请求延迟（60s） |

当提供方请求的重试延迟长于 `retry.provider.maxRetryDelayMs` 时（例如，Google 的“配额将在 5 小时后重置”），请求将立即失败并显示信息性错误，而不是静默等待。设置为 `0` 以禁用此限制。

除非明确需要提供方级重试，否则请保持 `retry.provider.maxRetries` 为 `0`。将其设置为高于 `0` 的值可能会导致 SDK/提供方重试在 Pi 看到它们之前处理超出用量限制的错误，这可能会在某些情况下阻止代理，直到提供方配额重置。

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "provider": {
      "timeoutMs": 3600000,
      "maxRetries": 0,
      "maxRetryDelayMs": 60000
    }
  }
}
```

### 消息传递 {#message-delivery}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `steeringMode` | string | `"one-at-a-time"` | 发送引导消息的方式：`"all"` 或 `"one-at-a-time"` |
| `followUpMode` | string | `"one-at-a-time"` | 发送后续消息的方式：`"all"` 或 `"one-at-a-time"` |
| `transport` | string | `"auto"` | 支持多种传输方式的提供方首选传输：`"sse"`、`"websocket"`、`"websocket-cached"` 或 `"auto"` |
| `httpIdleTimeoutMs` | number | `300000` | HTTP 头/体空闲超时（毫秒），也用于具有显式流空闲超时的提供方。设置为 `0` 以禁用。 |
| `websocketConnectTimeoutMs` | number | `15000` | 支持 WebSocket 传输的方方的 WebSocket 连接/打开握手超时（毫秒）。设置为 `0` 以禁用。 |

### 终端与图像 {#terminal-images}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `terminal.showImages` | boolean | `true` | 在终端中显示图像（如果支持） |
| `terminal.imageWidthCells` | number | `60` | 终端中内联图像的偏好宽度（单元格数） |
| `terminal.clearOnShrink` | boolean | `false` | 内容缩小时清除空行（可能导致闪烁） |
| `images.autoResize` | boolean | `true` | 将图像调整为最大 2000x2000 |
| `images.blockImages` | boolean | `false` | 阻止所有图像发送给 LLM |

### Shell {#shell}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `shellPath` | string | - | 自定义 shell 路径（例如，Windows 上的 Cygwin） |
| `shellCommandPrefix` | string | - | 每个 bash 命令的前缀（例如，`"shopt -s expand_aliases"`） |
| `npmCommand` | string[] | - | 用于 npm 包查找/安装操作的命令参数（例如，`["mise", "exec", "node@20", "--", "npm"]`） |

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

`npmCommand` 用于所有 npm 包管理器操作，包括安装、卸载以及 git 包内的依赖安装。用户范围的 npm 包安装在 `~/.pi/agent/npm/` 下；项目范围的 npm 包安装在 `.pi/npm/` 下。使用 argv 风格的条目，正如进程应被启动的方式一样。当配置了 `npmCommand` 时，git 包依赖安装使用普通的 `install` 以避免包装器或替代包管理器中出现 npm 特定标志。

### 会话 {#sessions}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `sessionDir` | string | - | 存储会话文件的目录。接受绝对路径、相对路径以及 `~`。 |

```json
{ "sessionDir": ".pi/sessions" }
```

当多个源指定会话目录时，优先级为 `--session-dir`、`PI_CODING_AGENT_SESSION_DIR`，然后是 `settings.json` 中的 `sessionDir`。

### 模型循环 {#model-cycling}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `enabledModels` | string[] | - | Ctrl+P 循环的模型模式（与 `--models` CLI 标志格式相同） |

```json
{
  "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"]
}
```

### Markdown {#markdown}

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `markdown.codeBlockIndent` | string | `"  "` | 代码块的缩进 |

### 资源 {#resources}

这些设置定义了从何处加载扩展、技能、提示词和主题。

`~/.pi/agent/settings.json` 中的路径相对于 `~/.pi/agent` 解析。`.pi/settings.json` 中的路径相对于 `.pi` 解析。支持绝对路径和 `~`。

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `packages` | array | `[]` | 从中加载资源的 npm/git 包 |
| `extensions` | string[] | `[]` | 本地扩展文件路径或目录 |
| `skills` | string[] | `[]` | 本地技能文件路径或目录 |
| `prompts` | string[] | `[]` | 本地提示词模板路径或目录 |
| `themes` | string[] | `[]` | 本地主题文件路径或目录 |
| `enableSkillCommands` | boolean | `true` | 将技能注册为 `/skill:name` 命令 |

数组支持 glob 模式和排除项。使用 `!pattern` 进行排除。使用 `+path` 强制包含确切路径，使用 `-path` 强制排除确切路径。

#### packages {#packages}

字符串形式从包中加载所有资源：

```json
{
  "packages": ["pi-skills", "@org/my-extension"]
}
```

对象形式过滤要加载的资源：

```json
{
  "packages": [
    {
      "source": "pi-skills",
      "skills": ["brave-search", "transcribe"],
      "extensions": []
    }
  ]
}
```

有关包管理的详细信息，请参阅 [packages.md](packages.md)。

## 示例 {#example}

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "theme": "dark",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3
  },
  "enabledModels": ["claude-*", "gpt-4o"],
  "warnings": {
    "anthropicExtraUsage": true
  },
  "packages": ["pi-skills"]
}
```

## 项目覆盖 {#project-overrides}

项目设置（`.pi/settings.json`）会覆盖全局设置。嵌套对象会合并：

```json
// ~/.pi/agent/settings.json (全局)
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 16384 }
}

// .pi/settings.json (项目)
{
  "compaction": { "reserveTokens": 8192 }
}

// 结果
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 8192 }
}
```
