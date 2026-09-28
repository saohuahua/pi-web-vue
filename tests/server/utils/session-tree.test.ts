import { describe, expect, it } from "vitest";
import { projectSessionTree } from "#server/utils/session-tree";

describe("会话树投影", () => {
  it("保持分支顺序并排除完整消息和工具输出", () => {
    const source = [
      {
        entry: {
          id: "root",
          parentId: null,
          type: "message",
          timestamp: "2026-01-01",
          message: { role: "user", content: "开头" },
        },
        children: [
          {
            entry: {
              id: "left",
              parentId: "root",
              type: "message",
              timestamp: "2026-01-01",
              message: { role: "user", content: "左边" },
            },
            children: [],
          },
          {
            entry: {
              id: "right",
              parentId: "root",
              type: "message",
              timestamp: "2026-01-01",
              message: { role: "user", content: "右边" },
            },
            children: [],
          },
        ],
      },
    ];
    const result = projectSessionTree(source as never);
    expect(result[0]?.children).toEqual(["left", "right"]);
    expect(JSON.stringify(result)).not.toContain("content");
    expect(result[0]?.preview).toBe("开头");
  });

  it("深会话投影后可安全序列化", () => {
    interface TestNode {
      entry: { id: string; parentId: string | null; type: string };
      children: TestNode[];
    }
    let source: TestNode = {
      entry: { id: "end", parentId: "entry-0", type: "label" },
      children: [],
    };
    for (let index = 0; index < 12000; index += 1) {
      source = {
        entry: {
          id: `entry-${index}`,
          parentId: index === 11999 ? null : `entry-${index + 1}`,
          type: "label",
        },
        children: [source],
      };
    }
    const result = projectSessionTree([source] as never);
    expect(result).toHaveLength(12001);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
