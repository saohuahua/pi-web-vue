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

      <!-- md 预览模式切换 仅 md 文件显示 按 tab 记忆 -->
      <div v-if="isMarkdown" class="file-mode-switch" role="tablist" aria-label="预览模式">
        <button
          v-for="mode in VIEW_MODES"
          :key="mode.value"
          class="file-mode-button"
          :class="{ active: activeMode === mode.value }"
          type="button"
          role="tab"
          :aria-selected="activeMode === mode.value"
          @click="setMode(mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <div class="file-viewer-body" @click="onBodyClick">
      <p v-if="state.loading" class="file-viewer-note">加载中…</p>
      <p v-else-if="state.error" class="file-viewer-note file-viewer-error">{{ state.error }}</p>
      <img v-else-if="isImage" class="file-viewer-image" :src="fileApiUrl" :alt="fileName" />
      <template v-else-if="isMarkdown && activeMode === 'preview'">
        <p v-if="state.text?.truncated" class="file-viewer-note">
          文件超过 256KB 已截断显示 完整内容请让 agent 读取
        </p>
        <!-- frontmatter 元数据以键值卡片形式前置 剥离出正文避免渲染成主题分隔线噪音 -->
        <dl v-if="frontmatter" class="markdown-frontmatter">
          <template v-for="entry in frontmatter.entries" :key="entry.key">
            <dt>{{ entry.key }}</dt>
            <dd>{{ entry.value }}</dd>
          </template>
        </dl>
        <!-- 渲染内容由 v-html 输出 点击行为靠 body 根上的事件委托统一处理 -->
        <div
          class="markdown-body markdown-file-preview file-viewer-markdown"
          v-html="markdownHtml"
        ></div>
      </template>
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
import { extractFrontmatter, renderMarkdown } from "~/utils/markdown";
import { handleMarkdownClick } from "~/utils/markdown-interaction";
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
const MARKDOWN_EXTS = new Set(["md", "markdown"]);

type MarkdownViewMode = "preview" | "source";

const VIEW_MODES: { value: MarkdownViewMode; label: string }[] = [
  { value: "preview", label: "预览" },
  { value: "source", label: "源码" },
];

// md 文件的显示模式按 tab 记忆 组件销毁即丢弃
const viewModes = reactive<Record<string, MarkdownViewMode>>({});

const activePath = computed(() => viewer.activePath ?? "");
const fileName = computed(() => (activePath.value ? getFileName(activePath.value) : ""));
const isImage = computed(() => IMAGE_EXTS.has(fileName.value.toLowerCase().split(".").pop() ?? ""));
const isMarkdown = computed(() =>
  MARKDOWN_EXTS.has(fileName.value.toLowerCase().split(".").pop() ?? ""),
);
const activeMode = computed<MarkdownViewMode>(
  () => (activePath.value ? viewModes[activePath.value] : undefined) ?? "preview",
);
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

// frontmatter 只在 md 预览时剥离 解析失败返回 null 整体按正文渲染
const frontmatter = computed(() =>
  isMarkdown.value && state.text ? extractFrontmatter(state.text.content) : null,
);
const markdownHtml = computed(() => {
  if (!state.text || !activePath.value) return "";
  const content = frontmatter.value ? frontmatter.value.body : state.text.content;
  return renderMarkdown(content, { filePath: activePath.value });
});

const setMode = (mode: MarkdownViewMode) => {
  if (activePath.value) viewModes[activePath.value] = mode;
};

const onBodyClick = (event: MouseEvent) =>
  handleMarkdownClick(event, { onOpenFile: (path) => viewer.open(path) });

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
