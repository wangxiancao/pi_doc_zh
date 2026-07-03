# tmux 配置 {#tmux-setup}

Pi 可在 tmux 中运行，但 tmux 默认会剥离某些按键的修饰键信息。若未进行配置，`Shift+Enter` 和 `Ctrl+Enter` 通常与普通的 `Enter` 键无法区分。

## 推荐配置 {#recommended-configuration}

将以下内容添加到 `~/.tmux.conf`：

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

然后完全重启 tmux：

```bash
tmux kill-server
tmux
```

当 Kitty 键盘协议不可用时，Pi 会自动请求扩展键报告。使用 `extended-keys-format csi-u`，tmux 将以 CSI-u 格式转发修饰键，这是最可靠的配置。`extended-keys-format` 选项需要 tmux 3.5 或更高版本。

## 为什么推荐 `csi-u` {#why-csi-u-is-recommended}

如果仅配置：

```tmux
set -g extended-keys on
```

tmux 默认使用 `extended-keys-format xterm`。当应用程序请求扩展键报告时，修饰键将以 xterm `modifyOtherKeys` 格式转发，例如：

- `Ctrl+C` → `\x1b[27;5;99~`
- `Ctrl+D` → `\x1b[27;5;100~`
- `Ctrl+Enter` → `\x1b[27;5;13~`

使用 `extended-keys-format csi-u` 时，相同的键将转发为：

- `Ctrl+C` → `\x1b[99;5u`
- `Ctrl+D` → `\x1b[100;5u`
- `Ctrl+Enter` → `\x1b[13;5u`

Pi 支持这两种格式，但 `csi-u` 是推荐的 tmux 配置。

## 修复内容 {#what-this-fixes}

若不使用 tmux 扩展键，修饰的 Enter 键会退化为旧式序列：

| 按键 | 无扩展键 | 使用 `csi-u` |
|-----|-----------------|--------------|
| Enter | `\r` | `\r` |
| Shift+Enter | `\r` | `\x1b[13;2u` |
| Ctrl+Enter | `\r` | `\x1b[13;5u` |
| Alt/Option+Enter | `\x1b\r` | `\x1b[13;3u` |

这会影响默认快捷键（`Enter` 提交，`Shift+Enter` 换行）以及任何使用修饰 Enter 键的自定义快捷键。

## 要求 {#requirements}

- tmux 3.5 或更高版本以支持 `extended-keys-format csi-u`（运行 `tmux -V` 进行检查）
- 支持扩展键的终端模拟器（Ghostty、Kitty、iTerm2、WezTerm、Windows Terminal）

对于 tmux 3.2 至 3.4 版本，省略 `extended-keys-format csi-u`；Pi 仍支持 tmux 默认的 xterm `modifyOtherKeys` 格式。
