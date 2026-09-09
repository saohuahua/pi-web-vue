import { describe, expect, it } from "vitest";
import { isEventIncludedInSnapshot, toClientAgentEvent } from "./agent-event-wire";

describe("toClientAgentEvent", () => {
  it("过滤 turn 事件", () => {
    expect(toClientAgentEvent({ type: "turn_start" })).toBeNull();
    expect(toClientAgentEvent({ type: "turn_end" })).toBeNull();
  });

  it("剥离 message_update 快照并提升工具元数据", () => {
    const event = {
      type: "message_update",
      assistantMessageEvent: {
        type: "toolcall_start",
        contentIndex: 0,
        partial: { content: [{ type: "toolCall", id: "call-1", name: "read" }] },
      },
    };

    expect(toClientAgentEvent(event)).toEqual({
      type: "message_update",
      assistantMessageEvent: {
        type: "toolcall_start",
        contentIndex: 0,
        id: "call-1",
        toolName: "read",
      },
    });
  });

  it("只跳过已包含在流式快照中的消息事件", () => {
    const snapshot = { role: "assistant" };
    expect(isEventIncludedInSnapshot({ type: "message_start", message: snapshot }, snapshot)).toBe(true);
    expect(isEventIncludedInSnapshot({ type: "agent_end", message: snapshot }, snapshot)).toBe(false);
    expect(isEventIncludedInSnapshot({ type: "message_update", message: { role: "assistant" } }, snapshot)).toBe(false);
  });
});
