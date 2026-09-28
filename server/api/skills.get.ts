import { getAllowedFileRoots, isExistingFilePathAllowed } from "../utils/file-access";
import { listSkills } from "../utils/skills";

// GET /api/skills?cwd=  按 cwd 列出全局与项目技能
// 读取清单不安装包也不执行扩展
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

    return { skills: await listSkills(cwd) };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
