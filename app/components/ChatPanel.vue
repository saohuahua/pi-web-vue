<script setup lang="ts">
import { useAutoScroll } from "~/composables/useAutoScroll";
import { useChatStore } from "~/stores/chat";
import ChatComposer from "./ChatComposer.vue";
import MessageItem from "./MessageItem.vue";
import PiIndicator from "./PiIndicator.vue";

const chat = useChatStore();
const scrollEl = ref<HTMLElement | null>(null);

// 依赖含流式消息内容长度 流式每增长一帧评估一次跟随
const { onScroll } = useAutoScroll(scrollEl, () => [
  chat.messages.length,
  chat.stream.streamingMessage?.content.length ?? 0,
]);
</script>

<template>
  <div class="chat-panel">
    <!-- 状态栏 模型与运行态 -->
    <header class="chat-status">
      <div class="status-left">
        <span class="status-model">{{ chat.model ? `${chat.model.provider} / ${chat.model.id}` : "未加载" }}</span>
        <span v-if="chat.thinkingLevel !== 'off'" class="status-chip thinking">思考 {{ chat.thinkingLevel }}</span>
        <span v-if="chat.isCompacting" class="status-chip compacting">压缩上下文中</span>
      </div>
      <div class="status-right">
        <PiIndicator v-if="chat.isRunning" />
      </div>
    </header>

    <!-- 通知条 错误可关闭 -->
    <div v-if="chat.notices.length" class="notices" role="status">
      <div
        v-for="notice in chat.notices"
        :key="notice.id"
        class="notice"
        :class="notice.type"
      >
        <span class="notice-text">{{ notice.message }}</span>
        <button class="notice-close" type="button" aria-label="关闭通知" @click="chat.dismissNotice(notice.id)">×</button>
      </div>
    </div>

    <!-- 消息区 -->
    <div ref="scrollEl" class="messages" @scroll="onScroll">
      <div class="messages-inner">
        <template v-if="chat.messages.length || chat.stream.streamingMessage">
          <MessageItem
            v-for="(m, i) in chat.messages"
            :key="chat.entryIds[i] || `local-${i}`"
            :message="m"
            :entry-id="chat.entryIds[i] ?? ''"
          />
          <!-- 流式气泡 独立于已定稿列表 两个数据源 -->
          <MessageItem
            v-if="chat.stream.streamingMessage"
            :message="chat.stream.streamingMessage"
            streaming
          />
        </template>

        <!-- 空会话引导 -->
        <div v-else class="chat-empty">
          <span class="chat-empty-mark">π</span>
          <p class="chat-empty-title">空会话已就绪</p>
          <p class="chat-empty-hint">第一条消息会成为会话名 你可以让它读代码 写文件 或跑命令</p>
        </div>
      </div>
    </div>

    <ChatComposer />
  </div>
</template>
