import { describe, expect, it } from "vitest";
import { projectSessionTree } from "#server/utils/session-tree";

describe("会话树投影", () => {
  it("保持分支顺序并排除完整消息和工具输出", () => {
    const source = [{
      entry: { id: "root", parentId: null, type: "message", timestamp: "2026-01-01", message: { role: "user", content: "开头" } },
      children: [
        { entry: { id: "left", parentId: "root", type: "message", timestamp: "2026-01-01", message: { role: "user", content: "左边" } }, children: [] },
        { entry: { id: "right", parentId: "root", type: "message", timestamp: "2026-01-01", message: { role: "user", content: "右边" } }, children: [] },
      ],
    }];
    const result = projectSessionTree(source as never);
    expect(result[0]?.children.map((child) => child.id)).toEqual(["left", "right"]);
    expect(JSON.stringify(result)).not.toContain("content");
    expect(result[0]?.preview).toBe("开头");
  });
});
