import { defineStore } from "pinia";
import { ref } from "vue";

// 文件查看器 store 文件树在侧栏 查看器在主区域右侧 跨组件状态放 store
export const useFileViewerStore = defineStore("fileViewer", () => {
  const currentPath = ref<string | null>(null);

  function open(path: string) {
    currentPath.value = path;
  }

  function close() {
    currentPath.value = null;
  }

  return { currentPath, open, close };
});
