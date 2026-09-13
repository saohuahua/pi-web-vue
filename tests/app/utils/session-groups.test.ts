import { describe, expect, it } from "vitest";
import { filterSessions, groupSessionsByProject, projectLabelOf } from "~/utils/session-groups";
import type { SessionInfo } from "#shared/lib/types";

function session(partial: Partial<SessionInfo> & Pick<SessionInfo, "id" | "projectKey" | "projectRoot">): SessionInfo {
  return {
    path: "x.jsonl",
    cwd: partial.projectRoot,
    created: "",
    modified: "",
    messageCount: 0,
    firstMessage: "首条消息",
    ...partial,
  } as SessionInfo;
}

const sessions = [
  session({ id: "a", projectKey: "p1", projectRoot: "D:\\repo-a", firstMessage: "读一下 README" }),
  session({ id: "b", projectKey: "p2", projectRoot: "D:\\repo-b", firstMessage: "写个页面" }),
  session({ id: "c", projectKey: "p1", projectRoot: "D:\\repo-a", name: "自定义名字" }),
];

describe("projectLabelOf", () => {
  it("取路径末段 兼容两种分隔符", () => {
    expect(projectLabelOf("D:\\project\\pi-web-vue")).toBe("pi-web-vue");
    expect(projectLabelOf("/home/user/repo")).toBe("repo");
  });
});

describe("groupSessionsByProject", () => {
  it("按 projectKey 分组 组序等于首个会话出现序", () => {
    const groups = groupSessionsByProject(sessions);
    expect(groups.map((g) => g.key)).toEqual(["p1", "p2"]);
    expect(groups[0]?.sessions.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("组标签取项目根末段", () => {
    expect(groupSessionsByProject(sessions)[0]?.label).toBe("repo-a");
  });
});

describe("filterSessions", () => {
  it("按项目过滤", () => {
    expect(filterSessions(sessions, "p2", "").map((s) => s.id)).toEqual(["b"]);
  });

  it("projectKey 为 null 时不过滤项目", () => {
    expect(filterSessions(sessions, null, "")).toHaveLength(3);
  });

  it("搜索匹配名称与首条消息 大小写不敏感", () => {
    expect(filterSessions(sessions, null, "README").map((s) => s.id)).toEqual(["a"]);
    expect(filterSessions(sessions, null, "自定义").map((s) => s.id)).toEqual(["c"]);
    expect(filterSessions(sessions, null, "  ")).toHaveLength(3);
  });

  it("项目过滤与搜索叠加 搜索不跨项目泄漏", () => {
    expect(filterSessions(sessions, "p1", "页面")).toEqual([]);
  });
});
