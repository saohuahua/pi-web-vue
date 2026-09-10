import { describe, expect, it } from "vitest";
import { samePath, toNativePath } from "./paths";

describe("toNativePath", () => {
  it("git 的 POSIX 输出转本机分隔符", () => {
    const expected = process.platform === "win32" ? "D:\\repo\\sub" : "D:/repo/sub";
    expect(toNativePath("D:/repo/sub")).toBe(expected);
  });

  it("空串与非 Windows 平台原样返回", () => {
    expect(toNativePath("")).toBe("");
    if (process.platform !== "win32") {
      expect(toNativePath("D:/repo")).toBe("D:/repo");
    }
  });
});

describe("samePath", () => {
  it("分隔符风格与盘符大小写不影响相等", () => {
    expect(samePath("D:\\repo", "D:/repo")).toBe(true);
    expect(samePath("d:\\repo\\", "D:/repo")).toBe(true);
  });

  it("不同路径不相等", () => {
    expect(samePath("D:\\repo", "D:\\repo-2")).toBe(false);
    expect(samePath("D:\\repo", "")).toBe(false);
  });
});
