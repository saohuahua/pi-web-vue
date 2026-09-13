import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { capabilityTabs, useCapabilityCenterStore } from "~/stores/capability-center";

describe("capability center store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("快捷入口打开指定页面 关闭时清除未保存标记", () => {
    const center = useCapabilityCenterStore();

    center.show("skills");
    center.setDirty(true);

    expect(center.open).toBe(true);
    expect(center.activeTab).toBe("skills");
    expect(center.dirty).toBe(true);

    center.hide();

    expect(center.open).toBe(false);
    expect(center.dirty).toBe(false);
  });

  it("快捷提示词属于能力中心页签而非侧栏入口", () => {
    const center = useCapabilityCenterStore();

    center.show("prompts");

    expect(center.activeTab).toBe("prompts");
    expect(capabilityTabs).toContain("prompts");
  });
});
