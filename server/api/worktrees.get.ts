import { existsSync } from "node:fs";
import type { WorktreesResponse, WorktreeInfo } from "#shared/lib/types";
import { allowFileRoot } from "../utils/file-access";
import { projectIdentityKey } from "../utils/project-identity";
import { samePath } from "../utils/paths";
import { findCurrentWorktreePath, listWorktrees, resolveProject } from "../utils/worktree";

// GET /api/worktrees?cwd=  项目下已有 worktree 与当前分支
// 非 git 项目返回空列表与 isGit false 不报错 前端据此隐藏分支选择器
export default defineEventHandler(async (event) => {
  try {
    const cwd = getQuery(event).cwd;
    if (typeof cwd !== "string" || !cwd) {
      setResponseStatus(event, 400);
      return { error: "cwd is required" };
    }

    const project = await resolveProject(cwd);
    let worktrees: Awaited<ReturnType<typeof listWorktrees>> = [];
    let currentWorktreePath: string | null = null;
    let isGit = true;
    try {
      // worktree 已删除的会话 cwd 退回推断出的项目根 选择器仍能显示该项目
      worktrees = await listWorktrees(existsSync(cwd) ? cwd : project.projectRoot);
      currentWorktreePath = findCurrentWorktreePath(worktrees, cwd);
    } catch {
      isGit = false;
    }

    const enriched: WorktreeInfo[] = worktrees.map((w) => ({
      ...w,
      isCurrent: currentWorktreePath !== null && samePath(w.path, currentWorktreePath),
    }));

    // 列出的都是该仓库的合法 worktree 授权浏览 无会话的 worktree 也能进文件树
    for (const w of enriched) allowFileRoot(w.path);

    const response: WorktreesResponse = {
      projectRoot: project.projectRoot,
      projectKey: projectIdentityKey(project.projectRoot),
      isGit,
      isTopLevel: project.isTopLevel,
      currentBranch: project.branch,
      currentWorktreePath,
      worktrees: enriched,
    };
    return response;
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
