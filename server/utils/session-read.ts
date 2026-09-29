// 只读打开会话 优先取存活实例的内存态 其次打开磁盘文件
// 详情与上下文查询走这里 不经过命令分发

import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getRpcSession } from "./rpc-manager";
import { resolveSessionPath } from "./session-reader";

export const openSessionForRead = async (id: string) => {
  // 存活实例的会话管理器是权威 内存态最新 磁盘文件可能落后于未落盘的执行
  const wrapper = getRpcSession(id);
  if (wrapper?.isAlive()) {
    return { sessionManager: wrapper.inner.sessionManager, filePath: wrapper.sessionFile };
  }
  // 无存活实例 按 id 反查会话文件再打开
  const filePath = await resolveSessionPath(id);
  if (!filePath) return null;
  return { sessionManager: SessionManager.open(filePath), filePath };
};
