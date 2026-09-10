<template>
  <footer class="composer">
    <!-- @ 文件补全 与 / 命令 弹层 悬浮在输入框上方 -->
    <div v-if="popup.entries.length" class="composer-popup" role="listbox">
      <div
        v-for="(entry, i) in popup.entries"
        :key="entry.key"
        class="composer-popup-row"
        :class="{ selected: i === popup.index }"
        role="option"
        :aria-selected="i === popup.index"
        @mousedown.prevent="popup.commit(i)"
        @mousemove="popup.index = i"
      >
        <span v-if="popup.kind === 'at'" class="composer-popup-path font-mono">{{ entry.label }}</span>
        <template v-else>
          <span class="font-mono text-accent-deep">/{{ entry.label }}</span>
          <span class="composer-popup-desc">{{ entry.desc }}</span>
          <span class="composer-popup-source">{{ entry.source }}</span>
        </template>
      </div>
      <p v-if="popup.entries.length === 0" class="composer-popup-empty">没有匹配项</p>
    </div>

    <!-- 图片缩略图条 数量上限提示 -->
    <div v-if="chat.attachedImages.length" class="composer-attachments">
      <div v-for="(img, i) in chat.attachedImages" :key="img.previewUrl" class="composer-attachment">
        <img :src="img.previewUrl" alt="待发送图片">
        <button type="button" aria-label="移除图片" @click="removeImage(i)">×</button>
      </div>
      <span class="composer-attachment-count">{{ chat.attachedImages.length }}/{{ MAX_IMAGES }}</span>
    </div>

    <div
      class="composer-box"
      :class="{ 'is-dragover': dragover }"
      @dragover.prevent="dragover = true"
      @dragleave="dragover = false"
      @drop.prevent="onDrop"
    >
      <textarea
        ref="textareaEl"
        v-model="chat.draft"
        class="composer-input"
        rows="1"
        placeholder="给 π agent 发消息… @ 引用文件 / 使用命令"
        @keydown="onKeydown"
        @input="onInput"
        @paste="onPaste"
      ></textarea>
      <!-- 运行中发送变停止 输入保持可用但不提交 -->
      <button
        v-if="chat.isRunning"
        class="composer-btn stop"
        type="button"
        aria-label="停止"
        @click="chat.stop()"
      >停止</button>
      <button
        v-else
        class="composer-btn send"
        type="button"
        :disabled="!canSend"
        aria-label="发送"
        @click="submit"
      >发送</button>
    </div>

    <!-- 工具行 附件 模型 思考等级 context 压缩 -->
    <div class="composer-toolbar">
      <button
        class="composer-tool"
        type="button"
        title="附加图片"
        aria-label="附加图片"
        @click="fileInput?.click()"
      >📎</button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        hidden
        @change="onFileChange"
      >

      <!-- 模型选择 下拉 -->
      <div class="relative">
        <button
          class="composer-tool"
          type="button"
          :title="chat.model ? `${chat.model.provider} / ${chat.model.id}` : '选择模型'"
          @click="modelOpen = !modelOpen"
        >
          <span class="max-w-[140px] truncate font-mono">{{ chat.model?.id ?? "模型" }}</span>
          <span class="text-[9px] text-muted">▾</span>
        </button>
        <div v-if="modelOpen" class="composer-dropdown">
          <p v-if="!models.modelList.length" class="composer-dropdown-empty">
            {{ models.loading ? "加载中…" : (models.modelError || "无可用模型") }}
          </p>
          <button
            v-for="m in models.modelList"
            :key="`${m.provider}:${m.id}`"
            class="composer-dropdown-row"
            :class="{ active: chat.model?.provider === m.provider && chat.model?.id === m.id }"
            type="button"
            :title="`${m.provider} / ${m.id}`"
            @click="chooseModel(m)"
          >
            <span class="truncate">{{ m.name || m.id }}</span>
            <span class="composer-dropdown-provider font-mono">{{ m.provider }}</span>
          </button>
        </div>
      </div>

      <!-- 思考等级 无推理能力的模型整块隐藏 -->
      <div v-if="thinkingLevels.length > 1" class="relative">
        <button
          class="composer-tool"
          type="button"
          title="思考等级"
          @click="thinkingOpen = !thinkingOpen"
        >
          <span class="font-mono">思考·{{ chat.thinkingLevel }}</span>
          <span class="text-[9px] text-muted">▾</span>
        </button>
        <div v-if="thinkingOpen" class="composer-dropdown">
          <button
            v-for="level in thinkingLevels"
            :key="level"
            class="composer-dropdown-row"
            :class="{ active: chat.thinkingLevel === level }"
            type="button"
            @click="chooseThinking(level)"
          >
            <span class="font-mono">{{ level }}</span>
          </button>
        </div>
      </div>

      <span class="flex-1"></span>

      <!-- context 占用 空闲可手动压缩 压缩中可取消 -->
      <span
        v-if="contextPercent !== null"
        class="composer-context font-mono"
        :class="{ warn: contextPercent >= 80 }"
        :title="contextTitle"
      >{{ contextPercent }}%</span>
      <button
        v-if="chat.isCompacting"
        class="composer-tool compacting"
        type="button"
        @click="chat.abortCompaction()"
      >取消压缩</button>
      <button
        v-else-if="contextPercent !== null && !chat.isRunning"
        class="composer-tool"
        type="button"
        title="压缩上下文"
        @click="chat.compact()"
      >压缩</button>
    </div>

    <p class="composer-hint">Enter 发送 · Shift + Enter 换行 · @ 文件 · / 命令 · agent 在本机执行命令</p>

    <!-- 点击外部关闭下拉 -->
    <div v-if="modelOpen || thinkingOpen" class="fixed inset-0 z-30" @click="modelOpen = thinkingOpen = false"></div>
  </footer>
</template>

<script setup lang="ts">
import { useChatStore } from "~/stores/chat";
import { useModelsStore } from "~/stores/models";
import { useWorkspaceStore } from "~/stores/workspace";
import { compressImageFile } from "~/utils/image-compress";
import { buildEntriesFromFiles, extractAtQuery, filterFileEntries, type FileIndexEntry } from "~/utils/at-query";
import { loadInputHistory, pushInputHistory } from "~/utils/input-history";
import { MAX_ATTACHED_IMAGES, getBase64DecodedByteLength } from "#shared/lib/image-attachments";
import type { AttachedImage } from "#shared/lib/types";

// 输入控制面 草稿与附件在 chat store 文件树与失败恢复都要读写
const chat = useChatStore();
const models = useModelsStore();
const workspace = useWorkspaceStore();

const MAX_IMAGES = MAX_ATTACHED_IMAGES;
const textareaEl = ref<HTMLTextAreaElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const dragover = ref(false);
const modelOpen = ref(false);
const thinkingOpen = ref(false);

// ---------- 弹层 @ 与 / ----------

interface PopupEntry {
  key: string;
  label: string;
  desc?: string;
  source?: string;
}

const popup = reactive({
  kind: "at" as "at" | "slash",
  entries: [] as PopupEntry[],
  index: 0,
  commit: (_i: number) => {},
});

// @ 索引按 cwd 拉一次 缓存在组件里 cd 换了就失效
let atIndexFiles: string[] | null = null;
let atIndexCwd: string | null = null;
let atQueryStart = -1;

function closePopup() {
  popup.entries = [];
  popup.index = 0;
  atQueryStart = -1;
}

// 输入变化时判断弹层是否应该出现
function refreshPopup() {
  const ta = textareaEl.value;
  if (!ta) return;
  const before = chat.draft.slice(0, ta.selectionStart ?? chat.draft.length);

  // / 命令只在整段文本以 / 开头时触发 且不能有换行
  const slashMatch = /^\/([^\s/]*)$/.exec(before);
  if (slashMatch) {
    const q = slashMatch[1]!.toLowerCase();
    const commands = chat.slashCommands
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 20);
    popup.kind = "slash";
    popup.entries = commands.map((c) => ({
      key: c.name, label: c.name, desc: c.description, source: c.source,
    }));
    popup.index = 0;
    popup.commit = insertSlash;
    return;
  }

  const atMatch = extractAtQuery(before);
  if (atMatch && workspace.selectedCwd) {
    atQueryStart = atMatch.start;
    const cwd = workspace.selectedCwd;
    // 首次打开拉全量索引 后续按键本地过滤
    const ensureIndex = async () => {
      if (atIndexCwd === cwd && atIndexFiles) return atIndexFiles;
      const res = await fetch(`/api/file-index?cwd=${encodeURIComponent(cwd)}`);
      if (!res.ok) return [];
      const body = await res.json() as { files?: string[] };
      atIndexFiles = body.files ?? [];
      atIndexCwd = cwd;
      return atIndexFiles;
    };
    void ensureIndex().then((files) => {
      // 弹层已被关闭或光标已移走 结果作废
      const current = extractAtQuery(chat.draft.slice(0, textareaEl.value?.selectionStart ?? 0));
      if (!current || current.start !== atMatch.start) return;
      const entries = filterFileEntries(buildEntriesFromFiles(files), atMatch.query);
      popup.kind = "at";
      popup.entries = entries.map((e: FileIndexEntry) => ({ key: e.path, label: e.path + (e.isDir ? "/" : "") }));
      popup.index = 0;
      popup.commit = insertAtPath;
    });
    return;
  }

  closePopup();
}

function insertSlash(i: number) {
  const entry = popup.entries[i];
  closePopup();
  if (!entry) return;
  chat.draft = `/${entry.label} `;
  focusCaret();
}

function insertAtPath(i: number) {
  const entry = popup.entries[i];
  const ta = textareaEl.value;
  if (!entry || !ta || atQueryStart < 0) {
    closePopup();
    return;
  }
  const after = chat.draft.slice(ta.selectionStart ?? chat.draft.length);
  // 含空格的路径用引号形式 否则 token 会被空格截断
  const path = entry.label.replace(/\/$/, "");
  const token = path.includes(" ") ? `@"${path}" ` : `@${path} `;
  chat.draft = chat.draft.slice(0, atQueryStart) + token + after;
  closePopup();
  focusCaret(token.length);
}

function focusCaret(offset = 0) {
  nextTick(() => {
    const ta = textareaEl.value;
    if (!ta) return;
    const pos = chat.draft.length - offset;
    ta.setSelectionRange(pos, pos);
    ta.focus();
  });
}

// ---------- 输入历史 ----------

let history = loadInputHistory();
let historyIndex = -1; // -1 表示不在历史导航中

function navigateHistory(direction: 1 | -1): boolean {
  if (!history.length) return false;
  const ta = textareaEl.value;
  if (direction === -1) {
    // 上翻 仅输入为空或光标在开头时触发
    if (ta && ta.selectionStart !== 0 && chat.draft !== "") return false;
    if (historyIndex === -1) historyIndex = history.length - 1;
    else historyIndex = Math.max(0, historyIndex - 1);
  } else {
    if (ta && ta.selectionStart !== chat.draft.length) return false;
    if (historyIndex === -1) return false;
    historyIndex += 1;
    if (historyIndex >= history.length) {
      historyIndex = -1;
      chat.draft = "";
      return true;
    }
  }
  chat.draft = history[historyIndex] ?? "";
  nextTick(() => {
    const el = textareaEl.value;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  });
  return true;
}

// ---------- 键盘 ----------

function onKeydown(e: KeyboardEvent) {
  // IME 组合中的按键是选字 中文输入的关键守卫
  if (e.isComposing) return;

  // 弹层打开时方向键 Enter Tab Esc 都归弹层
  if (popup.entries.length) {
    if (e.key === "ArrowDown") { e.preventDefault(); popup.index = (popup.index + 1) % popup.entries.length; return; }
    if (e.key === "ArrowUp") { e.preventDefault(); popup.index = (popup.index - 1 + popup.entries.length) % popup.entries.length; return; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); popup.commit(popup.index); return; }
    if (e.key === "Escape") { e.preventDefault(); closePopup(); return; }
  }

  if (e.key === "ArrowUp" && !e.shiftKey) {
    if (navigateHistory(-1)) e.preventDefault();
    return;
  }
  if (e.key === "ArrowDown" && !e.shiftKey) {
    if (navigateHistory(1)) e.preventDefault();
    return;
  }

  // Enter 发送 Shift 加 Enter 换行
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void submit();
  }
}

function onInput() {
  autosize();
  historyIndex = -1;
  refreshPopup();
}

// ---------- 图片附件 ----------

// 当前模型是否支持图片 列表未加载或模型不在列表时默认放行 服务端是兜底线
// SDK 对纯文本模型会静默丢图 必须在前端给可理解的阻止
const currentModelSupportsImages = computed(() => {
  if (!chat.model) return true;
  const entry = models.modelList.find((m) => m.provider === chat.model!.provider && m.id === chat.model!.id);
  if (!entry) return true;
  return entry.input.includes("image");
});

function warnUnsupportedImages(): boolean {
  if (currentModelSupportsImages.value) return false;
  const name = chat.model ? `${chat.model.provider}/${chat.model.id}` : "当前模型";
  chat.notices.push({ id: Date.now(), type: "error", message: `${name} 不支持图片输入 请移除图片或切换模型` });
  return true;
}

async function addImageFiles(files: FileList | File[]) {
  if (warnUnsupportedImages()) return;
  const list = [...files].filter((f) => f.type.startsWith("image/"));
  for (const file of list) {
    if (chat.attachedImages.length >= MAX_IMAGES) {
      chat.notices.push({ id: Date.now(), type: "error", message: `最多附加 ${MAX_IMAGES} 张图片` });
      return;
    }
    try {
      const { data, mimeType } = await compressImageFile(file);
      // 解码后超限的拒绝 前后端同一套边界
      const bytes = getBase64DecodedByteLength(data);
      if (bytes === null || bytes > 10 * 1024 * 1024) {
        chat.notices.push({ id: Date.now(), type: "error", message: `${file.name} 超过 10MB 上限` });
        continue;
      }
      const image: AttachedImage = { data, mimeType, previewUrl: `data:${mimeType};base64,${data}` };
      chat.attachedImages.push(image);
    } catch {
      chat.notices.push({ id: Date.now(), type: "error", message: `${file.name} 读取失败` });
    }
  }
}

function onPaste(e: ClipboardEvent) {
  const files = e.clipboardData?.files;
  if (files?.length) {
    e.preventDefault();
    void addImageFiles(files);
  }
}

function onDrop(e: DragEvent) {
  dragover.value = false;
  const files = e.dataTransfer?.files;
  if (files?.length) void addImageFiles(files);
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) void addImageFiles(input.files);
  // 允许再次选择同一文件
  input.value = "";
}

function removeImage(index: number) {
  chat.attachedImages.splice(index, 1);
}

// ---------- 发送 ----------

// 输入框高度自适应内容 上限 200px 超出后内部滚动
function autosize() {
  const el = textareaEl.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

// 草稿被外部写入时也要重新量高
watch(() => chat.draft, () => nextTick(autosize));

const canSend = computed(() => Boolean(chat.draft.trim()) || chat.attachedImages.length > 0);

async function submit() {
  const text = chat.draft;
  if (!canSend.value || chat.isRunning) return;
  // 附加后模型可能被切到纯文本模型 发送前再拦一次
  if (chat.attachedImages.length && warnUnsupportedImages()) return;
  closePopup();
  const images = [...chat.attachedImages];
  chat.draft = "";
  chat.attachedImages = [];
  await nextTick();
  autosize();
  // 提交失败回填文字与图片草稿 用户输入不能无声消失
  // 用户已另起输入时保留现在的内容
  if (!(await chat.sendPrompt(text)) && !chat.draft) {
    chat.draft = text;
    chat.attachedImages = images;
    await nextTick();
    autosize();
    return;
  }
  // 成功提交进历史 只存文本
  if (text.trim()) history = pushInputHistory(history, text);
}

// ---------- 模型与思考等级 ----------

// 模型列表跟随工作区 cwd 换项目即换配置
watch(() => workspace.selectedCwd, (cwd) => {
  void models.load(cwd);
  // 索引缓存同时失效
  atIndexFiles = null;
  atIndexCwd = null;
}, { immediate: true });

const thinkingLevels = computed(() => {
  if (!chat.model) return [];
  const levels = models.thinkingLevels[`${chat.model.provider}:${chat.model.id}`];
  // 模型不在列表里时用常见档位兜底 具体可用性由服务端 set 命令裁决
  return levels ?? ["off", "low", "medium", "high"];
});

async function chooseModel(m: { id: string; provider: string }) {
  modelOpen.value = false;
  await chat.setModel(m.provider, m.id);
}

async function chooseThinking(level: string) {
  thinkingOpen.value = false;
  await chat.setThinkingLevel(level);
}

// ---------- context 占用 ----------

const contextPercent = computed(() =>
  chat.contextUsage?.percent !== null && chat.contextUsage?.percent !== undefined
    ? Math.round(chat.contextUsage.percent)
    : null,
);
const contextTitle = computed(() => {
  const usage = chat.contextUsage;
  if (!usage) return "";
  const tokensK = usage.tokens !== null ? `${Math.round(usage.tokens / 1000)}k` : "?";
  const windowK = Math.round(usage.contextWindow / 1000);
  return `上下文 ${tokensK} / ${windowK}k tokens`;
});
</script>
