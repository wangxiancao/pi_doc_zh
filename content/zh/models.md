# 自定义模型

通过 `~/.pi/agent/models.json` 添加自定义提供方和模型（Ollama、vLLM、LM Studio、代理）。

## 目录 {#table-of-contents}

- [最小示例](#minimal-example)
- [完整示例](#full-example)
- [支持的 API](#supported-apis)
- [提供方配置](#provider-configuration)
- [模型配置](#model-configuration)
- [覆盖内置提供方](#overriding-built-in-providers)
- [按模型覆盖](#per-model-overrides)
- [Anthropic Messages 兼容性](#anthropic-messages-compatibility)
- [OpenAI 兼容性](#openai-compatibility)

## 最小示例 {#minimal-example}

对于本地模型（Ollama、LM Studio、vLLM），每个模型仅需 `id`：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

`apiKey` 的值是一个占位符，因为 Ollama 会忽略它。pi 仍然将模型视为需要认证后才会在 `/model` 中显示，因此无密钥的本地服务器应保留一个虚拟值，通过 `/login` 为该提供方保存一个密钥，或在选择模型时传递 `--api-key`。

某些 OpenAI 兼容服务器不理解用于支持推理能力模型的 `developer` 角色。对于此类提供方，将 `compat.supportsDeveloperRole` 设置为 `false`，这样 pi 会将系统提示作为 `system` 消息发送。如果服务器也不支持 `reasoning_effort`，则也将 `compat.supportsReasoningEffort` 设置为 `false`。

你可以在提供方级别设置 `compat` 以应用于所有模型，或在模型级别设置以覆盖特定模型。这通常适用于 Ollama、vLLM、SGLang 及类似的 OpenAI 兼容服务器。

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "gpt-oss:20b",
          "reasoning": true
        }
      ]
    }
  }
}
```

## 完整示例 {#full-example}

当你需要特定值时覆盖默认值：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        {
          "id": "llama3.1:8b",
          "name": "Llama 3.1 8B (本地)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

每次打开 `/model` 时，文件都会重新加载。在会话期间编辑；无需重启。

## Google AI Studio 示例 {#google-ai-studio-example}

使用 `google-generative-ai` 配合 `baseUrl` 以添加来自 Google AI Studio 的模型，包括自定义 Gemma 4 条目：

```json
{
  "providers": {
    "my-google": {
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "api": "google-generative-ai",
      "apiKey": "$GEMINI_API_KEY",
      "models": [
        {
          "id": "gemma-4-31b-it",
          "name": "Gemma 4 31B",
          "input": ["text", "image"],
          "contextWindow": 262144,
          "reasoning": true
        }
      ]
    }
  }
}
```

在向 `google-generative-ai` API 类型添加自定义模型时，`baseUrl` 是必需的。

## 支持的 API {#supported-apis}

| API | 描述 |
|-----|-------------|
| `openai-completions` | OpenAI Chat Completions（兼容性最强） |
| `openai-responses` | OpenAI Responses API |
| `anthropic-messages` | Anthropic Messages API |
| `google-generative-ai` | Google Generative AI |

在提供方级别（所有模型的默认值）或模型级别（按模型覆盖）设置 `api`。

## 提供方配置 {#provider-configuration}

| 字段 | 描述 |
|-------|-------------|
| `baseUrl` | API 端点 URL |
| `api` | API 类型（见上文） |
| `apiKey` | 可选的 API 密钥配置（见下方的值解析）。当通过 `/login`/`auth.json` 或 CLI `--api-key` 提供认证时，省略此字段。 |
| `headers` | 自定义头部（见下方的值解析） |
| `authHeader` | 设置为 `true` 以自动添加 `Authorization: Bearer <apiKey>` |
| `models` | 模型配置数组 |
| `modelOverrides` | 此提供方上内置模型的按模型覆盖 |

对于带有 `models` 的提供方，非内置的提供方配置需要在提供方或模型级别具有 `baseUrl` 和 `api` 值。加载文件时不需要 `apiKey`：当通过 `/login`/`auth.json`、CLI `--api-key` 或提供方 `apiKey` 配置认证时，模型即可用。如果未配置认证，模型会加载但在 `/model` 和 `--list-models` 中显示为不可用。

### 值解析 {#value-resolution}

`apiKey` 和 `headers` 字段支持命令执行、环境变量插值和字面量：

- **Shell 命令：** 以 `"!command"` 开头会将整个值作为命令执行并使用 stdout
  ```json
  "apiKey": "!security find-generic-password -ws 'anthropic'"
  "apiKey": "!op read 'op://vault/item/credential'"
  ```
- **环境变量插值：** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 使用命名变量的值。插值可以在更大的字面量内部工作。
  ```json
  "apiKey": "$MY_API_KEY"
  "apiKey": "${KEY_PREFIX}_${KEY_SUFFIX}"
  ```
  `$FOO_BAR` 是变量 `FOO_BAR`；当 `BAR` 是字面文本时，请使用 `${FOO}_BAR`。缺失的环境变量会导致值无法解析。
- **转义：** `"$$"` 发出字面量 `"$"`；`"$!"` 发出字面量 `"!"` 而不触发命令执行。
  ```json
  "apiKey": "$$literal-dollar-prefix"
  "apiKey": "$!literal-bang-prefix"
  ```
- **字面值：** 直接使用。纯大写字符串如 `MY_API_KEY` 是字面量；对于环境变量请使用 `$MY_API_KEY`。
  ```json
  "apiKey": "sk-..."
  ```

对于 `models.json`，Shell 命令在请求时解析。pi 有意不对任意命令应用内置的 TTL、过期重用或恢复逻辑。不同的命令需要不同的缓存和故障策略，pi 无法推断出正确的策略。

如果你的命令缓慢、昂贵、受速率限制，或者在临时故障时应继续使用之前的值，请将其包装在你自己的脚本或命令中，以实现你想要的缓存或 TTL 行为。

`/model` 可用性检查使用配置的认证存在性，不执行 Shell 命令。

### 自定义头部 {#custom-headers}

```json
{
  "providers": {
    "custom-proxy": {
      "baseUrl": "https://proxy.example.com/v1",
      "apiKey": "$MY_API_KEY",
      "api": "anthropic-messages",
      "headers": {
        "x-portkey-api-key": "$PORTKEY_API_KEY",
        "x-secret": "!op read 'op://vault/item/secret'"
      },
      "models": [...]
    }
  }
}
```

## 模型配置 {#model-configuration}

| 字段 | 必需 | 默认值 | 描述 |
|-------|----------|---------|-------------|
| `id` | 是 | — | 模型标识符（传递给 API） |
| `name` | 否 | `id` | 人类可读的模型标签。用于匹配（`--model` 模式）并显示为次要模型详细信息文本。 |
| `api` | 否 | 提供方的 `api` | 覆盖此模型的提供方 API |
| `reasoning` | 否 | `false` | 支持扩展思考 |
| `thinkingLevelMap` | 否 | 省略 | 将 pi 思考级别映射到提供方值并标记不支持的级别（见下文） |
| `input` | 否 | `["text"]` | 输入类型：`["text"]` 或 `["text", "image"]` |
| `contextWindow` | 否 | `128000` | 上下文窗口大小（以 token 为单位） |
| `maxTokens` | 否 | `16384` | 最大输出 token 数 |
| `cost` | 否 | 全零 | `{"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}`（每百万 token） |
| `compat` | 否 | 提供方 `compat` | 提供方兼容性覆盖。当两者都设置时，与提供方级别的 `compat` 合并。 |

当前行为：
- `/model`、`--list-models` 和交互式页脚按模型 `id` 显示条目。
- 配置的 `name` 用于模型匹配和次要模型详细信息文本。它不会替换页脚/状态栏的模型 id。

### 思考级别映射 {#thinking-level-map}

在模型上使用 `thinkingLevelMap` 来描述特定于模型思考控制。键是 pi 思考级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh`。

值是三元状态：

| 值 | 含义 |
|-------|---------|
| 省略 | 级别受支持并使用提供方的默认映射 |
| 字符串 | 级别受支持并发送此值给提供方 |
| `null` | 级别不受支持并从 UI 隐藏/跳过/钳制 |

仅支持 off、high 和 max 推理的模型示例：

```json
{
  "id": "deepseek-v4-pro",
  "reasoning": true,
  "thinkingLevelMap": {
    "minimal": null,
    "low": null,
    "medium": null,
    "high": "high",
    "xhigh": "max"
  }
}
```

思考无法禁用的模型示例：

```json
{
  "id": "always-thinking-model",
  "reasoning": true,
  "thinkingLevelMap": {
    "off": null
  }
}
```

迁移：使用 `compat.reasoningEffortMap` 的旧配置应将该映射移至模型级别的 `thinkingLevelMap`。对于不应在 UI 中显示的级别使用 `null`。

## 覆盖内置提供方 {#overriding-built-in-providers}

通过代理路由内置提供方，而无需重新定义模型：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1"
    }
  }
}
```

所有内置 Anthropic 模型仍然可用。现有的 OAuth 或 API 密钥认证继续有效。

要将自定义模型合并到内置提供方中，请包含 `models` 数组：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1",
      "apiKey": "$ANTHROPIC_API_KEY",
      "api": "anthropic-messages",
      "models": [...]
    }
  }
}
```

合并语义：
- 保留内置模型。
- 自定义模型按 `id` 在提供方内执行 upsert。
- 如果自定义模型 `id` 与内置模型 `id` 匹配，则自定义模型替换该内置模型。
- 如果自定义模型 `id` 是新的，则将其与内置模型一起添加。

## 按模型覆盖 {#per-model-overrides}

使用 `modelOverrides` 来自定义特定的内置模型，而无需替换提供方的完整模型列表。

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "anthropic/claude-sonnet-4": {
          "name": "Claude Sonnet 4 (Bedrock 路由)",
          "compat": {
            "openRouterRouting": {
              "only": ["amazon-bedrock"]
            }
          }
        }
      }
    }
  }
}
```

`modelOverrides` 支持以下每个模型的字段：`name`、`reasoning`、`input`、`cost`（部分）、`contextWindow`、`maxTokens`、`headers`、`compat`。

行为说明：
- `modelOverrides` 应用于内置提供方模型。
- 未知的模型 ID 将被忽略。
- 你可以将提供方级别的 `baseUrl`/`headers` 与 `modelOverrides` 结合使用。
- 覆盖 `name` 仅更改模型匹配和次要详细信息文本；页脚和主要模型列表继续显示模型 `id`。
- 如果提供方也定义了 `models`，则自定义模型在内置覆盖之后合并。具有相同 `id` 的自定义模型将替换被覆盖的内置模型条目。

## Anthropic Messages 兼容性 {#anthropic-messages-compatibility}

对于使用 `api: "anthropic-messages"` 的提供方或代理，使用 `compat` 来控制 Anthropic 特定的请求兼容性。

默认情况下，pi 发送每个工具的 `eager_input_streaming: true`。如果代理或 Anthropic 兼容后端拒绝该字段，请将 `supportsEagerToolInputStreaming` 设置为 `false`。pi 将省略 `tools[].eager_input_streaming` 并在启用工具的请求中发送遗留的 `fine-grained-tool-streaming-2025-05-14` beta 头部。

某些 Anthropic 模型需要自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`），而不是基于预算的遗留思考负载。内置模型会自动设置此选项。对于路由到这些模型的自定义提供方或别名，请将 `forceAdaptiveThinking` 设置为 `true`。

某些 Anthropic 兼容提供方发出的思考块具有空签名，并且在重放时仍然期望有签名。仅对这些提供方将 `allowEmptySignature` 设置为 `true`；真实的 Anthropic 会拒绝空的思考签名。

```json
{
  "providers": {
    "anthropic-proxy": {
      "baseUrl": "https://proxy.example.com",
      "api": "anthropic-messages",
      "apiKey": "$ANTHROPIC_PROXY_KEY",
      "compat": {
        "supportsEagerToolInputStreaming": false,
        "supportsLongCacheRetention": true,
        "forceAdaptiveThinking": true,
        "allowEmptySignature": true
      },
      "models": [
        {
          "id": "claude-opus-4-7",
          "reasoning": true,
          "input": ["text", "image"]
        }
      ]
    }
  }
}
```

| 字段 | 描述 |
|-------|-------------|
| `supportsEagerToolInputStreaming` | 提供方是否接受每个工具的 `eager_input_streaming`。默认值：`true`。设置为 `false` 以省略该字段并在启用工具的请求中使用遗留的细粒度工具流式传输 beta 头部。 |
| `supportsLongCacheRetention` | 提供方是否在缓存保留为 `long` 时接受 Anthropic 长缓存保留（`cache_control.ttl: "1h"`）。默认值：`true`。 |
| `sendSessionAffinityHeaders` | 是否在启用缓存时从会话 id 发送 `x-session-affinity`。默认值：自动检测已知提供方。 |
| `supportsCacheControlOnTools` | 提供方是否接受工具定义上的 Anthropic 风格 `cache_control` 标记。默认值：`true`。 |
| `forceAdaptiveThinking` | 是否为此模型发送自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`）。内置自适应模型会自动设置此选项。默认值：`false`。 |
| `allowEmptySignature` | 是否将空的思考签名重放为 `signature: ""` 而不是将思考转换为文本。默认值：`false`。 |

## OpenAI 兼容性 {#openai-compatibility}

对于部分 OpenAI 兼容的提供方，使用 `compat` 字段。

- 提供方级别的 `compat` 适用于该提供方下的所有模型。
- 模型级别的 `compat` 覆盖该模型的提供方级别值。

```json
{
  "providers": {
    "local-llm": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "compat": {
        "supportsUsageInStreaming": false,
        "maxTokensField": "max_tokens"
      },
      "models": [...]
    }
  }
}
```

| 字段 | 描述 |
|-------|-------------|
| `supportsStore` | 提供方支持 `store` 字段 |
| `supportsDeveloperRole` | 使用 `developer` 还是 `system` 角色 |
| `supportsReasoningEffort` | 对 `reasoning_effort` 参数的支持 |
| `supportsUsageInStreaming` | 支持 `stream_options: { include_usage: true }`（默认值：`true`） |
| `maxTokensField` | 使用 `max_completion_tokens` 或 `max_tokens` |
| `requiresToolResultName` | 在工具结果消息中包含 `name` |
| `requiresAssistantAfterToolResult` | 在工具结果后的用户消息之前插入助手消息 |
| `requiresThinkingAsText` | 将思考块转换为纯文本 |
| `requiresReasoningContentOnAssistantMessages` | 在启用推理时，在所有重放的助手消息中包含空的 `reasoning_content` |
| `thinkingFormat` | 使用 `reasoning_effort`、`openrouter`、`deepseek`、`together`、`zai`、`qwen`、`chat-template` 或 `qwen-chat-template` 思考参数 |
| `chatTemplateKwargs` | `thinkingFormat: "chat-template"` 的 `chat_template_kwargs` 值；对于 pi 控制的思考值，使用 `{ "$var": "thinking.enabled" }` 或 `{ "$var": "thinking.effort" }` |
| `cacheControlFormat` | 在系统提示、最后一个工具定义和最后一个用户/助手文本内容上使用 Anthropic 风格的 `cache_control` 标记。目前仅支持 `anthropic`。 |
| `supportsStrictMode` | 在工具定义中包含 `strict` 字段 |
| `supportsLongCacheRetention` | 提供方是否在缓存保留为 `long` 时接受长缓存保留：对于 OpenAI 提示缓存为 `prompt_cache_retention: "24h"`，或当 `cacheControlFormat` 为 `anthropic` 时为 `cache_control.ttl: "1h"`。默认值：`true`。 |
| `openRouterRouting` | OpenRouter 提供方路由偏好。此对象按原样发送在 [OpenRouter API 请求](https://openrouter.ai/docs/guides/routing/provider-selection) 的 `provider` 字段中。 |
| `vercelGatewayRouting` | Vercel AI Gateway 提供方选择的路由配置（`only`、`order`） |

`openrouter` 使用 `reasoning: { effort }`。`together` 使用 `reasoning: { enabled }`，并且在启用 `supportsReasoningEffort` 时也使用 `reasoning_effort`。`qwen` 使用顶级 `enable_thinking`。对于需要 `chat_template_kwargs.enable_thinking` 和 `preserve_thinking` 的本地 Qwen 兼容服务器，使用 `qwen-chat-template`。对于需要可配置 `chat_template_kwargs` 的 vLLM/Hugging Face 聊天模板，使用 `chat-template`，例如 `chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }` 用于 DeepSeek V3.x 模板。

`cacheControlFormat: "anthropic"` 用于通过文本内容和工具定义上的 `cache_control` 标记暴露 Anthropic 风格提示缓存的 OpenAI 兼容提供方。

示例：

```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "$OPENROUTER_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "openrouter/anthropic/claude-3.5-sonnet",
          "name": "OpenRouter Claude 3.5 Sonnet",
          "compat": {
            "openRouterRouting": {
              "allow_fallbacks": true,
              "require_parameters": false,
              "data_collection": "deny",
              "zdr": true,
              "enforce_distillable_text": false,
              "order": ["anthropic", "amazon-bedrock", "google-vertex"],
              "only": ["anthropic", "amazon-bedrock"],
              "ignore": ["gmicloud", "friendli"],
              "quantizations": ["fp16", "bf16"],
              "sort": {
                "by": "price",
                "partition": "model"
              },
              "max_price": {
                "prompt": 10,
                "completion": 20
              },
              "preferred_min_throughput": {
                "p50": 100,
                "p90": 50
              },
              "preferred_max_latency": {
                "p50": 1,
                "p90": 3,
                "p99": 5
              }
            }
          }
        }
      ]
    }
  }
}
```

Vercel AI Gateway 示例：

```json
{
  "providers": {
    "vercel-ai-gateway": {
      "baseUrl": "https://ai-gateway.vercel.sh/v1",
      "apiKey": "$AI_GATEWAY_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "moonshotai/kimi-k2.5",
          "name": "Kimi K2.5 (通过 Vercel 的 Fireworks)",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": { "input": 0.6, "output": 3, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 262144,
          "maxTokens": 262144,
          "compat": {
            "vercelGatewayRouting": {
              "only": ["fireworks", "novita"],
              "order": ["fireworks", "novita"]
            }
          }
        }
      ]
    }
  }
}
```
