import { describe, expect, it } from "vitest";
import { resolveLocalFileHref, shouldOpenLocalFileInApp } from "#shared/lib/file-links";

describe("resolveLocalFileHref", () => {
  const baseDir = "D:/project/repo/docs";

  it("相对路径按 md 所在目录解析", () => {
    expect(resolveLocalFileHref("./guide.md", baseDir)).toBe("D:/project/repo/docs/guide.md");
    expect(resolveLocalFileHref("guide.md", baseDir)).toBe("D:/project/repo/docs/guide.md");
    expect(resolveLocalFileHref("../README.md", baseDir)).toBe("D:/project/repo/README.md");
    expect(resolveLocalFileHref("img/a.png", baseDir)).toBe("D:/project/repo/docs/img/a.png");
  });

  it("盘符与 Unix 绝对路径原样归一", () => {
    expect(resolveLocalFileHref("D:/other/plan.md", baseDir)).toBe("D:/other/plan.md");
    expect(resolveLocalFileHref("/home/u/plan.md", baseDir)).toBe("/home/u/plan.md");
  });

  it("file:// URL 解析为文件系统路径", () => {
    expect(resolveLocalFileHref("file:///D:/repo/plan.md", baseDir)).toBe("D:/repo/plan.md");
    expect(resolveLocalFileHref("file:///home/u/plan.md", baseDir)).toBe("/home/u/plan.md");
  });

  it("剥掉编辑器行号后缀", () => {
    expect(resolveLocalFileHref("./guide.md:12", baseDir)).toBe("D:/project/repo/docs/guide.md");
    expect(resolveLocalFileHref("./guide.md:12:34", baseDir)).toBe("D:/project/repo/docs/guide.md");
  });

  it("http 协议与页内锚点不解析", () => {
    expect(resolveLocalFileHref("https://example.com/a.md", baseDir)).toBeNull();
    expect(resolveLocalFileHref("mailto:a@b.com", baseDir)).toBeNull();
    expect(resolveLocalFileHref("#section", baseDir)).toBeNull();
  });

  it("本应用 API 路径不解析", () => {
    expect(resolveLocalFileHref("/api/files/D:%2Frepo?type=read", baseDir)).toBeNull();
  });

  it("无 baseDir 时相对链接不解析", () => {
    expect(resolveLocalFileHref("./guide.md")).toBeNull();
  });

  it("空 href 与锚点查询串被剥掉", () => {
    expect(resolveLocalFileHref(undefined, baseDir)).toBeNull();
    expect(resolveLocalFileHref("", baseDir)).toBeNull();
    expect(resolveLocalFileHref("./guide.md?download=1", baseDir)).toBe(
      "D:/project/repo/docs/guide.md",
    );
  });
});

describe("shouldOpenLocalFileInApp", () => {
  const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

  it("普通左键在应用内打开", () => {
    expect(shouldOpenLocalFileInApp({ ...base, defaultPrevented: false })).toBe(true);
  });

  it("修饰键组合与右键交给浏览器默认行为", () => {
    expect(shouldOpenLocalFileInApp({ ...base, defaultPrevented: false, shiftKey: true })).toBe(
      false,
    );
    expect(shouldOpenLocalFileInApp({ ...base, defaultPrevented: false, altKey: true })).toBe(
      false,
    );
    expect(shouldOpenLocalFileInApp({ ...base, defaultPrevented: false, button: 2 })).toBe(false);
  });

  it("已被上层 preventDefault 的点击不重复处理", () => {
    expect(shouldOpenLocalFileInApp({ ...base, defaultPrevented: true })).toBe(false);
  });
});
