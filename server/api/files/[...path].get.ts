import { createReadStream, readdirSync, readFileSync, statSync, type Dirent, type Stats } from "node:fs";
import { Readable } from "node:stream";
import { join } from "node:path";
import { filePathFromApiSegments } from "#shared/lib/file-paths";
import type { FileEntry, FileListResponse, FileTextContent } from "#shared/lib/types";
import {
  getAllowedFileRoots,
  isExistingFilePathAllowed,
  isFilePathAllowed,
} from "../../utils/file-access";
import { IMAGE_PREVIEW_MAX_BYTES, TEXT_PREVIEW_MAX_BYTES, getImageMime, getLanguage } from "../../utils/file-types";

// 与 file-index 一致的跳过清单 git 仓库除外 那里靠 gitignore
const IGNORED_NAMES = new Set([
  "node_modules", ".git", ".nuxt", ".output", ".next", "dist", "build", "__pycache__",
  ".turbo", ".cache", "coverage", ".pytest_cache", ".mypy_cache", "target", "vendor", ".DS_Store",
]);
const IGNORED_SUFFIXES = [".pyc"];

// dirent 无目录类型信息的文件系统用 stat 兜底 符号链接也走这里
function resolveDirentIsDirectory(dirent: Dirent, fullPath: string): boolean | null {
  if (dirent.isDirectory()) return true;
  if (dirent.isFile()) return false;
  try {
    return statSync(fullPath).isDirectory();
  } catch {
    return null;
  }
}

// Nitro catch-all 参数可能是 string 或 string[] 统一成段数组
function pathSegments(raw: unknown): string[] {
  const joined = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
  return joined.split("/").filter(Boolean).map((seg) => decodeURIComponent(seg));
}

// GET /api/files/<path>?type=list|read
// 安全规则 词法包含与 realpath 包含都过 .. 同前缀目录与符号链接逃逸在此拦截
export default defineEventHandler(async (event) => {
  try {
    const filePath = filePathFromApiSegments(pathSegments(event.context.params?.path));
    const type = getQuery(event).type === "read" ? "read" : "list";

    const allowedRoots = await getAllowedFileRoots();
    if (!isFilePathAllowed(filePath, allowedRoots)) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }

    let stat: Stats | undefined;
    try {
      stat = statSync(filePath);
    } catch {
      setResponseStatus(event, 404);
      return { error: "Not found" };
    }
    if (!isExistingFilePathAllowed(filePath, allowedRoots)) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }

    if (type === "read") {
      if (!stat.isFile()) {
        setResponseStatus(event, 400);
        return { error: "Not a file" };
      }
      // 图片直接以二进制流返回 Web Response 与 SSE 路由同构
      const imageMime = getImageMime(filePath);
      if (imageMime) {
        if (stat.size > IMAGE_PREVIEW_MAX_BYTES) {
          setResponseStatus(event, 413);
          return { error: "Image too large (>10MB)" };
        }
        // SVG 是唯一会被浏览器当文档执行的预览类型 加 CSP 防注入脚本
        const headers: Record<string, string> = {
          "Content-Type": imageMime,
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
          ...(imageMime === "image/svg+xml"
            ? { "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" }
            : {}),
        };
        return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>, { headers });
      }
      // 非图片二进制没有预览 由前端提示下载或交给 agent 工具
      const buf = readFileSync(filePath);
      const hasNul = buf.subarray(0, 4096).includes(0);
      if (hasNul) {
        setResponseStatus(event, 415);
        return { error: "该文件是二进制 暂不支持预览" };
      }
      if (stat.size > TEXT_PREVIEW_MAX_BYTES) {
        // 截断到上限并标记 完整内容交给 agent 的 read 工具
        const content = buf.subarray(0, TEXT_PREVIEW_MAX_BYTES).toString("utf8");
        const body: FileTextContent = {
          kind: "text", content, language: getLanguage(filePath), size: stat.size, truncated: true,
        };
        return body;
      }
      const body: FileTextContent = {
        kind: "text",
        content: buf.toString("utf8"),
        language: getLanguage(filePath),
        size: stat.size,
        truncated: false,
      };
      return body;
    }

    // type === list
    if (!stat.isDirectory()) {
      setResponseStatus(event, 400);
      return { error: "Not a directory" };
    }

    const dirents = readdirSync(filePath, { withFileTypes: true });
    const entries: FileEntry[] = dirents
      .filter((d) => !IGNORED_NAMES.has(d.name) && !IGNORED_SUFFIXES.some((s) => d.name.endsWith(s)))
      .flatMap((d) => {
        const isDir = resolveDirentIsDirectory(d, join(filePath, d.name));
        return isDir === null ? [] : [{ name: d.name, isDir }];
      })
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const body: FileListResponse = { entries, path: filePath };
    return body;
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
