// Ported from pi-web lib/paths.ts 的 toNativePath 与 samePath — https://github.com/agegr/pi-web (MIT)
// git 在 Windows 上也输出 POSIX 风格绝对路径 D:/repo/sub
// 与 Node 及 pi 产生的本机路径永远字符串不相等 必须先转本机分隔符
// 只对路径使用 分支名 feature/x 转换后会变成 feature\x

import { normalize, parse, sep } from "node:path";

export function toNativePath(p: string): string {
  if (!p || process.platform !== "win32") return p;
  return normalize(p);
}

function normalizeForComparison(p: string): string {
  const normalized = normalize(toNativePath(p));
  const rootLength = parse(normalized).root.length;
  let end = normalized.length;
  while (end > rootLength && normalized[end - 1] === sep) end--;
  return normalized.slice(0, end);
}

// 两个路径是否同一位置 容忍分隔符风格与 Windows 大小写含盘符大小写
// 词法比较 需要消解符号链接的调用方先 realpath
export function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const normalizedA = normalizeForComparison(a);
  const normalizedB = normalizeForComparison(b);
  if (process.platform === "win32") {
    return normalizedA.toLowerCase() === normalizedB.toLowerCase();
  }
  return normalizedA === normalizedB;
}
