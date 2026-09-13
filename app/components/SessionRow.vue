<template>
  <!-- 重命名模式 行内容换成输入框 -->
  <div v-if="renaming" class="session-row renaming">
    <input
      ref="renameInput"
      v-model="renameValue"
      class="session-rename-input"
      type="text"
      spellcheck="false"
      @keydown.enter.prevent="commitRename"
      @keydown.esc.stop.prevent="cancelRename"
      @blur="commitRename"
    >
  </div>

  <button
    v-else
    class="session-row group"
    :class="{ active: route.params.id === session.id }"
    type="button"
    @click="emit('open', session.id)"
  >
    <span class="session-preview">{{ session.name ?? session.firstMessage }}</span>
    <span class="session-meta">
      <!-- 未选项目时行内显示项目名 已选项目时显示 worktree 名 -->
      <span v-if="scopeLabel" class="session-project">{{ scopeLabel }}</span>
      <span class="session-time">{{ relativeTime(session.modified) }}</span>
      <!-- 运行中小圆点 铜绿呼吸 -->
      <span
        v-if="sessionsStore.runningIds.has(session.id)"
        class="session-running"
        title="运行中"
      ></span>
      <!-- 悬停操作 重命名与自动标题 空会话不可自动命名 -->
      <span class="session-actions" @click.stop>
        <button
          class="session-action"
          type="button"
          title="重命名"
          aria-label="重命名会话"
          @click="startRename"
        ><Pencil :size="13" aria-hidden="true" /></button>
        <button
          v-if="hasMessages"
          class="session-action"
          type="button"
          title="生成标题"
          aria-label="自动生成标题"
          :disabled="sessionsStore.titlingIds.has(session.id)"
          @click="sessionsStore.autoTitle(session.id)"
        ><span v-if="sessionsStore.titlingIds.has(session.id)">…</span><Sparkles v-else :size="13" aria-hidden="true" /></button>
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { Pencil, Sparkles } from "lucide-vue-next";
import { useSessionsStore } from "~/stores/sessions";
import { useWorkspaceStore } from "~/stores/workspace";
import { projectLabelOf } from "~/utils/session-groups";
import type { SessionInfo } from "#shared/lib/types";

// 单条会话行 分组与项目内平铺两处复用
const props = defineProps<{ session: SessionInfo }>();
const emit = defineEmits<{ open: [id: string] }>();

const route = useRoute();
const sessionsStore = useSessionsStore();
const workspace = useWorkspaceStore();

const renaming = ref(false);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

// 空会话没有可命名的上下文
const hasMessages = computed(() => props.session.firstMessage !== "(no messages)");

// 相对时间 列表刷新时重新计算
function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 172_800_000) return "昨天";
  const d = new Date(then);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 已选项目时同项目会话不重复标项目名 改标 worktree 区分来源
const scopeLabel = computed(() => {
  if (!workspace.projectKey) return projectLabelOf(props.session.projectRoot || props.session.cwd);
  if (props.session.worktreePath) return projectLabelOf(props.session.worktreePath);
  return "";
});

function startRename() {
  renameValue.value = props.session.name ?? props.session.firstMessage;
  renaming.value = true;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function cancelRename() {
  renaming.value = false;
}

async function commitRename() {
  if (!renaming.value) return; // blur 在取消后还会触发一次
  const value = renameValue.value.trim();
  renaming.value = false;
  if (!value || value === (props.session.name ?? props.session.firstMessage)) return;
  await sessionsStore.rename(props.session.id, value);
}
</script>
