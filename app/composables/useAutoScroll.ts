import type { Ref } from "vue";

const NEAR_BOTTOM_PX = 80;

/**
 * 聊天容器的跟随滚动
 * 距底小于 80px 才跟随 用户上翻时不打扰
 * 流式期间依赖每变一次至多滚一次 用 rAF 合并同帧多次触发
 */
export function useAutoScroll(el: Ref<HTMLElement | null>, dependency: () => unknown) {
  const nearBottom = ref(true);
  /** 阅读进度 0-1 已滚过部分占全部可滚动内容的比例 供回到最新消息按钮的进度环使用 */
  const progress = ref(0);
  let frame: number | null = null;

  function measure() {
    const node = el.value;
    if (!node) return;
    nearBottom.value = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM_PX;
    const scrollable = node.scrollHeight - node.clientHeight;
    progress.value = scrollable > 0 ? Math.min(1, node.scrollTop / scrollable) : 0;
  }

  function scrollToBottom(smooth = false) {
    const node = el.value;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  // flush post 确保 DOM 已更新再量高度
  // 用户在底部时跟随滚动 离开底部时也要重测 内容增长会改变进度环比例
  watch(
    dependency,
    () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        // 再量一次 滚动前一瞬内容可能又长了一截
        measure();
        if (nearBottom.value) scrollToBottom();
      });
    },
    { flush: "post" },
  );

  onBeforeUnmount(() => {
    if (frame !== null) cancelAnimationFrame(frame);
  });

  return { onScroll: measure, scrollToBottom, nearBottom, progress };
}
