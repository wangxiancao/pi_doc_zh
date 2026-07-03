// local-command provider — 通过 qwen36-client 调本地 Qwen supervisor
// 协议（来自 qwen36-client.py）：stdin 整体作为 prompt，stdout 为译文；
// 退出码 0=成功，1=supervisor 报 ok:false，2=连接/读取失败（supervisor 未启动）。
// 本 provider 只负责执行命令/写 stdin/读 stdout/超时与退出码，不启动或管理 supervisor。
import { spawn } from "node:child_process";

export async function translate({ prompt, env, signal }) {
  const command = env.LOCAL_LLM_COMMAND || "/root/soft/llama.cpp/qwen36-client";
  const timeoutSec = Number(env.LOCAL_LLM_TIMEOUT_SEC || 3700);
  const socket = env.LOCAL_LLM_SOCKET; // 可选；缺省用 client 默认 /tmp/qwen36-supervisor.sock
  const args = ["--timeout", String(timeoutSec)];
  if (socket) args.push("--socket", socket);

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const proc = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      signal
    });
    proc.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        const hint =
          code === 2 && /connect/i.test(stderr)
            ? "（看起来 qwen36-supervisor 未启动；请先运行 /root/soft/llama.cpp/qwen36-supervisor）"
            : "";
        reject(new Error(`local-command exit ${code}: ${stderr.trim() || "(no stderr)"} ${hint}`));
      }
    });
    proc.stdin.end(prompt);
  });
}
