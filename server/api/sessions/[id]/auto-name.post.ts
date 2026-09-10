import type { Agent } from "@earendil-works/pi-agent-core";
import { getRpcSession, startRpcSession } from "../../../utils/rpc-manager";
import { invalidateSessionListCache, resolveSessionPath } from "../../../utils/session-reader";
import { generateSessionTitle } from "../../../utils/session-title";

// POST /api/sessions/:id/auto-name
// 只对已落盘会话生效 空会话没有可命名的上下文
// 生成失败抛错不落名 原标题保留
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  try {
    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      setResponseStatus(event, 404);
      return { error: "Session not found" };
    }

    const existing = getRpcSession(id);
    const { session: wrapper } = existing?.isAlive()
      ? { session: existing }
      : await startRpcSession(id, filePath);

    const result = await generateSessionTitle(wrapper.inner.agent as unknown as Agent);

    // 生成期间 wrapper 可能被回收或销毁 再写就是写进死对象
    if (!wrapper.isAlive()) {
      setResponseStatus(event, 409);
      return { error: "The session was closed while its title was being generated. Please try again." };
    }

    wrapper.inner.setSessionName(result.title);
    invalidateSessionListCache();
    return { title: result.title, usage: result.usage ?? null };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
