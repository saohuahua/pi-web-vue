# 07 · Step 5（可选加分项）：一页纸

> 里程碑 A（或 B）做完后有余力再动。每项标注 pi-web 参考实现——做的时候照着读，本文不展开。
> 按面试收益/工作量性价比排序，建议最多挑 1–2 项。

## 1. 最小单元测试（性价比最高，约 2–3 小时）

用 vitest（`npm i -D vitest` + `npm test` 脚本）。四个测试文件，全部针对已移植的纯函数/状态机——这正是当初把它们抽成纯函数的回报，也是简历上「核心逻辑有单测覆盖」的实打实信号：

1. `shared/lib/streaming-message.test.ts`：`streamReducer` 的 text/thinking/toolcall 三类 delta 组装、snapshot 重放、end 清空
2. `shared/lib/agent-event-wire.test.ts`：`toClientAgentEvent` 剥 `partial`/提升 toolcall 元数据/丢弃 `turn_*`；`isEventIncludedInSnapshot` 快照去重
3. `server/utils/rpc-manager.test.ts`：prompt preflight 三路径（成功 ack、同步抛错回滚计数、接受后异步失败 emit `prompt_error`+`prompt_done`）——inner 用 stub 对象，不碰 `startRpcSession`
4. `server/utils/session-reader.test.ts`：`sliceActiveBranch` 分支链回溯、`buildSessionContext` 的 entryIds 平行数组、settings 沿 parentId 推导

## 2. 模型切换与配置面板

- 运行中 `set_model` / `set_thinking_level` 命令（Step 1 的 send 分发表里补两个 case，参考 pi-web `rpc-manager.ts` 行 704–726、815–826）。
- ChatComposer 加模型下拉：数据来自 `GET /api/models`（参考 pi-web `app/api/models/route.ts` + `lib/models-cache.ts`；`createAgentSessionServices` 返回的 `services.modelRuntime` 能列可用模型）。
- 完整的「提供商登录/API key 管理」是 pi-web 最复杂的模块之一（`app/api/auth/*`、`lib/provider-listing.ts`），**不建议复刻**，面试口述架构即可。

## 3. 终端面板（演示效果最炸）

- node-pty 起持久 shell，xterm.js 渲染，SSE 双向转发。
- pi-web 参考：`lib/terminal-manager.ts`、`app/api/terminal/*`、`components/TerminalPanel.tsx`。node-pty 是原生模块，Windows 下要处理 prebuild（参考 pi-web `bin/prepare-terminal.js`）。
- 工作量约 2–3 天。

## 4. fork 与会话删除（从里程碑 B 移出的会话管理）

**fork** = 从任意消息复制出新 `.jsonl`（侧栏多一行，原会话不动）。pi-web 有两个变体，别混淆：`fork` 用 `entry.parentId`（复制到该条**之前**，配合首条消息特殊分支）、`fork_branch` 用 `entryId`（**包含**该条）。正确实现：

```ts
case "fork": {
  const entryId = command.entryId as string;
  const sm = this.inner.sessionManager;
  const currentSessionFile = this.inner.sessionFile;
  if (!sm.isPersisted() || !currentSessionFile) return { cancelled: true };
  const entry = sm.getEntry(entryId);
  if (!entry) throw new Error("Invalid entry ID for forking");

  const sessionDir = sm.getSessionDir();
  let newSessionFile: string;
  if (!entry.parentId) {
    // fork 第一条消息之前：新建空会话并链接 parent（pi-web rpc-manager.ts 行 736–740）
    const newManager = SessionManager.create(sm.getCwd(), sessionDir);
    newManager.newSession({ parentSession: currentSessionFile });
    newSessionFile = newManager.getSessionFile()!;
  } else {
    // 复制到 fork 点【之前】——用 entry.parentId，不是 entryId
    const sourceManager = SessionManager.open(currentSessionFile, sessionDir);
    newSessionFile = sourceManager.createBranchedSession(entry.parentId)!;
  }
  const newSessionId = SessionManager.open(newSessionFile, sessionDir).getSessionId();
  await this.destroy();   // ⚠️ AGENTS.md 第一大坑：fork 原地改写 wrapper 内部状态，
                          // 必须立刻销毁旧 wrapper，否则后续请求拿到脏状态、
                          // 再 fork 会产生损坏的 parentSession 链
  return { cancelled: false, newSessionId };
}
```

前端：消息 hover「⎇ 新会话」→ POST fork → `sessionsStore.refresh(true)` + `navigateTo(/session/${newSessionId})`。

**删除**：`DELETE /api/sessions/:id` —— wrapper 存活先 `destroy()` 再 `fs.unlink`。对 pi-web 的实际影响要说准：`parentSession` 是 display metadata（AGENTS.md 原文「zero effect on chat content」），孤儿 fork 在 pi-web 侧栏**从嵌套显示降级为顶级显示**，不破坏功能；想完全对齐可参考 pi-web DELETE 分支的 cascade-reparent 逻辑。破坏性操作，前端必须 confirm。

## 5. 项目文件浏览器 + 查看器

- 会话 cwd 下的文件树 + 点开看内容/图片/PDF。
- pi-web 参考：`app/api/files/[...path]/route.ts`、`components/FileExplorer.tsx`、`FileViewer.tsx`。
- ⚠️ **安全边界**：pi-web 的 `/api/files` 有严格的 allowed-roots 白名单（`lib/file-access.ts`、`lib/path-security.ts` 的 `isPathWithinRoots`）——做的话至少限定会话 cwd 之内 + 路径规范化越界检查。这是 pi-web AGENTS.md 点名的安全边界，面试值得主动讲。

## 6. Git diff / 状态面板、上下文压缩可视化

- Git：`app/api/git/diff/route.ts`、`lib/git-changes.ts`、`components/TurnWrittenFiles.tsx`（每轮改了哪些文件——pi-web 的亮点交互）。
- 压缩：事件与 `compact` 命令已铺好（`compaction_start/end` 双事件名、`isCompacting`），补手动压缩按钮 + 摘要卡片（`lib/compaction-summary.ts`）+ `contextUsage` 进度条。约半天。

## 7. 其余（口述即可，不建议做）

- **Worktrees**（`lib/worktree.ts`，Windows 路径坑重灾区）
- **插件/技能管理**（`app/api/plugins`、`app/api/skills/*`）
- **扩展 UI 对话框**（`extension_ui_request` 体系——本项目 MVP 刻意绕开的复杂度核心）
- **SSE 对账完整版**（run-id 单调计数、后台标签页 visibilitychange/online 触发 reconcile、30 秒 SSE 宽限期复用——pi-web `useAgentSession.ts` 的精华；面试讲「我知道完整版要怎么做」）
- **PWA / 桌面通知 / 完成音效 / i18n / 移动端适配**；**Steer / follow_up**（命令已在接口里，`queue_update` 事件 Step 3 已展示队列）

## 项目收尾建议

1. README（英文）：架构图、截图/GIF、与 pi/pi-web 的关系声明、启动方式、`THIRD_PARTY_NOTICES.md`。
2. **演示物料：一段 2 分钟录屏**（创建 → 流式 → 工具卡片 → 停止 → 分支）+ 若干截图放进 README——秋招投递点开即看。
   ⚠️ **不要**把无鉴权的实例暴露到公网/内网穿透：API 能以你的用户身份执行任意命令。本项目仅本机使用（Nuxt dev 默认绑 127.0.0.1；生产 `HOST=127.0.0.1 node .output/server/index.mjs`）。确需在线 Demo：加 Basic Auth 路由中间件（参考 pi-web 的 `PI_WEB_PASSWORD`）+ cwd 白名单。
3. 面试话术素材（提前写进 README 的 Design Notes）：
   - 为什么 SSE 而不是 WebSocket（单向推送 + 断线自动重连 + 代理友好）
   - **创建与首条 prompt 拆两步**的时序设计（SSE 先建连；pi-web 一步完成靠对账机制兜底，我们用更简单的协议设计规避）
   - 「先 ack 后完成」的 prompt RPC 契约
   - 流式快照重放（刷新不丢流式气泡）
   - fork vs in-session branch 两种分支模型，及 fork 的 wrapper 销毁陷阱
   - agent_end ≠ run 结束（重试/压缩/排队）的事件语义
   - 共享 `~/.pi/agent` 数据的生态兼容设计
