import { existsSync, statSync } from "node:fs";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getRpcSession } from "../../utils/rpc-manager";
import { projectIdentityKey } from "../../utils/project-identity";
import { buildSessionContext, readSessionHeader, resolveSessionPath } from "../../utils/session-reader";
import { resolveProject } from "../../utils/worktree";
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

    // 新建空会话在首条消息前 SDK 不落盘文件 header 与 mtime 都拿不到
    // wrapper 存活说明会话真实存在 用 sessionManager 的内存状态补全
    const fileExists = filePath !== "" && existsSync(filePath);
    const header = fileExists ? readSessionHeader(filePath) : null;
    const entries = sessionManager.getEntries() as unknown as SessionEntry[];
    const leafId = sessionManager.getLeafId();
    const context = buildSessionContext(entries, leafId);

    // 项目身份与会话归属 供侧栏分组与工作区选择器同步
    const sessionCwd = header?.cwd ?? sessionManager.getCwd();
    const project = await resolveProject(sessionCwd);
    const name = sessionManager.getSessionName();
    const info: SessionInfo = {
      path: filePath,
      id,
      cwd: sessionCwd,
      ...(name !== undefined ? { name } : {}),
      created: header?.timestamp ?? new Date().toISOString(),
      modified: fileExists ? statSync(filePath).mtime.toISOString() : new Date().toISOString(),
      messageCount: entries.filter((entry) => entry.type === "message").length,
      firstMessage: firstUserMessageText(context.messages),
      projectKey: projectIdentityKey(project.projectRoot),
      projectRoot: project.projectRoot,
      ...(project.isWorktree ? { worktreePath: sessionCwd } : {}),
    };

    return { info, context, activeLeafId: leafId };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
