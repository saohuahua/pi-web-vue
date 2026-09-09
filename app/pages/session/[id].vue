<script setup lang="ts">
import { useChatStore } from "~/stores/chat";
import ChatPanel from "~/components/ChatPanel.vue";

const route = useRoute();
const chat = useChatStore();

// 路由参数变化即切换会话 同页跳转只走 watch 不重建组件
watch(
  () => route.params.id,
  (id) => { if (id) void chat.openSession(String(id)); },
  { immediate: true },
);

// 离开会话页断开 SSE 列表页不需要事件流
onBeforeUnmount(() => chat.close());
</script>

<template>
  <ChatPanel />
</template>
