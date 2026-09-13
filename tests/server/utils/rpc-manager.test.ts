import { describe, expect, it, vi } from "vitest";
import { AgentSessionWrapper } from "#server/utils/rpc-manager";

type PromptOptions = {
  preflightResult?: (success: boolean) => void;
};

// 命令分支用到的成员差异很大 默认给最小可用实现 用例按需覆盖
function createWrapper(
  prompt: (text: string, options?: PromptOptions) => Promise<void>,
  extra: Record<string, unknown> = {},
) {
  return new AgentSessionWrapper({
    sessionId: "test-session",
    sessionFile: undefined,
    isStreaming: false,
    isCompacting: false,
    model: undefined,
    sessionManager: {},
    agent: {},
    prompt,
    abort: async () => {},
    dispose: () => {},
    navigateTree: async () => null,
    setSessionName: () => {},
    getContextUsage: () => undefined,
    ...extra,
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

  it("非法图片在进入 SDK 前被边界校验拒绝", async () => {
    const prompt = vi.fn(async () => {});
    const wrapper = createWrapper(prompt);

    await expect(wrapper.send({
      type: "prompt",
      message: "看图",
      images: [{ type: "image", data: "!!!不是base64!!!", mimeType: "image/png" }],
    })).rejects.toThrow(/base64/);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("合法图片透传给 SDK", async () => {
    const prompt = vi.fn((_text: string, options?: PromptOptions & { images?: unknown[] }) => {
      options?.preflightResult?.(true);
      return Promise.resolve();
    });
    const wrapper = createWrapper(prompt);

    await expect(wrapper.send({
      type: "prompt",
      message: "看图",
      images: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }],
    })).resolves.toBeNull();
    expect(prompt.mock.calls[0]?.[1]).toMatchObject({
      images: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }],
    });
  });
});

describe("AgentSessionWrapper 运行控制命令", () => {
  it("set_model 未命中时刷新一次 runtime 命中后切换", async () => {
    const getModel = vi.fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ id: "m2", provider: "p" });
    const refresh = vi.fn(async () => {});
    const setModel = vi.fn(async () => {});
    const wrapper = createWrapper(async () => {}, {
      modelRuntime: { getModel, refresh },
      setModel,
    });

    await expect(wrapper.send({ type: "set_model", provider: "p", modelId: "m2" }))
      .resolves.toEqual({ id: "m2", provider: "p" });
    expect(getModel).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledWith({ allowNetwork: false });
    expect(setModel).toHaveBeenCalledWith({ id: "m2", provider: "p" });
  });

  it("set_model 刷新后仍不存在时抛错 不触碰 setModel", async () => {
    const getModel = vi.fn(() => undefined);
    const setModel = vi.fn(async () => {});
    const wrapper = createWrapper(async () => {}, {
      modelRuntime: { getModel, refresh: async () => {} },
      setModel,
    });

    await expect(wrapper.send({ type: "set_model", provider: "p", modelId: "nope" }))
      .rejects.toThrow("Model not found: p/nope");
    expect(setModel).not.toHaveBeenCalled();
  });

  it("set_thinking_level 透传等级", async () => {
    const setThinkingLevel = vi.fn();
    const wrapper = createWrapper(async () => {}, { setThinkingLevel });

    await expect(wrapper.send({ type: "set_thinking_level", level: "high" })).resolves.toBeNull();
    expect(setThinkingLevel).toHaveBeenCalledWith("high");
  });

  it("compact 返回 SDK 结果", async () => {
    const compact = vi.fn(async () => ({ ok: true }));
    const wrapper = createWrapper(async () => {}, { compact });

    await expect(wrapper.send({ type: "compact", customInstructions: "保留要点" }))
      .resolves.toEqual({ ok: true });
    expect(compact).toHaveBeenCalledWith("保留要点");
  });

  it("compact 抛错时不吞异常", async () => {
    const wrapper = createWrapper(async () => {}, {
      compact: async () => { throw new Error("busy"); },
    });

    await expect(wrapper.send({ type: "compact" })).rejects.toThrow("busy");
  });

  it("abort_compaction 独立于 abort", async () => {
    const abortCompaction = vi.fn();
    const abort = vi.fn(async () => {});
    const wrapper = createWrapper(abort, { abortCompaction });

    await expect(wrapper.send({ type: "abort_compaction" })).resolves.toBeNull();
    expect(abortCompaction).toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
  });
});

describe("AgentSessionWrapper 只读信息命令", () => {
  it("get_state 返回 system prompt 与 context usage", async () => {
    const wrapper = createWrapper(async () => {}, {
      agent: { state: { systemPrompt: "你是 pi", thinkingLevel: "off" } },
      getContextUsage: () => ({ percent: 42, contextWindow: 100_000, tokens: 42_000 }),
    });

    await expect(wrapper.send({ type: "get_state" })).resolves.toMatchObject({
      systemPrompt: "你是 pi",
      contextUsage: { percent: 42, contextWindow: 100_000, tokens: 42_000 },
    });
  });

  it("get_commands 返回模板与技能命令的名称 说明 来源", async () => {
    const wrapper = createWrapper(async () => {}, {
      promptTemplates: [{ name: "review", description: "审查代码" }],
      resourceLoader: { getSkills: () => ({ skills: [{ name: "psd2code", description: "转页面" }] }) },
    });

    await expect(wrapper.send({ type: "get_commands" })).resolves.toEqual({
      commands: [
        { name: "review", description: "审查代码", source: "prompt" },
        { name: "skill:psd2code", description: "转页面", source: "skill" },
      ],
    });
  });

  it("get_tools 标注工具是否活跃", async () => {
    const wrapper = createWrapper(async () => {}, {
      getAllTools: () => [
        { name: "read", description: "读文件" },
        { name: "write", description: "写文件" },
      ],
      getActiveToolNames: () => ["read"],
    });

    await expect(wrapper.send({ type: "get_tools" })).resolves.toEqual([
      { name: "read", description: "读文件", active: true },
      { name: "write", description: "写文件", active: false },
    ]);
  });
});
