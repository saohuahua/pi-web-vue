// Ported from pi-web lib/agent-event-stream.ts — https://github.com/agegr/pi-web (MIT)
// SSE 是一条保持打开的 HTTP 响应 服务端持续写入 浏览器持续接收 与一次性请求响应不同
// 本文件负责 SSE 通道生命周期 三个必须保留的语义
// 1 先开通道后握手 HTTP 响应头立即写出 等 agent 就绪监听器装好才发 connected
//   期间 SDK 已产出的事件先缓冲 握手后按序补发
// 2 流式快照重放 连接建立时若 isStreaming 为 true 立即补发 message_start 携带快照
//   这是刷新页面断线重连后流式气泡不丢的机制
// 3 心跳 每 30 秒发注释行 防中间层断连 abort 时清理监听器与定时器

import {
  isEventIncludedInSnapshot,
  toClientAgentEvent,
  type AgentEventLike,
} from "#shared/lib/agent-event-wire";

export interface AgentEventStreamSession {
  // 连接建立时 SDK 是否正在流式 决定是否补发快照
  readonly isStreaming: boolean;
  // SDK 当前正在生成的流式消息 作为快照发给刚连上的浏览器
  readonly streamingMessage: unknown;
  onEvent(listener: (event: AgentEventLike) => void): () => void;
  // wrapper 销毁时回调 流必须随之关闭 让前端 onerror 重连到重建的 wrapper
  onDispose(listener: () => void): () => void;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createAgentEventStream(
  signal: AbortSignal,
  sessionId: string,
  sessionPromise: Promise<AgentEventStreamSession>,
): ReadableStream<Uint8Array> {
  let cancelStream: (closeController: boolean) => void = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      // 流是否已关闭 幂等保护 后续 enqueue 与清理都先查它
      let closed = false;
      // 心跳定时器 每 30 秒发注释行防中间层断开
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      // SDK 事件监听的取消函数
      let unsubscribe: (() => void) | null = null;
      // wrapper 销毁监听的取消函数
      let unsubscribeDispose: (() => void) | null = null;
      // 请求中止信号的处理函数 客户端断开时触发
      let abortHandler: (() => void) | null = null;

      // 清理监听器与定时器 幂等 closeController 决定是否主动关流
      const cleanup = (closeController: boolean) => {
        if (closed) return;
        closed = true;
        if (heartbeat !== null) clearInterval(heartbeat);
        unsubscribe?.();
        unsubscribe = null;
        unsubscribeDispose?.();
        unsubscribeDispose = null;
        if (abortHandler) signal.removeEventListener("abort", abortHandler);
        if (closeController) {
          try {
            controller.close();
          } catch {
            /* 流已关闭 */
          }
        }
      };
      cancelStream = cleanup;

      const enqueueText = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup(false);
        }
      };
      const encode = (data: unknown) => {
        enqueueText(`data: ${JSON.stringify(data)}\n\n`);
      };
      // 事件先经线上裁剪 再去掉快照已包含的内容 避免重复发送
      const forwardEvent = (event: AgentEventLike, snapshot: unknown) => {
        if (isEventIncludedInSnapshot(event, snapshot)) return;
        const clientEvent = toClientAgentEvent(event);
        if (clientEvent) encode(clientEvent);
      };

      const publishSession = async () => {
        try {
          const session = await sessionPromise;
          if (closed) return;

          // 握手前到达的事件先缓冲 避免 listener 装好前的间隙丢事件
          const bufferedEvents: AgentEventLike[] = [];
          // 是否已发完握手与快照 未发完前事件只进缓冲
          let snapshotPublished = false;
          const handleEvent = (event: AgentEventLike) => {
            if (!snapshotPublished) {
              bufferedEvents.push(event);
              return;
            }
            forwardEvent(event, snapshot);
          };

          const stopDisposeListening = session.onDispose(() => cleanup(true));
          if (closed) {
            stopDisposeListening();
            return;
          }
          unsubscribeDispose = stopDisposeListening;

          const stopListening = session.onEvent(handleEvent);
          if (closed) {
            stopListening();
            return;
          }
          unsubscribe = stopListening;

          const snapshot = session.streamingMessage;
          encode({
            type: "connected",
            sessionId,
            isStreaming: session.isStreaming,
          });
          for (const event of bufferedEvents) forwardEvent(event, snapshot);
          if (snapshot !== undefined && snapshot !== null) {
            encode({ type: "message_start", message: snapshot });
          }
          snapshotPublished = true;
        } catch (error) {
          if (closed) return;
          encode({
            type: "startup_error",
            errorMessage: `Failed to start agent: ${errorMessage(error)}`,
          });
          cleanup(true);
        }
      };

      // 先挂 rejection handler 再查 abort 路由层可能已启动共享的冷启动 promise
      void publishSession();

      abortHandler = () => cleanup(true);
      if (signal.aborted) {
        cleanup(true);
        return;
      }
      signal.addEventListener("abort", abortHandler, { once: true });

      heartbeat = setInterval(() => enqueueText(":\n\n"), HEARTBEAT_INTERVAL_MS);

      // 立即写出响应头开通道 但不声明 agent 就绪 客户端等后面的 connected 事件
      enqueueText(":\n\n");
    },
    cancel() {
      cancelStream(false);
    },
  });
}
