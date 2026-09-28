import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateModelsCache, loadModelsWithCache } from "#server/utils/models-cache";
import type { ModelsResponse } from "#shared/lib/types";

const result = (id: string): ModelsResponse => ({
  modelList: [{ id, name: id, provider: "test", input: ["text"] }],
  defaultModel: null,
  thinkingLevels: {},
});

beforeEach(invalidateModelsCache);

describe("models cache invalidation", () => {
  it.each([true, false])("旧请求不能覆盖失效后的新请求 oldFirst=%s", async (oldFirst) => {
    const old = Promise.withResolvers<ModelsResponse>();
    const fresh = Promise.withResolvers<ModelsResponse>();
    const oldRequest = loadModelsWithCache("workspace", () => old.promise);
    invalidateModelsCache();
    const freshLoader = vi.fn(() => fresh.promise);
    const freshRequest = loadModelsWithCache("workspace", freshLoader);
    if (oldFirst) {
      old.resolve(result("old"));
      await oldRequest;
      expect(loadModelsWithCache("workspace", freshLoader)).toBe(freshRequest);
    }
    fresh.resolve(result("fresh"));
    await freshRequest;
    if (!oldFirst) {
      old.resolve(result("old"));
      await oldRequest;
    }
    expect(await loadModelsWithCache("workspace", freshLoader)).toEqual(result("fresh"));
    expect(freshLoader).toHaveBeenCalledTimes(1);
  });

  it("失效后未发新请求也不恢复旧缓存", async () => {
    const old = Promise.withResolvers<ModelsResponse>();
    const pending = loadModelsWithCache("workspace", () => old.promise);
    invalidateModelsCache();
    old.resolve(result("old"));
    await pending;
    const loader = vi.fn(async () => result("fresh"));
    expect(await loadModelsWithCache("workspace", loader)).toEqual(result("fresh"));
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
