# 01 · 架构与前置知识

> 阅读本文不需要先读 pi-web 源码，但写代码前应读完。文中所有「参考文件」均相对 `D:\project\pi-web`。

## 1. 目标与范围

**做**：会话创建/恢复、prompt 发送、SSE 流式渲染、工具调用与思考过程可视化、停止、会话列表（以上构成**里程碑 A：首个可演示版本**）；重命名、会话内分支 edit-from-here + 分支切换（**里程碑 B：差异化增强**）。fork、删除、单测、终端等在 `07-optional.md` 加分项。

**不做**（写代码时如果发现自己在做这些，立即停下）：

- 扩展 UI 对话框（extension_ui_request 的 select/confirm/input 弹窗体系）
- 子代理（subagents）、插件/技能管理界面、git worktrees、终端面板、web push、PWA、i18n
- pi-web 的「Chat only」工具预设、模型作用域（enabledModels 解析）、模型发现/OAuth 登录界面
- 游标分页（tail/before）、思考内容延迟加载、工具结果图片惰性加载

这些在 `07-optional.md` 有一页纸说明，面试时能讲出「我知道 pi-web 是怎么做的」即可。

## 2. 技术选型与理由

**Nuxt 4 全栈单项目**（前端 + server routes 同仓库、一条命令），`ssr: false`：

- **叙事与技能匹配（首要原因）**：项目定位是「Vue 全栈 + Agent」。React 选手写「Next.js 全栈 + Agent」，Vue 阵营的对应物就是 Nuxt——简历一句话说清，且 Nuxt 本身是 Vue 生态里值得学的框架。
- **pi-web 的路由代码可平移**：Nuxt 底层 h3 与 Next API 路由同用 Web 标准 API（标准 `Request` 进、`Response` 出），`return new Response(readableStream, {...})` 的 SSE 写法照搬 pi-web。
- **`shared/` 是 Nuxt 4 的一等目录**：两端共享纯函数层（类型、normalize、流式 reducer、SSE 连接管理）放根目录 `shared/lib/`，用 `#shared/lib/...` 引用——正好承载本项目的移植层。
- **一个进程一条命令**：没有 concurrently、没有 Vite proxy，`/api` 天然同源。

两个刻意决定与代价（都写进 nuxt.config，Step 0 一次配好）：

1. **`ssr: false`**：聊天 SPA 没有 SEO/首屏需求（pi-web 也是纯 CSR）。开着 SSR 只会引入 EventSource/localStorage 的水合麻烦，零收益。
2. **pi SDK 必须排除出 Nitro 打包**：四个 `@earendil-works/pi-*` 是纯 ESM + 内嵌 WASM（photon 图像处理）的重包，pi-web 在 Next 里同样要配 `serverExternalPackages`（见其 `next.config.ts`）。本项目在 `nitro.externals.external` 里排除这四个包 + undici，并在 Step 0 用 `/api/sdk-check` 冒烟路由**第一时间验证**——这是全项目唯一的技术风险点，前置到脚手架阶段排除。

渲染选 markdown-it + highlight.js（对应 pi-web 的 react-markdown + react-syntax-highlighter）：框架无关库，Vue 里 `v-html` 一次渲染。（进阶可换 Shiki，见 07。）

Pinia：`sessions` + `chat` 两个 store，把 pi-web 的 `useAgentSession`（2098 行 React hook）拆成 store + 纯函数。

## 3. 总体架构

```
浏览器 (Vue 3 SPA, http://127.0.0.1:3000, Nuxt dev)
  │  同源 fetch / EventSource：/api/...（无代理层）
  ▼
Nuxt 4 服务端 (Nitro)                       shared/lib/（两端共用纯函数）
  ├─ server/api/sessions/…       会话 CRUD ──┐
  ├─ server/api/agent/[id]       命令分发 ────┤
  ├─ server/api/agent/[id]/events  SSE 事件流 ◀┤   types.ts / normalize.ts
  │                                         ┘   streaming-message.ts
  ├─ server/utils/rpc-manager.ts  AgentSessionWrapper 注册表     agent-event-wire.ts
  │      │  （Map + 启动锁 + 10 分钟空闲回收）                   agent-event-connection.ts
  │      ▼
  │   pi SDK: AgentSession（进程内运行 agent 循环）
  │      │  读写
  ▼      ▼
~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl
（pi CLI / pi-web / 本项目 共享同一份会话文件与配置）
```

关键心智模型：

1. **Agent 执行发生在服务器进程内**。浏览器不发任何 LLM 请求；它只 POST 命令、收 SSE 事件。
2. **会话即文件**。每个会话是一个 `.jsonl` 文件，逐行追加。服务器重启后会话不丢——按需从文件重新加载。
3. **SSE 是唯一的推送通道**。浏览器对每个活跃会话维持一条 EventSource 长连接。

## 4. pi 核心概念

### 4.1 会话文件格式（`.jsonl`）

位置：`~/.pi/agent/sessions/<cwd 编码后的目录名>/<时间戳>_<uuid>.jsonl`。首行是 session 头，其后每行一个 entry，通过 `parentId` 链成**树**（不只是链表——分支就是从同一个 parentId 长出的兄弟节点）：

```jsonl
{"type":"session","version":3,"id":"<uuid>","timestamp":"...","cwd":"D:\\proj","parentSession":"/abs/path.jsonl"}
{"type":"model_change","id":"a1b2","parentId":null,"provider":"anthropic","modelId":"claude-..."}
{"type":"message","id":"c3d4","parentId":"a1b2","message":{"role":"user","content":"帮我看看这个项目"}}
{"type":"message","id":"e5f6","parentId":"c3d4","message":{"role":"assistant","content":[{"type":"thinking","thinking":"..."},{"type":"text","text":"..."},{"type":"toolCall","id":"t1","name":"read","arguments":{...}}],"model":"...","provider":"..."}}
{"type":"message","id":"f7a8","parentId":"e5f6","message":{"role":"toolResult","toolCallId":"t1","content":[{"type":"text","text":"..."}]}}
{"type":"session_info","id":"...","parentId":"...","name":"用户起的名字"}
```

要点：

- **文件里的 toolCall 字段名**是 `{id, name, arguments}`，而**运行时/前端类型**用 `{toolCallId, toolName, input}`。`normalizeToolCalls()`（pi-web `lib/normalize.ts`）双向兼容两种字段名，**读文件和收流式事件两条路径都必须过这个函数**，否则工具卡片时有时无。
- `entryIds[]` 与 `messages[]` 是平行数组：前端渲染的第 i 条消息对应文件里的第 `entryIds[i]` 个 entry。分支操作（navigate_tree / fork）需要的是 **entryId**，不是消息下标。
- 非消息 entry（`model_change`、`thinking_level_change`、`compaction`、`session_info`、`label`）不直接渲染，但参与「当前有效模型/思考级别」的推导（沿 parentId 向上找最近的对应 entry）。

完整类型定义**直接移植** pi-web `lib/types.ts`（精简掉 CustomMessage/子代理相关后约 150 行），这是本项目的 `shared/lib/types.ts`。

### 4.2 AgentSession 生命周期

pi-web `lib/rpc-manager.ts`（2118 行，本项目精简到约 300 行）的职责：

1. **一个会话 id 对应一个 `AgentSessionWrapper`**，存在模块级 Map。并发请求同一会话时用「启动锁」（`Map<string, Promise>`）合并重复创建。
2. **创建新会话**（pi-web `rpc-manager.ts:1925-2118`，核心 SDK 调用）：

```ts
import { createAgentSessionFromServices, createAgentSessionServices,
         getAgentDir, SessionManager, SettingsManager, initTheme } from "@earendil-works/pi-coding-agent";

initTheme();                                          // 全局一次性
const agentDir = getAgentDir();                       // ~/.pi/agent
const sessionManager = SessionManager.create(cwd);    // 新会话（无文件）
// 恢复已有会话则是 SessionManager.open(sessionFile)
const settingsManager = SettingsManager.create(cwd, agentDir);
const services = await createAgentSessionServices({ cwd, agentDir, settingsManager });
const { session } = await createAgentSessionFromServices({ services, sessionManager });
const realSessionId = session.sessionId;              // 新会话的 id 由 SDK 生成，创建前不知道
```

3. **事件订阅**：`session.subscribe(event => ...)` 返回退订函数。wrapper 把事件转发给所有 SSE 连接。
4. **发送 prompt**：`session.prompt(text, { source: "rpc", preflightResult: cb })`。注意 pi 的 RPC 契约：**prompt() 的 Promise 在整个 run 结束时才 resolve**，而 `preflightResult(true)` 在「同步校验+扩展预检通过」时回调——HTTP 响应应该在 preflight 通过后就返回（先 ack，结果走 SSE）。参考 pi-web `rpc-manager.ts` `case "prompt"` 的 preflight Promise 模式。
5. **空闲回收**：10 分钟无活动 `dispose()` 掉 wrapper。任何事件和命令都会重置计时器。回收后再次请求会从文件重建——这是天然的资源回收机制。

常用 SDK 方法（完整接口见 pi-web `lib/pi-types.ts` 的 `AgentSessionLike`，200 行，值得通读）：

| 方法 | 用途 |
|---|---|
| `prompt(text, opts)` / `abort()` | 发消息 / 停止 |
| `subscribe(fn)` | 事件流 |
| `isStreaming` / `agent.state?.streamingMessage` | 是否在流式中 / 当前流式消息快照 |
| `navigateTree(targetId)` | 会话内回退/切分支（targetId 成为新叶子） |
| `setModel(model)` / `setThinkingLevel(level)` | 运行中切换 |
| `setSessionName(name)` | 重命名 |
| `sessionManager.getEntries() / getBranch(leafId?) / getLeafId() / getTree()` | 读会话树 |
| `compact(customInstructions?)` | 压缩上下文 |

**与 pi-web 的差异**：pi-web 把注册表挂在 `globalThis.__piSessions`，因为 Next.js 热重载会替换模块但保留进程。本项目在 Nuxt dev 下改 server 代码时 Nitro 会重启 worker（等效于整进程重启），模块级 Map 就够了（代价：重启会杀掉运行中的会话，dev 可接受）。若你的 Nuxt 版本出现热更后 Map 丢失/重复的怪象，套用 pi-web 的 globalThis 方案即可。

### 4.3 SDK 事件流与 SSE 线上格式

SDK 会话事件（`session.subscribe` 收到的）经过 pi-web 的**线上过滤器**（`lib/agent-event-wire.ts` 的 `toClientAgentEvent`，纯函数，直接移植）再发给浏览器：

- 丢弃 `turn_start` / `turn_end`；
- `message_update` 携带的 `assistantMessageEvent` 里剔除巨大的 `partial` 字段，把 toolcall 的 `id`/`toolName` 提升到事件顶层；
- `tool_execution_update` 只保留 `{type, toolCallId, toolName, partialResult}`；
- `agent_end` 只保留 `{type}`。

浏览器需要处理的事件（完整语义见 Step 2 的 store 实现）：

| 事件 | 载荷 | 前端动作 |
|---|---|---|
| `connected` | `{sessionId, isStreaming}` | SSE 握手成功（服务端连上后才发） |
| `startup_error` | `{errorMessage}` | 会话启动失败，停止重连 |
| `agent_start` | — | 标记 run 开始 |
| `message_start` | `{message}` | 用户消息快照（忽略）；**assistant 流式快照**（重连时恢复流式气泡） |
| `message_update` | `{assistantMessageEvent}` | 增量：`text_start/delta/end`、`thinking_start/delta/end`、`toolcall_start/delta/end` |
| `message_end` | `{message}` | 一条完整消息定稿 → 追加进历史 |
| `tool_execution_start/update/end` | `{toolCallId, toolName, partialResult?}` | 「正在执行工具」状态条 |
| `agent_end` | — | 本轮 run 结束（但 run 可能未完：重试/压缩/排队消息） |
| `agent_settled` | — | agent 完全安静 → UI 落定 |
| `prompt_done` | — | **pi-web wrapper 自发**（SDK 不发），prompt 的 POST 生命周期结束 |
| `prompt_error` | `{errorMessage}` | prompt 在接受后失败 |
| `compaction_start/end`、`auto_compaction_*` | — | 上下文压缩中（新旧两套事件名都要认） |
| `queue_update` | `{steering[], followUp[]}` | 排队消息（steer/follow_up，MVP 只展示） |
| `auto_retry_start/end` | `{attempt, maxAttempts, errorMessage}` | 自动重试提示 |

**流式组装**是纯函数 `streamReducer`（pi-web `lib/streaming-message.ts`，直接移植）：状态只有 `{isStreaming, streamingMessage}`，按事件的 `contentIndex` 定位到 assistant 消息 `content[]` 里的块，逐块 start→delta→end。它没有任何 React 依赖，Vue 中原样可用。

**SSE 连接管理**也是纯类 `AgentEventConnection`（pi-web `lib/agent-event-connection.ts`，直接移植）：封装 EventSource，等 `connected` 事件才算就绪（带超时），断线指数重连，`startup_error` 停止重试。

### 4.4 服务端 SSE 通道的三个细节（Step 1 实现，务必保留）

pi-web `lib/agent-event-stream.ts` 的 `createAgentEventStream`：

1. **先开通道、后发握手**：HTTP 响应头立即写出（`: ` 注释行），等 AgentSession 就绪、事件监听器装好之后才发 `connected`。期间 SDK 已产出的事件先缓冲，握手后按序补发。
2. **流式快照重放**：连接建立时如果 `session.isStreaming === true`，立即补发一条 `message_start` 携带 `streamingMessage` 快照——这是「刷新页面/断线重连后流式气泡不丢」的机制。
3. **心跳**：每 30 秒发 `:\n\n` 注释行，防中间层断连。请求 abort（`req.signal`）时清理监听器和定时器。

### 4.5 两种分支（Step 4 实现，此处先建立概念）

| | 会话内分支（edit-from-here） | fork（新会话） |
|---|---|---|
| 本质 | 同一 `.jsonl` 文件里，从同一 `parentId` 长出的兄弟子树 | 复制出**新的** `.jsonl` 文件（头带 `parentSession`） |
| 操作 | `navigate_tree {targetId}`（targetId 成为新叶子），再 prompt | `SessionManager.open(file).createBranchedSession(entryId)` |
| UI | 消息上的「编辑」按钮、分支导航器 | 消息上的「新会话」按钮 |
| 陷阱 | targetId 取「被编辑用户消息的**前一条消息 entry**」；首条用户消息没有前条，禁用编辑（用 fork） | **fork 会原地改写 wrapper 内部状态**——pi-web 在 fork 后必须立刻销毁旧 wrapper，否则后续请求拿到已指向新会话的脏状态（pi-web AGENTS.md「Fork must destroy the wrapper immediately」） |

分支切换（BranchNavigator）= `GET /api/sessions/:id/context?leafId=X` 预览目标分支的消息 + `navigate_tree {targetId: X}` 生效。

## 5. 与 pi-web 的关系清单

**直接移植的纯函数/模块**（均为 MIT：每个移植文件**头部保留来源注释**，并在项目根维护 `THIRD_PARTY_NOTICES.md` 收录衍生文件清单与 pi-web 的 MIT 许可原文——README 致谢不能替代，见 03 第 1 节；统一放 `shared/lib/`，两端以 `#shared/lib/...` 引用）：

| pi-web 文件 | 去向 | 改动 |
|---|---|---|
| `lib/types.ts` | `shared/lib/types.ts` | 删除 CustomMessage、BashExecution 可保留、子代理相关类型 |
| `lib/normalize.ts` | `shared/lib/normalize.ts` | 原样 |
| `lib/streaming-message.ts` | `shared/lib/streaming-message.ts` | 原样 |
| `lib/agent-event-wire.ts` | `shared/lib/agent-event-wire.ts` | 原样（去 SDK 类型依赖，改用本地 AgentEventLike） |
| `lib/agent-event-connection.ts` | `shared/lib/agent-event-connection.ts` | 原样 |
| `lib/agent-client.ts` | `shared/lib/agent-client.ts` | 原样 |
| `lib/session-reader.ts` 的 `buildSessionContext` / `sliceActiveBranch` / `readSessionHeader` | `server/utils/session-reader.ts` | 去掉 defer 选项与图片惰性化 |
| `lib/agent-event-stream.ts` 的 `createAgentEventStream` | `server/utils/event-stream.ts` | 原样（输入是标准 abort signal） |

**简化重写**（读参考文件理解语义，然后写小得多的版本）：

| pi-web | 本项目 | 简化点 |
|---|---|---|
| `lib/rpc-manager.ts` (2118 行) | `server/utils/rpc-manager.ts` (~300 行) | 去扩展 UI/子代理/工具预设/模型作用域/推送通知 |
| `hooks/useAgentSession.ts` (2098 行) | `app/stores/chat.ts` (~400 行) | 去 run-id 对账/后台标签页轮询（见 04 的「进阶」小节） |
| `lib/session-list-scanner.ts` (增量扫描) | `server/utils/session-reader.ts` 列表函数 | 全量读头行，缓存 30 秒 |

**不移植**：`components/` 全部（用 Vue 重写）、`hooks/` 其余、文件浏览/终端/worktrees/推送/模型配置/插件/技能全部路由。

## 6. pi-web 源码阅读地图（按需查阅，不必一次读完）

| 主题 | 文件 |
|---|---|
| SDK 调用与会话创建 | `lib/rpc-manager.ts` 的 `startRpcSession`（行 1925–2118）+ `AgentSessionLike` 接口（`lib/pi-types.ts`） |
| 命令分发语义 | `lib/rpc-manager.ts` 的 `send()`（行 542–900） |
| SSE 线上格式 | `lib/agent-event-wire.ts`（107 行，全文） |
| SSE 通道生命周期 | `lib/agent-event-stream.ts`（132 行，全文） |
| 流式消息组装 | `lib/streaming-message.ts`（145 行，全文） |
| SSE 客户端 | `lib/agent-event-connection.ts`（203 行，全文） |
| 前端事件处理 | `hooks/useAgentSession.ts` 的 `handleAgentEvent`（行 1050–1285） |
| 历史加载/分支上下文 | `lib/session-reader.ts` 的 `buildSessionContext` / `sliceActiveBranch`（行 448–511） |
| 分支导航 UI | `components/BranchNavigator.tsx` + `hooks/useAgentSession.ts` 的 `handleNavigate` / `handleLeafChange`（行 1474–1492） |
| 编辑消息（edit-from-here） | `components/MessageView.tsx` 行 366、518（`onNavigate(prevAssistantEntryId)` + 填充输入框） |
| 会话文件格式 | `AGENTS.md`「Pi Session File Format」节 |
| 全部设计陷阱 | `AGENTS.md`「Key Design Decisions & Traps」节（强烈建议通读一遍） |

## 7. 前置条件验证

```bash
node --version                     # ≥ 22.19
ls ~/.pi/agent                     # 应有 models.json / sessions/ 等
```

模型配置验证：如果本机装着 pi-web（`npx @agegr/pi-web` 打开 127.0.0.1:30141），在 Models 面板能看到已登录的提供商即可；或直接跑一次 pi CLI 能对话即配置完成。

> ⚠️ 本项目与 pi CLI、pi-web **共享** `~/.pi/agent` 下的所有数据：在项目里创建的会话会出现在 pi-web 的会话列表里（反之亦然）。这是特性，不是 bug——面试时值得强调。
