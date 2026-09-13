import { describe, expect, it } from "vitest";
import { INITIAL_STREAMING_STATE, streamReducer } from "#shared/lib/streaming-message";
import type { AgentMessage } from "#shared/lib/types";

describe("streamReducer", () => {
  it("按增量组装文本 思考与工具调用", () => {
    let state = streamReducer(INITIAL_STREAMING_STATE, { type: "start" });
    const snapshot: AgentMessage = {
      role: "assistant",
      content: [],
      model: "test-model",
      provider: "test-provider",
    };
    state = streamReducer(state, { type: "snapshot", message: snapshot });
    state = streamReducer(state, { type: "delta", event: { type: "text_start", contentIndex: 0 } });
    state = streamReducer(state, { type: "delta", event: { type: "text_delta", contentIndex: 0, delta: "你" } });
    state = streamReducer(state, { type: "delta", event: { type: "text_end", contentIndex: 0, content: "你好" } });
    state = streamReducer(state, { type: "delta", event: { type: "thinking_start", contentIndex: 1 } });
    state = streamReducer(state, { type: "delta", event: { type: "thinking_end", contentIndex: 1, content: "分析" } });
    state = streamReducer(state, { type: "delta", event: { type: "toolcall_start", contentIndex: 2, id: "call-1", toolName: "read" } });
    state = streamReducer(state, {
      type: "delta",
      event: {
        type: "toolcall_end",
        contentIndex: 2,
        toolCall: { id: "call-1", name: "read", arguments: { path: "README.md" } },
      },
    });

    expect(state).toEqual({
      isStreaming: true,
      streamingMessage: {
        role: "assistant",
        content: [
          { type: "text", text: "你好" },
          { type: "thinking", thinking: "分析" },
          { type: "toolCall", toolCallId: "call-1", toolName: "read", input: { path: "README.md" } },
        ],
        model: "test-model",
        provider: "test-provider",
      },
    });
  });

  it("快照重放会归一化旧工具调用 并在结束时清空", () => {
    const snapshot = {
      role: "assistant",
      content: [{ type: "toolCall", id: "legacy-call", name: "bash", arguments: { command: "dir" } }],
      model: "test-model",
      provider: "test-provider",
    } as unknown as AgentMessage;
    const restored = streamReducer(INITIAL_STREAMING_STATE, { type: "snapshot", message: snapshot });

    expect(restored.streamingMessage?.content).toEqual([
      { type: "toolCall", toolCallId: "legacy-call", toolName: "bash", input: { command: "dir" } },
    ]);
    expect(streamReducer(restored, { type: "end" })).toBe(INITIAL_STREAMING_STATE);
  });
});
