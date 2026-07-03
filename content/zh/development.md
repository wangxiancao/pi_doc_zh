# 开发 {#development}

参见 [AGENTS.md](https://github.com/earendil-works/pi-mono/blob/main/AGENTS.md) 获取更多指南。

## 环境配置 {#setup}

```bash
git clone https://github.com/earendil-works/pi-mono
cd pi-mono
npm install
npm run build
```

从源代码运行：

```bash
/path/to/pi-mono/pi-test.sh
```

该脚本可以在任何目录下运行。Pi 会保留调用者的当前工作目录。

## 分支 / 重新品牌化 {#forking-rebranding}

通过 `package.json` 进行配置：

```json
{
  "piConfig": {
    "name": "pi",
    "configDir": ".pi"
  }
}
```

修改 `name`、`configDir` 和 `bin` 字段以适应你的分支。这将影响 CLI 横幅、配置路径和环境变量名称。

## 路径解析 {#path-resolution}

三种执行模式：npm 安装、独立二进制文件、tsx 从源代码运行。

**始终使用 `src/config.ts`** 来获取包资源：

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

切勿直接使用 `__dirname` 来获取包资源。

## 调试命令 {#debug-command}

`/debug`（隐藏）写入 `~/.pi/agent/pi-debug.log`：
- 带有 ANSI 代码的渲染 TUI 行
- 最后发送给 LLM 的消息

## 测试 {#testing}

```bash
./test.sh                         # 运行非 LLM 测试（无需 API 密钥）
npm test                          # 运行所有测试
npm test -- test/specific.test.ts # 运行特定测试
```

## 项目结构 {#project-structure}

```
packages/
  ai/           # LLM 提供方抽象
  agent/        # 代理循环和消息类型  
  tui/          # 终端 UI 组件
  coding-agent/ # CLI 和交互模式
```
