// Ported from pi-web lib/agent-event-wire.ts — https://github.com/agegr/pi-web (MIT)
// SDK 事件发往浏览器前的线上过滤器
// 丢掉 turn_start turn_end 剥掉 message_update 里巨大的 partial 快照字段
// 把 toolcall 的 id toolName 提升到事件顶层
// 不做这层过滤 每次增量都带全量内容 流量与 CPU 都会爆炸

export interface AgentEventLike {
  type: string;
  [key: string]: unknown;
}

// 剥掉 partial 之后的 assistantMessageEvent 类型
// 手写的最小结构 替代 pi SDK 的 JsonAgentSessionEvent 派生
// shared 层不允许 import pi 包 这是打进浏览器产物的前提
export type ClientAssistantMessageEvent =
  | { type: "text_start"; contentIndex: number }
  | { type: "text_delta"; contentIndex: number; delta: string }
  | { type: "text_end"; contentIndex: number; content: string }
  | { type: "thinking_start"; contentIndex: number }
  | { type: "thinking_delta"; contentIndex: number; delta: string }
  | { type: "thinking_end"; contentIndex: number; content: string }
  | { type: "toolcall_start"; contentIndex: number; id?: string; toolName?: string }
  | { type: "toolcall_delta"; contentIndex: number; delta: string; id?: string; toolName?: string }
  | {
    type: "toolcall_end";
    contentIndex: number;
    toolCall: { id: string; name: string; arguments: Record<string, unknown> };
  };

export type ClientMessageUpdateEvent = {
  type: "message_update";
  assistantMessageEvent: ClientAssistantMessageEvent;
};

const OMITTED_EVENT_TYPES = new Set([
  "turn_start",
  "turn_end",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// toolcall_start 与 toolcall_delta 的 id 与 toolName 藏在 partial.content[contentIndex] 里
// 提升到事件顶层 流式组装器不用解 partial 就能拿到
function toolCallMetadata(
  event: Record<string, unknown>,
): { id: string; toolName: string } | null {
  if (
    (event.type !== "toolcall_start" && event.type !== "toolcall_delta")
    || !isObject(event.partial)
  ) return null;
  const content = event.partial.content;
  const contentIndex = event.contentIndex;
  if (!Array.isArray(content) || typeof contentIndex !== "number") return null;

  const block = content[contentIndex];
  if (!isObject(block) || block.type !== "toolCall") return null;
  const id = typeof block.id === "string"
    ? block.id
    : (typeof block.toolCallId === "string" ? block.toolCallId : null);
  const toolName = typeof block.name === "string"
    ? block.name
    : (typeof block.toolName === "string" ? block.toolName : null);
  return id !== null && toolName !== null ? { id, toolName } : null;
}

export function toClientAgentEvent(
  event: AgentEventLike,
): AgentEventLike | ClientMessageUpdateEvent | null {
  if (OMITTED_EVENT_TYPES.has(event.type)) return null;

  if (event.type === "message_update") {
    const assistantMessageEvent = event.assistantMessageEvent;
    if (
      typeof assistantMessageEvent !== "object"
      || assistantMessageEvent === null
      || Array.isArray(assistantMessageEvent)
    ) return null;

    if (!("partial" in assistantMessageEvent)) {
      return {
        type: "message_update",
        assistantMessageEvent,
      } as ClientMessageUpdateEvent;
    }

    const metadata = toolCallMetadata(assistantMessageEvent as Record<string, unknown>);
    const { partial: _partial, ...deltaEvent } = assistantMessageEvent as Record<string, unknown>;
    void _partial;
    return {
      type: "message_update",
      assistantMessageEvent: metadata ? { ...deltaEvent, ...metadata } : deltaEvent,
    } as ClientMessageUpdateEvent;
  }

  if (event.type === "tool_execution_update") {
    return {
      type: "tool_execution_update",
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      partialResult: event.partialResult,
    };
  }

  if (event.type === "agent_end") return { type: "agent_end" };
  return event;
}

// 连接建立时若 agent 正在流式 会补发一条 message_start 携带 streamingMessage 快照
// 此函数判断某事件是否已包含在那份快照里 避免快照与缓冲事件双发
export function isEventIncludedInSnapshot(
  event: AgentEventLike,
  snapshot: unknown,
): boolean {
  return snapshot !== undefined
    && (event.type === "message_start" || event.type === "message_update")
    && event.message === snapshot;
}
