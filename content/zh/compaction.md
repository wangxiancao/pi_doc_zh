# 上下文压缩与分支摘要

LLM 的上下文窗口是有限的。当对话变得过长时，pi 会使用上下文压缩（compaction）来总结较旧的内容，同时保留最近的交互。本页涵盖自动上下文压缩和分支摘要两种机制。

**源文件** ([pi-mono](https://github.com/earendil-works/pi-mono)):
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动上下文压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支摘要
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 共享工具函数（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) - 入口类型（`CompactionEntry`, `BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

若要查看项目中使用的 TypeScript 定义，请检查 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## 概览 {#overview}

Pi 拥有两种摘要机制：

| 机制 | 触发条件 | 目的 |
|-----------|---------|---------|
| 上下文压缩 (Compaction) | 上下文超过阈值，或执行 `/compact` | 总结旧消息以释放上下文空间 |
| 分支摘要 (Branch summarization) | 执行 `/tree` 导航 | 在切换分支时保留上下文 |

两者均使用相同的结构化摘要格式，并累积跟踪文件操作。

## 上下文压缩 {#compaction}

### 触发时机 {#when-it-triggers}

当满足以下条件时触发自动上下文压缩：

```
contextTokens > contextWindow - reserveTokens
```

默认情况下，`reserveTokens` 为 16384 个 token（可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）。这为 LLM 的响应预留了空间。

你也可以通过 `/compact [指令]` 手动触发，其中可选的指令用于聚焦摘要内容。

### 工作原理 {#how-it-works}

1. **查找切分点**：从最新消息开始向后遍历，累积 token 估算值，直到达到 `keepRecentTokens`（默认 20k，可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）
2. **提取消息**：收集从上一个保留边界（或会话开始）到切分点的消息
3. **生成摘要**：调用 LLM 以结构化格式生成摘要，如果存在之前的摘要，则将其作为迭代上下文传递
4. **追加条目**：保存带有摘要和 `firstKeptEntryId` 的 `CompactionEntry`
5. **重新加载**：会话重新加载，使用摘要 + 从 `firstKeptEntryId` 开始的消息

```
上下文压缩前：

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               messagesToSummarize            kept messages
                                   ↑
                          firstKeptEntryId (entry 4)

上下文压缩后（追加新条目）：

  entry:  0     1     2     3      4     5     6      7      8     9     10
        ┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
               └──────────┬──────┘ └──────────────────────┬───────────────────┘
                 not sent to LLM                    sent to LLM
                                                         ↑
                                              starts from firstKeptEntryId

LLM 看到的內容：

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    prompt   from cmp          messages from firstKeptEntryId
```

在重复的上下文压缩中，被摘要的跨度从上一次上下文压缩的保留边界（`firstKeptEntryId`）开始，而不是从上下文压缩条目本身开始；如果在该路径中找不到该保留条目，则回退到上次上下文压缩后的条目。这通过将这些消息包含在下一次摘要传递中，保留了之前上下文压缩中幸存的消息。Pi 还会在写入新的 `CompactionEntry` 之前，从重建的会话上下文中重新计算 `tokensBefore`，因此 token 计数反映了实际被替换的压缩前上下文。

### 拆分回合 {#split-turns}

一个“回合”（turn）以用户消息开始，包含直到下一个用户消息之前的所有助手回复和工具调用。通常，上下文压缩在回合边界处进行切分。

当单个回合超过 `keepRecentTokens` 时，切分点会落在助手消息的中间。这被称为“拆分回合”：

```
拆分回合（单个巨大回合超出预算）：

  entry:  0     1     2      3     4      5      6     7      8
        ┌─────┬─────┬─────┬──────┬─────┬──────┬──────┬─────┬──────┐
        │ hdr │ usr │ ass │ tool │ ass │ tool │ tool │ ass │ tool │
        └─────┴─────┴─────┴──────┴─────┴──────┴──────┴─────┴──────┘
                ↑                                     ↑
         turnStartIndex = 1                  firstKeptEntryId = 7
                │                                     │
                └──── turnPrefixMessages (1-6) ───────┘
                                                      └── kept (7-8)

  isSplitTurn = true
  messagesToSummarize = []  (之前没有完整的回合)
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

对于拆分回合，pi 会生成两个摘要并合并它们：
1. **历史摘要**：之前的上下文（如果有）
2. **回合前缀摘要**：拆分回合的早期部分

### 切分点规则 {#cut-point-rules}

有效的切分点包括：
- 用户消息
- 助手消息
- BashExecution 消息
- 自定义消息（custom_message, branch_summary）

绝不能在工具结果处切分（它们必须与其工具调用保持在一起）。

### CompactionEntry 结构 {#compactionentry-structure}

定义在 [`session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) 中：

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  fromHook?: boolean;  // 如果由扩展提供，则为 true（遗留字段名）
  details?: T;         // 特定于实现的数据
}

// 默认上下文压缩使用此作为 details（来自 compaction.ts）：
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可以在 `details` 中存储任何可 JSON 序列化的数据。默认上下文压缩跟踪文件操作，但自定义扩展实现可以使用自己的结构。

有关实现细节，参见 [`prepareCompaction()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts)。

## 分支摘要 {#branch-summarization}

### 触发时机 {#when-it-triggers-1}

当你使用 `/tree` 导航到不同的分支时，pi 会提示总结你即将离开的操作。这将左侧分支的上下文注入到新分支中。

### 工作原理 {#how-it-works-1}

1. **查找共同祖先**：旧位置和新位置共享的最深节点
2. **收集条目**：从旧叶子节点回溯到共同祖先
3. **按预算准备**：包含直到 token 预算的消息（最新的优先）
4. **生成摘要**：以结构化格式调用 LLM
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
导航前的树：

         ┌─ B ─ C ─ D (旧叶子节点，即将被放弃)
    A ───┤
         └─ E ─ F (目标)

共同祖先：A
需要摘要的条目：B, C, D

带摘要的导航后：

         ┌─ B ─ C ─ D ─ [B,C,D 的摘要]
    A ───┤
         └─ E ─ F (新叶子节点)
```

### 累积文件跟踪 {#cumulative-file-tracking}

上下文压缩和分支摘要均累积跟踪文件。在生成摘要时，pi 从以下位置提取文件操作：
- 正在被摘要的消息中的工具调用
- 之前的上下文压缩或分支摘要 `details`（如果有）

这意味着文件跟踪会在多次上下文压缩或嵌套的分支摘要中累积，保留读取和修改文件的完整历史。

### BranchSummaryEntry 结构 {#branchsummaryentry-structure}

定义在 [`session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) 中：

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  fromId: string;      // 我们从中导航的条目
  fromHook?: boolean;  // 如果由扩展提供，则为 true（遗留字段名）
  details?: T;         // 特定于实现的数据
}

// 默认分支摘要使用此作为 details（来自 branch-summarization.ts）：
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与上下文压缩一样，扩展可以在 `details` 中存储自定义数据。

有关实现细节，参见 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 和 [`generateBranchSummary()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## 摘要格式 {#summary-format}

上下文压缩和分支摘要均使用相同的结构化格式：

```markdown
## 目标
[用户试图完成的任务]

## 约束与偏好
- [用户提到的要求]

## 进度
### 已完成
- [x] [已完成的任务]

### 进行中
- [ ] [当前工作]

### 阻塞
- [问题，如果有]

## 关键决策
- **[决策]**：[理由]

## 下一步
1. [接下来应该发生什么]

## 关键上下文
- [继续所需的数据]

<read-files>
path/to/file1.ts
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### 消息序列化 {#message-serialization}

在摘要之前，消息通过 [`serializeConversation()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 序列化为文本：

```
[User]: 用户所说的内容
[Assistant thinking]: 内部推理
[Assistant]: 回复文本
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: 工具的输出
```

这防止模型将其视为需要继续的对话。

在序列化期间，工具结果被截断为 2000 个字符。超出该限制的内容被替换为指示截断字符数量的标记。这使摘要请求保持在合理的 token 预算内，因为工具结果（尤其是来自 `read` 和 `bash` 的结果）通常是上下文大小的最大贡献者。

## 通过扩展自定义摘要 {#custom-summarization-via-extensions}

扩展可以拦截并自定义上下文压缩和分支摘要。有关事件类型定义，参见 [`extensions/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts)。

### session_before_compact {#sessionbeforecompact}

在自动上下文压缩或 `/compact` 之前触发。可以取消或提供自定义摘要。参见类型文件中的 `SessionBeforeCompactEvent` 和 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - 需要摘要的消息
  // preparation.turnPrefixMessages - 拆分回合前缀（如果为 isSplitTurn）
  // preparation.previousSummary - 之前的上下文压缩摘要
  // preparation.fileOps - 提取的文件操作
  // preparation.tokensBefore - 上下文压缩前的上下文 token
  // preparation.firstKeptEntryId - 保留消息开始的位置
  // preparation.settings - 上下文压缩设置

  // branchEntries - 当前分支上的所有条目（用于自定义状态）
  // reason - "manual" (/compact), "threshold", 或 "overflow"
  // willRetry - 中止的回合是否在上下文压缩后重试（溢出恢复）
  // signal - AbortSignal（传递给 LLM 调用）

  // 取消：
  return { cancel: true };

  // 自定义摘要：
  return {
    compaction: {
      summary: "你的摘要...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      details: { /* 自定义数据 */ },
    }
  };
});
```

#### 将消息转换为文本 {#converting-messages-to-text}

要使用你自己的模型生成摘要，请使用 `serializeConversation` 将消息转换为文本：

```typescript
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;
  
  // 将 AgentMessage[] 转换为 Message[]，然后序列化为文本
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );
  // 返回：
  // [User]: 消息文本
  // [Assistant thinking]: 思考内容
  // [Assistant]: 回复文本
  // [Assistant tool calls]: read(path="..."); bash(command="...")
  // [Tool result]: 输出文本

  // 现在发送给你的模型进行摘要
  const summary = await myModel.summarize(conversationText);
  
  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    }
  };
});
```

参见 [custom-compaction.ts](../examples/extensions/custom-compaction.ts) 以使用不同模型的完整示例。

### session_before_tree {#sessionbeforetree}

在 `/tree` 导航之前触发。无论用户是否选择摘要，都会始终触发。可以取消导航或提供自定义摘要。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - 导航到的位置
  // preparation.oldLeafId - 当前位置（即将被放弃）
  // preparation.commonAncestorId - 共同祖先
  // preparation.entriesToSummarize - 将被摘要的条目
  // preparation.userWantsSummary - 用户是否选择摘要

  // 完全取消导航：
  return { cancel: true };

  // 提供自定义摘要（仅当 userWantsSummary 为 true 时使用）：
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "你的摘要...",
        details: { /* 自定义数据 */ },
      }
    };
  }
});
```

参见类型文件中的 `SessionBeforeTreeEvent` 和 `TreePreparation`。

## 设置 {#settings}

在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置上下文压缩：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| 设置项 | 默认值 | 描述 |
|---------|---------|-------------|
| `enabled` | `true` | 启用自动上下文压缩 |
| `reserveTokens` | `16384` | 为 LLM 响应预留的 token 数 |
| `keepRecentTokens` | `20000` | 保留的最近 token 数（不摘要） |

使用 `"enabled": false` 禁用自动上下文压缩。你仍然可以使用 `/compact` 手动进行上下文压缩。
