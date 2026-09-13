import { describe, expect, it } from "vitest";
import { projectIdentityKey } from "#server/utils/project-identity";

describe("projectIdentityKey", () => {
  it("Windows 平台归一并大小写折叠 去尾部分隔符", () => {
    expect(projectIdentityKey("D:\\Repo\\Sub\\", "win32")).toBe("d:\\repo\\sub");
    expect(projectIdentityKey("d:/REPO", "win32")).toBe("d:\\repo");
  });

  it("非 Windows 平台保留大小写 只归一分隔符", () => {
    expect(projectIdentityKey("/home/USER/repo/", "linux")).toBe("/home/USER/repo");
    expect(projectIdentityKey("/home/user/repo", "linux")).toBe("/home/user/repo");
  });

  it("盘符根路径不丢分隔符 空串原样返回", () => {
    expect(projectIdentityKey("D:\\", "win32")).toBe("d:\\");
    expect(projectIdentityKey("", "win32")).toBe("");
  });

  it("同一项目不同写法得到同一键 这是分组稳定性的来源", () => {
    expect(projectIdentityKey("D:\\project\\pi-web-vue", "win32"))
      .toBe(projectIdentityKey("d:/project/PI-WEB-VUE\\", "win32"));
  });
});
