import { shouldOpenLocalFileInApp } from "#shared/lib/file-links";

interface MarkdownClickHandlers {
  // data-md-file 命中时的应用内打开回调 由调用方决定目标容器
  onOpenFile: (path: string) => void;
}

// markdown 渲染容器内的点击委托 复制按钮与本地文件链接都在 v-html 里只能事件委托
export const handleMarkdownClick = (event: MouseEvent, handlers: MarkdownClickHandlers): void => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const copyButton = target.closest<HTMLButtonElement>("[data-code-copy]");
  if (copyButton) {
    const code = copyButton.closest(".code-block")?.querySelector("code");
    if (code) void copyCodeText(code.textContent ?? "", copyButton);
    return;
  }

  const anchor = target.closest<HTMLAnchorElement>("a[data-md-file]");
  const filePath = anchor?.dataset.mdFile;
  if (anchor && filePath && shouldOpenLocalFileInApp(event)) {
    event.preventDefault();
    handlers.onOpenFile(filePath);
  }
};

const copyCodeText = async (text: string, button: HTMLButtonElement): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 剪贴板不可用时静默 本机桌面场景几乎不会发生
    return;
  }
  // is-active 与「已复制」文案是瞬时反馈 连点也只会延长当前一次的展示
  button.classList.add("is-active");
  button.textContent = "已复制";
  window.setTimeout(() => {
    button.classList.remove("is-active");
    button.textContent = "复制";
  }, 1200);
};
