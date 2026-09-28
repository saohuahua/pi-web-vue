// 参考 pi-web BranchNavigator 的首次分叉选择逻辑 改为精简 DTO 的迭代实现
import type { SessionBranch, SessionTreeNode } from "./types";

const newestLeaf = (node: SessionTreeNode): string => {
  let current = node;
  while (current.children.length) current = current.children[current.children.length - 1]!;
  return current.id;
};

const branchPreview = (node: SessionTreeNode): string => {
  const pending = [node];
  while (pending.length) {
    const current = pending.pop()!;
    if (current.preview) return current.preview;
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      pending.push(current.children[index]!);
    }
  }
  return "未命名分支";
};

const includesEntry = (node: SessionTreeNode, id: string | null): boolean => {
  if (!id) return false;
  const pending = [node];
  while (pending.length) {
    const current = pending.pop()!;
    if (current.id === id) return true;
    pending.push(...current.children);
  }
  return false;
};

// 沿公共前缀找到首次分叉 多根会话直接以根作为分支
export const selectTopLevelBranches = (
  roots: SessionTreeNode[],
  activeLeafId: string | null,
): SessionBranch[] => {
  let candidates = roots;
  if (roots.length === 1) {
    let current = roots[0]!;
    while (current.children.length === 1) current = current.children[0]!;
    candidates = current.children.length > 1 ? current.children : [];
  }
  return candidates.map((node) => ({
    id: node.id,
    leafId: newestLeaf(node),
    preview: branchPreview(node),
    isActive: includesEntry(node, activeLeafId),
  }));
};

export const findEntryParentId = (roots: SessionTreeNode[], id: string): string | null => {
  const pending = [...roots];
  while (pending.length) {
    const current = pending.pop()!;
    if (current.id === id) return current.parentId;
    pending.push(...current.children);
  }
  return null;
};
