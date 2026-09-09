# 03 · Step 1：后端核心（AgentSession 管理 + API + SSE）

> 目标：后端全部就绪——能创建会话、发 prompt、吐 SSE 流。本步骤用 curl 就能完整验收，不碰前端。
> 开始前先读：pi-web `lib/rpc-manager.ts` 行 1925–2118（startRpcSession）、行 542–720（send 的 prompt/abort/get_state 分支）、`lib/agent-event-wire.ts` 全文、`lib/agent-event-stream.ts` 全文、`lib/session-reader.ts` 行 397–511。

## 1. shared/lib/：类型与纯函数移植

> 移植即「实质性复制」，MIT 要求随附版权与许可声明：每个移植文件**头部加来源注释**（`// Ported from pi-web lib/xxx.ts — https://github.com/agegr/pi-web (MIT)`），并在项目根维护 `THIRD_PARTY_NOTICES.md`（列出全部衍生文件 + 附 pi-web 的 MIT 许可原文）。README 里的一句致谢不能替代这个。

**`shared/lib/types.ts`** —— 从 pi-web `lib/types.ts` 移植以下类型（删掉 CustomMessage、ExtensionUiRequest/Response、子代理相关；其余保留）：

- `SessionHeader`、`SessionEntryBase`
- 内容块：`TextContent`、`ImageContent`、`ThinkingContent`、`ToolCallContent`、`AssistantContentBlock`
- 消息：`UserMessage`、`AgentUsage`、`AssistantMessage`、`ToolResultMessage`、`BashExecutionMessage`、`AgentMessage`
- entry：`SessionMessageEntry`、`ModelChangeEntry`、`ThinkingLevelChangeEntry`、`CompactionEntry`、`SessionInfoEntry`、`LabelEntry`、`SessionEntry`（`FileEntry` 可不要）
- `SessionInfo`（删 relation/projectRoot/projectKey/branch/isWorktree/transient，保留 path/id/cwd/name?/created/modified/messageCount/firstMessage）
- `SessionContext`（messages、entryIds、oldestEntryId、hasMore、thinkingLevel、model）

**`shared/lib/normalize.ts`** —— pi-web `lib/normalize.ts` **原样移植**（63 行）。这是最容易漏的一步：不 normalize，历史里的 toolCall 块（`id/name/arguments` 字段名）在前端就是空卡片。

**`shared/lib/agent-event-wire.ts`** —— pi-web `lib/agent-event-wire.ts` 移植：`AgentEventLike`、`toClientAgentEvent`、`isEventIncludedInSnapshot`、以及两个客户端事件类型 `ClientAssistantMessageEvent` / `ClientMessageUpdateEvent`。唯一的改动：删掉 `import type { JsonAgentSessionEvent } from "@earendil-works/pi-coding-agent"`，把那几个 `Extract<JsonAgentSessionEvent, ...>` 类型替换为手写的最小结构（只需要 `assistantMessageEvent` 上的 `type` / `partial` / `contentIndex` / `content` 字段，参考原文件的 `toolCallMetadata` 用法）。

**`shared/lib/streaming-message.ts`、`shared/lib/agent-event-connection.ts`、`shared/lib/agent-client.ts`** —— pi-web 对应文件**原样移植**（本步骤先拷贝过去，前端 Step 2 才用到；确认它们不 import 任何 pi 包/React——它们确实没有）。

## 2. server/utils/session-reader.ts：会话文件读取

四个函数 + 一个 30 秒列表缓存。参考 pi-web `lib/session-reader.ts`。

### 2.1 读文件头（只读首行，64KB 上限）

```ts
import { SessionManager, getAgentDir } from "@earendil-works/pi-coding-agent";
import { closeSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import type { SessionEntry, SessionHeader } from "#shared/lib/types";

export function readSessionHeader(filePath: string): SessionHeader | null {
  // 从 pi-web session-reader.ts 移植 readBoundedLines(filePath, 64 * 1024, 1)
  // 取首行 JSON.parse，type === "session" 才返回
}
```

### 2.2 列出全部会话

```ts
export async function listSessions(): Promise<SessionInfo[]> {
  // 1. sessionsDir = join(getAgentDir(), "sessions")
  // 2. readdir 一层：每个子目录是一个项目（目录名是编码后的 cwd，不用解码，header 里有原始 cwd）
  // 3. 每个子目录 readdir *.jsonl：对每个文件 readSessionHeader + statSync(mtime)
  // 4. firstMessage：readBoundedLines(file, 64KB, 40) 读前 40 行，
  //    取第一个 role==="user" 的 message entry 文本前 80 字符
  // 5. name：⚠️ session_info（重命名）是【追加在文件末尾】的，前 40 行读不到——
  //    用 readBoundedTailLines(file, 64KB)（pi-web session-reader.ts 有现成实现，一并移植）
  //    取最近一条带 name 的 session_info（忽略分支语义，列表展示够用；
  //    权威值以详情接口的 sm.getSessionName() 为准）
  // 6. messageCount：MVP 直接 0（详情页才有真实值）；排序：modified 倒序
  // 7. 结果缓存 30 秒（一个模块级 { data, ts } 即可）；提供 invalidateSessionListCache()
}
```

> pi-web 用增量扫描器（`lib/session-list-scanner.ts`）做这件事。MVP 全量扫描几百个文件的头 64KB 完全够快；缓存失效点：prompt 结束、agent_end、重命名、新建会话。

### 2.3 按 id 找会话文件

```ts
export async function resolveSessionPath(sessionId: string): Promise<string | null> {
  // 会话文件名以 `_${sessionId}.jsonl` 结尾。
  // 校验 sessionId 格式（/^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$/，防路径穿越）
  // 扫描 sessionsDir/*/*_{sessionId}.jsonl，再 readSessionHeader 确认 header.id === sessionId
}
```

### 2.4 构建消息上下文（分支感知）

移植 pi-web `session-reader.ts` 的 `buildSessionContext` + `sliceActiveBranch` + `getSessionSettings`（行 413–511），改动：

- 去掉 `deferThinking` / `deferToolResultImages` / `tail` / `before` / `excludeLeaf` 参数（`sliceActiveBranch` 的 `tail` 传 `entries.length`，即取全部分支）
- `entryToUiMessage` 精简为：`entry.type === "message"` → `normalizeToolCalls(entry.message)`；assistant 的旧格式字符串 content 包成 `[{type:"text",text}]`；其余 entry 类型返回 null
- 保留 `entryIds` 平行数组的生成（前端分支功能依赖它）

`getSessionSettings`（沿 parentId 向上找最近的 model_change/thinking_level_change）也要移植——详情接口要返回当前生效模型。

## 3. server/utils/rpc-manager.ts：AgentSessionWrapper

参考 pi-web `lib/rpc-manager.ts`，**只保留骨架语义**。约 300 行，核心结构：

```ts
import { createAgentSessionFromServices, createAgentSessionServices, getAgentDir,
         initTheme, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import type { AgentEventLike } from "#shared/lib/agent-event-wire";

type EventListener = (event: AgentEventLike) => void;

export class AgentSessionWrapper {
  private listeners = new Set<EventListener>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPromptCount = 0;
  private _alive = true;
  private unsubscribe: (() => void) | null = null;

  constructor(public readonly inner: /* AgentSession 实例，类型参考 pi-web lib/pi-types.ts 的 AgentSessionLike 精简版 */) {}

  get sessionId() { return this.inner.sessionId; }
  get sessionFile() { return this.inner.sessionFile ?? ""; }
  get isStreaming() { return this.inner.isStreaming; }
  get streamingMessage() { return this.inner.agent.state?.streamingMessage; }
  isAlive() { return this._alive; }
  isRunning() { return this._alive && (this.pendingPromptCount > 0 || this.inner.isStreaming); }

  onEvent(listener: EventListener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(event: AgentEventLike) { for (const l of this.listeners) l(event); }

  start() {
    initTheme();                     // 若 Step 0 没在全局做过，这里兜底（扩展会读 SDK 全局主题）
    this.unsubscribe = this.inner.subscribe((event) => {
      this.resetIdleTimer();
      this.emit(event as AgentEventLike);
    });
    this.resetIdleTimer();
  }

  private resetIdleTimer() { /* clearTimeout + setTimeout(() => this.destroy(), 10 * 60_000) */ }

  destroy() {
    if (!this._alive) return;
    this._alive = false;
    clearTimeout(this.idleTimer!);
    this.unsubscribe?.();
    try { this.inner.dispose(); } catch { /* ignore */ }
    registry.delete(this.sessionId);
  }

  async send(command: Record<string, unknown>): Promise<unknown> {
    // 命令分发，见 3.2
  }
}
```

### 3.1 注册表与启动（对应 pi-web startRpcSession）

```ts
const registry = new Map<string, AgentSessionWrapper>();          // key = 真实会话 id
const locks = new Map<string, Promise<WrapperStarted>>();         // 并发启动去重

export async function startRpcSession(
  sessionId: string,          // 已有会话传真实 id；新会话传 `__new__${randomUUID()}`
  sessionFile: string,        // 已有会话传文件路径；新会话传 ""
  cwd: string | undefined,    // 新会话必传
): Promise<{ session: AgentSessionWrapper; realSessionId: string }> {
  const existing = registry.get(sessionId);
  if (existing?.isAlive()) return { session: existing, realSessionId: sessionId };
  const inflight = locks.get(sessionId);
  if (inflight) return inflight;

  const starting = (async () => {
    const sessionManager = sessionFile
      ? SessionManager.open(sessionFile)
      : SessionManager.create(cwd!);                    // 新会话：cwd 必填
    const agentDir = getAgentDir();
    const settingsManager = SettingsManager.create(sessionManager.getCwd(), agentDir);
    const services = await createAgentSessionServices({ cwd: sessionManager.getCwd(), agentDir, settingsManager });
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

export function getRpcSession(id: string) { return registry.get(id); }
export function destroyAllRpcSessions() { for (const w of [...registry.values()]) w.destroy(); }
```

> 为什么新会话用一次性 tempKey：真实 id 在 `createAgentSessionFromServices` 之后才存在，而锁/注册表都以 id 为键。两个「新建会话」请求若共享 key 会被合并成一个会话（pi-web 注释里点名的坑）。

### 3.2 命令分发 `send()`（MVP 支持的命令）

| type | 参数 | 实现 |
|---|---|---|
| `prompt` | `{message, images?}` | 见下方 preflight 模式 |
| `abort` | — | `await inner.abort()` |
| `get_state` | — | 组装运行状态对象（下） |
| `navigate_tree` | `{targetId}` | `await inner.navigateTree(targetId, {})` |
| `set_session_name` | `{name}` | `inner.setSessionName(name)` + 失效列表缓存 |
| `fork` | `{entryId}` | Step 4 再实现，先抛 not implemented |

`get_state` 返回（前端要用的字段）：

```ts
{
  sessionId, sessionFile, isStreaming, isCompacting: inner.isCompacting,
  model: inner.model ? { id, provider } : undefined,
  thinkingLevel: inner.agent.state?.thinkingLevel ?? "off",
  contextUsage: inner.getContextUsage() ?? null,   // {percent, contextWindow, tokens}
}
```

**prompt 的 preflight 模式**（pi-web `rpc-manager.ts` 行 569–662 的精简版，务必保留语义）：

```ts
case "prompt": {
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
      ...(Array.isArray(command.images) ? { images: command.images } : {}),
      source: "rpc",
      preflightResult: (ok: boolean) => { if (ok) accept(); },
    });
  } catch (e) { this.finishPrompt(); throw e; }

  void prompt.then(
    () => { accept(); this.finishPrompt(); this.emit({ type: "prompt_done" }); },
    (e) => { rejectFn(e); this.finishPrompt();
             if (accepted) { this.emit({ type: "prompt_error", errorMessage: String((e as Error)?.message ?? e) });
                             this.emit({ type: "prompt_done" }); } },
  );

  await preflight;   // HTTP 响应在「提交被接受」时返回，不等整个 run
  return null;
}
// finishPrompt(): pendingPromptCount--、resetIdleTimer()
```

三个关键点（都来自 pi-web 的踩坑记录）：

1. **`prompt_done` 是 wrapper 自己 emit 的**，SDK 不发。前端靠它区分「POST 返回了」和「run 结束了」。
2. **先 ack 后完成**：prompt() 的 Promise resolve 是整轮结束；HTTP 握手在 preflight 通过即返回，剩余进度全部走 SSE。
3. 同步抛错（如非法 images）必须 `finishPrompt()` 再 throw，否则 pendingPromptCount 泄漏、wrapper 永远显示「运行中」。

### 3.3 进程退出清理（Nitro 插件）

`server/plugins/cleanup.ts`：

```ts
import { destroyAllRpcSessions } from "../utils/rpc-manager";

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("close", () => destroyAllRpcSessions());
});
```

## 4. server/utils/event-stream.ts：SSE 通道

pi-web `lib/agent-event-stream.ts` 的 `createAgentEventStream` **近乎原样移植**（132 行），只改类型 import 路径（`#shared/lib/agent-event-wire`）。签名：

```ts
export function createAgentEventStream(
  signal: AbortSignal,
  sessionId: string,
  sessionPromise: Promise<{ isStreaming: boolean; streamingMessage: unknown;
                            onEvent(l: (e: AgentEventLike) => void): () => void }>,
): ReadableStream<Uint8Array>
```

它已经实现了三件必须保留的事：先开流后握手（`connected` 事件）、缓冲握手前的 early 事件、流式中连接则补发 `message_start` 快照、30 秒心跳、abort 清理。配套移植 `isEventIncludedInSnapshot`（避免快照与缓冲事件双发）。

## 5. 路由（Nitro 文件路由，全部 server/api/ 下）

**命令式 API 与 pi-web 保持同构**（`POST /api/agent/:id` body 里 `type` 分发），前端因此几乎不用改 `shared/lib/agent-client.ts`。

错误响应统一保持 pi-web 契约 `{ error: string }`（`shared/lib/agent-client.ts` 按这个解析），**不要**用 `createError` 的默认错误体——用 `setResponseStatus(event, 4xx/5xx); return { error: "..." }`。

| 文件 | 对应接口 |
|---|---|
| `server/api/sessions/index.get.ts` | GET /api/sessions（列表，`?force=1` 跳缓存） |
| `server/api/sessions/index.post.ts` | POST /api/sessions（**创建空会话**，不发消息） |
| `server/api/sessions/[id].get.ts` | GET /api/sessions/:id（详情） |
| `server/api/agent/running.get.ts` | GET /api/agent/running |
| `server/api/agent/[id]/index.get.ts` | GET /api/agent/:id（运行状态） |
| `server/api/agent/[id]/index.post.ts` | POST /api/agent/:id（命令分发） |
| `server/api/agent/[id]/events.get.ts` | GET /api/agent/:id/events（SSE） |

> 文件路由按精确路径优先匹配，`running.get.ts` 与 `[id]/...` 不会打架（Nitro 自动处理，pi-web 里"路由注册顺序"的坑在这里天然不存在）。

### 创建会话 `sessions/index.post.ts`

```ts
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { startRpcSession } from "../../utils/rpc-manager";
import { invalidateSessionListCache } from "../../utils/session-reader";

// 只创建空会话，不发消息。首条 prompt 必须由前端在 SSE 建连后单独 POST——
// 时序原因见陷阱 4，别把 message 参数加回来。
export default defineEventHandler(async (event) => {
  const body = await readBody<{ cwd?: string }>(event);
  const cwd = body?.cwd;
  if (!cwd || typeof cwd !== "string" || !existsSync(cwd)) {
    setResponseStatus(event, 400);
    return { error: cwd ? `Directory does not exist: ${cwd}` : "cwd is required" };
  }
  try {
    const tempKey = `__new__${randomUUID()}`;        // 一次性 key，防并发合并
    const { session, realSessionId } = await startRpcSession(tempKey, "", cwd);
    invalidateSessionListCache();
    const state = await session.send({ type: "get_state" }) as { model?: { id: string; provider: string }; thinkingLevel?: string };
    return { success: true, sessionId: realSessionId, model: state.model ?? null, thinkingLevel: state.thinkingLevel };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
```

### 详情 `sessions/[id].get.ts`

```ts
// 1. wrapper 存活 → 用 wrapper.inner.sessionManager；否则 resolveSessionPath → SessionManager.open
// 2. entries = sm.getEntries()
// 3. context = buildSessionContext(entries, sm.getLeafId())     // 当前活跃分支
// 4. 返回 { info: {...header + mtime + sm.getSessionName() + messageCount}, context, activeLeafId: sm.getLeafId() }
```

### 命令分发 `agent/[id]/index.post.ts`

```ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const command = await readBody<Record<string, unknown>>(event);
  try {
    const existing = getRpcSession(id);
    if (existing?.isAlive()) {
      return { success: true, data: await existing.send(command) };
    }
    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      setResponseStatus(event, 404);
      return { error: "Session not found" };
    }
    const { session } = await startRpcSession(id, filePath);
    return { success: true, data: await session.send(command) };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
```

### 运行状态 `agent/[id]/index.get.ts`

```ts
// wrapper 不存在/不存活 → { running: false }
// 否则 → { running: true, state: await wrapper.send({ type: "get_state" }) }
```

### SSE `agent/[id]/events.get.ts`

```ts
export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id")!;
  const session = getRpcSession(id);
  const sessionPromise = session?.isAlive()
    ? Promise.resolve(session)
    : resolveSessionPath(id).then((file) => {
        if (!file) throw new Error("Session not found");
        return startRpcSession(id, file).then((r) => r.session);
      });

  // h3 暴露的是 Node req；用 'close' 派生一个等价于 Request.signal 的中止信号
  const abort = new AbortController();
  event.node.req.on("close", () => abort.abort());

  const stream = createAgentEventStream(abort.signal, id, sessionPromise);
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  } });
});
```

> h3 与 Next 路由同为 Web 标准 API：直接 `return new Response(ReadableStream)` 即可。若你的 Nuxt/h3 版本对此行为异常（表现为连接立即关闭或 406），退路是 `event.node.res` 手写 SSE（`res.writeHead(200, headers)` + `res.write("data: ...\n\n")`），但先试标准 Response，大概率一次过。

### 运行中列表 `agent/running.get.ts`

```ts
// { sessionIds: 所有 isAlive() && isRunning() 的 wrapper.sessionId }
```

## 6. 本步骤的陷阱清单

1. **Windows 路径**：`SessionManager`/git 吐出来的是 POSIX 风格路径。任何路径比较用 `path.resolve()` 归一后再比，不要 `===`（pi-web AGENTS.md 专门记了这个 bug：worktree 切换器在 Windows 上永久消失）。
2. **SSE 事件要过 `toClientAgentEvent`**：直接把 SDK 原始事件转发会在 `message_update` 里带上巨大的 `partial` 字段（每次全量内容），流量和 CPU 都会爆炸。
3. **新会话的 cwd 必须存在**：路由层先 `existsSync` 拦截。
4. **创建与首条 prompt 必须是两次请求**：前端先 `POST /api/sessions`（空会话）→ 页面打开 → SSE `connected` → 再 POST prompt。pi-web 的「创建+发消息一步完成」依赖它完整的对账机制（运行中轮询、run-id 丢弃迟到事件、prompt_done 触发 reload）兜底；本项目砍掉了对账，合并回去必然偶发丢掉首轮流式事件（短回复整个消失）。别合并。
5. **改 server 代码时 Nitro 会重启 worker**，运行中的会话随之中断——这是开发期已知代价，不需要修；重启后前端 SSE 自动重连，会话从文件恢复（前提是 `resolveSessionPath` 正确工作，验收第 3 条覆盖它）。若出现热更后注册表「既丢又残留」的怪象，把 `registry` 挂到 `globalThis`（pi-web 方案）。
6. 会话结束（agent_end）后记得 `invalidateSessionListCache()`，否则列表页的新会话 30 秒内不出现。
7. pi 包必须留在 Step 0 配好的 `nitro.externals.external` 里——任何人（包括 AI）往里加打包优化时先检查这条。

## 7. 验收（5 分钟冒烟——目标是抓核心链路 bug，不是全面回归）

> curl 在 **Git Bash** 执行（PowerShell 的 `curl` 是 `Invoke-WebRequest` 别名，语法不通用）。

1. **主路径（创建 → SSE → 流式）**，三条命令按序：
   ```bash
   # ① 创建空会话（不发消息——首条 prompt 必须等 SSE 建连后单独发，见陷阱 4）
   curl -X POST http://127.0.0.1:3000/api/sessions -H "content-type: application/json" \
     -d '{"cwd":"D:/project/pi-web"}'
   # ② 另一个终端挂事件流，应立即看到 connected
   curl -N http://127.0.0.1:3000/api/agent/<id>/events
   # ③ 发首条消息
   curl -X POST http://127.0.0.1:3000/api/agent/<id> -H "content-type: application/json" \
     -d '{"type":"prompt","message":"数到3"}'
   ```
   SSE 终端应按序出现 `connected` → `message_start` → `message_update`（text_delta）→ `message_end` → `agent_settled` → `prompt_done`，且 `~/.pi/agent/sessions/` 下出现新 `.jsonl` 文件（里面有 user 和 assistant 两行消息）。
2. **停止**：再 prompt「写一首 500 行的诗」，随后 POST `{"type":"abort"}` 到 `/api/agent/<id>` → SSE 数秒内出现 `agent_end`，文件不再增长。
3. **重启恢复**：重启 dev server → `GET /api/sessions` 仍列出该会话 → POST prompt 能继续对话（证明会话从文件恢复、`resolveSessionPath` 正常）。
4. 顺手：`npm run typecheck`。

详情/列表接口的字段细节不用单独验证——Step 2 的浏览器联调会立刻暴露它们的问题。

全部通过后回 [README](./README.md) 勾选 Step 1，进入 [04-frontend-core.md](./04-frontend-core.md)。
