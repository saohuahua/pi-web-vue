<template>
  <div
    class="layout"
    :class="{ 'sidebar-open': sidebarOpen, 'sidebar-collapsed': ui.sidebarCollapsed }"
    :style="{ '--sidebar-w': `${ui.sidebarWidth}px`, '--viewer-w': `${ui.viewerWidth}px` }"
  >
    <SessionSidebar @navigate="sidebarOpen = false" />
    <main class="main">
      <NuxtPage />
    </main>
    <FileViewer />
    <CapabilityCenterModal />
    <!-- 窄屏开关 打开后点遮罩关闭 -->
    <button
      class="sidebar-toggle"
      type="button"
      aria-label="会话列表"
      @click="sidebarOpen = !sidebarOpen"
    ><BrandMark variant="mobile" /></button>
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
import BrandMark from "~/components/BrandMark.vue";
import CapabilityCenterModal from "~/components/capabilities/CapabilityCenterModal.vue";
import { useSettingsStore } from "~/stores/settings";
import { useUiStore } from "~/stores/ui";

// 两栏布局壳 左 280px 固定 右侧自适应
// 窄屏下侧栏变抽屉 由浮动按钮开关 桌面下可整栏收起
const ui = useUiStore();
const settings = useSettingsStore();
const sidebarOpen = ref(false);

// 主题与偏好尽早初始化 避免闪白
onMounted(() => {
  settings.init();
  ui.restoreLayout();
});
</script>
