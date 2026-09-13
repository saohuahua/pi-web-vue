import { defineStore } from "pinia";
import { ref } from "vue";

export const capabilityTabs = [
  "general",
  "prompts",
  "models",
  "skills",
  "extensions",
  "mcp",
] as const;
export type CapabilityTab = (typeof capabilityTabs)[number];

// 能力中心只保存界面状态 资源数据继续归各自 store
export const useCapabilityCenterStore = defineStore("capability-center", () => {
  const open = ref(false);
  const activeTab = ref<CapabilityTab>("general");
  const dirty = ref(false);

  function show(tab: CapabilityTab = "general") {
    activeTab.value = tab;
    open.value = true;
  }

  function hide() {
    open.value = false;
    dirty.value = false;
  }

  function setDirty(value: boolean) {
    dirty.value = value;
  }

  return { open, activeTab, dirty, show, hide, setDirty };
});
