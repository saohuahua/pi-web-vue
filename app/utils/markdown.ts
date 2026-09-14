import MarkdownIt from "markdown-it";
import type { Env } from "markdown-it";
// lib/common 只含常用语言 全量 highlight.js 约 1MB 没必要进浏览器包
import hljs from "highlight.js/lib/common";
import { resolveLocalFileHref } from "#shared/lib/file-links";
import { encodeFilePathForApi, getDirName } from "#shared/lib/file-paths";

export interface MarkdownRenderOptions {
  // md 文件自身的绝对路径 用于把相对图片与本地文件链接解析到 /api/files 与应用内打开
  filePath?: string;
}

export interface FrontmatterEntry {
  key: string;
  value: string;
}

export interface Frontmatter {
  entries: FrontmatterEntry[];
  body: string;
}

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

// fence 包容器 头部栏放语言标签与复制按钮 语言是第一眼信息 复制在文件预览与 chat 里都是高频动作
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (!token) return "";
  const lang = token.info.trim().split(/\s+/)[0] ?? "";
  const rendered = defaultFence(tokens, idx, options, env, self);
  return (
    `<div class="code-block">` +
    `<div class="code-header">` +
    `<span class="code-lang">${md.utils.escapeHtml(lang)}</span>` +
    `<button class="code-copy" type="button" data-code-copy>复制</button>` +
    `</div>` +
    rendered +
    `</div>`
  );
};

// 表格外包 wrapper 承担圆角边框与横向滚动 表格自身才能用 border-collapse separate 画斑马纹
// markdown-it 15 结构化 token 没有默认规则 未定义时走 renderToken 回退 这里覆盖后也要手动回落
md.renderer.rules.table_open = (tokens, idx, options, env, self) =>
  `<div class="markdown-table-wrap">${self.renderToken(tokens, idx, options)}`;
md.renderer.rules.table_close = (tokens, idx, options, env, self) =>
  `${self.renderToken(tokens, idx, options)}</div>`;

// env.filePath 由调用方注入 Env 索引签名是 unknown 先收窄再用
const filePathFromEnv = (env: Env | undefined): string | undefined =>
  typeof env?.filePath === "string" ? env.filePath : undefined;

// 链接分流 外链新窗口打开 本地文件链接带 data-md-file 交给容器事件委托在应用内打开
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (!token) return self.renderToken(tokens, idx, options);
  const href = String(token.attrGet("href") ?? "");

  // 页内锚点保持原样 落到外链分支会开新窗口跳同页 很怪
  if (!href.startsWith("#")) {
    const resolved = resolveLocalFileHref(href, getDirName(filePathFromEnv(env) ?? ""));
    if (resolved) {
      token.attrSet("data-md-file", resolved);
    } else {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }
  }
  return self.renderToken(tokens, idx, options);
};

// 图片相对路径改写为 /api/files 读取 无 filePath 的 chat 场景保持不动
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (!token) return "";
  const resolved = resolveLocalFileHref(
    token.attrGet("src") === null ? undefined : String(token.attrGet("src")),
    getDirName(filePathFromEnv(env) ?? ""),
  );
  if (resolved) token.attrSet("src", `/api/files/${encodeFilePathForApi(resolved)}?type=read`);
  return self.renderToken(tokens, idx, options);
};

// GFM 任务列表 markdown-it 15 不自带 手写轻量规则
// 列表项首文本 [ ] / [x] 换成自绘 checkbox 外层 list 与 item 打类名供样式识别
const TASK_ITEM_RE = /^\[([ xX])\]\s+/;
md.core.ruler.after("inline", "task_lists", (state) => {
  // 栈记当前所在的 list 与 item 闭合时弹栈 嵌套列表不会串层
  const listStack: number[] = [];
  const itemStack: number[] = [];
  const tokens = state.tokens;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const type = token.type;

    if (type === "bullet_list_open" || type === "ordered_list_open") {
      listStack.push(i);
    } else if (type === "bullet_list_close" || type === "ordered_list_close") {
      listStack.pop();
    } else if (type === "list_item_open") {
      itemStack.push(i);
    } else if (type === "list_item_close") {
      itemStack.pop();
    } else if (type === "inline") {
      const first = token.children?.[0];
      if (!first || first.type !== "text") continue;
      const match = TASK_ITEM_RE.exec(first.content);
      if (!match || !match[1]) continue;
      if (itemStack.length === 0 || listStack.length === 0) continue;

      // 同一 list 下多个任务项会重复命中 类名只补一次
      const listToken = tokens[listStack.at(-1)!]!;
      if (
        !String(listToken.attrGet("class") ?? "")
          .split(/\s+/)
          .includes("contains-task-list")
      ) {
        listToken.attrJoin("class", "contains-task-list");
      }
      const itemToken = tokens[itemStack.at(-1)!]!;
      if (
        !String(itemToken.attrGet("class") ?? "")
          .split(/\s+/)
          .includes("task-list-item")
      ) {
        itemToken.attrJoin("class", "task-list-item");
      }
      first.content = first.content.replace(TASK_ITEM_RE, "");
      const children = token.children!;
      if (first.content.length === 0) children.shift();
      const checkbox = new state.Token("html_inline", "", 0);
      checkbox.content = `<input type="checkbox" disabled${match[1] === " " ? "" : " checked"}>`;
      children.unshift(checkbox);
    }
  }
});

// 剥离文档头部 frontmatter 仅识别最简单的 key value 单行写法
// 中间有任何一行不像键值对就整体放弃 防止把正文里的主题分隔线误当元数据
const FRONTMATTER_LINE_RE = /^([\w-]+):\s*(.+)$/;

export const extractFrontmatter = (text: string): Frontmatter | null => {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const closeIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closeIndex < 1) return null;

  const entries: FrontmatterEntry[] = [];
  for (const line of lines.slice(1, closeIndex)) {
    if (line.trim() === "") continue;
    const match = FRONTMATTER_LINE_RE.exec(line.trim());
    const key = match?.[1];
    const value = match?.[2];
    if (!key || value === undefined) return null;
    entries.push({ key, value: value.trim() });
  }
  if (entries.length === 0) return null;
  return { entries, body: lines.slice(closeIndex + 1).join("\n") };
};

export const renderMarkdown = (text: string, options?: MarkdownRenderOptions): string => {
  // env 携带 filePath 给各渲染器规则分流 单例同步渲染无并发问题
  const env: { filePath?: string } = options?.filePath ? { filePath: options.filePath } : {};
  return md.render(text, env);
};
