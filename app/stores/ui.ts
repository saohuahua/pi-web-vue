import { defineStore } from "pinia";
import { ref } from "vue";

// 界面开关 侧栏收起与运行信息 顶栏和布局壳都要读写 放 store
export const useUiStore = defineStore("ui", () => {
  const sidebarCollapsed = ref(false);
  const sidebarDrawerOpen = ref(false);
  const runtimeInfoOpen = ref(false);
  const sidebarWidth = ref(256);
  const viewerWidth = ref(480);
  const fileExplorerHeight = ref(400);

  const LAYOUT_KEY = "pi-agent:layout";
  const MOBILE_BREAKPOINT = 760;

  // 手机端顶栏菜单必须打开抽屉 桌面端才收起固定侧栏
  const toggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) {
      sidebarDrawerOpen.value = !sidebarDrawerOpen.value;
      return;
    }

    sidebarCollapsed.value = !sidebarCollapsed.value;
  };

  const closeSidebarDrawer = () => {
    sidebarDrawerOpen.value = false;
  };

  const persistLayout = () => {
    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({
        sidebarWidth: sidebarWidth.value,
        viewerWidth: viewerWidth.value,
        fileExplorerHeight: fileExplorerHeight.value,
      }),
    );
  };

  const restoreLayout = () => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        sidebarWidth?: unknown;
        viewerWidth?: unknown;
        fileExplorerHeight?: unknown;
      };
      if (typeof saved.sidebarWidth === "number")
        sidebarWidth.value = Math.max(220, Math.min(420, saved.sidebarWidth));
      if (typeof saved.viewerWidth === "number")
        viewerWidth.value = Math.max(360, Math.min(720, saved.viewerWidth));
      if (typeof saved.fileExplorerHeight === "number")
        fileExplorerHeight.value = Math.max(180, Math.min(640, saved.fileExplorerHeight));
    } catch {
      // 布局缓存损坏时使用默认尺寸
    }
  };

  const setSidebarWidth = (width: number) => {
    sidebarWidth.value = width;
    persistLayout();
  };

  const setViewerWidth = (width: number) => {
    viewerWidth.value = width;
    persistLayout();
  };

  const setFileExplorerHeight = (height: number) => {
    fileExplorerHeight.value = height;
    persistLayout();
  };

  return {
    sidebarCollapsed,
    sidebarDrawerOpen,
    runtimeInfoOpen,
    sidebarWidth,
    viewerWidth,
    fileExplorerHeight,
    toggleSidebar,
    closeSidebarDrawer,
    restoreLayout,
    setSidebarWidth,
    setViewerWidth,
    setFileExplorerHeight,
  };
});
