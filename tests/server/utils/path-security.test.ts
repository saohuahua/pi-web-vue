import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isExistingPathWithinRoots, isPathWithinRoots, isWindowsAbsolutePath } from "#server/utils/path-security";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-path-security-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("isWindowsAbsolutePath", () => {
  it("识别盘符 UNC 与正反斜杠形式", () => {
    expect(isWindowsAbsolutePath("D:\\repo")).toBe(true);
    expect(isWindowsAbsolutePath("d:/repo")).toBe(true);
    expect(isWindowsAbsolutePath("\\\\server\\share")).toBe(true);
    expect(isWindowsAbsolutePath("//server/share")).toBe(true);
    expect(isWindowsAbsolutePath("/home/user")).toBe(false);
    expect(isWindowsAbsolutePath("repo/sub")).toBe(false);
  });
});

describe("isPathWithinRoots", () => {
  it("根内路径通过", () => {
    expect(isPathWithinRoots("D:\\repo\\sub\\file.txt", new Set(["D:\\repo"]))).toBe(true);
    expect(isPathWithinRoots("/home/user/repo/a.txt", new Set(["/home/user/repo"]))).toBe(true);
  });

  it("同前缀目录不能绕过 根必须以分隔符收尾", () => {
    // 裸 startsWith 会把 repo-evil 误判进 repo
    expect(isPathWithinRoots("D:\\repo-evil\\file.txt", new Set(["D:\\repo"]))).toBe(false);
    expect(isPathWithinRoots("/home/user/repo-evil/a.txt", new Set(["/home/user/repo"]))).toBe(false);
  });

  it("点号逃逸在 resolve 后被识破", () => {
    expect(isPathWithinRoots("D:\\repo\\..\\secret.txt", new Set(["D:\\repo"]))).toBe(false);
    expect(isPathWithinRoots("/home/user/repo/../../etc/passwd", new Set(["/home/user/repo"]))).toBe(false);
  });

  it("Windows 规则下大小写与分隔符风格不影响结果", () => {
    expect(isPathWithinRoots("d:\\REPO\\sub", new Set(["D:\\repo"]))).toBe(true);
    expect(isPathWithinRoots("D:/repo/sub", new Set(["D:\\repo"]))).toBe(true);
  });

  it("根自身算在根内", () => {
    expect(isPathWithinRoots("D:\\repo", new Set(["D:\\repo"]))).toBe(true);
  });
});

describe("isExistingPathWithinRoots", () => {
  it("不存在的目标直接拒绝", () => {
    const dir = makeTempDir();
    expect(isExistingPathWithinRoots(join(dir, "nope.txt"), new Set([dir]))).toBe(false);
  });

  it("根内真实文件通过 根外文件拒绝", () => {
    const dir = makeTempDir();
    const root = join(dir, "allowed");
    mkdirSync(root);
    writeFileSync(join(root, "real.txt"), "x");
    writeFileSync(join(dir, "outside.txt"), "x");

    expect(isExistingPathWithinRoots(join(root, "real.txt"), new Set([root]))).toBe(true);
    expect(isExistingPathWithinRoots(join(dir, "outside.txt"), new Set([root]))).toBe(false);
  });

  it("符号链接逃逸被 realpath 消解后拒绝", () => {
    const dir = makeTempDir();
    const root = join(dir, "allowed");
    mkdirSync(root);
    const outside = join(dir, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "secret.txt"), "x");
    const link = join(root, "link");
    // Windows 使用无需开发者模式的目录联接
    symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
    expect(isPathWithinRoots(join(link, "secret.txt"), new Set([root]))).toBe(true);
    expect(isExistingPathWithinRoots(join(link, "secret.txt"), new Set([root]))).toBe(false);
  });

  it("失效的根被忽略 不影响其他根的判断", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "f.txt"), "x");
    expect(isExistingPathWithinRoots(join(dir, "f.txt"), new Set([join(dir, "gone"), dir]))).toBe(true);
  });
});
