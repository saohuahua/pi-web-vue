<template>
  <div class="layout" :class="{ 'sidebar-open': sidebarOpen }">
    <SessionSidebar @navigate="sidebarOpen = false" />
    <main class="main">
      <NuxtPage />
    </main>
    <!-- 窄屏开关 打开后点遮罩关闭 -->
    <button
      class="sidebar-toggle"
      type="button"
      aria-label="会话列表"
      @click="sidebarOpen = !sidebarOpen"
    >π</button>
    <div
      v-if="sidebarOpen"
      class="sidebar-scrim"
      @click="sidebarOpen = false"
    ></div>
  </div>
</template>

<script setup lang="ts">
import SessionSidebar from "~/components/SessionSidebar.vue";

// 两栏布局壳 左 280px 固定 右侧自适应
// 窄屏下侧栏变抽屉 由浮动按钮开关
const sidebarOpen = ref(false);
</script>
