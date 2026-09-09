import { AnsiUp } from "ansi_up";

// bash 输出常带 ANSI 颜色码 转成 HTML 着色展示
// AnsiUp 默认先 escape HTML 再插颜色 span 安全 拿到的文本可直接 v-html
const ansi = new AnsiUp();

export function ansiToHtml(text: string): string {
  return ansi.ansi_to_html(text);
}
