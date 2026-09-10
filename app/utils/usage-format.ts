import type { SessionStatsInfo } from "#shared/lib/types";

// 使用量的紧凑格式化 顶栏显示与悬浮明细共用

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// 无价格数据与真实为零都显示 -- 不做估算 成本单位沿用 pi 的美元
export function formatCost(total: number): string {
  if (!total || total <= 0) return "--";
  if (total < 0.01) return `$${total.toFixed(4)}`;
  return `$${total.toFixed(2)}`;
}

// 悬浮明细 四类 token 与成本
export function usageBreakdown(stats: SessionStatsInfo): string {
  const { tokens, cost } = stats;
  return [
    `输入 ${tokens.input.toLocaleString()}`,
    `输出 ${tokens.output.toLocaleString()}`,
    `缓存读 ${tokens.cacheRead.toLocaleString()}`,
    `缓存写 ${tokens.cacheWrite.toLocaleString()}`,
    `成本 ${formatCost(cost)}`,
  ].join(" · ");
}
