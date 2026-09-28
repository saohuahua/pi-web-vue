import { describe, expect, it } from "vitest";
import { DraftStore, mergeDraftText } from "#shared/lib/draft-store";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};

describe("每会话文字草稿", () => {
  it("隔离会话并只保存文字与编辑目标", () => {
    const storage = createStorage();
    const store = new DraftStore(
      () => storage,
      undefined,
      () => 100,
    );
    store.set("a", "文本甲", "entry-1");
    store.set("b", "文本乙");
    expect(store.get("a")).toEqual({ text: "文本甲", updatedAt: 100, editingMessageId: "entry-1" });
    expect(store.get("b")?.text).toBe("文本乙");
    expect(storage.values.get("pi-agent:drafts:v1")).not.toContain("images");
  });

  it("清理过期草稿并从损坏数据恢复", () => {
    const storage = createStorage();
    storage.setItem("pi-agent:drafts:v1", JSON.stringify({ old: { text: "旧", updatedAt: 0 } }));
    const store = new DraftStore(
      () => storage,
      undefined,
      () => 31 * 24 * 60 * 60 * 1000,
    );
    expect(store.get("old")).toBeNull();
    storage.setItem("pi-agent:drafts:v1", "{");
    expect(store.get("x")).toBeNull();
    store.set("x", "新");
    expect(store.get("x")?.text).toBe("新");
  });

  it("存储不可用时保留页面内草稿", () => {
    const warnings: string[] = [];
    const store = new DraftStore(
      () => {
        throw new Error("blocked");
      },
      (message) => warnings.push(message),
    );
    store.set("a", "继续输入");
    expect(store.get("a")?.text).toBe("继续输入");
    expect(warnings).toHaveLength(1);
  });

  it("失败内容放在新输入之前", () => {
    expect(mergeDraftText("原提交", "新输入")).toBe("原提交\n\n新输入");
  });
});
