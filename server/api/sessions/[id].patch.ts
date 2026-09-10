import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getRpcSession } from "../../utils/rpc-manager";
import { invalidateSessionListCache, resolveSessionPath } from "../../utils/session-reader";

// PATCH /api/sessions/:id  body { name }
// 存活 wrapper 走内存命令同步写文件 离线会话直接追加 session_info entry
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  try {
    const body = await readBody<{ name?: unknown }>(event);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      setResponseStatus(event, 400);
      return { error: "name is required" };
    }

    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      setResponseStatus(event, 404);
      return { error: "Session not found" };
    }

    const wrapper = getRpcSession(id);
    if (wrapper?.isAlive()) {
      wrapper.inner.setSessionName(name);
    } else {
      SessionManager.open(filePath).appendSessionInfo(name);
    }
    invalidateSessionListCache();
    return { ok: true };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
