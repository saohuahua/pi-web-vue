import { describe, expect, it } from "vitest";
import { imageDataUrl } from "#shared/lib/images";

describe("imageDataUrl", () => {
  it("支持旧会话扁平格式的工具结果图片", () => {
    expect(imageDataUrl({
      type: "image",
      data: "aGVsbG8=",
      mimeType: "image/png",
    })).toBe("data:image/png;base64,aGVsbG8=");
  });

  it("支持当前格式的 base64 与 URL 图片", () => {
    expect(imageDataUrl({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "d29ybGQ=" },
    })).toBe("data:image/jpeg;base64,d29ybGQ=");
    expect(imageDataUrl({
      type: "image",
      source: { type: "url", url: "/api/image" },
    })).toBe("/api/image");
  });

  it("对缺失图片字段安全降级", () => {
    expect(imageDataUrl({ type: "image" })).toBe("");
  });
});
