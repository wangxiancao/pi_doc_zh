# Pi 文档

Pi 是一个极简的终端编程工具集。它在核心保持小巧，通过 TypeScript 扩展、技能、提示词模板、主题和 Pi 包进行扩展。

## 快速开始

使用 npm 安装 Pi：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 会在安装期间禁用依赖生命周期脚本。Pi 在正常 npm 安装时不需要安装脚本。

然后在项目目录中运行：

```bash
pi
```

使用 `/login` 进行订阅类提供方的认证，或在启动 pi 之前设置 API key（例如 `ANTHROPIC_API_KEY`）。

完整的首次运行流程请参见[快速开始](quickstart.md)。

> 注：当前为多语种架构骨架阶段，本页面为占位首页，各子页面的中文内容由翻译脚本（`npm run translate -- zh`）生成。
