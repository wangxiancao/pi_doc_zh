# 终端设置 {#terminal-setup}

Pi 使用 [Kitty 键盘协议](https://sw.kovidgoyal.net/kitty/keyboard-protocol/) 来可靠地检测修饰键。大多数现代终端都支持此协议，但有些需要进行配置。

## Kitty, iTerm2 {#kitty-iterm2}

开箱即用。

## Apple Terminal {#apple-terminal}

Pi 在可用时会启用增强的按键报告。如果 Terminal.app 仍然将 `Shift+Enter` 发送为普通的 Return，pi 会使用本地 macOS 修饰键回退机制，将该 Return 视为 `Shift+Enter`。

此回退机制仅在 pi 在与 Terminal.app 相同的 Mac 上运行时有效。它无法通过远程 SSH 检测本地键盘。

## Ghostty {#ghostty}

在你的 Ghostty 配置中添加以下内容（macOS 上为 `~/Library/Application Support/com.mitchellh.ghostty/config`，Linux 上为 `~/.config/ghostty/config`）：

```
keybind = alt+backspace=text:\x1b\x7f
```

旧版本的 Claude Code 可能会添加此 Ghostty 映射：

```
keybind = shift+enter=text:\n
```

该映射发送原始换行字节。在 pi 内部，这与 `Ctrl+J` 无法区分，因此 tmux 和 pi 不再看到真实的 `shift+enter` 按键事件。

如果 Claude Code 2.x 或更高版本是你添加该映射的唯一原因，你可以删除它，除非你希望在 tmux 中使用 Claude Code，其中它仍然需要该 Ghostty 映射。

Pi 将 `Ctrl+J` 绑定为默认的新行别名，因此 `Shift+Enter` 通过该重映射在 tmux 中继续工作，无需额外的 pi 配置。

## WezTerm {#wezterm}

通过 xterm modifyOtherKeys，WezTerm 通常开箱即用支持 `Shift+Enter`。要显式使用 Kitty 键盘协议，请创建 `~/.wezterm.lua`：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

在 macOS 上，WezTerm 默认将 `Option+Enter` 绑定到全屏。要使用 `Option+Enter` 进行 pi 后续队列处理，请添加此按键覆盖：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.keys = {
  {
    key = 'Enter',
    mods = 'ALT',
    action = wezterm.action.SendString('\x1b[13;3u'),
  },
}
return config
```

如果你已经有 `config.keys` 表，请将条目添加到其中。

在 WSL 上，WezTerm 可能需要可见的硬件光标以进行 IME 候选窗口定位。如果 CJK IME 候选项不跟随文本光标，请在运行 pi 前设置 `PI_HARDWARE_CURSOR=1`，或在设置中将 `showHardwareCursor` 设置为 `true`。

## Alacritty {#alacritty}

Alacritty 通常开箱即用支持 `Shift+Enter`。在 macOS 上，`Option+Enter` 可能会作为普通 `Enter` 到达。要使用 `Option+Enter` 进行 pi 后续队列处理，请添加到 `~/.config/alacritty/alacritty.toml`：

```toml
[[keyboard.bindings]]
key = "Enter"
mods = "Alt"
chars = "\u001b[13;3u"
```

更改配置后重启 Alacritty。

## VS Code (Integrated Terminal) {#vs-code-integrated-terminal}

VS Code 1.109.5 及更高版本默认在集成终端中启用 Kitty 键盘协议，因此 `Shift+Enter` 应该开箱即用。

早于 1.109.5 版本的 VS Code 需要为 `Shift+Enter` 显式设置终端快捷键。

`keybindings.json` 位置：
- macOS: `~/Library/Application Support/Code/User/keybindings.json`
- Linux: `~/.config/Code/User/keybindings.json`
- Windows: `%APPDATA%\\Code\\User\\keybindings.json`

添加到 `keybindings.json`：

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

## Windows Terminal {#windows-terminal}

添加到 `settings.json`（Ctrl+Shift+, 或 设置 → 打开 JSON 文件）以转发 pi 使用的修饰 Enter 键：

```json
{
  "actions": [
    {
      "command": { "action": "sendInput", "input": "\u001b[13;2u" },
      "keys": "shift+enter"
    },
    {
      "command": { "action": "sendInput", "input": "\u001b[13;3u" },
      "keys": "alt+enter"
    }
  ]
}
```

- `Shift+Enter` 插入新行。
- Windows Terminal 默认将 `Alt+Enter` 绑定到全屏。这会阻止 pi 接收用于后续队列处理的 `Alt+Enter`。
- 将 `Alt+Enter` 重新映射到 `sendInput` 会将真实的按键组合转发给 pi。

如果你已经有 `actions` 数组，请将对象添加到其中。如果旧的全屏行为仍然存在，请完全关闭并重新打开 Windows Terminal。

## xfce4-terminal, terminator {#xfce4-terminal-terminator}

这些终端的转义序列支持有限。`Ctrl+Enter` 和 `Shift+Enter` 等修饰 Enter 键无法与普通 `Enter` 区分开来，这会导致 `submit: ["ctrl+enter"]` 等自定义快捷键无法工作。

为了获得最佳体验，请使用支持 Kitty 键盘协议的终端：
- [Kitty](https://sw.kovidgoyal.net/kitty/)
- [Ghostty](https://ghostty.org/)
- [WezTerm](https://wezfurlong.org/wezterm/)
- [iTerm2](https://iterm2.com/)
- [Alacritty](https://github.com/alacritty/alacritty) (需要使用 Kitty 协议支持进行编译)

## IntelliJ IDEA (Integrated Terminal) {#intellij-idea-integrated-terminal}

内置终端的转义序列支持有限。在 IntelliJ 的终端中，Shift+Enter 无法与 Enter 区分。

如果你希望显示硬件光标，请在运行 pi 前设置 `PI_HARDWARE_CURSOR=1`（默认禁用以保持兼容性）。

建议使用专用的终端模拟器以获得最佳体验。
