import { describe, expect, it, vi } from "vitest";
import { resolveVisibleModels } from "#server/utils/model-scope";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";

// 最小模型桩 resolveModelScopeWithDiagnostics 只消费 id name provider 等基础字段
const makeModel = (provider: string, id: string, name = id): Model<Api> =>
  ({ id, name, provider, input: ["text"], reasoning: false }) as unknown as Model<Api>;

const makeRuntime = (models: Model<Api>[]): ModelRuntime => {
  return {
    getAvailable: vi.fn(async () => models),
  } as unknown as ModelRuntime;
};

describe("resolveVisibleModels", () => {
  it("未配置 patterns 时回退到全部可用模型", async () => {
    const runtime = makeRuntime([makeModel("prov1", "m1")]);
    const result = await resolveVisibleModels(runtime, undefined);
    expect(result.visible).toHaveLength(1);
    expect(result.visible[0]?.id).toBe("m1");
    expect(result.warnings).toEqual([]);
  });

  it("空 patterns 数组同样回退到全部可用模型", async () => {
    const runtime = makeRuntime([makeModel("prov1", "m1")]);
    const result = await resolveVisibleModels(runtime, ["  "]);
    expect(result.visible).toHaveLength(1);
  });

  it("glob pattern 收敛可见模型范围", async () => {
    const runtime = makeRuntime([makeModel("prov1", "m1"), makeModel("prov2", "m2")]);
    const result = await resolveVisibleModels(runtime, ["prov1/*"]);
    expect(result.visible.map((m) => m.id)).toEqual(["m1"]);
  });

  it("pattern 全部未命中时回退全部可用模型 并给出诊断", async () => {
    const runtime = makeRuntime([makeModel("prov1", "m1")]);
    const result = await resolveVisibleModels(runtime, ["nomatch/*"]);
    expect(result.visible).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("不带 glob 的精确引用命中多个模型时抛错", async () => {
    const runtime = makeRuntime([makeModel("prov1", "dup"), makeModel("prov2", "dup")]);
    await expect(resolveVisibleModels(runtime, ["dup"])).rejects.toThrow(/provider\/modelId/);
  });

  it("带 :level 后缀的 pattern 会记录思考等级 pin", async () => {
    const runtime = makeRuntime([makeModel("prov1", "m1"), makeModel("prov1", "m2")]);
    const result = await resolveVisibleModels(runtime, ["prov1/*:high"]);
    expect(result.visible).toHaveLength(2);
    expect(result.thinkingLevelPins["prov1/m1"]).toBe("high");
    expect(result.thinkingLevelPins["prov1/m2"]).toBe("high");
  });
});
