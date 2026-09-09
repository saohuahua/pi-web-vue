import { getRpcSession, startRpcSession } from "../../../utils/rpc-manager";
import { resolveSessionPath } from "../../../utils/session-reader";

// 命令分发 body 的 type 字段决定命令 与 pi-web 的 RPC 契约同构
// 错误响应统一 { error string } 前端 agent-client 按此解析 不用 createError 默认错误体
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const command = await readBody<Record<string, unknown>>(event);
  try {
    const existing = getRpcSession(id);
    if (existing?.isAlive()) {
      return { success: true, data: await existing.send(command) };
    }
    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      setResponseStatus(event, 404);
      return { error: "Session not found" };
    }
    const { session } = await startRpcSession(id, filePath);
    return { success: true, data: await session.send(command) };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
