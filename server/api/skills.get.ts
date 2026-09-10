import { DefaultResourceLoader, getAgentDir } from "@earendil-works/pi-coding-agent";
import type { SkillEntry } from "#shared/lib/types";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "../utils/file-access";

// GET /api/skills?cwd=  按 cwd 列出全局与项目技能
// 用 DefaultResourceLoader 与 AgentSession 启动同一套加载逻辑
export default defineEventHandler(async (event) => {
  try {
    const cwd = getQuery(event).cwd;
    if (typeof cwd !== "string" || !cwd) {
      setResponseStatus(event, 400);
      return { error: "cwd is required" };
    }

    const allowedRoots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }

    const agentDir = getAgentDir();
    const loader = new DefaultResourceLoader({ cwd, agentDir });
    await loader.reload();
    const { skills } = loader.getSkills();
    const entries: SkillEntry[] = skills.map((s) => ({
      name: s.name,
      description: s.description,
      filePath: s.filePath,
      baseDir: s.baseDir,
      sourceInfo: s.sourceInfo,
      disableModelInvocation: s.disableModelInvocation,
    }));
    return { skills: entries };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
