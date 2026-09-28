import { describe, expect, it } from "vitest";
import { selectTopLevelBranches } from "#shared/lib/session-branches";
import type { SessionTreeNode } from "#shared/lib/types";

const node = (id: string, children: SessionTreeNode[] = [], preview?: string): SessionTreeNode => ({
  id,
  parentId: null,
  type: "message",
  ...(preview ? { preview } : {}),
  children,
});

describe("顶层会话分支", () => {
  it("线性会话不显示分支", () => {
    expect(selectTopLevelBranches([node("a", [node("b")])], "b")).toEqual([]);
  });

  it("找首次分叉并选最新叶子", () => {
    const tree = [node("root", [node("common", [
      node("left", [node("left-end")], "方案甲"),
      node("right", [node("right-end")], "方案乙"),
    ])])];
    expect(selectTopLevelBranches(tree, "left-end")).toEqual([
      { id: "left", leafId: "left-end", preview: "方案甲", isActive: true },
      { id: "right", leafId: "right-end", preview: "方案乙", isActive: false },
    ]);
  });

  it("深链使用迭代遍历", () => {
    let root = node("end", [], "末尾");
    for (let index = 0; index < 12000; index += 1) root = node(`entry-${index}`, [root]);
    expect(selectTopLevelBranches([root, node("other", [], "另一路")], "end")[0]).toEqual({
      id: "entry-11999", leafId: "end", preview: "末尾", isActive: true,
    });
  });
});
