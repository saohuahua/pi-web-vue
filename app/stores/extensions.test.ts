import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useExtensionsStore } from "./extensions";

describe("extensions store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("读取静态扩展注册表", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        extensions: [{ id: "global:a", name: "audit", filePath: "D:\\a.ts", scope: "global", kind: "file", status: "ready" }],
        projectTrusted: false,
        projectNeedsTrust: true,
      }),
    }) as Response));

    const store = useExtensionsStore();
    await store.load("D:\\project");

    expect(store.data?.extensions[0]?.name).toBe("audit");
    expect(store.data?.projectNeedsTrust).toBe(true);
  });

  it("信任项目后重新读取扩展状态", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      if (url === "/api/capabilities/project-trust") {
        return { ok: true, json: async () => ({ success: true }) } as Response;
      }
      return { ok: true, json: async () => ({ extensions: [], projectTrusted: true, projectNeedsTrust: false }) } as Response;
    }));

    const store = useExtensionsStore();
    const ok = await store.trustProject("D:\\project");

    expect(ok).toBe(true);
    expect(calls).toContain("/api/capabilities/project-trust");
    expect(store.data?.projectTrusted).toBe(true);
  });
});
