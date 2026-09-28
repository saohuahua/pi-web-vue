import { resolve } from "node:path";
import {
  DefaultPackageManager,
  getAgentDir,
  loadSkills,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { SkillEntry } from "#shared/lib/types";
import { isPathWithinRoots } from "./path-security";

// 仅解析已安装资源 缺失包跳过且不加载扩展代码
export async function listSkills(cwd: string, agentDir = getAgentDir()): Promise<SkillEntry[]> {
  const settingsManager = SettingsManager.create(cwd, agentDir, {
    // 静态查看项目技能不授予扩展执行或安装权限
    projectTrusted: true,
  });
  const manager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
  const resolved = await manager.resolve(async () => "skip");
  const resources = resolved.skills.filter((resource) => resource.enabled);
  const { skills } = loadSkills({
    cwd,
    agentDir,
    skillPaths: resources.map((resource) => resource.path),
    includeDefaults: false,
  });
  return skills.map((skill) => {
    const resource =
      resources.find((entry) => resolve(entry.path) === resolve(skill.filePath)) ??
      resources.find((entry) => isPathWithinRoots(skill.filePath, new Set([entry.path])));
    return {
      ...skill,
      sourceInfo: resource ? { path: skill.filePath, ...resource.metadata } : skill.sourceInfo,
    };
  });
}
