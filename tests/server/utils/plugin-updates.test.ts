import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkPluginUpdates,
  hasGitRef,
  isPluginSourceCheckable,
  parseNpmSource,
} from "#server/utils/plugin-updates";
import type { CommandRunner } from "#server/utils/plugin-updates";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

// 按命令行拼键返回预置输出 没命中就抛错防止测试悄悄走错分支
const fakeRunner = (responses: Record<string, string>): CommandRunner => {
  return async (command, args) => {
    const key = [command, ...args].join(" ");
    const response = responses[key];
    if (response === undefined) throw new Error(`unexpected command: ${key}`);
    return response;
  };
};

const makeTempPackage = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "pi-plugin-test-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo-pkg", version: "1.0.0" }));
  return dir;
};

describe("plugin source 解析", () => {
  it("解析 npm source 含 scoped 包", () => {
    expect(parseNpmSource("npm:demo-pkg")).toEqual({
      name: "demo-pkg",
      spec: "demo-pkg",
      version: undefined,
    });
    expect(parseNpmSource("npm:@scope/demo-pkg@1.2.3")).toEqual({
      name: "@scope/demo-pkg",
      spec: "@scope/demo-pkg@1.2.3",
      version: "1.2.3",
    });
  });

  it("非 npm source 返回 undefined", () => {
    expect(parseNpmSource("git:https://github.com/user/repo")).toBeUndefined();
    expect(parseNpmSource("C:\\plugins\\demo")).toBeUndefined();
  });

  it("git 来源的版本 ref 判定 scp 语法不误判", () => {
    expect(hasGitRef("git:https://github.com/user/repo")).toBe(false);
    expect(hasGitRef("git:https://github.com/user/repo@v1.0.0")).toBe(true);
    expect(hasGitRef("git:git@github.com:user/repo.git")).toBe(false);
  });

  it("可检查性 固定版本与本地路径不可检查", () => {
    expect(isPluginSourceCheckable("npm:demo-pkg")).toBe(true);
    expect(isPluginSourceCheckable("npm:@scope/demo-pkg")).toBe(true);
    expect(isPluginSourceCheckable("npm:demo-pkg@1.0.0")).toBe(false);
    expect(isPluginSourceCheckable("npm:demo-pkg@^1.0.0")).toBe(true);
    expect(isPluginSourceCheckable("git:https://github.com/user/repo")).toBe(true);
    expect(isPluginSourceCheckable("git:https://github.com/user/repo@v1.0.0")).toBe(false);
    expect(isPluginSourceCheckable("C:\\plugins\\demo")).toBe(false);
  });
});

describe("checkPluginUpdates", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("npm 已安装版本与远端一致时 up-to-date", async () => {
    const dir = makeTempPackage();
    tempDirs.push(dir);
    const results = await checkPluginUpdates("D:\\project", undefined, {
      packages: [{ source: "npm:demo-pkg", scope: "user", installedPath: dir }],
      runCommand: fakeRunner({ "npm view demo-pkg version --json": JSON.stringify("1.0.0") }),
    });
    expect(results[0]?.state).toBe("up-to-date");
  });

  it("npm 远端有新版本时 update-available", async () => {
    const dir = makeTempPackage();
    tempDirs.push(dir);
    const results = await checkPluginUpdates("D:\\project", undefined, {
      packages: [{ source: "npm:demo-pkg", scope: "user", installedPath: dir }],
      runCommand: fakeRunner({ "npm view demo-pkg version --json": JSON.stringify("1.1.0") }),
    });
    expect(results[0]?.state).toBe("update-available");
  });

  it("npm 固定范围时按 range 取最大满足版本 2.0.0 被排除", async () => {
    const dir = makeTempPackage();
    tempDirs.push(dir);
    const results = await checkPluginUpdates("D:\\project", undefined, {
      packages: [{ source: "npm:demo-pkg@^1.0.0", scope: "user", installedPath: dir }],
      runCommand: fakeRunner({
        "npm view demo-pkg@^1.0.0 version --json": JSON.stringify(["0.9.0", "1.0.0", "2.0.0"]),
      }),
    });
    expect(results[0]?.state).toBe("up-to-date");
  });

  it("git 本地与远端 commit 一致时 up-to-date", async () => {
    const dir = makeTempPackage();
    tempDirs.push(dir);
    const results = await checkPluginUpdates("D:\\project", undefined, {
      packages: [{ source: "git:https://github.com/user/repo", scope: "user", installedPath: dir }],
      runCommand: fakeRunner({
        "git rev-parse HEAD": `${SHA_A}\n`,
        "git rev-parse --abbrev-ref @{upstream}": "origin/main\n",
        "git ls-remote origin refs/heads/main": `${SHA_A}\trefs/heads/main\n`,
      }),
    });
    expect(results[0]?.state).toBe("up-to-date");
  });

  it("git 远端推进时 update-available", async () => {
    const dir = makeTempPackage();
    tempDirs.push(dir);
    const results = await checkPluginUpdates("D:\\project", undefined, {
      packages: [{ source: "git:https://github.com/user/repo", scope: "user", installedPath: dir }],
      runCommand: fakeRunner({
        "git rev-parse HEAD": `${SHA_A}\n`,
        "git rev-parse --abbrev-ref @{upstream}": "origin/main\n",
        "git ls-remote origin refs/heads/main": `${SHA_B}\trefs/heads/main\n`,
      }),
    });
    expect(results[0]?.state).toBe("update-available");
  });

  it("本地路径来源 unsupported 不发起命令", async () => {
    const results = await checkPluginUpdates("D:\\project", undefined, {
      packages: [
        { source: "C:\\plugins\\demo", scope: "user", installedPath: "C:\\plugins\\demo" },
      ],
      runCommand: fakeRunner({}),
    });
    expect(results[0]?.state).toBe("unsupported");
  });

  it("PI_OFFLINE=1 时返回 error 不发起网络请求", async () => {
    vi.stubEnv("PI_OFFLINE", "1");
    const results = await checkPluginUpdates("D:\\project", undefined, {
      packages: [{ source: "npm:demo-pkg", scope: "user", installedPath: "C:\\never-read" }],
      runCommand: fakeRunner({}),
    });
    expect(results[0]?.state).toBe("error");
    expect(results[0]?.message).toContain("PI_OFFLINE");
  });
});
