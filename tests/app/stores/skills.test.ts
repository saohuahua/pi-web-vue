import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSkillsStore } from "~/stores/skills";

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

  it("取消项目后迟到响应不能恢复技能写入上下文", async () => {
    const pending = Promise.withResolvers<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const store = useSkillsStore();
    const load = store.load("D:\\project");
    await store.load(null);
    pending.resolve({ ok: true, json: async () => ({ skills: [{ ...skill }] }) } as Response);
    await load;
    expect(store.entries).toEqual([]);
    expect(store.loading).toBe(false);
    expect(await store.setInvocation({ ...skill }, false)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("读取技能并只更新目标技能的模型调用开关", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/api/skills?")) {
          return { ok: true, json: async () => ({ skills: [{ ...skill }] }) } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      }),
    );

    const store = useSkillsStore();
    await store.load("D:\\project");
    const ok = await store.setInvocation(store.entries[0]!, false);

    expect(ok).toBe(true);
    expect(store.entries[0]?.disableModelInvocation).toBe(true);
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          cwd: "D:\\project",
          filePath: skill.filePath,
          disableModelInvocation: true,
        }),
      }),
    );
  });

  it("保存失败保留原开关并提供错误原因", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/skills?")
          ? ({ ok: true, json: async () => ({ skills: [{ ...skill }] }) } as Response)
          : ({
              ok: false,
              status: 409,
              json: async () => ({ error: "技能文件已被修改" }),
            } as Response),
      ),
    );

    const store = useSkillsStore();
    await store.load("D:\\project");
    const ok = await store.setInvocation(store.entries[0]!, false);

    expect(ok).toBe(false);
    expect(store.entries[0]?.disableModelInvocation).toBe(false);
    expect(store.error).toBe("技能文件已被修改");
  });
});
