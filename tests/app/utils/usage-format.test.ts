import { describe, expect, it } from "vitest";
import { formatCost, formatTokenCount } from "~/utils/usage-format";

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
