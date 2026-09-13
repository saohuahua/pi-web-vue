import { getAgentDir, ProjectTrustStore } from "@earendil-works/pi-coding-agent";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "../../utils/file-access";

// 信任决定只写入 Pi 自己的 trust.json 不会执行项目扩展
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ cwd?: unknown; trusted?: unknown }>(event);
    const cwd = typeof body?.cwd === "string" ? body.cwd : "";
    if (!cwd || body?.trusted !== true) {
      setResponseStatus(event, 400);
      return { error: "cwd and trusted=true are required" };
    }
    if (!isExistingFilePathAllowed(cwd, await getAllowedFileRoots())) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }
    new ProjectTrustStore(getAgentDir()).set(cwd, true);
    return { success: true };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
