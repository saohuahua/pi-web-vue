import MarkdownIt from "markdown-it";
// lib/common 只含常用语言 全量 highlight.js 约 1MB 没必要进浏览器包
import hljs from "highlight.js/lib/common";

const md = new MarkdownIt({
  // 安全默认 消息里不允许内嵌 HTML agent 输出按纯 markdown 处理
  html: false,
  linkify: true,
  breaks: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch {
        // 高亮失败落回 markdown-it 自己的转义
      }
    }
    // 空串让 markdown-it 自己 escape
    return "";
  },
});

// fence 外面包一层容器并显示语言标签
// 编码 agent 的输出里代码块占比很高 语言是第一眼信息
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (!token) return "";
  const lang = token.info.trim().split(/\s+/)[0] ?? "";
  const rendered = defaultFence(tokens, idx, options, env, self);
  return `<div class="code-block"><span class="code-lang">${md.utils.escapeHtml(lang)}</span>${rendered}</div>`;
};

export function renderMarkdown(text: string): string {
  return md.render(text);
}
