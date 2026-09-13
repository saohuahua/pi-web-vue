import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useModelsStore } from "./models";

describe("models store 默认模型", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("保存成功后才更新默认模型", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      ({ ok: true, json: async () => ({ success: true }) }) as Response));

    const models = useModelsStore();
    const ok = await models.setDefault("D:\\project", "openai", "gpt-5");

    expect(ok).toBe(true);
    expect(models.defaultModel).toEqual({ provider: "openai", modelId: "gpt-5" });
  });

  it("保存失败不覆盖已有默认模型", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      ({ ok: false, status: 423, json: async () => ({ error: "配置正被其他进程占用" }) }) as Response));

    const models = useModelsStore();
    models.defaultModel = { provider: "openai", modelId: "old" };
    const ok = await models.setDefault("D:\\project", "openai", "gpt-5");

    expect(ok).toBe(false);
    expect(models.defaultModel).toEqual({ provider: "openai", modelId: "old" });
    expect(models.modelError).toBe("配置正被其他进程占用");
  });
});
