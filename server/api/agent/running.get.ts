import { getRpcSession } from "../../utils/rpc-manager";

// 运行中的会话 id 列表 前端刷新时用于恢复 SSE 连接
export default defineEventHandler(() => {
  const sessionIds: string[] = [];
  for (const wrapper of listRpcSessions()) {
    if (wrapper.isAlive() && wrapper.isRunning()) sessionIds.push(wrapper.sessionId);
  }
  return { sessionIds };
});
