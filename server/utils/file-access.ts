// Ported from pi-web lib/file-access.ts — https://github.com/agegr/pi-web (MIT)
// 文件访问的允许根集合 所有 /api/files 与 file-index 的路径先过这里
// 根 = 已有会话的 cwd 与项目根 加 validate 显式授权的目录
// 短 TTL 缓存 否则每次文件请求都要重扫全部会话

import { listSessions } from "./session-reader";
import { isExistingPathWithinRoots, isPathWithinRoots } from "./path-security";
import { toNativePath } from "./paths";

const ALLOWED_ROOTS_TTL_MS = 5_000;

// validate 授权的目录 内存集合 服务重启即清 与 pi-web 一致
const additionalRoots = new Set<string>();

export function allowFileRoot(path: string): void {
  additionalRoots.add(toNativePath(path));
}

let rootsCache: { roots: Set<string>; expiresAt: number } | null = null;

export async function getAllowedFileRoots(): Promise<Set<string>> {
  if (rootsCache && rootsCache.expiresAt > Date.now()) return rootsCache.roots;

  const roots = new Set<string>(additionalRoots);
  for (const session of await listSessions()) {
    if (session.cwd) roots.add(session.cwd);
    // 项目根 主仓库被全部 worktree 共享 无会话的 worktree 也要能浏览
    if (session.projectRoot) roots.add(session.projectRoot);
    if (session.worktreePath) roots.add(session.worktreePath);
  }

  rootsCache = { roots, expiresAt: Date.now() + ALLOWED_ROOTS_TTL_MS };
  return roots;
}

export function invalidateAllowedRootsCache(): void {
  rootsCache = null;
}

// 词法授权 不碰文件系统
export function isFilePathAllowed(target: string, allowedRoots: Set<string>): boolean {
  return isPathWithinRoots(target, allowedRoots);
}

// 存在路径的授权 先 realpath 消解符号链接再比较
export function isExistingFilePathAllowed(target: string, allowedRoots: Set<string>): boolean {
  return isExistingPathWithinRoots(target, allowedRoots);
}
