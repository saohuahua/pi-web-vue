import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useFileViewerStore } from "./file-viewer";

describe("file viewer store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("打开多个文件后保留标签并切换当前文件", () => {
    const viewer = useFileViewerStore();
    viewer.open("D:\\project\\a.ts");
    viewer.open("D:\\project\\b.ts");
    viewer.activate("D:\\project\\a.ts");

    expect(viewer.tabs).toEqual(["D:\\project\\a.ts", "D:\\project\\b.ts"]);
    expect(viewer.currentPath).toBe("D:\\project\\a.ts");
  });

  it("关闭当前标签时选择相邻文件 关闭全部后清空", () => {
    const viewer = useFileViewerStore();
    viewer.open("D:\\project\\a.ts");
    viewer.open("D:\\project\\b.ts");
    viewer.close("D:\\project\\b.ts");

    expect(viewer.currentPath).toBe("D:\\project\\a.ts");
    viewer.closeAll();
    expect(viewer.tabs).toEqual([]);
    expect(viewer.currentPath).toBeNull();
  });
});
