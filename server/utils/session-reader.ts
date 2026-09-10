// Ported from pi-web lib/session-reader.ts — https://github.com/agegr/pi-web (MIT)
// 会话文件读取 列表扫描 路径解析 消息上下文构建
// 与 pi-web 的差异 全量扫描替代增量扫描器 去掉延迟加载与分页

import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { closeSync, fstatSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { extractTextBlocks } from "#shared/lib/message-text";
import { normalizeToolCalls } from "#shared/lib/normalize";
import { computeSessionStats } from "#shared/lib/session-stats";
import type { AgentMessage, SessionContext, SessionEntry, SessionHeader, SessionInfo } from "#shared/lib/types";
import { projectIdentityKey } from "./project-identity";
import { resolveProject } from "./worktree";

const SESSION_HEADER_MAX_BYTES = 64 * 1024;
const SESSION_LIST_FIRST_MESSAGE_LINES = 40;
const SESSION_LIST_FIRST_MESSAGE_CHARS = 80;
const SESSION_LIST_CACHE_TTL_MS = 30_000;

// 从文件头顺序读 最多 maxBytes 字节 maxLines 行
// 会话首行是 header 列表扫描只碰前几十行 大文件不会被整读
function readBoundedLines(filePath: string, maxBytes: number, maxLines: number): string[] {
  const fd = openSync(filePath, "r");
  try {
    const chunks: Buffer[] = [];
    let position = 0;
    let newlineCount = 0;
    let reachedEof = false;

    while (position < maxBytes && newlineCount < maxLines) {
      const buffer = Buffer.allocUnsafe(Math.min(4096, maxBytes - position));
      const bytesRead = readSync(fd, buffer, 0, buffer.length, position);
      if (bytesRead === 0) {
        reachedEof = true;
        break;
      }
      position += bytesRead;
      const data = buffer.subarray(0, bytesRead);
      let end = data.length;
      for (let index = 0; index < data.length; index += 1) {
        if (data[index] !== 0x0a) continue;
        newlineCount += 1;
        if (newlineCount === maxLines) {
          end = index + 1;
          break;
        }
      }
      chunks.push(data.subarray(0, end));
    }

    const source = Buffer.concat(chunks).toString("utf8");
    const lines = source.split("\n");
    if (!reachedEof && !source.endsWith("\n")) lines.pop();
    if (lines.at(-1) === "") lines.pop();
    return lines.map((line) => line.endsWith("\r") ? line.slice(0, -1) : line);
  } finally {
    closeSync(fd);
  }
}

// 从文件尾倒着读最多 maxBytes 字节
// session_info 重命名是追加在文件末尾的 从头读拿不到 只能扫尾部
function readBoundedTailLines(filePath: string, maxBytes: number): string[] {
  const fd = openSync(filePath, "r");
  try {
    const fileSize = fstatSync(fd).size;
    const start = Math.max(0, fileSize - maxBytes);
    const buffer = Buffer.allocUnsafe(fileSize - start);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, start);
    if (bytesRead === 0) return [];

    const lines = buffer.subarray(0, bytesRead).toString("utf8").split("\n");
    if (start > 0) {
      // 起点若不是行首 首行是被截断的半行 丢弃
      const previousByte = Buffer.allocUnsafe(1);
      readSync(fd, previousByte, 0, 1, start - 1);
      if (previousByte[0] !== 0x0a) lines.shift();
    }
    if (lines.at(-1) === "") lines.pop();
    return lines.map((line) => line.endsWith("\r") ? line.slice(0, -1) : line);
  } finally {
    closeSync(fd);
  }
}

export function readSessionHeader(filePath: string): SessionHeader | null {
  const firstLine = readBoundedLines(filePath, SESSION_HEADER_MAX_BYTES, 1)[0]?.trimEnd();
  if (!firstLine) return null;
  try {
    const header = JSON.parse(firstLine) as SessionHeader;
    return header.type === "session" ? header : null;
  } catch {
    return null;
  }
}

// 列表页的会话名取文件尾部最近一条带 name 的 session_info
// 权威值以详情接口的 sm.getSessionName 为准 这里列表展示够用
function readSessionNameFromTail(filePath: string): string | undefined {
  const lines = readBoundedTailLines(filePath, SESSION_HEADER_MAX_BYTES);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line === undefined) continue;
    try {
      const entry = JSON.parse(line) as { type?: string; name?: unknown };
      if (entry.type === "session_info" && typeof entry.name === "string" && entry.name !== "") {
        return entry.name;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

// 扫描产物尚未带项目身份 项目字段由 listSessions 的 enrich 步骤统一填充
type ScannedSession = Omit<SessionInfo, "projectKey" | "projectRoot">;

function scanSessionFile(filePath: string): ScannedSession | null {
  try {
    const header = readSessionHeader(filePath);
    if (!header) return null;

    const lines = readBoundedLines(filePath, SESSION_HEADER_MAX_BYTES, SESSION_LIST_FIRST_MESSAGE_LINES);
    let firstMessage = "";
    for (const line of lines) {
      if (firstMessage) break;
      try {
        const entry = JSON.parse(line) as { type?: string; message?: { role?: string; content?: unknown } };
        if (entry.type !== "message" || entry.message?.role !== "user") continue;
        const text = extractTextBlocks(entry.message.content).join(" ");
        if (text) firstMessage = text.slice(0, SESSION_LIST_FIRST_MESSAGE_CHARS);
      } catch {
        continue;
      }
    }

    const modified = statSync(filePath).mtime.toISOString();
    const name = readSessionNameFromTail(filePath);
    return {
      path: filePath,
      id: header.id,
      cwd: header.cwd,
      ...(name !== undefined ? { name } : {}),
      created: header.timestamp,
      modified,
      messageCount: 0,
      firstMessage: firstMessage || "(no messages)",
    };
  } catch {
    return null;
  }
}

let listCache: { data: SessionInfo[]; ts: number } | null = null;

export function invalidateSessionListCache(): void {
  listCache = null;
}

// 按唯一 cwd 批量解析项目身份 同一项目的多个会话只触发一次 git 调用
// resolveProject 自带 TTL 缓存 这里不再额外缓存
async function enrichProjectIdentity(scanned: ScannedSession[]): Promise<SessionInfo[]> {
  const byCwd = new Map<string, Awaited<ReturnType<typeof resolveProject>>>();
  for (const session of scanned) {
    if (!byCwd.has(session.cwd)) {
      byCwd.set(session.cwd, await resolveProject(session.cwd));
    }
  }
  return scanned.map((session) => {
    const project = byCwd.get(session.cwd)!;
    return {
      ...session,
      projectKey: projectIdentityKey(project.projectRoot),
      projectRoot: project.projectRoot,
      ...(project.isWorktree ? { worktreePath: session.cwd } : {}),
    };
  });
}

export async function listSessions(force = false): Promise<SessionInfo[]> {
  if (!force && listCache && Date.now() - listCache.ts < SESSION_LIST_CACHE_TTL_MS) {
    return listCache.data;
  }

  const sessionsDir = join(getAgentDir(), "sessions");
  const scanned: ScannedSession[] = [];
  try {
    // 一层子目录是一个项目 目录名是编码后的 cwd 不用解码 header 里有原始 cwd
    for (const dir of readdirSync(sessionsDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const projectDir = join(sessionsDir, dir.name);
      for (const file of readdirSync(projectDir, { withFileTypes: true })) {
        if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;
        const info = scanSessionFile(join(projectDir, file.name));
        if (info) scanned.push(info);
      }
    }
  } catch {
    // sessions 目录不存在等场景 返回空列表
  }

  const sessions = await enrichProjectIdentity(scanned);
  sessions.sort((a, b) => (a.modified < b.modified ? 1 : -1));
  listCache = { data: sessions, ts: Date.now() };
  return sessions;
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$/;

// 会话文件名以 _sessionId.jsonl 结尾 按后缀扫描再校验 header id
// 不能直接拼 _sessionId.jsonl 当文件名 实际文件名带时间戳前缀
// sessionId 先过格式校验 防路径穿越
export async function resolveSessionPath(sessionId: string): Promise<string | null> {
  if (!SESSION_ID_PATTERN.test(sessionId)) return null;
  const sessionsDir = join(getAgentDir(), "sessions");
  try {
    for (const dir of readdirSync(sessionsDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const projectDir = join(sessionsDir, dir.name);
      for (const file of readdirSync(projectDir, { withFileTypes: true })) {
        if (!file.isFile() || !file.name.endsWith(`_${sessionId}.jsonl`)) continue;
        const candidate = join(projectDir, file.name);
        try {
          const header = readSessionHeader(candidate);
          if (header?.id === sessionId) return candidate;
        } catch {
          continue;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

// 沿 parentId 从 leaf 向上找最近的 model_change 与 thinking_level_change
// 非消息 entry 不直接渲染 但参与当前有效模型与思考级别的推导
function getSessionSettings(entries: SessionEntry[], leafId?: string | null): Pick<SessionContext, "thinkingLevel" | "model"> {
  if (leafId === null) return { thinkingLevel: "off", model: null };
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  let current = leafId ? byId.get(leafId) : undefined;
  current ??= entries[entries.length - 1];
  let thinkingLevel: string | undefined;
  let model: SessionContext["model"] | undefined;

  while (current && (thinkingLevel === undefined || model === undefined)) {
    if (thinkingLevel === undefined && current.type === "thinking_level_change") {
      thinkingLevel = current.thinkingLevel;
    }
    if (model === undefined && current.type === "model_change") {
      model = { provider: current.provider, modelId: current.modelId };
    } else if (model === undefined && current.type === "message" && current.message.role === "assistant") {
      const message = current.message as { provider?: unknown; model?: unknown };
      if (typeof message.provider === "string" && typeof message.model === "string") {
        model = { provider: message.provider, modelId: message.model };
      }
    }
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return { thinkingLevel: thinkingLevel ?? "off", model: model ?? null };
}

/**
 * 从 leafId 向根提取祖先链 迭代实现 链长等于 entry 数时递归会爆栈
 * 反转后即活跃分支的顺序前缀
 */
export function sliceActiveBranch(
  entries: SessionEntry[],
  leafId: string | null,
  tail: number,
): SessionEntry[] {
  if (tail <= 0) return entries;
  const byId = new Map<string, SessionEntry>();
  for (const e of entries) byId.set(e.id, e);

  const leaf = leafId ? byId.get(leafId) : entries[entries.length - 1];
  if (!leaf) return [];
  const chain: SessionEntry[] = [];
  let current: SessionEntry | undefined = leaf;
  while (current && chain.length < tail) {
    chain.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  chain.reverse();
  return chain;
}

// entry 转 UI 消息 精简版 只认 message entry 其余类型返回 null
// assistant 旧格式字符串 content 包成 text 块
function entryToUiMessage(entry: SessionEntry): AgentMessage | null {
  if (entry.type !== "message") return null;
  let message = normalizeToolCalls(entry.message);
  // 消息自带的 timestamp 是生成开始时刻 entry 的 timestamp 是定稿写入时刻
  // 思考与工具的时长计算需要定稿时刻 统一覆盖
  const finalizedAt = Date.parse(entry.timestamp);
  if (!Number.isNaN(finalizedAt)) {
    message = { ...message, timestamp: finalizedAt } as AgentMessage;
  }
  const legacyContent = message.role === "assistant" ? (message as { content: unknown }).content : undefined;
  if (typeof legacyContent === "string") {
    message = { ...message, content: [{ type: "text", text: legacyContent }] } as AgentMessage;
  }
  return message;
}

export function buildSessionContext(
  entries: SessionEntry[],
  leafId?: string | null,
): SessionContext {
  const sliced = leafId === null ? [] : sliceActiveBranch(entries, leafId ?? null, entries.length);

  // messages 与 entryIds 平行生成 分支操作需要的是 entryId 不是消息下标
  const messages: AgentMessage[] = [];
  const entryIds: string[] = [];
  for (const entry of sliced) {
    const m = entryToUiMessage(entry);
    if (m) {
      messages.push(m);
      entryIds.push(entry.id);
    }
  }

  return {
    messages,
    entryIds,
    oldestEntryId: sliced[0]?.id ?? null,
    hasMore: Boolean(sliced[0]?.parentId),
    // 统计按完整 entries 累计 含未激活分支与被压缩历史 与显示消息是两个口径
    stats: computeSessionStats(entries),
    ...getSessionSettings(entries, leafId),
  };
}
