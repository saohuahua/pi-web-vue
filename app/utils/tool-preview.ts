import type { ToolCallContent } from "#shared/lib/types";

// 工具卡片的单行预览 常用工具提取最有信息量的参数
// 每工具只取一个字段 超出走通用 JSON 展示

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function toolPreview(block: ToolCallContent): string {
  const input = block.input ?? {};
  switch (block.toolName) {
    case "read":
    case "write":
      return str(input.path) || str(input.file_path);
    case "edit":
      return str(input.file_path) || str(input.path);
    case "bash":
    case "powershell":
      return str(input.command);
    case "grep":
    case "find":
      return [str(input.pattern), str(input.path)].filter(Boolean).join("  ");
    case "ls":
      return str(input.path);
    default:
      return "";
  }
}
