import { defineStore } from "pinia";
import { computed, ref } from "vue";

// 文件查看器保存多个标签 当前文件只由 activePath 决定
export const useFileViewerStore = defineStore("fileViewer", () => {
  const tabs = ref<string[]>([]);
  const activePath = ref<string | null>(null);
  const currentPath = computed(() => activePath.value);
  // 首开后保持 true 组件据此延迟挂载 chunk 不进首屏 关闭全部标签时保留挂载避免重置预览模式
  const everOpened = ref(false);

  function open(path: string) {
    if (!tabs.value.includes(path)) tabs.value.push(path);
    activePath.value = path;
    everOpened.value = true;
  }

  function activate(path: string) {
    if (tabs.value.includes(path)) activePath.value = path;
  }

  function close(path = activePath.value) {
    if (!path) return;
    const index = tabs.value.indexOf(path);
    if (index < 0) return;
    tabs.value.splice(index, 1);
    if (activePath.value === path)
      activePath.value = tabs.value[index] ?? tabs.value[index - 1] ?? null;
  }

  function closeAll() {
    tabs.value = [];
    activePath.value = null;
  }

  return { tabs, activePath, currentPath, everOpened, open, activate, close, closeAll };
});
