import type { Ref } from "vue";

const NEAR_BOTTOM_PX = 80;

/**
 * 聊天容器的跟随滚动
 * 距底小于 80px 才跟随 用户上翻时不打扰
 * 流式期间依赖每变一次至多滚一次 用 rAF 合并同帧多次触发
 */
export function useAutoScroll(el: Ref<HTMLElement | null>, dependency: () => unknown) {
  const nearBottom = ref(true);
  let frame: number | null = null;

  function measure() {
    const node = el.value;
    if (!node) return;
    nearBottom.value = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM_PX;
  }

  function scrollToBottom(smooth = false) {
    const node = el.value;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  // flush post 确保 DOM 已更新再量高度
  watch(dependency, () => {
    if (!nearBottom.value) return;
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      // 再量一次 滚动前一瞬内容可能又长了一截
      measure();
      if (nearBottom.value) scrollToBottom();
    });
  }, { flush: "post" });

  onBeforeUnmount(() => {
    if (frame !== null) cancelAnimationFrame(frame);
  });

  return { onScroll: measure, scrollToBottom, nearBottom };
}
