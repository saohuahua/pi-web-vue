<template>
  <aside v-if="viewer.tabs.length" class="file-viewer" aria-label="文件预览">
    <PaneResizeHandle
      edge="left"
      :value="ui.viewerWidth"
      :min="360"
      :max="720"
      @update:value="ui.setViewerWidth"
    />
    <header class="file-viewer-tabs">
      <div class="file-tab-list" role="tablist" aria-label="已打开文件">
        <div v-for="path in viewer.tabs" :key="path" class="file-tab-wrap">
          <button
            class="file-tab"
            :class="{ active: path === viewer.activePath }"
            type="button"
            role="tab"
            :aria-selected="path === viewer.activePath"
            :title="path"
            @click="viewer.activate(path)"
          >
            <FileKindIcon :name="getFileName(path)" :size="13" />
            <span>{{ getFileName(path) }}</span>
          </button>
          <button
            class="file-tab-close"
            type="button"
            :aria-label="`关闭 ${getFileName(path)}`"
            @click="viewer.close(path)"
          >
            <X :size="13" aria-hidden="true" />
          </button>
        </div>
      </div>
      <button
        class="file-viewer-close-all"
        type="button"
        title="关闭全部文件"
        aria-label="关闭全部文件"
        @click="viewer.closeAll()"
      >
        <PanelRightClose :size="16" aria-hidden="true" />
      </button>
    </header>

    <div class="file-viewer-toolbar">
      <span class="file-viewer-path" :title="activePath">{{ activePath }}</span>
      <span class="file-viewer-meta">{{ metaLabel }}</span>
    </div>

    <div class="file-viewer-body">
      <p v-if="state.loading" class="file-viewer-note">加载中…</p>
      <p v-else-if="state.error" class="file-viewer-note file-viewer-error">{{ state.error }}</p>
      <img v-else-if="isImage" class="file-viewer-image" :src="fileApiUrl" :alt="fileName" />
      <template v-else-if="state.text">
        <p v-if="state.text.truncated" class="file-viewer-note">
          文件超过 256KB 已截断显示 完整内容请让 agent 读取
        </p>
        <div class="file-code-viewer">
          <ol class="file-line-numbers" aria-hidden="true">
            <li v-for="line in lineCount" :key="line"></li>
          </ol>
          <pre class="file-viewer-code"><code class="hljs" v-html="highlightedText"></code></pre>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { PanelRightClose, X } from "lucide-vue-next";
import FileKindIcon from "~/components/FileKindIcon.vue";
import PaneResizeHandle from "~/components/PaneResizeHandle.vue";
import { useFileViewerStore } from "~/stores/file-viewer";
import { useUiStore } from "~/stores/ui";
import { highlightFile } from "~/utils/file-highlight";
import { encodeFilePathForApi, getFileName } from "#shared/lib/file-paths";
import type { FileTextContent } from "#shared/lib/types";

const viewer = useFileViewerStore();
const ui = useUiStore();
const state = reactive<{ loading: boolean; error: string; text: FileTextContent | null }>({
  loading: false,
  error: "",
  text: null,
});

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);
const activePath = computed(() => viewer.activePath ?? "");
const fileName = computed(() => (activePath.value ? getFileName(activePath.value) : ""));
const isImage = computed(() => IMAGE_EXTS.has(fileName.value.toLowerCase().split(".").pop() ?? ""));
const fileApiUrl = computed(() =>
  activePath.value ? `/api/files/${encodeFilePathForApi(activePath.value)}?type=read` : "",
);
const metaLabel = computed(() => {
  if (state.loading || state.error) return "";
  if (isImage.value) return "图片";
  return state.text?.language ?? "";
});
const lineCount = computed(() =>
  state.text ? Math.max(1, state.text.content.split("\n").length) : 0,
);
const highlightedText = computed(() =>
  state.text ? highlightFile(state.text.content, state.text.language) : "",
);

let loadVersion = 0;

async function load(path: string) {
  const version = ++loadVersion;
  state.loading = true;
  state.error = "";
  state.text = null;
  if (IMAGE_EXTS.has(getFileName(path).toLowerCase().split(".").pop() ?? "")) {
    state.loading = false;
    return;
  }
  try {
    const res = await fetch(`/api/files/${encodeFilePathForApi(path)}?type=read`);
    const body = (await res.json().catch(() => ({}))) as Partial<FileTextContent> & {
      error?: string;
    };
    if (version !== loadVersion) return;
    if (!res.ok || body.error) {
      state.error = body.error ?? `HTTP ${res.status}`;
      return;
    }
    state.text = body.kind === "text" ? (body as FileTextContent) : null;
    if (!state.text) state.error = "暂不支持预览该文件类型";
  } catch (error) {
    if (version === loadVersion)
      state.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (version === loadVersion) state.loading = false;
  }
}

watch(
  activePath,
  (path) => {
    if (path) void load(path);
  },
  { immediate: true },
);
</script>
