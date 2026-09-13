import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  PluginActionRequest,
  PluginPackageInfo,
  PluginsResponse,
  PluginScope,
  PluginUpdateResult,
} from "#shared/lib/types";

export type PluginAction = PluginActionRequest["action"];
type ManagedPluginAction = Exclude<PluginAction, "install">;

export const packageKey = (pkg: Pick<PluginPackageInfo, "source" | "scope">): string =>
  `${pkg.scope}\0${pkg.source}`;

const omitKey = (
  statuses: Record<string, PluginUpdateResult>,
  key: string,
): Record<string, PluginUpdateResult> => {
  const next = { ...statuses };
  delete next[key];
  return next;
};

const ACTION_LABEL: Record<ManagedPluginAction, string> = {
  remove: "卸载",
  update: "更新",
  disable: "禁用",
  enable: "启用",
};

// 包变更的 loading 状态按 动作 加 包键 粒度记录 面板据此禁用对应按钮
export const usePluginsStore = defineStore("plugins", () => {
  const data = ref<PluginsResponse | null>(null);
  const loading = ref(false);
  const error = ref("");
  const busyKey = ref("");
  const actionMessage = ref("");
  const actionError = ref("");
  const updateStatuses = ref<Record<string, PluginUpdateResult>>({});
  const checkingKeys = ref<Set<string>>(new Set());
  const updateError = ref("");

  const postJson = async (url: string, body: unknown): Promise<Record<string, unknown>> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || parsed.error) {
      throw new Error(typeof parsed.error === "string" ? parsed.error : `HTTP ${res.status}`);
    }
    return parsed;
  };

  async function load(cwd: string | null) {
    if (!cwd) {
      data.value = null;
      error.value = "先在左侧选择项目";
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      const res = await fetch(`/api/capabilities/plugins?cwd=${encodeURIComponent(cwd)}`);
      const body = (await res.json()) as PluginsResponse & { error?: string };
      if (!res.ok || body.error) {
        data.value = null;
        error.value = body.error ?? `HTTP ${res.status}`;
        return;
      }
      data.value = body;
      updateStatuses.value = {};
      updateError.value = "";
    } catch (e) {
      data.value = null;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  // pkg 省略表示对全部包执行 update 一键更新用 动作成功后后端返回新的全量状态 失败时保留旧数据
  async function runAction(
    action: ManagedPluginAction,
    pkg: PluginPackageInfo | undefined,
    cwd: string | null,
  ) {
    if (!cwd || !data.value) return;
    busyKey.value = `${action}:${pkg ? packageKey(pkg) : "all"}`;
    actionError.value = "";
    actionMessage.value = "";
    try {
      const body = await postJson("/api/capabilities/plugins", {
        action,
        source: pkg?.source,
        scope: pkg?.scope,
        cwd,
      });
      data.value = body as unknown as PluginsResponse;
      if (action === "remove" && pkg) {
        delete updateStatuses.value[packageKey(pkg)];
      }
      if (action === "update") {
        updateStatuses.value = pkg ? omitKey(updateStatuses.value, packageKey(pkg)) : {};
      }
      actionMessage.value = `已${ACTION_LABEL[action]} 需重建会话后生效`;
    } catch (e) {
      actionError.value = e instanceof Error ? e.message : String(e);
    } finally {
      busyKey.value = "";
    }
  }

  async function install(source: string, scope: PluginScope, cwd: string | null) {
    const normalized = source.trim();
    if (!normalized || !cwd) return;
    busyKey.value = `install:${scope}\0${normalized}`;
    actionError.value = "";
    actionMessage.value = "";
    try {
      const body = await postJson("/api/capabilities/plugins", {
        action: "install",
        source: normalized,
        scope,
        cwd,
      });
      data.value = body as unknown as PluginsResponse;
      actionMessage.value = "包已安装 需重建会话后生效";
    } catch (e) {
      actionError.value = e instanceof Error ? e.message : String(e);
    } finally {
      busyKey.value = "";
    }
  }

  // 更新检查是只读操作 结果按包键缓存 不修改 packages 配置
  async function checkUpdates(pkg: PluginPackageInfo | undefined, cwd: string | null) {
    if (!cwd || !data.value) return;
    const targets = pkg ? [pkg] : data.value.packages.filter((item) => item.canCheckForUpdates);
    const keys = targets.map(packageKey);
    if (!keys.length) return;
    updateError.value = "";
    checkingKeys.value = new Set([...checkingKeys.value, ...keys]);
    try {
      const body = await postJson("/api/capabilities/plugins/check", {
        cwd,
        source: pkg?.source,
        scope: pkg?.scope,
      });
      const updates = (body.updates ?? []) as PluginUpdateResult[];
      const next: Record<string, PluginUpdateResult> = { ...updateStatuses.value };
      for (const update of updates) {
        next[packageKey(update)] = update;
      }
      updateStatuses.value = next;
    } catch (e) {
      updateError.value = e instanceof Error ? e.message : String(e);
    } finally {
      const rest = new Set(checkingKeys.value);
      for (const key of keys) rest.delete(key);
      checkingKeys.value = rest;
    }
  }

  function clearMessages() {
    actionMessage.value = "";
    actionError.value = "";
    updateError.value = "";
  }

  return {
    data,
    loading,
    error,
    busyKey,
    actionMessage,
    actionError,
    updateStatuses,
    checkingKeys,
    updateError,
    load,
    runAction,
    install,
    checkUpdates,
    clearMessages,
  };
});
