import { describe, expect, it } from "vitest";
import {
  getBase64DecodedByteLength,
  isBase64ImageWithinLimits,
  MAX_ATTACHED_IMAGES,
  validateAgentImages,
} from "#shared/lib/image-attachments";

describe("getBase64DecodedByteLength", () => {
  it("合法 base64 计算解码后字节数", () => {
    expect(getBase64DecodedByteLength("aGVsbG8=")).toBe(5);
    expect(getBase64DecodedByteLength("aGVsbG8h")).toBe(6);
    expect(getBase64DecodedByteLength("aGk=")).toBe(2);
  });

  it("空串与长度非 4 倍数返回 null", () => {
    expect(getBase64DecodedByteLength("")).toBeNull();
    expect(getBase64DecodedByteLength("abc")).toBeNull();
    expect(getBase64DecodedByteLength("abcde")).toBeNull();
  });

  it("data URI 前缀与空白字符都是非法 base64", () => {
    expect(getBase64DecodedByteLength("data:image/png;base64,aGVsbG8=")).toBeNull();
    expect(getBase64DecodedByteLength("aGVs bG8=")).toBeNull();
    expect(getBase64DecodedByteLength("aGVs\nbG8=")).toBeNull();
  });

  it("填充位只允许出现在末尾", () => {
    expect(getBase64DecodedByteLength("aGVsb=G=")).toBeNull();
    expect(getBase64DecodedByteLength("====")).toBeNull();
  });
});

describe("isBase64ImageWithinLimits", () => {
  it("合法图片数据通过", () => {
    expect(isBase64ImageWithinLimits({ data: "aGVsbG8=", mimeType: "image/png" })).toBe(true);
  });

  it("非 image MIME 与结构错误都拒绝", () => {
    expect(isBase64ImageWithinLimits({ data: "aGVsbG8=", mimeType: "text/plain" })).toBe(false);
    expect(isBase64ImageWithinLimits({ data: 123, mimeType: "image/png" })).toBe(false);
    expect(isBase64ImageWithinLimits(null)).toBe(false);
    expect(isBase64ImageWithinLimits("x")).toBe(false);
  });

  it("解码后超过 10MB 拒绝", () => {
    // 13981016 个字符解码后约 10485762 字节 刚好越界
    const oversized = "A".repeat(13_981_016);
    expect(isBase64ImageWithinLimits({ data: oversized, mimeType: "image/png" })).toBe(false);
  });
});

describe("validateAgentImages", () => {
  it("undefined 与空数组放行", () => {
    expect(validateAgentImages(undefined)).toBeNull();
    expect(validateAgentImages([])).toBeNull();
  });

  it("非数组与元素结构错误返回错误信息", () => {
    expect(validateAgentImages("nope")).toBe("images must be an array");
    expect(validateAgentImages([{ type: "text", text: "hi" }])).toBe("Each attachment must be an image");
    expect(validateAgentImages([{ type: "image", data: "!!!", mimeType: "image/png" }])).toMatch(/base64/);
  });

  it("超过数量上限拒绝 恰好 10 张放行", () => {
    const image = { type: "image", data: "aGk=", mimeType: "image/png" };
    expect(validateAgentImages(Array.from({ length: MAX_ATTACHED_IMAGES }, () => image))).toBeNull();
    expect(validateAgentImages(Array.from({ length: MAX_ATTACHED_IMAGES + 1 }, () => image)))
      .toBe(`A message can include at most ${MAX_ATTACHED_IMAGES} images`);
  });
});
