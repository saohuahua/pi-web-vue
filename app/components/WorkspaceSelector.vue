<template>
  <section class="relative border-b border-line px-3 pt-3 pb-2" aria-label="工作区">
    <!-- 当前项目行 点击展开项目面板 -->
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
      :aria-expanded="panelOpen"
      @click="panelOpen = !panelOpen"
    >
      <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
        {{ workspace.projectKey ? projectLabel : "选择项目" }}
      </span>
      <!-- 当前分支 仅真实 git 检出才显示 不伪造 main -->
      <span
        v-if="currentBranch"
        class="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent-deep"
      >{{ currentBranch }}</span>
      <span class="shrink-0 text-[10px] text-muted" aria-hidden="true">▾</span>
    </button>

    <!-- worktree 切换行 只有多个 worktree 才出现 -->
    <div v-if="workspace.isGit && workspace.worktrees.length > 1" class="mt-1 flex flex-wrap gap-1 px-1">
      <button
        v-for="wt in workspace.worktrees"
        :key="wt.path"
        type="button"
        class="max-w-full truncate rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors"
        :class="wt.isCurrent
          ? 'bg-accent-soft text-accent-deep'
          : 'text-muted hover:bg-surface-2 hover:text-ink-soft'"
        :title="wt.path"
        @click="selectWorktree(wt)"
      >
        {{ wt.branch ?? wt.path.split(/[\\/]/).pop() }}
      </button>
    </div>

    <!-- 项目下拉面板 -->
    <div
      v-if="panelOpen"
      class="absolute inset-x-3 top-full z-40 mt-1 rounded-xl border border-line bg-surface p-2 shadow-soft"
    >
      <p class="px-2 pt-1 pb-1.5 text-[11px] text-muted">项目</p>
      <button
        v-for="project in recentProjects"
        :key="project.key"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
        :class="{ 'bg-accent-soft': project.key === workspace.projectKey }"
        @click="chooseProject(project.root)"
      >
        <span class="min-w-0 flex-1 truncate text-[13px] text-ink">{{ project.label }}</span>
        <span class="shrink-0 font-mono text-[11px] text-muted">{{ project.count }} 会话</span>
      </button>
      <p v-if="!recentProjects.length" class="px-2 pb-1.5 text-[12px] text-muted">还没有项目的会话</p>

      <!-- 手动输入路径 -->
      <form class="mt-1 flex gap-1 border-t border-line pt-2" @submit.prevent="submitPath">
        <input
          v-model="pathInput"
          class="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-accent"
          type="text"
          placeholder="D:\project\demo"
          spellcheck="false"
          autocomplete="off"
        >
        <button
          class="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          type="submit"
          :disabled="!pathInput.trim() || workspace.loading"
        >{{ workspace.loading ? "…" : "选择" }}</button>
      </form>

      <p v-if="workspace.error" class="px-2 pt-1.5 text-[12px] text-danger">{{ workspace.error }}</p>

      <button
        v-if="workspace.projectKey"
        type="button"
        class="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-ink-soft"
        @click="clearAll"
      >查看全部项目</button>
    </div>

    <!-- 点击面板外关闭 -->
    <div v-if="panelOpen" class="fixed inset-0 z-30" @click="panelOpen = false"></div>
  </section>
</template>

<script setup lang="ts">
import { useSessionsStore } from "~/stores/sessions";
import { useWorkspaceStore } from "~/stores/workspace";
import { projectLabelOf } from "~/utils/session-groups";
import type { WorktreeInfo } from "#shared/lib/types";

// 左上工作区选择器 项目 + 已有 worktree
// 选择只决定新会话 cwd 与分组过滤 不影响已打开会话
const workspace = useWorkspaceStore();
const sessionsStore = useSessionsStore();

const panelOpen = ref(false);
const pathInput = ref("");

const projectLabel = computed(() =>
  workspace.projectRoot ? projectLabelOf(workspace.projectRoot) : "",
);

const currentBranch = computed(() => {
  if (!workspace.isGit) return null;
  return workspace.worktrees.find((w) => w.isCurrent)?.branch ?? null;
});

// 候选项目来自已有会话 按最近活动排序
const recentProjects = computed(() => {
  const byKey = new Map<string, { key: string; root: string; label: string; count: number }>();
  for (const session of sessionsStore.sessions) {
    const existing = byKey.get(session.projectKey);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byKey.set(session.projectKey, {
      key: session.projectKey,
      root: session.projectRoot || session.cwd,
      label: projectLabelOf(session.projectRoot || session.cwd),
      count: 1,
    });
  }
  return [...byKey.values()];
});

async function chooseProject(root: string) {
  if (await workspace.selectProject(root)) {
    panelOpen.value = false;
    pathInput.value = "";
  }
}

async function submitPath() {
  await chooseProject(pathInput.value.trim());
}

function selectWorktree(wt: WorktreeInfo) {
  void workspace.selectWorktree(wt.path);
}

function clearAll() {
  workspace.clearSelection();
  panelOpen.value = false;
}
</script>
