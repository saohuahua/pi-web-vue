// Ported from pi-web lib/file-paths.ts — https://github.com/agegr/pi-web (MIT)
// 文件路径的字符串工具 纯函数 浏览器与服务端共用
// API 传输统一用正斜杠分段 本机 fs 操作交给调用方转换

export function normalizeFilePathSlashes(filePath: string): string {
  if (/^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith("\\\\")) {
    return filePath.replace(/\\/g, "/");
  }
  return filePath;
}

// 绝对路径编码为 /api/files/<seg>/<seg> 形式 每段单独编码
export function encodeFilePathForApi(filePath: string): string {
  return normalizeFilePathSlashes(filePath)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function getFileName(filePath: string): string {
  const normalized = normalizeFilePathSlashes(filePath).replace(/\/+$/, "");
  return normalized.split("/").pop() ?? normalized;
}

// 取目录部分 即末段前的全部内容 用于解析 md 内的相对链接
export function getDirName(filePath: string): string {
  const normalized = normalizeFilePathSlashes(filePath);
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : "";
}

// 相对 cwd 的路径 不在 cwd 下时原样返回
export function getRelativeFilePath(filePath: string, cwd?: string): string {
  if (!cwd) return filePath;
  const normalizedFile = normalizeFilePathSlashes(filePath);
  const normalizedCwd = normalizeFilePathSlashes(cwd).replace(/\/$/, "");
  if (normalizedFile.startsWith(normalizedCwd + "/")) {
    return normalizedFile.slice(normalizedCwd.length + 1);
  }
  return filePath;
}

// 从 catch-all 路由段重建绝对路径 段间正斜杠 Windows 盘符根补 /
export function filePathFromApiSegments(segments: string[]): string {
  const joined = segments.join("/");
  const slashJoined = normalizeFilePathSlashes(joined);
  if (/^[a-zA-Z]:$/.test(slashJoined)) return `${slashJoined}/`;
  if (/^[a-zA-Z]:[\\/]/.test(slashJoined) || slashJoined.startsWith("\\\\")) return slashJoined;
  return "/" + joined.replace(/^\/+/, "");
}
