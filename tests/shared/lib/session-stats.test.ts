import { describe, expect, it } from "vitest";
import { computeSessionStats } from "#shared/lib/session-stats";
import type { AgentUsage, SessionEntry } from "#shared/lib/types";

function usage(input: number, output: number, cacheRead: number, cacheWrite: number, cost: number): AgentUsage {
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: cost },
  };
}

const entries: SessionEntry[] = [
  {
    type: "model_change",
    id: "model",
    parentId: null,
    timestamp: "2026-01-01T00:00:00.000Z",
    provider: "test",
    modelId: "model-a",
  },
  {
    type: "message",
    id: "user-a",
    parentId: "model",
    timestamp: "2026-01-01T00:00:01.000Z",
    message: { role: "user", content: "你好" },
  },
  {
    type: "message",
    id: "assistant-a",
    parentId: "user-a",
    timestamp: "2026-01-01T00:00:02.000Z",
    message: {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "想一想" },
        { type: "text", text: "答复" },
        { type: "toolCall", toolCallId: "t1", toolName: "read", input: {} },
        { type: "toolCall", toolCallId: "t2", toolName: "bash", input: {} },
      ],
      model: "model-a",
      provider: "test",
      usage: usage(100, 200, 50, 10, 0.5),
    },
  },
  {
    type: "message",
    id: "result-a",
    parentId: "assistant-a",
    timestamp: "2026-01-01T00:00:03.000Z",
    message: {
      role: "toolResult",
      toolCallId: "t1",
      content: [{ type: "text", text: "文件内容" }],
      usage: usage(20, 0, 0, 0, 0.1),
    },
  },
  {
    type: "compaction",
    id: "compact-a",
    parentId: "result-a",
    timestamp: "2026-01-01T00:00:04.000Z",
    summary: "压缩摘要",
    firstKeptEntryId: "result-a",
    tokensBefore: 500,
    usage: usage(30, 40, 0, 0, 0.2),
  },
  // 未激活分支的消息也属于文件累计
  {
    type: "message",
    id: "user-b",
    parentId: "assistant-a",
    timestamp: "2026-01-01T00:00:05.000Z",
    message: { role: "user", content: "另一条分支" },
  },
];

describe("computeSessionStats", () => {
  it("统计消息计数 工具调用 token 与成本", () => {
    const stats = computeSessionStats(entries);

    expect(stats.userMessages).toBe(2);
    expect(stats.assistantMessages).toBe(1);
    expect(stats.toolResults).toBe(1);
    expect(stats.toolCalls).toBe(2);
    // compaction 与 model_change 不计入消息数
    expect(stats.totalMessages).toBe(4);
    expect(stats.tokens).toEqual({
      input: 150,
      output: 240,
      cacheRead: 50,
      cacheWrite: 10,
      total: 450,
    });
    expect(stats.cost).toBe(0.8);
  });

  it("空 entry 列表返回全零统计", () => {
    expect(computeSessionStats([])).toEqual({
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      toolResults: 0,
      totalMessages: 0,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      cost: 0,
    });
  });

  it("缺 usage 的旧会话不抛错也不累计", () => {
    const legacy: SessionEntry[] = [{
      type: "message",
      id: "u1",
      parentId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
      message: { role: "assistant", content: [{ type: "text", text: "旧消息" }], model: "m", provider: "p" },
    }];
    const stats = computeSessionStats(legacy);
    expect(stats.assistantMessages).toBe(1);
    expect(stats.cost).toBe(0);
    expect(stats.tokens.total).toBe(0);
  });
});
