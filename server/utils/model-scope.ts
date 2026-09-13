// Ported from pi-web lib/model-scope.ts — https://github.com/agegr/pi-web (MIT)
// 模型可见范围解析 enabledModels 设置的语法与 pi 的 --models 参数一致

import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import {
  resolveModelScopeWithDiagnostics,
  type ModelRuntime,
  type ScopedModel,
} from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";

const THINKING_LEVEL_SUFFIXES = new Set<ThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

export interface ModelScopeResult {
  /** UI 应该展示的模型 未配置 enabledModels 时是全部可用模型 */
  visible: readonly Model<Api>[];
  /** SDK 原生作用域结果 保留给会话启动与扩展消费 */
  scopedModels: readonly ScopedModel[];
  /** provider/modelId 到被 :level 后缀固定的思考等级 */
  thinkingLevelPins: Record<string, string>;
  /** 解析诊断 例如没有匹配到任何模型的 pattern */
  warnings: string[];
}

const hasGlob = (pattern: string): boolean => {
  return pattern.includes("*") || pattern.includes("?") || pattern.includes("[");
};

const exactReferenceMatches = (pattern: string, models: readonly Model<Api>[]): Model<Api>[] => {
  const normalized = pattern.toLowerCase();
  const canonical = models.filter(
    (model) => `${model.provider}/${model.id}`.toLowerCase() === normalized,
  );
  if (canonical.length > 0) return canonical;
  return models.filter((model) => model.id.toLowerCase() === normalized);
};

// 不带 glob 的精确引用命中多个模型属于写法歧义 必须提示改用 provider/modelId
const assertNoAmbiguousExactPatterns = (
  patterns: readonly string[],
  models: readonly Model<Api>[],
): void => {
  for (const pattern of patterns) {
    if (hasGlob(pattern)) continue;

    let matches = exactReferenceMatches(pattern, models);
    if (matches.length === 0) {
      const colonIndex = pattern.lastIndexOf(":");
      const suffix = colonIndex >= 0 ? pattern.slice(colonIndex + 1) : "";
      if (THINKING_LEVEL_SUFFIXES.has(suffix as ThinkingLevel)) {
        matches = exactReferenceMatches(pattern.slice(0, colonIndex), models);
      }
    }

    if (matches.length > 1) {
      const references = matches
        .map((model) => `${model.provider}/${model.id}`)
        .sort()
        .join(", ");
      throw new Error(
        `enabledModels 里的 "${pattern}" 命中了多个模型 ${references} 请改用 provider/modelId 写法`,
      );
    }
  }
};

/**
 * 解析 patterns 对应的可见模型列表
 * 未配置或解析结果为空时回退到全部可用模型 避免一个写错或过期的设置让 UI 无模型可选
 * 支持 glob 与模糊匹配 以及 anthropic/*:high 这类思考等级固定后缀
 */
export const resolveVisibleModels = async (
  modelRuntime: ModelRuntime,
  patterns: string[] | undefined,
): Promise<ModelScopeResult> => {
  const cleaned = (patterns ?? []).map((pattern) => pattern.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return {
      visible: await modelRuntime.getAvailable(),
      scopedModels: [],
      thinkingLevelPins: {},
      warnings: [],
    };
  }

  const available = await modelRuntime.getAvailable();
  assertNoAmbiguousExactPatterns(cleaned, available);

  // resolver 只消费 getAvailable 传冻结快照 防止解析期间可用性刷新导致结果不一致
  const snapshotRuntime = {
    getAvailable: async () => available,
  } as ModelRuntime;
  const { scopedModels, diagnostics } = await resolveModelScopeWithDiagnostics(
    cleaned,
    snapshotRuntime,
  );
  const warnings = diagnostics.map((diagnostic) => diagnostic.message);
  if (scopedModels.length === 0) {
    return {
      visible: available,
      scopedModels: [],
      thinkingLevelPins: {},
      warnings,
    };
  }

  // anthropic/*:high 会给所有命中的模型固定思考等级 全部上报 供调用方查找初始模型对应的 pin
  const thinkingLevelPins: Record<string, string> = {};
  for (const scoped of scopedModels) {
    if (scoped.thinkingLevel) {
      thinkingLevelPins[`${scoped.model.provider}/${scoped.model.id}`] = scoped.thinkingLevel;
    }
  }
  return {
    visible: scopedModels.map((scoped) => scoped.model),
    scopedModels,
    thinkingLevelPins,
    warnings,
  };
};
