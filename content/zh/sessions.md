# 会话 (Sessions)

Pi 将对话保存为会话，以便你可以继续工作、从之前的轮次分支以及重新访问之前的路径。

## 会话存储 (Session Storage)

会话会自动保存到 `~/.pi/agent/sessions/`，并按工作目录组织。每个会话都是一个具有树结构的 JSONL 文件。

```bash
pi -c                  # 继续最近的会话
pi -r                  # 浏览并选择过去的会话
pi --no-session        # 临时模式；不保存
pi --name "my task"    # 在启动时设置会话显示名称
pi --session <path|id> # 使用特定的会话文件或部分会话 ID
pi --fork <path|id>    # 将会话文件或部分会话 ID 分叉到新会话中
```

在交互模式下使用 `/session` 可以查看当前会话文件、会话 ID、消息数量、令牌数和费用。

有关 JSONL 文件格式和 SessionManager API 的详细信息，请参阅 [会话格式 (Session Format)](session-format.md)。

## 会话命令 (Session Commands)

| 命令 | 描述 |
|---------|-------------|
| `/resume` | 浏览并选择之前的会话 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置当前会话显示名称 |
| `/session` | 显示会话信息 |
| `/tree` | 导航当前会话树 |
| `/fork` | 从之前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制到新会话 |
| `/compact [prompt]` | 总结较旧的上下文；参见 [压缩 (Compaction)](compaction.md) |
| `/export [file]` | 将会话导出为 HTML |
| `/share` | 作为私有 GitHub gist 上传，并提供可分享的 HTML 链接 |

## 恢复和删除会话 (Resuming and Deleting Sessions)

`/resume` 会打开当前项目的交互式会话选择器。`pi -r` 会在启动时打开相同的选择器。

在选择器中，你可以：

- 通过键入进行搜索
- 按 Ctrl+P 切换路径显示
- 按 Ctrl+S 切换排序模式
- 按 Ctrl+N 筛选仅显示命名会话
- 按 Ctrl+R 重命名
- 按 Ctrl+D 删除，然后确认

如果可用，pi 会使用 `trash` CLI 进行删除，而不是永久移除文件。

## 命名会话 (Naming Sessions)

使用 `/name <name>` 设置人类可读的会话名称：

```text
/name Refactor auth module
```

在启动时使用 `--name` 或 `-n` 设置名称：

```bash
pi --name "Refactor auth module"
pi --name "CI audit" -p "Review this build failure"
```

命名会话在 `/resume` 和 `pi -r` 中更容易找到。

## 使用 `/tree` 进行分支 (Branching with `/tree`)

会话以树的形式存储。每个条目都有一个 `id` 和 `parentId`，当前位置是活动的叶子节点。`/tree` 允许你跳转到任何先前的点并从此处继续，而无需创建新文件。

<p align="center"><img src="/images/tree-view.png" alt="Tree View" width="600"></p>

示例结构：

```text
├─ user: "Hello, can you help..."
│  └─ assistant: "Of course! I can..."
│     ├─ user: "Let's try approach A..."
│     │  └─ assistant: "For approach A..."
│     │     └─ user: "That worked..."  ← active
│     └─ user: "Actually, approach B..."
│        └─ assistant: "For approach B..."
```

### 树控件 (Tree Controls)

| 按键 | 操作 |
|-----|--------|
| ↑/↓ | 导航可见条目 |
| ←/→ | 上一页/下一页 |
| Ctrl+←/Ctrl+→ 或 Alt+←/Alt+→ | 折叠/展开或在分支段之间跳转 |
| Shift+L | 在选定条目上设置或清除标签 |
| Shift+T | 切换标签时间戳 |
| Enter | 选择条目 |
| Escape/Ctrl+C | 取消 |
| Ctrl+O | 循环过滤模式 |

过滤模式有：默认、无工具、仅用户、仅标签和全部。在 [设置 (Settings)](settings.md) 中通过 `treeFilterMode` 配置默认值。

### 选择行为 (Selection Behavior)

选择用户或自定义消息：

1. 将叶子节点移动到所选消息的父节点。
2. 将所选消息文本放入编辑器。
3. 允许你编辑并重新提交，从而创建新分支。

选择助手、工具、压缩或其他非用户条目：

1. 将叶子节点移动到该条目。
2. 保持编辑器为空。
3. 允许你从该点继续。

选择根用户消息会将叶子节点重置为空对话，并将原始提示放入编辑器中。

## `/tree`, `/fork`, and `/clone`

| 功能 | `/tree` | `/fork` | `/clone` |
|---------|---------|---------|----------|
| 输出 | 同一会话文件 | 新会话文件 | 新会话文件 |
| 视图 | 完整树 | 用户消息选择器 | 当前活动分支 |
| 典型用途 | 就地探索替代方案 | 从较早的提示开始新会话 | 在继续之前复制当前工作 |
| 摘要 | 可选的分支摘要 | 无 | 无 |

当你希望将替代方案保持在一起时使用 `/tree`。当你希望拥有单独的会话文件时使用 `/fork` 或 `/clone`。

## 分支摘要 (Branch Summaries)

当 `/tree` 从一个分支切换到另一个分支时，pi 可以总结被放弃的分支，并将该摘要附加到新位置。这保留了你所离开路径的重要上下文，而无需重放整个分支。

当被提示时，选择以下之一：

1. 无摘要
2. 使用默认提示进行总结
3. 使用自定义焦点指令进行总结

有关分支摘要的内部机制和扩展钩子，请参阅 [压缩 (Compaction)](compaction.md)。

## 会话格式 (Session Format)

会话文件是 JSONL 格式，包含消息条目、模型更改、思考级别更改、标签、压缩、分支摘要和扩展条目。

有关解析器、扩展、SDK 用法和完整的 SessionManager API，请参阅 [会话格式 (Session Format)](session-format.md)。
