import { defineStore } from "pinia";

// 界面开关 侧栏收起与运行信息抽屉 顶栏与布局壳都要读写 放 store
export const useUiStore = defineStore("ui", () => {
  const sidebarCollapsed = ref(false);
  const runtimeInfoOpen = ref(false);

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  return { sidebarCollapsed, runtimeInfoOpen, toggleSidebar };
});
