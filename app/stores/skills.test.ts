import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSkillsStore } from "./skills";

const skill = {
  name: "code-review",
  description: "检查改动",
  filePath: "D:\\project\\.agents\\skills\\code-review\\SKILL.md",
  baseDir: "D:\\project\\.agents\\skills\\code-review",
  sourceInfo: { source: "project" },
  disableModelInvocation: false,
};

describe("skills store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("读取技能并只更新目标技能的模型调用开关", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/skills?")) {
        return { ok: true, json: async () => ({ skills: [{ ...skill }] }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }));

    const store = useSkillsStore();
    await store.load("D:\\project");
    const ok = await store.setInvocation(store.entries[0]!, false);

    expect(ok).toBe(true);
    expect(store.entries[0]?.disableModelInvocation).toBe(true);
  });

  it("保存失败保留原开关并提供错误原因", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      ({ ok: false, status: 409, json: async () => ({ error: "技能文件已被修改" }) }) as Response));

    const store = useSkillsStore();
    store.entries = [{ ...skill }];
    const ok = await store.setInvocation(store.entries[0]!, false);

    expect(ok).toBe(false);
    expect(store.entries[0]?.disableModelInvocation).toBe(false);
    expect(store.error).toBe("技能文件已被修改");
  });
});
