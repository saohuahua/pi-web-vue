<template>
  <div
    class="layout"
    :class="{ 'sidebar-open': ui.sidebarDrawerOpen, 'sidebar-collapsed': ui.sidebarCollapsed }"
    :style="{ '--sidebar-w': `${ui.sidebarWidth}px`, '--viewer-w': `${ui.viewerWidth}px` }"
  >
    <SessionSidebar @navigate="ui.closeSidebarDrawer" />
    <main class="main">
      <NuxtPage />
    </main>
    <!-- defineAsyncComponent 按需加载 chunk everOpened 门控确保首屏不拉取 markdown 高亮与能力中心的代码 -->
    <FileViewer v-if="viewer.everOpened" />
    <CapabilityCenterModal v-if="center.everOpened" />
    <!-- 窄屏开关 打开后点遮罩关闭 -->
    <button
      v-if="!isSessionRoute"
      class="sidebar-toggle"
      type="button"
      aria-label="会话列表"
      @click="ui.toggleSidebar"
    >
      <BrandMark variant="mobile" />
    </button>
    <button
      v-if="ui.sidebarDrawerOpen"
      class="sidebar-scrim"
      type="button"
      aria-label="关闭会话列表"
      @click="ui.closeSidebarDrawer"
    ></button>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from "vue";
import SessionSidebar from "~/components/SessionSidebar.vue";
import BrandMark from "~/components/BrandMark.vue";
import { useCapabilityCenterStore } from "~/stores/capability-center";
import { useFileViewerStore } from "~/stores/file-viewer";
import { useSettingsStore } from "~/stores/settings";
import { useUiStore } from "~/stores/ui";

// 不用 Lazy 前缀自动导入 子目录组件的注册名带路径前缀 拼错会静默渲染为空
// 显式异步导入把 FileViewer 与能力中心拆出首屏 chunk
const FileViewer = defineAsyncComponent(() => import("~/components/FileViewer.vue"));
const CapabilityCenterModal = defineAsyncComponent(
  () => import("~/components/capabilities/CapabilityCenterModal.vue"),
);

// 两栏布局壳 左 280px 固定 右侧自适应
// 窄屏下侧栏变抽屉 由浮动按钮开关 桌面下可整栏收起
const ui = useUiStore();
const settings = useSettingsStore();
const viewer = useFileViewerStore();
const center = useCapabilityCenterStore();
const route = useRoute();
const isSessionRoute = computed(() => route.path.startsWith("/session/"));

// 主题与偏好尽早初始化 避免闪白
onMounted(() => {
  settings.init();
  ui.restoreLayout();
});
</script>
