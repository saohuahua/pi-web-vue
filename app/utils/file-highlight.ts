import hljs from "highlight.js/lib/common";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// 文件预览只使用项目已加载的常用语言 避免引入完整编辑器依赖
export function highlightFile(content: string, language: string): string {
  if (!language || language === "text" || !hljs.getLanguage(language)) return escapeHtml(content);
  try {
    return hljs.highlight(content, { language }).value;
  } catch {
    return escapeHtml(content);
  }
}
