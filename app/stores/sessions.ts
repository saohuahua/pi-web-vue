import { defineStore } from "pinia";
import type { SessionInfo } from "#shared/lib/types";

// 会话列表 store 只负责列表数据与运行中标记
// 当前会话的打开与消息流归 chat store
export const useSessionsStore = defineStore("sessions", () => {
  const sessions = ref<SessionInfo[]>([]);
  const runningIds = ref<Set<string>>(new Set());
  const loading = ref(false);

  // force 跳过服务端 30 秒缓存 建会话后立刻刷侧栏用
  async function refresh(force = false) {
    loading.value = true;
    try {
      const res = await fetch(`/api/sessions${force ? "?force=1" : ""}`);
      const body = await res.json() as { sessions?: SessionInfo[] };
      sessions.value = body.sessions ?? [];
    } finally {
      loading.value = false;
    }
  }

  // 运行中标记来自轮询 SSE 断连时侧栏仍能反映后台运行
  async function pollRunning() {
    const res = await fetch("/api/agent/running");
    const body = await res.json() as { sessionIds?: string[] };
    runningIds.value = new Set(body.sessionIds ?? []);
  }

  return { sessions, runningIds, loading, refresh, pollRunning };
});
