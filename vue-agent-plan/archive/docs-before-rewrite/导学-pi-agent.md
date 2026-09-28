# pi-agent Web 项目导学

> 目标岗位：前端开发，兼顾 Agent 工程能力
>
> 事实边界：本文依据当前仓库、锁定的 `@earendil-works/pi-coding-agent@0.85.1` 本地 SDK 文档和测试整理。个人职责、真实用户、性能指标和上线结果均未从代码推断，面试时只能按你的真实经历补充。

## 先说结论

这是一个以 Vue 3 + Nuxt 4 实现的本机 Pi Coding Agent 工作台。它的核心不是自行训练模型、实现规划算法或搭建 RAG，而是把 Pi SDK 已有的 Agent runtime 放在 Nuxt 服务端运行，再把运行中的结构化事件可靠地投射到浏览器。

它最适合前端秋招讲的能力是：

1. 复杂异步状态建模：SDK 生命周期、HTTP 命令、SSE 事件、流式草稿与落盘历史并存。
2. 流式体验可靠性：业务握手、握手前事件缓冲、断线重连、快照重放、心跳、乐观更新和停止兜底。
3. Agent 集成边界：浏览器不持有模型凭证、不直接执行本地工具，服务端维持会话和资源加载。
4. 可解释的执行界面：文本、思考、工具调用、工具结果、压缩、重试、队列和上下文用量都有对应状态。
5. 会话互操作：与 Pi CLI/pi-web 共用 `~/.pi/agent` 的配置和 JSONL 会话数据。

不要把本项目表述为“从零实现 Agent runtime”。更准确的说法是：**基于 Pi SDK 的 AgentSession 构建了 Web 端运行管理、事件桥接和前端状态层。** Agent 的模型调用和工具循环由 SDK 负责；本项目负责 SDK 与浏览器之间的工程契约。

## 先纠正四个常见误解

| 说法 | 判断 | 依据与正确表述 |
| --- | --- | --- |
| 项目已经实现 MCP | 不成立 | `app/components/capabilities/McpPanel.vue` 明确显示“尚未接入 MCP Bridge”。可说已预留 MCP 管理入口，不能说已接入或管理 MCP 服务。 |
| 项目是 RAG 应用 | 不成立 | 仓库没有 embedding、向量索引、召回、重排或引用归因链路。RAG 是适合后续补充的能力，不是当前项目能力。 |
| 会话分支已经完整落地 | 不成立 | 服务端有 `navigate_tree` 基础命令与活跃分支读取函数，但 `fork` 在 `server/utils/rpc-manager.ts` 直接抛出未实现异常，前端也没有分支导航组件。README 中“会话分支”表述应以当前代码状态为准。 |
| 接入 SDK 就等于理解 Agent | 不充分 | 能调用 SDK 只是入口。面试要讲清 session、事件、工具、上下文、失败状态和安全边界，才体现 Agent 工程理解。 |

## 项目技术定位

**定位：前端主导的 Agent 应用集成项目，包含必要的 BFF/本机服务端层。**

依据是浏览器工作台、Pinia 状态机、流式渲染和工具可视化占主要用户体验；Nuxt server routes 负责持有无法进入浏览器的 Pi SDK 会话、凭证、文件系统与命令执行能力。它不是多租户 Agent 平台，也不是检索问答系统。

## 前置知识

| 知识点 | 为何需要 | 在本项目中的位置 | 高频度 |
| --- | --- | --- | --- |
| LLM 消息与 token | 理解 user、assistant、toolCall、toolResult 与上下文窗口 | `shared/lib/types.ts`、`server/utils/session-reader.ts` | 很高 |
| Tool calling | 理解模型请求工具、工具执行、工具结果回填与下一轮推理 | `shared/lib/streaming-message.ts`、`app/components/ToolCallCard.vue` | 很高 |
| AgentSession 生命周期 | 理解创建、恢复、prompt、abort、compact、dispose | `server/utils/rpc-manager.ts`、SDK `docs/sdk.md` | 很高 |
| SSE 与 EventSource | 理解单向事件流、握手、重连、心跳、取消 | `server/utils/event-stream.ts`、`shared/lib/agent-event-connection.ts` | 很高 |
| 前端状态机/reducer | 让增量事件稳定变成 Vue 可渲染状态 | `app/stores/chat.ts`、`shared/lib/streaming-message.ts` | 很高 |
| JSONL 与树状会话 | 理解持久化、父子 entry、活跃分支和恢复 | `server/utils/session-reader.ts` | 高 |
| 上下文管理/压缩 | 解释 context window、compaction 与停止的区别 | `server/utils/rpc-manager.ts`、`app/stores/chat.ts` | 高 |
| ResourceLoader/Skills/Extensions | 区分静态上下文资源、命令和工具扩展 | SDK `docs/sdk.md`、`server/api/skills.get.ts` | 高 |
| MCP | 作为外部工具协议的下一阶段能力，不混同为当前实现 | `app/components/capabilities/McpPanel.vue` | 中高 |
| RAG | 作为检索增强能力，理解如何通过工具接入 Agent | 当前仓库未实现 | 中高 |
| 评测、观测与安全 | 说明 Agent 应用如何可控、可验证、可上线 | 当前项目仅本机边界，待补 | 高 |

## 一张图看完整链路

```text
用户输入或图片
        |
        v
Vue ChatComposer
        |
        |  先建立 EventSource 并等待业务 connected
        v
Pinia chat store -------------------------------------------+
        |                                                   |
        | POST /api/agent/:id { type: "prompt" }           | SSE /api/agent/:id/events
        v                                                   |
Nuxt server route                                            |
        |                                                   |
        v                                                   |
AgentSessionWrapper  -- session.subscribe(event) -- Pi SDK   |
        |                         |                          |
        | prompt preflight ack    | text thinking tool events |
        v                         v                          |
Pi AgentSession -> Model + system prompt + tools + skills    |
        |                         |                          |
        | toolCall                | toolResult               |
        v                         v                          |
本地文件系统与命令执行       createAgentEventStream        |
                                  |                          |
                                  | 裁剪大快照 缓冲 心跳 快照 |
                                  +--------------------------+
                                             |
                                             v
                          streamReducer + 已定稿 messages
                                             |
                                             v
             MessageItem ThinkingBlock ToolCallCard FileViewer
```

### 一次正常对话的时序

1. 用户创建空会话。`POST /api/sessions` 只初始化 SDK session，不携带首条 prompt。
2. 路由进入会话页。`chat.openSession()` 读取已有历史，同时 `AgentEventConnection` 打开 EventSource。
3. 服务端可立即返回 SSE HTTP 头，但只有 Pi session 已启动、事件监听已挂好后才发送业务事件 `connected`。
4. 用户提交时，前端先乐观添加用户消息并设为运行中，再 `await ensureConnected()`；收到 `connected` 才 POST prompt。
5. `AgentSessionWrapper.sendPrompt()` 调用 SDK `session.prompt()`；`preflightResult(true)` 表示 prompt 已被接受，HTTP 命令可以返回，真正的运行过程仍通过 SSE 下推。
6. SDK 推送 `agent_start`、`message_start`、`message_update`、工具执行事件和 `message_end`。服务端过滤不必要事件并裁剪大 `partial` 快照。
7. 前端 reducer 按 `contentIndex` 组装 text、thinking、toolCall 三类增量；工具结果以 `toolCallId` 与工具调用卡片配对。
8. `agent_settled` 才表示 Agent 确实安静，前端清理运行态并 reload 落盘历史；停止命令另有 3 秒对账兜底。

## 核心原理解析

### 1. Agent runtime 不是一个 HTTP 接口

**问题：** 普通聊天接口可以“一次请求，一次响应”，但 Coding Agent 会持续调用模型、执行工具、继续推理、重试或压缩上下文。

**机制：** Pi 的 `AgentSession` 保存模型、消息历史、工具、system prompt、streamingMessage、压缩状态和事件订阅；SDK 文档还把“替换会话和重建 cwd 相关资源”抽象为 `AgentSessionRuntime`。当前项目没有直接用完整 runtime 类，而是以 `AgentSessionWrapper` 管理单个 `AgentSession` 的生命周期。

**项目落点：** `server/utils/rpc-manager.ts` 以 session id 为键维护 wrapper Map、启动锁和 10 分钟空闲回收。它把 SDK 的 `prompt`、`abort`、`compact`、`set_model`、`set_thinking_level`、`navigate_tree` 转成浏览器命令。

### 2. HTTP 接受命令不等于 Agent 已完成

**问题：** SDK 的 `prompt()` Promise 会在一整轮 Agent run 结束后才 resolve。如果 HTTP 一直等它，前端没有及时确认；如果 HTTP 过早返回，又无法区分“请求被拒绝”和“请求已接受后运行失败”。

**机制：** SDK 的 `preflightResult(true)` 在同步校验与扩展预检成功时先回调。服务端等待这个确认后响应 POST，后续文本、工具和错误全部走 SSE；接受后的错误以 `prompt_error` 事件通知。

**项目落点：** `AgentSessionWrapper.sendPrompt()` 用一个 preflight Promise 分离“accepted”和“finished”，并维护 `pendingPromptCount`，避免同步抛错后运行态泄漏。

### 3. SSE 打开不等于 SDK 可以安全收事件

**问题：** EventSource 的网络连接已经 open 时，Pi session 可能仍在冷启动，或事件监听器尚未挂上。此时立即发送短 prompt，首轮事件可能丢失。

**机制：** 服务端先写出 SSE 注释行开通通道，再创建/恢复 session、安装订阅、缓存握手前事件，最后发送业务级 `connected`。浏览器只把 `connected` 当作可提交条件，不把 EventSource 的底层 open 当作就绪。

**项目落点：** `server/utils/event-stream.ts` 的 `createAgentEventStream()` 与 `shared/lib/agent-event-connection.ts`；`app/stores/chat.ts` 的 `sendPrompt()` 明确等待 `ensureConnected()`。

### 4. 流式 UI 要区分“已定稿历史”和“正在生成的草稿”

**问题：** 如果每个 delta 都直接改历史数组，容易出现重复消息、工具结果无法配对或停止后幽灵气泡。

**机制：** 状态拆为 `messages` 与 `{ isStreaming, streamingMessage }`。`message_update` 只喂给纯 reducer；`message_end` 把完整消息落入历史后再清空草稿。每个 content block 用 `contentIndex` 定位，因此 text、thinking、toolCall 可以交错增量出现。

**项目落点：** `shared/lib/streaming-message.ts` 是框架无关的 reducer，`app/stores/chat.ts` 是事件分发层，`MessageItem.vue` 按内容块顺序渲染。

### 5. 工具调用是 Agent loop 的关键，不是普通前端卡片

**问题：** 模型输出 toolCall 后，Agent 还没有完成；工具运行、部分输出、结果、下一轮模型推理都可能继续发生。

**机制：** 工具调用有独立的开始、更新、结束事件；最终 `toolResult` 用 `toolCallId` 配对。服务端将 `tool_execution_update` 裁剪为必要字段，前端通过 `activeTools` 表示运行期，通过已定稿 `toolResult` 表示最终结果。

**项目落点：** `shared/lib/agent-event-wire.ts`、`app/stores/chat.ts`、`app/components/ToolCallCard.vue`。当前 SDK 默认可用 read、bash、edit、write 等本地工具，所以安全边界必须明确为仅本机。

### 6. 会话持久化不是把消息数组存 JSON

**问题：** Agent 会话需要恢复模型选择、思考等级、工具结果和分支历史，线性 messages 数组不足以表达这些事实。

**机制：** Pi 会话是 JSONL entry 序列，每个 entry 带 `id` 与 `parentId`。当前活跃上下文由 leaf 沿 parentId 向根回溯得到；`model_change`、`thinking_level_change` 等非消息 entry 不直接渲染，但会影响有效运行配置。

**项目落点：** `server/utils/session-reader.ts` 读取 header、扫描会话、解析路径、用迭代方式构建活跃祖先链；`messages[]` 与 `entryIds[]` 保持平行，后者才是树操作的真实标识。

### 7. Context engineering 不是单纯“把历史全塞给模型”

**问题：** 上下文窗口有限，长会话会增加成本、延迟和模型遗漏关键事实的风险。

**机制：** Pi session 提供 context usage 和 compaction。压缩是对历史的总结/替换流程，`abortCompaction` 与 `abort` 是不同控制动作；运行中还可能发生自动压缩与重试。

**项目落点：** `rpc-manager.ts` 分开 `compact`、`abort_compaction` 和 `abort`；前端区分 `isCompacting` 与 `isRunning`，并显示 context usage。面试要能解释“压缩不是删除历史，而是受控地用摘要保留后续推理需要的信息”。

## 重点亮点与学习顺序

| 亮点标题 | 为什么重要 | 通用技术关键词 | 先看哪些文件 | 建议学习顺序 |
| --- | --- | --- | --- | --- |
| 运行生命周期管理 | 解释为什么 Agent 不是一次 fetch | session lifecycle、冷启动、锁、回收、dispose | `server/utils/rpc-manager.ts`、SDK `docs/sdk.md` | 1 |
| 流式事件桥接 | 项目最强的工程证据 | SSE、业务握手、backpressure 概念、快照、心跳、重连 | `server/utils/event-stream.ts`、`shared/lib/agent-event-connection.ts` | 2 |
| 前端状态一致性 | 体现前端难点而非只会展示 Markdown | reducer、乐观更新、竞态、对账、不可变状态 | `app/stores/chat.ts`、`shared/lib/streaming-message.ts` | 3 |
| 工具执行可视化 | 连接 Agent loop 与 UX | toolCall、toolResult、结构化事件、运行态 | `shared/lib/agent-event-wire.ts`、`ToolCallCard.vue` | 4 |
| 会话互操作与树模型 | 区别于普通聊天记录 | JSONL、parentId、active branch、恢复 | `server/utils/session-reader.ts`、`shared/lib/types.ts` | 5 |
| 资源加载与安全边界 | 说明技能、扩展、凭证与本地权限如何分层 | ResourceLoader、skills、extensions、trust、least privilege | `server/api/skills.get.ts`、`server/utils/extensions.ts`、SDK `docs/sdk.md` | 6 |

## 推荐阅读

| 主题 | 通用技术点 | 建议阅读位置 | 预计时间 | 读完能回答什么 |
| --- | --- | --- | --- | --- |
| Pi SDK 概览 | AgentSession、runtime、prompt、事件 | `node_modules/@earendil-works/pi-coding-agent/docs/sdk.md` | 90 分钟 | SDK 负责什么，应用层负责什么 |
| 服务端会话包装 | 单会话生命周期、启动锁、空闲回收、预检确认 | `server/utils/rpc-manager.ts` | 90 分钟 | 为什么 POST 不能等待整轮生成结束 |
| SSE 协议适配 | connected、缓冲、快照、心跳、abort 清理 | `server/utils/event-stream.ts` | 60 分钟 | 为什么 EventSource open 不是业务就绪 |
| 前端连接管理 | ready timeout、异常重连、停止重连 | `shared/lib/agent-event-connection.ts` | 45 分钟 | 如何避免重连风暴和过期连接 |
| 增量消息 reducer | contentIndex、start/delta/end、定稿 | `shared/lib/streaming-message.ts` | 45 分钟 | 如何保证流式气泡不会重复或错位 |
| Chat store | 乐观更新、运行态、工具态、对账 | `app/stores/chat.ts` | 120 分钟 | 如何处理切会话、停止、迟到事件 |
| 会话持久化 | JSONL、树、entryId、模型状态回溯 | `server/utils/session-reader.ts` | 75 分钟 | 为什么 entryId 不等于消息下标 |
| 验证用例 | 时序风险如何被自动化验证 | `tests/server/utils/event-stream.test.ts`、`tests/server/utils/rpc-manager.test.ts`、`tests/app/stores/chat.test.ts` | 60 分钟 | 如何把竞态和资源回收变成可测契约 |

## 你需要补什么 Agent 知识

### A 级：必须讲清，优先于 RAG

1. **LLM 与工具循环**
   - System/user/assistant/tool 消息各自的职责。
   - 模型为什么会输出工具调用，工具结果为何必须回填给模型。
   - 一次 run 可以有多轮“模型输出 -> 工具执行 -> 模型继续”的循环。
   - 结构化输出、JSON Schema、输入校验、超时、重试、幂等和工具结果截断。

2. **Agent runtime 与 session**
   - runtime 是管理模型、上下文、工具、资源、运行状态和会话替换的执行环境，不等于一个 prompt 模板。
   - session 生命周期：创建、恢复、订阅、运行、取消、压缩、释放。
   - 冷启动、并发同会话、空闲回收、会话替换后重新订阅的原因。
   - “accepted、running、settled”是不同状态，不能只用一个 loading 布尔值。

3. **Context engineering**
   - token、context window、输入/输出/缓存 token、模型能力差异。
   - 上下文优先级：system instruction、AGENTS.md、skills、历史、工具结果、用户输入。
   - compaction、摘要、截断、文件引用与长工具输出治理。
   - prompt injection 为什么可能从用户输入、文件内容、工具输出和检索文档进入上下文。

4. **流式 Agent UX**
   - SSE 与 WebSocket 的职责差异：当前项目是小量命令上行、持续事件下行，HTTP POST + SSE 够用。
   - 业务握手、断线重连、快照恢复、幂等/去重、取消、过期响应守卫。
   - 文本 delta、thinking delta、tool argument delta 与工具执行进度不是同一种事件。

5. **安全和可控性**
   - Agent 具备工具后，风险从“模型回答错”扩展到“模型触发真实副作用”。
   - 权限最小化、读写分级、危险操作确认、cwd/path allowlist、密钥隔离、审计日志、用户可中止。
   - 当前项目无鉴权且可执行任意命令，只能本机使用。它是明确约束，不是可忽略的细节。

### B 级：学完 A 后补，能形成加分项

1. **MCP**
   - Host、Client、Server 三个角色；协议的 capabilities 不是“前端直接调一个 npm 包”。
   - tools、resources、prompts 的语义差别，初始化协商、schema、错误、取消、超时和凭证处理。
   - stdio 与 Streamable HTTP 的部署取舍；动态服务器列表、重连、工具刷新与 UI 状态。
   - 将 MCP server 暴露的 tool 映射为 Pi 可用工具时，如何限制能力与向用户展示风险。

2. **RAG**
   - 文档采集 -> 清洗 -> chunk -> embedding -> 索引 -> query rewrite -> 检索 -> 重排 -> context assembly -> 生成与引用。
   - 向量召回不是全部：关键词/BM25、metadata filter、hybrid retrieval、rerank 往往决定质量。
   - 评估分为检索质量和回答质量：Recall@K、MRR/NDCG、citation correctness、faithfulness、延迟、成本。
   - 作为 Agent 工具设计 `search_knowledge`，而不是把所有检索结果强行塞进首轮 system prompt。

3. **评测与观测**
   - trace/run id、事件时间线、模型/工具耗时、token/cost、失败原因、重试次数。
   - 固定任务集、golden cases、工具调用成功率、人工验收与回归测试。
   - 不能仅用“感觉回答不错”证明 Agent 质量。

### C 级：了解即可，不要抢走基础时间

- ReAct、Plan-and-Execute、Reflection、Router、Supervisor 等 Agent 模式。
- Multi-agent 协作、子代理、长期记忆、Computer Use。
- 微调、训练、模型推理优化、向量数据库底层索引。

这些方向可作为扩展阅读，但对于前端秋招，能把当前单 Agent 运行链路、状态一致性和安全控制讲透，价值高于背诵多 Agent 名词。

## 建议学习路线

| 阶段 | 学习目标 | 结合本项目的练习 | 产出 |
| --- | --- | --- | --- |
| 第 1 阶段 | 掌握 LLM/tool loop 基础 | 画出 prompt 到 toolResult 再到下一轮推理的消息序列 | 一张时序图和 3 分钟口述 |
| 第 2 阶段 | 吃透 runtime 与状态机 | 从 `startRpcSession` 跟到 `agent_settled`，手写事件状态表 | 事件-状态映射表 |
| 第 3 阶段 | 吃透 SSE 可靠性 | 人为断开 EventSource，解释快照重放与重连链路 | 一段录屏或测试用例解读 |
| 第 4 阶段 | 补 MCP | 先读协议角色，再设计一个受控 MCP bridge 的接口与错误态，不急于做大而全管理台 | 架构图与最小接口设计 |
| 第 5 阶段 | 补 RAG | 用一个小型文档集实现有引用的 `search_knowledge` 工具，比较不检索与检索后回答 | 可复现 demo 和评测样例 |
| 第 6 阶段 | 补安全与评测 | 给工具增加风险等级、确认策略、事件 trace 和固定回归任务 | 风险矩阵与测试清单 |

## 最值得做的两个后续增强

### 1. 受控 MCP Bridge

目标不是堆一个“可安装任意 MCP 服务”的面板，而是先完成一条可审计、可取消、可展示错误的最小链路：注册一个受信任本地 server -> 初始化与 capabilities 协商 -> 读取 tools -> 作为 Pi 扩展工具注入 -> 显示连通性、工具数量、最近错误和权限范围。

关键取舍：当前 Pi 已能执行本地 shell 与文件工具，盲目再接 filesystem 或 shell MCP server 会扩大重复的高危能力。第一个 demo 应选择低副作用的只读知识/日历/代码检索服务，或者明确做只读模式。

### 2. 可引用的项目文档 RAG 工具

目标是让 Agent 面对仓库文档时通过 `search_knowledge` 调用检索，而不是依赖模型猜测。返回值至少包含片段、文件路径、标题、分数和版本信息；回答 UI 显示可点击引用。

关键取舍：先做小规模、可评测的本地 Markdown 文档集，再考虑向量库。没有 query set、引用正确性和失败样例时，直接接向量数据库只会新增复杂度，无法证明质量。

## 当前项目的风险与可讲边界

| 维度 | 当前事实 | 面试中应如何说 | 下一步策略 |
| --- | --- | --- | --- |
| 权限 | 无鉴权，Agent 可执行本地命令 | 仅本机 `127.0.0.1` 使用，不能作为公网服务部署 | 增加认证、授权、工具确认与审计后再讨论部署 |
| MCP | UI 空态，未有 bridge | 预留能力中心入口，尚未接入 | 先做一个受控只读 server |
| RAG | 未实现 | 正在补基础知识，未把它包装成既有功能 | 小语料、可引用、可评测地实现 |
| 分支 | 文件树读取基础存在，fork 未完成 | 会话树数据结构已具备，交互分支仍在计划中 | 完成 navigate UI、fork 生命周期与回归测试 |
| 多用户 | 没有会话隔离、鉴权、配额 | 单用户本机开发工具 | 不把个人项目夸大为 SaaS 平台 |
| 评测观测 | 有单测，缺少 Agent 任务级质量评测和 trace | 已覆盖关键时序纯函数，质量指标待补 | 固定任务集、事件 trace、工具成功率和成本记录 |

## 自学提醒

若某个文件或原理看不懂，请继续追问 AI；本材料负责给学习路径与题目，不提供逐行讲解。

## 量化与验证

当前仓库可确认有 40 个 `*.test.ts` 文件，且关键时序已有自动化用例，例如 wrapper 销毁关闭 SSE、prompt 的 preflight/异步失败、会话切换慢响应丢弃。不能由此推导真实用户、性能提升或线上稳定性。

建议补的测量：

1. 同一组任务下，记录首 token 时间、完整 run 时间、SSE 重连恢复时间和工具调用成功率。
2. 对停止、刷新、网络中断、会话切换、模型切换和上下文压缩建立端到端回归清单。
3. 对 RAG 建立 query 集，分别统计检索命中、引用正确性、回答可验证性、延迟和成本。
4. 对 MCP 记录初始化失败、工具发现失败、调用超时、取消和权限拒绝的可见状态。
