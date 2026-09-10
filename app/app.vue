<template>
  <div class="layout" :class="{ 'sidebar-open': sidebarOpen, 'sidebar-collapsed': ui.sidebarCollapsed }">
    <SessionSidebar @navigate="sidebarOpen = false" />
    <main class="main">
      <NuxtPage />
      <!-- 右侧文件预览 从文件树打开 按需覆盖不挤聊天 -->
      <FileViewer />
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
import FileViewer from "~/components/FileViewer.vue";
import { useUiStore } from "~/stores/ui";

// 两栏布局壳 左 280px 固定 右侧自适应
// 窄屏下侧栏变抽屉 由浮动按钮开关 桌面下可整栏收起
const ui = useUiStore();
const sidebarOpen = ref(false);
</script>
