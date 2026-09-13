import { getAllowedFileRoots, isExistingFilePathAllowed } from "../../../utils/file-access";
import { checkPluginUpdates } from "../../../utils/plugin-updates";

// 更新检查只读 npm view 与 git ls-remote 不安装不更新 也可以对单个包检查
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ cwd?: unknown; source?: unknown; scope?: unknown }>(event);
    const cwd = typeof body?.cwd === "string" ? body.cwd : "";
    if (!cwd) {
      setResponseStatus(event, 400);
      return { error: "cwd is required" };
    }
    if (!isExistingFilePathAllowed(cwd, await getAllowedFileRoots())) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }

    const source = typeof body?.source === "string" ? body.source : undefined;
    const scope = body?.scope === "global" || body?.scope === "project" ? body.scope : undefined;
    if ((source && !scope) || (!source && scope)) {
      setResponseStatus(event, 400);
      return { error: "source and scope must be provided together" };
    }

    const updates = await checkPluginUpdates(cwd, source && scope ? { source, scope } : undefined);
    if (source && scope && updates.length === 0) {
      setResponseStatus(event, 404);
      return { error: "Configured package not found" };
    }
    return { updates };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
