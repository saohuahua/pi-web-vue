import { describe, expect, it } from "vitest";
import { buildSessionContext, sliceActiveBranch } from "#server/utils/session-reader";
import type { SessionEntry } from "#shared/lib/types";

const entries: SessionEntry[] = [
  { type: "model_change", id: "model", parentId: null, timestamp: "2026-01-01T00:00:00.000Z", provider: "test", modelId: "model-a" },
  { type: "thinking_level_change", id: "thinking", parentId: "model", timestamp: "2026-01-01T00:00:01.000Z", thinkingLevel: "high" },
  { type: "message", id: "user-a", parentId: "thinking", timestamp: "2026-01-01T00:00:02.000Z", message: { role: "user", content: "A" } },
  { type: "message", id: "assistant-a", parentId: "user-a", timestamp: "2026-01-01T00:00:03.000Z", message: { role: "assistant", content: [], model: "model-a", provider: "test" } },
  { type: "message", id: "user-b", parentId: "assistant-a", timestamp: "2026-01-01T00:00:04.000Z", message: { role: "user", content: "B" } },
  { type: "message", id: "user-c", parentId: "assistant-a", timestamp: "2026-01-01T00:00:05.000Z", message: { role: "user", content: "C" } },
];

describe("会话上下文", () => {
  it("沿指定叶子回溯分支", () => {
    expect(sliceActiveBranch(entries, "user-b", entries.length).map((entry) => entry.id)).toEqual([
      "model",
      "thinking",
      "user-a",
      "assistant-a",
      "user-b",
    ]);
  });

  it("保持消息与 entryIds 平行并推导设置", () => {
    const context = buildSessionContext(entries, "user-c");

    expect(context.entryIds).toEqual(["user-a", "assistant-a", "user-c"]);
    expect(context.messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    expect(context.thinkingLevel).toBe("high");
    expect(context.model).toEqual({ provider: "test", modelId: "model-a" });
  });

  it("统计按完整 entry 列表累计 与显示分支无关", () => {
    // user-c 分支只显示三条消息 但 user-b 也属于文件累计
    const context = buildSessionContext(entries, "user-c");

    expect(context.stats.userMessages).toBe(3);
    expect(context.stats.totalMessages).toBe(4);
  });
});
