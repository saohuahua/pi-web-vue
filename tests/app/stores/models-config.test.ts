import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useModelsConfigStore } from "~/stores/models-config";
import type { CustomProviderConfig } from "#shared/lib/types";

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

const stubGetConfig = (providers: Record<string, CustomProviderConfig>) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse({ providers })),
  );
};

beforeEach(() => {
  setActivePinia(createPinia());
  vi.unstubAllGlobals();
});

describe("useModelsConfigStore load", () => {
  it("load 成功后写入 providers 并清空 dirty", async () => {
    stubGetConfig({ pandada: { baseUrl: "https://x", models: [{ id: "m" }] } });
    const store = useModelsConfigStore();

    await store.load();

    expect(store.providerNames).toEqual(["pandada"]);
    expect(store.dirty).toBe(false);
    expect(store.loadError).toBe("");
  });

  it("load 失败时把错误写进 loadError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "boom" }, false)),
    );
    const store = useModelsConfigStore();

    await store.load();

    expect(store.loadError).toBe("boom");
    expect(store.providerNames).toEqual([]);
  });
});

describe("useModelsConfigStore 结构性修改与 dirty", () => {
  it("upsertProvider removeProvider addModel removeModel 都会标记 dirty", async () => {
    stubGetConfig({});
    const store = useModelsConfigStore();
    await store.load();
    expect(store.dirty).toBe(false);

    store.upsertProvider("p1");
    expect(store.dirty).toBe(true);
    expect(store.providers.p1?.models).toEqual([]);

    store.addModel("p1");
    expect(store.providers.p1?.models?.[0]?.id).toBe("");

    store.removeModel("p1", 0);
    expect(store.providers.p1?.models).toEqual([]);

    store.removeProvider("p1");
    expect(store.providerNames).toEqual([]);
  });

  it("markDirty 由表单字段编辑调用", async () => {
    stubGetConfig({ p1: {} });
    const store = useModelsConfigStore();
    await store.load();

    store.markDirty();
    expect(store.dirty).toBe(true);
  });
});

describe("useModelsConfigStore save", () => {
  it("save 成功后清空 dirty 且请求体包含整份 providers", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(String(init?.body)).providers.p1.baseUrl).toBe("https://x");
      return jsonResponse({ success: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useModelsConfigStore();
    store.upsertProvider("p1");
    const provider = store.providers.p1;
    if (!provider) throw new Error("p1 provider missing");
    provider.baseUrl = "https://x";

    const ok = await store.save();

    expect(ok).toBe(true);
    expect(store.dirty).toBe(false);
    expect(store.saveError).toBe("");
  });

  it("save 失败时保留 dirty 并写入 saveError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "拒绝写入" }, false)),
    );
    const store = useModelsConfigStore();
    store.upsertProvider("p1");

    const ok = await store.save();

    expect(ok).toBe(false);
    expect(store.dirty).toBe(true);
    expect(store.saveError).toBe("拒绝写入");
  });
});

describe("useModelsConfigStore testModel", () => {
  it("testModel 返回服务端测试结果", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: true, latencyMs: 320, responseText: "OK" })),
    );
    const store = useModelsConfigStore();

    const result = await store.testModel("p1", { models: [] }, { id: "m1" });

    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBe(320);
  });

  it("testModel 网络异常时返回 ok false 的错误结果", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const store = useModelsConfigStore();

    const result = await store.testModel("p1", { models: [] }, { id: "m1" });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("network down");
  });
});
