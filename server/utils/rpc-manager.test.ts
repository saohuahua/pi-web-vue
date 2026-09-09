import { describe, expect, it, vi } from "vitest";
import { AgentSessionWrapper } from "./rpc-manager";

type PromptOptions = {
  preflightResult?: (success: boolean) => void;
};

function createWrapper(prompt: (text: string, options?: PromptOptions) => Promise<void>) {
  return new AgentSessionWrapper({
    sessionId: "test-session",
    sessionFile: undefined,
    isStreaming: false,
    isCompacting: false,
    model: undefined,
    sessionManager: {},
    agent: {},
    subscribe: () => () => {},
    prompt,
    abort: async () => {},
    dispose: () => {},
    navigateTree: async () => null,
    setSessionName: () => {},
    getContextUsage: () => undefined,
  } as never);
}

describe("AgentSessionWrapper prompt", () => {
  it("preflight 接受后先确认 HTTP 并在运行结束时发送 prompt_done", async () => {
    let finishPrompt: () => void = () => {};
    const completion = new Promise<void>((resolve) => { finishPrompt = resolve; });
    const wrapper = createWrapper((_text, options) => {
      options?.preflightResult?.(true);
      return completion;
    });
    const events: string[] = [];
    wrapper.onEvent((event) => events.push(event.type));

    await expect(wrapper.send({ type: "prompt", message: "hello" })).resolves.toBeNull();
    expect(wrapper.isRunning()).toBe(true);

    finishPrompt();
    await vi.waitFor(() => expect(events).toEqual(["prompt_done"]));
    expect(wrapper.isRunning()).toBe(false);
  });

  it("同步抛错后回滚运行计数", async () => {
    const wrapper = createWrapper(() => {
      throw new Error("preflight failed");
    });

    await expect(wrapper.send({ type: "prompt", message: "hello" })).rejects.toThrow("preflight failed");
    expect(wrapper.isRunning()).toBe(false);
  });

  it("接受后的异步失败发送 prompt_error 与 prompt_done", async () => {
    const wrapper = createWrapper((_text, options) => {
      options?.preflightResult?.(true);
      return Promise.reject(new Error("model failed"));
    });
    const events: Array<{ type: string; errorMessage?: unknown }> = [];
    wrapper.onEvent((event) => events.push(event));

    await expect(wrapper.send({ type: "prompt", message: "hello" })).resolves.toBeNull();
    await vi.waitFor(() => expect(events).toEqual([
      { type: "prompt_error", errorMessage: "model failed" },
      { type: "prompt_done" },
    ]));
    expect(wrapper.isRunning()).toBe(false);
  });
});
