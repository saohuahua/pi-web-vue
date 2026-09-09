<script setup lang="ts">
// 运行指示器 循环显示 π 的数字 3 1 4 1 5 9 …
// agent 思考时用户看到的是 π 在生长 而不是通用转圈
const DIGITS = "314159265358979323846264338327950288";

const current = ref("3");
let timer: number | null = null;

onMounted(() => {
  // 减少动态偏好时保持静态数字 不做循环
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;
  let i = 0;
  timer = window.setInterval(() => {
    i = (i + 1) % DIGITS.length;
    current.value = DIGITS[i]!;
  }, 480);
});

onBeforeUnmount(() => {
  if (timer !== null) window.clearInterval(timer);
});
</script>

<template>
  <span class="pi-indicator" role="status" aria-label="运行中">
    <span class="pi-glyph">π</span>
    <span class="pi-digit">{{ current }}</span>
  </span>
</template>
