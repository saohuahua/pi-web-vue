import { describe, expect, it } from "vitest";
import { findEntryParentId, selectTopLevelBranches } from "#shared/lib/session-branches";
import type { SessionTreeNode } from "#shared/lib/types";

const node = (
  id: string,
  parentId: string | null,
  children: string[] = [],
  preview?: string,
): SessionTreeNode => ({
  id,
  parentId,
  type: "message",
  ...(preview ? { preview } : {}),
  children,
});

describe("顶层会话分支", () => {
  it("线性会话不显示分支", () => {
    expect(selectTopLevelBranches([node("a", null, ["b"]), node("b", "a")], "b")).toEqual([]);
  });

  it("找首次分叉并选最新叶子", () => {
    const tree = [
      node("root", null, ["common"]),
      node("common", "root", ["left", "right"]),
      node("left", "common", ["left-end"], "方案甲"),
      node("left-end", "left"),
      node("right", "common", ["right-end"], "方案乙"),
      node("right-end", "right"),
    ];
    expect(selectTopLevelBranches(tree, "left-end")).toEqual([
      { id: "left", leafId: "left-end", preview: "方案甲", isActive: true },
      { id: "right", leafId: "right-end", preview: "方案乙", isActive: false },
    ]);
    expect(findEntryParentId(tree, "left")).toBe("common");
  });

  it("深链使用迭代遍历并保持浅层 JSON", () => {
    const tree: SessionTreeNode[] = [];
    for (let index = 0; index < 12000; index += 1) {
      tree.push(
        node(`entry-${index}`, index ? `entry-${index - 1}` : null, [`entry-${index + 1}`]),
      );
    }
    tree.push(node("entry-12000", "entry-11999", [], "末尾"));
    tree.push(node("other", null, [], "另一路"));
    expect(JSON.stringify(tree)).toContain("entry-12000");
    expect(selectTopLevelBranches(tree, "entry-12000")[0]).toEqual({
      id: "entry-0",
      leafId: "entry-12000",
      preview: "末尾",
      isActive: true,
    });
  });
});
