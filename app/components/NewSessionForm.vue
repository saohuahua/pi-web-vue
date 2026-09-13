<template>
  <form class="new-session-form" @submit.prevent="submit">
    <span class="form-label">工作目录</span>
    <PiInput
      id="new-session-cwd"
      v-model="cwd"
      type="text"
      label="工作目录"
      placeholder="D:\project\demo"
      spellcheck="false"
      autocomplete="off"
    />
    <p v-if="error" class="form-error">{{ error }}</p>
    <PiButton type="submit" variant="primary" :disabled="!cwd.trim()" :loading="submitting">
      {{ submitting ? "创建中…" : "开始会话" }}
    </PiButton>
  </form>
</template>

<script setup lang="ts">
import { useChatStore } from "~/stores/chat";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiInput from "~/components/pi/PiInput/index.vue";

// 新会话表单 侧栏与首页共用
// 只收 cwd 不收首条消息 首条 prompt 必须等 SSE 建连后单独发
const chat = useChatStore();
const emit = defineEmits<{ created: [] }>();

const LAST_CWD_KEY = "pi-agent:last-cwd";
const cwd = ref("");
const submitting = ref(false);
const error = ref("");

// 记住上次用的 cwd 下次新建直接带上
onMounted(() => {
  cwd.value = localStorage.getItem(LAST_CWD_KEY) ?? "";
});

const submit = async () => {
  const value = cwd.value.trim();
  if (!value || submitting.value) return;
  submitting.value = true;
  error.value = "";
  try {
    await chat.newSession(value);
    localStorage.setItem(LAST_CWD_KEY, value);
    emit("created");
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    submitting.value = false;
  }
};
</script>
