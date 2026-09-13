import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getParentDirectory,
  getWindowsDriveCandidates,
  listDirectories,
  shouldShowWindowsDrivePicker,
} from "#server/utils/directory-browser";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("directory browser", () => {
  it("Windows 空路径从盘符选择开始", () => {
    expect(shouldShowWindowsDrivePicker()).toBe(process.platform === "win32");
    expect(getWindowsDriveCandidates()).toHaveLength(26);
    expect(getWindowsDriveCandidates()[0]).toEqual({ name: "A:", path: "A:\\" });
  });

  it("返回当前目录的可读子目录并按名称排序", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-directory-browser-"));
    temporaryDirectories.push(root);
    await Promise.all([mkdir(join(root, "zeta")), mkdir(join(root, "alpha"))]);

    expect((await listDirectories(root)).map((entry) => entry.name)).toEqual(["alpha", "zeta"]);
  });

  it("Windows 根目录没有上级目录", () => {
    expect(getParentDirectory("D:\\")).toBeNull();
    expect(getParentDirectory("D:\\project")).toBe("D:\\");
  });
});
