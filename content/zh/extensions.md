pi 可以创建扩展。让它根据你的用例构建一个扩展。

# 扩展

扩展是用于扩展 pi 行为的 TypeScript 模块。它们可以订阅生命周期事件、注册可由 LLM 调用的自定义工具、添加命令等。

> **`/reload` 的位置：** 将扩展放置在 `~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目本地）以实现自动发现。仅在使用快速测试时使用 `pi -e ./path.ts`。在自动发现位置中的扩展可以通过 `/reload` 进行热重载。

**关键功能：**
- **自定义工具** - 通过 `pi.registerTool()` 注册 LLM 可调用的工具
- **事件拦截** - 阻止或修改工具调用、注入上下文、自定义上下文压缩
- **用户交互** - 通过 `ctx.ui` 提示用户（选择、确认、输入、通知）
- **自定义 UI 组件** - 通过 `ctx.ui.custom()` 提供具有键盘输入的完整 TUI 组件，用于复杂交互
- **自定义命令** - 通过 `pi.registerCommand()` 注册如 `/mycommand` 之类的命令
- **会话持久化** - 通过 `pi.appendEntry()` 存储跨越重启的状态
- **自定义渲染** - 控制工具调用/结果和消息在 TUI 中的显示方式

**示例用例：**
- 权限门禁（在 `rm -rf`、`sudo` 等之前确认）
- Git 检查点（在每个 turn 时 stash，在分支上恢复）
- 路径保护（阻止写入 `.env`、`node_modules/`）
- 自定义上下文压缩（以你想要的方式总结对话）
- 对话摘要（参见 `summarize.ts` 示例）
- 交互式工具（问答、向导、自定义对话框）
- 有状态工具（待办列表、连接池）
- 外部集成（文件监听器、webhooks、CI 触发器）
- 等待时的游戏（参见 `snake.ts` 示例）

参见 [examples/extensions/](../examples/extensions/) 中的工作实现。

## Table of Contents

- [快速开始](#quick-start)
- [扩展位置](#extension-locations)
- [可用导入](#available-imports)
- [编写扩展](#writing-an-extension)
  - [扩展样式](#extension-styles)
- [事件](#events)
  - [生命周期概览](#lifecycle-overview)
  - [资源事件](#resource-events)
  - [会话事件](#session-events)
  - [智能体事件](#agent-events)
  - [模型事件](#model-events)
  - [工具事件](#tool-events)
- [扩展上下文](#extensioncontext)
- [扩展命令上下文](#extensioncommandcontext)
- [扩展 API 方法](#extensionapi-methods)
- [状态管理](#state-management)
- [自定义工具](#custom-tools)
- [自定义 UI](#custom-ui)
- [错误处理](#error-handling)
- [模式行为](#mode-behavior)
- [示例参考](#examples-reference)

## Quick Start

创建 `~/.pi/agent/extensions/my-extension.ts`：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // 响应事件
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("扩展已加载！", "info");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("危险！", "允许 rm -rf？");
      if (!ok) return { block: true, reason: "被用户阻止" };
    }
  });

  // 注册自定义工具
  pi.registerTool({
    name: "greet",
    label: "问候",
    description: "按名字问候某人",
    parameters: Type.Object({
      name: Type.String({ description: "要问候的名字" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `你好，${params.name}！` }],
        details: {},
      };
    },
  });

  // 注册命令
  pi.registerCommand("hello", {
    description: "打招呼",
    handler: async (args, ctx) => {
      ctx.ui.notify(`你好 ${args || "world"}！`, "info");
    },
  });
}
```

使用 `--extension`（或 `-e`）标志进行测试：

```bash
pi -e ./my-extension.ts
```

## Extension Locations

> **安全性：** 扩展以你完整的系统权限运行，可以执行任意代码。仅安装来自你信任的源代码的扩展。

扩展会从受信任的位置自动发现。项目本地的 `.pi/extensions` 条目仅在项目受信任后加载。

| 位置 | 范围 |
|----------|-------|
| `~/.pi/agent/extensions/*.ts` | 全局（所有项目） |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目本地 |
| `.pi/extensions/*/index.ts` | 项目本地（子目录） |

通过 `settings.json` 添加其他路径：

```json
{
  "packages": [
    "npm:@foo/bar@1.0.0",
    "git:github.com/user/repo@v1"
  ],
  "extensions": [
    "/path/to/local/extension.ts",
    "/path/to/local/extension/dir"
  ]
}
```

要通过 npm 或 git 作为 pi 包共享扩展，参见 [packages.md](packages.md)。

## Available Imports

| 包 | 用途 |
|---------|---------|
| `@earendil-works/pi-coding-agent` | 扩展类型（`ExtensionAPI`、`ExtensionContext`、事件） |
| `typebox` | 工具参数的 Schema 定义 |
| `@earendil-works/pi-ai` | AI 工具（`StringEnum` 用于 Google 兼容的枚举） |
| `@earendil-works/pi-tui` | 用于自定义渲染的 TUI 组件 |

npm 依赖项也可以使用。在扩展旁边（或父目录中）添加 `package.json`，运行 `npm install`，`node_modules/` 中的导入会自动解析。

对于使用 `pi install` 安装的分布式 pi 包（npm 或 git），运行时依赖项必须在 `dependencies` 中。包安装默认使用生产安装（`npm install --omit=dev`），因此 `devDependencies` 在运行时不可用；当配置了 `npmCommand` 时，git 包使用普通的 `install` 以保持与包装器的兼容性。

Node.js 内置模块（`node:fs`、`node:path` 等）也可用。

## Writing an Extension

扩展导出一个默认工厂函数，该函数接收 `ExtensionAPI`。工厂可以是同步或异步的：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 订阅事件
  pi.on("event_name", async (event, ctx) => {
    // ctx.ui 用于用户交互
    const ok = await ctx.ui.confirm("标题", "确定吗？");
    ctx.ui.notify("完成！", "info");
    ctx.ui.setStatus("my-ext", "处理中...");  // 页脚状态
    ctx.ui.setWidget("my-ext", ["第 1 行", "第 2 行"]);  // 编辑器上方的组件（默认）
  });

  // 注册工具、命令、快捷键、标志
  pi.registerTool({ ... });
  pi.registerCommand("name", { ... });
  pi.registerShortcut("ctrl+x", { ... });
  pi.registerFlag("my-flag", { ... });
}
```

扩展通过 [jiti](https://github.com/unjs/jiti) 加载，因此 TypeScript 无需编译即可工作。

如果工厂返回 `Promise`，pi 会在继续启动之前等待它。这意味着异步初始化在 `session_start`、`resources_discover` 以及通过 `pi.registerProvider()` 排队的 provider 注册被刷新之前完成。

### Async factory functions

使用异步工厂进行一次性启动工作，例如获取远程配置或动态发现可用模型。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  const response = await fetch("http://localhost:1234/v1/models");
  const payload = (await response.json()) as {
    data: Array<{
      id: string;
      name?: string;
      context_window?: number;
      max_tokens?: number;
    }>;
  };

  pi.registerProvider("local-openai", {
    baseUrl: "http://localhost:1234/v1",
    apiKey: "$LOCAL_OPENAI_API_KEY",
    api: "openai-completions",
    models: payload.data.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.context_window ?? 128000,
      maxTokens: model.max_tokens ?? 4096,
    })),
  });
}
```

此模式使获取的模型在正常启动期间和 `pi --list-models` 中可用。

### Long-lived resources and shutdown

扩展工厂可能在从未启动会话的调用中运行。不要从工厂启动后台资源，如进程、套接字、文件监听器或计时器。

将后台资源的启动推迟到 `session_start` 或需要该资源的命令/工具/事件。注册一个幂等的 `session_shutdown` 处理程序以关闭你启动的任何会话范围内的资源。

### Extension Styles

**单文件** - 最简单，适用于小型扩展：

```
~/.pi/agent/extensions/
└── my-extension.ts
```

**带有 index.ts 的目录** - 适用于多文件扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── index.ts        # 入口点（导出默认函数）
    ├── tools.ts        # 辅助模块
    └── utils.ts        # 辅助模块
```

**带有依赖项的包** - 适用于需要 npm 包的扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── package.json    # 声明依赖项和入口点
    ├── package-lock.json
    ├── node_modules/   # npm install 之后
    └── src/
        └── index.ts
```

```json
// package.json
{
  "name": "my-extension",
  "dependencies": {
    "zod": "^3.0.0",
    "chalk": "^5.0.0"
  },
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

在扩展目录中运行 `npm install`，然后 `node_modules/` 中的导入即可自动工作。

## Events

### Lifecycle Overview

```
pi 启动
  │
  ├─► project_trust（仅限用户/全局和 CLI 扩展，在项目资源加载之前）
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }
      │
      ▼
用户发送提示 ─────────────────────────────────────────┐
  │                                                        │
  ├─►（首先检查扩展命令，如果找到则绕过）  │
  ├─► input（可以拦截、转换或处理）          │
  ├─►（如果未处理，则扩展技能/模板）            │
  ├─► before_agent_start（可以注入消息、修改系统提示）
  ├─► agent_start                                          │
  ├─► message_start / message_update / message_end         │
  │                                                        │
  │   ┌─── turn（当 LLM 调用工具时重复） ───┐       │
  │   │                                            │       │
  │   ├─► turn_start                               │       │
  │   ├─► context（可以修改消息）            │       │
  │   ├─► before_provider_request（可以检查或替换负载）
  │   ├─► after_provider_response（状态 + 头部，在流消耗之前）
  │   │                                            │       │
  │   │   LLM 响应，可能调用工具：            │       │
  │   │     ├─► tool_execution_start               │       │
  │   │     ├─► tool_call（可以阻止）              │       │
  │   │     ├─► tool_execution_update              │       │
  │   │     ├─► tool_result（可以修改）           │       │
  │   │     └─► tool_execution_end                 │       │
  │   │                                            │       │
  │   └─► turn_end                                 │       │
  │                                                        │
  └─► agent_end                                            │
                                                           │
用户发送另一个提示 ◄────────────────────────────────┘

/new（新会话）或 /resume（切换会话）
  ├─► session_before_switch（可以取消）
  ├─► session_shutdown
  ├─► session_start { reason: "new" | "resume", previousSessionFile? }
  └─► resources_discover { reason: "startup" }

/fork 或 /clone
  ├─► session_before_fork（可以取消）
  ├─► session_shutdown
  ├─► session_start { reason: "fork", previousSessionFile }
  └─► resources_discover { reason: "startup" }

/name 或 pi.setSessionName()
  └─► session_info_changed

/compact 或自动上下文压缩
  ├─► session_before_compact（可以取消或自定义）
  └─► session_compact

/tree 导航
  ├─► session_before_tree（可以取消或自定义）
  └─► session_tree

/model 或 Ctrl+P（模型选择/循环）
  ├─► thinking_level_select（如果模型更改更改/限制思考级别）
  └─► model_select

思考级别更改（设置、快捷键、pi.setThinkingLevel()）
  └─► thinking_level_select

退出（Ctrl+C, Ctrl+D, SIGHUP, SIGTERM）
  └─► session_shutdown
```

### Startup Events

#### project_trust

在 pi 决定是否信任具有动态配置（`.pi` 或 `.agents/skills`）的项目之前触发。它在启动期间运行，当会话替换（例如 `/resume`）进入其信任在当前进程中尚未解决的 cwd 时也会运行。仅用户/全局扩展和 CLI `-e` 扩展参与；项目本地扩展在信任解决之前不会加载。

```typescript
pi.on("project_trust", async (event, ctx) => {
  // event.cwd - 当前工作目录
  // ctx 具有有限的信任上下文：cwd, mode, hasUI, 以及 select/confirm/input/notify UI 辅助方法
  if (await ctx.ui.confirm("信任项目？", event.cwd)) {
    return { trusted: "yes", remember: true };
  }
  return { trusted: "undecided" };
});
```

`project_trust` 处理程序必须返回 `{ trusted: "yes" | "no" | "undecided" }`。返回 `"yes"` 或 `"no"` 的用户/全局或 CLI 扩展拥有决策权；第一个 yes/no 决策获胜并抑制内置的信任提示。使用 `remember: true` 持久化 yes/no 决策；否则它仅适用于当前进程。返回 `"undecided"` 以让后续处理程序或内置信任流程决定。在提示之前检查 `ctx.hasUI`。如果没有处理程序返回 yes/no，正常的信任解析将继续：首先应用保存的 `trust.json` 决策，然后 `defaultProjectTrust` 控制 pi 默认是询问、信任还是拒绝。

### Resource Events

#### resources_discover

在 `session_start` 之后触发，以便扩展可以贡献额外的 skill、prompt 和 theme 路径。
启动路径使用 `reason: "startup"`。重载使用 `reason: "reload"`。

```typescript
pi.on("resources_discover", async (event, _ctx) => {
  // event.cwd - 当前工作目录
  // event.reason - "startup" | "reload"
  return {
    skillPaths: ["/path/to/skills"],
    promptPaths: ["/path/to/prompts"],
    themePaths: ["/path/to/themes"],
  };
});
```

### Session Events

有关会话存储内部结构和 SessionManager API 的详细信息，参见 [Session Format](session-format.md)。

#### session_start

在会话启动、加载或重载时触发。

```typescript
pi.on("session_start", async (event, ctx) => {
  // event.reason - "startup" | "reload" | "new" | "resume" | "fork"
  // event.previousSessionFile - 对于 "new"、"resume" 和 "fork" 存在
  ctx.ui.notify(`会话：${ctx.sessionManager.getSessionFile() ?? "ephemeral"}`, "info");
});
```

#### session_info_changed

当通过 `/name`、RPC 或 `pi.setSessionName()` 设置当前会话显示名称时触发。

```typescript
pi.on("session_info_changed", async (event, ctx) => {
  // event.name - 当前标准化名称，如果清除则为 undefined
  ctx.ui.notify(`会话重命名：${event.name ?? "(none)"}`, "info");
});
```

#### session_before_switch

在启动新会话（`/new`）或切换会话（`/resume`）之前触发。

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" 或 "resume"
  // event.targetSessionFile - 我们要切换到的会话（仅适用于 "resume"）

  if (event.reason === "new") {
    const ok = await ctx.ui.confirm("清除？", "删除所有消息？");
    if (!ok) return { cancel: true };
  }
});
```

成功切换或新会话操作后，pi 为旧扩展实例发出 `session_shutdown`，为新的会话重新加载和绑定扩展，然后发出带有 `reason: "new" | "resume"` 和 `previousSessionFile` 的 `session_start`。
在 `session_shutdown` 中进行清理工作，然后在 `session_start` 中重新建立任何内存状态。

#### session_before_fork

在通过 `/fork` 分叉或通过 `/clone` 克隆时触发。

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId - 选定条目的 ID
  // event.position - "/fork" 为 "before"，"/clone" 为 "at"
  return { cancel: true }; // 取消分叉/克隆
  // 或
  return { skipConversationRestore: true }; // 保留用于未来的对话恢复控制
});
```

成功分叉或克隆后，pi 为旧扩展实例发出 `session_shutdown`，为新的会话重新加载和绑定扩展，然后发出带有 `reason: "fork"` 和 `previousSessionFile` 的 `session_start`。
在 `session_shutdown` 中进行清理工作，然后在 `session_start` 中重新建立任何内存状态。

#### session_before_compact / session_compact

在上下文压缩时触发。有关详细信息，参见 [compaction.md](compaction.md)。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // reason - "manual" (/compact), "threshold", 或 "overflow"
  // willRetry - 压缩后是否重试被中止的 turn（溢出恢复）

  // 取消：
  return { cancel: true };

  // 自定义摘要：
  return {
    compaction: {
      summary: "...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    }
  };
});

pi.on("session_compact", async (event, ctx) => {
  // event.compactionEntry - 保存的压缩
  // event.fromExtension - 扩展是否提供
  // event.reason - "manual" (/compact), "threshold", 或 "overflow"
  // event.willRetry - 压缩后是否重试被中止的 turn（溢出恢复）
});
```

#### session_before_tree / session_tree

在 `/tree` 导航时触发。有关树导航概念，参见 [Sessions](sessions.md)。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;
  return { cancel: true };
  // 或提供自定义摘要：
  return { summary: { summary: "...", details: {} } };
});

pi.on("session_tree", async (event, ctx) => {
  // event.newLeafId, oldLeafId, summaryEntry, fromExtension
});
```

#### session_shutdown

在启动的会话运行时被拆除之前触发。使用它来清理从 `session_start` 或其他会话范围钩子打开的资源。

```typescript
pi.on("session_shutdown", async (event, ctx) => {
  // event.reason - "quit" | "reload" | "new" | "resume" | "fork"
  // event.targetSessionFile - 会话替换流程的目标会话
  // 清理、保存状态等。
});
```

### Agent Events

#### before_agent_start

在用户提交提示后、智能体循环之前触发。可以注入消息和/或修改系统提示。

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt - 用户的提示文本
  // event.images - 附加的图片（如果有）
  // event.systemPrompt - 此处理程序当前的链式系统提示
  //   （包括来自之前 before_agent_start 处理程序的更改）
  // event.systemPromptOptions - 用于构建系统提示的结构化选项
  //   .customPrompt - 任何自定义系统提示（来自 --system-prompt, SYSTEM.md 或自定义模板）
  //   .selectedTools - 提示中当前激活的工具
  //   .toolSnippets - 每个工具的单行描述
  //   .promptGuidelines - 自定义指南要点
  //   .appendSystemPrompt - 来自 --append-system-prompt 标志的文本
  //   .cwd - 工作目录
  //   .contextFiles - AGENTS.md 文件和其他加载的上下文文件
  //   .skills - 加载的技能

  return {
    // 注入持久化消息（存储在会话中，发送给 LLM）
    message: {
      customType: "my-extension",
      content: "LLM 的额外上下文",
      display: true,
    },
    // 替换此 turn 的系统提示（跨扩展链式）
    systemPrompt: event.systemPrompt + "\n\n此 turn 的额外指令...",
  };
});
```

`systemPromptOptions` 字段使扩展能够访问 Pi 用于构建系统提示的相同结构化数据。这让你可以检查 Pi 加载了什么——自定义提示、指南、工具片段、上下文文件、技能——而无需重新发现资源或重新解析标志。当你的扩展需要对系统提示进行深入、明智的更改并尊重用户提供的配置时，请使用它。

在 `before_agent_start` 内部，`event.systemPrompt` 和 `ctx.getSystemPrompt()` 都反映当前处理程序作为的链式系统提示。后续的 `before_agent_start` 处理程序仍然可以再次修改它。

#### agent_start / agent_end

每个用户提示触发一次。

```typescript
pi.on("agent_start", async (_event, ctx) => {});

pi.on("agent_end", async (event, ctx) => {
  // event.messages - 此提示的消息
});
```

#### turn_start / turn_end

每个 turn（一个 LLM 响应 + 工具调用）触发。

```typescript
pi.on("turn_start", async (event, ctx) => {
  // event.turnIndex, event.timestamp
});

pi.on("turn_end", async (event, ctx) => {
  // event.turnIndex, event.message, event.toolResults
});
```

#### message_start / message_update / message_end

在消息生命周期更新时触发。

- `message_start` 和 `message_end` 为用户、助手和 toolResult 消息触发。
- `message_update` 为助手流式更新触发。
- `message_end` 处理程序可以返回 `{ message }` 以替换最终确定的消息。替换必须保持相同的 `role`。

```typescript
pi.on("message_start", async (event, ctx) => {
  // event.message
});

pi.on("message_update", async (event, ctx) => {
  // event.message
  // event.assistantMessageEvent（逐 token 流事件）
});

pi.on("message_end", async (event, ctx) => {
  if (event.message.role !== "assistant") return;

  return {
    message: {
      ...event.message,
      usage: {
        ...event.message.usage,
        cost: {
          ...event.message.usage.cost,
          total: 0.123,
        },
      },
    },
  };
});
```

#### tool_execution_start / tool_execution_update / tool_execution_end

在工具执行生命周期更新时触发。

在并行工具模式下：
- `tool_execution_start` 在预检阶段按助手源顺序发出
- `tool_execution_update` 事件可能在工具之间交错
- `tool_execution_end` 在每个工具最终确定后按工具完成顺序发出
- 最终的 `toolResult` 消息事件仍然在助手源顺序中稍后发出

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args
});

pi.on("tool_execution_update", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args, event.partialResult
});

pi.on("tool_execution_end", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.result, event.isError
});
```

#### context

在每个 LLM 调用之前触发。非破坏性地修改消息。有关消息类型，参见 [Session Format](session-format.md)。

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages - 深拷贝，安全修改
  const filtered = event.messages.filter(m => !shouldPrune(m));
  return { messages: filtered };
});
```

#### before_provider_request

在构建特定于 provider 的负载后、发送请求之前触发。处理程序按扩展加载顺序运行。返回 `undefined` 保持负载不变。返回任何其他值替换后续处理程序和实际请求的负载。

此钩子可以重写 provider 级别的系统指令或完全删除它们。这些负载级别的更改不会反映在 `ctx.getSystemPrompt()` 中，后者报告 Pi 的系统提示字符串而不是最终序列化的 provider 负载。

```typescript
pi.on("before_provider_request", (event, ctx) => {
  console.log(JSON.stringify(event.payload, null, 2));

  // 可选：替换负载
  // return { ...event.payload, temperature: 0 };
});
```

这主要用于调试 provider 序列化和缓存行为。

#### after_provider_response

在收到 HTTP 响应后、在消耗其流主体之前触发。处理程序按扩展加载顺序运行。

```typescript
pi.on("after_provider_response", (event, ctx) => {
  // event.status - HTTP 状态码
  // event.headers - 规范化响应头部
  if (event.status === 429) {
    console.log("rate limited", event.headers["retry-after"]);
  }
});
```

头部可用性取决于 provider 和传输。抽象 HTTP 响应的 provider 可能不暴露头部。

### Model Events

#### model_select

当通过 `/model` 命令、模型循环（`Ctrl+P`）或会话恢复更改模型时触发。

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model - 新选择的模型
  // event.previousModel - 前一个模型（如果是首次选择则为 undefined）
  // event.source - "set" | "cycle" | "restore"

  const prev = event.previousModel
    ? `${event.previousModel.provider}/${event.previousModel.id}`
    : "none";
  const next = `${event.model.provider}/${event.model.id}`;

  ctx.ui.notify(`模型更改 (${event.source})：${prev} -> ${next}`, "info");
});
```

使用它来在活动模型更改时更新 UI 元素（状态栏、页脚）或执行模型特定的初始化。

#### thinking_level_select

在思考级别更改时触发。这仅是通知；处理程序返回值被忽略。

```typescript
pi.on("thinking_level_select", async (event, ctx) => {
  // event.level - 新选择的思考级别
  // event.previousLevel - 前一个思考级别

  ctx.ui.setStatus("thinking", `thinking: ${event.level}`);
});
```

使用它在 `pi.setThinkingLevel()`、模型更改或内置思考级别控件更改活动思考级别时更新扩展 UI。

### Tool Events

#### tool_call

在 `tool_execution_start` 之后、工具执行之前触发。**可以阻止。** 使用 `isToolCallEventType` 进行缩小并获取类型化输入。

在 `tool_call` 运行之前，pi 等待之前发出的智能体事件通过 `AgentSession` 完成排空。这意味着 `ctx.sessionManager` 通过当前助手工具调用消息保持最新。

在默认的并行工具执行模式下，来自同一助手消息的兄弟工具调用是顺序预检的，然后并发执行。`tool_call` 不能保证在 `ctx.sessionManager` 中看到来自同一助手消息的兄弟工具结果。

`event.input` 是可变的。在执行前就地修改它以修补工具参数。

行为保证：
- 对 `event.input` 的修改影响实际工具执行
- 后续的 `tool_call` 处理程序看到由先前处理程序进行的修改
- 修改后不执行重新验证
- `tool_call` 的返回值仅通过 `{ block: true, reason?: string }` 控制阻止

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  // event.toolName - "bash", "read", "write", "edit" 等。
  // event.toolCallId
  // event.input - 工具参数（可变）

  // 内置工具：不需要类型参数
  if (isToolCallEventType("bash", event)) {
    // event.input 是 { command: string; timeout?: number }
    event.input.command = `source ~/.profile\n${event.input.command}`;

    if (event.input.command.includes("rm -rf")) {
      return { block: true, reason: "危险命令" };
    }
  }

  if (isToolCallEventType("read", event)) {
    // event.input 是 { path: string; offset?: number; limit?: number }
    console.log(`读取：${event.input.path}`);
  }
});
```

#### Typing custom tool input

自定义工具应导出其输入类型：

```typescript
// my-extension.ts
export type MyToolInput = Static<typeof myToolSchema>;
```

使用带有显式类型参数的 `isToolCallEventType`：

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { MyToolInput } from "my-extension";

pi.on("tool_call", (event) => {
  if (isToolCallEventType<"my_tool", MyToolInput>("my_tool", event)) {
    event.input.action;  // 类型化
  }
});
```

#### tool_result

在工具执行完成后、在发出 `tool_execution_end` 和最终工具结果消息事件之前触发。**可以修改结果。**

在并行工具模式下，`tool_result` 和 `tool_execution_end` 可能按工具完成顺序交错，而最终的 `toolResult` 消息事件仍然在助手源顺序中稍后发出。

`tool_result` 处理程序像中间件一样链式运行：
- 处理程序按扩展加载顺序运行
- 每个处理程序看到前一个处理程序更改后的最新结果
- 处理程序可以返回部分补丁（`content`、`details` 或 `isError`）；省略的字段保留其当前值

在处理器内部使用 `ctx.signal` 进行嵌套异步工作。这允许 Esc 取消模型调用、`fetch()` 和扩展启动的其他中止感知操作。

```typescript
import { isBashToolResult } from "@earendil-works/pi-coding-agent";

pi.on("tool_result", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input
  // event.content, event.details, event.isError

  if (isBashToolResult(event)) {
    // event.details 类型化为 BashToolDetails
  }

  const response = await fetch("https://example.com/summarize", {
    method: "POST",
    body: JSON.stringify({ content: event.content }),
    signal: ctx.signal,
  });

  // 修改结果：
  return { content: [...], details: {...}, isError: false };
});
```

### User Bash Events

#### user_bash

当用户执行 `!` 或 `!!` 命令时触发。**可以拦截。**

```typescript
import { createLocalBashOperations } from "@earendil-works/pi-coding-agent";

pi.on("user_bash", (event, ctx) => {
  // event.command - bash 命令
  // event.excludeFromContext - 如果 !! 前缀则为 true
  // event.cwd - 工作目录

  // 选项 1：提供自定义操作（例如 SSH）
  return { operations: remoteBashOps };

  // 选项 2：包装 pi 的内置本地 bash 后端
  const local = createLocalBashOperations();
  return {
    operations: {
      exec(command, cwd, options) {
        return local.exec(`source ~/.profile\n${command}`, cwd, options);
      }
    }
  };

  // 选项 3：完全替换 - 直接返回结果
  return { result: { output: "...", exitCode: 0, cancelled: false, truncated: false } };
});
```

### Input Events

#### input

在收到用户输入时触发，在检查扩展命令之后但在技能和模板扩展之前。事件看到原始输入文本，因此 `/skill:foo` 和 `/template` 尚未扩展。

**处理顺序：**
1. 扩展命令（`/cmd`）首先检查 - 如果找到，运行处理程序并跳过 input 事件
2. `input` 事件触发 - 可以拦截、转换或处理
3. 如果未处理：技能命令（`/skill:name`）扩展为技能内容
4. 如果未处理：提示模板（`/template`）扩展为模板内容
5. 智能体处理开始（`before_agent_start` 等）

```typescript
pi.on("input", async (event, ctx) => {
  // event.text - 原始输入（在技能/模板扩展之前）
  // event.images - 附加的图片（如果有）
  // event.source - "interactive"（键入）、"rpc"（API）或 "extension"（通过 sendUserMessage）
  // event.streamingBehavior - "steer" | "followUp" | undefined
  //   空闲时为 undefined，"steer" 用于流中断，
  //   "followUp" 用于在智能体完成后排队的消息

  // 转换：在扩展之前重写输入
  if (event.text.startsWith("?quick "))
    return { action: "transform", text: `简要回答：${event.text.slice(7)}` };

  // 处理：不使用 LLM 响应（扩展显示其自己的反馈）
  if (event.text === "ping") {
    ctx.ui.notify("pong", "info");
    return { action: "handled" };
  }

  // 按源路由：跳过扩展注入消息的处理
  if (event.source === "extension") return { action: "continue" };

  // 在扩展之前拦截技能命令
  if (event.text.startsWith("/skill:")) {
    // 可以转换、阻止或让其通过
  }

  return { action: "continue" };  // 默认：传递到扩展
});
```

**结果：**
- `continue` - 原样传递（如果处理程序不返回任何内容，则为默认值）
- `transform` - 修改文本/图片，然后继续到扩展
- `handled` - 完全跳过智能体（第一个返回此值的处理程序获胜）

转换跨处理程序链式运行。有关 `streamingBehavior` 感知的路由，参见 [input-transform.ts](../examples/extensions/input-transform.ts) 和 [input-transform-streaming.ts](../examples/extensions/input-transform-streaming.ts)。

## ExtensionContext

所有处理程序接收 `ctx: ExtensionContext`。

### ctx.ui

用于用户交互的 UI 方法。有关完整详细信息，参见 [Custom UI](#custom-ui)。

### ctx.mode

当前运行模式：`"tui"`、`"rpc"`、`"json"` 或 `"print"`。使用 `ctx.mode === "tui"` 来保护仅限终端的功能，如 `custom()`、组件工厂、终端输入和直接 TUI 渲染。

### ctx.hasUI

在 TUI 和 RPC 模式下为 `true`。在 print 模式（`-p`）和 JSON 模式下为 `false`。使用它来保护对话框方法（`select`、`confirm`、`input`、`editor`）和同时在 TUI 和 RPC 模式下工作的一次性方法（`notify`、`setStatus`、`setWidget`、`setTitle`、`setEditorText`）。在 RPC 模式下，一些仅限 TUI 的方法变为无操作或返回默认值（参见 [rpc.md](rpc.md#extension-ui-protocol)）。

### ctx.cwd

当前工作目录。

在构造项目本地配置路径时使用 `CONFIG_DIR_NAME` 而不是硬编码 `.pi`。重新品牌化的发行版可以使用不同的配置目录名称。

```typescript
import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const projectConfigPath = join(ctx.cwd, CONFIG_DIR_NAME, "my-extension.json");
    // ...
  });
}
```

### ctx.isProjectTrusted()

返回项目本地信任是否对当前会话上下文处于活动状态。这包括临时信任决策和 CLI 信任覆盖，而不仅仅是全局信任存储中的保存决策。

在读取项目本地扩展配置之前使用它，该配置应仅适用于受信任的项目。

### ctx.sessionManager

只读访问会话状态。有关完整的 SessionManager API 和条目类型，参见 [Session Format](session-format.md)。

对于 `tool_call`，此状态在处理程序运行之前通过当前助手消息同步。在并行工具执行模式下，它仍然不能保证包括来自同一助手消息的兄弟工具结果。

```typescript
ctx.sessionManager.getEntries()             // 所有条目
ctx.sessionManager.getBranch()              // 当前分支
ctx.sessionManager.buildContextEntries()    // 应用压缩的活动分支条目
ctx.sessionManager.getLeafId()              // 当前叶子条目 ID
```

### ctx.modelRegistry / ctx.model

访问模型和 API 密钥。

### ctx.signal

当前智能体中止信号，或者当没有智能体 turn 活动时为 `undefined`。

使用它进行由扩展处理程序启动的中止感知嵌套工作，例如：
- `fetch(..., { signal: ctx.signal })`
- 接受 `signal` 的模型调用
- 接受 `AbortSignal` 的文件或进程辅助方法

`ctx.signal` 通常在活动 turn 事件中定义，如 `tool_call`、`tool_result`、`message_update` 和 `turn_end`。
它通常在空闲或非 turn 上下文中为 `undefined`，如会话事件、扩展命令和 pi 空闲时触发的快捷键。

```typescript
pi.on("tool_result", async (event, ctx) => {
  const response = await fetch("https://example.com/api", {
    method: "POST",
    body: JSON.stringify(event),
    signal: ctx.signal,
  });

  const data = await response.json();
  return { details: data };
});
```

### ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()

控制流辅助方法。

### ctx.shutdown()

请求 pi 优雅关闭。

- **交互模式：** 推迟到智能体空闲时（处理完所有排队的引导和后续消息后）。
- **RPC 模式：** 推迟到下一个空闲状态（完成当前命令响应后，等待下一个命令时）。
- **Print 模式：** 无操作。所有提示处理完后进程自动退出。

在退出之前向所有扩展发出 `session_shutdown` 事件。在所有上下文中可用（事件处理程序、工具、命令、快捷键）。

```typescript
pi.on("tool_call", (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

### ctx.getContextUsage()

返回当前模型的活动上下文使用情况。在可用时使用最后的助手使用情况，然后估计尾部消息的 token。

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // ...
}
```

### ctx.compact()

触发上下文压缩，无需等待完成。使用 `onComplete` 和 `onError` 进行后续操作。

```typescript
ctx.compact({
  customInstructions: "关注最近的更改",
  onComplete: (result) => {
    ctx.ui.notify("上下文压缩完成", "info");
  },
  onError: (error) => {
    ctx.ui.notify(`上下文压缩失败：${error.message}`, "error");
  },
});
```

### ctx.getSystemPrompt()

返回 Pi 当前的系统提示字符串。

- 在 `before_agent_start` 期间，这反映当前 turn 到目前为止所做的链式系统提示更改。
- 它不包括后续的 `context` 消息修改。
- 它不包括 `before_provider_request` 负载重写。
- 如果后续加载的扩展在你的扩展之后运行，它们仍然可以更改最终发送的内容。

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`系统提示长度：${prompt.length}`);
});
```

## ExtensionCommandContext

命令处理程序接收 `ExtensionCommandContext`，它通过会话控制方法扩展 `ExtensionContext`。这些仅在命令中可用，因为它们如果在事件处理程序中调用可能会导致死锁。

### ctx.getSystemPromptOptions()

返回 Pi 当前用于构建系统提示的基本输入。

```typescript
const options = ctx.getSystemPromptOptions();
const contextPaths = options.contextFiles?.map((file) => file.path) ?? [];
```

它具有与 `before_agent_start` `event.systemPromptOptions` 相同的形状和可变性：自定义提示、活动工具、工具片段、提示指南、附加系统提示文本、cwd、加载的上下文文件和加载的技能。它可能包含完整的上下文文件内容，因此将其视为敏感扩展本地数据，避免通过命令列表、日志或自动完成元数据公开它。

这报告当前的基本提示输入。它不包括每个 turn 的 `before_agent_start` 链式系统提示更改、后续的 `context` 事件消息修改或 `before_provider_request` 负载重写。

### ctx.waitForIdle()

等待智能体完成流式传输：

```typescript
pi.registerCommand("my-cmd", {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // 智能体现在空闲，可以安全地修改会话
  },
});
```

### ctx.newSession(options?)

创建新会话：

```typescript
const parentSession = ctx.sessionManager.getSessionFile();
const kickoff = "在替换会话中继续";

const result = await ctx.newSession({
  parentSession,
  setup: async (sm) => {
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "来自之前会话的上下文..." }],
      timestamp: Date.now(),
    });
  },
  withSession: async (ctx) => {
    // 在此处仅使用替换会话的 ctx。
    await ctx.sendUserMessage(kickoff);
  },
});

if (result.cancelled) {
  // 扩展取消了新会话
}
```

选项：
- `parentSession`：在新会话头中记录的父母会话文件
- `setup`：在 `withSession` 运行之前修改新会话的 `SessionManager`
- `withSession`：针对新鲜替换会话上下文运行切换后工作。不要使用捕获的旧 `pi` / 命令 `ctx`；参见 [Session replacement lifecycle and footguns](#session-replacement-lifecycle-and-footguns)。

### ctx.fork(entryId, options?)

从特定条目分叉，创建新的会话文件：

```typescript
const result = await ctx.fork("entry-id-123", {
  withSession: async (ctx) => {
    // 在此处仅使用替换会话的 ctx。
    ctx.ui.notify("现在在分叉的会话中", "info");
  },
});
if (result.cancelled) {
  // 扩展取消了分叉
}

const cloneResult = await ctx.fork("entry-id-456", { position: "at" });
if (cloneResult.cancelled) {
  // 扩展取消了克隆
}
```

选项：
- `position`：`"before"`（默认）在选定的用户消息之前分叉，将该提示恢复到编辑器
- `position`：`"at"` 复制通过选定条目的活动路径，不恢复编辑器文本
- `withSession`：针对新鲜替换会话上下文运行切换后工作。不要使用捕获的旧 `pi` / 命令 `ctx`；参见 [Session replacement lifecycle and footguns](#session-replacement-lifecycle-and-footguns)。

### ctx.navigateTree(targetId, options?)

导航到会话树中的不同点：

```typescript
const result = await ctx.navigateTree("entry-id-456", {
  summarize: true,
  customInstructions: "关注错误处理更改",
  replaceInstructions: false, // true = 完全替换默认提示
  label: "review-checkpoint",
});
```

选项：
- `summarize`：是否生成被放弃分支的摘要
- `customInstructions`：摘要器的自定义指令
- `replaceInstructions`：如果为 true，`customInstructions` 替换默认提示而不是附加
- `label`：附加到分支摘要条目（或目标条目如果未摘要）的标签

### ctx.switchSession(sessionPath, options?)

切换到不同的会话文件：

```typescript
const result = await ctx.switchSession("/path/to/session.jsonl", {
  withSession: async (ctx) => {
    await ctx.sendUserMessage("在替换会话中恢复工作");
  },
});
if (result.cancelled) {
  // 扩展通过 session_before_switch 取消了切换
}
```

选项：
- `withSession`：针对新鲜替换会话上下文运行切换后工作。不要使用捕获的旧 `pi` / 命令 `ctx`；参见 [Session replacement lifecycle and footguns](#session-replacement-lifecycle-and-footguns)。

要发现可用会话，使用静态 `SessionManager.list()` 或 `SessionManager.listAll()` 方法：

```typescript
import { SessionManager } from "@earendil-works/pi-coding-agent";

pi.registerCommand("switch", {
  description: "切换到另一个会话",
  handler: async (args, ctx) => {
    const sessions = await SessionManager.list(ctx.cwd);
    if (sessions.length === 0) return;
    const choice = await ctx.ui.select(
      "选择会话：",
      sessions.map(s => s.file),
    );
    if (choice) {
      await ctx.switchSession(choice, {
        withSession: async (ctx) => {
          ctx.ui.notify("已切换会话", "info");
        },
      });
    }
  },
});
```

### Session replacement lifecycle and footguns

`withSession` 接收一个新鲜的 `ReplacedSessionContext`，它通过绑定到替换会话的异步 `sendMessage()` 和 `sendUserMessage()` 辅助方法扩展 `ExtensionCommandContext`。

生命周期和陷阱：
- `withSession` 仅在旧会话发出 `session_shutdown`、旧运行时被拆除、替换会话重新绑定且新扩展实例已接收 `session_start` 后运行。
- 回调仍在原始闭包中执行，而不是在新扩展实例内部。这意味着你的旧扩展实例可能已经在 `withSession` 开始前运行了其关闭清理。
- 捕获的旧 `pi` / 旧命令 `ctx` 会话绑定对象在替换后是陈旧的，如果使用会抛出。仅使用传递给 `withSession` 的 `ctx` 进行会话绑定工作。
- 之前提取的原始对象仍然是你的责任。例如，如果你在替换之前捕获 `const sm = ctx.sessionManager`，`sm` 仍然是旧的 `SessionManager` 对象。不要在替换后重用它。
- `withSession` 中的代码应假设你的 `session_shutdown` 处理程序无效的任何状态已经消失。仅捕获干净地跨越关闭的纯数据，如字符串、id 和序列化配置。

安全模式：

```typescript
pi.registerCommand("handoff", {
  handler: async (_args, ctx) => {
    const kickoff = "从替换会话继续";
    await ctx.newSession({
      withSession: async (ctx) => {
        await ctx.sendUserMessage(kickoff);
      },
    });
  },
});
```

不安全模式：

```typescript
pi.registerCommand("handoff", {
  handler: async (_args, ctx) => {
    const oldSessionManager = ctx.sessionManager;
    await ctx.newSession({
      withSession: async (_ctx) => {
        // 陈旧的旧对象：不要这样做
        oldSessionManager.getSessionFile();
        pi.sendUserMessage("错误");
      },
    });
  },
});
```

### ctx.reload()

运行与 `/reload` 相同的重载流程。

```typescript
pi.registerCommand("reload-runtime", {
  description: "重载扩展、技能、提示和主题",
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

重要行为：
- `await ctx.reload()` 为当前扩展运行时发出 `session_shutdown`
- 然后它重新加载资源并发出带有 `reason: "reload"` 的 `session_start` 和带有原因 `"reload"` 的 `resources_discover`
- 当前运行的命令处理程序仍在旧调用帧中继续
- `await ctx.reload()` 之后的代码仍然从预重载版本运行
- `await ctx.reload()` 之后的代码不能假设旧的内存扩展状态仍然有效
- 处理程序返回后，未来的命令/事件/工具调用使用新的扩展版本

为了可预测的行为，将该处理程序的重载视为终止（`await ctx.reload(); return;`）。

工具使用 `ExtensionContext` 运行，因此不能直接调用 `ctx.reload()`。使用命令作为重载入口点，然后暴露一个将那个命令作为后续用户消息排队的工具。

LLM 可调用的示例工具以触发自载：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("reload-runtime", {
    description: "重载扩展、技能、提示和主题",
    handler: async (_args, ctx) => {
      await ctx.reload();
      return;
    },
  });

  pi.registerTool({
    name: "reload_runtime",
    label: "重载运行时",
    description: "重载扩展、技能、提示和主题",
    parameters: Type.Object({}),
    async execute() {
      pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
      return {
        content: [{ type: "text", text: "已排队 /reload-runtime 作为后续命令。" }],
      };
    },
  });
}
```

## ExtensionAPI Methods

### pi.on(event, handler)

订阅事件。有关事件类型和返回值，参见 [Events](#events)。

### pi.registerTool(definition)

注册一个可由 LLM 调用的自定义工具。有关完整详细信息，参见 [Custom Tools](#custom-tools)。

`pi.registerTool()` 在扩展加载期间和启动后都可以工作。你可以在 `session_start`、命令处理程序或其他事件处理程序内部调用它。新工具在同一会话中立即刷新，因此它们出现在 `pi.getAllTools()` 中并可由 LLM 调用，无需 `/reload`。

使用 `pi.setActiveTools()` 在运行时启用或禁用工具（包括动态添加的工具）。

使用 `promptSnippet` 将自定义工具选择进入 `Available tools` 中的单行条目，并使用 `promptGuidelines` 在工具处于活动状态时将工具特定的要点附加到默认的 `Guidelines` 部分。

**重要：** `promptGuidelines` 要点以扁平方式附加到 `Guidelines` 部分，没有工具名称前缀。每个指南必须命名它引用的工具——避免使用“在此工具时使用...”，因为 LLM 无法判断“this”指的是哪个工具。改为编写“使用 my_tool 当...”。

有关完整示例，参见 [dynamic-tools.ts](../examples/extensions/dynamic-tools.ts)。

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "我的工具",
  description: "这个工具做什么",
  promptSnippet: "根据操作总结或转换文本",
  promptGuidelines: ["当用户要求总结之前生成的文本时使用 my_tool。"],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    // 可选的兼容性 shim。在 schema 验证之前运行。
    // 返回当前 schema 形状，例如折叠遗留字段
    // 到现代参数对象。
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 流式传输进度
    onUpdate?.({ content: [{ type: "text", text: "工作中..." }] });

    return {
      content: [{ type: "text", text: "完成" }],
      details: { result: "..." },
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

### pi.sendMessage(message, options?)

将自定义消息注入会话。自定义消息参与 LLM 上下文。对于不应发送给 LLM 的仅限 TUI 的持久内容，使用 [`pi.appendEntry()`](#piappendentrycustomtype-data) 和 [`pi.registerEntryRenderer()`](#piregisterentryrenderercustomtype-renderer)。

```typescript
pi.sendMessage({
  customType: "my-extension",
  content: "消息文本",
  display: true,
  details: { ... },
}, {
  triggerTurn: true,
  deliverAs: "steer",
});
```

**选项：**
- `deliverAs` - 交付模式：
  - `"steer"`（默认）- 在流式传输期间排队消息。在当前助手 turn 完成执行其工具调用后、在下一次 LLM 调用之前交付。
  - `"followUp"` - 等待智能体完成。仅在智能体没有更多工具调用时交付。
  - `"nextTurn"` - 排队到下一个用户提示。不中断或触发任何操作。
- `triggerTurn: true` - 如果智能体空闲，立即触发 LLM 响应。仅适用于 `"steer"` 和 `"followUp"` 模式（对 `"nextTurn"` 忽略）。

### pi.sendUserMessage(content, options?)

向智能体发送用户消息。与发送自定义消息的 `sendMessage()` 不同，这发送一个实际的用户消息，看起来像是由用户键入的。始终触发 turn。

```typescript
// 简单文本消息
pi.sendUserMessage("2+2 是多少？");

// 带内容数组（文本 + 图片）
pi.sendUserMessage([
  { type: "text", text: "描述这张图片：" },
  { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
]);

// 在流式传输期间 - 必须指定交付模式
pi.sendUserMessage("关注错误处理", { deliverAs: "steer" });
pi.sendUserMessage("然后总结", { deliverAs: "followUp" });
```

**选项：**
- `deliverAs` - 当智能体正在流式传输时必需：
  - `"steer"` - 排队消息以在当前助手 turn 完成执行其工具调用后交付
  - `"followUp"` - 等待智能体完成所有工具

当不流式传输时，消息立即发送并触发新 turn。当流式传输时没有 `deliverAs`，抛出错误。

有关完整示例，参见 [send-user-message.ts](../examples/extensions/send-user-message.ts)。

### pi.appendEntry(customType, data?)

持久化扩展数据。自定义条目不参与 LLM 上下文。在交互模式下，当与 `pi.registerEntryRenderer()` 配对时，它们也可以在聊天转录中渲染。

```typescript
pi.appendEntry("my-state", { count: 42 });
pi.appendEntry("status-card", { title: "已索引文件", count: 17 });

// 重载时恢复
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // 从 entry.data 重建
    }
  }
});
```

### pi.setSessionName(name)

设置会话显示名称（在会话选择器中显示而不是第一条消息）。

```typescript
pi.setSessionName("重构身份验证模块");
```

### pi.getSessionName()

获取当前会话名称（如果已设置）。

```typescript
const name = pi.getSessionName();
if (name) {
  console.log(`会话：${name}`);
}
```

### pi.setLabel(entryId, label)

设置或清除条目的标签。标签是用户定义的标记，用于书签和导航（在 `/tree` 选择器中显示）。

```typescript
// 设置标签
pi.setLabel(entryId, "重构前检查点");

// 清除标签
pi.setLabel(entryId, undefined);

// 通过 sessionManager 读取标签
const label = ctx.sessionManager.getLabel(entryId);
```

标签在会话中持久化并跨越重启生存。使用它们来标记对话树中的重要点（turn、检查点）。

### pi.registerCommand(name, options)

注册命令。

如果多个扩展注册相同的命令名称，pi 保留它们并分配数字调用后缀，按加载顺序，例如 `/review:1` 和 `/review:2`。

```typescript
pi.registerCommand("stats", {
  description: "显示会话统计信息",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} 个条目`, "info");
  }
});
```

可选：为 `/command ...` 添加参数自动完成：

```typescript
import type { AutocompleteItem } from "@earendil-works/pi-tui";

pi.registerCommand("deploy", {
  description: "部署到环境",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ["dev", "staging", "prod"];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`部署中：${args}`, "info");
  },
});
```

### pi.getCommands()

获取当前会话中可通过 `prompt` 调用的斜杠命令。包括扩展命令、提示模板和技能命令。
列表与 RPC `get_commands` 排序匹配：扩展优先，然后是模板，然后是技能。

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === "extension");
const userScoped = commands.filter((command) => command.sourceInfo.scope === "user");
```

每个条目具有以下形状：

```typescript
{
  name: string; // 可调用命令名称，不带前导斜杠。可能带有后缀如 "review:1"
  description?: string;
  source: "extension" | "prompt" | "skill";
  sourceInfo: {
    path: string;
    source: string;
    scope: "user" | "project" | "temporary";
    origin: "package" | "top-level";
    baseDir?: string;
  };
}
```

使用 `sourceInfo` 作为规范来源字段。不要从命令名称或随意路径解析推断所有权。

内置交互命令（如 `/model` 和 `/settings`）不包含在此处。它们仅在交互模式下处理，如果通过 `prompt` 发送则不会执行。

### pi.registerMessageRenderer(customType, renderer)

注册自定义消息的自定义 TUI 渲染器，使用你的 `customType`。自定义消息使用 `pi.sendMessage()` 创建并参与 LLM 上下文。参见 [Custom UI](#custom-ui)。

### pi.registerEntryRenderer(customType, renderer)

注册自定义条目的自定义 TUI 渲染器，使用你的 `customType`。自定义条目使用 `pi.appendEntry()` 创建，不参与 LLM 上下文。

```typescript
import { Box, Text } from "@earendil-works/pi-tui";

pi.registerEntryRenderer("status-card", (entry, { expanded }, theme) => {
  const data = entry.data as { title: string; count: number };
  const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
  box.addChild(new Text(`${theme.bold(data.title)}: ${data.count}`));
  if (expanded) {
    box.addChild(new Text(theme.fg("dim", JSON.stringify(data, null, 2))));
  }
  return box;
});

pi.appendEntry("status-card", { title: "已索引文件", count: 17 });
```

### pi.registerShortcut(shortcut, options)

注册键盘快捷键。有关快捷键格式和内置快捷键，参见 [keybindings.md](keybindings.md)。

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "切换计划模式",
  handler: async (ctx) => {
    ctx.ui.notify("已切换！");
  },
});
```

### pi.registerFlag(name, options)

注册 CLI 标志。

```typescript
pi.registerFlag("plan", {
  description: "在计划模式下启动",
  type: "boolean",
  default: false,
});

// 检查值
if (pi.getFlag("plan")) {
  // 计划模式启用
}
```

### pi.exec(command, args, options?)

执行 shell 命令。

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result.stdout, result.stderr, result.code, result.killed
```

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

管理活动工具。这适用于内置工具和动态注册的工具。`pi.getActiveTools()` 返回活动工具名称作为 `string[]`；`pi.getAllTools()` 返回所有配置工具的元数据。

```typescript
const active = pi.getActiveTools(); // ["read", "bash", ...]
const all = pi.getAllTools();
// all = [{
//   name: "read",
//   description: "读取文件内容...",
//   parameters: ...,
//   promptGuidelines: ["使用 read 检查文件而不是 cat 或 sed。"],
//   sourceInfo: { path: "<builtin:read>", source: "builtin", scope: "temporary", origin: "top-level" }
// }, ...]
const builtinTools = all.filter((t) => t.sourceInfo.source === "builtin");
const extensionTools = all.filter((t) => t.sourceInfo.source !== "builtin" && t.sourceInfo.source !== "sdk");
pi.setActiveTools([...new Set([...active, "my_custom_tool"])]); // 保留当前工具并启用 my_custom_tool
pi.setActiveTools(["read", "bash"]); // 切换到只读
```

`pi.getAllTools()` 返回 `name`、`description`、`parameters`、`promptGuidelines` 和 `sourceInfo`。

典型的 `sourceInfo.source` 值：
- `builtin` 用于内置工具
- `sdk` 用于通过 `createAgentSession({ customTools })` 传递的工具
- 扩展源元数据用于由扩展注册的工具

### pi.setModel(model)

设置当前模型。如果模型没有可用的 API 密钥，则返回 `false`。有关配置自定义模型，参见 [models.md](models.md)。

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("此模型没有 API 密钥", "error");
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

获取或设置思考级别。级别被限制为模型能力（非推理模型始终使用 "off"）。更改发出 `thinking_level_select`。

```typescript
const current = pi.getThinkingLevel();  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
pi.setThinkingLevel("high");
```

### pi.events

用于扩展之间通信的共享事件总线：

```typescript
pi.events.on("my:event", (data) => { ... });
pi.events.emit("my:event", { ... });
```

### pi.registerProvider(name, config)

动态注册或覆盖模型 provider。适用于代理、自定义端点或团队范围的模型配置。

在扩展工厂函数期间进行的调用被排队，并在运行时初始化后应用。在此之后进行的调用——例如来自用户设置流程后的命令处理程序——立即生效，无需 `/reload`。

如果你需要从远程端点发现模型，优先使用异步扩展工厂而不是将获取推迟到 `session_start`。pi 在继续启动之前等待工厂，因此注册的模型立即可用，包括对 `pi --list-models`。

```typescript
// 使用自定义模型注册新 provider
pi.registerProvider("my-proxy", {
  name: "我的代理",
  baseUrl: "https://proxy.example.com",
  apiKey: "$PROXY_API_KEY",  // 环境变量引用
  api: "anthropic-messages",
  models: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude 4 Sonnet (代理)",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// 覆盖现有 provider 的 baseUrl（保留所有模型）
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// 使用 OAuth 支持 /login 注册 provider
pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "企业 AI (SSO)",
    async login(callbacks) {
      // 自定义 OAuth 流程
      callbacks.onAuth({ url: "https://sso.corp.com/..." });
      const code = await callbacks.onPrompt({ message: "输入代码：" });
      return { refresh: code, access: code, expires: Date.now() + 3600000 };
    },
    async refreshToken(credentials) {
      // 刷新逻辑
      return credentials;
    },
    getApiKey(credentials) {
      return credentials.access;
    }
  }
});
```

**配置选项：**
- `name` - UI 中 provider 的显示名称，如 `/login`。
- `baseUrl` - API 端点 URL。定义模型时必需。
- `apiKey` - API 密钥字面量、环境变量插值（`$ENV_VAR` 或 `${ENV_VAR}`）或前导 `!command`。定义模型时必需（除非提供 `oauth`）。`$$` 转义 `$`，`$!` 转义字面量 `!` 而不触发命令执行。
- `api` - API 类型：`"anthropic-messages"`、`"openai-completions"`、`"openai-responses"` 等。
- `headers` - 要在请求中包含的自定义头部。
- `authHeader` - 如果为 true，自动添加 `Authorization: Bearer` 头部。
- `models` - 模型定义数组。如果提供，替换此 provider 的所有现有模型。模型定义可以设置 `baseUrl` 以覆盖该模型的 provider 端点。
- `oauth` - `/login` 支持的 OAuth provider 配置。提供时，provider 出现在登录菜单中。
- `streamSimple` - 非标准 API 的自定义流式传输实现。

有关高级主题：自定义流式 API、OAuth 详细信息、模型定义参考，参见 [custom-provider.md](custom-provider.md)。

### pi.unregisterProvider(name)

移除之前注册的 provider 及其模型。由 provider 覆盖的内置模型将被恢复。如果 provider 未注册，则无效果。

与 `registerProvider` 一样，这在初始加载阶段之后调用时立即生效，因此不需要 `/reload`。

```typescript
pi.registerCommand("my-setup-teardown", {
  description: "移除自定义代理 provider",
  handler: async (_args, _ctx) => {
    pi.unregisterProvider("my-proxy");
  },
});
```

## State Management

有状态的扩展应将其存储在工具结果 `details` 中以支持适当的分支：

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  // 从会话重建状态
  pi.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "my_tool") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: "my_tool",
    // ...
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push("新项目");
      return {
        content: [{ type: "text", text: "已添加" }],
        details: { items: [...items] },  // 存储以用于重建
      };
    },
  });
}
```

## Custom Tools

通过 `pi.registerTool()` 注册 LLM 可调用的工具。工具出现在系统提示中，并且可以有自定义渲染。

使用 `promptSnippet` 作为默认系统提示中 `Available tools` 部分的简短单行条目。如果省略，自定义工具将从该部分省略。

使用 `promptGuidelines` 向默认系统提示 `Guidelines` 部分添加工具特定的要点。这些要点仅在工具处于活动状态时包括（例如，在 `pi.setActiveTools([...])` 之后）。

**重要：** `promptGuidelines` 要点以扁平方式附加到 `Guidelines` 部分，没有工具名称前缀或分组。每个指南必须命名它引用的工具——避免使用“在此工具时使用...”，因为 LLM 无法判断“this”指的是哪个工具。改为编写“使用 my_tool 当...”。

注意：一些模型是傻瓜，在工具路径参数中包含 @ 前缀。内置工具在解析路径之前剥离前导 @。如果你的自定义工具接受路径，也要规范化前导 @。

如果你的自定义工具修改文件，使用 `withFileMutationQueue()` 使其参与与内置 `edit` 和 `write` 相同的每文件队列。这很重要，因为工具调用默认并行运行。没有队列，两个工具可以读取相同的旧文件内容，计算不同的更新，然后最后一个写入的覆盖另一个。

示例失败情况：你的自定义工具编辑 `foo.ts`，而内置 `edit` 也在同一助手 turn 中更改 `foo.ts`。如果你的工具不参与队列，两者都可以读取原始 `foo.ts`，应用单独的更改，并且其中一个更改丢失。

将真实的目标文件路径传递给 `withFileMutationQueue()`，而不是原始用户参数。首先将其解析为相对于 `ctx.cwd` 或你的工具工作目录的绝对路径。对于现有文件，辅助方法通过 `realpath()` 规范化，因此同一文件的符号链接别名共享一个队列。对于新文件，它回退到解析的绝对路径，因为还没有可以 `realpath()` 的东西。

在该目标路径上排队整个修改窗口。这包括读-改-写逻辑，而不仅仅是最终写入。

```typescript
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const absolutePath = resolve(ctx.cwd, params.path);

  return withFileMutationQueue(absolutePath, async () => {
    await mkdir(dirname(absolutePath), { recursive: true });
    const current = await readFile(absolutePath, "utf8");
    const next = current.replace(params.oldText, params.newText);
    await writeFile(absolutePath, next, "utf8");

    return {
      content: [{ type: "text", text: `已更新 ${params.path}` }],
      details: {},
    };
  });
}
```

### Tool Definition

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";

pi.registerTool({
  name: "my_tool",
  label: "我的工具",
  description: "这个工具做什么（显示给 LLM）",
  promptSnippet: "列出或添加项目待办列表中的项目",
  promptGuidelines: [
    "当用户要求任务列表时，使用 my_tool 进行待办计划而不是直接文件编辑。"
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // 使用 StringEnum 用于 Google 兼容性
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== "object") return args;
    const input = args as { action?: string; oldAction?: string };
    if (typeof input.oldAction === "string" && input.action === undefined) {
      return { ...input, action: input.oldAction };
    }
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 检查取消
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "已取消" }] };
    }

    // 流式传输进度更新
    onUpdate?.({
      content: [{ type: "text", text: "工作中..." }],
      details: { progress: 50 },
    });

    // 通过 pi.exec 运行命令（从扩展闭包捕获）
    const result = await pi.exec("some-command", [], { signal });

    // 返回结果
    return {
      content: [{ type: "text", text: "完成" }],  // 发送给 LLM
      details: { data: result },                   // 用于渲染和状态
      // 可选：当批次中的每个最终化工具结果也返回 terminate: true 时，在此工具批次后跳过自动后续 LLM 调用。
      terminate: true,
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

**信号错误：** 要将工具执行标记为失败（在结果上设置 `isError: true` 并向 LLM 报告），从 `execute` 抛出错误。无论你在返回对象中包含什么属性，返回值永远不会设置错误标志。

**早期终止：** 从 `execute()` 返回 `terminate: true` 以提示在当前工具批次后应跳过自动后续 LLM 调用。这仅在该批次中的每个最终化工具结果都在终止时生效。参见 [examples/extensions/structured-output.ts](../examples/extensions/structured-output.ts) 的示例，其中智能体在最终结构化输出工具调用时结束。

```typescript
// 正确：抛出以信号错误
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`无效输入：${params.input}`);
  }
  return { content: [{ type: "text", text: "OK" }], details: {} };
}
```

**重要：** 使用来自 `@earendil-works/pi-ai` 的 `StringEnum` 用于字符串枚举。`Type.Union`/`Type.Literal` 不适用于 Google 的 API。

**参数准备：** `prepareArguments(args)` 是可选的。如果定义，它在 schema 验证和 `execute()` 之前运行。使用它在 pi 恢复其存储的工具调用参数不再匹配当前 schema 的旧会话时模拟旧接受的输入形状。返回你要针对 `parameters` 验证的对象。保持公共 schema 严格。不要仅仅为了使旧恢复的会话工作而向 `parameters` 添加已弃用的兼容性字段。

示例：旧会话可能包含带有顶级 `oldText` 和 `newText` 的 `edit` 工具调用，而当前 schema 仅接受 `edits: [{ oldText, newText }]`。

```typescript
pi.registerTool({
  name: "edit",
  label: "编辑",
  description: "使用精确文本替换编辑单个文件",
  parameters: Type.Object({
    path: Type.String(),
    edits: Type.Array(
      Type.Object({
        oldText: Type.String(),
        newText: Type.String(),
      }),
    ),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== "object") return args;

    const input = args as {
      path?: string;
      edits?: Array<{ oldText: string; newText: string }>;
      oldText?: unknown;
      newText?: unknown;
    };

    if (typeof input.oldText !== "string" || typeof input.newText !== "string") {
      return args;
    }

    return {
      ...input,
      edits: [...(input.edits ?? []), { oldText: input.oldText, newText: input.newText }],
    };
  },
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // params 现在匹配当前 schema
    return {
      content: [{ type: "text", text: `应用 ${params.edits.length} 个编辑块` }],
      details: {},
    };
  },
});
```

### Overriding Built-in Tools

扩展可以通过注册同名工具来覆盖内置工具（`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`）。交互模式在此时显示警告。

```bash
# 扩展的 read 工具替换内置 read
pi -e ./tool-override.ts
```

或者，使用 `--no-builtin-tools` 在不启用任何内置工具的情况下启动，同时保持扩展工具启用：
```bash
# 没有内置工具，只有扩展工具
pi --no-builtin-tools -e ./my-extension.ts
```

有关覆盖 `read` 带日志和访问控制的完整示例，参见 [examples/extensions/tool-override.ts](../examples/extensions/tool-override.ts)。

**渲染：** 内置渲染器继承按槽位解析。执行覆盖和渲染覆盖是独立的。如果你的覆盖省略 `renderCall`，则使用内置 `renderCall`。如果你的覆盖省略 `renderResult`，则使用内置 `renderResult`。如果你的覆盖省略两者，则自动使用内置渲染器（语法高亮、差异等）。这让你可以包装内置工具用于日志或访问控制而无需重新实现 UI。

**提示元数据：** `promptSnippet` 和 `promptGuidelines` 不从内置工具继承。如果你的覆盖应保持那些提示指令，请在覆盖上显式定义它们。

**你的实现必须匹配确切的结果形状**，包括 `details` 类型。UI 和会话逻辑依赖这些形状进行渲染和状态跟踪。

内置工具实现：
- [read.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/read.ts) - `ReadToolDetails`
- [bash.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/bash.ts) - `BashToolDetails`
- [edit.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/edit.ts)
- [write.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/write.ts)
- [grep.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/grep.ts) - `GrepToolDetails`
- [find.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/find.ts) - `FindToolDetails`
- [ls.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/ls.ts) - `LsToolDetails`

### Remote Execution

内置工具支持可插拔操作以委托给远程系统（SSH、容器等）：

```typescript
import { createReadTool, createBashTool, type ReadOperations } from "@earendil-works/pi-coding-agent";

// 使用自定义操作创建工具
const remoteRead = createReadTool(cwd, {
  operations: {
    readFile: (path) => sshExec(remote, `cat ${path}`),
    access: (path) => sshExec(remote, `test -r ${path}`).then(() => {}),
  }
});

// 注册，在执行时检查标志
pi.registerTool({
  ...remoteRead,
  async execute(id, params, signal, onUpdate, _ctx) {
    const ssh = getSshConfig();
    if (ssh) {
      const tool = createReadTool(cwd, { operations: createRemoteOps(ssh) });
      return tool.execute(id, params, signal, onUpdate);
    }
    return localRead.execute(id, params, signal, onUpdate);
  },
});
```

**操作接口：** `ReadOperations`、`WriteOperations`、`EditOperations`、`BashOperations`、`LsOperations`、`GrepOperations`、`FindOperations`

对于 `user_bash`，扩展可以通过 `createLocalBashOperations()` 重用 pi 的本地 shell 后端，而不是重新实现本地进程生成、shell 解析和进程树终止。

bash 工具还支持 spawn 钩子以在执行前调整命令、cwd 或 env：

```typescript
import { createBashTool } from "@earendil-works/pi-coding-agent";

const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: "1" },
  }),
});
```

有关带有 `--ssh` 标志的完整 SSH 示例，参见 [examples/extensions/ssh.ts](../examples/extensions/ssh.ts)。

### Output Truncation

**工具必须截断其输出**以避免压倒 LLM 上下文。大输出可能导致：
- 上下文溢出错误（提示太长）
- 上下文压缩失败
- 模型性能下降

内置限制为 **50KB**（~10k token）和 **2000 行**，以先达到的为准。使用导出的截断辅助方法：

```typescript
import {
  truncateHead,      // 保留前 N 行/字节（适用于文件读取、搜索结果）
  truncateTail,      // 保留最后 N 行/字节（适用于日志、命令输出）
  truncateLine,      // 将单行截断为 maxBytes 并省略
  formatSize,        // 人类可读大小（例如 "50KB", "1.5MB"）
  DEFAULT_MAX_BYTES, // 50KB
  DEFAULT_MAX_LINES, // 2000
} from "@earendil-works/pi-coding-agent";

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const output = await runCommand();

  // 应用截断
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let result = truncation.content;

  if (truncation.truncated) {
    // 将完整输出写入临时文件
    const tempFile = writeTempFile(output);

    // 告知 LLM 在哪里找到完整输出
    result += `\n\n[输出截断：${truncation.outputLines} of ${truncation.totalLines} 行`;
    result += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)})。`;
    result += ` 完整输出保存至：${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

**关键点：**
- 对于开头重要的内容使用 `truncateHead`（搜索结果、文件读取）
- 对于结尾重要的内容使用 `truncateTail`（日志、命令输出）
- 始终在输出被截断时告知 LLM 在哪里找到完整版本
- 在工具描述中记录截断限制

有关使用适当截断包装 `rg`（ripgrep）的完整示例，参见 [examples/extensions/truncated-tool.ts](../examples/extensions/truncated-tool.ts)。

### Multiple Tools

一个扩展可以注册具有共享状态的多个工具：

```typescript
export default function (pi: ExtensionAPI) {
  let connection = null;

  pi.registerTool({ name: "db_connect", ... });
  pi.registerTool({ name: "db_query", ... });
  pi.registerTool({ name: "db_close", ... });

  pi.on("session_shutdown", async () => {
    connection?.close();
  });
}
```

### Custom Rendering

工具可以提供 `renderCall` 和 `renderResult` 用于自定义 TUI 显示。有关完整的组件 API，参见 [tui.md](tui.md)，有关工具行如何组合，参见 [tool-execution.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts)。

默认情况下，工具输出包装在 `Box` 中，该框处理填充和背景。定义的 `renderCall` 或 `renderResult` 必须返回 `Component`。如果未定义槽位渲染器，`tool-execution.ts` 使用该槽位的后备渲染。

当工具应渲染自己的 shell 而不是使用默认 `Box` 时，设置 `renderShell: "self"`。这对于需要完全控制框架或背景行为的工具有用，例如大型预览必须在工具稳定后在视觉上保持稳定。

```typescript
pi.registerTool({
  name: "my_tool",
  label: "我的工具",
  description: "自定义 shell 示例",
  parameters: Type.Object({}),
  renderShell: "self",
  async execute() {
    return { content: [{ type: "text", text: "ok" }], details: undefined };
  },
  renderCall(args, theme, context) {
    return new Text(theme.fg("accent", "我的自定义 shell"), 0, 0);
  },
});
```

`renderCall` 和 `renderResult` 各接收一个带有以下内容的 `context` 对象：
- `args` - 当前工具调用参数
- `state` - `renderCall` 和 `renderResult` 之间共享的行本地状态
- `lastComponent` - 该槽位之前返回的组件（如果有）
- `invalidate()` - 请求重新渲染此工具行
- `toolCallId`, `cwd`, `executionStarted`, `argsComplete`, `isPartial`, `expanded`, `showImages`, `isError`

使用 `context.state` 进行跨槽位共享状态。当你想在渲染之间重用和修改同一组件时，在返回的组件实例上保留槽位本地缓存。

#### renderCall

渲染工具调用或标题：

```typescript
import { Text } from "@earendil-works/pi-tui";

renderCall(args, theme, context) {
  const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
  let content = theme.fg("toolTitle", theme.bold("my_tool "));
  content += theme.fg("muted", args.action);
  if (args.text) {
    content += " " + theme.fg("dim", `"${args.text}"`);
  }
  text.setText(content);
  return text;
}
```

#### renderResult

渲染工具结果或输出：

```typescript
renderResult(result, { expanded, isPartial }, theme, context) {
  if (isPartial) {
    return new Text(theme.fg("warning", "处理中..."), 0, 0);
  }

  if (result.details?.error) {
    return new Text(theme.fg("error", `错误：${result.details.error}`), 0, 0);
  }

  let text = theme.fg("success", "✓ 完成");
  if (expanded && result.details?.items) {
    for (const item of result.details.items) {
      text += "\n  " + theme.fg("dim", item);
    }
  }
  return new Text(text, 0, 0);
}
```

如果槽位故意没有可见内容，返回空 `Component` 如空 `Container`。

#### Keybinding Hints

使用 `keyHint()` 显示尊重活动快捷键配置的快捷键提示：

```typescript
import { keyHint } from "@earendil-works/pi-coding-agent";

renderResult(result, { expanded }, theme, context) {
  let text = theme.fg("success", "✓ 完成");
  if (!expanded) {
    text += ` (${keyHint("app.tools.expand", "展开")})`;
  }
  return new Text(text, 0, 0);
}
```

可用函数：
- `keyHint(keybinding, description)` - 格式化配置的快捷键 ID，如 `"app.tools.expand"` 或 `"tui.select.confirm"`
- `keyText(keybinding)` - 返回快捷键 ID 的原始配置键文本
- `rawKeyHint(key, description)` - 格式化原始键字符串

使用命名空间快捷键 ID：
- 编码代理 ID 使用 `app.*` 命名空间，例如 `app.tools.expand`、`app.editor.external`、`app.session.rename`
- 共享 TUI ID 使用 `tui.*` 命名空间，例如 `tui.select.confirm`、`tui.select.cancel`、`tui.input.tab`

有关快捷键 ID 和默认值的详尽列表，参见 [keybindings.md](keybindings.md)。`keybindings.json` 使用那些相同的命名空间 ID。

自定义编辑器和 `ctx.ui.custom()` 组件接收 `keybindings: KeybindingsManager` 作为注入参数。它们应直接使用那个注入的管理器，而不是调用 `getKeybindings()` 或 `setKeybindings()`。

#### Best Practices

- 使用带填充 `(0, 0)` 的 `Text`。默认 Box 处理填充。
- 使用 `\n` 用于多行内容。
- 处理 `isPartial` 用于流式传输进度。
- 支持 `expanded` 用于按需详细信息。
- 保持默认视图紧凑。
- 在 `renderResult` 中读取 `context.args` 而不是将参数复制到 `context.state`。
- 仅使用 `context.state` 用于必须在调用和结果槽位之间共享的数据。
- 当同一组件实例可以就地更新时，重用 `context.lastComponent`。
- 仅当默认盒式 shell 碍事时使用 `renderShell: "self"`。在自 shell 模式下，工具负责自己的框架、填充和背景。

#### Fallback

如果未定义槽位渲染器或抛出：
- `renderCall`：显示工具名称
- `renderResult`：显示来自 `content` 的原始文本

## Custom UI

扩展可以通过 `ctx.ui` 方法与用户交互并自定义消息/工具的渲染方式。

**对于自定义组件，参见 [tui.md](tui.md)**，其中包含以下内容的复制粘贴模式：
- 选择对话框（SelectList）
- 带取消的异步操作（BorderedLoader）
- 设置切换（SettingsList）
- 状态指示器（setStatus）
- 流式传输期间的工作消息、可见性和指示器（`setWorkingMessage`、`setWorkingVisible`、`setWorkingIndicator`）
- 编辑器上方/下方的组件（setWidget）
- 叠加在内置斜杠/路径完成之上的自动完成提供程序（addAutocompleteProvider）
- 自定义页脚（setFooter）

### Dialogs

```typescript
// 从选项中选择
const choice = await ctx.ui.select("选择一个：", ["A", "B", "C"]);

// 确认对话框
const ok = await ctx.ui.confirm("删除？", "这不能撤销");

// 文本输入
const name = await ctx.ui.input("名称：", "占位符");

// 多行编辑器
const text = await ctx.ui.editor("编辑：", "预填充文本");

// 通知（非阻塞）
ctx.ui.notify("完成！", "info");  // "info" | "warning" | "error"
```

#### Timed Dialogs with Countdown

对话框支持 `timeout` 选项，该选项自动关闭并显示实时倒计时：

```typescript
// 对话框显示 "标题 (5s)" → "标题 (4s)" → ... → 在 0 时自动关闭
const confirmed = await ctx.ui.confirm(
  "定时确认",
  "此对话框将在 5 秒后自动取消。确认？",
  { timeout: 5000 }
);

if (confirmed) {
  // 用户确认
} else {
  // 用户取消或超时
}
```

**超时时的返回值：**
- `select()` 返回 `undefined`
- `confirm()` 返回 `false`
- `input()` 返回 `undefined`

#### Manual Dismissal with AbortSignal

对于更多控制（例如，区分超时和用户取消），使用 `AbortSignal`：

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const confirmed = await ctx.ui.confirm(
  "定时确认",
  "此对话框将在 5 秒后自动取消。确认？",
  { signal: controller.signal }
);

clearTimeout(timeoutId);

if (confirmed) {
  // 用户确认
} else if (controller.signal.aborted) {
  // 对话框超时
} else {
  // 用户取消（按 Escape 或选择“否”）
}
```

有关完整示例，参见 [examples/extensions/timed-confirm.ts](../examples/extensions/timed-confirm.ts)。

### Widgets, Status, and Footer

```typescript
// 页脚中的状态（清除之前持久化）
ctx.ui.setStatus("my-ext", "处理中...");
ctx.ui.setStatus("my-ext", undefined);  // 清除

// 工作加载器（流式传输期间显示）
ctx.ui.setWorkingMessage("深度思考中...");
ctx.ui.setWorkingMessage();  // 恢复默认
ctx.ui.setWorkingVisible(false);  // 完全隐藏内置工作加载器行
ctx.ui.setWorkingVisible(true);   // 显示内置工作加载器行

// 工作指示器（流式传输期间显示）
ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("accent", "●")] });  // 静态点
ctx.ui.setWorkingIndicator({
  frames: [
    ctx.ui.theme.fg("dim", "·"),
    ctx.ui.theme.fg("muted", "•"),
    ctx.ui.theme.fg("accent", "●"),
    ctx.ui.theme.fg("muted", "•"),
  ],
  intervalMs: 120,
});
ctx.ui.setWorkingIndicator({ frames: [] });  // 隐藏指示器
ctx.ui.setWorkingIndicator();  // 恢复默认旋转器

// 编辑器上方的组件（默认）
ctx.ui.setWidget("my-widget", ["第 1 行", "第 2 行"]);
// 编辑器下方的组件
ctx.ui.setWidget("my-widget", ["第 1 行", "第 2 行"], { placement: "belowEditor" });
ctx.ui.setWidget("my-widget", (tui, theme) => new Text(theme.fg("accent", "自定义"), 0, 0));
ctx.ui.setWidget("my-widget", undefined);  // 清除

// 自定义页脚（完全替换内置页脚）
ctx.ui.setFooter((tui, theme) => ({
  render(width) { return [theme.fg("dim", "自定义页脚")]; },
  invalidate() {},
}));
ctx.ui.setFooter(undefined);  // 恢复内置页脚

// 终端标题
ctx.ui.setTitle("pi - my-project");

// 编辑器文本
ctx.ui.setEditorText("预填充文本");
const current = ctx.ui.getEditorText();

// 粘贴到编辑器（触发粘贴处理，包括大内容的折叠）
ctx.ui.pasteToEditor("粘贴的内容");

// 在内置提供程序之上堆叠自定义自动完成行为
ctx.ui.addAutocompleteProvider((current) => ({
  triggerCharacters: ["#"],
  async getSuggestions(lines, line, col, options) {
    const beforeCursor = (lines[line] ?? "").slice(0, col);
    const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
    if (!match) {
      return current.getSuggestions(lines, line, col, options);
    }

    return {
      prefix: `#${match[1] ?? ""}`,
      items: [{ value: "#2983", label: "#2983", description: "自动完成的扩展 API" }],
    };
  },
  applyCompletion(lines, line, col, item, prefix) {
    return current.applyCompletion(lines, line, col, item, prefix);
  },
  shouldTriggerFileCompletion(lines, line, col) {
    return current.shouldTriggerFileCompletion?.(lines, line, col) ?? true;
  },
}));

// 工具输出扩展
const wasExpanded = ctx.ui.getToolsExpanded();
ctx.ui.setToolsExpanded(true);
ctx.ui.setToolsExpanded(wasExpanded);

// 自定义编辑器（vim 模式、emacs 模式等）
ctx.ui.setEditorComponent((tui, theme, keybindings) => new VimEditor(tui, theme, keybindings));
const currentEditor = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new WrappedEditor(tui, theme, keybindings, currentEditor?.(tui, theme, keybindings))
);
ctx.ui.setEditorComponent(undefined);  // 恢复默认编辑器

// 主题管理（参见 themes.md 了解创建主题）
const themes = ctx.ui.getAllThemes();  // [{ name: "dark", path: "/..." | undefined }, ...]
const lightTheme = ctx.ui.getTheme("light");  // 加载而不切换
const result = ctx.ui.setTheme("light");  // 按名称切换
if (!result.success) {
  ctx.ui.notify(`失败：${result.error}`, "error");
}
ctx.ui.setTheme(lightTheme!);  // 或按 Theme 对象切换
ctx.ui.theme.fg("accent", "styled text");  // 访问当前主题
```

自定义工作指示器帧按原样渲染。如果你想要颜色，请自行将它们添加到帧字符串中，例如使用 `ctx.ui.theme.fg(...)`。

### Autocomplete Providers

使用 `ctx.ui.addAutocompleteProvider()` 在内置斜杠命令和路径提供程序之上堆叠自定义自动完成逻辑。设置 `triggerCharacters` 用于自定义自然触发器，如 `$`。

典型模式：

- 检查光标前的文本
- 当你的扩展特定语法匹配时返回你自己的建议
- 否则委托给 `current.getSuggestions(...)`
- 委托 `applyCompletion(...)` 除非你需要自定义插入行为

```typescript
pi.on("session_start", (_event, ctx) => {
  ctx.ui.addAutocompleteProvider((current) => ({
    triggerCharacters: ["#"],
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const line = lines[cursorLine] ?? "";
      const beforeCursor = line.slice(0, cursorCol);
      const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
      if (!match) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      return {
        prefix: `#${match[1] ?? ""}`,
        items: [
          { value: "#2983", label: "#2983", description: "注册自定义 @ 自动完成提供程序的扩展 API" },
          { value: "#2753", label: "#2753", description: "重载陈旧的资源设置" },
        ],
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  }));
});
```

有关完整示例，参见 [github-issue-autocomplete.ts](../examples/extensions/github-issue-autocomplete.ts)，该示例使用 `gh issue list` 预加载最新的打开 GitHub 问题并在本地过滤它们以用于快速 `#...` 完成。它需要 GitHub CLI（`gh`）和 GitHub 存储库签出。

### Custom Components

对于复杂 UI，使用 `ctx.ui.custom()`。这将用你的组件临时替换编辑器，直到调用 `done()`：

```typescript
import { Text, Component } from "@earendil-works/pi-tui";

const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("按 Enter 确认，按 Escape 取消", 1, 1);

  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };

  return text;
});

if (result) {
  // 用户按了 Enter
}
```

回调接收：
- `tui` - TUI 实例（用于屏幕尺寸、焦点管理）
- `theme` - 当前主题用于样式
- `keybindings` - 应用快捷键管理器（用于检查快捷键）
- `done(value)` - 关闭组件并返回值的调用

有关完整的组件 API，参见 [tui.md](tui.md)。

#### Overlay Mode (Experimental)

传递 `{ overlay: true }` 以将组件渲染为现有内容之上的浮动模态，而不清除屏幕：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  { overlay: true }
);
```

对于高级定位（锚点、边距、百分比、响应式可见性），传递 `overlayOptions`。使用 `onHandle` 以编程方式控制焦点或可见性：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  {
    overlay: true,
    overlayOptions: { anchor: "top-right", width: "50%", margin: 2 },
    onHandle: (handle) => {
      handle.focus(); // 聚焦此覆盖层并将其带到视觉前方
      // handle.unfocus({ target: editorComponent }); // 将输入释放到特定组件
      // handle.setHidden(true/false); // 切换可见性
      // handle.hide(); // 永久移除
    }
  }
);
```

聚焦的可见覆盖层可以在临时非覆盖自定义 UI 关闭后收回输入。如果你故意希望另一个组件在覆盖层保持可见时保持输入，调用 `handle.unfocus({ target })`。传递 `{ target: null }` 释放覆盖层而不聚焦另一个组件。

有关完整的 `OverlayOptions` 和 `OverlayHandle` API 和示例，参见 [tui.md](tui.md) 和 [overlay-qa-tests.ts](../examples/extensions/overlay-qa-tests.ts)。

### Custom Editor

用自定义实现替换主输入编辑器（vim 模式、emacs 模式等）：

```typescript
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

class VimEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";

  handleInput(data: string): void {
    if (matchesKey(data, "escape") && this.mode === "insert") {
      this.mode = "normal";
      return;
    }
    if (this.mode === "normal" && data === "i") {
      this.mode = "insert";
      return;
    }
    super.handleInput(data);  // 应用快捷键 + 文本编辑
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((_tui, theme, keybindings) =>
      new VimEditor(theme, keybindings)
    );
  });
}
```

**关键点：**
- 扩展 `CustomEditor`（不是基础 `Editor`）以获得应用快捷键（Escape 中止、ctrl+d、模型切换）
- 调用 `super.handleInput(data)` 用于你未处理的键
- 工厂从应用接收 `theme` 和 `keybindings`
- 在 `setEditorComponent()` 之前使用 `ctx.ui.getEditorComponent()` 包装之前配置的自定义编辑器
- 传递 `undefined` 以恢复默认：`ctx.ui.setEditorComponent(undefined)`

要与已经替换编辑器的另一个扩展组合，在设置你自己的之前捕获前一个工厂：

```typescript
const previous = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new MyEditor(tui, theme, keybindings, { base: previous?.(tui, theme, keybindings) })
);
```

有关带模式指示器的完整示例，参见 [tui.md](tui.md) 模式 7。

### Message and Entry Rendering

注册自定义渲染器用于带有你的 `customType` 的消息。使用消息渲染器用于应参与 LLM 上下文的内容：

```typescript
import { Text } from "@earendil-works/pi-tui";

pi.registerMessageRenderer("my-extension", (message, options, theme) => {
  const { expanded } = options;
  let text = theme.fg("accent", `[${message.customType}] `);
  text += message.content;

  if (expanded && message.details) {
    text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
  }

  return new Text(text, 0, 0);
});
```

消息通过 `pi.sendMessage()` 发送：

```typescript
pi.sendMessage({
  customType: "my-extension",  // 匹配 registerMessageRenderer
  content: "状态更新",
  display: true,               // 在 TUI 中显示
  details: { ... },            // 在渲染器中可用
});
```

对于不应发送给 LLM 的仅限 TUI 的内容，渲染自定义条目：

```typescript
pi.registerEntryRenderer("my-card", (entry, options, theme) => {
  return new Text(theme.fg("accent", JSON.stringify(entry.data)));
});

pi.appendEntry("my-card", { status: "done" });
```

### Theme Colors

所有渲染函数接收一个 `theme` 对象。有关创建自定义主题和完整调色板，参见 [themes.md](themes.md)。

```typescript
// 前景色
theme.fg("toolTitle", text)   // 工具名称
theme.fg("accent", text)      // 高亮
theme.fg("success", text)     // 成功（绿色）
theme.fg("error", text)       // 错误（红色）
theme.fg("warning", text)     // 警告（黄色）
theme.fg("muted", text)       // 次要文本
theme.fg("dim", text)         // 三级文本

// 文本样式
theme.bold(text)
theme.italic(text)
theme.strikethrough(text)
```

用于自定义工具渲染器中的语法高亮：

```typescript
import { highlightCode, getLanguageFromPath } from "@earendil-works/pi-coding-agent";

// 使用显式语言高亮代码
const highlighted = highlightCode("const x = 1;", "typescript", theme);

// 从文件路径自动检测语言
const lang = getLanguageFromPath("/path/to/file.rs");  // "rust"
const highlighted = highlightCode(code, lang, theme);
```

## Error Handling

- 扩展错误已记录，智能体继续
- `tool_call` 错误阻止工具（故障安全）
- 工具 `execute` 错误必须通过抛出信号；抛出的错误被捕获，以 `isError: true` 报告给 LLM，执行继续

## Mode Behavior

| 模式 | `ctx.mode` | `ctx.hasUI` | 备注 |
|------|------------|-------------|-------|
| 交互 | `"tui"` | `true` | 带有终端渲染的完整 TUI |
| RPC（`--mode rpc`） | `"rpc"` | `true` | 通过 JSON 协议的对话框和通知；`custom()` 返回 `undefined`。参见 [rpc.md](rpc.md) |
| JSON（`--mode json`） | `"json"` | `false` | 事件流到 stdout；UI 方法为无操作 |
| Print（`-p`） | `"print"` | `false` | 扩展运行但不能提示 |

在使用仅限 TUI 的功能（`custom()`、组件工厂、终端输入）之前使用 `ctx.mode === "tui"`。在使用同时在 TUI 和 RPC 模式下工作的对话框和通知方法之前使用 `ctx.hasUI`。

## Examples Reference

[examples/extensions/](../examples/extensions/) 中的所有示例。

| 示例 | 描述 | 关键 API |
|---------|-------------|----------|
| **工具** |||
| `hello.ts` | 最小工具注册 | `registerTool` |
| `question.ts` | 带用户交互的工具 | `registerTool`, `ui.select` |
| `questionnaire.ts` | 多步骤向导工具 | `registerTool`, `ui.custom` |
| `todo.ts` | 带持久化的有状态工具 | `registerTool`, `appendEntry`, `renderResult`, 会话事件 |
| `dynamic-tools.ts` | 启动后和命令期间注册工具 | `registerTool`, `session_start`, `registerCommand` |
| `structured-output.ts` | 带有 `terminate: true` 的最终结构化输出工具 | `registerTool`, 终止工具结果 |
| `truncated-tool.ts` | 输出截断示例 | `registerTool`, `truncateHead` |
| `tool-override.ts` | 覆盖内置 read 工具 | `registerTool`（与内置同名） |
| **命令** |||
| `pirate.ts` | 每 turn 修改系统提示 | `registerCommand`, `before_agent_start` |
| `summarize.ts` | 对话摘要命令 | `registerCommand`, `ui.custom` |
| `handoff.ts` | 跨 provider 模型移交 | `registerCommand`, `ui.editor`, `ui.custom` |
| `qna.ts` | 带自定义 UI 的问答 | `registerCommand`, `ui.custom`, `setEditorText` |
| `send-user-message.ts` | 注入用户消息 | `registerCommand`, `sendUserMessage` |
| `reload-runtime.ts` | 重载命令和 LLM 工具移交 | `registerCommand`, `ctx.reload()`, `sendUserMessage` |
| `shutdown-command.ts` | 优雅关闭命令 | `registerCommand`, `shutdown()` |
| **事件和门禁** |||
| `permission-gate.ts` | 阻止危险命令 | `on("tool_call")`, `ui.confirm` |
| `project-trust.ts` | 从用户/全局或 CLI 扩展决定或推迟项目信任 | `on("project_trust")`, 信任 UI, 必需信任结果 |
| `protected-paths.ts` | 阻止写入特定路径 | `on("tool_call")` |
| `confirm-destructive.ts` | 确认会话更改 | `on("session_before_switch")`, `on("session_before_fork")` |
| `dirty-repo-guard.ts` | 警告脏 git 仓库 | `on("session_before_*")`, `exec` |
| `input-transform.ts` | 转换用户输入 | `on("input")` |
| `input-transform-streaming.ts` | 流式感知输入转换 | `on("input")`, `streamingBehavior` |
| `model-status.ts` | 响应模型更改 | `on("model_select")`, `setStatus` |
| `provider-payload.ts` | 检查负载和 provider 响应头部 | `on("before_provider_request")`, `on("after_provider_response")` |
| `system-prompt-header.ts` | 显示系统提示信息 | `on("agent_start")`, `getSystemPrompt` |
| `claude-rules.ts` | 从文件加载规则 | `on("session_start")`, `on("before_agent_start")` |
| `prompt-customizer.ts` | 使用 `systemPromptOptions` 添加上下文感知工具指导 | `on("before_agent_start")`, `BuildSystemPromptOptions` |
| `file-trigger.ts` | 文件监听器触发消息 | `sendMessage` |
| **上下文压缩与会话** |||
| `custom-compaction.ts` | 自定义上下文压缩摘要 | `on("session_before_compact")` |
| `trigger-compact.ts` | 手动触发上下文压缩 | `compact()` |
| `git-checkpoint.ts` | 在 turn 上 git stash | `on("turn_start")`, `on("session_before_fork")`, `exec` |
| `git-merge-and-resolve.ts` | 获取、合并和解决冲突 | `on("agent_end")`, `exec`, `sendUserMessage` |
| `auto-commit-on-exit.ts` | 关闭时提交 | `on("session_shutdown")`, `exec` |
| **UI 组件** |||
| `status-line.ts` | 页脚状态指示器 | `setStatus`, 会话事件 |
| `working-indicator.ts` | 自定义流式传输工作指示器 | `setWorkingIndicator`, `registerCommand` |
| `github-issue-autocomplete.ts` | 在内置自动完成之上添加 `#1234` 问题完成，通过预加载最近的打开问题来自 `gh issue list` | `addAutocompleteProvider`, `on("session_start")`, `exec` |
| `custom-footer.ts` | 完全替换页脚 | `registerCommand`, `setFooter` |
| `custom-header.ts` | 替换启动头 | `on("session_start")`, `setHeader` |
| `modal-editor.ts` | Vim 风格模态编辑器 | `setEditorComponent`, `CustomEditor` |
| `rainbow-editor.ts` | 自定义编辑器样式 | `setEditorComponent` |
| `widget-placement.ts` | 编辑器上方/下方的组件 | `setWidget` |
| `overlay-test.ts` | 覆盖组件 | 带覆盖选项的 `ui.custom` |
| `overlay-qa-tests.ts` | 全面覆盖测试 | `ui.custom`, 所有覆盖选项 |
| `notify.ts` | 简单通知 | `ui.notify` |
| `timed-confirm.ts` | 带超时的对话框 | 带超时/信号的 `ui.confirm` |
| `mac-system-theme.ts` | 自动切换主题 | `setTheme`, `exec` |
| **复杂扩展** |||
| `plan-mode/` | 完整计划模式实现 | 所有事件类型, `registerCommand`, `registerShortcut`, `registerFlag`, `setStatus`, `setWidget`, `sendMessage`, `setActiveTools` |
| `preset.ts` | 可保存预设（模型、工具、思考） | `registerCommand`, `registerShortcut`, `registerFlag`, `setModel`, `setActiveTools`, `setThinkingLevel`, `appendEntry` |
| `tools.ts` | 切换工具开/关 UI | `registerCommand`, `setActiveTools`, `SettingsList`, 会话事件 |
| **远程和沙箱** |||
| `ssh.ts` | SSH 远程执行 | `registerFlag`, `on("user_bash")`, `on("before_agent_start")`, 工具操作 |
| `interactive-shell.ts` | 持久化 shell 会话 | `on("user_bash")` |
| `sandbox/` | 沙箱工具执行 | 工具操作 |
| `gondolin/` | 将内置工具和 `!` 命令路由到 Gondolin 微 VM | 工具操作, 内置工具覆盖, `on("user_bash")` |
| `subagent/` | 生成子智能体 | `registerTool`, `exec` |
| **游戏** |||
| `snake.ts` | 贪吃蛇游戏 | `registerCommand`, `ui.custom`, 键盘处理 |
| `space-invaders.ts` | 太空侵略者游戏 | `registerCommand`, `ui.custom` |
| `doom-overlay/` | 覆盖中的 Doom | 带覆盖的 `ui.custom` |
| **Providers** |||
| `custom-provider-anthropic/` | 自定义 Anthropic 代理 | `registerProvider` |
| `custom-provider-gitlab-duo/` | GitLab Duo 集成 | 带 OAuth 的 `registerProvider` |
| **消息和通信** |||
| `message-renderer.ts` | 自定义消息渲染 | `registerMessageRenderer`, `sendMessage` |
| `entry-renderer.ts` | 仅限 TUI 的自定义条目渲染 | `registerEntryRenderer`, `appendEntry` |
| `event-bus.ts` | 扩展间事件 | `pi.events` |
| **会话元数据** |||
| `session-name.ts` | 为选择器命名会话 | `setSessionName`, `getSessionName` |
| `bookmark.ts` | 为 /tree 书签条目 | `setLabel` |
| **杂项** |||
| `inline-bash.ts` | 工具调用中的内联 bash | `on("tool_call")` |
| `bash-spawn-hook.ts` | 在执行前调整 bash 命令、cwd 和 env | `createBashTool`, `spawnHook` |
| `with-deps/` | 带 npm 依赖的扩展 | 带 `package.json` 的包结构 |
