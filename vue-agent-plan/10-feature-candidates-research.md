# 10 · Step A+ 候选功能调研与取舍

> 状态：调研完成，等待产品取舍；不代表已纳入实施计划
>
> 目的：在 Step A+ 完成后、Step B 会话内分支开始前，筛选不依赖会话树且实现量可控的工作区能力。本文不修改 `09-step-a-completion.md`，待确认后再把被采纳项并入 09 的对应 SA 阶段。

## 0. 结论先行

### 建议直接纳入 Step A+

1. **项目可信任确认**：这是安全边界，不是锦上添花，应随项目选择和会话启动一起完成。
2. **工作区记忆**：记住最近项目、worktree 和侧栏状态，避免每次刷新重新选目录。
3. **每会话草稿与失败恢复**：切换会话、请求失败或首轮会话落盘后不丢输入内容。
4. **Git 变更摘要与文件状态标记**：只读呈现，用户可以立即判断 agent 改了什么。
5. **会话中的文件联动**：agent 写入文件后刷新文件树；消息和工具结果中的合法路径可直接在 SA-3 文件查看器打开。
6. **复制与键盘效率**：复制消息/代码块，并提供少量不冲突的快捷键。
7. **Prompt templates 的 `/` 菜单发现与调用**：和内置命令、技能统一呈现，但不在首版实现模板管理。

### 建议作为用户确认后的增强项

8. **运行中追加指令队列**：Pi RPC 原生支持 steering 和 follow-up，价值高，但必须补齐排队、撤销、停止和草稿恢复的状态机。

### 建议暂缓

9. **HTML 会话导出**：官方能力存在，但安全处理和深会话兼容处理并不轻量。
10. **文件实时监听**：首版由 agent settled 后刷新和手动刷新覆盖；长期 watcher 会增加资源回收、跨平台和安全复杂度。
11. **跨会话滚动锚点恢复与惰性历史加载**：只有超长会话和分页加载后才有明显收益，应和 Step B 或后续性能专项一起做。

## 1. 已在 09 中的范围 不重复新增

下列内容已经在 `09-step-a-completion.md` 定义，不能以“候选功能”名义重复造计划：

| 既有 SA 阶段 | 已覆盖能力 | 结论 |
|---|---|---|
| SA-1 | 图片边界、模型和思考等级命令、手动压缩、usage 统计、路径安全 | 保持原计划 |
| SA-2 | 项目选择、已有 Git worktree 切换、项目内会话分组和搜索 | 保持原计划 |
| SA-3 | 文件树、文本和图片预览、`@` 文件引用、安全文件索引 | 保持原计划 |
| SA-4 | 手动重命名、自动标题、项目内会话搜索 | 保持原计划 |
| SA-5 | 模型/思考选择、图片选择/拖放/粘贴及浏览器压缩、`/` 命令和输入历史 | 保持原计划 |
| SA-6 | 顶栏系统/工具只读信息与 token、成本、context usage | 保持原计划 |
| SA-7 | 模型、技能、主题、语言、提示音等基础设置 | 保持原计划 |
| SA-8 | UI 收口与完整验收 | 保持原计划 |

**重要事实**：Git worktree 选择与 Step B 的会话内树分支完全独立，本文所有候选都不读取或修改 `activeLeafId`、`parentId` 或编辑重发流程。

## 2. 候选清单

复杂度按当前 Vue 项目估算：S 为半天以内的闭环，M 为 1 至 2 天且需要测试，L 为超过 2 天或需要独立状态机。这里的工期是相对量级，不是承诺。

| # | 功能与建议 | 用户价值 | 复杂度 | 推荐放入 | 主要风险 |
|---|---|---|---|---|---|
| C1 | 项目可信任确认 `建议纳入` | 打开含本地扩展和技能的未知仓库时不自动执行仓库控制的代码 | M | SA-1/SA-2 | 信任后需重新加载资源，不能把仅浏览目录当作永久信任 |
| C2 | 最近工作区记忆 `建议纳入` | 刷新后回到最近项目/worktree，减少目录选择摩擦 | S | SA-2 | 工作区被移动或 worktree 已删除时必须失效降级 |
| C3 | 每会话草稿与失败恢复 `建议纳入` | 切会话、首次建会话改 id、网络失败时不丢正在写的内容 | M | SA-4/SA-5 | 图片 base64 不能写入 localStorage，避免容量和隐私问题 |
| C4 | 全局快捷键与快捷键帮助 `建议纳入` | 高频新建、聚焦输入、停止任务、搜索更快且可发现 | S | SA-8 | 不能劫持中文输入法、浏览器保留键或输入框局部按键 |
| C5 | Git 变更摘要与文件状态标记 `建议纳入` | 在文件树旁直接核对 agent 改动、增删行与冲突 | M | SA-3 后 | 只读、路径校验、Git 超时和未跟踪二进制文件不预览 |
| C6 | 会话到文件的联动 `建议纳入` | agent 修改完成后树自动更新，聊天中出现的文件可一键打开 | M | SA-3/SA-8 | 只能打开允许根内的真实路径，不能将模型输出的任意绝对路径当链接 |
| C7 | 消息与代码块复制 `建议纳入` | 复制 agent 结论、命令和代码，不必手动框选 | S | SA-8 | Clipboard API 失败需提供明确提示，复制范围要排除隐藏思考和敏感图片数据 |
| C11 | Prompt templates 的发现与调用 `建议纳入` | 让可复用提示词和技能一样可发现，不用用户记住文件名 | S | SA-5 | 项目模板受信任边界约束，不做 CRUD 和模板表达式 UI |
| C8 | 运行中追加指令队列 `待确认后纳入` | 不必停止当前任务即可纠偏或追加收尾工作 | L | SA-5 后独立小阶段 | steering、follow-up、清队列、停止、图片草稿的时序容易错乱 |
| C9 | 官方 HTML 会话导出 `暂缓` | 方便演示、归档和分享历史 | L | Step 5 可选 | 输出 HTML 的 XSS、临时文件清理和深树递归兼容都不能简化掉 |
| C10 | 文件 watcher 与滚动锚点/惰性历史 `暂缓` | 超长会话和外部编辑器协作时体验更好 | L | Step B 后性能专项 | 文件监听生命周期和分页锚点恢复都引入持续状态和竞态 |

## 3. 候选的实现依据与最小边界

### C1 项目可信任确认

**事实**

- Pi 官方文档明确说明扩展以完整系统权限执行，项目内 `.pi/extensions` 仅应在项目可信后加载。
- 当前 Vue 的 `server/utils/rpc-manager.ts` 建立 agent session 时没有对应的 project trust 闸门；现有 `09` 虽列了路径安全，却尚未列出项目资源执行前的信任决策。
- 旧项目以 `hasTrustRequiringProjectResources` 和 `ProjectTrustStore` 实现同一闸门。

**最小实现**

在 `server/utils/project-trust.ts` 封装 SDK 的检查和持久化，在选中 cwd 与创建/恢复会话前返回 `requiresTrust`、`trusted`。若项目含受信任门控资源而未确认，前端显示路径、风险类型和“仅本次信任/记住信任/取消”；只有用户确认后再创建使用项目资源的 runtime。普通项目不显示弹窗。

**涉及文件**

- 当前 Vue：新增 `server/utils/project-trust.ts`、`server/api/project-trust.*`、`app/components/WorkspaceSelector.vue`，并调整 `server/utils/rpc-manager.ts`
- 旧 pi-web：`D:/project/pi-web/lib/project-trust.ts`、`D:/project/pi-web/app/api/project-trust/route.ts`、`D:/project/pi-web/components/ProjectTrustDialog.tsx`
- 官方 Pi：[扩展安全与项目可信任](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md#extension-locations)、本地 `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md:111-120`、`dist/index.d.ts:25`

**取舍**：C1 应先于 SA-7 技能面板，因为读取/加载项目技能可能本身触发项目资源。它不是完整权限系统，也不需要做远程多用户鉴权。

### C2 最近工作区记忆

**事实**

- `09` 已要求 `stores/workspace.ts` 保存 selected project/worktree，但没有明确刷新后的恢复和失效规则。
- 旧 pi-web 有独立的 workspace memory 模块，说明“项目身份”与“上次打开会话/工作区”的记忆应从侧栏组件中抽离。

**最小实现**

浏览器 `localStorage` 仅保存 `projectKey`、最后有效 `cwd`、worktree path、上次会话 id 和侧栏宽度。启动后先通过 SA-1 cwd 校验和 worktree 列表复验，任一项失效则清掉对应字段并回落项目选择器；不存文件内容、模型凭证或会话正文。

**涉及文件**

- 当前 Vue：新增 `app/stores/workspace.ts`、`shared/lib/workspace-memory.ts` 与测试，调整 `SessionSidebar.vue` 和 `app/app.vue`
- 旧 pi-web：`D:/project/pi-web/lib/workspace-memory.ts`、`D:/project/pi-web/components/AppShell.workspace-memory.test.mjs`

**取舍**：这是 SA-2 的缺失验收项，建议写入原 SA-2，而非新开大阶段。

### C3 每会话草稿与失败恢复

**事实**

- 当前 `ChatComposer.vue` 的 `draft` 是组件局部 state，切换路由/会话会丢失；`chat.ts` 的 `sendPrompt` 提交失败只撤回乐观消息，不恢复输入。
- 旧 pi-web 的 `lib/draft-store.ts` 用会话 id 作为草稿键，支持新会话创建后的 rekey、失败提交合并恢复和图片上限复用。

**最小实现**

创建内存态 `Map<draftKey, { text, imageMetadata }>`。现有会话以 session id 为键，未落盘新会话使用一次性临时 key，创建成功后迁移。发送成功才清空对应草稿；请求、SSE 或图片校验失败时合并恢复文本。图片只保留在内存，页面刷新后丢弃并告知用户，不进 localStorage。

**涉及文件**

- 当前 Vue：新增 `app/stores/drafts.ts` 或 `shared/lib/draft-store.ts`、调整 `ChatComposer.vue` 和 `app/stores/chat.ts`
- 旧 pi-web：`D:/project/pi-web/lib/draft-store.ts`、`D:/project/pi-web/hooks/useAgentSession.ts`

**取舍**：文字草稿的恢复值得做；将 base64 图片持久化到浏览器不值得，容量和隐私风险超过收益。

### C4 全局快捷键与快捷键帮助

**事实**

- 旧 pi-web 实现了 `Esc` 停止和 `Ctrl+Alt+N` 新建会话，并特意绕开输入框内 `Esc`，避免与 `/`、`@` 弹层冲突。
- Pi 官方将 `/hotkeys` 作为可发现的内置能力，表明键盘操作是产品的一等交互，但 Web 不应照搬终端按键。

**最小实现**

仅实现 `Ctrl+Alt+N` 新建当前工作区会话、`Ctrl+K` 聚焦项目内会话搜索、`Esc` 停止运行中的 agent、`Ctrl+Enter` 在 composer 中发送。设置抽屉提供只读快捷键列表。输入框、中文输入法组合状态、浏览器/操作系统保留组合键均优先。

**涉及文件**

- 当前 Vue：新增 `app/composables/useKeyboardShortcuts.ts`，调整 `app/app.vue`、`ChatComposer.vue` 和搜索组件
- 旧 pi-web：`D:/project/pi-web/hooks/useKeyboardShortcuts.ts`
- 官方 Pi：[内置 `/hotkeys`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)，本地 `node_modules/@earendil-works/pi-coding-agent/README.md:190-200`

**取舍**：不要实现 TUI 的完整快捷键集合，也不要用单键全局监听打断文本编辑。

### C5 Git 变更摘要与文件状态标记

**事实**

- 旧 pi-web 已以 `git status --porcelain=v1 -z` 获得跨文件名的结构化状态，并限制 diff、文本预览和 Git 命令的大小与超时。
- 该功能只读、以当前 selected cwd 为范围，不依赖会话树或 worktree 创建。

**最小实现**

在 SA-3 文件树底部显示 `+新增 -删除`、修改文件数量及状态 badge，目录聚合显示是否包含变更。Git 错误、非 Git 目录和未跟踪二进制只显示状态而不读取内容。自动刷新由 C6 的 agent settled 触发，另保留手动刷新。

**涉及文件**

- 当前 Vue：新增 `server/utils/git-status.ts`、`server/api/git/status.get.ts`、`app/components/GitChangesPanel.vue`
- 旧 pi-web：`D:/project/pi-web/lib/git-status.ts`、`D:/project/pi-web/lib/git-changes.ts`、`D:/project/pi-web/app/api/git/status/route.ts`

**取舍**：首版不做单文件 diff、暂存、提交、分支创建或 diff 应用。旧项目的 diff 路由还需处理删除文件、重命名、超大文本和生成 patch，这超过“基础文件树”的实现量。它们会从查看扩展成 Git 客户端，应留在可选阶段。

### C6 会话到文件的联动

**事实**

- 当前 `ChatPanel.vue` 在 `agent_settled` 后会 reload 会话，但没有通知未来的文件树刷新；`MessageItem.vue` 也没有文件打开回调。
- 旧 pi-web 已将 `onOpenFile` 穿透消息渲染与文件查看器，并将 agent 写入文件单独呈现为 `TurnWrittenFiles`。

**最小实现**

SA-3 提供统一 `openWorkspaceFile(relativePath)`，仅接受服务端校验后的相对路径。解析 read/write/edit 工具调用中的明确路径，或从服务端返回受控 `writtenFiles`，在 agent settled 后失效当前文件树和 Git 摘要缓存；用户点击合法路径打开 FileViewer。不能用正则把普通模型输出中的任意绝对路径自动变为可访问链接。

**涉及文件**

- 当前 Vue：`ChatPanel.vue`、`MessageItem.vue`、`ToolCallCard.vue`、未来 `FileExplorer.vue`/`FileViewer.vue`、`app/stores/chat.ts`
- 旧 pi-web：`D:/project/pi-web/components/MessageView.tsx`、`D:/project/pi-web/components/TurnWrittenFiles.tsx`、`D:/project/pi-web/lib/turn-written-files.ts`

**取舍**：不做持续文件 watcher。agent 回合结束时刷新已经覆盖本项目最主要的变更来源。

### C7 消息与代码块复制

**事实**

- 当前 `MessageItem.vue` 的 Markdown、用户消息和工具输出均没有复制入口。
- 旧 pi-web 为用户、assistant 和自定义消息提供独立复制目标及成功反馈。

**最小实现**

assistant 消息悬浮操作提供“复制消息”，代码块右上角提供图标复制，工具输出提供复制文本。复制成功短暂显示已复制；`navigator.clipboard` 不可用时采用安全 fallback 或提示失败。思考块默认不复制，避免把不必要内容带出。

**涉及文件**

- 当前 Vue：`MessageItem.vue`、`app/utils/markdown.ts`、新增 `app/utils/clipboard.ts`
- 旧 pi-web：`D:/project/pi-web/components/MessageView.tsx`、`D:/project/pi-web/lib/clipboard.ts`
- 官方 Pi：[`/copy` 内置命令](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)，本地 `node_modules/@earendil-works/pi-coding-agent/README.md:190-196`

**取舍**：这是 SA-8 UI 收口，不应阻塞状态和安全底座。

### C8 运行中追加指令队列

**事实**

- Pi RPC 官方协议支持 `prompt` 的 `streamingBehavior: steer | followUp`，并支持 `steer`、`follow_up`、`clear_queue` 和 `queue_update` 事件。
- 当前 Vue 已在 `chat.ts` 接收 `queue_update` 并在 `ChatPanel.vue` 展示排队数，但 `sendPrompt()` 在 `isRunning` 时直接返回，所以用户没有入口，属于“状态已显示、能力未闭环”。

**最小实现**

运行中 composer 改为模式选择：默认 Stop，用户可明确选“立即纠偏”发送 `steer`，或“本轮后继续”发送 `follow_up`。队列条显示每条内容和类型，允许 `clear_queue` 后把返回文本合并回草稿；Stop 的正确顺序是先 clear queue 再 abort，防止 agent 停止后仍继续执行已排队消息。首版不提供 queue mode 的全局配置。

**涉及文件**

- 当前 Vue：`server/utils/rpc-manager.ts`、`app/stores/chat.ts`、`ChatComposer.vue`、`ChatPanel.vue`、`shared/lib/agent-event-wire.ts`
- 旧 pi-web：`D:/project/pi-web/lib/rpc-manager.ts`、`D:/project/pi-web/hooks/useAgentSession.ts`、`D:/project/pi-web/components/ChatInput.tsx`
- 官方 Pi：[RPC prompt 与队列语义](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md#prompt)、本地 `node_modules/@earendil-works/pi-coding-agent/docs/rpc.md:56-76,80-158,1057-1067`

**取舍**：价值很高但不是 S 级改动。若用户优先“基础操作齐全”，采纳；若当前优先工作区和 UI，放在 SA-8 后独立验证，不要与图片/压缩同一提交混做。

### C11 Prompt templates 的发现与调用

**事实**

- Pi 官方将 Markdown prompt template 作为可复用命令，用户以 `/name` 调用。
- `09` 的 SA-5 已规划 `/` 菜单，但文字只点名内置命令和技能；旧 pi-web 的 RPC 状态将 prompt templates 与 slash commands 一起返回。

**最小实现**

将 SA-1 的 `get_slash_commands` 返回结构明确为内置命令、技能、prompt template 三类，并标记来源。SA-5 的菜单统一展示，选择后仅填充/发送官方命令语义；不做模板新增、删除、编辑、变量填写器或表达式执行界面。项目 `.pi/prompts` 只有在 C1 信任后才能加载。

**涉及文件**

- 当前 Vue：`server/utils/rpc-manager.ts`、`shared/lib/types.ts`、`ChatComposer.vue`
- 旧 pi-web：`D:/project/pi-web/lib/rpc-manager.ts`、`D:/project/pi-web/components/ChatInput.tsx`
- 官方 Pi：[Prompt Templates 固定版本](https://github.com/earendil-works/pi/blob/acaa253cc8e3f159e6100b6f3874861b1f0bfc99/packages/coding-agent/docs/prompt-templates.md)

**取舍**：这是现有 SA-5 的范围澄清而非新配置中心，适合直接补入计划。

### C9 官方 HTML 会话导出

**事实**

- Pi 官方支持 `/export` 和 `--export` 输出会话 HTML。
- 旧 pi-web 已有导出路由，但为超深会话修补递归模板，并处理临时目录与 HTML 安全问题，证明它不是简单的“下载按钮”。

**建议**

保留在 `07-optional.md`，不进入 A+。若后续需要演示材料，可先在开发机调用官方 CLI 输出，而不要先实现一套不完整 Web 导出。

**来源**

- 旧 pi-web：`D:/project/pi-web/app/api/sessions/[id]/export/route.ts`
- 官方 Pi：[会话命令](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sessions.md)，本地 `node_modules/@earendil-works/pi-coding-agent/docs/sessions.md:29-35`

### C10 文件 watcher 与滚动锚点/惰性历史

**事实**

- 旧 pi-web 同时存在 files watch route、session 分页和 scroll-anchor 工具，因为它需要处理大体量和多个外部变更源。
- 当前 Vue 的历史会话仍为单次完整加载，`useAutoScroll` 只负责“是否跟随最新内容”，尚不需要跨分页的 anchor 复原。

**建议**

不进入 A+。先实现 C6 的回合结束刷新，待确实出现超长 `.jsonl`、大文件或外部编辑器同步痛点时，再拆为独立性能阶段。

**来源**

- 旧 pi-web：`D:/project/pi-web/app/api/files/watch-route.test.mjs`、`D:/project/pi-web/lib/chat-scroll-position.ts`、`D:/project/pi-web/lib/chat-lazy-load.ts`

## 4. 推荐的并入方式

若确认采纳 C1 至 C7 与 C11，建议只调整现有 09，而不新增平行大步骤：

| 09 阶段 | 追加项 |
|---|---|
| SA-1 | C1 project trust 服务端契约和拒绝态 |
| SA-2 | C2 workspace memory 的持久化和失效验收 |
| SA-3 | C5 只读 Git 状态标记，C6 合法文件打开和 agent settled 刷新 |
| SA-4/SA-5 | C3 草稿迁移与提交失败恢复，C11 prompt templates 的菜单来源 |
| SA-5 后 | C8 单列为可选的小阶段，不能和普通 prompt 一起走乐观提交 |
| SA-8 | C4 快捷键及 C7 复制操作 |

保持 C9、C10 在 `07-optional.md` 或后续性能计划，避免把 Step A+ 再次膨胀为完整 pi-web 复刻。

## 5. 来源与证据等级

### 一手本地源码

- 当前实现：`D:/project/pi-web-vue/app/stores/chat.ts`、`app/components/ChatPanel.vue`、`app/components/ChatComposer.vue`、`app/components/MessageItem.vue`、`server/utils/rpc-manager.ts`、`vue-agent-plan/09-step-a-completion.md`
- 旧产品实现：`D:/project/pi-web/lib/project-trust.ts`、`lib/draft-store.ts`、`lib/workspace-memory.ts`、`lib/git-status.ts`、`lib/git-changes.ts`、`lib/chat-scroll-position.ts`、`hooks/useKeyboardShortcuts.ts`、`components/MessageView.tsx`
- 锁定 SDK `0.85.1`：`D:/project/pi-web-vue/node_modules/@earendil-works/pi-coding-agent/package.json`

### Pi 官方一手资料

- [Pi coding-agent README 固定提交](https://github.com/earendil-works/pi/blob/acaa253cc8e3f159e6100b6f3874861b1f0bfc99/packages/coding-agent/README.md)
- [Pi RPC 协议 固定提交](https://github.com/earendil-works/pi/blob/acaa253cc8e3f159e6100b6f3874861b1f0bfc99/packages/coding-agent/docs/rpc.md)
- [Pi 扩展与项目可信任说明 固定提交](https://github.com/earendil-works/pi/blob/acaa253cc8e3f159e6100b6f3874861b1f0bfc99/packages/coding-agent/docs/extensions.md)
- [Pi 会话说明 固定提交](https://github.com/earendil-works/pi/blob/acaa253cc8e3f159e6100b6f3874861b1f0bfc99/packages/coding-agent/docs/sessions.md)

本文关于 SDK 行为的结论以本地锁定版本 `0.85.1` 的文档为准。固定提交链接仅便于追溯；实施时仍应先重新核对项目锁定版本，不能假设上游协议完全兼容。
