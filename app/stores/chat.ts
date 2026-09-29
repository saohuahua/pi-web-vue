import { defineStore } from "pinia";
import { computed, reactive, ref, toRaw, watch } from "vue";
import { AgentCommandError, sendAgentCommand } from "#shared/lib/agent-client";
import {
  AgentEventConnection,
  AgentEventConnectionError,
} from "#shared/lib/agent-event-connection";
import type { AgentEventLike, ClientAssistantMessageEvent } from "#shared/lib/agent-event-wire";
import { extractTextBlocks } from "#shared/lib/message-text";
import { DraftStore, mergeDraftText } from "#shared/lib/draft-store";
import { findEntryParentId, selectTopLevelBranches } from "#shared/lib/session-branches";
import { fetchSessionDetail } from "#shared/lib/session-client";
import { normalizeToolCalls } from "#shared/lib/normalize";
import {
  INITIAL_STREAMING_STATE,
  streamReducer,
  type StreamingState,
} from "#shared/lib/streaming-message";
import type {
  AgentMessage,
  AttachedImage,
  SessionInfo,
  SessionStatsInfo,
  SessionTreeNode,
  ToolResultMessage,
} from "#shared/lib/types";
import { friendlyAgentError } from "~/utils/pi-error";
import { getToolExecutionProgress } from "~/utils/tool-progress";
import { useSessionNavigation } from "~/composables/useSessionNavigation";
import { usePromptQueue } from "~/composables/usePromptQueue";
import { useSessionRuntime } from "~/composables/useSessionRuntime";
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
  const messages = ref<AgentMessage[]>([]); // 已定稿消息
  const entryIds = ref<string[]>([]); // 与 messages 平行 分支操作要 entryId
  const draft = ref(""); // 输入框草稿 文件树 @ 引用从外部写入
  const attachedImages = ref<AttachedImage[]>([]); // 待发送图片 previewUrl 仅浏览器使用
  // reactive 包装的 reducer 状态 每次整体 Object.assign 写回
  // AgentEventConnection 不能进 reactive EventSource 被代理会出诡异问题 所以放闭包
  const stream = reactive<StreamingState>({ ...INITIAL_STREAMING_STATE });
  const isRunning = ref(false); // run 进行中的 UI 总开关
  const isStopping = ref(false);
  const sessionLoading = ref(false);
  const isCompacting = ref(false);
  const model = ref<{ provider: string; id: string } | null>(null);
  const thinkingLevel = ref("off");
  const contextUsage = ref<{
    percent: number | null;
    contextWindow: number;
    tokens: number | null;
  } | null>(null);
  const slashCommands = ref<Array<{ name: string; description: string; source: string }>>([]);
  const stats = ref<SessionStatsInfo | null>(null); // 文件累计 usage 与运行态 context 是两项指标
  const sessionName = ref<string | null>(null); // 当前会话名 顶栏展示与重命名入口
  const tree = ref<SessionTreeNode[]>([]);
  const activeLeafId = ref<string | null>(null);
  const editingMessageId = ref<string | null>(null);
  const editingTargetId = ref<string | null>(null);
  const branches = computed(() => selectTopLevelBranches(tree.value, activeLeafId.value));
  const notices = ref<Notice[]>([]);
  // 活跃工具执行 tool_execution_start 到 end 之间的实时状态
  // reactive Map 的 set delete 天然触发视图更新
  const activeTools = reactive(new Map<string, { name: string; progress: string | null }>());
  const retryInfo = ref<{ attempt: number; maxAttempts: number; errorMessage?: string } | null>(
    null,
  );

  // 非响应式内部状态
  let optimisticKey: string | null = null; // 指向乐观追加的用户消息
  let sdkAgentActive = false; // SDK agent 是否升起 prompt_done 据此判断是否落定
  let noticeSeq = 0;
  let stopFallbackTimer: ReturnType<typeof setTimeout> | null = null; // 停止后的兜底定时器
  let sessionGeneration = 0;
  let reloadSequence = 0;
  let draftBeforeEdit = "";
  let pendingDraft: { sessionId: string; text: string; editingMessageId: string | null } | null =
    null;
  const draftStore = new DraftStore(
    () => localStorage,
    (message) => addNotice("info", message),
  );

  const navigation = useSessionNavigation({
    sessionId,
    activeLeafId,
    isRunning,
    isCompacting,
    generation: () => sessionGeneration,
    invalidateReload: () => {
      reloadSequence += 1;
    },
    reload: () => reload(true),
    notice: (message) => addNotice("error", message),
  });
  const { isNavigating, positionUnknown, navigationError, navigateToLeaf } = navigation;

  function addNotice(type: Notice["type"], message: string) {
    // error 提示统一过一遍锁竞争映射 裸 EPERM 对用户没有可行动信息
    const text = type === "error" ? friendlyAgentError(message) : message;
    notices.value.push({ id: (noticeSeq += 1), type, message: text });
  }

  function dismissNotice(id: number) {
    notices.value = notices.value.filter((n) => n.id !== id);
  }

  const persistDraft = () => {
    const id = sessionId.value;
    if (!id) return;
    const pending = pendingDraft?.sessionId === id ? pendingDraft : null;
    draftStore.set(
      id,
      pending ? mergeDraftText(pending.text, draft.value) : draft.value,
      editingMessageId.value ?? pending?.editingMessageId ?? undefined,
    );
  };

  watch([draft, editingMessageId], persistDraft, { flush: "sync" });

  const queue = usePromptQueue({
    sessionId,
    isRunning,
    isStopping,
    positionUnknown,
    draft,
    attachedImages,
    generation: () => sessionGeneration,
    ensureConnected: (id) => connection.ensureConnected(id),
    reserveDraft: (id, text) => {
      if (pendingDraft) return false;
      pendingDraft = { sessionId: id, text, editingMessageId: null };
      draft.value = "";
      persistDraft();
      return true;
    },
    settleDraft: (id, text, accepted) => {
      if (sessionId.value !== id) return;
      pendingDraft = null;
      if (!accepted) draft.value = mergeDraftText(text, draft.value);
      persistDraft();
    },
    persistDraft,
    notice: (message) => addNotice("error", message),
    refreshRuntimeState: () => runtime.refreshRuntimeState(),
  });
  const { queuedMessages, queueSubmitting, queueActionPending, submitQueuedPrompt, recallQueue } =
    queue;

  const runtime = useSessionRuntime({
    sessionId,
    model,
    thinkingLevel,
    isCompacting,
    contextUsage,
    slashCommands,
    generation: () => sessionGeneration,
    queueVersion: queue.version,
    applyQueueSnapshot: queue.applySnapshot,
    notice: (message) => addNotice("error", message),
  });
  const {
    refreshRuntimeState,
    fetchRuntimeInfo,
    setModel,
    setThinkingLevel,
    compact,
    abortCompaction,
  } = runtime;

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
  async function reload(force = false): Promise<SessionInfo | null> {
    const id = sessionId.value;
    if (!id || (isNavigating.value && !force)) return null;
    const sequence = ++reloadSequence;
    const generation = sessionGeneration;
    const body = await fetchSessionDetail(id).catch(() => null);
    if (!body) return null;
    // 请求期间会话已切换 丢弃过期响应
    if (sessionId.value !== id || generation !== sessionGeneration || sequence !== reloadSequence)
      return null;
    messages.value = body.context?.messages ?? [];
    entryIds.value = body.context?.entryIds ?? [];
    tree.value = body.tree ?? [];
    activeLeafId.value = body.activeLeafId ?? null;
    positionUnknown.value = false;
    if (!isNavigating.value) navigationError.value = null;
    // SessionContext 里叫 modelId 展示层统一成 id
    model.value = body.context?.model
      ? { provider: body.context.model.provider, id: body.context.model.modelId }
      : null;
    thinkingLevel.value = body.context?.thinkingLevel ?? "off";
    stats.value = body.context?.stats ?? null;
    sessionName.value = body.info?.name ?? null;
    // 侧栏时间戳与首条消息预览跟着变
    void sessionsStore.refresh();
    return body.info ?? null;
  }

  function beginEditMessage(index: number): boolean {
    if (
      pendingDraft ||
      isRunning.value ||
      isCompacting.value ||
      isNavigating.value ||
      positionUnknown.value
    )
      return false;
    if (!messages.value.slice(0, index).some((message) => message.role === "user")) return false;
    const message = messages.value[index];
    const messageId = entryIds.value[index];
    if (message?.role !== "user" || !messageId) return false;
    const parentId = findEntryParentId(tree.value, messageId);
    if (!parentId) return false;
    if (!editingMessageId.value) draftBeforeEdit = draft.value;
    editingMessageId.value = messageId;
    editingTargetId.value = parentId;
    draft.value = extractTextBlocks(message.content).join("\n");
    return true;
  }

  function cancelEdit() {
    if (!editingMessageId.value || pendingDraft || isNavigating.value) return;
    draft.value = draftBeforeEdit;
    editingMessageId.value = null;
    editingTargetId.value = null;
    draftBeforeEdit = "";
  }

  async function submitPrompt(
    text: string,
    images = [...attachedImages.value],
  ): Promise<boolean | null> {
    const id = sessionId.value;
    const generation = sessionGeneration;
    if (
      !id ||
      pendingDraft ||
      isStopping.value ||
      isRunning.value ||
      isCompacting.value ||
      isNavigating.value ||
      positionUnknown.value ||
      queueActionPending.value
    )
      return false;
    const target = editingTargetId.value;
    pendingDraft = { sessionId: id, text, editingMessageId: editingMessageId.value };
    draft.value = "";
    persistDraft();
    const navigated = !target || (await navigateToLeaf(target));
    // 导航等待期间重入同名会话也不能继续提交旧输入
    if (sessionId.value !== id || generation !== sessionGeneration) return null;
    const result = navigated ? await sendPrompt(text, images) : false;
    if (sessionId.value !== id || generation !== sessionGeneration) return null;
    pendingDraft = null;
    if (result === false) draft.value = mergeDraftText(text, draft.value);
    if (result === true && target) {
      editingMessageId.value = null;
      editingTargetId.value = null;
      draftBeforeEdit = "";
    }
    persistDraft();
    return result;
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
          void refreshRuntimeState();
        } else if (event.isStreaming === false && sdkAgentActive) {
          // 断线期间结束的任务不会再补发结束事件
          optimisticKey = null;
          applyStream({ type: "end" });
          applyEvent({ type: "agent_settled" });
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
          clearTimeout(stopFallbackTimer);
          stopFallbackTimer = null;
        }
        void reload();
        // 运行结束 context usage 与统计都变了
        void refreshRuntimeState();
        break;

      case "prompt_error":
        addNotice(
          "error",
          typeof event.errorMessage === "string" ? event.errorMessage : "命令失败",
        );
        isRunning.value = false;
        break;

      case "startup_error":
        addNotice(
          "error",
          typeof event.errorMessage === "string" ? event.errorMessage : "会话启动失败",
        );
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
        void refreshRuntimeState();
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
        queue.applyUpdate({
          steering: [...((event.steering as string[] | undefined) ?? [])],
          followUp: [...((event.followUp as string[] | undefined) ?? [])],
        });
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
    persistDraft();
    sessionGeneration += 1;
    reloadSequence += 1;
    connection.close();
    sessionId.value = null;
    pendingDraft = null;
    draft.value = "";
    messages.value = [];
    entryIds.value = [];
    attachedImages.value = [];
    Object.assign(stream, INITIAL_STREAMING_STATE);
    isRunning.value = false;
    sessionLoading.value = false;
    isStopping.value = false;
    isCompacting.value = false;
    contextUsage.value = null;
    slashCommands.value = [];
    stats.value = null;
    sessionName.value = null;
    tree.value = [];
    activeLeafId.value = null;
    navigation.reset();
    editingMessageId.value = null;
    editingTargetId.value = null;
    draftBeforeEdit = "";
    activeTools.clear();
    retryInfo.value = null;
    queue.reset();
    optimisticKey = null;
    sdkAgentActive = false;
    runtime.reset();
    if (stopFallbackTimer !== null) {
      clearTimeout(stopFallbackTimer);
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
    // 先恢复文字再发异步详情请求 防止加载期间的新输入被晚到结果覆盖
    const saved = draftStore.get(id);
    draft.value = saved?.text ?? "";
    sessionLoading.value = true;
    try {
      const info = await reload();
      if (sessionId.value === id) {
        const messageId = saved?.editingMessageId;
        const target = messageId ? findEntryParentId(tree.value, messageId) : null;
        if (messageId && target) {
          draftBeforeEdit = draft.value;
          editingMessageId.value = messageId;
          editingTargetId.value = target;
        }
      }
      // 工作区跟随会话的项目与 worktree 打开别的项目时选择器同步过去
      if (info?.cwd) void workspaceStore.syncFromSessionCwd(info.cwd);
    } finally {
      if (sessionId.value === id) sessionLoading.value = false;
    }
    if (sessionId.value !== id) return;
    connection.maintain(id);
    void refreshRuntimeState();
    void fetchRuntimeInfo();
  }

  // 只创建空会话不带首条消息
  // 创建与首条 prompt 必须两次请求 SSE 建连前发的 prompt 会偶发丢首轮流式事件
  async function newSession(cwd: string) {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd }),
    });
    const body = (await res.json()) as { sessionId?: string; error?: string };
    if (!res.ok || !body.sessionId) {
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    // 进页面 openSession 连 SSE 之后用户再打字
    await navigateTo(`/session/${body.sessionId}`);
  }

  // 返回提交结果 会话代次失效时返回空值阻止旧草稿回填
  // 有图片无文字也允许发送 图片只传 data 与 mimeType previewUrl 留在浏览器
  async function sendPrompt(
    text: string,
    imageSnapshot = [...attachedImages.value],
  ): Promise<boolean | null> {
    const id = sessionId.value;
    const generation = sessionGeneration;
    // sessionId 丢失说明会话状态异常 静默吞掉用户输入比报错更糟
    if (!id) {
      addNotice("error", "会话未就绪 请刷新页面重试");
      return false;
    }
    if (
      isStopping.value ||
      isRunning.value ||
      isCompacting.value ||
      isNavigating.value ||
      positionUnknown.value ||
      queueActionPending.value
    )
      return false;
    const trimmed = text.trim();
    const images = imageSnapshot.map(({ data, mimeType }) => ({
      type: "image" as const,
      data,
      mimeType,
    }));
    if (!trimmed && images.length === 0) return false;

    // 乐观追加用户消息 message_end 到达时去重
    // 提前到 SSE 握手之前 冷启动握手要数秒 消息与运行态立即可见才不会像卡住
    const optimistic: AgentMessage = { role: "user", content: trimmed, timestamp: Date.now() };
    optimisticKey = userMessageKey(optimistic);
    messages.value.push(optimistic);
    entryIds.value.push(""); // 占位 reload 后被真实 entryId 替换
    isRunning.value = true;
    applyStream({ type: "start" });
    const rollbackOptimistic = () => {
      const last = messages.value[messages.value.length - 1];
      if (last && toRaw(last) === optimistic) {
        messages.value.pop();
        entryIds.value.pop();
      }
      optimisticKey = null;
      isRunning.value = false;
      applyStream({ type: "end" });
    };

    // 先等 SSE 握手完成再发 prompt 短回复的事件才不会丢
    try {
      await connection.ensureConnected(id);
      if (sessionId.value !== id || generation !== sessionGeneration) return null;
    } catch (e) {
      if (sessionId.value !== id || generation !== sessionGeneration) return null;
      // 握手失败撤回乐观消息与运行态 与提交失败同一套回滚
      rollbackOptimistic();
      // 启动错误已由事件通道提示 发送等待者只负责回滚
      if (!(e instanceof AgentEventConnectionError && e.status === "startup_error")) {
        addNotice("error", e instanceof Error ? e.message : String(e));
      }
      return false;
    }

    try {
      await sendAgentCommand(id, {
        type: "prompt",
        ...(trimmed ? { message: trimmed } : { message: "" }),
        ...(images.length ? { images } : {}),
      });
      if (sessionId.value !== id || generation !== sessionGeneration) return null;
      const sentImages = imageSnapshot.map((image) => toRaw(image));
      attachedImages.value = attachedImages.value.filter(
        (image) => !sentImages.includes(toRaw(image)),
      );
    } catch (e) {
      if (sessionId.value !== id || generation !== sessionGeneration) return null;
      // 提交失败撤回乐观消息 只撤仍然在末尾的那条
      rollbackOptimistic();
      if (e instanceof AgentCommandError) {
        addNotice("error", e.message);
      } else {
        // 连接错误可能发生在服务端已接纳之后 保留输入但不能自动重试
        addNotice("error", "提交结果未确认 请先核对会话再重试");
        void reload();
      }
      return false;
    }
    return true;
  }

  async function stop() {
    const id = sessionId.value;
    const generation = sessionGeneration;
    if (!id || isStopping.value) return;
    isStopping.value = true;
    try {
      // Pi 在 abort 后可能继续尚存的队列 因此必须先撤回再停止
      const recalled = await recallQueue();
      if (sessionId.value !== id || generation !== sessionGeneration) return;
      if (!recalled) {
        addNotice("error", "队列未确认 当前任务仍在运行");
        return;
      }
      try {
        await sendAgentCommand(id, { type: "abort" });
      } catch (error) {
        if (sessionId.value !== id || generation !== sessionGeneration) return;
        addNotice("error", error instanceof Error ? error.message : String(error));
        return;
      }
      if (sessionId.value !== id || generation !== sessionGeneration) return;
      // abort 的 POST resolve 与 agent_settled 可能乱序或丢失
      // 3 秒兜底强制落定并 reload 一次对账 settled 先到则取消
      if (stopFallbackTimer !== null) clearTimeout(stopFallbackTimer);
      stopFallbackTimer = setTimeout(() => {
        stopFallbackTimer = null;
        if (sessionId.value === id && generation === sessionGeneration && isRunning.value) {
          isRunning.value = false;
          activeTools.clear();
          void reload();
        }
      }, 3000);
    } finally {
      if (sessionId.value === id && generation === sessionGeneration) isStopping.value = false;
    }
  }

  return {
    sessionId,
    messages,
    entryIds,
    draft,
    attachedImages,
    stream,
    isRunning,
    isStopping,
    sessionLoading,
    isCompacting,
    model,
    thinkingLevel,
    contextUsage,
    slashCommands,
    stats,
    sessionName,
    tree,
    branches,
    activeLeafId,
    isNavigating,
    positionUnknown,
    editingMessageId,
    navigationError,
    notices,
    activeTools,
    retryInfo,
    queuedMessages,
    queueSubmitting,
    queueActionPending,
    toolResultsByCallId,
    openSession,
    newSession,
    sendPrompt,
    submitQueuedPrompt,
    recallQueue,
    submitPrompt,
    navigateToLeaf,
    beginEditMessage,
    cancelEdit,
    stop,
    close,
    closeIfCurrent,
    reload,
    dismissNotice,
    setModel,
    setThinkingLevel,
    compact,
    abortCompaction,
    refreshRuntimeState,
    fetchRuntimeInfo,
  };
});
