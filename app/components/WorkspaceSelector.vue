<template>
  <section class="workspace-selector relative border-b border-line" aria-label="工作区">
    <!-- 当前项目行 点击展开项目面板 -->
    <button
      type="button"
      class="workspace-trigger"
      :aria-expanded="panelOpen"
      title="切换项目"
      aria-label="切换项目"
      @click="panelOpen = !panelOpen"
    >
      <span class="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
        {{ workspace.projectKey ? projectLabel : "选择项目" }}
      </span>
      <!-- 当前分支 仅真实 git 检出才显示 不伪造 main -->
      <span v-if="currentBranch" class="workspace-branch"><GitBranch :size="12" aria-hidden="true" />{{ currentBranch }}</span>
      <ChevronDown :size="14" class="shrink-0 text-muted" aria-hidden="true" />
      <span class="workspace-switch-hint" aria-hidden="true">切换项目</span>
    </button>

    <!-- worktree 切换行 只有多个 worktree 才出现 -->
    <div v-if="workspace.isGit && workspace.worktrees.length > 1" class="workspace-worktrees">
      <button
        v-for="wt in workspace.worktrees"
        :key="wt.path"
        type="button"
        class="workspace-worktree"
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
      class="workspace-menu"
    >
      <p class="workspace-menu-label">项目</p>
      <button
        v-for="project in recentProjects"
        :key="project.key"
        type="button"
        class="workspace-menu-row"
        :class="{ 'bg-accent-soft': project.key === workspace.projectKey }"
        @click="chooseProject(project.root)"
      >
        <span class="min-w-0 flex-1 truncate text-[14px] text-ink">{{ project.label }}</span>
        <span class="shrink-0 font-mono text-[12px] text-muted">{{ project.count }} 会话</span>
      </button>
      <p v-if="!recentProjects.length" class="workspace-menu-empty">还没有项目的会话</p>

      <!-- 手动输入路径 -->
      <form class="workspace-path-form" @submit.prevent="submitPath">
        <input
          v-model="pathInput"
          class="workspace-path-input"
          type="text"
          placeholder="D:\project\demo"
          spellcheck="false"
          autocomplete="off"
        >
        <button
          class="workspace-path-submit"
          type="submit"
          :disabled="!pathInput.trim() || workspace.loading"
        >{{ workspace.loading ? "…" : "选择" }}</button>
      </form>

      <p v-if="workspace.error" class="workspace-menu-error">{{ workspace.error }}</p>

      <button
        v-if="workspace.projectKey"
        type="button"
        class="workspace-menu-clear"
        @click="clearAll"
      >查看全部项目</button>
    </div>

    <!-- 点击面板外关闭 -->
    <div v-if="panelOpen" class="fixed inset-0 z-30" @click="panelOpen = false"></div>
  </section>
</template>

<script setup lang="ts">
import { ChevronDown, GitBranch } from "lucide-vue-next";
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
