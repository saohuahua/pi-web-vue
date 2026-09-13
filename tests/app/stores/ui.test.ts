import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUiStore } from "~/stores/ui";

describe("ui store 布局尺寸", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  it("拖拽后的左右栏尺寸会持久化", () => {
    const ui = useUiStore();
    ui.setSidebarWidth(312);
    ui.setViewerWidth(560);
    ui.setFileExplorerHeight(420);

    expect(ui.sidebarWidth).toBe(312);
    expect(ui.viewerWidth).toBe(560);
    expect(ui.fileExplorerHeight).toBe(420);
    expect(localStorage.getItem("pi-agent:layout")).toContain("312");
  });
});
