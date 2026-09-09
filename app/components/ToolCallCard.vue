<script setup lang="ts">
import { ansiToHtml } from "~/utils/ansi";
import { toolPreview } from "~/utils/tool-preview";
import { useChatStore } from "~/stores/chat";
import { imageDataUrl } from "#shared/lib/images";
import type { ImageContent, ToolCallContent, ToolResultMessage } from "#shared/lib/types";

// 工具调用卡片 调用与结果在同一卡片内展示完整生命周期
// 状态机 参数流入中 流式中无 input 执行中 activeTools 里活跃或 result 未到且消息流式中
// 完成 出错 result.isError
const props = defineProps<{
  block: ToolCallContent;
  result?: ToolResultMessage;
  durationSeconds?: number;
  streaming?: boolean;
}>();

const chat = useChatStore();

// assistant 消息在工具开始执行前就定稿了 streaming 已是 false
// 执行中状态必须查 activeTools 它覆盖 tool_execution_start 到 end 的真实区间
const isRunningTool = computed(
  () => !props.result && (props.streaming || chat.activeTools.has(props.block.toolCallId)),
);
const isError = computed(() => props.result?.isError ?? false);
// 流式中参数还是 rawInput 增量字符串 定稿后才有解析好的 input
const argsText = computed(() => {
  if (props.block.rawInput !== undefined && props.block.rawInput !== "") return props.block.rawInput;
  return Object.keys(props.block.input).length > 0
    ? JSON.stringify(props.block.input, null, 2)
    : "";
});

const preview = computed(() => toolPreview(props.block));

// 结果文本块拼接 bash 输出走 ANSI 着色 其余纯文本插值
const resultText = computed(() => {
  if (!props.result) return null;
  const text = props.result.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return text.trim() ? text : null;
});

const resultAnsiHtml = computed(() => {
  if (resultText.value === null) return null;
  const isShell = props.block.toolName === "bash" || props.block.toolName === "powershell";
  // ansi_up 先转义 HTML 再插颜色 span v-html 安全
  return isShell ? ansiToHtml(resultText.value) : null;
});

const resultImages = computed(() =>
  (props.result?.content ?? []).filter((b): b is ImageContent => b.type === "image"),
);

const resultLineCount = computed(() => {
  if (resultText.value === null) return 0;
  return resultText.value.split("\n").filter((line) => line.trim() !== "").length;
});

const statusText = computed(() => {
  if (isError.value) return "出错";
  if (isRunningTool.value) return "执行中";
  return "完成";
});
</script>

<template>
  <details class="tool-card" :class="{ 'is-error': isError, 'is-running': isRunningTool }">
    <summary>
      <span class="fold-mark" aria-hidden="true"></span>
      <span class="tool-name">{{ block.toolName || "tool" }}</span>
      <span class="tool-preview">{{ isRunningTool && !preview ? "参数流入中" : preview }}</span>
      <span class="tool-status">{{ statusText }}</span>
      <span v-if="durationSeconds !== undefined && durationSeconds > 0" class="tool-duration">{{ durationSeconds }}s</span>
    </summary>
    <!-- 参数区 流式时显示 rawInput 原文 -->
    <pre v-if="argsText" class="tool-args">{{ argsText }}</pre>
    <!-- 结果区 配对的 toolResult 就在下半区 -->
    <div v-if="result" class="tool-result-zone">
      <div class="tool-result-head">
        <span>结果</span>
        <span v-if="resultLineCount > 0" class="tool-result-meta">{{ resultLineCount }} 行</span>
      </div>
      <!-- shell 输出 ANSI 转彩色 HTML 其余纯文本插值 -->
      <pre v-if="resultAnsiHtml" class="tool-output" v-html="resultAnsiHtml"></pre>
      <pre v-else-if="resultText" class="tool-output">{{ resultText }}</pre>
      <p v-else class="tool-result-empty">无文本输出</p>
      <img
        v-for="(img, i) in resultImages"
        :key="i"
        class="tool-result-image"
        :src="imageDataUrl(img)"
        alt="工具结果图片"
      >
    </div>
  </details>
</template>
