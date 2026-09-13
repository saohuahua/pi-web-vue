import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeModelsConfigCosts,
  readModelsConfig,
  sanitizeModelsConfig,
  writeModelsConfig,
} from "#server/utils/models-config-store";
import type { ModelsConfigFile } from "#shared/lib/types";

// 文件来自磁盘 进入校验前可能不满足受控配置类型
const makeUncheckedConfig = (value: unknown): ModelsConfigFile => value as ModelsConfigFile;

const makeConfig = (providers: unknown): ModelsConfigFile => makeUncheckedConfig({ providers });

describe("normalizeModelsConfigCosts", () => {
  it("cost 部分键存在时补全缺省键为 0", () => {
    const config = makeConfig({
      p: { models: [{ id: "m", cost: { input: 3, output: 7 } }] },
    });
    const result = normalizeModelsConfigCosts(config);
    expect(result.providers?.p?.models?.[0]?.cost).toEqual({
      input: 3,
      output: 7,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });

  it("cost 任一键类型非法时整组删除", () => {
    const config = makeConfig({
      p: { models: [{ id: "m", cost: { input: 1, output: "x" } }] },
    });
    const result = normalizeModelsConfigCosts(config);
    expect(result.providers?.p?.models?.[0]?.cost).toBeUndefined();
  });

  it("cost 里的未知扩展字段一并保留", () => {
    const config = makeConfig({
      p: { models: [{ id: "m", cost: { input: 1, output: 2, tiers: [{ a: 1 }] } }] },
    });
    const result = normalizeModelsConfigCosts(config);
    const cost = result.providers?.p?.models?.[0]?.cost;
    expect(cost?.tiers).toEqual([{ a: 1 }]);
  });

  it("没有 providers 时原样返回", () => {
    const config = makeUncheckedConfig({ other: 1 });
    expect(normalizeModelsConfigCosts(config)).toEqual({ other: 1 });
  });
});

describe("sanitizeModelsConfig", () => {
  it("剔除没有 id 或 id 为空白的模型条目", () => {
    const config = makeConfig({
      p: { models: [{ id: "keep" }, { name: "no-id" }, { id: "   " }] },
    });
    const result = sanitizeModelsConfig(config);
    expect(result.providers?.p?.models).toEqual([{ id: "keep" }]);
  });

  it("models 不是数组时原样保留该 provider", () => {
    const config = makeConfig({
      p: { baseUrl: "https://x" },
    });
    const result = sanitizeModelsConfig(config);
    expect(result.providers?.p).toEqual({ baseUrl: "https://x" });
  });
});

describe("readModelsConfig 与 writeModelsConfig", () => {
  it("写入后再读出内容一致 空白 id 的模型被剔除", () => {
    const dir = mkdtempSync(join(tmpdir(), "models-config-test-"));
    try {
      const path = join(dir, "models.json");
      const config = makeConfig({
        pandada: {
          baseUrl: "https://example.com/v1",
          apiKey: "sk-test",
          models: [{ id: "good", thinkingLevelMap: { off: null } }, { id: "" }],
        },
      });

      writeModelsConfig(config, path);
      const read = readModelsConfig(path);
      expect(read.providers?.pandada?.apiKey).toBe("sk-test");
      expect(read.providers?.pandada?.models?.length).toBe(1);
      // 表单未覆盖的未知字段必须原样保留
      expect(read.providers?.pandada?.models?.[0]?.thinkingLevelMap).toEqual({ off: null });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("文件缺失时返回空 providers", () => {
    expect(readModelsConfig(join(tmpdir(), "not-exists-models.json"))).toEqual({ providers: {} });
  });

  it("文件损坏时返回空 providers 而不是抛错", () => {
    const dir = mkdtempSync(join(tmpdir(), "models-config-test-"));
    try {
      const path = join(dir, "models.json");
      writeModelsConfig(makeConfig({}), path);
      writeFileSync(path, "{broken", "utf8");
      expect(readModelsConfig(path)).toEqual({ providers: {} });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
