// Ported from pi-web lib/types.ts — https://github.com/agegr/pi-web (MIT)
// 类型镜像自 pi-mono coding-agent session-manager
// 精简掉 CustomMessage ExtensionUi 子代理与 worktree 相关类型

export interface SessionHeader {
  type: "session";
  version?: number;
  id: string;
  timestamp: string;
  cwd: string;
  parentSession?: string;
}

export interface SessionEntryBase {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  source: {
    type: "base64" | "url";
    media_type?: string;
    data?: string;
    url?: string;
  };
}

export interface ThinkingContent {
  type: "thinking";
  thinking: string;
  /** 历史内容是短摘要 完整思考按需加载 本项目不做延迟加载 保留字段兼容文件格式 */
  deferred?: boolean;
}

export interface ToolCallContent {
  type: "toolCall";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  /** 流式期间的客户端侧原始输入缓冲 不会持久化到会话文件 */
  rawInput?: string;
}

export type AssistantContentBlock = TextContent | ImageContent | ThinkingContent | ToolCallContent;

export interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp?: number;
}

export interface AgentUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

export interface AssistantMessage {
  role: "assistant";
  content: AssistantContentBlock[];
  model: string;
  provider: string;
  stopReason?: string;
  errorMessage?: string;
  timestamp?: number;
  usage?: AgentUsage;
}

export interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName?: string;
  content: (TextContent | ImageContent)[];
  isError?: boolean;
  details?: unknown;
  timestamp?: number;
  usage?: AgentUsage;
}

export interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode?: number;
  cancelled?: boolean;
  truncated?: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;
  timestamp?: number;
}

export type AgentMessage = UserMessage | AssistantMessage | ToolResultMessage | BashExecutionMessage;

export interface SessionMessageEntry extends SessionEntryBase {
  type: "message";
  message: AgentMessage;
}

export interface ThinkingLevelChangeEntry extends SessionEntryBase {
  type: "thinking_level_change";
  thinkingLevel: string;
}

export interface ModelChangeEntry extends SessionEntryBase {
  type: "model_change";
  provider: string;
  modelId: string;
}

export interface CompactionEntry extends SessionEntryBase {
  type: "compaction";
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  details?: unknown;
  fromHook?: boolean;
  usage?: AgentUsage;
}

export interface LabelEntry extends SessionEntryBase {
  type: "label";
  targetId: string;
  label: string | undefined;
}

export interface SessionInfoEntry extends SessionEntryBase {
  type: "session_info";
  name?: string;
}

export type SessionEntry =
  | SessionMessageEntry
  | ThinkingLevelChangeEntry
  | ModelChangeEntry
  | CompactionEntry
  | LabelEntry
  | SessionInfoEntry;

export interface SessionInfo {
  path: string;
  id: string;
  cwd: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
  /** 会话分组用的稳定键 同一仓库不同 worktree 的会话共享一个键 */
  projectKey: string;
  /** 会话所属项目根 worktree 会话指向主仓库根 */
  projectRoot: string;
  /** 会话 cwd 是链接 worktree 顶层时记录该 worktree 路径 主检出不填 */
  worktreePath?: string;
}

// 项目身份 由 cwd 解析而来 projectKey 是分组与记忆的稳定键 不能用展示名代替
export interface ProjectIdentity {
  cwd: string;
  projectRoot: string;
  projectKey: string;
}

// 已有 worktree 条目 分支名不是路径 不能做路径转换
export interface WorktreeInfo {
  path: string;
  branch: string | null;
  isMain: boolean;
  isCurrent: boolean;
}

export interface WorktreesResponse {
  projectRoot: string;
  projectKey: string;
  isGit: boolean;
  isTopLevel: boolean;
  currentWorktreePath: string | null;
  worktrees: WorktreeInfo[];
}

// 会话使用量的文件累计
// compaction 只追加摘要 entry 被汇总的历史仍留在文件里 因此累计值单调增长
// 与运行态的 context usage 是两项独立指标 前端不得相加
export interface SessionStatsInfo {
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  totalMessages: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
}

export interface SessionContext {
  messages: AgentMessage[];
  /** 与 messages 平行 第 i 条消息对应文件里的 entryIds[i] 分支操作需要 entryId 而非消息下标 */
  entryIds: string[];
  oldestEntryId: string | null;
  hasMore: boolean;
  thinkingLevel: string;
  model: { provider: string; modelId: string } | null;
  /** 按完整 entry 列表累计 含未激活分支与被压缩历史 */
  stats: SessionStatsInfo;
}
