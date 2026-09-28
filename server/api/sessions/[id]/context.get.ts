import type { SessionEntry } from "#shared/lib/types";
import { openSessionForRead } from "../../../utils/session-read";
import { buildSessionContext, SessionLeafError } from "../../../utils/session-reader";

// 预览指定分支只读上下文 不切换服务端活跃叶子
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const query = getQuery(event);
  if (query.leafId !== undefined && typeof query.leafId !== "string") {
    setResponseStatus(event, 400);
    return { error: "Invalid leaf ID", code: "invalid_leaf" };
  }
  try {
    const opened = await openSessionForRead(id);
    if (!opened) {
      setResponseStatus(event, 404);
      return { error: "Session not found", code: "session_not_found" };
    }
    const leafId = query.leafId ?? opened.sessionManager.getLeafId();
    const entries = opened.sessionManager.getEntries() as unknown as SessionEntry[];
    return { context: buildSessionContext(entries, leafId), activeLeafId: leafId };
  } catch (error) {
    if (error instanceof SessionLeafError) {
      setResponseStatus(event, 400);
      return { error: error.message, code: error.code };
    }
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
