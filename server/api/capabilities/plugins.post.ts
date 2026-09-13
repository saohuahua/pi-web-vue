import { getAllowedFileRoots, isExistingFilePathAllowed } from "../../utils/file-access";
import { PluginActionError, runPluginAction } from "../../utils/plugins";
import type { PluginActionRequest } from "#shared/lib/types";

// 安装与更新会执行第三方代码 必须由用户显式触发 project 作用域的信任检查在 runPluginAction 内
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<Partial<PluginActionRequest>>(event);
    const cwd = typeof body?.cwd === "string" ? body.cwd : "";
    if (!cwd || !body?.action) {
      setResponseStatus(event, 400);
      return { error: "cwd and action are required" };
    }
    if (!isExistingFilePathAllowed(cwd, await getAllowedFileRoots())) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }
    const request: PluginActionRequest = {
      action: body.action,
      source: typeof body.source === "string" ? body.source : undefined,
      scope: body.scope === "project" ? "project" : body.scope === "global" ? "global" : undefined,
      cwd,
    };
    return await runPluginAction(request);
  } catch (error) {
    if (error instanceof PluginActionError) {
      setResponseStatus(event, error.statusCode);
      return { error: error.message };
    }
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
