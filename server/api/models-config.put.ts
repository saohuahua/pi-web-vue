// PUT /api/models-config 全量写回自定义 provider 配置
// 后写赢策略 单用户本机使用可接受 打开面板即拉取最新值已把覆盖窗口压到最小

import type { ModelsConfigFile } from "#shared/lib/types";
import { writeModelsConfig } from "../utils/models-config-store";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ModelsConfigFile>(event);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      setResponseStatus(event, 400);
      return { error: "请求体必须是包含 providers 对象的 JSON" };
    }
    if (!body.providers || typeof body.providers !== "object" || Array.isArray(body.providers)) {
      setResponseStatus(event, 400);
      return { error: "请求体缺少 providers 对象" };
    }

    writeModelsConfig(body);
    return { success: true };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
