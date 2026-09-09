// Ported from pi-web lib/session-stats.ts — https://github.com/agegr/pi-web (MIT)
// 从完整 entry 列表累计 token 与成本 与 SDK 的 getSessionStats 同一套口径
// compaction 只追加摘要 entry 被汇总的历史仍留在文件里 因此累计值单调增长
// 只按活跃上下文统计的话 压缩后旧历史的 usage 会凭空消失 计数看起来被重置
// 本项目不做消息分页 因此省略 pi-web 为惰性加载准备的 mergeSessionStats

import type { AgentMessage, AgentUsage, SessionEntry, SessionStatsInfo } from "./types";

function emptyStats(): SessionStatsInfo {
  return {
    userMessages: 0,
    assistantMessages: 0,
    toolCalls: 0,
    toolResults: 0,
    totalMessages: 0,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    cost: 0,
  };
}

function addUsage(stats: SessionStatsInfo, usage?: AgentUsage): void {
  if (!usage) return;
  stats.tokens.input += usage.input ?? 0;
  stats.tokens.output += usage.output ?? 0;
  stats.tokens.cacheRead += usage.cacheRead ?? 0;
  stats.tokens.cacheWrite += usage.cacheWrite ?? 0;
  stats.cost += usage.cost?.total ?? 0;
}

function addMessage(stats: SessionStatsInfo, message: AgentMessage): void {
  stats.totalMessages += 1;
  if (message.role === "user") {
    stats.userMessages += 1;
  } else if (message.role === "toolResult") {
    stats.toolResults += 1;
    addUsage(stats, message.usage);
  } else if (message.role === "assistant") {
    stats.assistantMessages += 1;
    if (Array.isArray(message.content)) {
      stats.toolCalls += message.content.filter((c) => c.type === "toolCall").length;
    }
    addUsage(stats, message.usage);
  }
}

function finishStats(stats: SessionStatsInfo): SessionStatsInfo {
  stats.tokens.total = stats.tokens.input + stats.tokens.output + stats.tokens.cacheRead + stats.tokens.cacheWrite;
  return stats;
}

export function computeSessionStats(entries: SessionEntry[]): SessionStatsInfo {
  const stats = emptyStats();

  for (const entry of entries) {
    // 压缩摘要 entry 自带一次 usage 只累计不计数
    if (entry.type === "compaction") {
      addUsage(stats, entry.usage);
      continue;
    }
    if (entry.type !== "message") continue;
    addMessage(stats, entry.message);
  }

  return finishStats(stats);
}
