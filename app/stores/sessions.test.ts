import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSessionsStore } from "./sessions";

// 标题更新不串会话 rename 只 PATCH 目标 id 成功后强刷列表
describe("sessions store 重命名与自动标题", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("rename 对目标会话发 PATCH 成功后强制刷新列表", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(url).endsWith("/api/sessions?force=1")) {
        return { ok: true, json: async () => ({ sessions: [{ id: "a", name: "新名字", projectKey: "k", projectRoot: "r" }] }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }));

    const store = useSessionsStore();
    const ok = await store.rename("a", "新名字");

    expect(ok).toBe(true);
    // PATCH 打在目标会话上 不会把别的会话 id 带进请求
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.url).toContain("/api/sessions/a");
    expect(patch?.body).toEqual({ name: "新名字" });
    // 成功后强刷 缓存里的旧标题不能残留
    expect(calls.some((c) => c.url.includes("force=1"))).toBe(true);
    expect(store.sessions[0]?.name).toBe("新名字");
  });

  it("rename 失败设置错误信息 不动列表", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      ({ ok: false, status: 404, json: async () => ({ error: "Session not found" }) }) as Response));

    const store = useSessionsStore();
    const ok = await store.rename("gone", "随便");

    expect(ok).toBe(false);
    expect(store.error).toContain("Session not found");
    expect(store.sessions).toHaveLength(0);
  });

  it("autoTitle 请求期间防重复点击 失败不覆盖列表", async () => {
    let pending = 0;
    let maxConcurrent = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/auto-name")) {
        pending += 1;
        maxConcurrent = Math.max(maxConcurrent, pending);
        await new Promise((r) => setTimeout(r, 50));
        pending -= 1;
        return ({ ok: false, status: 500, json: async () => ({ error: "模型不可用" }) }) as Response;
      }
      return ({ ok: true, json: async () => ({ sessions: [] }) }) as Response;
    }));

    const store = useSessionsStore();
    await Promise.all([store.autoTitle("a"), store.autoTitle("a")]);

    // 并发两次点击只发一次请求
    expect(maxConcurrent).toBe(1);
    expect(store.error).toContain("模型不可用");
  });
});
