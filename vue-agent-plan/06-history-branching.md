# 06 · Step 4：会话分支（里程碑 B：差异化增强）

> 目标：会话内分支——编辑历史消息从任意节点重开岔路、分支切换器、重命名。树状分支模型是 agent UI 里最能讲深的设计点，做完项目达到完整差异化形态。
> 前置：里程碑 A（Steps 0–3）已完成并可演示。**时间紧可整体推迟**——A 已是完整可投递的项目。
> fork 与删除已移至 [07-optional.md](./07-optional.md) 加分项。
> 开始前先读：pi-web `hooks/useAgentSession.ts` 行 1474–1492（handleNavigate / handleLeafChange）、`components/MessageView.tsx` 行 360–370 与 515–520（编辑按钮的调用方式）、`components/BranchNavigator.tsx` 行 27–110（分支树压缩与顶层分支提取，了解思路即可）、`AGENTS.md`「Two kinds of branching」节。

## 1. 重命名（小热身）

- `PATCH /api/sessions/:id`：wrapper 存活 → `wrapper.inner.setSessionName(name)`；否则 `SessionManager.open(file).setSessionName(name)`。
- 显示一致性：详情接口用 `sm.getSessionName()`（权威值）；列表靠 Step 1 的**尾部扫描**（session_info 追加在文件末尾，头部读不到——见 03 的 2.2）。重命名后 `sessionsStore.refresh(true)` 即可看到新名。
- 前端：会话标题旁铅笔 → 输入框 → PATCH → force 刷新。

## 2. 编辑历史消息（edit-from-here，会话内分支）

### 2.1 交互（照抄 pi-web 的语义）

用户消息 hover 出现「编辑」按钮，点击后：

1. `chat.handleNavigate(prevMessageEntryId)` —— targetId = **这条用户消息的前一条消息的 entryId**（从 `entryIds` 数组取 `entryIds[i-1]`）。第一条用户消息没有前条 → 禁用编辑按钮（pi-web 同款限制，`MessageView.tsx` 的 `canNavigate = !!prevAssistantEntryId`）。
2. 输入框填入原消息文本（用户改写）。
3. 用户发送 → 新 prompt 挂到 `targetId` 之下，成为原消息的**兄弟分支**；原分支数据完好保留在 .jsonl 里。

### 2.2 handleNavigate —— 必须 await + 失败回滚

```ts
async function handleNavigate(entryId: string) {
  if (!sessionId.value || isRunning.value) return;
  const previous = activeLeafId.value;
  try {
    setActiveLeafId(entryId);                                  // 乐观预览
    await loadContext(entryId);                                // GET /api/sessions/:id/context?leafId=
    await sendAgentCommand(sessionId.value,                    // 服务端真正切换
      { type: "navigate_tree", targetId: entryId });
  } catch (e) {
    setActiveLeafId(previous);                                 // 回滚
    await loadContext(previous ?? undefined);
    notices.value.push({ type: "error",
      message: `分支切换失败：${e instanceof Error ? e.message : String(e)}` });
  }
}
```

> ⚠️ pi-web 原版是 fire-and-forget（`sendAgentCommand(...).catch(() => {})`，`useAgentSession.ts:1478`），它敢这么做是因为有完整对账机制兜底。本项目没有对账——navigate 失败时若不回滚，UI 显示的分支与服务端实际分支不一致，**下一条 prompt 会挂到旧分支上**。所以这里必须 await + 回滚 + 报错。

### 2.3 后端：GET /api/sessions/:id/context（只读预览，不切换）

Step 1 的详情接口已支持按 leafId 构建上下文，拆出来作为独立查询：

```ts
// server/api/sessions/[id]/context.get.ts
// GET /api/sessions/:id/context?leafId=<entryId>
// 与详情接口共用 buildSessionContext(entries, leafId)，返回 { context, activeLeafId: leafId }
```

### 2.4 前端状态：activeLeafId

`chat` store 增加 `activeLeafId`：null = 当前活跃分支的叶子（默认）；编辑/切分支后指向具体 entry。`reload()` 时若 `activeLeafId` 非空走 `?leafId=` 的 context 接口，否则走详情接口。

## 3. 分支切换器 BranchNavigator.vue

会话内存在分支时（树上有分叉），消息区顶部显示「⎇ 分支 (2)」按钮，点开下拉：

1. **数据源**：详情接口返回时附带 `tree`：`sm.getTree()`（SDK 提供，返回 `SessionTreeNode[]`：entry + children 嵌套树）。
2. **顶层分支提取**：移植 pi-web `BranchNavigator.tsx` 的两个纯函数——`compressChain`（把单链压缩到第一个分叉点）和 `selectTopLevelBranches`（多个根 → 根就是分支；否则取第一个分叉点的 children）。**不用做**它的完整树形 UI，只做一层平铺列表。
3. 每行显示：分支首条用户消息预览（子树第一个 message entry 的文本，40 字截断）+ 是否当前分支。
4. 点击切换：`handleLeafChange(branchLeafId)` —— 与 handleNavigate 同款结构（乐观 + await navigate + 失败回滚）：

```ts
async function handleLeafChange(leafId: string | null) {
  if (isRunning.value) return;
  const previous = activeLeafId.value;
  try {
    setActiveLeafId(leafId);
    await loadContext(leafId ?? undefined);
    if (leafId) {
      await sendAgentCommand(sessionId.value, { type: "navigate_tree", targetId: leafId });
    }
  } catch (e) { /* 同 handleNavigate 的回滚三件套 */ }
}
```

> `branchLeafId` 的求法：从 `SessionTreeNode` 沿「最后一个 child」**循环**（禁止递归——深会话爆调用栈，pi-web 在三个文件里重复强调）下钻到叶子。切换后该分支成为活跃分支，正常 prompt。

## 4. 本步骤的陷阱清单

1. **navigate_tree 的 targetId 永远是 entryId**（`entryIds[]` 里的值），不是消息下标、不是消息内容。编辑按钮取 `entryIds[i-1]` 时注意 i=0 越界（第一条消息禁用编辑）。
2. **navigate 必须 await + 失败回滚**（见 2.2 的说明）。切分支时 run 进行中必须禁用（`isRunning` 时按钮置灰）。
3. 编辑流程中 navigate 与 prompt 是**两次独立的用户动作**（点编辑 → 改文本 → 点发送），天然保证 navigate 先于 prompt 到达。不要做成「navigate + 自动 prompt」一步到位。
4. `getTree()` 的树可能很深（线性会话 = 深链）。遍历一律用显式栈/循环，**禁止递归**。

## 5. 验收（5 分钟冒烟）

1. **编辑重发**：发两条消息，编辑第一条并改写发送 → 消息列表切到新分支，分支指示器显示「分支 (2)」。
2. **分支切换**：下拉里两个分支来回切换，消息正确变化；在任一分支继续对话互不污染。
3. 重命名后侧栏与详情标题一致更新。
4. 回归一眼：里程碑 A 主路径再点一遍（发消息 → 流式 → 停止）确认没被改坏；run 进行中分支切换按钮应为禁用态（这是 navigate 失败的主要防线）。

通过即达成**里程碑 B：差异化增强**。`npm run typecheck` 顺手跑一下。
