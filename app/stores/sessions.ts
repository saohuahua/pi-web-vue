import { defineStore } from "pinia";
import { reactive, ref } from "vue";
import type { SessionInfo } from "#shared/lib/types";

// 会话列表 store 只负责列表数据与运行中标记
// 当前会话的打开与消息流归 chat store
export const useSessionsStore = defineStore("sessions", () => {
  const sessions = ref<SessionInfo[]>([]);
  const runningIds = ref<Set<string>>(new Set());
  const loading = ref(false);
  // 自动标题进行中的会话 防重复点击
  const titlingIds = reactive(new Set<string>());
  const error = ref("");

  function setError(message: string) {
    error.value = message;
    // 裸 setTimeout 浏览器与测试环境都可用
    setTimeout(() => {
      if (error.value === message) error.value = "";
    }, 5000);
  }

  // force 跳过服务端 30 秒缓存 建会话后立刻刷侧栏用
  async function refresh(force = false) {
    loading.value = true;
    try {
      const res = await fetch(`/api/sessions${force ? "?force=1" : ""}`);
      // 非 200 保留旧列表 等下次刷新 调用方多为 void 触发 不能上抛
      if (!res.ok) return;
      const body = await res.json() as { sessions?: SessionInfo[] };
      sessions.value = body.sessions ?? [];
    } catch {
      // 网络抖动不清空已加载数据
    } finally {
      loading.value = false;
    }
  }

  // 运行中标记来自轮询 SSE 断连时侧栏仍能反映后台运行
  async function pollRunning() {
    try {
      const res = await fetch("/api/agent/running");
      if (!res.ok) return;
      const body = await res.json() as { sessionIds?: string[] };
      runningIds.value = new Set(body.sessionIds ?? []);
    } catch {
      // 轮询失败保持旧标记 SSE 重连才是权威恢复路径
    }
  }

  // 重命名 成功后强刷侧栏 缓存里的旧标题不能残留
  async function rename(id: string, name: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? `重命名失败 HTTP ${res.status}`);
        return false;
      }
      await refresh(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  // 自动标题 失败不覆盖原标题 由服务端保证
  async function autoTitle(id: string) {
    if (titlingIds.has(id)) return;
    titlingIds.add(id);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/auto-name`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? `生成标题失败 HTTP ${res.status}`);
        return;
      }
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      titlingIds.delete(id);
    }
  }

  return { sessions, runningIds, loading, titlingIds, error, refresh, pollRunning, rename, autoTitle };
});
