import { describe, expect, it } from "vitest";
import { getFileExt, getImageMime, getLanguage, isImagePath } from "#server/utils/file-types";

describe("file-types", () => {
  it("扩展名小写取自路径末段", () => {
    expect(getFileExt("D:\\repo\\A.PNG")).toBe("png");
    expect(getFileExt("/repo/noext")).toBe("noext");
  });

  it("图片 MIME 映射 其余返回 null", () => {
    expect(getImageMime("a.png")).toBe("image/png");
    expect(getImageMime("b.jpeg")).toBe("image/jpeg");
    expect(getImageMime("c.svg")).toBe("image/svg+xml");
    expect(getImageMime("d.ts")).toBeNull();
    expect(isImagePath("a.png")).toBe(true);
    expect(isImagePath("a.ts")).toBe(false);
  });

  it("语言推导覆盖全名匹配与扩展名", () => {
    expect(getLanguage("Dockerfile")).toBe("dockerfile");
    expect(getLanguage(".env")).toBe("bash");
    expect(getLanguage("Makefile")).toBe("makefile");
    expect(getLanguage("a.vue")).toBe("xml");
    expect(getLanguage("a.ts")).toBe("typescript");
    expect(getLanguage("a.unknown")).toBe("text");
  });
});
