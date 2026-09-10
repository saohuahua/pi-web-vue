import { defineStore } from "pinia";
import type { ModelsResponse } from "#shared/lib/types";

// 可用模型列表 输入框模型选择器的数据源
// 思考等级按模型能力返回 不能在前端写死枚举
export const useModelsStore = defineStore("models", () => {
  const modelList = ref<ModelsResponse["modelList"]>([]);
  const defaultModel = ref<ModelsResponse["defaultModel"]>(null);
  const thinkingLevels = ref<Record<string, string[]>>({});
  const modelError = ref("");
  const loading = ref(false);

  async function load(cwd: string | null) {
    if (!cwd) return;
    loading.value = true;
    try {
      const res = await fetch(`/api/models?cwd=${encodeURIComponent(cwd)}`);
      const body = await res.json() as ModelsResponse & { error?: string };
      if (!res.ok || body.error) {
        modelError.value = body.error ?? `HTTP ${res.status}`;
        return;
      }
      modelList.value = body.modelList ?? [];
      defaultModel.value = body.defaultModel ?? null;
      thinkingLevels.value = body.thinkingLevels ?? {};
      modelError.value = body.modelError ?? "";
    } catch (e) {
      modelError.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return { modelList, defaultModel, thinkingLevels, modelError, loading, load };
});
