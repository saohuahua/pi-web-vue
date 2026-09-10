import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { FileIndexResponse } from "#shared/lib/types";
import { getAllowedFileRoots, isExistingFilePathAllowed, isFilePathAllowed } from "../utils/file-access";

const execFileAsync = promisify(execFile);

// git 仓库用 ls-files 尊重 gitignore 与 TUI 的 fd 行为一致
// 非 git 目录退回 readdir 游走 有深度与数量上限
const GIT_HARD_CAP = 200_000;
const WALK_HARD_CAP = 50_000;
const MAX_WALK_DEPTH = 8;
const MAX_QUERY_LENGTH = 500;
// 空查询返回给客户端自建索引的上限 @ 补全与文件搜索都够用
const MAX_CLIENT_FILES = 5000;
// 带查询时返回的结果上限
const MAX_RESULTS = 100;
const CACHE_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 20;

const IGNORED_NAMES = new Set([
  "node_modules", ".git", ".nuxt", ".output", ".next", "dist", "build", "__pycache__",
  ".turbo", ".cache", "coverage", ".pytest_cache", ".mypy_cache", "target", "vendor", ".DS_Store",
]);
const IGNORED_SUFFIXES = [".pyc"];

interface CacheEntry {
  files: string[];
  expiresAt: number;
}

// @ 菜单每次打开每个按键都会请求 必须有短缓存
const indexCache = new Map<string, CacheEntry>();

async function listGitFiles(cwd: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, "ls-files"], {
      timeout: 10_000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, LC_ALL: "C" },
    });
    return stdout.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, GIT_HARD_CAP);
  } catch {
    return null;
  }
}

function walkFiles(dir: string, depth: number, out: string[]): void {
  if (depth > MAX_WALK_DEPTH || out.length >= WALK_HARD_CAP) return;
  let dirents;
  try {
    dirents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of dirents) {
    if (out.length >= WALK_HARD_CAP) return;
    if (IGNORED_NAMES.has(d.name) || IGNORED_SUFFIXES.some((s) => d.name.endsWith(s))) continue;
    const full = join(dir, d.name);
    if (d.isDirectory()) {
      walkFiles(full, depth + 1, out);
    } else if (d.isFile()) {
      out.push(full);
    }
  }
}

// 相对 cwd 的正斜杠路径 列表接口只吐文件 目录由前端从路径推导
async function buildIndex(cwd: string): Promise<string[]> {
  const gitFiles = await listGitFiles(cwd);
  if (gitFiles) return gitFiles.map((f) => f.replace(/\\/g, "/"));

  const absolute: string[] = [];
  walkFiles(cwd, 0, absolute);
  const prefix = cwd.replace(/\\/g, "/").replace(/\/$/, "") + "/";
  return absolute.map((f) => f.replace(/\\/g, "/").slice(prefix.length));
}

// GET /api/file-index?cwd=&q=
// 为 @ 补全与文件搜索提供有上限的相对路径索引
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const cwd = typeof query.cwd === "string" ? query.cwd : "";
    if (!cwd) {
      setResponseStatus(event, 400);
      return { error: "cwd is required" };
    }
    const q = (typeof query.q === "string" ? query.q : "").trim().toLowerCase();
    if (q.length > MAX_QUERY_LENGTH) {
      setResponseStatus(event, 400);
      return { error: "Query too long" };
    }

    // cwd 未授权直接拒绝 索引只对允许根开放
    const allowedRoots = await getAllowedFileRoots();
    if (!isFilePathAllowed(cwd, allowedRoots) || !isExistingFilePathAllowed(cwd, allowedRoots)) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }

    let cached = indexCache.get(cwd);
    if (!cached || cached.expiresAt < Date.now()) {
      const files = await buildIndex(cwd);
      cached = { files, expiresAt: Date.now() + CACHE_TTL_MS };
      indexCache.set(cwd, cached);
      if (indexCache.size > CACHE_MAX_ENTRIES) {
        // 淘汰最旧条目 Map 迭代序即插入序
        const oldest = indexCache.keys().next().value;
        if (oldest !== undefined) indexCache.delete(oldest);
      }
    }

    // 空查询返回全量给前端自建索引 截到客户端上限
    // 有查询时按包含匹配 服务端截断
    let files = cached.files;
    let truncated = false;
    if (q) {
      const matched = files.filter((f) => f.toLowerCase().includes(q));
      files = matched.slice(0, MAX_RESULTS);
      truncated = matched.length > MAX_RESULTS;
    } else if (files.length > MAX_CLIENT_FILES) {
      files = files.slice(0, MAX_CLIENT_FILES);
      truncated = true;
    }
    const body: FileIndexResponse = { files, truncated };
    return body;
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
