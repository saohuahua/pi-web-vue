import { describe, expect, it } from "vitest";
import {
  appendTitleRequestToTrailingUser,
  parseGeneratedSessionTitle,
  sanitizeTitleMessages,
} from "#server/utils/session-title";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

describe("parseGeneratedSessionTitle", () => {
  it("纯文本剥掉首行以外的内容与结尾标点", () => {
    expect(parseGeneratedSessionTitle("修复登录跳转。\n\n多余解释")).toBe("修复登录跳转");
  });

  it("剥 markdown 代码块与 JSON 包装", () => {
    expect(parseGeneratedSessionTitle("```json\n{\"title\": \"接口联调\"}\n```")).toBe("接口联调");
    expect(parseGeneratedSessionTitle("{\"title\": \"会话名\"}")).toBe("会话名");
  });

  it("剥标题前缀与包裹引号 含中文引号", () => {
    expect(parseGeneratedSessionTitle("标题: 排查白屏")).toBe("排查白屏");
    expect(parseGeneratedSessionTitle("Session Title - fix bug")).toBe("fix bug");
    expect(parseGeneratedSessionTitle("「路由重构」")).toBe("路由重构");
  });

  it("超长截断到 80 字符", () => {
    expect(parseGeneratedSessionTitle("长".repeat(100)).length).toBe(80);
  });

  it("无可读字符抛错", () => {
    expect(() => parseGeneratedSessionTitle("!!! ???")).toThrow();
    expect(() => parseGeneratedSessionTitle("")).toThrow();
  });
});

describe("appendTitleRequestToTrailingUser", () => {
  it("末条是用户消息时折叠进该消息", () => {
    const messages = [
      { role: "user", content: "帮我看看" },
    ] as unknown as AgentMessage[];
    const appended = appendTitleRequestToTrailingUser(messages);
    expect(appended).toHaveLength(1);
    expect((appended[0] as { content: string }).content).toContain("帮我看看");
    expect((appended[0] as { content: string }).content).toContain("concise title");
    // 原数组不被改动
    expect((messages[0] as { content: string }).content).toBe("帮我看看");
  });

  it("末条不是用户消息时原样返回", () => {
    const messages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: [], model: "m", provider: "p" },
    ] as unknown as AgentMessage[];
    expect(appendTitleRequestToTrailingUser(messages)).toBe(messages);
  });
});

describe("sanitizeTitleMessages", () => {
  const toolCall = (id: string) => ({ type: "toolCall" as const, id, name: "read", arguments: {} });
  const toolResult = (id: string) => ({
    role: "toolResult" as const,
    toolCallId: id,
    content: [{ type: "text" as const, text: "ok" }],
  });

  it("去掉无结果的 toolCall 与孤儿 toolResult", () => {
    const messages = [
      { role: "user", content: "读文件" },
      {
        role: "assistant",
        content: [toolCall("t1"), toolCall("t2")],
        model: "m",
        provider: "p",
      },
      toolResult("t1"),
      // t2 没有结果 中断的 run 会留下这种残缺对
      toolResult("t9"),
    ] as unknown as AgentMessage[];
    const sanitized = sanitizeTitleMessages(messages);
    expect(sanitized).toHaveLength(3);
    const assistant = sanitized[1] as { content: Array<{ id?: string; type: string }> };
    expect(assistant.content.map((c) => c.id)).toEqual(["t1"]);
    expect(sanitized[2]).toMatchObject({ toolCallId: "t1" });
  });

  it("toolCall 全被清空的 assistant 消息整条移除", () => {
    const messages = [
      {
        role: "assistant",
        content: [toolCall("gone")],
        model: "m",
        provider: "p",
      },
      { role: "user", content: "继续" },
    ] as unknown as AgentMessage[];
    const sanitized = sanitizeTitleMessages(messages);
    expect(sanitized.map((m) => m.role)).toEqual(["user"]);
  });
});
