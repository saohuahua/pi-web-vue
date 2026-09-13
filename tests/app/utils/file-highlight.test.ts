import { describe, expect, it } from "vitest";
import { highlightFile } from "~/utils/file-highlight";

describe("file highlight", () => {
  it("未知语言会转义而不是写入原始 HTML", () => {
    expect(highlightFile("<script>alert(1)</script>", "text")).toContain("&lt;script&gt;");
  });

  it("已注册语言输出高亮 token", () => {
    expect(highlightFile("const value = 1", "javascript")).toContain("hljs-keyword");
  });
});
