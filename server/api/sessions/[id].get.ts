import { statSync } from "node:fs";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getRpcSession } from "../../utils/rpc-manager";
import { buildSessionContext, readSessionHeader, resolveSessionPath } from "../../utils/session-reader";
import { extractTextBlocks } from "#shared/lib/message-text";
import type { AgentMessage, SessionEntry, SessionInfo } from "#shared/lib/types";

function firstUserMessageText(messages: AgentMessage[]): string {
  for (const message of messages) {
    if (message.role !== "user") continue;
    return extractTextBlocks(message.content).join(" ").slice(0, 80);
  }
  return "";
}

// 会话详情 wrapper 存活用 wrapper 的 sessionManager 否则从文件打开
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  try {
    const wrapper = getRpcSession(id);
    let sessionManager: SessionManager;
    let filePath: string;
    if (wrapper?.isAlive()) {
      sessionManager = wrapper.inner.sessionManager;
      filePath = wrapper.sessionFile;
    } else {
      filePath = (await resolveSessionPath(id)) ?? "";
      if (!filePath) {
        setResponseStatus(event, 404);
        return { error: "Session not found" };
      }
      sessionManager = SessionManager.open(filePath);
    }

    const header = readSessionHeader(filePath);
    const entries = sessionManager.getEntries() as unknown as SessionEntry[];
    const leafId = sessionManager.getLeafId();
    const context = buildSessionContext(entries, leafId);

    const name = sessionManager.getSessionName();
    const info: SessionInfo = {
      path: filePath,
      id,
      cwd: header?.cwd ?? sessionManager.getCwd(),
      ...(name !== undefined ? { name } : {}),
      created: header?.timestamp ?? "",
      modified: statSync(filePath).mtime.toISOString(),
      messageCount: entries.filter((entry) => entry.type === "message").length,
      firstMessage: firstUserMessageText(context.messages),
    };

    return { info, context, activeLeafId: leafId };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
