<template>
  <footer class="composer">
    <div class="composer-box">
      <textarea
        ref="textareaEl"
        v-model="chat.draft"
        class="composer-input"
        rows="1"
        placeholder="给 π agent 发消息…"
        @keydown="onKeydown"
        @input="autosize"
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
        :disabled="!chat.draft.trim()"
        aria-label="发送"
        @click="submit"
      >发送</button>
    </div>
    <p class="composer-hint">Enter 发送 · Shift + Enter 换行 · agent 在本机执行命令</p>
  </footer>
</template>

<script setup lang="ts">
import { useChatStore } from "~/stores/chat";

// 草稿放在 chat store 文件树的 @ 引用要能从外部写入输入框
const chat = useChatStore();
const textareaEl = ref<HTMLTextAreaElement | null>(null);

// 输入框高度自适应内容 上限 200px 超出后内部滚动
function autosize() {
  const el = textareaEl.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

// 草稿被外部写入时也要重新量高
watch(() => chat.draft, () => nextTick(autosize));

async function submit() {
  const text = chat.draft;
  if (!text.trim() || chat.isRunning) return;
  chat.draft = "";
  await nextTick();
  autosize();
  // 提交失败回填草稿 用户输入不能无声消失
  // 用户已另起输入时保留现在的内容
  if (!(await chat.sendPrompt(text)) && !chat.draft) {
    chat.draft = text;
    await nextTick();
    autosize();
  }
}

function onKeydown(e: KeyboardEvent) {
  // Enter 发送 Shift 加 Enter 换行
  // IME 组合中的 Enter 是选字 不是发送 中文输入的关键守卫
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    void submit();
  }
}
</script>
