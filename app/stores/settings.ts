import { defineStore } from "pinia";
import { ref } from "vue";

export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
}

const defaultQuickPrompts = (): QuickPrompt[] => [
  { id: "explain", label: "解释代码", prompt: "请用通俗语言解释这段代码的作用和关键逻辑" },
  { id: "continue", label: "继续展开", prompt: "请继续展开，并补充前面遗漏的关键细节" },
  { id: "next-step", label: "下一步", prompt: "基于当前结论，给出我下一步应该做什么" },
  { id: "review", label: "检查问题", prompt: "检查上面的方案是否有错误前提、风险或遗漏" },
];

// 应用偏好 不触及凭证 持久化到浏览器
// 主题 auto 跟随系统 浅色 深色三档
export const useSettingsStore = defineStore("settings", () => {
  const theme = ref<"auto" | "light" | "dark">("auto");
  const completionSound = ref(false);
  const reduceMotion = ref(false);
  const quickPrompts = ref<QuickPrompt[]>(defaultQuickPrompts());

  const STORAGE_KEY = "pi-agent:settings";

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: theme.value,
      completionSound: completionSound.value,
      reduceMotion: reduceMotion.value,
      quickPrompts: quickPrompts.value,
    }));
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { theme?: unknown; completionSound?: unknown; reduceMotion?: unknown; quickPrompts?: unknown };
      if (saved.theme === "auto" || saved.theme === "light" || saved.theme === "dark") {
        theme.value = saved.theme;
      }
      if (typeof saved.completionSound === "boolean") {
        completionSound.value = saved.completionSound;
      }
      if (typeof saved.reduceMotion === "boolean") {
        reduceMotion.value = saved.reduceMotion;
      }
      if (Array.isArray(saved.quickPrompts)) {
        const prompts = saved.quickPrompts.filter((item): item is QuickPrompt =>
          typeof item === "object" && item !== null
          && typeof (item as QuickPrompt).id === "string"
          && typeof (item as QuickPrompt).label === "string"
          && typeof (item as QuickPrompt).prompt === "string",
        );
        quickPrompts.value = prompts.slice(0, 12);
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

  function applyMotion() {
    document.documentElement.dataset.reduceMotion = reduceMotion.value ? "true" : "false";
  }

  function init() {
    restore();
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", applyTheme);
    applyTheme();
    applyMotion();
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

  function setReduceMotion(enabled: boolean) {
    reduceMotion.value = enabled;
    persist();
    applyMotion();
  }

  function addQuickPrompt() {
    quickPrompts.value = [
      ...quickPrompts.value,
      { id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label: "新提示词", prompt: "请输入提示词内容" },
    ];
    persist();
  }

  function updateQuickPrompt(id: string, patch: Partial<Pick<QuickPrompt, "label" | "prompt">>) {
    quickPrompts.value = quickPrompts.value.map((item) => item.id === id ? { ...item, ...patch } : item);
    persist();
  }

  function removeQuickPrompt(id: string) {
    quickPrompts.value = quickPrompts.value.filter((item) => item.id !== id);
    persist();
  }

  function moveQuickPrompt(id: string, direction: -1 | 1) {
    const index = quickPrompts.value.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= quickPrompts.value.length) return;
    const next = [...quickPrompts.value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    quickPrompts.value = next;
    persist();
  }

  function resetQuickPrompts() {
    quickPrompts.value = defaultQuickPrompts();
    persist();
  }

  return {
    theme, completionSound, reduceMotion, quickPrompts,
    init, setTheme, setCompletionSound, setReduceMotion,
    addQuickPrompt, updateQuickPrompt, removeQuickPrompt, moveQuickPrompt, resetQuickPrompts,
  };
});
