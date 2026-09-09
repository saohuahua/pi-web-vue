# 05 · Step 3：Agent 能力展示（工具调用 / 思考过程 / 执行状态）

> 目标：把 Step 2 的「最简折叠框」升级成真正的 agent 可视化——这一步是**面试演示的颜值担当**，也是「展示 agent 能力」的核心。
> 开始前先读：pi-web `components/MessageView.tsx`（块分发与 toolCall/toolResult 配对）、`components/ChatWindow.tsx` 行 1125–1160 附近（process 分组）、`lib/tool-execution-progress.ts`（partialResult 进度提取）。

## 1. 数据层：toolResult 与 toolCall 的配对

assistant 消息里的 `toolCall` 块和独立的 `toolResult` 消息靠 `toolCallId` 关联。在 `chat` store 里加一个 getter：

```ts
// Map<toolCallId, ToolResultMessage>
const toolResultsByCallId = computed(() => {
  const map = new Map<string, ToolResultMessage>();
  for (const m of messages.value) {
    if (m.role === "toolResult") map.set(m.toolCallId, m);
  }
  return map;
});
```

`ToolCallCard` 接收 `:result="chat.toolResultsByCallId.get(block.toolCallId)"`，同一张卡片内展示「调用 → 结果」完整生命周期。流式中 result 还没到（`undefined`）就显示执行中状态。

## 2. 组件升级

### 2.1 ThinkingBlock.vue（思考过程）

- 折叠面板，标题显示「思考了 N 秒」或流式时「思考中…」+ 实时字数。
- 内容 `<pre class="thinking">`，白名单内换行；阶段 3 可选做 markdown 渲染。
- 流式时默认**折叠**（只显示增长计数），`message_end` 后默认保持折叠，点击展开——直接抄 pi-web 的交互感觉（`components/MessageView.tsx` 里 thinking 块的行为）。
- 历史消息里的 thinking 块可能带 `deferred: true`（历史只存预览）——阶段 3 之前的处理：直接展示现有文本即可，不做按需加载。

### 2.2 ToolCallCard.vue（工具调用卡片）

状态机三态：`执行中`（流式 toolcall 已出现但 message 未定稿，或 tool_execution 事件活跃）/ `完成` / `出错`（配对的 result `isError`）。

```
┌─ 🔧 read  ······· ✓ 完成 ─────────────────┐
│ 参数   { "path": "src/main.ts" }   [折叠]  │
├─ 结果 ─────────────────────────────────────┤
│ 128 行 · 用时 0.4s            [展开查看]    │
└────────────────────────────────────────────┘
```

- 参数区：`JSON.stringify(block.input, null, 2)`，hljs `json` 高亮，默认折叠。
- 针对常用工具做轻量美化（每工具 10 行以内的模板渲染，超出就走通用 JSON）：
  - `read`/`write`/`edit`：文件路径单独一行 + 图标（路径是参数里的 `path`/`file_path` 字段）
  - `bash`/`powershell`：命令文本用等宽字体独立展示
  - `grep`/`find`/`ls`：显示 pattern/path
- `streaming` 时参数区显示 `rawInput`（还没解析成 JSON 的增量字符串）。

### 2.3 ToolResultCard → 合并进 ToolCallCard

如 2.1 的结构图：结果在同一卡片下半区。文本块拼接进 `<pre>`；**ANSI 处理**：bash 输出常带 ANSI 颜色码，装 `ansi-to-html`（或 `ansi_up`，pi-web 用的后者），`<pre v-html="ansiToHtml(text)">`。`isError: true` 时卡片边框/标题变红。result 里有 `image` 块 → 直接 `<img :src="base64DataUrl(block)">`。

### 2.4 运行状态条（ChatPanel 顶部或消息列表底部）

处理三类此前留空的事件：

```ts
case "tool_execution_start":
case "tool_execution_update": {
  // activeTools: Map<toolCallId, { name, progress }>
  // progress 从 partialResult 提取（见下），取不到就只显示名字
  break;
}
case "tool_execution_end":
  // activeTools.delete(toolCallId)
  break;
case "auto_retry_start":
  // retryInfo = { attempt, maxAttempts, errorMessage } → 状态条显示「第 n/m 次重试：...」
  break;
case "auto_retry_end": retryInfo = null; break;
case "queue_update":
  // queuedMessages = { steering, followUp } → composer 上方显示「已排队 N 条」
  break;
```

`partialResult` 进度提取：移植 pi-web `lib/tool-execution-progress.ts`（纯函数，文件很小）——对 bash 这类工具能显示「已输出 N 行」之类的实时进度。**有 activeTools 时，消息列表底部显示一条「⏳ 正在执行 bash …」的实时状态行**（不要为每个工具弹卡片，工具卡片等 message_end 定稿后由历史渲染）。

### 2.5 MessageItem 的块分发定稿

assistant 消息渲染顺序：`content` 数组顺序即真实发生顺序（thinking → text → toolCall → …），**严格按序渲染**，不要把工具调用聚到消息尾部——「思考完就动手」的过程感正是演示价值。

## 3. 停止按钮的完成态打磨

`stop()` 后：abort 命令返回 + SSE `agent_end`/`agent_settled` 到达 → `isRunning=false`。两个信号可能乱序，规则：**abort POST resolve 后启动 3 秒兜底定时器**，若 `agent_settled` 先到则取消定时器，超时则强制落定 + reload 一次（对账兜底，思想来自 pi-web 的 reconciliation）。

## 4. 本步骤的陷阱清单

1. **流式中的 toolCall 用 `rawInput`，定稿后才有 `input`**——`normalizeStreamingToolCalls` 已处理，别在渲染层再猜字段名。
2. `tool_execution_*` 的 `toolCallId` 对应的是流式消息里 toolCall 块的 id；`message_end` 后 activeTools 可能还有残留（end 事件丢失时），`agent_settled` 时清空一次。
3. ANSI→HTML 必须先 escape HTML 再插颜色 span（`ansi-to-html` 已内置；手写容易 XSS）。
4. 图片 base64 直接内联 `data:` URL，注意工具结果图可能很大——`max-height` 限高 + `object-fit: contain`。

## 5. 验收（3 分钟冒烟）

1. 连发两条：「读一下 package.json 并总结」「跑一下 ls -la」→ 能看到 thinking 折叠块（流式时计数增长）、read 卡片（路径美化）、bash 卡片（命令独立展示、ANSI 正常）、执行状态条依次切换、最终 markdown 回复。
2. 「读一下 不存在的路径.txt」→ 红色出错卡片，agent 随后自我修正（能观察到多轮 toolCall）。
3. 长任务中途停止 → 状态条消失、无残留「执行中」卡片，随后对话正常。

`npm run typecheck` 顺手跑一下。通过即达成**里程碑 A：首个可演示版本**——建议此刻录一段 2 分钟演示视频存档（创建 → 流式 → 工具卡片 → 停止 → 刷新恢复），秋招投递随时可用。然后回 [README](./README.md) 勾选，进入 [06-history-branching.md](./06-history-branching.md)（里程碑 B，时间紧可推迟，面试先口述设计）。
