import { defineStore } from "pinia";
import { sendAgentCommand } from "#shared/lib/agent-client";
import { AgentEventConnection } from "#shared/lib/agent-event-connection";
import type { AgentEventLike, ClientAssistantMessageEvent } from "#shared/lib/agent-event-wire";
import { extractTextBlocks } from "#shared/lib/message-text";
import { normalizeToolCalls } from "#shared/lib/normalize";
import { INITIAL_STREAMING_STATE, streamReducer, type StreamingState } from "#shared/lib/streaming-message";
import type { AgentMessage, SessionContext, SessionInfo, ToolResultMessage } from "#shared/lib/types";
import { getToolExecutionProgress } from "~/utils/tool-progress";
import { useSessionsStore } from "./sessions";
import { useWorkspaceStore } from "./workspace";

export interface Notice {
  id: number;
  type: "error" | "info";
  message: string;
}

// 乐观消息与服务端 message_end 的配对 key
// timestamp 取整到秒 时钟差一秒也只是走替换分支 不会重复
function userMessageKey(m: AgentMessage): string {
  const text = m.role === "user" ? extractTextBlocks(m.content).join(" ") : "";
  return `${m.role}:${text}:${Math.floor((m.timestamp ?? 0) / 1000)}`;
}

/**
 * 当前会话 store 是前端核心
 * 持有已定稿消息与流式状态两个数据源 + SSE 连接 + 乐观更新
 * 结构对照 pi-web hooks/useAgentSession.ts 精简 移植的纯函数承担流式组装与连接管理
 */
export const useChatStore = defineStore("chat", () => {
  const sessionsStore = useSessionsStore();
  const workspaceStore = useWorkspaceStore();

  const sessionId = ref<string | null>(null);
  const messages = ref<AgentMessage[]>([]);      // 已定稿消息
  const entryIds = ref<string[]>([]);            // 与 messages 平行 分支操作要 entryId
  const draft = ref("");                         // 输入框草稿 文件树 @ 引用从外部写入
  // reactive 包装的 reducer 状态 每次整体 Object.assign 写回
  // AgentEventConnection 不能进 reactive EventSource 被代理会出诡异问题 所以放闭包
  const stream = reactive<StreamingState>({ ...INITIAL_STREAMING_STATE });
  const isRunning = ref(false);                  // run 进行中的 UI 总开关
  const isCompacting = ref(false);
  const model = ref<{ provider: string; id: string } | null>(null);
  const thinkingLevel = ref("off");
  const notices = ref<Notice[]>([]);
  // 活跃工具执行 tool_execution_start 到 end 之间的实时状态
  // reactive Map 的 set delete 天然触发视图更新
  const activeTools = reactive(new Map<string, { name: string; progress: string | null }>());
  const retryInfo = ref<{ attempt: number; maxAttempts: number; errorMessage?: string } | null>(null);
  const queuedMessages = ref<{ steering: string[]; followUp: string[] }>({ steering: [], followUp: [] });

  // 非响应式内部状态
  let optimisticKey: string | null = null;       // 指向乐观追加的用户消息
  let sdkAgentActive = false;                    // SDK agent 是否升起 prompt_done 据此判断是否落定
  let noticeSeq = 0;
  let stopFallbackTimer: number | null = null;   // 停止后的兜底定时器

  function addNotice(type: Notice["type"], message: string) {
    notices.value.push({ id: (noticeSeq += 1), type, message });
  }

  function dismissNotice(id: number) {
    notices.value = notices.value.filter((n) => n.id !== id);
  }

  // toolCall 块与 toolResult 消息靠 toolCallId 配对
  // 流式中 result 还没到 卡片显示执行中 到了就升级成完成
  const toolResultsByCallId = computed(() => {
    const map = new Map<string, ToolResultMessage>();
    for (const m of messages.value) {
      if (m.role === "toolResult") map.set(m.toolCallId, m);
    }
    return map;
  });

  // reducer 返回新对象 必须整体覆盖 reactive 目标 直接改属性会丢不可变语义
  function applyStream(action: Parameters<typeof streamReducer>[1]) {
    Object.assign(stream, streamReducer(stream, action));
  }

  // 权威数据重载 entryIds 只能从文件来 增量事件里没有
  // 返回会话信息 openSession 用它同步工作区 事件触发的 reload 忽略返回值
  async function reload(): Promise<SessionInfo | null> {
    const id = sessionId.value;
    if (!id) return null;
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`).catch(() => null);
    if (!res || !res.ok) return null;
    const body = await res.json() as { context?: SessionContext; info?: SessionInfo };
    // 请求期间会话已切换 丢弃过期响应
    if (sessionId.value !== id) return null;
    messages.value = body.context?.messages ?? [];
    entryIds.value = body.context?.entryIds ?? [];
    // SessionContext 里叫 modelId 展示层统一成 id
    model.value = body.context?.model
      ? { provider: body.context.model.provider, id: body.context.model.modelId }
      : null;
    thinkingLevel.value = body.context?.thinkingLevel ?? "off";
    // 侧栏时间戳与首条消息预览跟着变
    void sessionsStore.refresh();
    return body.info ?? null;
  }

  // SSE 事件分发 语义对照 pi-web handleAgentEvent 的精简版
  function applyEvent(event: AgentEventLike) {
    switch (event.type) {
      case "connected":
        // 页面刷新时 run 还在飞 服务端握手包带 isStreaming
        // 流式气泡由随后的 message_start 快照自动恢复
        if (event.isStreaming === true) {
          isRunning.value = true;
          sdkAgentActive = true;
        }
        break;

      case "agent_start":
        sdkAgentActive = true;
        isRunning.value = true;
        applyStream({ type: "start" });
        break;

      case "message_start": {
        // 迟到事件守卫 run 已结束的流式事件会复活幽灵气泡
        if (!isRunning.value) break;
        const msg = event.message as AgentMessage | undefined;
        // 用户消息快照忽略 乐观更新已加
        if (msg?.role === "assistant") {
          sdkAgentActive = true;
          applyStream({ type: "snapshot", message: msg });
        }
        break;
      }

      case "message_update": {
        if (!isRunning.value) break;
        const delta = event.assistantMessageEvent as ClientAssistantMessageEvent | undefined;
        if (delta) applyStream({ type: "delta", event: delta });
        break;
      }

      case "message_end": {
        if (!isRunning.value) break;
        const completed = normalizeToolCalls(event.message as AgentMessage);
        if (completed.role === "user") {
          // 去重 本条消息的乐观版本已在列表里
          // steer 与 follow_up 的用户消息也走这里 没有乐观版会正常追加
          const key = optimisticKey;
          optimisticKey = null;
          const last = messages.value[messages.value.length - 1];
          if (key && last?.role === "user" && userMessageKey(last) === key) {
            // 时间戳跨秒时 key 不同 用服务端版本替换 同 key 直接跳过
            if (userMessageKey(last) !== userMessageKey(completed)) {
              messages.value[messages.value.length - 1] = completed;
            }
          } else {
            messages.value.push(completed);
            entryIds.value.push("");
          }
        } else {
          messages.value.push(completed);
          entryIds.value.push("");
        }
        // 先追加进 messages 再清流式气泡 顺序反了会闪一帧重复
        applyStream({ type: "end" });
        break;
      }

      case "prompt_done":
        // POST 生命周期结束 若 agent 没有自己起来 如纯斜杠命令 落定 UI
        optimisticKey = null;
        if (!sdkAgentActive) {
          isRunning.value = false;
          void reload();
        }
        break;

      case "agent_end":
        // 一个逻辑 run 可能发多个 agent_end 重试 压缩 排队都会再来一轮
        // 这里只重载数据 落定只认 agent_settled
        void reload();
        break;

      case "agent_settled":
        sdkAgentActive = false;
        isRunning.value = false;
        isCompacting.value = false;
        // end 事件可能丢失 残留的执行中状态在这里统一清空
        activeTools.clear();
        retryInfo.value = null;
        if (stopFallbackTimer !== null) {
          window.clearTimeout(stopFallbackTimer);
          stopFallbackTimer = null;
        }
        void reload();
        break;

      case "prompt_error":
        addNotice("error", typeof event.errorMessage === "string" ? event.errorMessage : "命令失败");
        isRunning.value = false;
        break;

      case "startup_error":
        addNotice("error", typeof event.errorMessage === "string" ? event.errorMessage : "会话启动失败");
        break;

      case "compaction_start":
      case "auto_compaction_start":
        // 新旧两套事件名都认 pi-web 的兼容经验
        isCompacting.value = true;
        break;

      case "compaction_end":
      case "auto_compaction_end":
        isCompacting.value = false;
        void reload();
        break;

      // 工具执行实时状态 卡片等 message_end 定稿后由历史渲染
      // 状态条只负责此刻正在跑什么
      case "tool_execution_start": {
        const toolCallId = event.toolCallId as string;
        activeTools.set(toolCallId, { name: String(event.toolName ?? "tool"), progress: null });
        break;
      }

      case "tool_execution_update": {
        const toolCallId = event.toolCallId as string;
        const existing = activeTools.get(toolCallId);
        if (existing) {
          existing.progress = getToolExecutionProgress(event.partialResult);
        }
        break;
      }

      case "tool_execution_end": {
        const toolCallId = event.toolCallId as string;
        activeTools.delete(toolCallId);
        break;
      }

      case "auto_retry_start":
        retryInfo.value = {
          attempt: Number(event.attempt ?? 0),
          maxAttempts: Number(event.maxAttempts ?? 0),
          errorMessage: typeof event.errorMessage === "string" ? event.errorMessage : undefined,
        };
        break;

      case "auto_retry_end":
        retryInfo.value = null;
        break;

      case "queue_update":
        queuedMessages.value = {
          steering: [...((event.steering as string[] | undefined) ?? [])],
          followUp: [...((event.followUp as string[] | undefined) ?? [])],
        };
        break;

      default:
        break;
    }
  }

  const connection = new AgentEventConnection({
    createSource: (sid) => new EventSource(`/api/agent/${encodeURIComponent(sid)}/events`),
    onEvent: (e) => applyEvent(e),
    // 会话切换后旧连接不再维护 shouldMaintain 是连接保活的开关
    shouldMaintain: (sid) => sid === sessionId.value,
    readinessTimeoutMs: 30_000,
    reconnectDelayMs: 3_000,
  });

  function close() {
    connection.close();
    sessionId.value = null;
    messages.value = [];
    entryIds.value = [];
    Object.assign(stream, INITIAL_STREAMING_STATE);
    isRunning.value = false;
    isCompacting.value = false;
    activeTools.clear();
    retryInfo.value = null;
    queuedMessages.value = { steering: [], followUp: [] };
    optimisticKey = null;
    sdkAgentActive = false;
    if (stopFallbackTimer !== null) {
      window.clearTimeout(stopFallbackTimer);
      stopFallbackTimer = null;
    }
  }

  // 条件关闭 只有 store 仍指向这个会话时才执行
  // 路由组件销毁重建的时序里 新实例的 openSession 可能先于旧实例的 unmount
  // 旧实例卸载时不能把新实例刚打开的会话清掉 否则历史加载被竞态丢弃
  function closeIfCurrent(id: string | null | undefined) {
    if (id && sessionId.value !== id) return;
    close();
  }

  async function openSession(id: string) {
    // 打开新会话前先关旧连接 否则旧事件还会流进新会话的视图
    close();
    sessionId.value = id;
    const info = await reload();
    // 工作区跟随会话的项目与 worktree 打开别的项目时选择器同步过去
    if (info?.cwd) void workspaceStore.syncFromSessionCwd(info.cwd);
    connection.maintain(id);
  }

  // 只创建空会话不带首条消息
  // 创建与首条 prompt 必须两次请求 SSE 建连前发的 prompt 会偶发丢首轮流式事件
  async function newSession(cwd: string) {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd }),
    });
    const body = await res.json() as { sessionId?: string; error?: string };
    if (!res.ok || !body.sessionId) {
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    // 进页面 openSession 连 SSE 之后用户再打字
    await navigateTo(`/session/${body.sessionId}`);
  }

  // 返回是否已提交成功 失败时 composer 据此恢复草稿
  async function sendPrompt(text: string): Promise<boolean> {
    // sessionId 丢失说明会话状态异常 静默吞掉用户输入比报错更糟
    if (!sessionId.value) {
      addNotice("error", "会话未就绪 请刷新页面重试");
      return false;
    }
    if (isRunning.value) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    // 先等 SSE 握手完成再发 prompt 短回复的事件才不会丢
    // 连接超时直接提示并中止 此时还没有乐观消息要撤
    try {
      await connection.ensureConnected(sessionId.value);
    } catch (e) {
      addNotice("error", e instanceof Error ? e.message : String(e));
      return false;
    }

    // 乐观追加用户消息 message_end 到达时去重
    const optimistic: AgentMessage = { role: "user", content: trimmed, timestamp: Date.now() };
    optimisticKey = userMessageKey(optimistic);
    messages.value.push(optimistic);
    entryIds.value.push("");                     // 占位 reload 后被真实 entryId 替换
    isRunning.value = true;
    applyStream({ type: "start" });

    try {
      await sendAgentCommand(sessionId.value, { type: "prompt", message: trimmed });
    } catch (e) {
      // 提交失败撤回乐观消息 只撤仍然在末尾的那条
      const last = messages.value[messages.value.length - 1];
      if (last === optimistic) {
        messages.value.pop();
        entryIds.value.pop();
      }
      optimisticKey = null;
      isRunning.value = false;
      addNotice("error", e instanceof Error ? e.message : String(e));
      return false;
    }
    return true;
  }

  async function stop() {
    if (!sessionId.value) return;
    // abort 失败也要让 UI 可恢复 事件流会带来 agent_end
    await sendAgentCommand(sessionId.value, { type: "abort" }).catch(() => {});
    // abort 的 POST resolve 与 agent_settled 可能乱序或丢失
    // 3 秒兜底强制落定并 reload 一次对账 settled 先到则取消
    if (stopFallbackTimer !== null) window.clearTimeout(stopFallbackTimer);
    stopFallbackTimer = window.setTimeout(() => {
      stopFallbackTimer = null;
      if (sessionId.value && isRunning.value) {
        isRunning.value = false;
        activeTools.clear();
        void reload();
      }
    }, 3000);
  }

  return {
    sessionId, messages, entryIds, draft, stream, isRunning, isCompacting,
    model, thinkingLevel, notices, activeTools, retryInfo, queuedMessages,
    toolResultsByCallId,
    openSession, newSession, sendPrompt, stop, close, closeIfCurrent, reload, dismissNotice,
  };
});
