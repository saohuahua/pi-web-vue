import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// sendAgentCommand 走网络 按用例分别 mock
vi.mock("#shared/lib/agent-client", () => ({
  sendAgentCommand: vi.fn(),
}));

import { sendAgentCommand } from "#shared/lib/agent-client";
import { useChatStore } from "~/stores/chat";

const command = vi.mocked(sendAgentCommand);

function sessionBody(id: string, firstMessage: string) {
  return {
    info: { id, cwd: "D:\\proj", name: null, projectKey: "k", projectRoot: "D:\\proj" },
    context: {
      messages: [{ role: "user", content: firstMessage, timestamp: 1 }],
      entryIds: ["e1"],
      stats: null,
      thinkingLevel: "off",
      model: null,
    },
    activeLeafId: null,
  };
}

// 不同会话返回不同延迟的响应 模拟慢请求竞态
function stubFetchByDelay(responses: Map<string, { delay: number; body: unknown }>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const id = /\/api\/sessions\/([^/?]+)/.exec(String(url))?.[1] ?? "";
    const cfg = responses.get(id) ?? { delay: 0, body: { context: {}, info: null } };
    await new Promise((r) => setTimeout(r, cfg.delay));
    return { ok: true, json: async () => cfg.body } as Response;
  }));
}

beforeEach(() => {
  setActivePinia(createPinia());
  command.mockReset();
  command.mockResolvedValue({});
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
});

describe("chat store 会话选择", () => {
  it("快速连续打开两个会话 慢的旧响应被丢弃 最终内容属于后选的会话", async () => {
    stubFetchByDelay(new Map([
      ["session-a", { delay: 80, body: sessionBody("session-a", "A 的消息") }],
      ["session-b", { delay: 5, body: sessionBody("session-b", "B 的消息") }],
    ]));

    const chat = useChatStore();
    const first = chat.openSession("session-a");
    const second = chat.openSession("session-b");
    await Promise.all([first, second]);
    // 让竞态彻底落地
    await new Promise((r) => setTimeout(r, 120));

    expect(chat.sessionId).toBe("session-b");
    expect(chat.messages).toHaveLength(1);
    expect((chat.messages[0] as { content: string }).content).toBe("B 的消息");
  });

  it("切换会话立即清空旧统计 不短暂串会话", async () => {
    const statsOf = (total: number) => ({
      userMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0, totalMessages: 0,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total },
      cost: 0,
    });
    stubFetchByDelay(new Map([
      ["session-a", { delay: 0, body: { ...sessionBody("session-a", "A"), context: { ...sessionBody("s", "A").context, stats: statsOf(999) } } }],
      ["session-b", { delay: 0, body: { ...sessionBody("session-b", "B"), context: { ...sessionBody("s", "B").context, stats: statsOf(0) } } }],
    ]));

    const chat = useChatStore();
    await chat.openSession("session-a");
    expect(chat.stats).toBeTruthy();
    // openSession 先 close 再加载 统计不会沿用上一个会话
    const p = chat.openSession("session-b");
    expect(chat.stats).toBeNull();
    await p;
    expect(chat.stats?.tokens.total).toBe(0);
  });
});

describe("chat store 模型与思考等级切换", () => {
  it("set_model 失败保留原选择并提示 成功才更新", async () => {
    const chat = useChatStore();
    chat.sessionId = "s1";
    chat.model = { provider: "p", id: "old" };

    command.mockRejectedValueOnce(new Error("Model not found: p/m2"));
    await expect(chat.setModel("p", "m2")).resolves.toBe(false);
    expect(chat.model).toEqual({ provider: "p", id: "old" });
    expect(chat.notices).toHaveLength(1);
    expect(chat.notices[0]?.message).toContain("Model not found");

    command.mockResolvedValueOnce({ id: "m2", provider: "p" });
    await expect(chat.setModel("p", "m2")).resolves.toBe(true);
    expect(chat.model).toEqual({ provider: "p", id: "m2" });
  });

  it("set_thinking_level 失败保留原等级", async () => {
    const chat = useChatStore();
    chat.sessionId = "s1";
    chat.thinkingLevel = "low";

    command.mockRejectedValueOnce(new Error("bad level"));
    await expect(chat.setThinkingLevel("xhigh")).resolves.toBe(false);
    expect(chat.thinkingLevel).toBe("low");

    command.mockResolvedValueOnce(null);
    await expect(chat.setThinkingLevel("high")).resolves.toBe(true);
    expect(chat.thinkingLevel).toBe("high");
  });
});
