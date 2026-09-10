import { defineStore } from "pinia";

// 应用偏好 不触及凭证 持久化到浏览器
// 主题 auto 跟随系统 浅色 深色三档
export const useSettingsStore = defineStore("settings", () => {
  const theme = ref<"auto" | "light" | "dark">("auto");
  const completionSound = ref(false);

  const STORAGE_KEY = "pi-agent:settings";

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: theme.value,
      completionSound: completionSound.value,
    }));
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { theme?: unknown; completionSound?: unknown };
      if (saved.theme === "auto" || saved.theme === "light" || saved.theme === "dark") {
        theme.value = saved.theme;
      }
      if (typeof saved.completionSound === "boolean") {
        completionSound.value = saved.completionSound;
      }
    } catch {
      // 存储损坏用默认值
    }
  }

  // auto 模式跟随系统颜色方案 系统切换时立即生效
  let mediaQuery: MediaQueryList | null = null;
  function applyTheme() {
    const prefersDark = mediaQuery?.matches ?? window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = theme.value === "dark" || (theme.value === "auto" && prefersDark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }

  function init() {
    restore();
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", applyTheme);
    applyTheme();
  }

  function setTheme(value: "auto" | "light" | "dark") {
    theme.value = value;
    persist();
    applyTheme();
  }

  function setCompletionSound(enabled: boolean) {
    completionSound.value = enabled;
    persist();
  }

  return { theme, completionSound, init, setTheme, setCompletionSound };
});
