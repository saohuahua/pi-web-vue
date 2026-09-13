import { mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listExtensions } from "#server/utils/extensions";

const roots: string[] = [];

function createRoot() {
  const root = mkdtempSync(join(tmpdir(), "pi-extensions-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("extension registry", () => {
  it("静态发现标准扩展目录 不执行扩展文件", () => {
    const root = createRoot();
    const globalDir = join(root, "extensions");
    const projectDir = join(root, "project", ".pi", "extensions", "bundle");
    mkdirSync(globalDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(globalDir, "audit.ts"), "throw new Error('must not run')");
    writeFileSync(join(projectDir, "package.json"), JSON.stringify({ name: "project-bundle", pi: { extensions: ["./main.ts"] } }));

    const result = listExtensions(join(root, "project"), { agentDir: root, projectTrusted: false });

    expect(result.extensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "audit", scope: "global", kind: "file", status: "ready" }),
      expect.objectContaining({ name: "project-bundle", scope: "project", kind: "package", status: "needs-trust" }),
    ]));
  });

  it("只读 trust 文件不会创建 SDK 锁目录", () => {
    const root = createRoot();
    const project = join(root, "project");
    const extensionDir = join(project, ".pi", "extensions");
    mkdirSync(extensionDir, { recursive: true });
    writeFileSync(join(extensionDir, "project.ts"), "export default () => {}");
    writeFileSync(join(root, "trust.json"), JSON.stringify({ [project]: true }));

    const result = listExtensions(project, { agentDir: root });

    expect(result.projectTrusted).toBe(true);
    expect(result.extensions[0]?.status).toBe("ready");
    expect(() => statSync(join(root, "trust.json.lock"))).toThrow();
  });
});
