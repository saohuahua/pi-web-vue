import { getAllowedFileRoots, isExistingFilePathAllowed } from "../../utils/file-access";
import { listExtensions } from "../../utils/extensions";

// GET 只返回静态注册表 项目扩展不会因查看页面被执行
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
    return listExtensions(cwd);
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
