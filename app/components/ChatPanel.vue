<template>
  <div class="chat-panel">
    <!-- 顶栏 会话操作与使用量 -->
    <header class="chat-status">
      <div class="status-left">
        <PiIconButton
          :label="ui.sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          @click="ui.toggleSidebar()"
          ><Menu :size="16" aria-hidden="true"
        /></PiIconButton>

        <!-- 会话名 悬停出现重命名与生成标题 -->
        <div v-if="!renaming" class="status-title-group">
          <span class="status-title" :title="titleText">{{ titleText }}</span>
          <span v-if="chat.sessionId" class="status-title-actions">
            <PiIconButton label="重命名会话" size="compact" @click="startRename">
              <Pencil :size="14" aria-hidden="true" />
            </PiIconButton>
            <PiIconButton
              v-if="hasMessages"
              label="生成标题"
              size="compact"
              :disabled="sessionsStore.titlingIds.has(chat.sessionId)"
              @click="autoTitle"
              ><span v-if="sessionsStore.titlingIds.has(chat.sessionId)">…</span
              ><Sparkles v-else :size="14" aria-hidden="true"
            /></PiIconButton>
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
        />

        <span v-if="chat.isCompacting" class="status-chip compacting">压缩上下文中</span>
      </div>

      <div class="status-right">
        <!-- 使用量 文件累计 token 与成本 悬浮明细 -->
        <div v-if="chat.stats" class="status-usage-wrap">
          <button
            class="status-usage status-usage-trigger font-mono"
            type="button"
            :aria-expanded="usageOpen"
            :aria-label="usageButtonLabel"
            :title="usageButtonLabel"
            @click="usageOpen = !usageOpen"
          >
            <span
              class="status-usage-ring"
              :class="{
                warn: contextPercent !== null && contextPercent >= 80,
                unknown: contextPercent === null,
              }"
              :style="contextRingStyle"
              aria-hidden="true"
              ><span v-if="contextRemaining !== null">{{ contextRemaining }}</span
              ><CircleHelp v-else :size="14" aria-hidden="true"
            /></span>
            <span v-if="chat.stats.cost > 0" class="status-usage-cost">{{
              formatCost(chat.stats.cost)
            }}</span>
          </button>
          <div v-if="usageOpen" class="status-usage-popover" role="status">
            <p>会话累计</p>
            <dl>
              <div>
                <dt>输入</dt>
                <dd>{{ formatTokenCount(chat.stats.tokens.input) }}</dd>
              </div>
              <div>
                <dt>输出</dt>
                <dd>{{ formatTokenCount(chat.stats.tokens.output) }}</dd>
              </div>
              <div>
                <dt>缓存读</dt>
                <dd>{{ formatTokenCount(chat.stats.tokens.cacheRead) }}</dd>
              </div>
              <div>
                <dt>缓存写</dt>
                <dd>{{ formatTokenCount(chat.stats.tokens.cacheWrite) }}</dd>
              </div>
              <div>
                <dt>成本</dt>
                <dd>{{ chat.stats.cost > 0 ? formatCost(chat.stats.cost) : "未提供" }}</dd>
              </div>
              <div>
                <dt>当前上下文</dt>
                <dd>{{ contextUsageText || "未提供" }}</dd>
              </div>
            </dl>
          </div>
        </div>
        <PiIconButton
          label="常规设置"
          :tooltip="false"
          aria-haspopup="dialog"
          @click="center.show('general')"
          ><Settings2 :size="16" aria-hidden="true"
        /></PiIconButton>

        <PiIndicator v-if="chat.isRunning" />
      </div>
    </header>

    <button
      v-if="usageOpen"
      class="status-usage-scrim"
      type="button"
      aria-label="关闭使用量详情"
      @click="usageOpen = false"
    ></button>

    <!-- 通知条 错误可关闭 -->
    <div v-if="chat.notices.length" class="notices" role="status">
      <div v-for="notice in chat.notices" :key="notice.id" class="notice" :class="notice.type">
        <span class="notice-text">{{ notice.message }}</span>
        <PiIconButton label="关闭通知" size="compact" @click="chat.dismissNotice(notice.id)">
          <X :size="14" aria-hidden="true" />
        </PiIconButton>
      </div>
    </div>

    <!-- 消息区 -->
    <div ref="scrollEl" class="messages" @scroll="onScroll">
      <Transition name="session-view" mode="out-in">
        <div :key="chat.sessionId ?? 'empty-session'" class="messages-inner">
          <div v-if="chat.sessionLoading" class="session-loading" aria-busy="true">
            <span v-for="index in 5" :key="index"></span>
          </div>
          <template v-else-if="chat.messages.length || chat.stream.streamingMessage">
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

            <!-- 思考占位 首个流式事件到达前的空窗反馈 -->
            <div v-if="showThinking" class="chat-thinking" role="status">
              <span class="chat-thinking-dots" aria-hidden="true">
                <span class="chat-thinking-dot"></span>
                <span class="chat-thinking-dot"></span>
                <span class="chat-thinking-dot"></span>
              </span>
              <span class="chat-thinking-text">正在思考</span>
            </div>
          </template>

          <!-- 空会话引导 -->
          <div v-else class="chat-empty">
            <svg class="chat-empty-mascot" viewBox="0 0 96 80" fill="none" aria-hidden="true">
              <path class="chat-empty-mascot__antenna" d="M48 18V11" />
              <circle class="chat-empty-mascot__signal" cx="48" cy="8" r="3" />
              <rect class="chat-empty-mascot__body" x="16" y="18" width="64" height="48" rx="15" />
              <rect class="chat-empty-mascot__screen" x="25" y="28" width="46" height="26" rx="9" />
              <circle class="chat-empty-mascot__eye" cx="39" cy="40" r="3" />
              <circle class="chat-empty-mascot__eye" cx="57" cy="40" r="3" />
              <path class="chat-empty-mascot__smile" d="M40 47c3 3 13 3 16 0" />
              <path class="chat-empty-mascot__feet" d="M31 66v5M65 66v5" />
            </svg>
            <p class="chat-empty-title">从一个任务开始</p>
          </div>
        </div>
      </Transition>
    </div>

    <div v-if="!nearBottom" class="scroll-bottom-control">
      <button
        class="scroll-bottom-button"
        type="button"
        title="回到最新消息"
        aria-label="回到最新消息"
        @click="scrollToBottom(true)"
      >
        <ArrowDown :size="17" aria-hidden="true" />
      </button>
    </div>

    <!-- 运行状态条 此刻正在跑什么 工具卡片由定稿后的历史渲染 -->
    <div
      v-if="chat.isRunning && (chat.activeTools.size || chat.retryInfo)"
      class="run-strip"
      role="status"
    >
      <template v-if="chat.retryInfo">
        <span class="run-retry">
          自动重试 第 {{ chat.retryInfo.attempt }}/{{ chat.retryInfo.maxAttempts }} 次
          <span v-if="chat.retryInfo.errorMessage" class="run-retry-msg">{{
            chat.retryInfo.errorMessage
          }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useAutoScroll } from "~/composables/useAutoScroll";
import { ArrowDown, CircleHelp, Menu, Pencil, Settings2, Sparkles, X } from "lucide-vue-next";
import PiIconButton from "~/components/pi/PiIconButton/index.vue";
import { useChatStore } from "~/stores/chat";
import { useSessionsStore } from "~/stores/sessions";
import { useUiStore } from "~/stores/ui";
import { formatCost, formatTokenCount } from "~/utils/usage-format";
import ChatComposer from "~/components/ChatComposer.vue";
import MessageItem from "~/components/MessageItem.vue";
import PiIndicator from "~/components/PiIndicator.vue";
import { useSettingsStore } from "~/stores/settings";
import { useCapabilityCenterStore } from "~/stores/capability-center";
import { playCompletionChime } from "~/utils/chime";

const chat = useChatStore();
const sessionsStore = useSessionsStore();
const ui = useUiStore();
const settings = useSettingsStore();
const center = useCapabilityCenterStore();
const scrollEl = ref<HTMLElement | null>(null);
const usageOpen = ref(false);

// 运行结束时按偏好播放提示音
watch(
  () => chat.isRunning,
  (running, was) => {
    if (!running && was && settings.completionSound) playCompletionChime();
  },
);

// 依赖含流式消息内容长度 流式每增长一帧评估一次跟随 isRunning 翻转时占位行出现或消失也要跟随
const { onScroll, scrollToBottom, nearBottom } = useAutoScroll(scrollEl, () => [
  chat.messages.length,
  chat.isRunning,
  chat.stream.streamingMessage?.content.length ?? 0,
]);

// 排队消息总数 composer 上方提示
const queuedCount = computed(
  () => chat.queuedMessages.steering.length + chat.queuedMessages.followUp.length,
);

// 思考占位 run 已起飞但流式气泡还没出现的空窗期
// 工具执行与压缩各有自己的反馈位 这里只补等待模型首字这段真空
const showThinking = computed(
  () =>
    chat.isRunning &&
    !chat.sessionLoading &&
    !chat.stream.streamingMessage &&
    !chat.activeTools.size &&
    !chat.isCompacting &&
    !chat.retryInfo,
);

// 标题 优先会话名 无名空会话用引导文案
const titleText = computed(
  () => chat.sessionName ?? (chat.messages.length ? "未命名会话" : "空会话"),
);
const hasMessages = computed(() => chat.messages.some((m) => m.role === "user"));

const renaming = ref(false);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

const startRename = () => {
  renameValue.value = chat.sessionName ?? "";
  renaming.value = true;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
};

const commitRename = async () => {
  if (!renaming.value) return;
  const value = renameValue.value.trim();
  renaming.value = false;
  if (!value || value === chat.sessionName || !chat.sessionId) return;
  if (await sessionsStore.rename(chat.sessionId, value)) {
    chat.sessionName = value;
  }
};

const autoTitle = async () => {
  if (!chat.sessionId) return;
  await sessionsStore.autoTitle(chat.sessionId);
  // 生成后详情里拉新名字
  void chat.reload();
};

// ---------- 使用量 ----------

const contextPercent = computed(() =>
  chat.contextUsage?.percent !== null && chat.contextUsage?.percent !== undefined
    ? Math.max(0, Math.min(100, Math.round(chat.contextUsage.percent)))
    : null,
);
const contextRemaining = computed(() =>
  contextPercent.value === null ? null : 100 - contextPercent.value,
);
const contextRingStyle = computed(() => ({
  "--context-progress": `${contextPercent.value ?? 0}%`,
}));
const contextTitle = computed(() => {
  const usage = chat.contextUsage;
  if (!usage || contextPercent.value === null) return "当前上下文窗口未提供";
  const tokensK = usage.tokens !== null ? `${Math.round(usage.tokens / 1000)}k` : "?";
  const windowK = Math.round(usage.contextWindow / 1000);
  return `当前上下文 ${tokensK} / ${windowK}k tokens 已用 ${contextPercent.value}% 剩余 ${contextRemaining.value}%`;
});
const usageButtonLabel = computed(() => `查看会话使用量 ${contextTitle.value}`);
const contextUsageText = computed(() => {
  const usage = chat.contextUsage;
  if (!usage || usage.tokens === null) return "";
  return `${formatTokenCount(usage.tokens)} / ${formatTokenCount(usage.contextWindow)} tokens`;
});
</script>
