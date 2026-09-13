<template>
  <details class="fold thinking">
    <summary>
      <Lightbulb :size="14" class="thinking-icon" aria-hidden="true" />
      <span class="thinking-header">{{ headerText }}</span>
      <span v-if="streaming" class="thinking-live" aria-hidden="true"></span>
      <ChevronRight :size="14" class="thinking-chevron" aria-hidden="true" />
    </summary>
    <pre class="thinking-body">{{ block.thinking }}</pre>
  </details>
</template>

<script setup lang="ts">
import { ChevronRight, Lightbulb } from "lucide-vue-next";
import type { ThinkingContent } from "#shared/lib/types";

// 思考过程折叠块
// 流式中默认折叠 只显示增长计数 定稿后标题带上时长
// 时长来自文件时间戳 不维护流式计时器
const props = defineProps<{
  block: ThinkingContent;
  streaming?: boolean;
  durationSeconds?: number;
}>();

const charCount = computed(() => props.block.thinking.length);

const headerText = computed(() => {
  if (props.streaming) return `思考中… ${charCount.value} 字`;
  if (props.durationSeconds !== undefined && props.durationSeconds > 0) {
    return `思考了 ${props.durationSeconds} 秒`;
  }
  return "思考过程";
});
</script>
