import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "~/stores/settings";

describe("settings store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal("document", { documentElement: { dataset: {} } });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    });
  });

  it("减少动效立即更新页面标记并持久化", () => {
    const settings = useSettingsStore();
    settings.init();

    settings.setReduceMotion(true);

    expect(settings.reduceMotion).toBe(true);
    expect(document.documentElement.dataset.reduceMotion).toBe("true");
    expect(localStorage.getItem("pi-agent:settings")).toContain("reduceMotion");
  });

  it("快捷提示词编辑后会持久化", () => {
    const settings = useSettingsStore();
    const first = settings.quickPrompts[0];
    expect(first).toBeTruthy();

    settings.updateQuickPrompt(first!.id, { label: "复盘代码", prompt: "请复盘这段代码" });

    expect(settings.quickPrompts[0]).toMatchObject({ label: "复盘代码", prompt: "请复盘这段代码" });
    expect(localStorage.getItem("pi-agent:settings")).toContain("复盘代码");
  });
});
