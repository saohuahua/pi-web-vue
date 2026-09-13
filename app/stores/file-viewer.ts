import { defineStore } from "pinia";
import { computed, ref } from "vue";

// 文件查看器保存多个标签 当前文件只由 activePath 决定
export const useFileViewerStore = defineStore("fileViewer", () => {
  const tabs = ref<string[]>([]);
  const activePath = ref<string | null>(null);
  const currentPath = computed(() => activePath.value);

  function open(path: string) {
    if (!tabs.value.includes(path)) tabs.value.push(path);
    activePath.value = path;
  }

  function activate(path: string) {
    if (tabs.value.includes(path)) activePath.value = path;
  }

  function close(path = activePath.value) {
    if (!path) return;
    const index = tabs.value.indexOf(path);
    if (index < 0) return;
    tabs.value.splice(index, 1);
    if (activePath.value === path) activePath.value = tabs.value[index] ?? tabs.value[index - 1] ?? null;
  }

  function closeAll() {
    tabs.value = [];
    activePath.value = null;
  }

  return { tabs, activePath, currentPath, open, activate, close, closeAll };
});
