// 消息文本提取的统一实现
// 乐观去重 key 侧栏首条预览 详情首条消息与气泡展示原本各写一份
// 输入可能是未过类型校验的文件 JSON 也可能是已归一化的运行时消息
// 所以这里按 unknown 收窄 调用方只需决定拼接分隔符

export function extractTextBlocks(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  return content
    .filter(
      (block): block is { type: "text"; text: string } =>
        !!block
        && typeof block === "object"
        && (block as { type?: unknown }).type === "text"
        && typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text);
}
