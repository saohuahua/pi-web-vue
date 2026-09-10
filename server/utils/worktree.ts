// Ported from pi-web lib/worktree.ts — https://github.com/agegr/pi-web (MIT)
// cwd 到项目身份的解析与已有 worktree 列表
// 首版只列出与切换 不实现创建与删除 涉及分支创建与脏目录确认
//
// 关键规则 worktree 的 git rev-parse --git-common-dir 指向主仓库的 .git 目录
// 其父目录就是所有 worktree 共享的项目根 非 git 目录解析为自身
// 结果带 TTL 缓存 同一项目的多个会话只触发一次 git 调用

import { execFile } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { samePath, toNativePath } from "./paths";

const execFileAsync = promisify(execFile);

export interface ProjectInfo {
  projectRoot: string;
  /** cwd 的当前分支 非 git 目录或 detached HEAD 时为 null */
  branch: string | null;
  /** cwd 是链接 worktree 而不是主检出 */
  isWorktree: boolean;
  /** cwd 是检出的顶层目录 主检出或链接 worktree 皆是
   *  仓库子目录与非 git 目录为 false worktree 切换只在顶层有意义 */
  isTopLevel: boolean;
}

export interface RawWorktree {
  path: string;
  branch: string | null;
  isMain: boolean;
}

const PROJECT_CACHE_TTL_MS = 60_000;
const projectCache = new Map<string, { info: ProjectInfo; expiresAt: number }>();

export function invalidateProjectCache(): void {
  projectCache.clear();
}

// LC_ALL 固定 C 让错误文本匹配不受系统语言影响
async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, LC_ALL: "C" },
  });
  return stdout.trim();
}

function realPathOrSelf(filePath: string): string {
  try {
    return realpathSync(filePath);
  } catch {
    return filePath;
  }
}

// pi-web 的 addWorktree 把 worktree 放在 <repoRoot>-worktrees/<dir>
// 目录已删除时把它的会话并回主仓库 而不是留一个幽灵项目
function inferRemovedWorktree(cwd: string): ProjectInfo | null {
  const parent = dirname(cwd);
  if (!parent.endsWith("-worktrees")) return null;
  const repoRoot = parent.slice(0, -"-worktrees".length);
  if (!repoRoot || !existsSync(join(repoRoot, ".git"))) return null;
  return { projectRoot: realPathOrSelf(repoRoot), branch: basename(cwd), isWorktree: true, isTopLevel: true };
}

export async function resolveProject(cwd: string): Promise<ProjectInfo> {
  const cached = projectCache.get(cwd);
  if (cached && cached.expiresAt > Date.now()) return cached.info;

  let info: ProjectInfo;
  try {
    if (!existsSync(cwd)) {
      info = inferRemovedWorktree(cwd)
        ?? { projectRoot: cwd, branch: null, isWorktree: false, isTopLevel: false };
      projectCache.set(cwd, { info, expiresAt: Date.now() + PROJECT_CACHE_TTL_MS });
      return info;
    }
    const out = await git(cwd, [
      "rev-parse", "--path-format=absolute",
      "--git-common-dir", "--git-dir", "--show-toplevel",
      "--abbrev-ref", "HEAD",
    ]);
    const lines = out.split("\n").map((l) => l.trim());
    const commonDirRaw = lines[0];
    const gitDirRaw = lines[1];
    const toplevelRaw = lines[2];
    const ref = lines[3];
    // 输出行数不足说明 git 行为异常 抛给外层按非 git 项目回退
    if (!commonDirRaw || !gitDirRaw || !toplevelRaw) {
      throw new Error("unexpected git rev-parse output");
    }
    // 前三行是路径要转本机分隔符 ref 是分支名 保留正斜杠 feature/foo
    const commonDir = toNativePath(commonDirRaw);
    const gitDir = toNativePath(gitDirRaw);
    const toplevel = toNativePath(toplevelRaw);
    // git 输出的是已消解符号链接的路径 cwd 用同样方式归一化再比较
    const realCwd = realPathOrSelf(cwd);
    // 只有 worktree 顶层折叠进主仓库 仓库子目录保持自身项目身份
    // 否则老用户已有会话的新建位置会被改变
    const isTopLevel = samePath(toplevel, realCwd);
    const isWorktreeTopLevel = !samePath(gitDir, commonDir) && isTopLevel;
    const topLevelProjectRoot = isWorktreeTopLevel ? dirname(commonDir) : toplevel;
    info = {
      projectRoot: isTopLevel ? realPathOrSelf(topLevelProjectRoot) : cwd,
      branch: ref && ref !== "HEAD" ? ref : null,
      isWorktree: isWorktreeTopLevel,
      isTopLevel,
    };
  } catch {
    info = { projectRoot: cwd, branch: null, isWorktree: false, isTopLevel: false };
  }

  projectCache.set(cwd, { info, expiresAt: Date.now() + PROJECT_CACHE_TTL_MS });
  return info;
}

// porcelain 输出解析拆成纯函数便于测试 输入形如
// worktree D:/repo
// branch refs/heads/main
// 空行分隔条目 prunable 条目指向已失效目录 直接跳过
export function parseWorktreeList(
  out: string,
  exists: (path: string) => boolean = existsSync,
): RawWorktree[] {
  const worktrees: RawWorktree[] = [];
  let current: (Partial<RawWorktree> & { prunable?: boolean }) | null = null;

  const flush = () => {
    if (current?.path) {
      // prunable worktree 指向缺失或损坏的 gitdir 无法浏览与选择
      // git 尚未标记但路径已消失的也跳过
      if (!current.prunable && exists(current.path)) {
        worktrees.push({
          path: current.path,
          branch: current.branch ?? null,
          isMain: worktrees.length === 0,
        });
      }
    }
    current = null;
  };

  for (const line of out.split("\n")) {
    if (line.startsWith("worktree ")) {
      flush();
      current = { path: toNativePath(line.slice("worktree ".length).trim()) };
    } else if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch ".length).trim().replace(/^refs\/heads\//, "");
    } else if (line.startsWith("prunable") && current) {
      current.prunable = true;
    } else if (line.trim() === "") {
      flush();
    }
  }
  flush();
  return worktrees;
}

export async function listWorktrees(cwd: string): Promise<RawWorktree[]> {
  const out = await git(cwd, ["worktree", "list", "--porcelain"]);
  return parseWorktreeList(out);
}

export function findCurrentWorktreePath(worktrees: readonly RawWorktree[], cwd: string): string | null {
  const realCwd = realPathOrSelf(cwd);
  return worktrees.find((w) => samePath(w.path, realCwd))?.path ?? null;
}
