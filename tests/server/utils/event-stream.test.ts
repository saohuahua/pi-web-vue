import { describe, expect, it } from "vitest";
import type { AgentEventLike } from "#shared/lib/agent-event-wire";
import { createAgentEventStream } from "#server/utils/event-stream";

// 模拟 wrapper 的会话面 只保留流用到的成员
function createSession() {
  const eventListeners = new Set<(event: AgentEventLike) => void>();
  const disposeListeners = new Set<() => void>();
  return {
    isStreaming: false,
    streamingMessage: undefined,
    onEvent(listener: (event: AgentEventLike) => void) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    onDispose(listener: () => void) {
      disposeListeners.add(listener);
      return () => disposeListeners.delete(listener);
    },
    emitDispose: () => {
      for (const listener of disposeListeners) listener();
    },
  };
}

const decode = (value: Uint8Array | undefined) => new TextDecoder().decode(value);

describe("createAgentEventStream", () => {
  it("wrapper 销毁时流关闭 前端收到 onerror 后重连到重建的 wrapper", async () => {
    const session = createSession();
    const stream = createAgentEventStream(
      new AbortController().signal,
      "s1",
      Promise.resolve(session),
    );
    const reader = stream.getReader();

    // 首帧是立即写出的响应头 第二帧是 connected 握手
    await reader.read();
    const handshake = await reader.read();
    expect(decode(handshake.value)).toContain('"connected"');

    // 销毁回调触发 流必须结束 否则前端被心跳骗住 新提问事件全部丢失
    session.emitDispose();
    const tail = await reader.read();
    expect(tail.done).toBe(true);
  });
});
