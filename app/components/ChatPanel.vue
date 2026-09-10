<template>
  <div class="chat-panel">
    <!-- 顶栏 会话操作与使用量 -->
    <header class="chat-status">
      <div class="status-left">
        <button
          class="status-icon-btn"
          type="button"
          :aria-label="ui.sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          :title="ui.sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          @click="ui.toggleSidebar()"
        >☰</button>

        <!-- 会话名 悬停出现重命名与生成标题 -->
        <div v-if="!renaming" class="status-title-group">
          <span class="status-title" :title="titleText">{{ titleText }}</span>
          <span v-if="chat.sessionId" class="status-title-actions">
            <button type="button" title="重命名" aria-label="重命名会话" @click="startRename">✎</button>
            <button
              v-if="hasMessages"
              type="button"
              title="生成标题"
              aria-label="生成标题"
              :disabled="sessionsStore.titlingIds.has(chat.sessionId)"
              @click="autoTitle"
            >{{ sessionsStore.titlingIds.has(chat.sessionId) ? "…" : "✦" }}</button>
          </span>
        </div>
        <input
          v-else
          ref="renameInput"
          v-model="renameValue"
          class="status-rename-input"
          type="text"
          spellcheck="false"
          @keydown.enter.prevent="commitRename"
          @keydown.esc.stop.prevent="renaming = false"
          @blur="commitRename"
        >

        <span v-if="chat.isCompacting" class="status-chip compacting">压缩上下文中</span>
      </div>

      <div class="status-right">
        <!-- 使用量 文件累计 token 与成本 悬浮明细 -->
        <span
          v-if="chat.stats"
          class="status-usage font-mono"
          :title="chat.stats ? usageBreakdown(chat.stats) : ''"
        >
          <span>{{ formatTokenCount(chat.stats.tokens.total) }} tok</span>
          <span class="status-usage-cost">{{ formatCost(chat.stats.cost) }}</span>
        </span>
        <!-- 当前上下文占用 无 window 数据时整块隐藏 -->
        <span
          v-if="contextPercent !== null"
          class="status-usage font-mono"
          :class="{ warn: contextPercent >= 80 }"
          :title="contextTitle"
        >ctx {{ contextPercent }}%</span>

        <button
          class="status-icon-btn"
          type="button"
          title="系统与工具"
          aria-label="系统与工具"
          @click="ui.runtimeInfoOpen = true"
        >⚙</button>

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
            :prev-timestamp="i > 0 ? chat.messages[i - 1]?.timestamp : undefined"
          />
          <!-- 流式气泡 独立于已定稿列表 前一条时间戳取列表末尾 -->
          <MessageItem
            v-if="chat.stream.streamingMessage"
            :message="chat.stream.streamingMessage"
            :prev-timestamp="chat.messages.at(-1)?.timestamp"
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

    <!-- 运行状态条 此刻正在跑什么 工具卡片由定稿后的历史渲染 -->
    <div v-if="chat.isRunning && (chat.activeTools.size || chat.retryInfo)" class="run-strip" role="status">
      <template v-if="chat.retryInfo">
        <span class="run-retry">
          自动重试 第 {{ chat.retryInfo.attempt }}/{{ chat.retryInfo.maxAttempts }} 次
          <span v-if="chat.retryInfo.errorMessage" class="run-retry-msg">{{ chat.retryInfo.errorMessage }}</span>
        </span>
      </template>
      <template v-for="[id, tool] in chat.activeTools" :key="id">
        <span class="run-tool">
          <span class="run-tool-dot" aria-hidden="true"></span>
          正在执行 {{ tool.name }}
          <span v-if="tool.progress" class="run-tool-progress">{{ tool.progress }}</span>
        </span>
      </template>
    </div>

    <!-- 排队消息提示 -->
    <div v-if="queuedCount > 0" class="queued-strip">
      已排队 {{ queuedCount }} 条消息 agent 空闲后继续
    </div>

    <ChatComposer />

    <!-- 运行信息抽屉 系统提示词与工具 -->
    <RuntimeInfoDrawer />
    <!-- 配置抽屉 模型 技能 设置 -->
    <SettingsDrawer />
  </div>
</template>

<script setup lang="ts">
import { useAutoScroll } from "~/composables/useAutoScroll";
import { useChatStore } from "~/stores/chat";
import { useSessionsStore } from "~/stores/sessions";
import { useUiStore } from "~/stores/ui";
import { formatCost, formatTokenCount, usageBreakdown } from "~/utils/usage-format";
import ChatComposer from "~/components/ChatComposer.vue";
import MessageItem from "~/components/MessageItem.vue";
import PiIndicator from "~/components/PiIndicator.vue";
import RuntimeInfoDrawer from "~/components/RuntimeInfoDrawer.vue";
import SettingsDrawer from "~/components/SettingsDrawer.vue";
import { useSettingsStore } from "~/stores/settings";
import { playCompletionChime } from "~/utils/chime";

const chat = useChatStore();
const sessionsStore = useSessionsStore();
const ui = useUiStore();
const settings = useSettingsStore();
const scrollEl = ref<HTMLElement | null>(null);

// 运行结束时按偏好播放提示音
watch(() => chat.isRunning, (running, was) => {
  if (!running && was && settings.completionSound) playCompletionChime();
});

// 依赖含流式消息内容长度 流式每增长一帧评估一次跟随
const { onScroll } = useAutoScroll(scrollEl, () => [
  chat.messages.length,
  chat.stream.streamingMessage?.content.length ?? 0,
]);

// 排队消息总数 composer 上方提示
const queuedCount = computed(
  () => chat.queuedMessages.steering.length + chat.queuedMessages.followUp.length,
);

// ---------- 顶栏 ----------

// 标题 优先会话名 无名空会话用引导文案
const titleText = computed(() => chat.sessionName ?? (chat.messages.length ? "未命名会话" : "空会话"));
const hasMessages = computed(() => chat.messages.some((m) => m.role === "user"));

const renaming = ref(false);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

function startRename() {
  renameValue.value = chat.sessionName ?? "";
  renaming.value = true;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

async function commitRename() {
  if (!renaming.value) return;
  const value = renameValue.value.trim();
  renaming.value = false;
  if (!value || value === chat.sessionName || !chat.sessionId) return;
  if (await sessionsStore.rename(chat.sessionId, value)) {
    chat.sessionName = value;
  }
}

async function autoTitle() {
  if (!chat.sessionId) return;
  await sessionsStore.autoTitle(chat.sessionId);
  // 生成后详情里拉新名字
  void chat.reload();
}

// ---------- 使用量 ----------

const contextPercent = computed(() =>
  chat.contextUsage?.percent !== null && chat.contextUsage?.percent !== undefined
    ? Math.round(chat.contextUsage.percent)
    : null,
);
const contextTitle = computed(() => {
  const usage = chat.contextUsage;
  if (!usage) return "";
  const tokensK = usage.tokens !== null ? `${Math.round(usage.tokens / 1000)}k` : "?";
  const windowK = Math.round(usage.contextWindow / 1000);
  return `当前上下文 ${tokensK} / ${windowK}k tokens`;
});
</script>
