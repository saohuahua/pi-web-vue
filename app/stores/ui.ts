import { defineStore } from "pinia";
import { ref } from "vue";

// 界面开关 侧栏收起 运行信息与配置抽屉 顶栏与布局壳都要读写 放 store
export const useUiStore = defineStore("ui", () => {
  const sidebarCollapsed = ref(false);
  const runtimeInfoOpen = ref(false);
  const settingsOpen = ref(false);
  // 配置抽屉的初始页签 侧栏三个入口分别直达
  const settingsTab = ref<"models" | "skills" | "settings">("models");

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function openSettings(tab: "models" | "skills" | "settings") {
    settingsTab.value = tab;
    settingsOpen.value = true;
  }

  return { sidebarCollapsed, runtimeInfoOpen, settingsOpen, settingsTab, toggleSidebar, openSettings };
});
