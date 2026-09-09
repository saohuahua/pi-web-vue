<template>
  <ChatPanel />
</template>

<script setup lang="ts">
import { useChatStore } from "~/stores/chat";
import ChatPanel from "~/components/ChatPanel.vue";

const route = useRoute();
const chat = useChatStore();

// 本实例当前服务的会话 id
// 路由同组件切换时组件销毁重建 卸载时用它做条件关闭
let mySessionId = String(route.params.id ?? "");

watch(
  () => route.params.id,
  (id) => {
    if (id) {
      mySessionId = String(id);
      void chat.openSession(mySessionId);
    }
  },
  { immediate: true },
);

// 离开会话页断开 SSE 只断本实例打开的那个
// 新实例已切到别的会话时什么都不做 防止竞态清掉新会话
onBeforeUnmount(() => chat.closeIfCurrent(mySessionId));
</script>
