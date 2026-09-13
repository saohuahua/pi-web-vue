import { describe, expect, it } from "vitest";
import { extractTextBlocks } from "#shared/lib/message-text";

describe("extractTextBlocks", () => {
  it("字符串 content 原样返回单块", () => {
    expect(extractTextBlocks("你好")).toEqual(["你好"]);
  });

  it("数组 content 只保留 text 块并保序", () => {
    expect(extractTextBlocks([
      { type: "image", source: { type: "base64", data: "aGk=" } },
      { type: "text", text: "第一段" },
      { type: "text", text: "第二段" },
    ])).toEqual(["第一段", "第二段"]);
  });

  it("文件里读出的畸形块不会让整个提取失败", () => {
    expect(extractTextBlocks([
      null,
      "混进来的字符串",
      { type: "text" },
      { type: "text", text: 123 },
      { type: "thinking", thinking: "不是文本" },
    ])).toEqual([]);
    expect(extractTextBlocks(undefined)).toEqual([]);
    expect(extractTextBlocks({ type: "text", text: "对象不是数组" })).toEqual([]);
  });
});
