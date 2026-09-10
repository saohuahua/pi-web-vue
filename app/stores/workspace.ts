import { defineStore } from "pinia";
import { ref } from "vue";
import type { ProjectIdentity, WorktreeInfo, WorktreesResponse } from "#shared/lib/types";

const STORAGE_KEY = "pi-agent:workspace";

// 工作区 store 持有选中的项目与 worktree
// 选择只影响新会话 cwd 与后续文件树根 不篡改已打开会话的任何状态
// Git worktree 与 Step B 的会话内分支是两套模型 activeLeafId 不在本 store 出现
export const useWorkspaceStore = defineStore("workspace", () => {
  const selectedCwd = ref<string | null>(null);   // 新会话实际使用的 cwd
  const projectRoot = ref<string | null>(null);
  const projectKey = ref<string | null>(null);    // 会话过滤与分组的稳定键
  const worktrees = ref<WorktreeInfo[]>([]);
  const isGit = ref(false);
  const loading = ref(false);
  const error = ref("");

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cwd: selectedCwd.value,
      projectRoot: projectRoot.value,
      projectKey: projectKey.value,
    }));
  }

  function applyIdentity(identity: ProjectIdentity) {
    selectedCwd.value = identity.cwd;
    projectRoot.value = identity.projectRoot;
    projectKey.value = identity.projectKey;
    persist();
  }

  async function loadWorktrees(cwd: string) {
    try {
      const res = await fetch(`/api/worktrees?cwd=${encodeURIComponent(cwd)}`);
      if (!res.ok) return;
      const body = await res.json() as WorktreesResponse & { error?: string };
      if (body.error) return;
      worktrees.value = body.worktrees ?? [];
      isGit.value = body.isGit === true;
      // worktree 接口带回权威项目身份 顺带校正本地状态
      if (body.projectKey) {
        projectRoot.value = body.projectRoot;
        projectKey.value = body.projectKey;
      }
    } catch {
      // 网络失败保持旧数据 下次选择或会话打开会再拉
    }
  }

  // 从 localStorage 恢复上次选择 worktree 数据随后台补齐
  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { cwd?: string; projectRoot?: string; projectKey?: string };
      selectedCwd.value = saved.cwd ?? null;
      projectRoot.value = saved.projectRoot ?? null;
      projectKey.value = saved.projectKey ?? null;
      if (selectedCwd.value) void loadWorktrees(selectedCwd.value);
    } catch {
      // 存储损坏按未选择处理
    }
  }

  // 选择项目 校验失败返回 false 并保留原选择
  async function selectProject(cwd: string): Promise<boolean> {
    loading.value = true;
    error.value = "";
    try {
      const res = await fetch("/api/cwd/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd }),
      });
      const body = await res.json() as ProjectIdentity & { error?: string };
      if (!res.ok || !body.projectKey) {
        error.value = body.error ?? `HTTP ${res.status}`;
        return false;
      }
      applyIdentity(body);
      await loadWorktrees(body.cwd);
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      loading.value = false;
    }
  }

  // 切换已有 worktree 只改新会话 cwd 与当前分支标记
  async function selectWorktree(path: string) {
    selectedCwd.value = path;
    persist();
    await loadWorktrees(path);
  }

  // 打开会话时工作区跟随该会话的项目与 worktree
  // 项目没变时仍同步 cwd 点击其他 worktree 的会话会把新会话位置带过去
  async function syncFromSessionCwd(cwd: string) {
    try {
      const res = await fetch("/api/cwd/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd }),
      });
      if (!res.ok) return; // 目录已删除等场景保持现选择
      const body = await res.json() as ProjectIdentity;
      if (!body.projectKey) return;
      const projectChanged = body.projectKey !== projectKey.value;
      const cwdChanged = body.cwd !== selectedCwd.value;
      if (!projectChanged && !cwdChanged) return;
      applyIdentity(body);
      await loadWorktrees(body.cwd);
    } catch {
      // 静默失败 打开会话不受影响
    }
  }

  // 回到全部项目 未选择时新会话需要手动输入 cwd
  function clearSelection() {
    selectedCwd.value = null;
    projectRoot.value = null;
    projectKey.value = null;
    worktrees.value = [];
    isGit.value = false;
    error.value = "";
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    selectedCwd, projectRoot, projectKey, worktrees, isGit, loading, error,
    restore, selectProject, selectWorktree, syncFromSessionCwd, clearSelection,
  };
});
