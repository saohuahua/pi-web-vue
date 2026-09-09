import { createAgentSessionServices, getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent";

// ?cwd=<一个真实目录> 验证 pi SDK 能在 Nitro 服务端正常加载与初始化
// 这是全项目唯一的技术风险点 提前到脚手架阶段排除
// 失败排查 报错含 wasm 或 photon 或 Cannot find module 时检查 nuxt.config 的 externals.external 包名拼写
export default defineEventHandler(async (event) => {
  const cwd = getQuery(event).cwd as string | undefined;
  if (!cwd) {
    setResponseStatus(event, 400);
    return { error: "cwd query param required" };
  }
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const services = await createAgentSessionServices({ cwd, agentDir, settingsManager });
  return { ok: true, agentDir };
});
