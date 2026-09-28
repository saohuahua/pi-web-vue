// 参考 pi-web BranchNavigator 的首次分叉选择逻辑 改为扁平 DTO 的迭代实现
import type { SessionBranch, SessionTreeNode } from "./types";

const newestLeaf = (node: SessionTreeNode, byId: Map<string, SessionTreeNode>): string => {
  let current = node;
  const visited = new Set<string>();
  while (current.children.length && !visited.has(current.id)) {
    visited.add(current.id);
    const next = byId.get(current.children[current.children.length - 1]!);
    if (!next) break;
    current = next;
  }
  return current.id;
};

const branchPreview = (node: SessionTreeNode, byId: Map<string, SessionTreeNode>): string => {
  const pending = [node.id];
  const visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const current = byId.get(id);
    if (!current) continue;
    if (current.preview) return current.preview;
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      pending.push(current.children[index]!);
    }
  }
  return "未命名分支";
};

const isOnBranch = (
  branchId: string,
  activeLeafId: string | null,
  byId: Map<string, SessionTreeNode>,
): boolean => {
  let current = activeLeafId ? byId.get(activeLeafId) : undefined;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    if (current.id === branchId) return true;
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
};

// 子节点只保留 ID 使 JSON 深度固定 长会话不会在序列化阶段再次递归
export const selectTopLevelBranches = (
  nodes: SessionTreeNode[],
  activeLeafId: string | null,
): SessionBranch[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots = nodes.filter((node) => !node.parentId || !byId.has(node.parentId));
  let candidates = roots;
  if (roots.length === 1) {
    let current = roots[0]!;
    const visited = new Set<string>();
    while (current.children.length === 1 && !visited.has(current.id)) {
      visited.add(current.id);
      const next = byId.get(current.children[0]!);
      if (!next) break;
      current = next;
    }
    candidates =
      current.children.length > 1
        ? current.children
            .map((id) => byId.get(id))
            .filter((node): node is SessionTreeNode => Boolean(node))
        : [];
  }
  return candidates.map((node) => ({
    id: node.id,
    leafId: newestLeaf(node, byId),
    preview: branchPreview(node, byId),
    isActive: isOnBranch(node.id, activeLeafId, byId),
  }));
};

export const findEntryParentId = (nodes: SessionTreeNode[], id: string): string | null =>
  nodes.find((node) => node.id === id)?.parentId ?? null;
