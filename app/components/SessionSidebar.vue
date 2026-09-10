<template>
  <aside class="sidebar">
    <!-- 左上工作区 项目与 worktree 选择 -->
    <WorkspaceSelector />

    <div class="sidebar-header">
      <span class="brand-mark" aria-hidden="true">π</span>
      <span class="brand-name">agent</span>
      <button
        class="sidebar-new"
        type="button"
        :aria-expanded="showForm"
        @click="onNewSession"
      >新会话</button>
    </div>

    <!-- 未选项目时手输 cwd 已选项目时新会话直接落入选中目录 -->
    <div v-if="showForm" class="sidebar-form">
      <NewSessionForm @created="onCreated" />
    </div>

    <!-- 项目内搜索 匹配名称与首条消息 -->
    <div class="px-3 py-2">
      <input
        v-model="search"
        class="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[12.5px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
        type="search"
        :placeholder="workspace.projectKey ? '搜索当前项目' : '搜索全部会话'"
        aria-label="搜索会话"
        @keydown.esc="search = ''"
      >
    </div>

    <nav class="sidebar-list" aria-label="会话列表">
      <!-- 已选项目 单项目平铺 -->
      <template v-if="workspace.projectKey">
        <p v-if="!filteredSessions.length" class="sidebar-empty">
          {{ sessionsStore.loading ? "加载中…" : "这个项目还没有会话" }}
        </p>
        <SessionRow
          v-for="session in filteredSessions"
          :key="session.id"
          :session="session"
          @open="openSession"
        />
      </template>

      <!-- 未选项目 按项目分组折叠展示 -->
      <template v-else>
        <p v-if="!sessionsStore.sessions.length && !sessionsStore.loading" class="sidebar-empty">
          还没有会话
        </p>
        <details v-for="group in groupedSessions" :key="group.key" class="project-group" open>
          <summary class="project-group-head">
            <span class="project-group-label">{{ group.label }}</span>
            <span class="project-group-count">{{ group.sessions.length }}</span>
          </summary>
          <SessionRow
            v-for="session in group.sessions"
            :key="session.id"
            :session="session"
            @open="openSession"
          />
        </details>
        <p v-if="!groupedSessions.length && (search || sessionsStore.loading)" class="sidebar-empty">
          {{ sessionsStore.loading ? "加载中…" : "没有匹配的会话" }}
        </p>
      </template>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { useChatStore } from "~/stores/chat";
import { useSessionsStore } from "~/stores/sessions";
import { useWorkspaceStore } from "~/stores/workspace";
import { filterSessions, groupSessionsByProject } from "~/utils/session-groups";
import NewSessionForm from "~/components/NewSessionForm.vue";
import SessionRow from "~/components/SessionRow.vue";
import WorkspaceSelector from "~/components/WorkspaceSelector.vue";
import type { SessionInfo } from "#shared/lib/types";

const emit = defineEmits<{ navigate: [] }>();

const router = useRouter();
const route = useRoute();
const chat = useChatStore();
const sessionsStore = useSessionsStore();
const workspace = useWorkspaceStore();

const showForm = ref(false);
const search = ref("");
// 新会话创建中 按钮点击去抖
const creating = ref(false);

// 刷新页面后恢复上次选择 分组过滤立即生效
workspace.restore();

// 当前范围内的会话 已选项目先过滤项目再搜索 未选时全量搜索
const filteredSessions = computed(() =>
  filterSessions(sessionsStore.sessions, workspace.projectKey, search.value),
);

// 未选项目时按项目分组 组内已被搜索过滤
const groupedSessions = computed(() => groupSessionsByProject(
  filterSessions(sessionsStore.sessions, null, search.value),
));

function openSession(id: string) {
  // 通知外层收起窄屏抽屉 桌面宽下无副作用
  emit("navigate");
  if (route.params.id === id) {
    // 已在这个会话 重复路由跳转无效 直接重新拉取
    void chat.openSession(id);
    return;
  }
  router.push(`/session/${id}`);
}

// 有选中目录直接在原地新建 没有则展开 cwd 表单
async function onNewSession() {
  if (!workspace.selectedCwd) {
    showForm.value = !showForm.value;
    return;
  }
  if (creating.value) return;
  creating.value = true;
  try {
    await chat.newSession(workspace.selectedCwd);
    emit("navigate");
  } finally {
    creating.value = false;
  }
}

function onCreated() {
  showForm.value = false;
  emit("navigate");
}

let pollTimer: number | null = null;

onMounted(async () => {
  await sessionsStore.refresh();
  // 运行中标记靠轮询 页面不可见时跳过省请求
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") void sessionsStore.pollRunning();
  }, 2500);
});

// HMR 重挂载或卸载时清掉定时器 否则轮询会叠加
onBeforeUnmount(() => {
  if (pollTimer !== null) window.clearInterval(pollTimer);
});
</script>
