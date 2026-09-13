import { getAllowedFileRoots, isExistingFilePathAllowed } from "../../utils/file-access";
import { readPlugins } from "../../utils/plugins";

// GET 只做静态解析与统计 不会执行任何包内代码
export default defineEventHandler(async (event) => {
  try {
    const cwd = getQuery(event).cwd;
    if (typeof cwd !== "string" || !cwd) {
      setResponseStatus(event, 400);
      return { error: "cwd is required" };
    }
    if (!isExistingFilePathAllowed(cwd, await getAllowedFileRoots())) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }
    return await readPlugins(cwd);
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
