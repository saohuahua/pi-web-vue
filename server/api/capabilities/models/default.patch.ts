import { createAgentSessionServices, getAgentDir } from "@earendil-works/pi-coding-agent";
import { invalidateModelsCache } from "../../../utils/models-cache";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "../../../utils/file-access";

// 默认模型写入 SDK 设置管理器 避免直接覆盖 settings.json 的无关字段
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ cwd?: unknown; provider?: unknown; modelId?: unknown }>(event);
    const cwd = typeof body?.cwd === "string" ? body.cwd : "";
    const provider = typeof body?.provider === "string" ? body.provider : "";
    const modelId = typeof body?.modelId === "string" ? body.modelId : "";
    if (!cwd || !provider || !modelId) {
      setResponseStatus(event, 400);
      return { error: "cwd provider and modelId are required" };
    }
    if (!isExistingFilePathAllowed(cwd, await getAllowedFileRoots())) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }

    const services = await createAgentSessionServices({ cwd, agentDir: getAgentDir() });
    if (!services.modelRuntime.getModel(provider, modelId)) {
      setResponseStatus(event, 400);
      return { error: `Model not found: ${provider}/${modelId}` };
    }

    services.settingsManager.setDefaultModelAndProvider(provider, modelId);
    await services.settingsManager.flush();
    invalidateModelsCache();
    return { success: true };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
