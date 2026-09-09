# 09 · Step A+ 基础工作区完善：Step A 后 Step B 前

> 状态：仅计划，尚未开始实施
>
> 本文是 Step A 聊天闭环完成后的基础工作区阶段，必须在 Step B 会话内分支之前完成。它以 `D:\project\pi-web` 的实际代码为行为参考，不直接复制 React 或 Next.js 组件。纯函数可在保留 MIT 来源声明的前提下移植，Nuxt 与 Vue 层按相同行为重写。

## 0. 新开对话先读这里

新开对话执行本计划时，先做以下动作，再开始写代码：

1. 读取本文件、`vue-agent-plan/README.md`、`vue-agent-plan/01-architecture.md` 和当前阶段对应的旧项目参考文件
2. 运行 `git status --short`，保留已有改动，不回退、不格式化无关文件
3. 先确认本阶段的接口契约、失败状态和验收用例，再实现最小纵向闭环
4. 一个新对话只完成一个阶段，完成后更新本文件进度、运行该阶段验收并报告未覆盖风险
5. 不擅自启动 `npm run build`。仅在修改后的阶段需要时执行 `npm run typecheck`、`npm test` 或本地浏览器烟测

可直接把下面这段作为新对话的首条任务：

```text
在 D:\project\pi-web-vue 实施 vue-agent-plan\09-step-a-completion.md 的阶段 SA-N。
先读取 README、01-architecture、09 以及该阶段列出的 pi-web 参考文件，检查 git status。
只实现 SA-N，不提前实现后续阶段，不覆盖已有用户改动。
先补或更新失败用例，再写最小实现；代码注释使用中文且不带标点。
完成后更新 09 的进度，运行该阶段的 typecheck/test/烟测，并汇报改动、验证结果和遗留风险。
```

将 `SA-N` 替换成当前未完成的最小阶段，例如 `SA-1`。开始前应确认原 Step A 的聊天、流式、停止和历史恢复验收已经通过。

## 1. 现状判断与范围重置

### 事实

| 结论 | 代码证据 |
|---|---|
| 当前项目已具备空会话创建、历史读取、SSE 流式、工具卡片、思考块与停止 | `server/utils/rpc-manager.ts`、`app/stores/chat.ts`、`app/components/ChatPanel.vue` |
| 当前侧栏是全部会话的扁平列表，没有项目分组、Git worktree 选择器、文件树或底部配置入口 | `app/components/SessionSidebar.vue` |
| 会话内分支的服务端 `navigate_tree` 已有命令入口，但前端没有 `activeLeafId`、树数据或分支导航器 | `server/utils/rpc-manager.ts`、`app/stores/chat.ts` |
| SDK 已返回当前模型、思考等级和上下文占用，但前端只展示只读文字，不能选择模型/思考等级，也没有压缩动作 | `server/utils/rpc-manager.ts`、`app/components/ChatPanel.vue` |
| RPC 已可接收 `images`，但 Vue 输入框只发送文本，且没有上传、压缩和服务端图片边界校验 | `server/utils/rpc-manager.ts`、`app/components/ChatComposer.vue` |
| `shared/lib/types.ts` 已保留消息 usage、成本和 compaction 数据类型，但 Vue 层未汇总或展示会话统计 | `shared/lib/types.ts`、`app/stores/chat.ts` |

### 判断

现有 README 将 Step 0–3 标为完成，这只证明“可演示的聊天闭环”完成，不等于截图所示的“可用 agent 工作区”完成。因此本文把项目、Git worktree、文件、运行参数、使用量和基础设置放入 **Step A+**。它是 Step A 与 Step B 的明确过渡阶段，不改变 Step B 对会话内分支的职责。

### 先澄清两个分支

| 名称 | 用户可见位置 | 数据模型 | 旧项目实现 | 本计划优先级 |
|---|---|---|---|---|
| Git worktree 或检出分支 | 左上项目路径下方，例如 `main` | 仓库根目录、worktree 路径、Git branch | `lib/worktree.ts`、`app/api/worktrees/route.ts`、`components/SessionSidebar.tsx` | SA-2 |
| 会话内分支 | 聊天顶部的分支导航器 | 同一 `.jsonl` 内的 `parentId` 树与 `activeLeafId` | `components/BranchNavigator.tsx`、`hooks/useAgentSession.ts` | Step B `06-history-branching.md` |

两者必须分开建模和验收。切换 Git worktree 不应篡改当前会话的 `activeLeafId`；切换会话分支也不应改变项目 cwd。

## 2. Step A+ 的完成定义

完成后，用户可以完成以下连续流程：

```text
选择项目 -> 选择已有 worktree -> 读取、搜索、重命名或新建该项目对话
  -> 浏览项目文件并以 `@路径` 引用 -> 选择模型与思考等级
  -> 附加图片并在浏览器端压缩 -> 发送或停止 -> 查看 token 成本与上下文占用
  -> 压缩上下文 -> 通过 `/` 使用可发现的命令 -> 在模型 技能 设置中管理基础运行配置
```

本轮的明确非目标：

- 不复制 `pi-web` 的终端、PWA、推送通知、子代理、插件包市场和完整扩展 UI 协议
- 不在首轮实现 Git worktree 的创建、强制删除和脏工作区确认，只支持列出和切换已有 worktree
- 不把文件浏览器做成任意路径读取器，文件访问必须由服务端白名单与真实路径校验限制
- 不把提供商 OAuth、API Key 和远程模型发现混入模型选择首版。首版先使用现有 `~/.pi/agent` 配置；完整模型管理作为 SA-7 的后续子项
- 不把视觉改造提前到状态与接口稳定之前
- 不实现会话内分支、编辑重发或分支导航器。这些仍由 Step B `06-history-branching.md` 负责

## 3. 目标架构与共用契约

### 3.1 组件归属

| 区域 | Vue 目标组件或 store | 服务端职责 | 旧项目参考 |
|---|---|---|---|
| 左上项目与 worktree | `WorkspaceSelector.vue`、`stores/workspace.ts` | cwd 校验、项目身份、worktree 列表 | `components/SessionSidebar.tsx`、`app/api/cwd/validate/route.ts`、`app/api/worktrees/route.ts` |
| 左侧会话列表 | 重构 `SessionSidebar.vue`、`stores/sessions.ts` | 会话列表返回 project/worktree 归属 | `components/SessionSidebar.tsx`、`lib/project-groups.ts`、`lib/session-tree.ts` |
| 左下文件树 | `FileExplorer.vue`、`FileViewer.vue` | 目录列表、文件正文、路径安全 | `components/FileExplorer.tsx`、`components/FileViewer.tsx`、`app/api/files/[...path]/route.ts` |
| 会话管理 | 重构 `SessionSidebar.vue`、`stores/sessions.ts` | 重命名、自动标题、项目内搜索 | `components/SessionSidebar.tsx`、`components/SessionSearch.tsx`、`app/api/sessions/[id]/auto-name/route.ts` |
| 输入与运行控制 | 重构 `ChatComposer.vue` | models、命令分发、图片校验 | `components/ChatInput.tsx`、`lib/image-attachments.ts`、`lib/rpc-manager.ts` |
| 顶栏与使用量 | `WorkspaceTopBar.vue`、`shared/lib/session-stats.ts` | 会话统计和实时 context usage | `components/AppShell.tsx`、`lib/session-stats.ts` |
| 模型、技能、设置 | `SettingsDrawer.vue` 下的三个子面板 | models、skills、应用偏好 | `components/ModelsConfig.tsx`、`components/SkillsConfig.tsx`、`components/SettingsPanel.tsx` |

### 3.2 必须先定下来的数据契约

不要让组件各自推导 cwd、分支或 usage。SA-1 先在 `shared/lib/types.ts` 扩充并统一以下类型：

| 契约 | 最少字段 | 关键约束 |
|---|---|---|
| `ProjectIdentity` | `projectRoot`、`projectKey`、`cwd` | `projectKey` 是会话分组和记忆上次打开对话的稳定键，不能直接用展示名 |
| `WorktreeInfo` | `path`、`branch`、`isMain`、`isCurrent` | Windows 路径比较必须服务端规范化，分支名不是路径，不能做路径转换 |
| `SessionInfo` 扩展 | 既有字段加 `projectKey`、`projectRoot`、可选 `worktreePath` | 同一仓库不同 worktree 的会话仍属于一个项目 |
| `SessionContext` 扩展 | 既有消息、`entryIds` 加 `stats` | `entryIds` 必须始终与显示消息平行，为 Step B 的分支 target 预留正确基础 |
| `ModelListResponse` | `modelList`、`defaultModel`、按模型的 `thinkingLevels` | 思考等级由模型能力决定，不能写死为固定枚举 |
| `AttachedImage` | `data`、`mimeType`、`previewUrl` | `previewUrl` 只在浏览器使用，发送时不得传给服务端 |
| `SessionStatsInfo` | input/output/cache token、cost、context usage | 历史累计与当前上下文占用是两项不同指标，分别展示 |

### 3.3 路由与安全原则

新增接口前，先沿用 Nitro 的文件路由命名规则，并完成路径校验。推荐的最小接口如下：

| 接口 | 作用 | 必须处理的失败场景 |
|---|---|---|
| `POST /api/cwd/validate` | 校验并规范化用户选择的 cwd，返回项目身份 | 不存在、非目录、越过允许根、非 Git 目录 |
| `GET /api/worktrees?cwd=` | 返回项目下已有 worktree 和当前分支 | 非 Git 项目、Git 命令失败、Windows POSIX 路径输出 |
| `GET /api/sessions` | 返回包含项目身份的会话列表 | 缓存失效后仍不能用旧结果覆盖新选择 |
| `GET /api/files/:path` | 目录树或文件内容 | `..`、符号链接逃逸、二进制或超大文本、白名单外路径 |
| `GET /api/file-index?cwd=&q=` | 为文件搜索和 `@` 补全提供有上限的相对路径索引 | cwd 未授权、结果过多截断、查询过快取消上一次请求 |
| `GET /api/models?cwd=` | 读取可用模型和思考等级 | cwd 不可信、模型运行时加载失败、无可用模型 |
| `GET/PATCH /api/skills?cwd=` | 列出技能、切换 model invocation | 只允许可写的技能根，保持 frontmatter 其余内容 |

所有 cwd、文件与技能路径都先 `resolve/realpath`，再进行大小写不敏感的根目录包含判断。仅做字符串 `startsWith` 会被 `..`、同前缀目录或符号链接绕过。

## 4. 实施顺序

### SA-1：补齐底层契约、命令与安全边界

**目标**：为后续 UI 提供稳定 API，先消除当前“后端有状态、前端不能操作”的断层。

| 项目 | 要做什么 |
|---|---|
| 参考 | `pi-web/lib/rpc-manager.ts` 的 `set_model`、`set_thinking_level`、`compact` 分支，`lib/image-attachments.ts`，`lib/session-stats.ts`，`lib/path-security.ts` |
| 当前缺口 | Vue `send()` 只支持 prompt、abort、get_state、navigate_tree、改名，图片数组不校验，统计未汇总 |
| 修改范围 | `server/utils/rpc-manager.ts`、`shared/lib/types.ts`，新增 `shared/lib/image-attachments.ts`、`shared/lib/session-stats.ts`，新增路径安全纯函数与对应测试 |
| 命令语义 | `set_model` 必须验证 provider/modelId 在当前 runtime 可用；`set_thinking_level` 使用该模型支持的等级；`compact` 与 `abort_compaction` 区分 agent 停止；`get_slash_commands` 只返回名称和说明；`get_state` 补充只读 system prompt、工具定义和 context usage；命令失败不改变前端乐观状态 |
| 图片边界 | 每条消息最多 10 张、每张解码后最大 10 MB、仅 `image/*` MIME、严格验证 base64；不把未校验数据送入 SDK |
| 统计语义 | 从完整会话文件累计 token/cost，同时从运行态读取当前 context window，不将两者相加 |

验收：新增纯函数测试覆盖非法 base64、图片数量/尺寸、会话统计汇总、路径越界；`rpc-manager` 测试覆盖三种命令和错误分支。

进度：`[ ]`

### SA-2：项目、Git worktree 与会话工作区

**目标**：左上选择 cwd 后展示该项目的会话，选择已有 Git worktree 后新会话使用对应 cwd，已有会话仍可正常打开。

| 项目 | 要做什么 |
|---|---|
| 参考 | `pi-web/components/SessionSidebar.tsx`，`lib/worktree.ts`，`lib/project-identity.ts`，`app/api/cwd/validate/route.ts`，`app/api/worktrees/route.ts` |
| 当前缺口 | `SessionSidebar.vue` 是全部会话扁平列表，新会话表单只接受 cwd，切换会话只靠路由 id |
| 服务端 | 新增 cwd 验证、项目身份和 worktree 列表；会话扫描时填充项目根与 worktree 归属，Git 返回路径统一转成本机路径后比较 |
| 前端 | 新建 `stores/workspace.ts` 保存 selected project/worktree；侧栏按 `projectKey` 分组；项目切换刷新会话、文件树和新会话 cwd；会话选择仍以 session id 为唯一依据 |
| 会话搜索 | 先在当前项目的已加载会话标题与首条消息中筛选，数量大或需要全文检索时再接旧项目的 `SessionSearch.tsx` 与服务端 search route，不能一开始扫描所有 `.jsonl` 正文 |
| 边界 | 首版仅列出并切换已有 worktree；普通目录可作为项目使用但隐藏分支选择器；不能因切 worktree 关闭同一 project 的已打开历史会话 |

验收：

1. 选择两个不同 cwd，列表只展示对应项目组的会话，搜索不会跨项目泄漏结果
2. 在同一 Git 项目中切换两个已有 worktree，选择器正确标明当前分支，新会话写入所选 cwd
3. 打开旧会话、快速连续点击两条会话、刷新页面后，最终内容始终对应最后选择的 id
4. 非 Git cwd 可正常新建和聊天，不显示伪造的 `main`

进度：`[ ]`

### SA-3：左下文件树与安全文件查看

**目标**：用户在当前 workspace 的左下浏览目录，打开文本或图片，并可把文件路径插入输入框。

| 项目 | 要做什么 |
|---|---|
| 参考 | `pi-web/components/FileExplorer.tsx`、`components/FileViewer.tsx`、`app/api/files/[...path]/route.ts`、`lib/file-access.ts`、`lib/file-paths.ts` |
| 首版 UI | 可折叠目录树、刷新、加载/空态/错误态、文件名搜索、文本预览和图片预览；文件点击在主区域 tab 或右侧查看器打开 |
| 首版后端 | 仅允许 selected cwd 与已知 project root 下的路径；目录按需展开；文本返回内容长度上限和截断标记；二进制只允许图片预览或下载提示 |
| 与输入协作 | 在 `@` 后通过受限文件索引提供补全，点击“引用”或文件路径时写入 `@relative/path`，不读取整份文件塞入 prompt；实际内容读取由 agent 工具决定 |
| 暂不做 | 文件上传、Git diff、PDF/DOCX/音频预览可在基础树稳定后再做，不阻塞 Step A |

验收：展开嵌套目录、打开 UTF-8 文本和图片、文件搜索、cwd 切换重置树状态；直接构造 `..` 和符号链接逃逸请求必须返回拒绝。

进度：`[ ]`

### SA-4：会话管理、自动标题与项目内搜索

**目标**：补齐不依赖会话树的日常会话操作。会话内分支、编辑重发和 fork 仍留给 Step B 或后续增强。

| 项目 | 要做什么 |
|---|---|
| 参考 | `pi-web/components/SessionSidebar.tsx`、`components/SessionSearch.tsx`、`components/AppShell.tsx` 的 auto-name、`app/api/sessions/[id]/route.ts`、`app/api/sessions/[id]/auto-name/route.ts` |
| 当前缺口 | 服务端已有 `set_session_name` 命令但没有面向 UI 的更新流程，侧栏没有搜索和标题操作，首条消息只能作为被动预览 |
| 重命名 | 增加 `PATCH /api/sessions/:id`，存活 wrapper 与离线 `.jsonl` 两种情况都能更新；成功后强制刷新侧栏缓存 |
| 自动标题 | 仅对已有用户消息的非临时会话启用；请求期间禁用重复点击；失败不覆盖原标题；模型不可用时保留手动改名路径 |
| 搜索 | 复用 SA-2 的当前项目筛选，匹配标题和首条用户消息，Esc 清空；会话数量大时需要固定行高或虚拟列表，不能让搜索重排导致选择错位 |
| 暂不做 | 删除需处理 child session 的重挂载，fork 会触发 wrapper 原地变更，导出 HTML 需要额外安全审查，三项均不作为 A+ 前置 |

验收：手动重命名后标题、侧栏和刷新后的详情一致；自动标题不会覆盖用户手动标题或跨会话更新；搜索、清空、连续切换会话均保持路由与内容一致。

进度：`[ ]`

### SA-5：输入控制器，模型、思考、图片与压缩

**目标**：把底部输入框从纯文本输入升级为真实运行控制面，而不是只显示状态。

| 项目 | 要做什么 |
|---|---|
| 参考 | `pi-web/components/ChatInput.tsx`、`lib/image-attachments.ts`、`app/api/models/route.ts`、`lib/models-cache.ts` |
| 模型 | 加 `GET /api/models?cwd=`，按 provider/model 显示可见模型；选择后 `set_model` 成功才更新 store，失败保留原选择并显示 notice |
| 思考等级 | 根据选中模型返回的 `thinkingLevels` 渲染，模型无推理能力时隐藏或禁用，不假设 high/xhigh 一定可用 |
| 图片 | 文件按钮、拖放、粘贴三种入口；浏览器端 Canvas 压缩为受控尺寸和质量；保留缩略图、删除、数量/尺寸提示；用 base64/mimeType 通过 prompt 命令发送 |
| 压缩 | 显示 context usage；空闲时可手动 `compact`，压缩中显示状态并允许 `abort_compaction`，结束后刷新 context 和统计 |
| `@` 文件引用 | 依赖 SA-3 的受限文件索引，输入 `@` 时只补全当前 cwd 的相对路径；不自动读取文件内容，不允许手输绝对路径绕过索引 |
| `/` 命令入口 | 输入 `/` 时显示内置命令和当前已加载 skill 的命令名称、简短说明与来源；选择后只填充文本，仍走既有 prompt 提交，避免在前端重新实现命令执行 |
| 输入历史 | 保存当前浏览器的成功提交文本，不保存图片 base64、凭证或系统生成内容；上/下方向键只在输入为空或光标边界时触发，避免干扰中文输入法 |
| 发送语义 | 保留当前“先建立 SSE，再 prompt”的顺序；有图片但无文字也允许发送；失败时恢复文字与图片草稿 |

验收：切换模型和思考等级后 reload 仍与服务端状态一致；粘贴、拖放和文件选择都能产生预览；超过上限或不支持图片的模型有可理解的阻止/警告；`@` 和 `/` 只显示当前项目与当前会话的合法候选；压缩开始、取消、完成均不会卡住 composer。

进度：`[ ]`

### SA-6：顶栏基础操作和使用量可见化

**目标**：实现截图顶部真正有操作价值的内容，不把 token 统计误当成装饰文字。

| 区域 | 首版范围 | 参考 |
|---|---|---|
| 顶部会话操作 | 收起侧栏、会话重命名、生成标题、当前项目会话搜索入口 | `pi-web/components/AppShell.tsx`、`app/api/sessions/[id]/auto-name/route.ts` |
| 系统与工具 | 只读抽屉展示当前 system prompt 和 agent 已注册工具 | `components/SystemPromptPanel.tsx`、`components/ToolDefinitionsPanel.tsx`、`lib/rpc-manager.ts` 的 `get_state` |
| 使用量 | input、output、cache read/write token、累计 cost、当前 context percent/window；鼠标悬停或点击展开完整解释 | `components/AppShell.tsx`、`lib/session-stats.ts` |
| 状态规则 | 无价格数据时显示 `--` 不估算；无 context window 时隐藏百分比；切换会话时立即清空旧统计，避免短暂串会话 |

验收：连续切换会话后顶栏数值只属于当前会话；流式结束、压缩完成和刷新后统计会更新；缺少 usage/cost 的旧会话不会抛错；窄屏只保留图标和关键 context 指示。

进度：`[ ]`

### SA-7：左下模型、技能与设置面板

**目标**：补上截图左下入口，使用户能查看并调整基础配置，而不强行在此阶段复制全部配置中心。

| 面板 | Step A+ 必须范围 | 参考 | 延后范围 |
|---|---|---|---|
| 模型 | 当前可用模型、默认模型、当前模型、模型选择错误；模型列表刷新 | `components/ModelsConfig.tsx`、`app/api/models/route.ts` | OAuth/device code、API Key 写入、models.dev catalog、在线连通性测试 |
| 技能 | 按当前 cwd 列出全局/项目技能、来源、是否允许模型调用；仅切换 `disable-model-invocation` | `components/SkillsConfig.tsx`、`app/api/skills/route.ts`、`lib/skill-frontmatter.ts` | skill 搜索、安装、更新和包市场 |
| 设置 | 主题、语言、完成提示音、默认工具预设等不触及凭证的应用偏好；持久化到浏览器 | `components/SettingsPanel.tsx` | 插件包、子代理 profile、项目权限弹窗体系 |

验收：从三个入口可打开和关闭面板；技能切换只修改目标 frontmatter 字段并保留其余内容；无权限、加载失败、没有技能/模型都有明确空态；设置刷新后保持。

进度：`[ ]`

### SA-8：工作区 UI 收口与全链路验收

**目标**：在功能完整后，按截图的信息密度优化布局，并把关键链路固定成回归用例。

| 项目 | 要求 |
|---|---|
| 桌面布局 | 左栏固定宽度且上下分为项目/会话与文件树，中间聊天占可用空间，顶栏和 composer 固定，不以卡片包裹整页 |
| 响应式 | 窄屏左栏变抽屉，顶栏数值折叠，所有文字和下拉不溢出；不能为了凑截图而牺牲小屏交互 |
| 视觉依据 | 参考提供截图的层级、密度和操作位置，不逐像素复刻 pi-web；沿用 Vue 项目的配色与组件习惯，并统一状态、禁用、loading、空态和错误态 |
| 自动化 | 新增纯函数测试：项目/worktree 归属、路径安全、文件索引、图片边界、usage 汇总；补 store 测试：最后一次会话选择胜出、模型切换失败回滚、标题更新不串会话 |
| 浏览器烟测 | 用两个项目、一个 Git 多 worktree 项目、带图片消息和旧 `.jsonl` 会话各走一遍 |

最终通过条件：本文件第 2 节的连续流程全程可用，`npm run typecheck` 和 `npm test` 通过，浏览器控制台没有未处理异常。

进度：`[ ]`

## 5. pi-web 基础功能复核与取舍

下表是对旧项目基础能力的二次筛选。判断标准是使用频率、对当前聊天闭环的补足程度、是否能在不触碰会话树和高风险资源生命周期的情况下独立落地。

| 旧项目能力 | 决策 | 原因与落点 |
|---|---|---|
| 项目选择、已有 worktree 切换、项目内会话列表 | 纳入 SA-2 | 截图左上主流程，直接决定新对话 cwd 和会话归属 |
| 文件树、文本/图片预览、文件名搜索、`@文件` 引用 | 纳入 SA-3 与 SA-5 | 高频编码工作流；服务端路径白名单是必需前置，不等同于简单 UI |
| 手动改名、自动标题、当前项目会话搜索 | 纳入 SA-4 | 都不依赖会话分支，能显著降低历史会话查找成本 |
| 模型、思考等级、图片压缩、上下文压缩 | 纳入 SA-1 与 SA-5 | SDK 状态已在当前项目中存在，缺的是安全命令与可操作 UI |
| token、cost、context usage、system prompt、工具定义 | 纳入 SA-6 | 截图顶栏的高价值信息；使用量和运行限制应可见而非隐藏 |
| `/` 命令面板、输入历史 | 纳入 SA-5 | 仅是现有 prompt 的发现与编辑能力，不改变 agent 执行模型 |
| 技能开关、主题/语言/提示音等应用偏好 | 纳入 SA-7 | 对应截图左下入口，首版不接触凭证和包安装 |
| 完整历史或按页加载更早消息 | 暂缓 | 当前 Vue 会话读取没有分页，直接加“完整历史”按钮只会重复已加载内容；应先在有大历史性能证据后引入分页协议 |
| 工具预设切换，例如 chat only/read only/full | 暂缓 | 旧项目跨越 chat-only 边界时必须重建 wrapper，且会改变可执行能力，不是单纯下拉菜单 |
| 远程模型发现、OAuth、API Key、模型连通性测试 | 暂缓 | 凭证写入和 SDK 兼容面明显扩大；A+ 只消费本机已有配置 |
| 文件上传、Git diff、PDF/DOCX/音频预览 | 暂缓 | 属于有价值的文件增强，但包含写入、二进制处理或重依赖，不阻塞“读取文件并引用” |
| fork、删除、导出会话 | 暂缓 | fork 会改变 wrapper 内部状态，删除需重挂 child session，导出需审查敏感内容；三者都不应挤占 A+ |
| 创建/删除 Git worktree | 暂缓 | 涉及分支创建、脏目录和强制删除确认；先保证已有 worktree 可安全切换 |
| 会话内分支、编辑重发、BranchNavigator | 留在 Step B | 这是 `06-history-branching.md` 的核心复杂度，不能提前伪装成左上 Git branch 功能 |
| 终端、插件、子代理、PWA、推送 | 不纳入当前路线 | 价值存在，但与用户已点名的基础工作区闭环相比优先级低且维护成本高 |

## 6. 依赖关系与实施纪律

```text
SA-1
 ├─ SA-2 项目与 worktree
 │   └─ SA-3 文件树与 @ 文件索引
 ├─ SA-5 模型 思考 图片 压缩
 │   └─ SA-6 顶栏统计与运行信息
 ├─ SA-4 会话管理 自动标题 搜索
 └─ SA-7 设置面板

SA-3 SA-4 SA-6 SA-7 -> SA-8 UI 收口与全链路验收
```

可以并行阅读 SA-2、SA-4、SA-5 的旧项目代码，但实施顺序保持上图，尤其不能在没有 SA-1 图片校验和路径安全前暴露文件或图片入口。A+ 全部完成并验收后，才进入 Step B 的 `06-history-branching.md`。

## 7. 参考实现的复用规则

| 可直接移植或近似移植 | 必须重写 | 原因 |
|---|---|---|
| `lib/image-attachments.ts`、`lib/session-stats.ts`、`lib/path-security.ts` 等无框架纯函数 | `SessionSidebar.tsx`、`ChatInput.tsx`、`FileExplorer.tsx`、`AppShell.tsx` | React 状态生命周期和 Nuxt 组件/路由模型不同 |
| `lib/worktree.ts` 的路径归一化与 Git 解析规则 | Next API route | Nitro 的请求/响应和运行时不同 |
| `lib/skill-frontmatter.ts` 的最小 frontmatter 修改策略 | ModelsConfig 的完整提供商配置页面 | 后者涉及凭证、OAuth、SDK 版本兼容和安全边界 |

每个实际移植的文件都要：

1. 在文件头保留精炼的来源注释，注释不使用标点
2. 在 `THIRD_PARTY_NOTICES.md` 增加准确文件清单和 MIT 归属
3. 为调整过的边界条件补充本项目测试，不能因“旧项目已有”省略验证

## 8. 风险清单

| 风险 | 后果 | 处理策略 |
|---|---|---|
| 把截图中的 Git worktree 误认为会话分支 | 提前混入 Step B 的 tree 状态，导致工作区实现失焦 | A+ 只保存 `selectedWorktree`，`activeLeafId` 只在 Step B 引入 |
| 直接按字符串授权文件路径 | 可读到 cwd 外敏感文件 | `realpath` 后做根目录包含校验，覆盖符号链接测试 |
| 图片只在前端限制 | 可被直接 API 请求绕过，内存和 SDK 输入失控 | 前后端同时执行数量、MIME、base64、解码大小校验 |
| 模型切换先改 UI 后请求 | 失败后显示模型与 agent 实际模型不一致 | 等命令成功后提交状态，失败保留旧值 |
| 会话或项目切换竞态 | 旧请求覆盖新会话消息或旧文件树 | fetch 使用递增请求标识或 AbortController，只接受当前目标结果 |
| 复制旧项目组件 | 无法运行且产生维护负担 | 只复用纯函数或行为约束，Vue 组件从状态契约重写 |
| 把完整配置中心纳入首版 | 进度被 OAuth、凭证和插件管理吞没 | SA-7 只完成用户点名的基础模型/技能/偏好，复杂管理另立计划 |

## 9. 总览进度

- [x] 完成现状与旧项目能力盘点
- [x] 完成 Step A+ 范围和非目标定义
- [ ] SA-1 底层契约、命令与安全边界
- [ ] SA-2 项目、Git worktree 与会话工作区
- [ ] SA-3 文件树与安全文件查看
- [ ] SA-4 会话管理、自动标题与项目内搜索
- [ ] SA-5 模型、思考、图片与压缩
- [ ] SA-6 顶栏基础操作和使用量
- [ ] SA-7 模型、技能与设置面板
- [ ] SA-8 UI 收口与全链路验收
