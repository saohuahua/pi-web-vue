import { getRpcSession, startRpcSession } from "../../../utils/rpc-manager";
import { createAgentEventStream } from "../../../utils/event-stream";
import { resolveSessionPath } from "../../../utils/session-reader";

// SSE 事件流 wrapper 存活直接用 否则从文件冷启动
export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id")!;
  const session = getRpcSession(id);
  const sessionPromise = session?.isAlive()
    ? Promise.resolve(session)
    : resolveSessionPath(id).then((file) => {
        if (!file) throw new Error("Session not found");
        return startRpcSession(id, file).then((r) => r.session);
      });

  // h3 暴露的是 Node req 用 close 事件派生等价于 Request signal 的中止信号
  const abort = new AbortController();
  event.node.req.on("close", () => abort.abort());

  const stream = createAgentEventStream(abort.signal, id, sessionPromise);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
