<script setup lang="ts">
import { renderMarkdown } from "~/utils/markdown";
import { useChatStore } from "~/stores/chat";
import { imageDataUrl } from "#shared/lib/images";
import ThinkingBlock from "./ThinkingBlock.vue";
import ToolCallCard from "./ToolCallCard.vue";
import type { AgentMessage, AssistantContentBlock } from "#shared/lib/types";

// 单条消息渲染 按 role 分发 content 块
// assistant 是文档 块顺序即真实发生顺序 思考完就动手的过程感是演示价值
const props = defineProps<{
  message: AgentMessage;
  entryId?: string;
  streaming?: boolean;
  prevTimestamp?: number;
}>();

const chat = useChatStore();

function userText(m: AgentMessage): string {
  if (m.role !== "user") return "";
  return typeof m.content === "string"
    ? m.content
    : m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

// 模板里 v-else-if 不会窄化联合类型 用 computed 收窄后安全取字段
const assistantMessage = computed(() => (props.message.role === "assistant" ? props.message : null));
const bashExecution = computed(() => (props.message.role === "bashExecution" ? props.message : null));

// 思考时长 本条消息时间戳减前一条的间隔即生成耗时
// 不维护流式计时器 流式期间 ThinkingBlock 自己显示思考中
const thinkingDuration = computed(() => {
  const m = assistantMessage.value;
  if (!m?.timestamp || !props.prevTimestamp) return undefined;
  const secs = Math.round((m.timestamp - props.prevTimestamp) / 1000);
  return secs > 0 ? secs : undefined;
});

// 工具耗时 assistant 定稿时间到 result 完成时间
function toolCallDuration(result: { timestamp?: number } | undefined): number | undefined {
  const m = assistantMessage.value;
  if (!m?.timestamp || !result?.timestamp) return undefined;
  const secs = Math.round((result.timestamp - m.timestamp) / 1000);
  return secs > 0 ? secs : undefined;
}

const isUser = computed(() => props.message.role === "user");
const isToolResult = computed(() => props.message.role === "toolResult");
const isBash = computed(() => props.message.role === "bashExecution");
// abort 会落盘一条空 content 的 assistant 占位 无内容不渲染
const isEmptyAssistant = computed(
  () => props.message.role === "assistant" && props.message.content.length === 0,
);
</script>

<template>
  <!-- 用户消息 右对齐的紧凑气泡 -->
  <div v-if="isUser" class="msg msg-user">
    <div class="user-chip">{{ userText(message) }}</div>
  </div>

  <!-- toolResult 不再独立渲染 配对进 ToolCallCard 的下半区 -->
  <div v-else-if="isToolResult" class="msg msg-paired" aria-hidden="true"></div>

  <!-- bashExecution 极简渲染 命令加输出 -->
  <div v-else-if="isBash" class="msg">
    <details class="fold tool-card">
      <summary>
        <span class="fold-mark" aria-hidden="true"></span>
        <span class="tool-name">bash</span>
      </summary>
      <pre class="tool-output"><template v-if="bashExecution">{{ bashExecution.command }}&#10;&#10;{{ bashExecution.output }}</template></pre>
    </details>
  </div>

  <!-- assistant 文档 严格按 content 块顺序渲染 空 content 的 abort 占位不渲染 -->
  <article v-else-if="assistantMessage && !isEmptyAssistant" class="msg msg-assistant">
    <template v-for="(block, i) in assistantMessage.content" :key="i">
      <div
        v-if="block.type === 'text'"
        class="markdown-body"
        v-html="renderMarkdown(block.text)"
      ></div>

      <ThinkingBlock
        v-else-if="block.type === 'thinking'"
        :block="block"
        :streaming="streaming"
        :duration-seconds="thinkingDuration"
      />

      <!-- 配对的 result 从 store 的 getter 取 流式中还没到就是执行中 -->
      <ToolCallCard
        v-else-if="block.type === 'toolCall'"
        :block="block"
        :result="chat.toolResultsByCallId.get(block.toolCallId)"
        :duration-seconds="toolCallDuration(chat.toolResultsByCallId.get(block.toolCallId))"
        :streaming="streaming"
      />

      <img
        v-else-if="block.type === 'image'"
        class="msg-image"
        :src="imageDataUrl(block)"
        alt="消息图片"
      />
    </template>
    <!-- 流式光标 只在气泡仍在生长时出现 -->
    <span v-if="streaming" class="stream-caret" aria-hidden="true"></span>
  </article>
</template>
