import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSkills } from "#server/utils/skills";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("静态技能发现", () => {
  it.each([true, false])("保留项目技能且不执行扩展或安装缺失包 trusted=%s", async (trusted) => {
    const root = mkdtempSync(join(tmpdir(), "pi-static-skills-"));
    roots.push(root);
    const agentDir = join(root, "agent");
    const cwd = join(root, "project");
    const bundle = join(agentDir, "bundle");
    const executionMarker = join(root, "extension-executed");
    mkdirSync(join(agentDir, "skills"), { recursive: true });
    mkdirSync(join(bundle, "skills", "packaged"), { recursive: true });
    mkdirSync(join(cwd, ".pi", "skills"), { recursive: true });
    mkdirSync(join(agentDir, "extensions"), { recursive: true });
    writeFileSync(
      join(agentDir, "extensions", "must-not-run.ts"),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(executionMarker)}, "executed"); export default () => {}`,
    );
    writeFileSync(
      join(agentDir, "skills", "standalone.md"),
      "---\nname: standalone\ndescription: standalone test\n---\n# Test",
    );
    writeFileSync(
      join(bundle, "skills", "packaged", "SKILL.md"),
      "---\nname: packaged\ndescription: package test\n---\n# Test",
    );
    writeFileSync(
      join(cwd, ".pi", "skills", "local.md"),
      "---\nname: local\ndescription: project test\n---\n# Test",
    );
    writeFileSync(
      join(bundle, "package.json"),
      JSON.stringify({ name: "fixture-bundle", pi: { skills: ["./skills"] } }),
    );
    writeFileSync(
      join(agentDir, "settings.json"),
      JSON.stringify({
        packages: ["./bundle", "npm:pi-cleanup-missing-fixture-should-never-install"],
      }),
    );
    if (trusted) writeFileSync(join(agentDir, "trust.json"), JSON.stringify({ [cwd]: true }));
    const skills = await listSkills(cwd, agentDir);
    expect(existsSync(executionMarker)).toBe(false);
    expect(skills.map((skill) => skill.name)).toEqual(
      expect.arrayContaining(["standalone", "packaged", "local"]),
    );
    expect(skills.find((skill) => skill.name === "packaged")?.sourceInfo).toEqual(
      expect.objectContaining({ origin: "package", scope: "user" }),
    );
    expect(
      existsSync(
        join(agentDir, "npm", "node_modules", "pi-cleanup-missing-fixture-should-never-install"),
      ),
    ).toBe(false);
  });
});
