<template>
  <!-- 主区域右侧的文件查看面板 不挤压聊天布局 按需覆盖 -->
  <aside
    v-if="viewer.currentPath"
    class="file-viewer"
    aria-label="文件预览"
  >
    <header class="flex items-center gap-2 border-b border-line px-4 py-2.5">
      <span class="min-w-0 flex-1 truncate font-mono text-[12px] text-ink" :title="viewer.currentPath">
        {{ fileName }}
      </span>
      <span class="shrink-0 text-[11px] text-muted">{{ metaLabel }}</span>
      <button
        class="shrink-0 rounded px-1 text-[15px] leading-none text-muted transition-colors hover:text-ink"
        type="button"
        aria-label="关闭预览"
        @click="viewer.close()"
      >×</button>
    </header>

    <div class="file-viewer-body">
      <p v-if="state.loading" class="file-viewer-note">加载中…</p>
      <p v-else-if="state.error" class="file-viewer-note file-viewer-error">{{ state.error }}</p>

      <!-- 图片直接走白名单流接口 -->
      <img
        v-else-if="isImage"
        class="file-viewer-image"
        :src="fileApiUrl"
        :alt="fileName"
      >

      <!-- 文本截断标记 完整内容交给 agent -->
      <template v-else-if="state.text">
        <p v-if="state.text.truncated" class="file-viewer-note">
          文件超过 256KB 已截断显示 完整内容请让 agent 读取
        </p>
        <pre class="file-viewer-text">{{ state.text.content }}</pre>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useFileViewerStore } from "~/stores/file-viewer";
import { encodeFilePathForApi, getFileName } from "#shared/lib/file-paths";
import type { FileTextContent } from "#shared/lib/types";

// 右侧文件查看器 文本走 JSON 接口 图片走二进制流
const viewer = useFileViewerStore();

const state = reactive<{ loading: boolean; error: string; text: FileTextContent | null }>({
  loading: false,
  error: "",
  text: null,
});

// 扩展名判断图片 与服务端 file-types 同一张映射
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);
const fileName = computed(() => (viewer.currentPath ? getFileName(viewer.currentPath) : ""));
const isImage = computed(() => IMAGE_EXTS.has(fileName.value.toLowerCase().split(".").pop() ?? ""));
const fileApiUrl = computed(() =>
  viewer.currentPath ? `/api/files/${encodeFilePathForApi(viewer.currentPath)}?type=read` : "",
);
const metaLabel = computed(() => {
  if (state.loading || state.error) return "";
  if (isImage.value) return "图片";
  if (state.text) return state.text.language;
  return "";
});

async function load(path: string) {
  state.loading = true;
  state.error = "";
  state.text = null;
  if (isImage.value) {
    // 图片由 <img> 自行请求 这里只负责重置状态
    state.loading = false;
    return;
  }
  try {
    const res = await fetch(fileApiUrl.value);
    const body = await res.json().catch(() => ({})) as (Partial<FileTextContent> & { error?: string });
    if (!res.ok || body.error) {
      state.error = body.error ?? `HTTP ${res.status}`;
      return;
    }
    if (body.kind === "text") {
      state.text = body as FileTextContent;
    } else {
      state.error = "暂不支持预览该文件类型";
    }
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
  } finally {
    state.loading = false;
  }
}

watch(() => viewer.currentPath, (path) => {
  if (path) void load(path);
}, { immediate: true });
</script>
