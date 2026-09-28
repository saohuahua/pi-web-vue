import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useModelsConfigStore } from "~/stores/models-config";

const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

beforeEach(() => {
  setActivePinia(createPinia());
  vi.unstubAllGlobals();
});

describe("模型配置草稿", () => {
  it("保存后以服务端规范化结果更新草稿与放弃快照", async () => {
    const persisted = {
      demo: {
        models: [{ id: "valid", cost: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0 } }],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ success: true, config: { providers: persisted } })),
    );
    const store = useModelsConfigStore();
    store.upsertProvider("demo");
    store.addModel("demo");
    expect(await store.save()).toBe(true);
    expect(store.providers).toEqual(persisted);
    expect(store.dirty).toBe(false);
    store.addModel("demo");
    store.discard();
    expect(store.providers).toEqual(persisted);
  });

  it("拒绝同名创建且不覆盖已有配置", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({ providers: { demo: { baseUrl: "saved", models: [{ id: "existing" }] } } }),
      ),
    );
    const store = useModelsConfigStore();
    await store.load();
    expect(store.upsertProvider("demo")).toBe(false);
    expect(store.providers.demo).toEqual({ baseUrl: "saved", models: [{ id: "existing" }] });
    expect(store.dirty).toBe(false);
  });

  it("放弃草稿恢复嵌套字段并移除未保存的 Provider", async () => {
    const saved = { demo: { headers: { "X-Test": "saved" }, models: [{ id: "existing" }] } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ providers: saved })),
    );
    const store = useModelsConfigStore();
    await store.load();
    store.providers.demo!.headers!["X-Test"] = "edited";
    store.removeModel("demo", 0);
    store.upsertProvider("new");
    store.discard();
    expect(store.providers).toEqual({
      demo: { headers: { "X-Test": "saved" }, models: [{ id: "existing" }] },
    });
    expect(store.dirty).toBe(false);
    store.providers.demo!.headers!["X-Test"] = "edited-again";
    store.discard();
    expect(store.providers.demo!.headers!["X-Test"]).toBe("saved");
  });

  it("保存期间新增编辑保留 dirty 且放弃时恢复实际提交快照", async () => {
    const pending = Promise.withResolvers<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const store = useModelsConfigStore();
    store.upsertProvider("submitted");
    const save = store.save();
    store.upsertProvider("later");
    pending.resolve(response({ success: true }));
    expect(await save).toBe(true);
    expect(store.dirty).toBe(true);
    store.discard();
    expect(store.providerNames).toEqual(["submitted"]);
    expect(store.dirty).toBe(false);
  });
});
