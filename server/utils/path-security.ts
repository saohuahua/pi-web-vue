// Ported from pi-web lib/path-security.ts 与 lib/paths.ts — https://github.com/agegr/pi-web (MIT)
// 路径包含判断的安全规则 决不允许裸字符串 startsWith
// .. 同前缀目录与符号链接逃逸都能绕过裸比较 必须 resolve 后按平台规则比较

import { realpathSync } from "node:fs";
import path from "node:path";

const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]/;

export function isWindowsAbsolutePath(filePath: string): boolean {
  return WINDOWS_ABSOLUTE_RE.test(filePath) || filePath.startsWith("\\\\") || filePath.startsWith("//");
}

// 词法包含判断 接受两种规范形式的输入
// 目标或根任一是 Windows 绝对路径就按 win32 规则处理
// Windows 下大小写折叠 分隔符风格与盘符大小写不影响结果
export function isPathWithinRoots(target: string, roots: Set<string>): boolean {
  for (const root of roots) {
    const useWindowsRules = isWindowsAbsolutePath(target) || isWindowsAbsolutePath(root);
    const resolver = useWindowsRules ? path.win32 : path;
    const sep = useWindowsRules ? "\\" : path.sep;
    const normalized = resolver.resolve(target);
    const normalizedRoot = resolver.resolve(root);
    const comparable = useWindowsRules ? normalized.toLowerCase() : normalized;
    const comparableRoot = useWindowsRules ? normalizedRoot.toLowerCase() : normalizedRoot;
    const rootWithSep = comparableRoot.endsWith(sep) ? comparableRoot : comparableRoot + sep;
    if (comparable === comparableRoot || comparable.startsWith(rootWithSep)) return true;
  }
  return false;
}

// 真实路径包含判断 先 realpath 消解符号链接再走词法比较
// 目标不存在直接拒绝 根失效时忽略该根 会话目录或 worktree 可能已被删除
export function isExistingPathWithinRoots(target: string, roots: Set<string>): boolean {
  let realTarget: string;
  try {
    realTarget = realpathSync(target);
  } catch {
    return false;
  }

  const realRoots = new Set<string>();
  for (const root of roots) {
    try {
      realRoots.add(realpathSync(root));
    } catch {
      // 忽略失效的根
    }
  }
  return isPathWithinRoots(realTarget, realRoots);
}
