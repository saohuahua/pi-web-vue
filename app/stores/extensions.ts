import { defineStore } from "pinia";
import { ref } from "vue";
import type { ExtensionsResponse } from "#shared/lib/types";

// 扩展只读注册表 读取阶段绝不触发未知扩展执行
export const useExtensionsStore = defineStore("extensions", () => {
  const data = ref<ExtensionsResponse | null>(null);
  const loading = ref(false);
  const error = ref("");

  async function load(cwd: string | null) {
    if (!cwd) {
      data.value = null;
      error.value = "先在左侧选择项目";
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      const res = await fetch(`/api/capabilities/extensions?cwd=${encodeURIComponent(cwd)}`);
      const body = await res.json() as ExtensionsResponse & { error?: string };
      if (!res.ok || body.error) {
        data.value = null;
        error.value = body.error ?? `HTTP ${res.status}`;
        return;
      }
      data.value = body;
    } catch (e) {
      data.value = null;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function trustProject(cwd: string | null): Promise<boolean> {
    if (!cwd) {
      error.value = "先在左侧选择项目";
      return false;
    }
    try {
      const res = await fetch("/api/capabilities/project-trust", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd, trusted: true }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok || body.error) {
        error.value = body.error ?? `HTTP ${res.status}`;
        return false;
      }
      await load(cwd);
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return false;
    }
  }

  return { data, loading, error, load, trustProject };
});
