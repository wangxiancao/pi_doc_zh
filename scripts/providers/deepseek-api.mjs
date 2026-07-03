// deepseek-api provider — 远程 DeepSeek API 后备（OpenAI 兼容 chat completions）
// 需要环境变量 DEEPSEEK_API_KEY。模型默认 deepseek-v4-flash，可用 DEEPSEEK_MODEL 覆盖。
const ENDPOINT = "https://api.deepseek.com/chat/completions";

export async function translate({ prompt, env, signal }) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("deepseek-api provider 需要 DEEPSEEK_API_KEY 环境变量");
  }
  const model = env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    signal,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      stream: false
    })
  });

  if (!resp.ok) {
    throw new Error(`deepseek-api HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`deepseek-api 返回为空: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return text;
}
