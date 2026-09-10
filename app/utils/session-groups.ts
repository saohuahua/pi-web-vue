import type { SessionInfo } from "#shared/lib/types";

// 会话列表的项目分组与搜索过滤 纯函数供侧栏与测试复用

export interface SessionGroup {
  key: string;
  label: string;
  sessions: SessionInfo[];
}

// 项目展示名取路径末段 不解码完整路径
export function projectLabelOf(root: string): string {
  const parts = root.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? root;
}

// 按项目分组 传入列表须已按修改时间倒序 Map 插入序即组的最近活动序
export function groupSessionsByProject(sessions: SessionInfo[]): SessionGroup[] {
  const groups = new Map<string, SessionGroup>();
  for (const session of sessions) {
    let group = groups.get(session.projectKey);
    if (!group) {
      group = { key: session.projectKey, label: projectLabelOf(session.projectRoot || session.cwd), sessions: [] };
      groups.set(session.projectKey, group);
    }
    group.sessions.push(session);
  }
  return [...groups.values()];
}

// 项目内搜索 匹配名称或首条消息 大小写不敏感
// projectKey 为 null 时不过滤项目 搜索仍生效
export function filterSessions(sessions: SessionInfo[], projectKey: string | null, query: string): SessionInfo[] {
  let list = sessions;
  if (projectKey) list = list.filter((s) => s.projectKey === projectKey);
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter((s) => (s.name ?? s.firstMessage ?? "").toLowerCase().includes(q));
  }
  return list;
}
