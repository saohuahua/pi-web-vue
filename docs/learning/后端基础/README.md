# 后端基础：Nuxt 服务端与工程约定

面向熟悉前端、写过一些后端接口、但还没用过 Nuxt 的读者。正文从「为什么一个 `npm run dev` 同时跑起了网页和接口」开始，讲清 Nuxt 工程约定、Nitro 文件路由、`defineEventHandler` 请求处理，以及本项目的后端分层，最后从零跑通项目。读完后进入 [00 从最小 Agent 到 Web 工作台](../00-从最小Agent到Web工作台.md) 和 [02 工程结构与前端组织](../02-工程结构与前端组织.md)。

| 顺序 | 章节 | 要解决的问题 |
| --- | --- | --- |
| 1 | [C01 Nuxt 工程与 Nitro 服务端](C01-Nuxt工程与Nitro服务端.md) | Nuxt 是什么、`app/` `server/` `shared/` 三个目录什么关系、文件即路由怎么工作、`ssr: false` 为什么这样选 |
| 2 | [C02 请求处理与后端分层](C02-请求处理与后端分层.md) | `defineEventHandler` 里能做什么、`readBody`/`getQuery`/`getRouterParam` 怎么用、本项目「薄转发层」和业务层怎么分 |
| 3 | [C03 环境准备与首次跑通](C03-环境准备与首次跑通.md) | `~/.pi/agent` 和 `models.json` 是什么、怎么验证 SDK 能加载、从 `npm run dev` 到第一次发送 |

## 术语速查

正文中反复出现的关键词，按「概念 → 一句话含义 → 深入位置」排列，读到不熟的词可以回来查。

| 术语 | 一句话含义 | 深入位置 |
| --- | --- | --- |
| Nuxt | 基于 Vue 的全栈框架，一个工程同时组织浏览器代码和 Node 服务 | [C01](C01-Nuxt工程与Nitro服务端.md) |
| Nitro | Nuxt 的服务端引擎，负责把 `server/` 里的文件变成可访问的 HTTP 接口 | [C01](C01-Nuxt工程与Nitro服务端.md) |
| h3 | Nitro 底层的 HTTP 框架，提供 `defineEventHandler` 等请求处理函数 | [C02](C02-请求处理与后端分层.md) |
| 文件即路由 | 用文件名和目录决定 URL，无需手动注册路由 | [C01](C01-Nuxt工程与Nitro服务端.md) |
| `defineEventHandler` | 定义单个请求处理函数的入口，每个路由文件默认导出一个 | [C02](C02-请求处理与后端分层.md) |
| SSR / CSR | 服务端渲染 / 客户端渲染，本项目 `ssr: false` 选后者 | [C01](C01-Nuxt工程与Nitro服务端.md) |
| `#shared` 别名 | 指向 `shared/` 的导入别名，前后端都能引用同一份代码 | [C01](C01-Nuxt工程与Nitro服务端.md) |
| cwd | 会话的执行目录，Agent 在此目录下解释相对路径 | [业务篇 B01](../业务流程与前后端协作/B01-业务对象与职责分工.md) |
| wrapper（`AgentSessionWrapper`） | 服务端对 SDK 会话对象的包装，统一处理命令与事件 | [04 Agent 服务](../04-Agent服务与生命周期.md) |
| registry / locks | 服务端的两张 Map，分别复用已完成实例与正在创建的实例 | [04 Agent 服务](../04-Agent服务与生命周期.md) |
| SSE | 一条保持打开的 HTTP 响应，服务端持续写入事件 | [05 HTTP 与 SSE](../05-HTTP与SSE协议.md) |
| JSONL | 会话持久化格式，每行一个独立 JSON 对象 | [08 会话存储](../08-会话存储与上下文.md) |
| 代次（generation） | 每次关闭会话递增的编号，旧异步回调回来时据此丢弃 | [07 异步恢复](../07-异步协作与恢复.md) |
| 乐观更新 | 先显示用户输入，再等服务端确认，失败时回滚 | [07 异步恢复](../07-异步协作与恢复.md) |
| 快照 | 建连时补发的当前消息完整状态，用于恢复流式气泡 | [05 HTTP 与 SSE](../05-HTTP与SSE协议.md) |

## SDK 事件 → 前端状态速查

这是 [chat store](../../../app/stores/chat.ts) `applyEvent` 分发逻辑的对照表。事件来自 SDK，前端据此更新运行态、消息和工具状态。

| 事件类型 | 表达什么 | 前端主要处理 |
| --- | --- | --- |
| `connected` | SSE 已装好监听，可安全发送 | 解除发送等待；带 `isStreaming` 时恢复运行态 |
| `agent_start` | 新一轮执行开始 | 置运行态，开始组装流式消息 |
| `message_start` | 一条消息开始，可能带快照 | 用快照恢复流式草稿 |
| `message_update` | 消息内容增量（text/thinking/toolcall 的 start/delta/end） | reducer 按 `contentIndex` 更新内容块 |
| `message_end` | 一条消息定稿 | 完整消息进列表，清理流式草稿 |
| `agent_end` | 一轮执行的 SDK 侧结束 | 触发历史重读 |
| `agent_settled` | 应用侧确认的落定信号 | 清理运行态、工具、重试，刷新历史与统计 |
| `prompt_done` | wrapper 的 prompt 调用完成 | 未启动 Agent 循环时落定 UI |
| `prompt_error` | 接受后执行出错 | 报错并结束运行态 |
| `startup_error` | 会话启动失败 | 报错，停止自动重连 |
| `tool_execution_start/update/end` | 工具执行开始/进度/结束 | 维护 `activeTools` 运行状态条 |
| `compaction_start/end` | 上下文压缩开始/结束 | 切换压缩状态，结束后重读 |
| `auto_retry_start/end` | SDK 自动重试开始/结束 | 展示重试提示 |
| `queue_update` | 运行中队列变化 | 更新追加指令队列 |

> 事件是「变化」，历史和运行态查询是「快照」。事件告诉你刚刚发生了什么，查询告诉你现在能读到什么，两者结合才能恢复完整页面。

## 阅读顺序建议

1. 先读 C01、C02，建立「Nuxt 工程 + Nitro 服务端」的骨架。
2. 读 C03 把项目跑起来，边跑边看接口，验证前两篇。
3. 再回到 [00 从最小 Agent 到 Web 工作台](../00-从最小Agent到Web工作台.md) 走主线。

返回 [项目文档目录](../../README.md)。
