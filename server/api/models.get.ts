import { statSync } from "node:fs";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { ModelsResponse } from "#shared/lib/types";
import { createAgentServicesWithRetry } from "../utils/agent-services";
import { resolveVisibleModels } from "../utils/model-scope";
import { loadModelsWithCache } from "../utils/models-cache";

const modelNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareModels(
  a: { name: string; id: string; provider: string },
  b: { name: string; id: string; provider: string },
): number {
  return (
    modelNameCollator.compare(a.name || a.id, b.name || b.id) ||
    modelNameCollator.compare(a.provider, b.provider) ||
    modelNameCollator.compare(a.id, b.id)
  );
}

async function loadModels(cwd: string): Promise<ModelsResponse> {
  const services = await createAgentServicesWithRetry({ cwd });
  const modelError = services.modelRuntime.getError();
  const settings = services.settingsManager;

  // getModels 返回目录里的全量模型 getAvailable 只含已配置凭证的模型 再由 enabledModels 收敛可见范围
  const scope = await resolveVisibleModels(services.modelRuntime, settings.getEnabledModels());
  const visible = scope.visible;

  const modelList = visible
    .map((m) => ({ id: m.id, name: m.name, provider: m.provider, input: [...m.input] }))
    .sort(compareModels);

  // 思考等级由模型能力决定 getSupportedThinkingLevels 是权威来源
  const thinkingLevels: Record<string, string[]> = {};
  for (const m of visible) {
    thinkingLevels[`${m.provider}:${m.id}`] = getSupportedThinkingLevels(m) as string[];
  }

  // 默认模型不在可见范围内时不上报 避免面板把一个选不出来的模型标成默认
  let defaultModel: ModelsResponse["defaultModel"] = null;
  const defaultProvider = settings.getDefaultProvider();
  const defaultModelId = settings.getDefaultModel();
  if (
    defaultProvider &&
    defaultModelId &&
    visible.some((m) => m.provider === defaultProvider && m.id === defaultModelId)
  ) {
    defaultModel = { provider: defaultProvider, modelId: defaultModelId };
  }

  return {
    modelList,
    defaultModel,
    thinkingLevels,
    ...(modelError ? { modelError } : {}),
    ...(scope.warnings.length > 0 ? { modelScopeWarnings: scope.warnings } : {}),
  };
}

// GET /api/models?cwd=  输入框模型选择器的数据源
export default defineEventHandler(async (event) => {
  try {
    const raw = getQuery(event).cwd;
    const cwd = typeof raw === "string" && raw ? raw : process.cwd();
    let stat;
    try {
      stat = statSync(cwd);
    } catch {
      setResponseStatus(event, 400);
      return { error: `Directory does not exist: ${cwd}` };
    }
    if (!stat.isDirectory()) {
      setResponseStatus(event, 400);
      return { error: `Path is not a directory: ${cwd}` };
    }

    const data = await loadModelsWithCache(cwd, () => loadModels(cwd));
    return data;
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
