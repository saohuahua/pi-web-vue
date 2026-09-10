<template>
  <button
    class="session-row"
    :class="{ active: route.params.id === session.id }"
    type="button"
    @click="emit('open', session.id)"
  >
    <span class="session-preview">{{ session.name ?? session.firstMessage }}</span>
    <span class="session-meta">
      <!-- 未选项目时行内显示项目名 已选项目时显示 worktree 名 -->
      <span class="session-project">{{ scopeLabel }}</span>
      <span class="session-time">{{ relativeTime(session.modified) }}</span>
      <!-- 运行中小圆点 铜绿呼吸 -->
      <span
        v-if="sessionsStore.runningIds.has(session.id)"
        class="session-running"
        title="运行中"
      ></span>
    </span>
  </button>
</template>

<script setup lang="ts">
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
</script>
