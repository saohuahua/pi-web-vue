import { existsSync } from "node:fs";
import { getRpcSession, newSessionTempKey, startRpcSession } from "../../utils/rpc-manager";
import { invalidateSessionListCache } from "../../utils/session-reader";

// 只创建空会话 不发消息
// 首条 prompt 必须由前端在 SSE 建连后单独 POST
// 合并创建与首条消息会在没有对账机制的情况下偶发丢掉首轮流式事件 别合并
export default defineEventHandler(async (event) => {
  const body = await readBody<{ cwd?: string }>(event);
  const cwd = body?.cwd;
  if (!cwd || typeof cwd !== "string" || !existsSync(cwd)) {
    setResponseStatus(event, 400);
    return { error: cwd ? `Directory does not exist: ${cwd}` : "cwd is required" };
  }
  try {
    // 一次性 key 防并发合并 两个新建请求共享 key 会变成一个会话
    const tempKey = newSessionTempKey();
    const { session, realSessionId } = await startRpcSession(tempKey, "", cwd);
    invalidateSessionListCache();
    const state = await session.send({ type: "get_state" }) as {
      model?: { id: string; provider: string };
      thinkingLevel?: string;
    };
    return {
      success: true,
      sessionId: realSessionId,
      model: state.model ?? null,
      thinkingLevel: state.thinkingLevel ?? null,
    };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
