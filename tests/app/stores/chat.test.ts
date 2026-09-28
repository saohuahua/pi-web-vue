import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// sendAgentCommand 走网络 按用例分别 mock
vi.mock("#shared/lib/agent-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#shared/lib/agent-client")>()),
  sendAgentCommand: vi.fn(),
}));

import { sendAgentCommand } from "#shared/lib/agent-client";
import type { AttachedImage } from "#shared/lib/types";
import { useChatStore } from "~/stores/chat";

const command = vi.mocked(sendAgentCommand);

function createImage(name: string): AttachedImage {
  return { data: `data-${name}`, mimeType: "image/png", previewUrl: `preview-${name}` };
}

function stubConnectedEventSource(
  event: { type: string; errorMessage?: string } = { type: "connected" },
) {
  class ConnectedEventSource {
    readonly readyState = 1;
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor() {
      queueMicrotask(() =>
        this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>),
      );
    }

    close() {}
  }

  vi.stubGlobal("EventSource", ConnectedEventSource);
}

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
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const id = /\/api\/sessions\/([^/?]+)/.exec(String(url))?.[1] ?? "";
      const cfg = responses.get(id) ?? { delay: 0, body: { context: {}, info: null } };
      await new Promise((r) => setTimeout(r, cfg.delay));
      return { ok: true, json: async () => cfg.body } as Response;
    }),
  );
}

beforeEach(() => {
  setActivePinia(createPinia());
  command.mockReset();
  command.mockResolvedValue({});
  stubConnectedEventSource();
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chat store 会话选择", () => {
  it("快速连续打开两个会话 慢的旧响应被丢弃 最终内容属于后选的会话", async () => {
    stubFetchByDelay(
      new Map([
        ["session-a", { delay: 80, body: sessionBody("session-a", "A 的消息") }],
        ["session-b", { delay: 5, body: sessionBody("session-b", "B 的消息") }],
      ]),
    );

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
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      toolResults: 0,
      totalMessages: 0,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total },
      cost: 0,
    });
    stubFetchByDelay(
      new Map([
        [
          "session-a",
          {
            delay: 0,
            body: {
              ...sessionBody("session-a", "A"),
              context: { ...sessionBody("s", "A").context, stats: statsOf(999) },
            },
          },
        ],
        [
          "session-b",
          {
            delay: 0,
            body: {
              ...sessionBody("session-b", "B"),
              context: { ...sessionBody("s", "B").context, stats: statsOf(0) },
            },
          },
        ],
      ]),
    );

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

describe("chat store prompt 附件", () => {
  it("初始连接启动失败也显示错误提示", async () => {
    stubConnectedEventSource({ type: "startup_error", errorMessage: "启动失败" });
    stubFetchByDelay(new Map());
    const chat = useChatStore();
    await chat.openSession("s1");
    await Promise.resolve();
    expect(chat.notices.map((notice) => notice.message)).toEqual(["启动失败"]);
    chat.close();
  });

  it("发送握手启动失败仅提示一次且撤回乐观消息", async () => {
    stubConnectedEventSource({ type: "startup_error", errorMessage: "启动失败" });
    const chat = useChatStore();
    chat.sessionId = "s1";
    const image = createImage("failed-start");
    chat.attachedImages.push(image);
    expect(await chat.sendPrompt("待发送", [image])).toBe(false);
    expect(chat.notices.map((notice) => notice.message)).toEqual(["启动失败"]);
    expect(chat.messages).toEqual([]);
    expect(chat.entryIds).toEqual([]);
    expect(chat.attachedImages).toEqual([image]);
    expect(chat.isRunning).toBe(false);
    expect(command).not.toHaveBeenCalled();
  });

  it("只发送本批附件 成功后保留发送期间新增附件", async () => {
    const chat = useChatStore();
    chat.sessionId = "s1";
    const first = createImage("first");
    const second = createImage("second");
    chat.attachedImages.push(first);

    const pending = chat.sendPrompt("带图", [first]);
    chat.attachedImages.push(second);

    await expect(pending).resolves.toBe(true);
    expect(command).toHaveBeenCalledWith("s1", {
      type: "prompt",
      message: "带图",
      images: [{ type: "image", data: "data-first", mimeType: "image/png" }],
    });
    expect(chat.attachedImages).toEqual([second]);
  });

  it("提交失败时撤回乐观消息并保留附件草稿", async () => {
    const chat = useChatStore();
    chat.sessionId = "s1";
    const image = createImage("failed");
    chat.attachedImages.push(image);
    command.mockRejectedValueOnce(new Error("HTTP 500"));

    await expect(chat.sendPrompt("失败消息", [image])).resolves.toBe(false);

    expect(chat.messages).toEqual([]);
    expect(chat.entryIds).toEqual([]);
    expect(chat.attachedImages).toEqual([image]);
  });

  it("切换会话后旧提交不修改新会话状态", async () => {
    const chat = useChatStore();
    chat.sessionId = "old";
    const oldImage = createImage("old");
    const newImage = createImage("new");
    chat.attachedImages.push(oldImage);
    let resolveCommand!: (value: unknown) => void;
    command.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCommand = resolve;
        }),
    );

    const pending = chat.sendPrompt("旧消息", [oldImage]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(command).toHaveBeenCalledTimes(1);

    chat.close();
    chat.sessionId = "new";
    chat.attachedImages.push(newImage);
    resolveCommand({});

    await expect(pending).resolves.toBeNull();
    expect(chat.sessionId).toBe("new");
    expect(chat.isRunning).toBe(false);
    expect(chat.attachedImages).toEqual([newImage]);
  });

  it("切走再回到同一会话时旧失败不能清除新一轮运行状态", async () => {
    const old = Promise.withResolvers<unknown>();
    command.mockImplementationOnce(() => old.promise);
    const chat = useChatStore();
    chat.sessionId = "same";
    const pending = chat.sendPrompt("旧请求");
    await new Promise((resolve) => setTimeout(resolve, 0));
    chat.close();
    chat.sessionId = "other";
    chat.close();
    chat.sessionId = "same";
    expect(await chat.sendPrompt("新请求")).toBe(true);
    old.reject(new Error("旧请求失败"));
    expect(await pending).toBeNull();
    expect(chat.isRunning).toBe(true);
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0]).toMatchObject({ role: "user", content: "新请求" });
    expect(chat.entryIds).toHaveLength(1);
    expect(chat.notices).toEqual([]);
    chat.close();
  });

  it("同名会话重入时旧握手等待者不能提交旧消息", async () => {
    const chat = useChatStore();
    chat.sessionId = "same";
    const old = chat.sendPrompt("旧握手消息");
    chat.close();
    chat.sessionId = "same";
    const fresh = chat.sendPrompt("新握手消息");
    expect(await old).toBeNull();
    expect(await fresh).toBe(true);
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith("same", { type: "prompt", message: "新握手消息" });
    expect(chat.isRunning).toBe(true);
    expect(chat.notices).toEqual([]);
    chat.close();
  });
});

describe("chat store slash commands", () => {
  it("只拉取并缓存 get_commands", async () => {
    const chat = useChatStore();
    chat.sessionId = "s1";
    command.mockResolvedValueOnce({
      commands: [{ name: "review", description: "审查代码", source: "prompt" }],
    });

    await chat.fetchRuntimeInfo();
    await chat.fetchRuntimeInfo();

    expect(chat.slashCommands).toEqual([
      { name: "review", description: "审查代码", source: "prompt" },
    ]);
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith("s1", { type: "get_commands" });
  });
});

describe("chat store 会话分支", () => {
  const branchedBody = (leafId: string) => ({
    ...sessionBody("s1", "开头"),
    activeLeafId: leafId,
    tree: [
      {
        id: "first",
        parentId: null,
        type: "message",
        preview: "开头",
        children: [
          {
            id: "answer",
            parentId: "first",
            type: "message",
            children: [
              { id: "left", parentId: "answer", type: "message", preview: "方案甲", children: [] },
              { id: "right", parentId: "answer", type: "message", preview: "方案乙", children: [] },
            ],
          },
        ],
      },
    ],
  });

  it("先预览再导航 最后加载权威分支", async () => {
    let serverLeaf = "left";
    const order: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/context?")) {
          order.push("preview");
          return { ok: true, json: async () => ({ context: {} }) } as Response;
        }
        if (String(url).endsWith("/api/sessions/s1")) order.push("detail");
        return { ok: true, json: async () => branchedBody(serverLeaf) } as Response;
      }),
    );
    command.mockImplementation(async (_id, request) => {
      if (request.type === "navigate_tree") {
        order.push("navigate");
        serverLeaf = String(request.targetId);
      }
      return {};
    });
    const chat = useChatStore();
    await chat.openSession("s1");
    order.length = 0;
    expect(await chat.navigateToLeaf("right")).toBe(true);
    expect(order).toEqual(["preview", "navigate", "detail"]);
    expect(chat.activeLeafId).toBe("right");
    expect(chat.branches[1]?.isActive).toBe(true);
    chat.close();
  });

  it("导航拒绝后仍停留原分支", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/context?")
          ? ({ ok: true, json: async () => ({ context: {} }) } as Response)
          : ({ ok: true, json: async () => branchedBody("left") } as Response),
      ),
    );
    command.mockImplementation(async (_id, request) => {
      if (request.type === "navigate_tree") throw new Error("拒绝导航");
      return {};
    });
    const chat = useChatStore();
    await chat.openSession("s1");
    expect(await chat.navigateToLeaf("right")).toBe(false);
    expect(chat.activeLeafId).toBe("left");
    expect(chat.positionUnknown).toBe(false);
    chat.close();
  });

  it("回退后仍无法读取权威状态则锁住发送", async () => {
    let detailCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/context?"))
          return { ok: true, json: async () => ({ context: {} }) } as Response;
        if (String(url).endsWith("/api/sessions/s1")) detailCalls += 1;
        return detailCalls === 1
          ? ({ ok: true, json: async () => branchedBody("left") } as Response)
          : ({ ok: false, status: 503 } as Response);
      }),
    );
    const chat = useChatStore();
    await chat.openSession("s1");
    expect(await chat.navigateToLeaf("right")).toBe(false);
    expect(chat.positionUnknown).toBe(true);
    expect(await chat.sendPrompt("不能发送")).toBe(false);
    expect(command).not.toHaveBeenCalledWith("s1", { type: "prompt", message: "不能发送" });
    chat.close();
  });
});

describe("chat store 草稿恢复", () => {
  it("切换会话后恢复各自的文字", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    stubFetchByDelay(
      new Map([
        ["a", { delay: 0, body: sessionBody("a", "A") }],
        ["b", { delay: 0, body: sessionBody("b", "B") }],
      ]),
    );
    const chat = useChatStore();
    await chat.openSession("a");
    chat.draft = "草稿甲";
    await chat.openSession("b");
    chat.draft = "草稿乙";
    await chat.openSession("a");
    expect(chat.draft).toBe("草稿甲");
    expect(values.get("pi-agent:drafts:v1")).not.toContain("previewUrl");
    chat.close();
  });

  it("提交拒绝后合并期间输入并保留图片", async () => {
    const chat = useChatStore();
    chat.sessionId = "s1";
    const image = createImage("retry");
    chat.attachedImages.push(image);
    command.mockImplementationOnce(async () => {
      chat.draft = "期间输入";
      throw new Error("提交失败");
    });
    expect(await chat.submitPrompt("原提交", [image])).toBe(false);
    expect(chat.draft).toBe("原提交\n\n期间输入");
    expect(chat.attachedImages).toEqual([image]);
    chat.close();
  });

  it("连接结果不明时提示先核对且保留文字", async () => {
    const chat = useChatStore();
    chat.sessionId = "s1";
    command.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await chat.submitPrompt("可能已提交")).toBe(false);
    expect(chat.draft).toBe("可能已提交");
    expect(chat.notices.at(-1)?.message).toContain("结果未确认");
    chat.close();
  });
});
