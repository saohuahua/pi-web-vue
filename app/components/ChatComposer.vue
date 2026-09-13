<template>
  <footer class="composer">
    <!-- @ 文件补全与 / 命令共用一个弹层 悬浮在输入框上方 打开时键盘事件优先归它 -->
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
        <span v-if="popup.kind === 'at'" class="composer-popup-path font-mono">{{
          entry.label
        }}</span>
        <template v-else>
          <span class="font-mono text-accent-deep">/{{ entry.label }}</span>
          <span class="composer-popup-desc">{{ entry.desc }}</span>
          <span class="composer-popup-source">{{ entry.source }}</span>
        </template>
      </div>
      <p v-if="popup.entries.length === 0" class="composer-popup-empty">没有匹配项</p>
    </div>

    <!-- 已选图片缩略图条 可逐个移除 右侧是数量上限提示 -->
    <div v-if="chat.attachedImages.length" class="composer-attachments">
      <div
        v-for="(img, i) in chat.attachedImages"
        :key="img.previewUrl"
        class="composer-attachment"
      >
        <img :src="img.previewUrl" alt="待发送图片" />
        <button type="button" aria-label="移除图片" @click="removeImage(i)">
          <X :size="12" aria-hidden="true" />
        </button>
      </div>
      <span class="composer-attachment-count"
        >{{ chat.attachedImages.length }}/{{ maxImages }}</span
      >
    </div>

    <!-- 输入区 拖拽进图 发送与停止按运行状态互斥 -->
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
        aria-label="消息内容"
        placeholder="输入问题、任务或 @ 引用文件"
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
        title="停止生成"
        @click="chat.stop()"
      >
        <Square :size="14" fill="currentColor" aria-hidden="true" />
      </button>
      <button
        v-else
        class="composer-btn send"
        type="button"
        :disabled="!canSend"
        aria-label="发送"
        title="发送"
        @click="submit"
      >
        <CircleArrowUp :size="19" :stroke-width="2.2" aria-hidden="true" />
      </button>
    </div>

    <!-- 工具行 附件 模型 思考等级 快捷提示词 context 压缩 -->
    <div class="composer-toolbar" :class="{ 'menu-open': quickPromptsOpen }">
      <!-- 附件按钮 点击转发给隐藏的 file input -->
      <button
        class="composer-tool"
        type="button"
        title="附加图片"
        aria-label="附加图片"
        @click="fileInput?.click()"
      >
        <Paperclip :size="15" aria-hidden="true" />
      </button>
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFileChange" />

      <!-- 模型选择 下拉 -->
      <PiPopover v-model:open="modelOpen" label="选择模型" placement="top-start">
        <template #trigger="{ toggle }">
          <button
            class="composer-tool"
            type="button"
            :title="modelTitle"
            :aria-label="`选择模型 ${modelLabel}`"
            @click="toggle"
          >
            <span class="max-w-[140px] truncate font-mono">{{ modelLabel }}</span>
            <ChevronDown :size="13" class="text-muted" aria-hidden="true" />
          </button>
        </template>

        <div class="composer-dropdown">
          <p v-if="!models.modelList.length" class="composer-dropdown-empty">
            {{ models.loading ? "加载中…" : models.modelError || "无可用模型" }}
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
      </PiPopover>

      <!-- 思考等级 无推理能力的模型整块隐藏 -->
      <div v-if="thinkingLevels.length > 1" class="composer-menu-control">
        <button
          class="composer-tool"
          type="button"
          title="思考等级"
          aria-label="选择思考等级"
          @click="thinkingOpen = !thinkingOpen"
        >
          <span class="font-mono">思考·{{ chat.thinkingLevel }}</span>
          <ChevronDown :size="13" class="text-muted" aria-hidden="true" />
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

      <!-- 快捷提示词菜单 从设置里读 用户可自行管理 -->
      <div class="composer-quick-popover">
        <PiPopover
          v-model:open="quickPromptsOpen"
          label="快捷提示词"
          placement="top-end"
          role="menu"
        >
          <template #trigger="{ toggle }">
            <button
              class="composer-tool"
              type="button"
              title="快捷提示词"
              aria-label="快捷提示词"
              :aria-expanded="quickPromptsOpen"
              @click="toggle"
            >
              <Zap :size="14" aria-hidden="true" />
              <span>快捷提问</span>
              <ChevronDown :size="13" class="text-muted" aria-hidden="true" />
            </button>
          </template>
          <div class="composer-quick-prompts">
            <button
              v-for="prompt in settings.quickPrompts"
              :key="prompt.id"
              class="composer-quick-prompt"
              type="button"
              role="menuitem"
              @click="insertQuickPrompt(prompt.prompt)"
            >
              <span>{{ prompt.label || "未命名提示词" }}</span>
              <small>{{ prompt.prompt }}</small>
            </button>
            <p v-if="!settings.quickPrompts.length" class="composer-quick-empty">暂无快捷提示词</p>
            <button
              class="composer-quick-manage"
              type="button"
              role="menuitem"
              @click="openQuickPromptSettings"
            >
              <Settings2 :size="14" aria-hidden="true" />管理提示词
            </button>
          </div>
        </PiPopover>
      </div>

      <!-- 弹性占位 把 context 显示推到行尾 -->
      <span class="flex-1"></span>

      <!-- context 占用 空闲可手动压缩 压缩中可取消 -->
      <span
        v-if="contextPercent !== null"
        class="composer-context font-mono"
        :class="{ warn: contextPercent >= 80 }"
        :title="contextTitle"
      >
        {{ contextPercent }}%
      </span>
      <button
        v-if="chat.isCompacting"
        class="composer-tool compacting"
        type="button"
        @click="chat.abortCompaction()"
      >
        取消压缩
      </button>
      <button
        v-else-if="contextPercent !== null && !chat.isRunning"
        class="composer-tool"
        type="button"
        title="压缩上下文"
        @click="chat.compact()"
      >
        压缩
      </button>
    </div>

    <!-- 透明遮罩 点击输入区外关闭所有下拉 -->
    <div v-if="thinkingOpen" class="fixed inset-0 z-30" @click="thinkingOpen = false"></div>
  </footer>
</template>

<script setup lang="ts">
import { ChevronDown, CircleArrowUp, Paperclip, Settings2, Square, X, Zap } from "lucide-vue-next";
import { useComposerImages } from "~/composables/useComposerImages";
import PiPopover from "~/components/pi/PiPopover/index.vue";
import { useCapabilityCenterStore } from "~/stores/capability-center";
import { useChatStore } from "~/stores/chat";
import { useModelsStore } from "~/stores/models";
import { useSettingsStore } from "~/stores/settings";
import { useWorkspaceStore } from "~/stores/workspace";
import {
  buildEntriesFromFiles,
  extractAtQuery,
  filterFileEntries,
  type FileIndexEntry,
} from "~/utils/at-query";
import { loadInputHistory, pushInputHistory } from "~/utils/input-history";

// 输入控制面 草稿与附件在 chat store 文件树与失败恢复都要读写
const chat = useChatStore();
const center = useCapabilityCenterStore();
const models = useModelsStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();

const textareaEl = ref<HTMLTextAreaElement | null>(null);
const modelOpen = ref(false);
const thinkingOpen = ref(false);
const quickPromptsOpen = ref(false);

// 图片附件的选取 校验 拦截独立成 composable 这里只取行为
const {
  maxImages,
  fileInput,
  dragover,
  warnUnsupportedImages,
  onPaste,
  onDrop,
  onFileChange,
  removeImage,
} = useComposerImages();

// @ 与 / 共用一个弹层状态 commit 在刷新时按 kind 重绑
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

// 输入历史本地持久化 historyIndex 为 -1 表示不在历史导航中
let history = loadInputHistory();
let historyIndex = -1;

// 弹层条目 @ 是文件路径 slash 是命令 两者共用一套渲染
interface PopupEntry {
  key: string;
  label: string;
  desc?: string;
  source?: string;
}

const canSend = computed(() => Boolean(chat.draft.trim()) || chat.attachedImages.length > 0);

// 模型不在列表里时用常见档位兜底 具体可用性由服务端 set 命令裁决
const thinkingLevels = computed(() => {
  if (!chat.model) return [];
  const levels = models.thinkingLevels[`${chat.model.provider}:${chat.model.id}`];
  return levels ?? ["off", "low", "medium", "high"];
});

const modelLabel = computed(() => {
  const id = chat.model?.id;
  return id && id !== "unknown" ? id : "模型";
});

const modelTitle = computed(() => {
  if (!chat.model || chat.model.id === "unknown") return "选择模型";
  return `${chat.model.provider} / ${chat.model.id}`;
});

// context 占用百分比 无数据时为 null 对应 UI 整块隐藏
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

const closePopup = () => {
  popup.entries = [];
  popup.index = 0;
  atQueryStart = -1;
};

// 输入变化时判断弹层是否该出现 以及出现哪一种
const refreshPopup = () => {
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

    // 命中命令 弹层切到命令模式 commit 重绑到命令插入
    popup.kind = "slash";
    popup.entries = commands.map((c) => ({
      key: c.name,
      label: c.name,
      desc: c.description,
      source: c.source,
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
      const body = (await res.json()) as { files?: string[] };
      atIndexFiles = body.files ?? [];
      atIndexCwd = cwd;
      return atIndexFiles;
    };

    void ensureIndex().then((files) => {
      // 弹层已被关闭或光标已移走 结果作废
      const current = extractAtQuery(chat.draft.slice(0, textareaEl.value?.selectionStart ?? 0));
      if (!current || current.start !== atMatch.start) return;

      // 结果仍有效 回填文件条目 commit 重绑到路径插入
      const entries = filterFileEntries(buildEntriesFromFiles(files), atMatch.query);
      popup.kind = "at";
      popup.entries = entries.map((e: FileIndexEntry) => ({
        key: e.path,
        label: e.path + (e.isDir ? "/" : ""),
      }));
      popup.index = 0;
      popup.commit = insertAtPath;
    });
    return;
  }

  closePopup();
};

const insertSlash = (i: number) => {
  const entry = popup.entries[i];
  closePopup();
  if (!entry) return;
  chat.draft = `/${entry.label} `;
  focusCaret();
};

const insertAtPath = (i: number) => {
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
};

// 插入 token 后把光标放回草稿末尾偏移处 让用户能紧接着输入
const focusCaret = (offset = 0) => {
  nextTick(() => {
    const ta = textareaEl.value;
    if (!ta) return;
    const pos = chat.draft.length - offset;
    ta.setSelectionRange(pos, pos);
    ta.focus();
  });
};

const insertQuickPrompt = (prompt: string) => {
  const text = prompt.trim();
  if (!text) return;
  const separator = chat.draft.trim() && !chat.draft.endsWith("\n") ? "\n" : "";
  chat.draft = `${chat.draft}${separator}${text}`;
  quickPromptsOpen.value = false;
  nextTick(() => {
    autosize();
    focusCaret();
  });
};

const openQuickPromptSettings = () => {
  quickPromptsOpen.value = false;
  center.show("prompts");
};

// 上下翻取历史条目 返回是否消费了这次按键
const navigateHistory = (direction: 1 | -1): boolean => {
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
    // 翻过头回到未导航态 草稿清空
    if (historyIndex >= history.length) {
      historyIndex = -1;
      chat.draft = "";
      return true;
    }
  }

  chat.draft = history[historyIndex] ?? "";

  // 草稿是整体替换 光标打回末尾
  nextTick(() => {
    const el = textareaEl.value;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  });
  return true;
};

// 输入框高度自适应内容 上限 200px 超出后内部滚动
const autosize = () => {
  const el = textareaEl.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
};

const onKeydown = (e: KeyboardEvent) => {
  // IME 组合中的按键是选字 中文输入的关键守卫
  if (e.isComposing) return;

  // 弹层打开时方向键 Enter Tab Esc 都归弹层
  if (popup.entries.length) {
    // 下移选中项 循环到底
    if (e.key === "ArrowDown") {
      e.preventDefault();
      popup.index = (popup.index + 1) % popup.entries.length;
      return;
    }

    // 上移选中项 循环到头
    if (e.key === "ArrowUp") {
      e.preventDefault();
      popup.index = (popup.index - 1 + popup.entries.length) % popup.entries.length;
      return;
    }

    // 选中当前项
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      popup.commit(popup.index);
      return;
    }

    // 关闭弹层
    if (e.key === "Escape") {
      e.preventDefault();
      closePopup();
      return;
    }
  }

  // 方向键上下翻输入历史
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
};

const onInput = () => {
  autosize();
  historyIndex = -1;
  refreshPopup();
};

// 发送当前草稿 失败回填输入 成功进输入历史
const submit = async () => {
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
};

const chooseModel = async (m: { id: string; provider: string }) => {
  modelOpen.value = false;
  await chat.setModel(m.provider, m.id);
};

const chooseThinking = async (level: string) => {
  thinkingOpen.value = false;
  await chat.setThinkingLevel(level);
};

// 草稿被外部写入时也要重新量高
watch(
  () => chat.draft,
  () => nextTick(autosize),
);

// 模型列表跟随工作区 cwd 换项目即换配置 @ 索引缓存同时失效
watch(
  () => workspace.selectedCwd,
  (cwd) => {
    void models.load(cwd);
    atIndexFiles = null;
    atIndexCwd = null;
  },
  { immediate: true },
);
</script>
