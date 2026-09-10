// Ported from pi-web lib/project-identity.ts — https://github.com/agegr/pi-web (MIT)
// 项目路径的稳定身份键
// 只用于分组与相等判断 展示与文件操作继续用原始 cwd 与 projectRoot
// Windows 路径按 win32 规则归一并大小写折叠 默认文件系统大小写不敏感
// platform 参数显式传入 使语义在非 Windows 环境也可测试
// 依赖 node:path 且浏览器只需比较服务端给的键 所以放 server 侧

import path from "node:path";

export function projectIdentityKey(
  projectRoot: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (!projectRoot) return projectRoot;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const normalized = pathApi.normalize(projectRoot);
  const rootLength = pathApi.parse(normalized).root.length;
  let end = normalized.length;
  while (end > rootLength && normalized[end - 1] === pathApi.sep) end--;
  const withoutTrailingSeparators = normalized.slice(0, end);
  return platform === "win32"
    ? withoutTrailingSeparators.toLowerCase()
    : withoutTrailingSeparators;
}
