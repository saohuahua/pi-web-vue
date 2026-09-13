import { describe, expect, it } from "vitest";
import { buildEntriesFromFiles, extractAtQuery, filterFileEntries } from "~/utils/at-query";

describe("extractAtQuery", () => {
  it("行首与空白后的 @ 触发 邮箱不触发", () => {
    expect(extractAtQuery("@app/comp")).toEqual({ start: 0, query: "app/comp", quoted: false });
    expect(extractAtQuery("看看 @src/main")).toEqual({ start: 3, query: "src/main", quoted: false });
    expect(extractAtQuery("foo@bar.com")).toBeNull();
  });

  it("引号形式支持含空格路径下钻", () => {
    expect(extractAtQuery('引用 @"my dir/fi')).toEqual({ start: 3, query: "my dir/fi", quoted: true });
  });

  it("@ 后紧跟引号或无查询也能触发", () => {
    expect(extractAtQuery("看这个 @")).toEqual({ start: 4, query: "", quoted: false });
  });
});

describe("buildEntriesFromFiles", () => {
  it("从文件路径推导目录条目 浅路径优先同深度按字母", () => {
    const entries = buildEntriesFromFiles(["b/one.ts", "a/two.ts", "a/deep/three.ts"]);
    expect(entries).toEqual([
      { path: "a", isDir: true },
      { path: "b", isDir: true },
      { path: "a/deep", isDir: true },
      { path: "a/two.ts", isDir: false },
      { path: "b/one.ts", isDir: false },
      { path: "a/deep/three.ts", isDir: false },
    ]);
  });
});

describe("filterFileEntries", () => {
  const entries = buildEntriesFromFiles([
    "app/components/ChatInput.vue",
    "app/components/ChatPanel.vue",
    "app/stores/chat.ts",
    "shared/lib/types.ts",
  ]);

  it("空查询返回默认序前 N 条", () => {
    expect(filterFileEntries(entries, "", 3)).toHaveLength(3);
  });

  it("无斜杠查询按文件名前缀优先 含斜杠查询按路径下钻", () => {
    const byName = filterFileEntries(entries, "chatp");
    expect(byName[0]?.path).toBe("app/components/ChatPanel.vue");

    const drill = filterFileEntries(entries, "app/stores/");
    expect(drill.map((e) => e.path)).toEqual(["app/stores/chat.ts"]);
  });

  it("目录条目在同分时排前", () => {
    const withDir = buildEntriesFromFiles(["src/a.ts", "src"]);
    expect(filterFileEntries(withDir, "src")[0]?.isDir).toBe(true);
  });

  it("子序列模糊匹配兜底", () => {
    const hit = filterFileEntries(entries, "chinp");
    expect(hit.some((e) => e.path === "app/components/ChatInput.vue")).toBe(true);
  });
});
