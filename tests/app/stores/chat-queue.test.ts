import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("#shared/lib/agent-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#shared/lib/agent-client")>()),
  sendAgentCommand: vi.fn(),
}));

import { sendAgentCommand } from "#shared/lib/agent-client";
import { useChatStore } from "~/stores/chat";

const command = vi.mocked(sendAgentCommand);

beforeEach(() => {
  setActivePinia(createPinia());
  command.mockReset();
  command.mockResolvedValue({});
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
  vi.stubGlobal(
    "EventSource",
    class {
      readonly readyState = 1;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor() {
        queueMicrotask(() =>
          this.onmessage?.({ data: JSON.stringify({ type: "connected" }) } as MessageEvent<string>),
        );
      }
      close() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("chat store 运行中队列", () => {
  it("仅在 SDK 确认后由队列事件展示追加内容", async () => {
    const chat = useChatStore();
    chat.sessionId = "s1";
    chat.isRunning = true;
    chat.draft = "改变方向";
    expect(await chat.submitQueuedPrompt("改变方向", "steer")).toBe(true);
    expect(command).toHaveBeenCalledWith("s1", {
      type: "prompt",
      message: "改变方向",
      streamingBehavior: "steer",
    });
    expect(chat.queuedMessages.steering).toEqual([]);
    expect(chat.messages).toEqual([]);
    expect(chat.draft).toBe("");
    chat.close();
  });

  it("运行态快照恢复真实队列", async () => {
    command.mockResolvedValueOnce({ queuedMessages: { steering: ["纠偏"], followUp: ["收尾"] } });
    const chat = useChatStore();
    chat.sessionId = "s1";
    await chat.refreshRuntimeState();
    expect(chat.queuedMessages).toEqual({ steering: ["纠偏"], followUp: ["收尾"] });
    chat.close();
  });

  it("停止前撤回全部队列并只恢复实际返回文本", async () => {
    const order: string[] = [];
    command.mockImplementation(async (_id, request) => {
      order.push(String(request.type));
      if (request.type === "clear_queue") return { steering: ["纠偏"], followUp: ["收尾"] };
      return null;
    });
    const chat = useChatStore();
    chat.sessionId = "s1";
    chat.isRunning = true;
    await chat.stop();
    expect(order).toEqual(["clear_queue", "abort"]);
    expect(chat.draft).toBe("纠偏\n\n收尾");
    chat.close();
  });

  it("清队列失败时不误称任务已停止", async () => {
    command.mockRejectedValueOnce(new Error("撤回失败"));
    const chat = useChatStore();
    chat.sessionId = "s1";
    chat.isRunning = true;
    await chat.stop();
    expect(command).toHaveBeenCalledTimes(1);
    expect(chat.isRunning).toBe(true);
    expect(chat.notices.at(-1)?.message).toContain("当前任务仍在运行");
    chat.close();
  });

  it("abort 失败时保持运行态等待事件对账", async () => {
    command.mockImplementation(async (_id, request) => {
      if (request.type === "clear_queue") return { steering: [], followUp: [] };
      throw new Error("停止失败");
    });
    const chat = useChatStore();
    chat.sessionId = "s1";
    chat.isRunning = true;
    await chat.stop();
    expect(chat.isRunning).toBe(true);
    expect(chat.notices.at(-1)?.message).toContain("停止失败");
    chat.close();
  });
});
