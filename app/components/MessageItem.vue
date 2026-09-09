<script setup lang="ts">
import { renderMarkdown } from "~/utils/markdown";
import type { AgentMessage, AssistantContentBlock, ImageContent } from "#shared/lib/types";

// 单条消息渲染 按 role 分发 content 块
// assistant 是文档 不是气泡 长 markdown 的可读性优先
const props = defineProps<{
  message: AgentMessage;
  entryId?: string;
  streaming?: boolean;
}>();

function userText(m: AgentMessage): string {
  if (m.role !== "user") return "";
  return typeof m.content === "string"
    ? m.content
    : m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function imageDataUrl(block: ImageContent): string {
  if (block.source.type === "url") return block.source.url ?? "";
  return block.source.media_type
    ? `data:${block.source.media_type};base64,${block.source.data ?? ""}`
    : "";
}

// 工具参数展示 流式中参数还没解析完 优先显示 rawInput 原文
function toolArgsText(block: AssistantContentBlock): string {
  if (block.type !== "toolCall") return "";
  if (block.rawInput !== undefined && block.rawInput !== "") return block.rawInput;
  return Object.keys(block.input).length > 0 ? JSON.stringify(block.input, null, 2) : "";
}

function resultText(m: AgentMessage): string {
  if (m.role !== "toolResult") return "";
  return m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

const isAssistant = computed(() => props.message.role === "assistant");
const isUser = computed(() => props.message.role === "user");
const isToolResult = computed(() => props.message.role === "toolResult");
const isBash = computed(() => props.message.role === "bashExecution");

// 模板里 v-else-if 不会窄化 message 的联合类型 用 computed 收窄后安全取字段
const toolResult = computed(() => (props.message.role === "toolResult" ? props.message : null));
const bashExecution = computed(() => (props.message.role === "bashExecution" ? props.message : null));
// assistant 分支同理 content 块需要窄化后的类型
const assistantMessage = computed(() => (props.message.role === "assistant" ? props.message : null));
</script>

<template>
  <!-- 用户消息 右对齐的紧凑纸片 -->
  <div v-if="isUser" class="msg msg-user">
    <div class="user-chip">{{ userText(message) }}</div>
  </div>

  <!-- toolResult 独立消息 排在 assistant 之后 本步不与 toolCall 配对 -->
  <div v-else-if="isToolResult" class="msg msg-tool-result">
    <details class="fold tool-result" :class="{ 'is-error': toolResult?.isError }">
      <summary>
        <span class="fold-mark" aria-hidden="true"></span>
        <span class="tool-name">{{ toolResult?.toolName ?? "tool" }} 结果</span>
        <span v-if="toolResult?.isError" class="tool-flag">失败</span>
      </summary>
      <pre class="tool-output">{{ resultText(message) }}</pre>
    </details>
  </div>

  <!-- bashExecution 极简渲染 命令加输出 -->
  <div v-else-if="isBash" class="msg msg-tool-result">
    <details class="fold tool-result">
      <summary>
        <span class="fold-mark" aria-hidden="true"></span>
        <span class="tool-name">bash</span>
      </summary>
      <pre class="tool-output"><template v-if="bashExecution">{{ bashExecution.command }}&#10;&#10;{{ bashExecution.output }}</template></pre>
    </details>
  </div>

  <!-- assistant 文档 逐块渲染 -->
  <article v-else-if="assistantMessage" class="msg msg-assistant">
    <template v-for="(block, i) in assistantMessage.content" :key="i">
      <div
        v-if="block.type === 'text'"
        class="markdown-body"
        v-html="renderMarkdown(block.text)"
      ></div>

      <!-- 思考过程 折叠 本步最简 Step 3 再做展开动画与高亮 -->
      <details v-else-if="block.type === 'thinking'" class="fold thinking">
        <summary>
          <span class="fold-mark" aria-hidden="true"></span>
          <span>思考过程</span>
        </summary>
        <pre class="thinking-body">{{ block.thinking }}</pre>
      </details>

      <!-- 工具调用 折叠 参数走 JSON 展示 不走 markdown -->
      <details v-else-if="block.type === 'toolCall'" class="fold tool-call">
        <summary>
          <span class="fold-mark" aria-hidden="true"></span>
          <span class="tool-glyph" aria-hidden="true">▣</span>
          <span class="tool-name">{{ block.toolName || "tool" }}</span>
          <span v-if="streaming" class="tool-flag">参数流入中</span>
        </summary>
        <pre class="tool-output">{{ toolArgsText(block) }}</pre>
      </details>

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
