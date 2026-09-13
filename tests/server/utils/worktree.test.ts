import { describe, expect, it } from "vitest";
import { parseWorktreeList } from "#server/utils/worktree";

// porcelain fixture 逐条覆盖 主检出 带分支 worktree detached prunable 路径已消失
const FIXTURE = [
  "worktree D:/proj/repo",
  "branch refs/heads/main",
  "",
  "worktree D:/proj/repo-worktrees/feature-x",
  "branch refs/heads/feature/x",
  "",
  "worktree D:/proj/repo-worktrees/stale",
  "branch refs/heads/stale",
  "prunable",
  "",
  "worktree D:/proj/repo-worktrees/vanished",
  "branch refs/heads/gone",
  "",
  "worktree D:/proj/repo-worktrees/detached",
  "detached",
  "",
].join("\n");

// 存在性桩 stale 存在但 prunable vanished 不存在 两种跳过路径分开验证
const existsStub = (p: string) =>
  p === "D:\\proj\\repo"
  || p === "D:\\proj\\repo-worktrees\\feature-x"
  || p === "D:\\proj\\repo-worktrees\\stale"
  || p === "D:\\proj\\repo-worktrees\\detached";

describe("parseWorktreeList", () => {
  it("解析主检出与 worktree 分支名去掉 refs/heads 前缀", () => {
    const list = parseWorktreeList(FIXTURE, existsStub);
    expect(list).toEqual([
      { path: "D:\\proj\\repo", branch: "main", isMain: true },
      { path: "D:\\proj\\repo-worktrees\\feature-x", branch: "feature/x", isMain: false },
      { path: "D:\\proj\\repo-worktrees\\detached", branch: null, isMain: false },
    ]);
  });

  it("prunable 条目即使路径仍在也跳过", () => {
    expect(parseWorktreeList(FIXTURE, existsStub).some((w) => w.path.includes("stale"))).toBe(false);
  });

  it("git 尚未标记 prunable 但路径已消失的条目也跳过", () => {
    expect(parseWorktreeList(FIXTURE, existsStub).some((w) => w.path.includes("vanished"))).toBe(false);
  });

  it("POSIX 输出转本机分隔符", () => {
    const list = parseWorktreeList("worktree D:/proj/repo\n", () => true);
    const expected = process.platform === "win32" ? "D:\\proj\\repo" : "D:/proj/repo";
    expect(list[0]?.path).toBe(expected);
  });

  it("空输出返回空列表", () => {
    expect(parseWorktreeList("", () => true)).toEqual([]);
  });
});
