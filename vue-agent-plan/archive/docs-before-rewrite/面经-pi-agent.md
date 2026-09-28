# pi-agent Web 项目面经

> 目标岗位：前端开发，兼顾 Agent 工程能力
>
> 使用前提：下文的第一人称口播只适用于你确实参与或负责对应代码时。个人职责、项目独立完成程度、真实用户、性能数字和上线效果没有从仓库推断，必须按真实经历替换；不要背诵后声称“从零实现模型 Agent runtime”或“已经落地 MCP/RAG”。

## 项目简介

基于 Vue 3、Nuxt 4 和 TypeScript 实现本机 Pi Coding Agent 的 Web 工作台：服务端托管 Pi SDK 的会话、模型和工具能力，浏览器通过 HTTP 命令与 SSE 事件流完成会话恢复、流式文本/思考/工具执行可视化、模型控制和文件查看。项目与 Pi CLI/pi-web 共享 `~/.pi/agent` 的配置和 JSONL 会话数据，重点解决 Agent runtime 到前端状态之间的生命周期、断线恢复和一致性问题。

## 简历 Bullet

以下 bullet 均需要先确认“我实际做过这部分”。没有可核验性能数据时，结果只写结构性结果和验证计划。

- **流式状态一致性：** 针对 Agent 运行同时存在 HTTP 命令、SSE 增量、已落盘历史和前端乐观消息的问题，构建基于业务握手与 reducer 的状态同步机制：将已定稿消息和流式草稿分离，按 `contentIndex` 组装文本、思考和工具调用，并在停止、切会话和迟到事件场景执行对账，形成可测试的流式渲染状态边界。
- **运行生命周期管理：** 针对浏览器无法直接持有本地模型凭证、文件工具和会话资源的限制，在 Nuxt 服务端封装 SDK session 生命周期：用 session id 注册表、并发启动锁、空闲回收和 dispose 通知管理运行实例，将 prompt 接受确认与完整 run 结束拆分，避免长任务阻塞命令确认。
- **断线恢复协议：** 针对 EventSource 已连接但 SDK 尚未就绪、以及刷新页面后流式气泡丢失的时序风险，实现业务级 `connected` 握手、握手前事件缓冲、流式快照重放、心跳与重连策略，使浏览器能在会话运行期间恢复可见状态；弱网成功率和恢复耗时需通过固定场景进一步测量。
- **可解释工具交互：** 针对 Coding Agent 的工具调用过程对用户不可见的问题，将 SDK 工具事件映射为参数流入、执行中、部分进度、结果和错误等可读状态，并以 `toolCallId` 配对调用与结果，让模型生成、工具副作用和最终反馈的边界可追踪。
- **会话互操作与恢复：** 针对普通聊天记录无法表达模型配置、工具结果和分支上下文的问题，基于 Pi JSONL 的 `id`/`parentId` entry 链构建会话读取层，恢复活跃分支、模型与思考等级，并兼容 CLI、pi-web 和本项目共同读写的本地会话生态。
- **关键时序测试：** 围绕 prompt 预检、会话回收、SSE 关闭、慢响应切会话和工具事件组装编写 Vitest 用例，把异步链路中最容易回归的时序约束转成自动化契约；当前仓库可见 40 个测试文件，未将其夸大为线上可靠性指标。

## 面试问题

### 一、定位与架构

### 1. 你这个项目到底是一个什么类型的 Agent 项目

**口播：** 这是一个基于 Pi Coding Agent SDK 的本机 Web 工作台，而不是自己训练模型或从零实现规划算法的项目。我的重点是把 SDK 里的 AgentSession、模型、技能和工具能力放在 Nuxt 服务端运行，浏览器只负责命令输入、SSE 事件接收和可解释的执行界面。场景上，普通聊天页面只需要渲染一段回答，但 Coding Agent 一次任务可能经历模型输出、工具调用、工具结果、继续推理、重试或上下文压缩，所以我把它当成一个长生命周期异步应用来设计。结果是前端能展示文本、思考、工具执行和最终历史，同时保持本地 Pi CLI 会话互通。没有真实用户和性能指标时，我不会把它包装成生产 Agent 平台。

**追问：你说的 Agent 和普通 LLM Chat 有什么本质区别**

**口播：** 我理解普通 Chat 的核心是把用户消息交给模型再返回文本，而 Agent 的关键在于模型可以基于当前任务选择工具，并根据工具结果继续决策，因此一次用户请求不是单次模型调用。以本项目为例，模型会产生 toolCall，SDK 执行 read、bash、edit 或 write 等工具，工具结果以 toolResult 回到消息上下文，模型可能继续下一轮。这意味着前端不能把“收到第一段文本”当成完成，也不能把工具卡片当成装饰，而要建模 agent_start、message_update、tool_execution 和 agent_settled 等阶段。我的实现目标是忠实投射这一运行过程，而不是假装前端自己在做推理。

**追问：这个项目里哪些能力是 SDK 提供的，哪些是你这个应用层需要解决的**

**口播：** SDK 负责模型调用、Agent 消息状态、工具循环、会话管理、压缩和原始事件；应用层不能重复实现这些底层逻辑。我这个项目要解决的是如何创建和恢复 session、怎样让浏览器可靠订阅事件、怎样把 SDK 的大事件转换成适合网络和 UI 的事件、怎样在断线和切会话时保持状态一致，以及怎样展示工具带来的副作用。这个边界很重要，因为如果我说自己“实现了 Agent runtime”，面试官追问模型路由、工具调度和上下文策略时会暴露概念混淆。更准确的表述是，我实现了基于 SDK 的 Web 运行管理与前端集成层。

### 2. 为什么浏览器不能直接调用 Pi SDK

**口播：** Pi SDK 的职责不只是调用模型，它还持有本地会话文件、模型认证信息、cwd 相关资源以及读写文件和执行命令等工具。如果把这些能力打进浏览器，凭证、文件系统和本机命令都无法保持正确的安全与运行边界。因此我把 SDK 固定在 Nuxt server routes 背后，浏览器只发送受控命令并接收序列化事件。这个设计的结果是前端不需要了解本地凭证和工具实现细节，服务端也能统一做图片校验、会话路径解析和资源回收。需要诚实说明的是，当前 API 没有鉴权且 Agent 仍能执行命令，所以这个边界只适用于 `127.0.0.1` 单用户本机工具，不能直接暴露到公网。

**追问：这是不是 BFF，为什么不直接让浏览器调第三方模型 API**

**口播：** 从职责上它接近 BFF，但比常见的接口聚合层更偏运行代理：它维护有状态的 AgentSession，而不是无状态转发一次请求。直接调模型 API 只能解决文本生成，无法自然复用 Pi 的 session、skills、extensions、工具权限和 JSONL 持久化，也会迫使浏览器处理密钥。服务端 wrapper 把浏览器命令转换为 SDK 方法调用，再把订阅到的事件映射为稳定的线上协议，这样前端可以围绕业务状态写 reducer。代价是服务端必须处理冷启动、空闲回收和连接断开，这也是本项目比普通前端聊天页面更有工程含量的部分。

**追问：如果要把它做成多用户产品，你认为还缺什么**

**口播：** 当前设计不能直接多租户化，因为会话目录、模型凭证、文件系统和工具执行都默认属于本机单一用户。要演进成多用户产品，首先要按用户或工作空间隔离 session、credential、cwd 和文件访问根目录；然后加入身份认证、授权、配额、审计和危险工具确认。运行层还需要把内存 Map 改成可恢复的任务和连接模型，解决多实例路由、断线重连、取消语义和任务持久化。对模型和 MCP server 也要设置允许列表与租户级凭证。这个量级已经从个人本机工具变成平台工程，我会把它作为边界说明，而不是假设把现有代码部署上去就可以。

### 3. 你怎样理解 Agent runtime，项目中它对应哪些对象

**口播：** Agent runtime 可以理解为让 Agent 在一次或多次任务中持续运行的执行环境，它管理当前模型、system prompt、消息历史、可用工具、技能和扩展、上下文用量、运行状态以及会话替换。Pi SDK 中 `AgentSession` 管理单个会话，完整的 `AgentSessionRuntime` 还负责新建、恢复、fork、切换等替换 session 的流程。当前项目用 `AgentSessionWrapper` 包装具体 session，在服务端维护注册表、事件订阅、命令分发和空闲回收，所以它是 runtime 的应用集成层。这样解释能清楚区分：模型负责生成，SDK 负责 Agent loop，wrapper 负责把运行能力稳定暴露给 Web 前端。

**追问：一个 runtime 里为什么会有 ResourceLoader、skills、extensions 和 AGENTS.md**

**口播：** 模型本身不知道当前项目的规则、可用流程和额外工具，runtime 需要在启动时装配这些上下文资源。Pi 的 DefaultResourceLoader 会按照 cwd 和 agentDir 发现项目或全局的 skills、prompt templates、extensions、context files 和配置。它们的作用不同：AGENTS.md 更像约束和上下文说明，skill 是可发现的任务说明，prompt template 是可展开的命令文本，extension 可以注册更深的工具或行为。项目里的 skills 面板复用了同一套 loader 来展示资源。这种设计让我认识到“提示词”不是一段字符串，而是运行时资源装配的一部分，同时也带来项目级代码和指令可信度的问题。

**追问：为什么创建或恢复 session 时要有启动锁和空闲回收**

**口播：** 同一 session 同时被多个 HTTP 或 SSE 请求触发冷启动时，如果不做合并，就可能创建两个 SDK session、重复订阅事件或让状态分叉。项目用以 session id 为键的 Promise 锁合并并发启动，确保同一时刻只有一个创建过程。另一方面，AgentSession 里可能有模型 runtime、工具和文件句柄，长期留在内存会浪费资源，所以项目设置空闲回收。这里有一个细节：只要仍有 SSE 监听者，就不能把 wrapper 当作空闲销毁，否则浏览器还在收到心跳却已经订阅到死 session，后续事件会丢失。测试覆盖了这个约束。

### 二、命令与流式协议

### 4. 为什么 `prompt()` 的 HTTP 请求不等到 Agent 全部完成才返回

**口播：** Pi SDK 的 `prompt()` 在完整 Agent run 结束时才 resolve，这个 run 可能包含多次模型调用、工具执行、重试和压缩。如果让浏览器的 POST 一直等待，会把“用户请求是否被接受”和“任务是否完成”混在一起，也会让网络层更脆弱。项目利用 SDK 的 `preflightResult(true)`：它代表 prompt 已完成同步校验并被接受或排队，于是服务端可以立即确认命令；真正的生成进度、工具状态和接受后的异常全部通过 SSE 发给前端。这样前端有清晰的 accepted、running、settled 分层。结果是 UI 可以及时乐观显示用户消息，同时仍能通过异步事件处理长任务。

**追问：如果 preflight 成功后模型调用失败，前端怎么知道**

**口播：** preflight 成功只说明命令被 SDK 接受，不代表模型、网络或工具一定成功。因此 wrapper 在 `prompt()` Promise 的异步失败分支里发出 `prompt_error` 和 `prompt_done` 事件，前端 chat store 统一转成用户可读 notice 并清理相应运行状态。对于 preflight 前的同步错误，例如图片格式非法，POST 直接返回错误，前端撤销乐观消息。这里的关键不是“所有错误都用 HTTP 返回”，而是根据错误发生在接受前还是接受后选择同步响应或流式事件。这种错误语义划分能防止用户看到请求成功但界面永远停在生成中。

**追问：你如何避免运行计数泄漏**

**口播：** wrapper 在发送 prompt 前增加 `pendingPromptCount`，它决定运行态的一部分。如果 SDK 同步抛错、预检拒绝或异步失败时没有对称地减少计数，会话会永远显示运行中，空闲回收和侧栏状态也会受影响。项目把减少计数收敛到 `finishPrompt`，同步错误分支显式调用，异步完成或失败分支也调用；测试验证同步抛错后 `isRunning()` 会恢复为 false。这个例子让我把 Agent UI 的 loading 看成状态机而不是一个随手赋值的布尔变量，任何进入路径都要有明确退出路径。

### 5. 为什么选择 HTTP POST + SSE，而不是 WebSocket

**口播：** 当前交互里浏览器上行的命令很少，主要是 prompt、停止、切模型和压缩；下行则是持续不断的文本、工具和生命周期事件。因此我把命令放在普通 HTTP POST，把订阅放在 EventSource SSE，职责简单且浏览器原生支持自动重连。SSE 也更符合“服务端单向推送状态”的需求。它不是绝对优于 WebSocket：如果未来需要高频双向协同、二进制实时控制或统一双向协议，WebSocket 可能更合适。当前项目没有 WebSocket 压测数据，所以我不会虚构性能结论；我能说明的是这种拆分使命令确认、缓存语义和前端重连实现更直观。

**追问：SSE 有哪些局限，你是如何补偿的**

**口播：** SSE 是服务端到客户端的单向通道，上行仍要走 HTTP；它也需要关注代理缓冲、连接中断、身份认证携带方式和重复事件问题。项目在响应上关闭变换缓存，发送 30 秒注释心跳，使用 EventSource 断线重连，并且不把底层连接 open 当业务就绪。对于刷新或重连时已经在生成的消息，服务端发送 streaming snapshot，前端 reducer 恢复草稿。更复杂的多标签页、全局顺序号、跨实例重放和持久事件日志当前没有完整解决，这些是后续平台化时应补的能力，我会明确标为演进项。

**追问：为什么不能只依赖 EventSource 自动重连**

**口播：** EventSource 的自动重连只保证它会尝试重新建立网络连接，不保证新的连接已经接到正确的 session、也不保证前端知道何时可安全发送 prompt。项目封装 `AgentEventConnection`，它会等待服务端的 `connected` 业务事件、设置就绪超时、在 startup_error 时停止无意义重试，并在会话切换时通过 `shouldMaintain` 阻止旧连接复活。这样网络层重连和业务状态恢复被明确分开。否则最典型的问题是连接看似成功，但 SDK 冷启动或监听安装尚未完成，用户发出的短回复及其首批事件都可能消失。

### 6. 业务级 `connected` 握手解决了什么问题

**口播：** `connected` 不是 SSE 标准事件，而是本项目在 SDK session 已准备好、监听器已挂载后发送的业务握手。场景是新会话或冷恢复时，HTTP 响应可以先打开，但服务端仍在读取会话文件、装配 ResourceLoader 和创建 SDK session。如果前端看到 EventSource open 就发 prompt，监听间隙里的事件可能丢失。项目在握手前先缓冲 SDK event，发送 `connected` 后才转发，前端 `sendPrompt` 先 `await ensureConnected()` 再 POST。结果是“通道可访问”和“Agent 可接收命令”被清楚区分，短回复不会因冷启动竞态而偶发无输出。

**追问：握手前缓冲事件如何避免重复发送**

**口播：** 服务端装好监听后先收集 buffered events，再读取当前 `streamingMessage` 快照。它按顺序发送 `connected`、握手期间缓冲的事件和必要的快照；对于 snapshot 已经包含的 `message_start` 或 `message_update`，通过 `isEventIncludedInSnapshot` 跳过，避免同一流式内容被恢复两次。这个去重逻辑不是全局消息幂等方案，只针对连接建立瞬间“缓冲事件与当前快照”这对重复来源。面试中我会把范围说清楚：它解决刷新和重连时流式气泡的恢复，不等同于拥有 Kafka 那样的可重放事件总线。

**追问：如果 startup 失败，为什么不无限重连**

**口播：** 网络瞬断适合重试，但 session 文件不存在、模型配置错误、资源加载失败等 startup_error 往往是确定性问题，盲目重连只会制造请求噪声并掩盖根因。所以服务端把启动异常序列化成 `startup_error` 事件并关闭流，客户端连接管理器收到后停止重试并交给 UI 展示错误。相比之下，普通 close 或 ready timeout 会按固定延迟尝试恢复。这个区分体现的是错误分类：可恢复的传输问题可以重试，配置或逻辑问题需要用户或开发者处理。生产化时还可以加入有限退避、错误码和诊断链接。

### 7. 刷新页面或 SSE 断线时，流式消息如何恢复

**口播：** 只重连并等待未来 delta 不足以恢复，因为刷新发生时之前已经收到的流式文本只存在旧浏览器内存里。项目在每个 SSE 连接建立后检查 wrapper 的 `isStreaming` 和 `streamingMessage`，如果当前 run 正在生成，就补一条 `message_start` 快照。前端把它交给同一个 `streamReducer` 的 snapshot action，恢复当前 assistant 草稿，然后继续消费后续 delta。这样已经生成的一段不会空白，后续内容也能接着追加。这里我会强调，完整历史仍以 JSONL/session manager 为权威，快照只解决“正在生成但尚未 message_end”的临时状态。

**追问：前端如何防止切会话后的旧响应污染新页面**

**口播：** `openSession` 开始时先关闭旧 connection 并清空与会话相关的 messages、统计、工具状态和流式草稿，再设置新 session id。异步 reload 返回前会二次比较当前 session id 是否仍等于请求开始时的 id，不相等就丢弃响应；测试构造了旧会话慢、新会话快的场景，确保最终只保留后选会话的数据。连接层也用 `shouldMaintain` 防止旧 EventSource 在断线后重新拉起。这些守卫不是为了“优化体验”，而是避免典型竞态：页面标题是 B，消息列表却被迟到的 A 覆盖。

**追问：停止任务时为什么还需要 fallback reload**

**口播：** `abort` 的 HTTP 成功只代表停止请求已经送达，真正的 agent_end 或 agent_settled 可能稍后才到，甚至在异常网络情况下丢失。如果 UI 只等待事件，用户可能永远看到运行中。项目在 stop 后设置 3 秒兜底：如果仍处于运行态，就清除活跃工具状态、结束前端运行标识并重新读取会话权威数据；如果 `agent_settled` 先到则取消定时器。它不是替代事件协议，而是针对分布式异步边界做的最终对账。后续更成熟的做法是携带 run id 或服务端查询接口来精确核验任务终态。

### 三、前端状态与工具循环

### 8. 为什么流式消息使用 reducer，而不是直接不断拼字符串

**口播：** Agent 的增量不只有文本，还可能交错出现 thinking、工具调用参数和最终工具调用对象。如果只维护一个字符串，无法表示“先思考，再调用工具，再继续输出文本”的真实内容顺序，也无法正确渲染工具执行卡片。项目把流式状态定义为 `isStreaming` 和 `streamingMessage`，每个增量按 `contentIndex` 定位到 assistant message 的 content block，并用 start、delta、end 三类 action 更新。`message_end` 到来后完整消息进入历史数组，草稿清空。把 reducer 放在 shared 层的好处是无 Vue 依赖、输入输出确定，能独立测试，也能避免 UI 组件自己承担协议解释。

**追问：为什么要分离已定稿消息和流式消息**

**口播：** 已定稿消息对应可恢复的会话历史，流式消息则是尚未最终落盘的临时投影。把两者混在同一数组中，每次 delta 更新会污染历史，停止或重连时也容易出现重复气泡。项目的 `messages` 只保存 `message_end` 后的内容，`streamingMessage` 单独由 reducer 维护；渲染时同时展示两者。定稿时先把完成消息 append 到历史，再清空流式草稿，保证用户不会看到一帧空白或重复。这个模式本质上是区分 source of truth 和临时派生状态，在金融、协作文档和长任务 UI 中也很常见。

**追问：工具参数为什么还会有 delta，怎么展示**

**口播：** 模型流式生成 toolCall 时，参数 JSON 也可能逐段到达。在开始和中间阶段，参数还不是完整可解析对象，项目用 `rawInput` 累加原始增量，卡片显示“参数流入中”；收到 toolcall_end 后才用 SDK 给出的完整 `id`、`name` 和 `arguments` 替换成结构化 input。这样既能让用户看到 Agent 正在准备什么操作，又不因为半截 JSON 解析失败导致 UI 报错。前端不应把流式半成品当成可信的最终参数，真正执行和结果关联仍以 SDK 的最终 toolCall 与 toolResult 为准。

### 9. 工具调用从模型输出到 UI 呈现经历了什么

**口播：** 模型先在 assistant 消息里生成 toolCall，SDK 随后执行对应工具，并发送 tool_execution_start、update、end 等独立事件。服务端事件桥接会去掉对浏览器无用或过大的字段，并把工具调用 id 与名称提取到更小的线上事件中。前端 reducer 负责把消息内的 toolCall 还原出来，chat store 用 `activeTools` 维护当前正在执行的调用，最终遍历已定稿 messages 构建 `toolResultsByCallId`。`ToolCallCard` 通过 toolCallId 将调用与结果配对，因此能分别显示参数、执行中、部分进度、完成、错误和输出。这条链路让我能解释 Agent 不是“模型直接修改文件”，而是模型请求、运行时执行、结果反馈和下一轮推理组成的闭环。

**追问：为什么 tool result 不能只显示给用户，不回传给模型**

**口播：** 如果工具结果只显示在 UI 而没有进入 Agent 的消息上下文，模型并不知道工具是否成功、读到了什么内容或命令是否报错，后续只能凭空继续生成。正确的 tool loop 是模型产生结构化调用，运行时执行并将结果作为 toolResult message 放回上下文，再让模型基于事实决定下一步。前端展示只是对这一事实链路的投影。也因此，工具结果通常需要治理长度、敏感信息和错误格式：过长输出会挤占 context，未清洗的文件或网页内容可能携带 prompt injection。当前项目展示工具结果，但更系统的内容治理仍是后续可以加强的方向。

**追问：工具权限为什么是 Agent 项目的核心安全问题**

**口播：** 给模型工具后，风险不再只是回答不准确，而是模型可能在错误指令或被注入的上下文影响下触发读写、shell 或网络副作用。当前 Pi 内置工具可以访问当前工作目录并执行命令，项目 README 明确把应用限制为本机，因为没有认证和细粒度授权。我会把这一点作为设计边界而不是漏洞掩饰。若继续演进，我会为工具定义只读、可写和高风险等级，为写文件、执行命令、删除和外发增加显式确认，设置 cwd/path allowlist、超时、输出脱敏和审计事件，并避免把密钥直接传给浏览器。

### 10. `agent_end`、`agent_settled` 和 `prompt_done` 为什么要区分

**口播：** 这三个事件代表不同层级。`prompt_done` 是 wrapper 在 SDK prompt Promise 完成后额外发出的命令生命周期信号；`agent_end` 表示一轮 Agent 处理结束，但在重试、压缩或队列场景下还可能继续；`agent_settled` 才适合作为 Agent 完全空闲、UI 可以稳定落定的信号。前端在 agent_end 时 reload 以同步落盘数据，但不会马上关闭运行态；在 agent_settled 时清理活跃工具、重试信息和流式状态，再刷新 context usage。区分这些概念可以避免“看到一次 end 就把发送按钮打开”的错误，因为此时 Agent 可能仍在下一轮工具或队列处理。

**追问：项目是否支持运行中继续发送新指令**

**口播：** Pi SDK 支持 steering 和 followUp 两种队列语义：前者在当前 assistant turn 和工具调用后插入新指令，后者等待 Agent 完全结束后再执行。当前前端会接收并展示 `queue_update`，但 `sendPrompt` 在 `isRunning` 时直接拒绝普通发送，因此还没有把 steer/followUp 作为完整可交互功能暴露。这是我会如实说明的边界。后续实现时不能只解除禁用，而要让用户明确选择“打断当前方向”还是“排队后续任务”，并处理队列可视化、取消和服务端 accepted 状态。

**追问：你怎么处理 SDK 事件版本或冗余字段变化**

**口播：** 项目没有把 SDK 原始事件直接透传给组件，而是先在 shared 的 event wire 层定义浏览器需要的最小结构。它丢弃 turn_start、turn_end，裁剪 message_update 中可能很大的 partial 快照，并将 toolcall 元数据提升到顶层。这样既减少网络和前端重复计算，也为 SDK 字段兼容留出集中处理点。会话文件与运行时 toolCall 字段格式不同的地方也统一经过 normalize。这个做法不能完全替代 schema versioning，但能把依赖 SDK 细节的代码集中，后续升级版本时先改适配层和测试，而不是让组件到处判断字段。

### 四、持久化、上下文与资源

### 11. 为什么 Pi 会话用 JSONL 和 parentId，而不是一个普通 JSON 数组

**口播：** Agent 会话不仅有用户和助手文本，还会记录工具结果、模型切换、思考等级变化、压缩和 session 信息。JSONL 适合持续追加 entry，避免每次任务重写全部历史；每个 entry 的 `id` 和 `parentId` 又能表达树状上下文，而不是只有一条线性聊天记录。项目读取会话时先定位 leaf，再沿 parentId 向根迭代回溯出活跃分支，同时根据沿途的非消息 entry 推导当前模型和 thinking level。前端 messages 与 entryIds 保持平行，后者才是未来 navigate_tree 或 fork 操作真正需要的身份标识。这样能与 Pi CLI/pi-web 共用同一数据生态。

**追问：为什么不能用消息下标做分支跳转**

**口播：** 消息数组只是当前活跃路径上可渲染 message entry 的投影，它会过滤掉 model_change、thinking_level_change 等非消息 entry，也可能因为压缩或历史截断不包含完整文件内容。分支树真正的节点身份是 JSONL entryId，`parentId` 也是指向 entry 而不是数组位置。如果用第几个消息作为 navigate target，一旦中间插入非消息 entry 或切换活跃分支，下标就会指错节点。项目在 `SessionContext` 里刻意让 messages 和 entryIds 平行，是为了保留 UI 友好数据与持久化真相之间的映射。面试里我会强调这是领域标识与显示索引的区别。

**追问：当前分支能力的完成度如何，为什么不能夸大**

**口播：** 当前代码已经有 session-reader 的活跃分支切片逻辑，wrapper 也可把 `navigate_tree` 命令交给 SDK，所以数据模型和服务端基础是存在的。但是 `fork` 命令明确抛出“not implemented”，前端没有 BranchNavigator 或 edit-from-here 交互，产品文档也把里程碑 B 标为进行中。因此我只能说项目具备读取树状会话和调用基础 API 的能力，不能说完整支持会话分支。这个区分对面试很重要：提前承认未完成项，并说清下一步的 UI、失败回滚和 wrapper 重建设计，会比功能描述和代码不一致更可信。

### 12. 你如何理解 context window 和 compaction

**口播：** Context window 是模型在一次推理中可见 token 的上限，里面不仅有用户文本，还包括 system prompt、技能说明、历史消息、工具调用与工具结果。长任务中如果无限追加历史，会触发上下文溢出、成本上涨和注意力稀释。Pi session 提供 context usage 和 compaction，前端展示占用并将压缩状态单独建模。压缩的目标不是简单删掉历史，而是在保留后续任务关键信息的前提下将旧上下文转换为更紧凑的摘要或状态。项目把 `compact`、`abort_compaction` 和 `abort` 分为不同命令，因为取消当前 Agent run 与取消上下文压缩不是同一件事。

**追问：RAG 能否完全取代 compaction**

**口播：** 不能。compaction 解决的是当前会话历史如何在有限上下文内持续运行，RAG 解决的是从外部大规模知识集合中按查询找回相关证据，两者都在管理上下文但输入来源和目标不同。会话压缩通常要保留任务进展、约束、已执行操作和未完成事项；RAG 则要做文档切分、索引、检索和引用。如果用 RAG 取代会话记忆，Agent 可能丢失刚执行过的工具状态；如果把所有外部知识都塞进会话历史，也会浪费窗口。更合理的方案是压缩保持会话连续性，检索通过受控工具按需补充外部事实。

**追问：如何避免工具输出把上下文撑爆或污染模型**

**口播：** 首先不能把所有 shell 输出、文件全文和网页内容无差别回填。工具层应设置输出大小上限、截断提示、结构化摘要和必要的分页/继续读取策略；对于错误输出也要保留可行动信息而非无穷堆栈。其次，工具结果本质上是不可信外部文本，可能含有诱导模型忽略系统规则的内容，所以 system instruction 要明确把它作为数据而不是命令，工具 schema 和执行器也要严格校验。前端可以显示原始证据与截断状态，但不要让视觉展示替代服务端治理。当前项目已经做事件裁剪，长工具结果和注入防护仍值得继续补强。

### 13. Skills、Extensions、MCP 三者分别是什么，当前项目做到哪里

**口播：** 我会严格区分三者。Skill 通常是一份带描述的任务说明或流程资源，帮助模型和用户发现可复用的工作方式；项目通过 Pi 的 DefaultResourceLoader 发现全局和项目 skills，并允许设置是否允许模型调用。Extension 是更深的运行时扩展，它可以注册工具、命令或事件行为，通常需要更强的信任边界。MCP 则是 Host 与外部 Server 之间的标准协议，用于发现和调用 tools、resources 或 prompts。当前项目已接入 skills 和静态扩展扫描，但 MCP 面板明确是空态，没有实现 MCP bridge、server 注册或调用，所以不能把本项目写成 MCP 项目。

**追问：为什么项目技能变更不会中途替换已运行 Agent**

**口播：** Agent 在启动时会基于 ResourceLoader 装配系统上下文、skills、prompts、extensions 和工具。如果在 run 中途直接替换这些资源，模型看到的工具集合或行为规则可能前后不一致，正在执行的任务很难解释和复现。因此项目 UI 提示技能 frontmatter 变更后要在下次创建或重新加载资源时生效，而不是承诺实时热更新。这个设计反映了 runtime 配置的版本边界：资源变更要么建立新 session，要么有明确的 reload/rebind 流程。对于 extension，项目级资源还应由 trust decision 控制，不能为了“方便”在列出目录时执行未知代码。

**追问：如果你要实现 MCP Bridge，最小可行版本怎么设计**

**口播：** 我会先选一个低副作用、只读的 MCP server，并将范围限制在一个受信任配置。服务端负责启动 stdio 或连接 Streamable HTTP transport，完成 initialize/capabilities 协商，缓存 server 的工具清单，再通过 Pi extension 或 custom tool 适配成 Agent 可调用工具。前端能力中心只展示连接状态、工具数量、权限范围、最近错误和显式测试按钮，不直接暴露任意命令输入。调用链需要超时、取消、schema 校验和凭证脱敏，工具刷新还要考虑正在运行 session 的资源重载。这样先验证协议、权限和 UX，再扩展多 server 管理，避免做一个看似完整但没有安全边界的面板。

### 五、RAG、安全与后续演进

### 14. 你会怎样给这个项目增加 RAG，为什么当前不直接声称有 RAG

**口播：** 当前仓库没有文档入库、embedding、向量索引、召回、重排或引用展示，因此我不会说已经实现 RAG。若要增加，我会先选择可控的小型 Markdown 文档集，建立 ingestion 流程：清洗和分块时保留文件路径、标题、版本和权限 metadata，生成 embedding 并建立索引；查询时结合关键词和向量做 hybrid retrieval，按需要 rerank，最后让 `search_knowledge` 工具返回带来源的少量片段。Agent 根据任务自主调用该工具，前端把引用显示为可打开的证据。先用固定 query 集评估召回、引用正确性、延迟和成本，再考虑扩大数据规模或引入外部向量数据库。

**追问：为什么将 RAG 设计为工具，而不是每次 prompt 都把检索内容塞进去**

**口播：** 把检索放进每个 prompt 的前置步骤实现简单，但会对所有任务支付检索和上下文成本，也无法让 Agent 根据当前阶段决定是否需要外部知识。作为工具时，模型能先判断需要什么信息、构造更具体的查询、根据结果继续检索或转向其他工具，链路更符合 Agent 的按需行动方式。当然工具化并不天然更好，它依赖模型的工具选择能力，所以要设计清楚 schema、返回格式、最大片段数和失败回退。对于极稳定且每轮都必须有的上下文，预注入可以更合适。我会根据知识的必要性、时效性和 token 成本选择，而不是把 RAG 当成万能标签。

**追问：RAG 质量如何评估，不能只看模型回答是否通顺**

**口播：** 我会把评估拆成检索层和生成层。检索层用带标准证据的 query 集，查看 Recall@K、MRR 或 NDCG、过滤条件命中和结果多样性；生成层看答案是否有可追溯引用、引用是否真的支持结论、是否忠实于证据、是否遗漏关键约束，还要记录延迟和 token 成本。对于 Agent 场景，还要观察工具调用是否合理、检索失败后是否能承认不知道、是否重复查询。没有这套任务集时，“接了向量库，感觉更聪明”不是工程成果。前端可以支持评测回放和引用比对，这正好能体现我兼顾前端与 Agent 可观测性的能力。

### 15. 你认为这个项目当前最大的风险和最值得补的能力是什么

**口播：** 最大风险是安全边界与产品边界不能被夸大。当前无鉴权、Agent 可执行本地命令，因此只能本机使用；MCP、RAG 和完整会话分支都还没有落地；测试覆盖的是关键时序逻辑，不等于有线上稳定性或用户价值指标。最值得补的不是再加一个聊天界面，而是选择一条完整、可验证的 Agent 能力链路，例如受控 MCP Bridge 或有引用的文档检索工具，并补齐权限、超时、取消、错误状态、trace 和固定任务评测。这样可以把“我会调用 SDK”升级为“我知道如何让 Agent 能力可控、可观察、可验证地进入前端产品”。

**追问：你会如何给 Agent 应用做可观测性**

**口播：** 我会为每一次用户任务建立 run id 或 trace id，并关联 session id、模型、thinking level、prompt 接受时间、首 token、每轮工具调用、工具耗时、重试、压缩、最终状态、token 和成本。服务端把这些作为结构化事件或日志记录，前端提供时间线而不是只显示最终回答。这样遇到“回复慢”时可以区分模型首 token 慢、工具执行慢、SSE 断线还是前端 reducer 卡顿；评测时也能统计工具成功率和失败类别。当前项目已有事件流和 UI 状态基础，但还没有完整 trace 体系，我会把它列为明确的技术债和下一步，而不伪造观测数据。

**追问：如何证明你不是只会背 Agent 概念，而是真的理解前端工程难点**

**口播：** 我会从一个具体时序题切入：为什么 EventSource open 后仍要等 `connected`，为什么 prompt 接受和任务结束要分离，刷新时为什么需要 streaming snapshot，切会话时为什么要丢弃旧请求，以及为什么工具调用和工具结果需要用 id 配对。然后我会指向对应的 wrapper、event stream、reducer 和测试，说明每个设计解决的失败模式。Agent 相关知识在这里不是术语堆砌，而是改变了前端状态模型、错误处理、加载反馈、安全提示和验证方式。只要能从用户动作讲到 SDK 事件再讲回 UI 终态，就能体现我是用工程方式理解 Agent。

## 源码证据索引

| 主题 | 关键路径与内部符号 | 对应正文位置 |
| --- | --- | --- |
| SDK 与应用边界 | `node_modules/@earendil-works/pi-coding-agent/docs/sdk.md` 的 AgentSession、AgentSessionRuntime、Prompting、Tools、ResourceLoader 章节 | Q1-Q4、Q9、Q13 |
| Session wrapper | `server/utils/rpc-manager.ts` 的 `AgentSessionWrapper`、`sendPrompt`、`startRpcSession`、启动锁、空闲回收 | Q2-Q4、Q10 |
| SSE 生命周期 | `server/utils/event-stream.ts` 的 `createAgentEventStream`、bufferedEvents、snapshot、heartbeat | Q5-Q7 |
| 浏览器连接 | `shared/lib/agent-event-connection.ts` 的 `ensureConnected`、`maintain`、`scheduleRetry` | Q5-Q7 |
| 前端状态机 | `app/stores/chat.ts` 的 `applyEvent`、`sendPrompt`、`stop`、`openSession` | Q4、Q7、Q8、Q10 |
| 线上事件适配 | `shared/lib/agent-event-wire.ts` 的 `toClientAgentEvent`、`isEventIncludedInSnapshot` | Q6、Q9、Q10 |
| 流式 reducer | `shared/lib/streaming-message.ts` 的 `streamReducer`、`applyDelta` | Q8-Q9 |
| 会话树和恢复 | `server/utils/session-reader.ts` 的 `resolveSessionPath`、`sliceActiveBranch`、`buildSessionContext` | Q11-Q12 |
| Skills 与扩展 | `server/api/skills.get.ts`、`server/utils/extensions.ts`、`app/components/capabilities/SkillsPanel.vue` | Q3、Q13 |
| MCP 未实现 | `app/components/capabilities/McpPanel.vue` 的 MCP Bridge 空态 | Q13 |
| 时序测试 | `tests/server/utils/event-stream.test.ts`、`tests/server/utils/rpc-manager.test.ts`、`tests/app/stores/chat.test.ts` | Q3-Q8、Q15 |

## 高风险 Claim 清单

| Claim 类型 | 当前可说 | 不应说 |
| --- | --- | --- |
| Ownership Claim | “我负责的部分是前端流式状态与 SDK 事件接入”仅在真实参与且能讲源码时使用 | “我从零主导整个 Pi Agent runtime”除非能证明全部实现与设计责任 |
| Architecture Claim | “基于 Pi SDK 构建 Web session 生命周期与 SSE 事件桥接” | “我实现了模型推理、规划和工具调度内核” |
| MCP Claim | “能力中心预留 MCP 入口，正在设计受控 bridge” | “已接入和管理 MCP 服务” |
| RAG Claim | “正在补 RAG，计划通过检索工具接入” | “项目使用向量数据库/RAG” |
| Branch Claim | “有 JSONL 树读取与 navigate 基础，完整交互未完成” | “完整支持会话分支/fork” |
| Metric Claim | “当前有关键时序单测和 40 个测试文件” | “显著提升稳定性、性能、效率”而没有基线和数据 |
| Result Claim | “实现本机可演示核心会话、流式和工具可视化链路” | “已生产上线、被大量用户使用、支撑业务收益” |

## 交给 /great-resume 的项目事实摘要

- 项目名称与目标岗位：pi-agent Web 工作台，前端开发岗位，兼顾 Agent 工程。
- 个人职责边界：待你确认。仓库可证明的工作内容包括 Vue/Pinia 前端状态、Nuxt server session wrapper、SSE 流、工具可视化、会话读取和测试；不能由代码判断具体由谁完成。
- 关键技术动作：Pi SDK `AgentSession` 服务端托管；HTTP command + SSE event 分离；preflight 接受确认；业务 `connected` 握手；快照重放；事件裁剪；流式 reducer；JSONL 活跃分支读取；ResourceLoader skills；本机安全边界。
- 可核验证据：`server/utils/rpc-manager.ts`、`server/utils/event-stream.ts`、`app/stores/chat.ts`、`shared/lib/streaming-message.ts`、`server/utils/session-reader.ts` 和 40 个测试文件。
- 可写入简历的候选表述：使用本文件“简历 Bullet”中的通用支柱，按实际个人动词和职责缩写。
- 待补指标：首 token 时间、完整 run 时间、重连恢复耗时、工具调用成功率、固定任务回归通过率、用户流程节省时间；无数据时不要编造。

## 交给 /interview 的高风险 Claim 清单

- Ownership Claim：独立完成、主导、owner、从 0 到 1、完整设计等强表述均需你的真实责任范围、提交记录或可讲决策支撑。
- Metric Claim：没有基线与记录时，不说性能提升比例、稳定性比例、用户数、成本降低或项目排名。
- Architecture Claim：可说 SDK 集成层、session wrapper、SSE 协议和前端 reducer；不可说自己实现了 Pi 的核心 Agent loop、MCP bridge、RAG 或完整 fork。
- Result Claim：可说本机可演示、关键时序自动化测试已覆盖；不可说生产部署、多人使用或商业业务效果。

