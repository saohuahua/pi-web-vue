// Ported from pi-web lib/file-fuzzy.ts — https://github.com/agegr/pi-web (MIT)
// @ 文件补全的触发检测与排序 纯函数
// @ 必须在行首或空白后出现 foo@bar 这类邮箱永不触发
// 排序沿用 TUI 的阶梯 精确 100 前缀 80 子串 50 路径子串 30 目录加 10

export interface AtQueryMatch {
  /** @ 字符在文本中的下标 */
  start: number;
  /** @ 后已输入的查询词 引号形式已剥引号 可为空 */
  query: string;
  /** 是否为 @"..." 引号形式 */
  quoted: boolean;
}

export interface FileIndexEntry {
  /** 相对会话 cwd 的路径 正斜杠分隔 无尾斜杠 */
  path: string;
  isDir: boolean;
}

export function extractAtQuery(textBeforeCursor: string): AtQueryMatch | null {
  const quoted = /(?:^|\s)@"([^"\n]*)$/.exec(textBeforeCursor);
  if (quoted) {
    return {
      start: textBeforeCursor.length - (quoted[1]!.length + 2),
      query: quoted[1]!,
      quoted: true,
    };
  }
  const plain = /(?:^|\s)@([^\s"]*)$/.exec(textBeforeCursor);
  if (plain) {
    return {
      start: textBeforeCursor.length - (plain[1]!.length + 1),
      query: plain[1]!,
      quoted: false,
    };
  }
  return null;
}

function pathDepth(p: string): number {
  let depth = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === "/") depth++;
  }
  return depth;
}

// 服务端只返回文件列表 目录条目从路径推导 空查询的默认序是浅路径优先再按字母
export function buildEntriesFromFiles(files: string[]): FileIndexEntry[] {
  const dirs = new Set<string>();
  for (const f of files) {
    let idx = f.indexOf("/");
    while (idx !== -1) {
      dirs.add(f.slice(0, idx));
      idx = f.indexOf("/", idx + 1);
    }
  }
  const entries: FileIndexEntry[] = [];
  for (const d of dirs) entries.push({ path: d, isDir: true });
  for (const f of files) {
    if (!f) continue;
    entries.push({ path: f, isDir: false });
  }
  entries.sort((a, b) => pathDepth(a.path) - pathDepth(b.path) || a.path.localeCompare(b.path));
  return entries;
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

// 含 / 的查询对完整相对路径排序 这是下钻的实现 插入 @src/ 后 src 内的条目前缀全中
function scoreEntry(entry: FileIndexEntry, lowerQuery: string): number {
  const lowerPath = entry.path.toLowerCase();
  let score = 0;
  if (lowerQuery.includes("/")) {
    if (lowerPath === lowerQuery) score = 100;
    else if (lowerPath.startsWith(lowerQuery)) score = 80;
    else if (lowerPath.includes(lowerQuery)) score = 50;
    else if (isSubsequence(lowerQuery, lowerPath)) score = 10;
  } else {
    const slash = lowerPath.lastIndexOf("/");
    const lowerName = slash === -1 ? lowerPath : lowerPath.slice(slash + 1);
    if (lowerName === lowerQuery) score = 100;
    else if (lowerName.startsWith(lowerQuery)) score = 80;
    else if (lowerName.includes(lowerQuery)) score = 50;
    else if (lowerPath.includes(lowerQuery)) score = 30;
    else if (isSubsequence(lowerQuery, lowerPath)) score = 10;
  }
  if (entry.isDir && score > 0) score += 10;
  return score;
}

export const AT_RESULT_LIMIT = 20;

export function filterFileEntries(
  entries: FileIndexEntry[],
  query: string,
  limit: number = AT_RESULT_LIMIT,
): FileIndexEntry[] {
  const lowerQuery = query.toLowerCase();
  if (!lowerQuery) return entries.slice(0, limit);

  const scored: Array<{ entry: FileIndexEntry; score: number }> = [];
  for (const entry of entries) {
    const score = scoreEntry(entry, lowerQuery);
    if (score > 0) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path))
    .slice(0, limit)
    .map((s) => s.entry);
}
