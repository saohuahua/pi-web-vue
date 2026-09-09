# 04 · Step 2：前端核心（聊天界面 + 流式渲染）

> 目标：在浏览器里完成核心闭环——新建会话 → 发消息 → 看到流式回复（文本 + 最简工具显示）→ 停止 → 恢复历史会话继续聊。
> 开始前先读：pi-web `hooks/useAgentSession.ts` 的 `handleAgentEvent`（行 1050–1285）与 `handleSend`（行 1288 起）、`lib/streaming-message.ts`、`lib/agent-event-connection.ts`。

## 1. app/utils/markdown.ts：Markdown 渲染

```ts
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

const md = new MarkdownIt({
  html: false,              // 安全默认：消息里不允许内嵌 HTML
  linkify: true,
  breaks: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang }).value; } catch { /* fallthrough */ }
    }
    return "";              // 空串让 markdown-it 自己 escape
  },
});

export function renderMarkdown(text: string): string {
  return md.render(text);
}
```

放在 `app/utils/` 下会被 Nuxt 自动 import（组件里直接用 `renderMarkdown(...)`）；不习惯自动导入就显式 `import { renderMarkdown } from "~/utils/markdown"`，两种都行，全项目保持一种。组件里 `<div class="markdown-body" v-html="renderMarkdown(block.text)" />`。再写一段全局 `.markdown-body` 样式（标题/代码块/表格的基础排版，约 60 行 CSS，从 pi-web `app/globals.css` 或任意 markdown 样式表抄）。**工具参数 JSON 用 `JSON.stringify(input, null, 2)` + hljs 高亮，不走 markdown。**

> 本步骤不需要处理 agent 输出里的 HTML（`html:false` 已挡住）。数学公式/mermaid 是 Step 5 的可选项。

## 2. Pinia store（一）：sessions —— 会话列表

```ts
export const useSessionsStore = defineStore("sessions", () => {
  const sessions = ref<SessionInfo[]>([]);
  const runningIds = ref<Set<string>>(new Set());
  const loading = ref(false);

  async function refresh(force = false) {
    loading.value = true;
    try {
      const res = await fetch(`/api/sessions${force ? "?force=1" : ""}`);
      sessions.value = await res.json();
    } finally { loading.value = false; }
  }
  async function pollRunning() {          // 仅在页面可见时轮询（Step 4 再加可见性优化）
    const res = await fetch("/api/agent/running");
    runningIds.value = new Set((await res.json()).sessionIds);
  }

  return { sessions, runningIds, loading, refresh, pollRunning };
});
```

## 3. Pinia store（二）：chat —— 当前会话（本步骤的核心）

文件 `app/stores/chat.ts`，顶部显式引入共享层：

```ts
import { defineStore } from "pinia";
import { sendAgentCommand } from "#shared/lib/agent-client";
import { AgentEventConnection } from "#shared/lib/agent-event-connection";
import { INITIAL_STREAMING_STATE, streamReducer, type StreamingState } from "#shared/lib/streaming-message";
import { normalizeToolCalls } from "#shared/lib/normalize";
import type { AgentMessage } from "#shared/lib/types";
```

状态：

```ts
const sessionId = ref<string | null>(null);
const messages = ref<AgentMessage[]>([]);        // 已定稿消息
const entryIds = ref<string[]>([]);              // 与 messages 平行
const stream = reactive<StreamingState>({ ...INITIAL_STREAMING_STATE });  // 移植的 streamReducer 状态
const isRunning = ref(false);                    // run 是否进行中（UI 总开关）
const model = ref<{ provider: string; id: string } | null>(null);
const thinkingLevel = ref("off");
const notices = ref<{ type: "error" | "info"; message: string }[]>([]);
const connection = new AgentEventConnection({   // 移植的类，非响应式
  createSource: (sid) => new EventSource(`/api/agent/${encodeURIComponent(sid)}/events`),
  onEvent: (e) => applyEvent(e),
  shouldMaintain: (sid) => sid === sessionId.value,
  readinessTimeoutMs: 30_000,
  reconnectDelayMs: 3_000,
});
```

### 3.1 打开会话 / 新建会话

```ts
async function openSession(id: string) {
  close();                                        // 关闭旧连接
  sessionId.value = id;
  isRunning.value = false;                        // 新打开的会话从干净状态开始
  await reload();                                 // GET /api/sessions/:id → messages/entryIds/model
  connection.maintain(id);                        // 连 SSE（握手事件是 connected）
  // 防御：先 GET /api/agent/:id，若 state.isStreaming === true 说明页面刷新时 run 还在飞，
  // SSE 的 message_start 快照会自动恢复流式气泡（Step 1 已实现），这里无需额外处理
}

async function newSession(cwd: string) {
  // 只创建空会话，不带首条消息（时序原因见陷阱 1）
  const res = await fetch("/api/sessions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  await navigateTo(`/session/${body.sessionId}`);  // 页面打开 → openSession 连 SSE → 用户再打字
}
```

### 3.2 发送消息（乐观更新）

```ts
async function sendPrompt(text: string) {
  if (!sessionId.value || isRunning.value) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  await connection.ensureConnected(sessionId.value);  // 等 SSE 握手完成再发 prompt（陷阱 1）
  // 乐观追加用户消息（message_end 到达时去重）
  const optimistic: AgentMessage = { role: "user", content: trimmed, timestamp: Date.now() };
  optimisticKey = userMessageKey(optimistic);     // role+content+时间取整 的简单 key
  messages.value.push(optimistic);
  entryIds.value.push("");                        // 占位，reload 后会被真实 entryId 替换
  isRunning.value = true;
  stream.isStreaming = false; stream.streamingMessage = null;
  try {
    await sendAgentCommand(sessionId.value, { type: "prompt", message: trimmed });
  } catch (e) {
    messages.value.pop(); entryIds.value.pop();   // 提交失败撤回乐观消息
    isRunning.value = false;
    notices.value.push({ type: "error", message: String((e as Error).message ?? e) });
  }
}

async function stop() { if (sessionId.value) await sendAgentCommand(sessionId.value, { type: "abort" }).catch(() => {}); }
```

### 3.3 事件处理 applyEvent（对照 pi-web `handleAgentEvent` 的精简版）

```ts
function applyEvent(event: AgentEventLike) {
  switch (event.type) {
    case "agent_start":
      isRunning.value = true;
      break;

    case "message_start": {
      const msg = event.message as AgentMessage | undefined;
      if (msg?.role === "assistant") {            // 用户消息快照忽略（乐观更新已加）
        applyStream({ type: "snapshot", message: msg });
        isRunning.value = true;
      }
      break;
    }

    case "message_update": {
      const delta = event.assistantMessageEvent;
      if (delta) applyStream({ type: "delta", event: delta });
      break;
    }

    case "message_end": {
      const completed = normalizeToolCalls(event.message as AgentMessage);
      if (completed.role === "user") {
        // 去重：若最后一条是我们乐观加的同内容用户消息，替换/跳过
        const last = messages.value[messages.value - 1];
        if (last?.role === "user" && userMessageKey(last) === optimisticKey) {
          messages.value[messages.value.length - 1] = completed;   // 用服务端版本替换
        } else {
          messages.value.push(completed); entryIds.value.push("");
        }
        optimisticKey = null;
      } else if (completed) {
        messages.value.push(completed); entryIds.value.push("");
      }
      applyStream({ type: "end" });               // 清空流式气泡
      break;
    }

    case "prompt_done":
      // POST 生命周期结束。若 agent 没有自己起来（如纯斜杠命令），落定 UI
      if (!sdkAgentActive) { isRunning.value = false; reloadIfIdle(); }
      break;

    case "agent_end":
      // 本轮 agent 循环结束：重载一次权威数据（消息/entryIds/模型状态）
      void reload();
      break;

    case "agent_settled":
      isRunning.value = false;
      void reload();
      break;

    case "prompt_error":
      notices.value.push({ type: "error", message: event.errorMessage ?? "命令失败" });
      isRunning.value = false;
      break;

    case "startup_error":
      notices.value.push({ type: "error", message: event.errorMessage ?? "会话启动失败" });
      break;

    case "compaction_start": case "auto_compaction_start":
      isCompacting.value = true; break;           // （新旧事件名都认，pi-web 的兼容经验）
    case "compaction_end": case "auto_compaction_end":
      isCompacting.value = false; void reload(); break;

    // tool_execution_start/update/end、queue_update、auto_retry_* → Step 3 处理，先留空 case
  }
}
```

其中 `applyStream` 就是移植的 `streamReducer`，每帧把结果写进 `stream`（`Object.assign(stream, streamReducer(stream, action))`）。`reload()` = `GET /api/sessions/:id`，重写 `messages`/`entryIds`/`model`/`thinkingLevel`，并 `sessionsStore.refresh()` 让侧栏时间戳更新。

**reload 的时机纪律**（pi-web 的对账思想，MVP 保留两条）：

- `agent_end` 和 `agent_settled` 都 reload 一次（end 时 run 可能还有重试/排队，settled 才是真空闲）；
- 流式期间**不** reload——流式气泡由 `message_start/update/end` 增量维护，reload 会闪。

### 3.4 userMessageKey

```ts
const userMessageKey = (m: AgentMessage) =>
  `${m.role}:${typeof m.content === "string" ? m.content : ""}:${Math.floor((m.timestamp ?? 0) / 1000)}`;
```

乐观消息和服务端消息的 timestamp 可能差几秒（服务器/本地时钟），key 匹配不上时会走「追加」分支导致重复。**更稳的方案**：`message_end` 到达时如果 `optimisticKey` 仍指向最后一条且内容文本相同（忽略 timestamp）就替换。测试用例要覆盖「乐观消息与 message_end 重复」场景。

## 4. 组件

### SessionSidebar.vue

- 顶部「+ 新会话」按钮 → 弹一个 cwd 输入框（`<input>` + 提交）→ `chat.newSession(cwd)`（创建空会话，进页面再输入首条消息）——本步骤固定由用户手输 cwd，不做目录浏览。
- 列表：`v-for session in sessionsStore.sessions`，每行显示：名称/首条消息预览、相对时间、cwd basename、运行中小圆点（`runningIds.has(session.id)`）。
- 点击行 → `router.push(/session/:id)`。
- `onMounted`：`refresh()` + `setInterval(() => document.visibilityState === "visible" && pollRunning(), 2500)`。

### 路由页：app/pages/session/[id].vue

路由由 `app/pages/` 目录自动生成（`/` → index.vue，`/session/:id` → session/[id].vue），无需手写 router 配置。`index.vue` 放「新会话」的 cwd 输入/欢迎占位。

```vue
<script setup lang="ts">
// useRoute / watch / onBeforeUnmount 均为 Nuxt 自动导入
const route = useRoute();
const chat = useChatStore();
watch(() => route.params.id, (id) => { if (id) chat.openSession(String(id)); }, { immediate: true });
onBeforeUnmount(() => chat.close());
</script>
<template>
  <ChatPanel />
</template>
```

### ChatPanel.vue

布局：`<div ref="scrollEl" class="messages" @scroll="onScroll">` 包消息列表 + 底部 `<ChatComposer />`；顶部一条状态栏：模型名（`chat.model`）、`thinkingLevel`、运行中转圈/「停止」按钮、`isCompacting` 提示、notices 错误条。

消息渲染（本步骤的最简块分发）：

```vue
<div v-for="(m, i) in chat.messages" :key="i">
  <MessageItem :message="m" :entry-id="chat.entryIds[i] ?? ''" />
</div>
<!-- 流式气泡：messages 之后、列表底部 -->
<MessageItem v-if="chat.stream.streamingMessage" :message="chat.stream.streamingMessage" :streaming="true" />
```

### MessageItem.vue

按 `message.role` 分发：

- **user**：右侧气泡，纯文本（或 text 块拼接）。
- **assistant**：遍历 `content` 块：
  - `text` → `v-html="renderMarkdown(block.text)"`
  - `thinking` → 本步骤先渲染成一个折叠的 `<details><summary>思考过程</summary><pre>...</pre></details>`
  - `toolCall` → 折叠框：`🔧 {{ block.toolName }}` + 参数 `<pre>`（`streaming` 时显示 `block.rawInput`——流式中参数还没解析完）
  - `image` → `<img :src="dataUrl(block)">`
- **toolResult**：折叠框 `{{ block.toolName ?? 'tool' }} 结果` + 文本块 `<pre>`（本步骤不做 ANSI 着色）。

> toolResult 是独立消息排在 assistant 之后，与 toolCall 靠 `toolCallId` 对应。本步骤不做配对（Step 3 做），各自渲染即可。

### ChatComposer.vue

`<textarea>`（Enter 发送 / Shift+Enter 换行）+ 发送按钮；`chat.isRunning` 时发送按钮变「停止」（调 `chat.stop()`），textarea 保持可输入但不发送。

### useAutoScroll.ts

```ts
// 聊天容器的跟随滚动：距底 < 80px 才跟随（用户上翻时不打扰）；
// 流式期间用 requestAnimationFrame 节流，每帧至多一次 scrollTo(bottom)
export function useAutoScroll(el: Ref<HTMLElement | null>, dependency: () => unknown) { /* ... */ }
```

## 5. 本步骤的陷阱清单

1. **SSE 必须先于 prompt 建连**：`sendPrompt` 里 `await connection.ensureConnected()` 再 POST。为此「新建会话」拆成两步——先创建空会话、进页面（openSession 连 SSE），用户打字发送时 SSE 早已握手完成。pi-web 是「创建+发消息」一次请求完成，靠的是它完整的对账机制（运行中轮询、run-id 丢弃迟到事件、prompt_done 触发 reload）兜底；本项目砍掉了对账，合并回一步就会偶发丢掉首轮的流式事件（短回复整个消失）。
2. **不要在收到第一个 `agent_end` 就关 SSE / 落定 UI**：重试、自动压缩、排队消息都会让「同一逻辑 run」产生多个 agent_end。落定只认 `agent_settled`（或 prompt_done 且无 agent 活动）。
3. **`message_end(role=user)` 一定走去重逻辑**，否则每条消息显示两遍——这是 pi-web 明确处理过的场景（steer/follow_up 的用户消息也从这个事件来）。
4. 流式气泡和 `messages` 列表是**两个数据源**：`message_end` 到达 → 追加进 `messages` + 清空 stream。顺序反了会闪一帧重复。
5. Vue 特有：`stream` 对象被 `reactive` 后，`streamReducer` 返回的新对象要整体 `Object.assign` 回去（不要试图直接改属性）；`AgentEventConnection` 实例不要放进 `reactive`（EventSource 被代理会出诡异问题），放在 store 的普通闭包变量里。

## 6. 验收（5 分钟冒烟）

在浏览器（http://127.0.0.1:3000）完成：

1. **主路径**：输入 cwd 新建会话（空会话）→ 发「数到3」→ 用户消息立即出现（乐观更新），回复**逐字流式**，结束后定稿；紧接着发第二条消息正常（连续对话）。
2. **工具最简显示**：发「列出这个目录的文件」→ 出现折叠的 toolCall / toolResult 块，markdown 回复正常。
3. **停止**：长文任务中途点停止 → 几秒内落定，再发新消息正常。
4. **刷新恢复**：长任务运行中按 F5 → 消息完整恢复、流式气泡不丢（SSE 快照重放生效），侧栏显示运行中标记。
5. （顺手）打开 pi-web（127.0.0.1:30141）能看到本项目创建的会话——共享 `.jsonl` 的直接证明，面试可讲。

核心闭环完成。`npm run typecheck` 顺手跑一下，然后进入 [05-agent-display.md](./05-agent-display.md)——**里程碑 A（首个可演示版本）= 本步 + Step 3 的工具可视化**。
