import { describe, expect, it } from "vitest";
import {
  encodeFilePathForApi,
  filePathFromApiSegments,
  getFileName,
  getRelativeFilePath,
  normalizeFilePathSlashes,
} from "#shared/lib/file-paths";

describe("normalizeFilePathSlashes", () => {
  it("Windows 绝对路径转正斜杠 POSIX 路径原样", () => {
    expect(normalizeFilePathSlashes("D:\\repo\\sub")).toBe("D:/repo/sub");
    expect(normalizeFilePathSlashes("/home/u/repo")).toBe("/home/u/repo");
    expect(normalizeFilePathSlashes("repo\\sub")).toBe("repo\\sub");
  });
});

describe("encodeFilePathForApi 与 filePathFromApiSegments 互逆", () => {
  it("编码再解码重建得到原路径", () => {
    const path = "D:/project/my repo/文件.ts";
    const encoded = encodeFilePathForApi(path).split("/");
    // 路由层先逐段 decodeURIComponent 再重建 这里模拟同一流程
    expect(filePathFromApiSegments(encoded.map(decodeURIComponent))).toBe(path);
  });

  it("盘符根补斜杠 POSIX 根不双斜杠", () => {
    expect(filePathFromApiSegments(["D:"])).toBe("D:/");
    expect(filePathFromApiSegments(["home", "u"])).toBe("/home/u");
  });
});

describe("getFileName 与 getRelativeFilePath", () => {
  it("取末段并容忍尾部分隔符", () => {
    expect(getFileName("D:\\repo\\a.ts")).toBe("a.ts");
    expect(getFileName("/repo/b/")).toBe("b");
  });

  it("cwd 内取相对路径 cwd 外原样返回", () => {
    expect(getRelativeFilePath("D:/repo/sub/a.ts", "D:/repo")).toBe("sub/a.ts");
    expect(getRelativeFilePath("D:/other/a.ts", "D:/repo")).toBe("D:/other/a.ts");
    // Windows 反斜杠 cwd 也能对上
    expect(getRelativeFilePath("D:/repo/a.ts", "D:\\repo")).toBe("a.ts");
  });
});
