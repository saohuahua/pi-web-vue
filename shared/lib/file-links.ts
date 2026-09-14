// Ported from pi-web lib/file-links.ts — https://github.com/agegr/pi-web (MIT)
// md 内本地文件链接解析 纯函数 浏览器端消费
// 越界与存在性不在这里校验 服务端 getAllowedFileRoots 已兜底 这里只管把 href 解析成绝对路径

import { normalizeFilePathSlashes } from "./file-paths";

interface LocalFileClickEvent {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

// 普通左键与平台主修饰键都在应用内打开 file:// 导航会被浏览器拦 修饰键组合交给浏览器默认行为
export const shouldOpenLocalFileInApp = (event: LocalFileClickEvent): boolean =>
  !event.defaultPrevented && event.button === 0 && !event.shiftKey && !event.altKey;

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// 链接尾部 :12 或 :12:34 是编辑器行号标记 不是路径的一部分
const stripLineSuffix = (filePath: string): string => filePath.replace(/:\d+(?::\d+)?$/, "");

const normalizeLocalPath = (filePath: string): string => {
  const normalized = normalizeFilePathSlashes(filePath);
  const isWindowsDrive = /^[a-zA-Z]:\//.test(normalized);
  const isUnc = normalized.startsWith("//");
  const leadingSlash = normalized.startsWith("/") && !isWindowsDrive && !isUnc;
  const parts: string[] = [];

  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;

    if (part === "..") {
      if (parts.length > 0 && parts.at(-1) !== "..") {
        parts.pop();
      } else if (!leadingSlash && !isWindowsDrive && !isUnc) {
        parts.push(part);
      }
      continue;
    }
    parts.push(part);
  }

  const joined = parts.join("/");
  if (isWindowsDrive) return joined;
  if (isUnc) return `//${joined}`;
  return leadingSlash ? `/${joined}` : joined;
};

// 纯单词如 README.md 也算相对文件链接 要能命中 [README](README.md) 这种无斜杠写法
const looksLikeRelativeFileHref = (href: string): boolean => {
  if (href.startsWith("#") || href.startsWith("?")) return false;
  if (href.startsWith("./") || href.startsWith("../")) return true;
  if (href.includes("/")) return true;
  return /(^|\/)\.?[^/]+\.[^/.]+$/.test(href);
};

const fileUrlToPath = (href: string): string | null => {
  try {
    const url = new URL(href);
    if (url.protocol !== "file:") return null;
    const pathname = safeDecode(url.pathname);
    if (url.hostname) {
      return `//${url.hostname}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
    }
    if (/^\/[a-zA-Z]:\//.test(pathname)) return pathname.slice(1);
    return pathname;
  } catch {
    return null;
  }
};

// 把 md 里的 href 解析为绝对路径 解析不了返回 null 调用方按外链处理
// 兼容相对路径 盘符绝对路径 Unix 绝对路径与 file:// URL 并剥离行号后缀
export const resolveLocalFileHref = (href: string | undefined, baseDir?: string): string | null => {
  if (!href) return null;

  const cleanHref = (href.split("#", 1)[0] ?? "").split("?", 1)[0]?.trim() ?? "";
  if (!cleanHref) return null;

  let candidate: string | null = null;
  const decodedHref = safeDecode(cleanHref);
  const isBackslashUncPath = decodedHref.startsWith("\\\\");
  const normalizedHref = normalizeFilePathSlashes(decodedHref);
  const lowerHref = normalizedHref.toLowerCase();

  if (lowerHref.startsWith("/api/")) return null;
  if (!isBackslashUncPath && normalizedHref.startsWith("//")) return null;
  if (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(normalizedHref) &&
    !lowerHref.startsWith("file:") &&
    !/^[a-zA-Z]:\//.test(normalizedHref)
  ) {
    return null;
  }

  if (lowerHref.startsWith("file:")) {
    // 只解码 URL 解析出的 pathname 文件名里的编码分隔符得以保留
    candidate = fileUrlToPath(cleanHref);
  } else if (/^[a-zA-Z]:\//.test(normalizedHref)) {
    candidate = normalizedHref;
  } else if (normalizedHref.startsWith("/")) {
    candidate = normalizedHref;
  } else if (baseDir && looksLikeRelativeFileHref(normalizedHref)) {
    candidate = `${normalizeFilePathSlashes(baseDir).replace(/\/+$/, "")}/${normalizedHref}`;
  }

  if (!candidate) return null;
  return stripLineSuffix(normalizeLocalPath(candidate));
};
