import { describe, expect, it } from "vitest";
import { extractFrontmatter, renderMarkdown } from "~/utils/markdown";

describe("renderMarkdown 代码块", () => {
  it("fence 包容器并带头部栏与复制按钮", () => {
    const html = renderMarkdown("```ts\nconst a = 1\n```");
    expect(html).toContain('<div class="code-block">');
    expect(html).toContain('<div class="code-header">');
    expect(html).toContain('<span class="code-lang">ts</span>');
    expect(html).toContain("data-code-copy");
    expect(html).toContain("<pre");
  });

  it("无语言时标签为空不报错", () => {
    const html = renderMarkdown("```\nplain\n```");
    expect(html).toContain('<span class="code-lang"></span>');
  });
});

describe("renderMarkdown 表格", () => {
  it("表格包在 markdown-table-wrap 里", () => {
    const html = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |");
    expect(html).toContain('<div class="markdown-table-wrap">');
    expect(html).toContain("<table>");
  });
});

describe("renderMarkdown 链接", () => {
  it("外链带 target 与 rel", () => {
    const html = renderMarkdown("[官网](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("页内锚点不加新窗口属性", () => {
    const html = renderMarkdown("[跳转](#section)");
    expect(html).not.toContain('target="_blank"');
  });

  it("带 filePath 时本地文件链接输出 data-md-file", () => {
    const html = renderMarkdown("[指南](./guide.md)", { filePath: "D:/repo/docs/README.md" });
    expect(html).toContain('data-md-file="D:/repo/docs/guide.md"');
    expect(html).not.toContain('target="_blank"');
  });

  it("无 filePath 时相对链接按外链处理", () => {
    const html = renderMarkdown("[指南](./guide.md)");
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("data-md-file");
  });
});

describe("renderMarkdown 图片", () => {
  it("带 filePath 时相对路径改写为 /api/files", () => {
    const html = renderMarkdown("![图](img/a.png)", { filePath: "D:/repo/docs/README.md" });
    expect(html).toContain('src="/api/files/D%3A/repo/docs/img/a.png?type=read"');
  });

  it("外链图片不改写", () => {
    const html = renderMarkdown("![图](https://example.com/a.png)", {
      filePath: "D:/repo/docs/README.md",
    });
    expect(html).toContain('src="https://example.com/a.png"');
  });

  it("无 filePath 时路径保持原样", () => {
    const html = renderMarkdown("![图](img/a.png)");
    expect(html).toContain('src="img/a.png"');
  });
});

describe("renderMarkdown 任务列表", () => {
  it("列表项与列表打上类名 并替换为 checkbox", () => {
    const html = renderMarkdown("- [ ] 待办\n- [x] 完成\n- 普通项");
    expect(html).toContain('class="contains-task-list"');
    expect(html).toContain('class="task-list-item"');
    expect(html).toContain("<input");
    expect(html).toContain("checked");
    expect(html).not.toContain("[ ]");
    expect(html).not.toContain("[x]");
  });

  it("列表外的 [ ] 文本不受影响", () => {
    const html = renderMarkdown("正文 [x] 不是任务");
    expect(html).not.toContain("contains-task-list");
    expect(html).toContain("[x]");
  });
});

describe("extractFrontmatter", () => {
  it("标准 frontmatter 剥离出键值对与正文", () => {
    const result = extractFrontmatter("---\ntitle: 计划\nstatus: done\n---\n# 正文");
    expect(result?.entries).toEqual([
      { key: "title", value: "计划" },
      { key: "status", value: "done" },
    ]);
    expect(result?.body).toBe("# 正文");
  });

  it("包含非键值行时整体放弃按正文处理", () => {
    expect(extractFrontmatter("---\ntitle: 计划\n- 列表项\n---\n正文")).toBeNull();
  });

  it("无 frontmatter 返回 null", () => {
    expect(extractFrontmatter("# 普通文档")).toBeNull();
    expect(extractFrontmatter("---\n没有闭合\n正文")).toBeNull();
  });
});
