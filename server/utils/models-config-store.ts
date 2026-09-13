// Ported from pi-web lib/models-config-store.ts — https://github.com/agegr/pi-web (MIT)
// 自定义 provider 配置的读写层 直接操作 ~/.pi/agent/models.json 与 pi CLI 共享同一份文件

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { CustomModelCost, ModelsConfigFile } from "#shared/lib/types";
import { writePrivateFileAtomicSync } from "./atomic-file";
import { invalidateModelsCache } from "./models-cache";

const MODEL_COST_KEYS = ["input", "output", "cacheRead", "cacheWrite"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

// cost 部分键存在即视为有效组 缺省键补 0 任一键类型非法则整组删除
const normalizeModelCost = (value: unknown): CustomModelCost | undefined => {
  if (!isRecord(value)) return undefined;

  const providedKeys = MODEL_COST_KEYS.filter((key) => value[key] !== undefined);
  if (providedKeys.length === 0) return undefined;
  if (providedKeys.some((key) => typeof value[key] !== "number" || !Number.isFinite(value[key])))
    return undefined;

  // 已知键之外的可能还有 tiers 等扩展字段 必须一并保留
  return Object.fromEntries([
    ...Object.entries(value),
    ...MODEL_COST_KEYS.map((key) => [key, (value[key] as number | undefined) ?? 0]),
  ]) as CustomModelCost;
};

// 补全每个模型的 cost 字段 SDK 读取时要求四个键齐全
export const normalizeModelsConfigCosts = (data: ModelsConfigFile): ModelsConfigFile => {
  const normalized = structuredClone(data);
  if (!normalized.providers) return normalized;

  for (const provider of Object.values(normalized.providers)) {
    if (!Array.isArray(provider.models)) continue;
    for (const model of provider.models) {
      if (!("cost" in model) || model.cost === undefined) continue;
      const cost = normalizeModelCost(model.cost);
      if (cost) model.cost = cost;
      else delete model.cost;
    }
  }
  return normalized;
};

// 剔除没有 id 或 id 为空白的模型条目 这类条目会让 SDK 加载失败
export const sanitizeModelsConfig = (data: ModelsConfigFile): ModelsConfigFile => {
  if (!data.providers) return data;

  const providers: ModelsConfigFile["providers"] = {};
  for (const [providerId, provider] of Object.entries(data.providers)) {
    if (!Array.isArray(provider.models)) {
      providers[providerId] = provider;
      continue;
    }
    providers[providerId] = {
      ...provider,
      models: provider.models.filter(
        (model) => typeof model.id === "string" && model.id.trim().length > 0,
      ),
    };
  }

  return { ...data, providers };
};

export const getModelsConfigPath = (): string => {
  return join(getAgentDir(), "models.json");
};

// 缺失或损坏时返回空配置 读失败不能让整个面板不可用
export const readModelsConfig = (modelsPath = getModelsConfigPath()): ModelsConfigFile => {
  if (!existsSync(modelsPath)) return { providers: {} };
  try {
    return JSON.parse(readFileSync(modelsPath, "utf8")) as ModelsConfigFile;
  } catch {
    return { providers: {} };
  }
};

// 全量写回 写完立刻失效模型缓存 新增或删除的模型才能及时反映到选择器
export const writeModelsConfig = (
  data: ModelsConfigFile,
  modelsPath = getModelsConfigPath(),
): void => {
  const dir = dirname(modelsPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const normalized = normalizeModelsConfigCosts(sanitizeModelsConfig(data));
  writePrivateFileAtomicSync(modelsPath, JSON.stringify(normalized, null, 2));
  invalidateModelsCache();
};
