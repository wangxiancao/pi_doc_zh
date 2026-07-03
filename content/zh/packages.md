pi 可以帮助你创建 pi 包。让它打包你的扩展、技能、提示词模板或主题。

# Pi 包 {#pi-packages}

Pi 包将扩展、技能、提示词模板和主题打包在一起，以便你通过 npm 或 git 进行分享。包可以在 `package.json` 的 `pi` 键下声明资源，或使用约定目录。

## 目录 {#table-of-contents}

- [安装与管理](#install-and-manage)
- [包来源](#package-sources)
- [创建 Pi 包](#creating-a-pi-package)
- [包结构](#package-structure)
- [依赖](#dependencies)
- [包过滤](#package-filtering)
- [启用和禁用资源](#enable-and-disable-resources)
- [作用域与去重](#scope-and-deduplication)

## 安装与管理 {#install-and-manage}

> **安全：** Pi 包拥有完整的系统访问权限。扩展会执行任意代码，技能可以指示模型执行任何操作，包括运行可执行文件。在安装第三方包之前，请审查源代码。

```bash
pi install npm:@foo/bar@1.0.0
pi install git:github.com/user/repo@v1
pi install https://github.com/user/repo  # 原始 URL 也可以
pi install /absolute/path/to/package
pi install ./relative/path/to/package

pi remove npm:@foo/bar
pi list                     # 从设置中显示已安装的包
pi update                   # 仅更新 pi
pi update --all             # 更新 pi、更新包并协调固定的 git 引用
pi update --extensions      # 仅更新包并协调固定的 git 引用
pi update --self            # 仅更新 pi
pi update --self --force    # 即使当前已是最新也重新安装 pi
pi update npm:@foo/bar      # 更新单个包
pi update --extension npm:@foo/bar
```

这些命令用于管理 pi 包，`pi update` 可以更新 pi CLI 安装。要卸载 pi 本身，请参阅 [快速入门](quickstart.md#uninstall)。

默认情况下，`install` 和 `remove` 写入用户设置（`~/.pi/agent/settings.json`）。使用 `-l` 改为写入项目设置（`.pi/settings.json`）。项目设置可以与你的团队共享，并且在项目受信任后，pi 会在启动时自动安装任何缺失的包。

若要尝试安装某个包而不实际安装它，请使用 `--extension` 或 `-e`。这会将包安装到临时目录中，仅对当前运行有效：

```bash
pi -e npm:@foo/bar
pi -e git:github.com/user/repo
```

## 包来源 {#package-sources}

Pi 在设置和 `pi install` 中接受三种来源类型。

### npm {#npm}

```
npm:@scope/pkg@1.2.3
npm:pkg
```

- 带版本的规范会被固定，并被包更新跳过（`pi update --extensions`、`pi update --all`）。
- 用户安装位于 `~/.pi/agent/npm/` 下。
- 项目安装位于 `.pi/npm/` 下。
- 在 `settings.json` 中设置 `npmCommand` 以将 npm 包查找和安装操作固定到特定的包装命令，例如 `mise` 或 `asdf`。

示例：

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

### git {#git}

```
git:github.com/user/repo@v1
git:git@github.com:user/repo@v1
https://github.com/user/repo@v1
ssh://git@github.com/user/repo@v1
```

- 如果没有 `git:` 前缀，只接受协议 URL（`https://`、`http://`、`ssh://`、`git://`）。
- 带有 `git:` 前缀时，接受简写格式，包括 `github.com/user/repo` 和 `git@github.com:user/repo`。
- 支持 HTTPS 和 SSH URL。
- SSH URL 会自动使用你配置的 SSH 密钥（尊重 `~/.ssh/config`）。
- 对于非交互式运行（例如 CI），你可以设置 `GIT_TERMINAL_PROMPT=0` 以禁用凭据提示，并设置 `GIT_SSH_COMMAND`（例如 `ssh -o BatchMode=yes -o ConnectTimeout=5`）以快速失败。
- 引用被固定为标签或提交。`pi update --extensions` 和 `pi update --all` 不会将它们移动到更新的引用，但它们确实会将现有的克隆协调到配置的引用。
- 使用 `pi install git:host/user/repo@new-ref` 来更新设置并将现有包移动到新的固定引用。
- 克隆到 `~/.pi/agent/git/<host>/<path>`（全局）或 `.pi/git/<host>/<path>`（项目）。
- 当协调更改检出时，pi 会重置并清理克隆，如果存在 `package.json` 则运行 `npm install`。

**SSH 示例：**
```bash
# git@host:path 简写（需要 git: 前缀）
pi install git:git@github.com:user/repo

# ssh:// 协议格式
pi install ssh://git@github.com/user/repo

# 带版本引用
pi install git:git@github.com:user/repo@v1.0.0
```

### 本地路径 {#local-paths}

```
/absolute/path/to/package
./relative/path/to/package
```

本地路径指向磁盘上的文件或目录，并直接添加到设置中而不进行复制。相对路径相对于其出现所在的设置文件进行解析。如果路径是文件，则将其作为单个扩展加载。如果路径是目录，pi 会使用包规则加载资源。

## 创建 Pi 包 {#creating-a-pi-package}

在 `package.json` 中添加 `pi` 清单或使用约定目录。包含 `pi-package` 关键字以利于发现。

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

路径相对于包根目录。数组支持 glob 模式和 `!排除项`。

### 画廊元数据 {#gallery-metadata}

[包画廊](https://pi.dev/packages) 显示标记为 `pi-package` 的包。添加 `video` 或 `image` 字段以显示预览：

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```

- **video**：仅限 MP4。在桌面上，悬停时自动播放。点击会打开全屏播放器。
- **image**：PNG、JPEG、GIF 或 WebP。显示为静态预览。

如果两者都设置了，视频优先。

## 包结构 {#package-structure}

### 约定目录 {#convention-directories}

如果不存在 `pi` 清单，pi 会从这些目录中自动发现资源：

- `extensions/` 加载 `.ts` 和 `.js` 文件
- `skills/` 递归查找 `SKILL.md` 文件夹并将顶层 `.md` 文件作为技能加载
- `prompts/` 加载 `.md` 文件
- `themes/` 加载 `.json` 文件

## 依赖 {#dependencies}

第三方运行时依赖项应位于 `package.json` 的 `dependencies` 中。不注册扩展、技能、提示词模板或主题的依赖项也属于 `dependencies`。当 pi 从 npm 或 git 安装包时，它会运行 `npm install`，因此这些依赖项会自动安装。

Pi 捆绑了用于扩展和技能的核心包。如果你导入其中任何一项，请将它们列为 `peerDependencies`，范围为 `"*"`，并且不要捆绑它们：`@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`、`typebox`。

其他 pi 包必须打包在你的 tarball 中。将它们添加到 `dependencies` 和 `bundledDependencies`，然后通过 `node_modules/` 路径引用它们的资源。Pi 使用单独的模块根加载包，因此单独的安装不会冲突或共享模块。

示例：

```json
{
  "dependencies": {
    "shitty-extensions": "^1.0.1"
  },
  "bundledDependencies": ["shitty-extensions"],
  "pi": {
    "extensions": ["extensions", "node_modules/shitty-extensions/extensions"],
    "skills": ["skills", "node_modules/shitty-extensions/skills"]
  }
}
```

## 包过滤 {#package-filtering}

使用设置中的对象形式过滤包加载的内容：

```json
{
  "packages": [
    "npm:simple-pkg",
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"],
      "themes": ["+themes/legacy.json"]
    }
  ]
}
```

`+path` 和 `-path` 是相对于包根目录的精确路径。

- 省略键以加载该类型的所有内容。
- 使用 `[]` 不加载该类型的任何内容。
- `!pattern` 排除匹配项。
- `+path` 强制包含精确路径。
- `-path` 强制排除精确路径。
- 过滤器叠加在清单之上。它们缩小了已允许内容的范围。

## 启用和禁用资源 {#enable-and-disable-resources}

使用 `pi config` 启用或禁用来自已安装包和本地目录的扩展、技能、提示词模板和主题。适用于全局（`~/.pi/agent`）和项目（`.pi/`）作用域。

## 作用域与去重 {#scope-and-deduplication}

包可以同时出现在全局和项目设置中。如果同一个包出现在两者中，项目条目优先。身份由以下因素确定：

- npm：包名称
- git：不包含引用的仓库 URL
- 本地：解析后的绝对路径
