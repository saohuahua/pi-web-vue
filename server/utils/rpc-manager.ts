// Ported from pi-web lib/rpc-manager.ts — https://github.com/agegr/pi-web (MIT)
// 简化重写 保留骨架语义 去掉扩展 UI 子代理 工具预设 模型作用域 推送通知
// 职责 一个会话 id 对应一个 AgentSessionWrapper 存模块级 Map
// 并发请求同一会话用启动锁合并 空闲 10 分钟回收

import { randomUUID } from "node:crypto";
import {
  createAgentSessionFromServices,
  createAgentSessionServices,
  getAgentDir,
  initTheme,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentEventLike } from "#shared/lib/agent-event-wire";
import { invalidateSessionListCache } from "./session-reader";

interface ContextUsage {
  percent: number | null;
  contextWindow: number;
  tokens: number | null;
}

interface ModelLike {
  id: string;
  provider: string;
}

// pi SDK AgentSession 的最小结构 参考 pi-web lib/pi-types.ts 的 AgentSessionLike 精简
// 只声明本项目实际用到的成员
interface AgentSessionInner {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
  readonly isStreaming: boolean;
  readonly isCompacting: boolean;
  readonly model: ModelLike | undefined;
  readonly sessionManager: SessionManager;
  readonly agent: {
    state?: {
      thinkingLevel?: string;
      streamingMessage?: unknown;
    };
  };
  subscribe(listener: (event: AgentEventLike) => void): () => void;
  prompt(text: string, options?: {
    images?: Array<{ type: "image"; data: string; mimeType: string }>;
    source?: "interactive" | "rpc";
    preflightResult?: (success: boolean) => void;
  }): Promise<void>;
  abort(): Promise<void>;
  dispose(): void;
  navigateTree(targetId: string, options?: { summarize?: boolean }): Promise<unknown>;
  setSessionName(name: string): void;
  getContextUsage(): ContextUsage | undefined;
}

type EventListener = (event: AgentEventLike) => void;

const IDLE_RECYCLE_MS = 10 * 60_000;

export class AgentSessionWrapper {
  private listeners = new Set<EventListener>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPromptCount = 0;
  private _alive = true;
  private unsubscribe: (() => void) | null = null;

  constructor(public readonly inner: AgentSessionInner) {}

  get sessionId() { return this.inner.sessionId; }
  get sessionFile() { return this.inner.sessionFile ?? ""; }
  get isStreaming() { return this.inner.isStreaming; }
  get streamingMessage() { return this.inner.agent.state?.streamingMessage; }
  isAlive() { return this._alive; }
  isRunning() { return this._alive && (this.pendingPromptCount > 0 || this.inner.isStreaming); }

  onEvent(listener: EventListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: AgentEventLike) {
    for (const l of this.listeners) l(event);
  }

  start() {
    // 某些扩展在终端 UI 之外也会读 SDK 全局主题 必须先初始化
    initTheme();
    this.unsubscribe = this.inner.subscribe((event) => {
      this.resetIdleTimer();
      if (event.type === "agent_end" || event.type === "session_info_changed") {
        invalidateSessionListCache();
      }
      this.emit(event);
    });
    this.resetIdleTimer();
  }

  private resetIdleTimer() {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    // 10 分钟无活动销毁 wrapper 再次请求会从文件重建 天然的资源回收
    this.idleTimer = setTimeout(() => this.destroy(), IDLE_RECYCLE_MS);
  }

  private finishPrompt() {
    this.pendingPromptCount = Math.max(0, this.pendingPromptCount - 1);
    this.resetIdleTimer();
    invalidateSessionListCache();
  }

  destroy() {
    if (!this._alive) return;
    this._alive = false;
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.unsubscribe?.();
    try { this.inner.dispose(); } catch { /* 已销毁时忽略 */ }
    registry.delete(this.sessionId);
  }

  async send(command: Record<string, unknown>): Promise<unknown> {
    const type = command.type as string;
    // get_state 只是状态查询 不推迟空闲回收
    if (type !== "get_state") this.resetIdleTimer();

    switch (type) {
      case "prompt":
        return this.sendPrompt(command);

      case "abort":
        await this.inner.abort();
        return null;

      case "get_state": {
        const model = this.inner.model;
        const contextUsage = this.inner.getContextUsage();
        return {
          sessionId: this.inner.sessionId,
          sessionFile: this.inner.sessionFile ?? "",
          isStreaming: this.inner.isStreaming,
          isCompacting: this.inner.isCompacting,
          model: model ? { id: model.id, provider: model.provider } : undefined,
          thinkingLevel: this.inner.agent.state?.thinkingLevel ?? "off",
          contextUsage: contextUsage
            ? { percent: contextUsage.percent, contextWindow: contextUsage.contextWindow, tokens: contextUsage.tokens }
            : null,
        };
      }

      case "navigate_tree": {
        const targetId = command.targetId as string;
        return await this.inner.navigateTree(targetId, {});
      }

      case "set_session_name": {
        const name = command.name as string;
        this.inner.setSessionName(name);
        invalidateSessionListCache();
        return null;
      }

      case "fork":
        throw new Error("fork is not implemented yet");

      default:
        throw new Error(`Unknown command type: ${String(type)}`);
    }
  }

  // prompt 的 RPC 契约 prompt 的 Promise 在整轮 run 结束才 resolve
  // 而 preflightResult true 在同步校验与扩展预检通过时回调
  // HTTP 响应在 preflight 通过后就返回 先 ack 剩余进度全部走 SSE
  private async sendPrompt(command: Record<string, unknown>): Promise<unknown> {
    this.pendingPromptCount += 1;
    let accepted = false;
    let accept!: () => void;
    let rejectFn!: (e: unknown) => void;
    const preflight = new Promise<void>((resolve, reject) => {
      accept = () => { accepted = true; resolve(); };
      rejectFn = reject;
    });
    let prompt: Promise<void>;
    try {
      prompt = this.inner.prompt(String(command.message), {
        ...(Array.isArray(command.images) ? { images: command.images as Array<{ type: "image"; data: string; mimeType: string }> } : {}),
        source: "rpc",
        preflightResult: (ok: boolean) => { if (ok) accept(); },
      });
    } catch (e) {
      // 同步抛错也必须走 finishPrompt 否则 pendingPromptCount 泄漏 wrapper 永远显示运行中
      this.finishPrompt();
      throw e;
    }

    void prompt.then(
      () => {
        accept();
        this.finishPrompt();
        // prompt_done 是 wrapper 自己 emit 的 SDK 不发
        // 前端靠它区分 POST 返回了 和 run 结束了
        this.emit({ type: "prompt_done" });
      },
      (e) => {
        rejectFn(e);
        this.finishPrompt();
        // preflight 阶段的拒绝由 POST 本身返回 只有接受后的意外失败才走异步事件
        if (accepted) {
          this.emit({ type: "prompt_error", errorMessage: String((e as Error)?.message ?? e) });
          this.emit({ type: "prompt_done" });
        }
      },
    );

    await preflight;
    return null;
  }
}

const registry = new Map<string, AgentSessionWrapper>();
const locks = new Map<string, Promise<{ session: AgentSessionWrapper; realSessionId: string }>>();

export async function startRpcSession(
  sessionId: string,
  sessionFile: string,
  cwd?: string,
): Promise<{ session: AgentSessionWrapper; realSessionId: string }> {
  const existing = registry.get(sessionId);
  if (existing?.isAlive()) return { session: existing, realSessionId: sessionId };

  const inflight = locks.get(sessionId);
  if (inflight) return inflight;

  const starting = (async () => {
    const sessionManager = sessionFile
      ? SessionManager.open(sessionFile)
      : SessionManager.create(cwd!);
    // 会话文件头里的 cwd 才是权威的 不能用调用方传入的 cwd
    const sessionCwd = sessionManager.getCwd();
    const agentDir = getAgentDir();
    const settingsManager = SettingsManager.create(sessionCwd, agentDir);
    const services = await createAgentSessionServices({ cwd: sessionCwd, agentDir, settingsManager });
    const { session } = await createAgentSessionFromServices({ services, sessionManager });
    const wrapper = new AgentSessionWrapper(session);
    wrapper.start();
    const realId = session.sessionId;
    registry.set(realId, wrapper);
    return { session: wrapper, realSessionId: realId };
  })().finally(() => locks.delete(sessionId));

  locks.set(sessionId, starting);
  return starting;
}

// 新会话的一次性启动 key 真实 id 在 createAgentSessionFromServices 之后才存在
// 两个新建请求若共享 key 会被锁合并成一个会话
export function newSessionTempKey(): string {
  return `__new__${randomUUID()}`;
}

export function getRpcSession(id: string) { return registry.get(id); }

export function listRpcSessions(): AgentSessionWrapper[] { return [...registry.values()]; }

export function destroyAllRpcSessions() {
  for (const w of [...registry.values()]) w.destroy();
}
