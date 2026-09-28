import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getRpcSession } from "./rpc-manager";
import { resolveSessionPath } from "./session-reader";

export const openSessionForRead = async (id: string) => {
  const wrapper = getRpcSession(id);
  if (wrapper?.isAlive()) {
    return { sessionManager: wrapper.inner.sessionManager, filePath: wrapper.sessionFile };
  }
  const filePath = await resolveSessionPath(id);
  if (!filePath) return null;
  return { sessionManager: SessionManager.open(filePath), filePath };
};
