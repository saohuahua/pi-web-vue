import { extractTextBlocks } from "#shared/lib/message-text";
import type { SessionTreeNode as SdkTreeNode } from "@earendil-works/pi-coding-agent";
import type { SessionTreeNode } from "#shared/lib/types";

// 只投影分支导航所需字段 避免将未激活分支的完整消息和工具结果送到浏览器
export const projectSessionTree = (roots: SdkTreeNode[]): SessionTreeNode[] => {
  const result: SessionTreeNode[] = [];
  const pending = roots.slice().reverse();
  while (pending.length) {
    const source = pending.pop()!;
    const { entry } = source;
    const preview =
      entry.type === "message" && entry.message.role === "user"
        ? extractTextBlocks(entry.message.content).join(" ").slice(0, 80)
        : undefined;
    const node: SessionTreeNode = {
      id: entry.id,
      parentId: entry.parentId,
      type: entry.type,
      ...(preview ? { preview } : {}),
      children: source.children.map((child) => child.entry.id),
    };
    result.push(node);
    for (let index = source.children.length - 1; index >= 0; index -= 1) {
      pending.push(source.children[index]!);
    }
  }
  return result;
};
