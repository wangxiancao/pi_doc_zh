# 容器化

Pi 默认以所有权限运行，但在某些情况下，您希望更好地控制 Pi 可以写入哪些目录以及拥有哪些访问权限。

有两种通用的选项。您可以
1. 在整个 `pi` 进程在隔离环境中运行，或者
2. 在宿主机上运行 `pi` 并将工具执行路由到隔离环境中。

## 选择模式 {#choose-a-pattern}

| 模式 | 隔离内容 | 适用场景 | 备注 |
| --- | --- | --- | --- |
| Gondolin 扩展 | 内置工具和 `!` 命令 | 在宿主机保留认证的同时实现本地微虚拟机隔离 | 参见 [`examples/extensions/gondolin/`](../examples/extensions/gondolin/)。 |
| Plain Docker | 整个 `pi` 进程位于本地容器中 | 简单的本地隔离 | Provider API 密钥进入容器。 |
| OpenShell | 整个 `pi` 进程位于策略控制的沙箱中 | 本地或远程管理的沙箱 | 需要 OpenShell 网关 |

扩展在 `pi` 进程运行的任何地方运行。如果您在宿主机上运行带有工具路由扩展的 `pi`，其他自定义扩展工具仍然在宿主机上运行，除非它们也委托其操作。

## Gondolin {#gondolin}

[Gondolin](https://github.com/earendil-works/gondolin) 是一个本地 Linux 微虚拟机。
当您希望在宿主机上运行 `pi` 但将所有内置工具路由到 VM 中时，请使用 [示例扩展](../examples/extensions/gondolin)。

设置：

```bash
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

从您要挂载的项目中运行：

```bash
cd /path/to/project
pi -e ~/.pi/agent/extensions/gondolin
```

该扩展将宿主机 cwd 挂载到 VM 中的 `/workspace`，并覆盖 `read`、`write`、`edit`、`bash`、`grep`、`find` 和 `ls`。
用户的 `!` 命令也被路由到 VM 中。
`/workspace` 下的文件更改会透传到宿主机。

要求：Node.js >= 23.6.0 用于 `@earendil-works/gondolin`，以及 QEMU（需要通过包管理器安装）。

## Plain Docker {#plain-docker}

当您想要最简单的本地容器边界时，在 Docker 中运行整个 `pi` 进程。

`Dockerfile.pi`：

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

WORKDIR /workspace
ENTRYPOINT ["pi"]
```

构建和运行：

```bash
docker build -t pi-sandbox -f Dockerfile.pi .

docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v pi-agent-home:/root/.pi/agent \
  pi-sandbox
```

`-v "$PWD:/workspace"` 将您的当前目录挂载到容器中的 `/workspace`，使得 Docker 内部对 `/workspace` 的读写直接影响您的宿主机文件，就像 Gondolin 示例中一样。

如果您想要容器本地的设置和会话，请使用命名卷挂载 `/root/.pi/agent`。挂载宿主机 `~/.pi/agent` 会将宿主机认证和会话文件暴露给容器。

## OpenShell {#openshell}

当您想要具有文件系统、进程、网络、凭据和推理控制策略的沙箱时，请使用 [NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview)。
OpenShell 可以通过由 Docker、Podman 或 VM 运行时支持的本地网关运行沙箱，或者通过远程 Kubernetes 网关运行。

每个沙箱都需要一个活动的网关。
在创建沙箱之前注册并选择一个：

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

在 OpenShell 沙箱中启动 `pi`：

```bash
openshell sandbox create --name pi-sandbox --from pi -- pi
```

在这种模式下，整个 `pi` 进程在沙箱内运行。
内置工具、`!` 命令和扩展工具在 OpenShell 边界内执行。

如果网关是远程的，项目文件不会从宿主机绑定挂载，这意味着沙箱中的写入不会反映在您的机器上。
在沙箱内克隆仓库或使用 OpenShell 文件传输命令：

```bash
openshell sandbox upload pi-sandbox ./repo /workspace
openshell sandbox download pi-sandbox /workspace/repo ./repo-out
```

OpenShell 提供商可以将原始模型 API 密钥保留在沙箱之外。
当配置推理路由时，沙箱内的代码可以调用 `https://inference.local`，并且网关会在上游注入配置的提供商凭据。
如果您希望模型流量使用此路由，请配置 Pi 使用相应的 OpenAI 兼容或 Anthropic 兼容端点。
