import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { packageKey, usePluginsStore } from "~/stores/plugins";
import type { PluginsResponse } from "#shared/lib/types";

const makePackage = (overrides: Partial<PluginsResponse["packages"][number]> = {}) => ({
  source: "npm:demo-pkg",
  scope: "global" as const,
  canCheckForUpdates: true,
  filtered: false,
  disabled: false,
  installedPath: "C:\\tmp\\demo-pkg",
  packageName: "demo-pkg",
  version: "1.0.0",
  configuredVersion: undefined,
  counts: { extensions: 1, skills: 0, prompts: 0, themes: 0 },
  resources: [],
  status: "loaded" as const,
  ...overrides,
});

describe("plugins store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.unstubAllGlobals();
  });

  it("读取插件包列表", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({
              packages: [makePackage()],
              totals: { extensions: 1, skills: 0, prompts: 0, themes: 0 },
              diagnostics: [],
              projectResourcesLoaded: true,
            }),
          }) as Response,
      ),
    );

    const store = usePluginsStore();
    await store.load("D:\\project");

    expect(store.data?.packages[0]?.source).toBe("npm:demo-pkg");
    expect(store.error).toBe("");
  });

  it("未选择项目时不发起请求", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const store = usePluginsStore();
    await store.load(null);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.error).toBe("先在左侧选择项目");
  });

  it("读取失败时透传错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: false,
            json: async () => ({ error: "Access denied" }),
          }) as Response,
      ),
    );

    const store = usePluginsStore();
    await store.load("D:\\project");

    expect(store.data).toBeNull();
    expect(store.error).toBe("Access denied");
  });

  it("动作成功后替换数据并给出提示", async () => {
    const updated = makePackage({ version: "1.1.0" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              packages: [updated],
              totals: { extensions: 1, skills: 0, prompts: 0, themes: 0 },
              diagnostics: [],
              projectResourcesLoaded: true,
            }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            packages: [makePackage()],
            totals: { extensions: 1, skills: 0, prompts: 0, themes: 0 },
            diagnostics: [],
            projectResourcesLoaded: true,
          }),
        } as Response;
      }),
    );

    const store = usePluginsStore();
    await store.load("D:\\project");
    await store.runAction("update", store.data!.packages[0]!, "D:\\project");

    expect(store.data?.packages[0]?.version).toBe("1.1.0");
    expect(store.actionMessage).toContain("已更新");
    expect(store.busyKey).toBe("");
  });

  it("动作失败时保留旧数据并记录错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return { ok: false, json: async () => ({ error: "install failed" }) } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            packages: [makePackage()],
            totals: { extensions: 1, skills: 0, prompts: 0, themes: 0 },
            diagnostics: [],
            projectResourcesLoaded: true,
          }),
        } as Response;
      }),
    );

    const store = usePluginsStore();
    await store.load("D:\\project");
    await store.runAction("update", store.data!.packages[0]!, "D:\\project");

    expect(store.data?.packages[0]?.version).toBe("1.0.0");
    expect(store.actionError).toBe("install failed");
  });

  it("安装成功后清空动作提示由面板接管", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              packages: [makePackage()],
              totals: { extensions: 1, skills: 0, prompts: 0, themes: 0 },
              diagnostics: [],
              projectResourcesLoaded: true,
            }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            packages: [],
            totals: { extensions: 0, skills: 0, prompts: 0, themes: 0 },
            diagnostics: [],
            projectResourcesLoaded: true,
          }),
        } as Response;
      }),
    );

    const store = usePluginsStore();
    await store.load("D:\\project");
    await store.install("npm:demo-pkg", "global", "D:\\project");

    expect(store.data?.packages).toHaveLength(1);
    expect(store.actionMessage).toBe("包已安装 需重建会话后生效");
  });

  it("更新检查按包键缓存结果", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST" && String(_url).includes("/check")) {
          return {
            ok: true,
            json: async () => ({
              updates: [
                {
                  source: "npm:demo-pkg",
                  scope: "global",
                  displayName: "demo-pkg",
                  type: "npm",
                  state: "update-available",
                },
              ],
            }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            packages: [makePackage()],
            totals: { extensions: 1, skills: 0, prompts: 0, themes: 0 },
            diagnostics: [],
            projectResourcesLoaded: true,
          }),
        } as Response;
      }),
    );

    const store = usePluginsStore();
    await store.load("D:\\project");
    await store.checkUpdates(store.data!.packages[0]!, "D:\\project");

    expect(store.updateStatuses[packageKey(store.data!.packages[0]!)]?.state).toBe(
      "update-available",
    );
    expect(store.checkingKeys.size).toBe(0);
  });

  it("清除提示信息", async () => {
    const store = usePluginsStore();
    store.actionMessage = "x";
    store.actionError = "y";
    store.updateError = "z";
    store.clearMessages();

    expect(store.actionMessage).toBe("");
    expect(store.actionError).toBe("");
    expect(store.updateError).toBe("");
  });
});
