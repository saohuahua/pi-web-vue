<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="brand-mark" aria-hidden="true">π</span>
      <span class="brand-name">agent</span>
      <button
        class="sidebar-new"
        type="button"
        :aria-expanded="showForm"
        @click="showForm = !showForm"
      >新会话</button>
    </div>

    <!-- 内联展开的 cwd 表单 -->
    <div v-if="showForm" class="sidebar-form">
      <NewSessionForm @created="onCreated" />
    </div>

    <nav class="sidebar-list" aria-label="会话列表">
      <p v-if="!sessionsStore.sessions.length && !sessionsStore.loading" class="sidebar-empty">
        还没有会话
      </p>
      <button
        v-for="session in sessionsStore.sessions"
        :key="session.id"
        class="session-row"
        :class="{ active: route.params.id === session.id }"
        type="button"
        @click="openSession(session.id)"
      >
        <span class="session-preview">{{ session.name ?? session.firstMessage }}</span>
        <span class="session-meta">
          <span class="session-project">{{ projectLabel(session.cwd) }}</span>
          <span class="session-time">{{ relativeTime(session.modified) }}</span>
          <!-- 运行中小圆点 铜绿呼吸 -->
          <span
            v-if="sessionsStore.runningIds.has(session.id)"
            class="session-running"
            title="运行中"
          ></span>
        </span>
      </button>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { useChatStore } from "~/stores/chat";
import { useSessionsStore } from "~/stores/sessions";
import NewSessionForm from "~/components/NewSessionForm.vue";

const emit = defineEmits<{ navigate: [] }>();

const router = useRouter();
const route = useRoute();
const chat = useChatStore();
const sessionsStore = useSessionsStore();

const showForm = ref(false);

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

function projectLabel(cwd: string): string {
  // 目录名足够区分项目 不解码完整路径
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

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
