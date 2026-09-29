import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("#shared/lib/agent-client", () => ({
  AgentCommandError: class extends Error {},
  sendAgentCommand: vi.fn(),
}));

import { sendAgentCommand } from "#shared/lib/agent-client";
import { useChatStore } from "~/stores/chat";

const command = vi.mocked(sendAgentCommand);
let source: TestSource;

class TestSource {
  readonly readyState = 1;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor() {
    source = this;
    queueMicrotask(() => this.emit({ type: "connected" }));
  }
  emit(event: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
  }
  close() {}
}

const detail = (leaf = "left") => ({
  info: { id: "s1", cwd: "", name: null },
  context: { messages: [], entryIds: [] },
  activeLeafId: leaf,
  tree: [],
});
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

beforeEach(() => {
  setActivePinia(createPinia());
  command.mockReset().mockResolvedValue({});
  vi.stubGlobal("EventSource", TestSource);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response(detail())),
  );
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
});

afterEach(() => vi.unstubAllGlobals());

describe("会话异步隔离", () => {
  it("导航恢复读取期间切换会话不会回退旧会话或锁住新会话", async () => {
    const loading = Promise.withResolvers<Response>();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ context: {} }))
      .mockReturnValueOnce(loading.promise);
    command.mockRejectedValueOnce(new Error("导航失败"));
    const chat = useChatStore();
    chat.sessionId = "s1";
    chat.activeLeafId = "left";
    const pending = chat.navigateToLeaf("right");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    chat.close();
    chat.sessionId = "s2";
    chat.activeLeafId = "new-leaf";
    loading.resolve(response(detail()));
    expect(await pending).toBe(false);
    expect(command).toHaveBeenCalledTimes(1);
    expect(chat.positionUnknown).toBe(false);
    expect(chat.navigationError).toBeNull();
    expect(chat.activeLeafId).toBe("new-leaf");
    chat.close();
  });

  it("同名会话重入后旧撤回结果不覆盖新队列和草稿", async () => {
    const old = Promise.withResolvers<unknown>();
    command.mockReturnValueOnce(old.promise);
    const chat = useChatStore();
    chat.sessionId = "s1";
    const pending = chat.recallQueue();
    chat.close();
    chat.sessionId = "s1";
    chat.draft = "新草稿";
    chat.queuedMessages = { steering: [], followUp: ["新任务"] };
    old.resolve({ steering: ["旧任务"], followUp: [] });
    expect(await pending).toBe(false);
    expect(chat.draft).toBe("新草稿");
    expect(chat.queuedMessages.followUp).toEqual(["新任务"]);
    chat.close();
  });

  it("同名会话重入后旧提交不解除新提交的草稿保护", async () => {
    const old = Promise.withResolvers<unknown>();
    const fresh = Promise.withResolvers<unknown>();
    command.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const chat = useChatStore();
    chat.sessionId = "s1";
    const pendingOld = chat.submitPrompt("旧消息");
    await vi.waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    chat.close();
    chat.sessionId = "s1";
    const pendingFresh = chat.submitPrompt("新消息");
    await vi.waitFor(() => expect(command).toHaveBeenCalledTimes(2));
    old.resolve({});
    expect(await pendingOld).toBeNull();
    chat.isRunning = false;
    expect(await chat.submitPrompt("重复提交")).toBe(false);
    fresh.resolve({});
    expect(await pendingFresh).toBe(true);
    chat.close();
  });

  it("旧模型设置和压缩失败不能写入新会话", async () => {
    const model = Promise.withResolvers<unknown>();
    const compact = Promise.withResolvers<unknown>();
    command.mockReturnValueOnce(model.promise).mockReturnValueOnce(compact.promise);
    const chat = useChatStore();
    chat.sessionId = "s1";
    const setting = chat.setModel("old", "old-model");
    const compressing = chat.compact();
    chat.close();
    chat.sessionId = "s2";
    chat.model = { provider: "new", id: "new-model" };
    chat.isCompacting = true;
    model.resolve({});
    compact.reject(new Error("旧压缩失败"));
    expect(await setting).toBe(false);
    await compressing;
    expect(chat.model).toEqual({ provider: "new", id: "new-model" });
    expect(chat.isCompacting).toBe(true);
    expect(chat.notices).toEqual([]);
    chat.close();
  });
});

describe("队列与恢复交错", () => {
  it("停止撤回期间切换会话不显示旧错误或停止新任务", async () => {
    const clearing = Promise.withResolvers<unknown>();
    command.mockReturnValueOnce(clearing.promise);
    const chat = useChatStore();
    chat.sessionId = "s1";
    const stopping = chat.stop();
    chat.close();
    chat.sessionId = "s2";
    clearing.resolve({ steering: [], followUp: [] });
    await stopping;
    expect(chat.notices).toEqual([]);
    expect(chat.isStopping).toBe(false);
    expect(command).toHaveBeenCalledTimes(1);
    chat.close();
  });
  it("从撤回到 abort 返回的整个停止阶段拒绝追加指令", async () => {
    const clearing = Promise.withResolvers<unknown>();
    const aborting = Promise.withResolvers<unknown>();
    command.mockReturnValueOnce(clearing.promise).mockReturnValueOnce(aborting.promise);
    const chat = useChatStore();
    chat.sessionId = "s1";
    chat.isRunning = true;
    const stopping = chat.stop();
    expect(await chat.submitQueuedPrompt("不能排队", "steer")).toBe(false);
    clearing.resolve({ steering: [], followUp: [] });
    await vi.waitFor(() => expect(command).toHaveBeenCalledTimes(2));
    expect(chat.queueActionPending).toBe(false);
    expect(chat.isStopping).toBe(true);
    expect(await chat.submitQueuedPrompt("仍不能排队", "followUp")).toBe(false);
    aborting.resolve({});
    await stopping;
    expect(chat.isStopping).toBe(false);
    expect(command.mock.calls.map(([, request]) => request.type)).toEqual(["clear_queue", "abort"]);
    chat.close();
  });

  it("撤回响应不能覆盖期间更晚的队列事件", async () => {
    const clearing = Promise.withResolvers<unknown>();
    const chat = useChatStore();
    await chat.openSession("s1");
    command.mockImplementation(async (_id, request) =>
      request.type === "clear_queue" ? clearing.promise : {},
    );
    const pending = chat.recallQueue();
    source.emit({ type: "queue_update", steering: [], followUp: ["后来入队"] });
    clearing.resolve({ steering: ["已撤回"], followUp: [] });
    expect(await pending).toBe(true);
    expect(chat.queuedMessages.followUp).toEqual(["后来入队"]);
    expect(chat.draft).toBe("已撤回");
    chat.close();
  });

  it("重连发现任务已结束时清理运行态并恢复权威消息", async () => {
    const chat = useChatStore();
    await chat.openSession("s1");
    vi.mocked(fetch).mockResolvedValue(
      response({
        ...detail(),
        context: {
          messages: [{ role: "assistant", content: [{ type: "text", text: "完成的回复" }] }],
          entryIds: ["answer"],
        },
      }),
    );
    source.emit({ type: "agent_start" });
    source.emit({ type: "tool_execution_start", toolCallId: "tool", toolName: "read" });
    source.emit({ type: "connected", isStreaming: false });
    await vi.waitFor(() => expect(chat.isRunning).toBe(false));
    expect(chat.activeTools.size).toBe(0);
    await vi.waitFor(() => expect(chat.entryIds).toEqual(["answer"]));
    chat.close();
  });

  it("恢复编辑草稿后取消编辑保留未发送文字", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          s1: { text: "恢复的编辑", updatedAt: Date.now(), editingMessageId: "user" },
        }),
      setItem: () => {},
      removeItem: () => {},
    });
    vi.mocked(fetch).mockResolvedValue(
      response({
        ...detail(),
        tree: [{ id: "user", parentId: "parent", children: [], type: "message" }],
      }),
    );
    const chat = useChatStore();
    await chat.openSession("s1");
    expect(chat.editingMessageId).toBe("user");
    chat.cancelEdit();
    expect(chat.editingMessageId).toBeNull();
    expect(chat.draft).toBe("恢复的编辑");
    chat.close();
  });
});
