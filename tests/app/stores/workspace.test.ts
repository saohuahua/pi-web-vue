import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useWorkspaceStore } from "~/stores/workspace";

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe("workspace store 分支状态", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("选择 Git 项目后保留服务端解析的当前分支", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/cwd/validate") {
          return jsonResponse({
            cwd: "D:\\project\\go",
            projectRoot: "D:\\project\\go",
            projectKey: "D:\\project\\go",
          });
        }

        return jsonResponse({
          projectRoot: "D:\\project\\go",
          projectKey: "D:\\project\\go",
          isGit: true,
          isTopLevel: true,
          currentBranch: "feature/workspace",
          currentWorktreePath: "D:\\project\\go",
          worktrees: [],
        });
      }),
    );

    const workspace = useWorkspaceStore();
    const selected = await workspace.selectProject("D:\\project\\go");

    expect(selected).toBe(true);
    expect(workspace.currentBranch).toBe("feature/workspace");
  });
});
