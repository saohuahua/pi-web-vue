import { statSync } from "node:fs";
import { createAgentSessionServices, getAgentDir } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { ModelsResponse } from "#shared/lib/types";
import { loadModelsWithCache } from "../utils/models-cache";

const modelNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareModels(a: { name: string; id: string; provider: string }, b: { name: string; id: string; provider: string }): number {
  return modelNameCollator.compare(a.name || a.id, b.name || b.id)
    || modelNameCollator.compare(a.provider, b.provider)
    || modelNameCollator.compare(a.id, b.id);
}

async function loadModels(cwd: string): Promise<ModelsResponse> {
  const agentDir = getAgentDir();
  const services = await createAgentSessionServices({ cwd, agentDir });
  const modelError = services.modelRuntime.getError();
  const settings = services.settingsManager;
  const available = services.modelRuntime.getModels();

  const modelList = available
    .map((m) => ({ id: m.id, name: m.name, provider: m.provider, input: [...m.input] }))
    .sort(compareModels);

  // 思考等级由模型能力决定 getSupportedThinkingLevels 是权威来源
  const thinkingLevels: Record<string, string[]> = {};
  for (const m of available) {
    thinkingLevels[`${m.provider}:${m.id}`] = getSupportedThinkingLevels(m) as string[];
  }

  const defaultProvider = settings.getDefaultProvider();
  const defaultModelId = settings.getDefaultModel();
  const defaultModel = defaultProvider && defaultModelId
    ? { provider: defaultProvider, modelId: defaultModelId }
    : null;

  return {
    modelList,
    defaultModel,
    thinkingLevels,
    ...(modelError ? { modelError } : {}),
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
