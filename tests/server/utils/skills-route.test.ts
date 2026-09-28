import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixture = vi.hoisted(() => ({ root: "", discovered: [] as { filePath: string }[] }));
vi.mock("#server/utils/skills", () => ({ listSkills: vi.fn(async () => fixture.discovered) }));
vi.mock("#server/utils/file-access", () => ({
  getAllowedFileRoots: async () => new Set([fixture.root]),
  isExistingFilePathAllowed: () => true,
}));
vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@earendil-works/pi-coding-agent")>()),
  getAgentDir: () => fixture.root,
}));

beforeEach(() => {
  fixture.root = mkdtempSync(join(tmpdir(), "pi-skill-route-"));
  fixture.discovered = [];
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(fixture.root, { recursive: true, force: true });
});

async function patch(filePath: string) {
  vi.stubGlobal("readBody", async () => ({
    cwd: fixture.root,
    filePath,
    disableModelInvocation: true,
  }));
  const status = vi.fn();
  vi.stubGlobal("setResponseStatus", status);
  const { default: handler } = await import("#server/api/skills.patch");
  const result = await handler({} as Parameters<typeof handler>[0]);
  return { result, status };
}

describe("技能写入身份", () => {
  it("授权根内普通文件不能被写成技能", async () => {
    const filePath = join(fixture.root, "README.md");
    writeFileSync(filePath, "untouched");
    const { result, status } = await patch(filePath);
    expect(result).toEqual({ error: "Not a discovered skill" });
    expect(status).toHaveBeenCalledWith({}, 403);
    expect(readFileSync(filePath, "utf8")).toBe("untouched");
  });

  it("允许发现结果中的独立 Markdown 技能而非仅限 SKILL.md", async () => {
    const filePath = join(fixture.root, "standalone.md");
    writeFileSync(filePath, "---\nname: standalone\ndescription: test\n---\ncontent", {
      mode: 0o644,
    });
    const originalMode = statSync(filePath).mode;
    fixture.discovered = [{ filePath }];
    const { result } = await patch(filePath);
    expect(result).toEqual({ success: true });
    expect(statSync(filePath).mode).toBe(originalMode);
    expect(readFileSync(filePath, "utf8")).toContain("disable-model-invocation: true");
  });
});
