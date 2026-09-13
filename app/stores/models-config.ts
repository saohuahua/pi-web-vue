import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  CustomModelConfig,
  CustomProviderConfig,
  ModelsConfigFile,
  ModelsConfigTestResult,
} from "#shared/lib/types";

// 自定义 provider 配置的草稿状态
// 表单直接编辑草稿对象 结构性增删走 action 统一标记 dirty
// 保存时整份 PUT 回服务端 由服务端做校验 规范化与原子写
export const useModelsConfigStore = defineStore("models-config", () => {
  const providers = ref<Record<string, CustomProviderConfig>>({});
  const loading = ref(false);
  const saving = ref(false);
  const loadError = ref("");
  const saveError = ref("");
  const dirty = ref(false);

  const providerNames = computed(() => Object.keys(providers.value));

  // 远端配置是草稿的唯一可信来源 打开管理视图或放弃变更后都要重新 load
  const load = async () => {
    loading.value = true;
    try {
      const res = await fetch("/api/models-config");
      const body = (await res.json()) as ModelsConfigFile & { error?: string };
      if (!res.ok || body.error) {
        loadError.value = body.error ?? `HTTP ${res.status}`;
        return;
      }
      providers.value = body.providers ?? {};
      loadError.value = "";
      dirty.value = false;
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  };

  const save = async (): Promise<boolean> => {
    saving.value = true;
    try {
      const res = await fetch("/api/models-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providers: providers.value } satisfies ModelsConfigFile),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok || body.error) {
        saveError.value = body.error ?? `HTTP ${res.status}`;
        return false;
      }
      saveError.value = "";
      dirty.value = false;
      return true;
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      saving.value = false;
    }
  };

  // 测试使用调用方传入的草稿快照 不要求草稿先保存
  const testModel = async (
    providerName: string,
    provider: CustomProviderConfig,
    model: CustomModelConfig,
  ): Promise<ModelsConfigTestResult> => {
    try {
      const res = await fetch("/api/models-config/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerName, provider, model }),
      });
      return (await res.json()) as ModelsConfigTestResult;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const upsertProvider = (name: string) => {
    providers.value[name] = { models: [] };
    dirty.value = true;
  };

  const removeProvider = (name: string) => {
    delete providers.value[name];
    dirty.value = true;
  };

  const addModel = (providerName: string) => {
    const provider = providers.value[providerName];
    if (!provider) return;
    if (!provider.models) provider.models = [];
    // id 留空由表单补全 保存时服务端会剔除空 id 条目 不影响已保存内容
    provider.models.push({ id: "" });
    dirty.value = true;
  };

  const removeModel = (providerName: string, index: number) => {
    const models = providers.value[providerName]?.models;
    if (!models || models[index] === undefined) return;
    models.splice(index, 1);
    dirty.value = true;
  };

  const markDirty = () => {
    dirty.value = true;
  };

  return {
    providers,
    providerNames,
    loading,
    saving,
    loadError,
    saveError,
    dirty,
    load,
    save,
    testModel,
    upsertProvider,
    removeProvider,
    addModel,
    removeModel,
    markDirty,
  };
});
