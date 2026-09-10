import { describe, expect, it } from "vitest";
import { formatCost, formatTokenCount, usageBreakdown } from "./usage-format";
import type { SessionStatsInfo } from "#shared/lib/types";

describe("formatTokenCount", () => {
  it("千与百万的紧凑形式", () => {
    expect(formatTokenCount(8076)).toBe("8.1k");
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1_234_567)).toBe("1.2M");
  });
});

describe("formatCost", () => {
  it("零与负值显示 -- 不估算", () => {
    expect(formatCost(0)).toBe("--");
    expect(formatCost(-1)).toBe("--");
  });

  it("小额四位小数 大额两位", () => {
    expect(formatCost(0.0042)).toBe("$0.0042");
    expect(formatCost(1.5)).toBe("$1.50");
  });
});

describe("usageBreakdown", () => {
  it("四类 token 与成本全列出", () => {
    const stats: SessionStatsInfo = {
      userMessages: 1, assistantMessages: 1, toolCalls: 0, toolResults: 0, totalMessages: 2,
      tokens: { input: 1000, output: 200, cacheRead: 50, cacheWrite: 10, total: 1260 },
      cost: 0.01,
    };
    const text = usageBreakdown(stats);
    expect(text).toContain("输入 1,000");
    expect(text).toContain("输出 200");
    expect(text).toContain("缓存读 50");
    expect(text).toContain("缓存写 10");
    expect(text).toContain("成本 $0.01");
  });
});
