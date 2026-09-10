<template>
  <section class="flex max-h-[46%] shrink-0 flex-col border-t border-line" aria-label="文件浏览">
    <!-- 面板头 标题 折叠 刷新 -->
    <div class="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-medium text-muted"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <span
          class="inline-block h-0 w-0 border-l-[4px] border-l-muted border-y-[3px] border-y-transparent transition-transform duration-150"
          :class="{ 'rotate-90': collapsed }"
          aria-hidden="true"
        ></span>
        <span class="truncate">文件</span>
      </button>
      <button
        v-if="!collapsed"
        type="button"
        class="shrink-0 rounded px-1 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        title="刷新"
        aria-label="刷新文件树"
        @click="loadRoot(true)"
      >⟳</button>
    </div>

    <template v-if="!collapsed">
      <!-- 文件搜索 服务端索引覆盖未展开目录 -->
      <div class="px-3 pb-2">
        <input
          v-model="search"
          class="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
          type="search"
          placeholder="搜索文件"
          aria-label="搜索文件"
          @keydown.esc="search = ''"
        >
      </div>

      <!-- 无项目选择时的引导 -->
      <div v-if="!workspace.selectedCwd" class="px-4 pb-3 text-center text-[12px] text-muted">
        先在上方选择项目
      </div>

      <!-- 树或搜索结果 -->
      <div v-else class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <p v-if="loading && !rootNodes.length" class="px-2 py-2 text-[12px] text-muted">加载中…</p>
        <p v-else-if="error" class="px-2 py-2 text-[12px] text-danger">{{ error }}</p>

        <!-- 搜索结果 平铺相对路径 -->
        <template v-else-if="searchResults">
          <p v-if="!searchResults.files.length" class="px-2 py-2 text-[12px] text-muted">没有匹配的文件</p>
          <div
            v-for="file in searchResults.files"
            :key="file"
            class="group flex cursor-pointer items-center gap-1.5 rounded px-1 py-[3px] text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            :title="file"
            @click="viewer.open(joinPath(workspace.selectedCwd!, file))"
          >
            <span class="min-w-0 flex-1 truncate font-mono text-[11px]">{{ file }}</span>
            <button
              class="hidden shrink-0 rounded bg-accent-soft px-1.5 font-mono text-[10px] leading-4 text-accent-deep group-hover:block"
              type="button"
              title="引用到输入框"
              @click.stop="insertMention(file)"
            >@</button>
          </div>
          <p v-if="searchResults.truncated" class="px-2 pt-1.5 text-[11px] text-muted">结果过多 只显示前 {{ searchResults.files.length }} 条</p>
        </template>

        <!-- 目录树 -->
        <template v-else>
          <p v-if="!rootNodes.length" class="px-2 py-2 text-[12px] text-muted">空目录</p>
          <FileTreeNode
            v-for="node in rootNodes"
            :key="node.path"
            :node="node"
            :depth="0"
            :expanded-paths="expandedPaths"
            @toggle="toggleNode"
            @open="viewer.open"
            @mention="insertMention"
          />
        </template>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useChatStore } from "~/stores/chat";
import { useFileViewerStore } from "~/stores/file-viewer";
import { useWorkspaceStore } from "~/stores/workspace";
import FileTreeNode, { type FileNode } from "~/components/FileTreeNode.vue";
import { encodeFilePathForApi, getRelativeFilePath } from "#shared/lib/file-paths";
import type { FileEntry, FileIndexResponse } from "#shared/lib/types";

// 左下文件树 按需展开 目录数据只来自 /api/files 的白名单接口
// cwd 切换时整棵树重置 展开状态不跨项目保留
const workspace = useWorkspaceStore();
const viewer = useFileViewerStore();
const chat = useChatStore();

const collapsed = ref(false);
const rootNodes = ref<FileNode[]>([]);
const expandedPaths = ref<Set<string>>(new Set());
const loading = ref(false);
const error = ref("");
const search = ref("");
const searchResults = ref<FileIndexResponse | null>(null);

async function fetchEntries(dirPath: string): Promise<FileEntry[]> {
  const res = await fetch(`/api/files/${encodeFilePathForApi(dirPath)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const body = await res.json() as { entries?: FileEntry[] };
  return body.entries ?? [];
}

async function loadRoot(force = false) {
  const cwd = workspace.selectedCwd;
  if (!cwd) return;
  // 刷新按钮强制清空展开态 其余情况切 cwd 自然是全新树
  if (force) expandedPaths.value = new Set();
  loading.value = true;
  error.value = "";
  try {
    rootNodes.value = toNodes(await fetchEntries(cwd), cwd);
  } catch (e) {
    rootNodes.value = [];
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function toNodes(entries: FileEntry[], parent: string): FileNode[] {
  return entries.map((e) => ({
    name: e.name,
    path: joinPath(parent, e.name),
    isDir: e.isDir,
    ...(e.isDir ? { children: [] as FileNode[], loaded: false } : {}),
  }));
}

// 相对 cwd 的正斜杠引用路径 joinPath 也用于拼子路径
function joinPath(parent: string, child: string): string {
  const p = parent.replace(/\\/g, "/").replace(/\/$/, "");
  return `${p}/${child}`;
}

async function toggleNode(node: FileNode) {
  if (!node.isDir) return;
  if (expandedPaths.value.has(node.path)) {
    expandedPaths.value.delete(node.path);
    expandedPaths.value = new Set(expandedPaths.value);
    return;
  }
  // 首次展开才拉子目录 已加载的本地展开
  if (!node.loaded && !node.loading) {
    node.loading = true;
    try {
      node.children = toNodes(await fetchEntries(node.path), node.path);
      node.loaded = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return;
    } finally {
      node.loading = false;
    }
  }
  expandedPaths.value.add(node.path);
  expandedPaths.value = new Set(expandedPaths.value);
}

// @ 引用只写相对路径 实际文件内容由 agent 工具读取
function insertMention(absoluteOrRelative: string) {
  const rel = getRelativeFilePath(absoluteOrRelative, workspace.selectedCwd ?? undefined);
  const token = `@${rel} `;
  chat.draft = chat.draft && !chat.draft.endsWith(" ") && chat.draft !== ""
    ? `${chat.draft} ${token}`
    : `${chat.draft}${token}`;
}

// 搜索防抖 300ms 清空即回树
let searchTimer: number | null = null;
watch(search, (q) => {
  if (searchTimer !== null) window.clearTimeout(searchTimer);
  if (!q.trim()) {
    searchResults.value = null;
    return;
  }
  searchTimer = window.setTimeout(async () => {
    const cwd = workspace.selectedCwd;
    if (!cwd || !search.value.trim()) return;
    try {
      const res = await fetch(`/api/file-index?cwd=${encodeURIComponent(cwd)}&q=${encodeURIComponent(search.value.trim())}`);
      if (!res.ok) return;
      searchResults.value = await res.json() as FileIndexResponse;
    } catch {
      // 搜索失败静默 保留树
    }
  }, 300);
});

// cwd 切换重置树与搜索 状态不跨项目
watch(() => workspace.selectedCwd, () => {
  rootNodes.value = [];
  expandedPaths.value = new Set();
  searchResults.value = null;
  search.value = "";
  if (workspace.selectedCwd) void loadRoot();
}, { immediate: true });

onBeforeUnmount(() => {
  if (searchTimer !== null) window.clearTimeout(searchTimer);
});
</script>
