# pi-agent-vue 执行计划（总览）

> 本文件夹是为「用 Vue 3 从零实现 pi-agent 的 Web UI」项目编写的完整执行计划。
> 参考项目（架构蓝本）：`D:\project\pi-web`（下文简称 **pi-web**）。
> 本文件夹只是规划文档，不属于 pi-web 上游代码。

## 这个项目是什么

用 **Vue 3 + TypeScript** 从零实现 [pi coding agent](https://github.com/earendil-works/pi) 的浏览器客户端：创建/恢复 agent 会话、发送消息、SSE 流式渲染回复、工具调用可视化、会话分支。后端直接调用 pi 官方 SDK（`@earendil-works/pi-coding-agent`），与 pi CLI / pi-web 共享同一套 `~/.pi/agent` 配置和会话文件。

**定位**：秋招核心项目。覆盖两条主线——

1. **Agent 工程**：AgentSession 生命周期、`.jsonl` 会话持久化与树状分支模型、SSE 事件流、流式增量渲染、断线状态对账
2. **前端工程**：Vue 3 Composition API、Pinia 状态管理、vue-router、SSE 长连接管理、Markdown/代码高亮渲染、复杂列表性能

**明确不做**（避免陷进去）：不翻译 pi-web 的全部 6 万行代码，只实现核心闭环 + agent 能力展示，规模约 pi-web 的 1/6。

## 文档使用说明（给执行本计划的 AI agent / 开发者）

1. **先读本 README 全文**，再看 `01-architecture.md`，然后**只读当前正在执行的步骤文档**，按顺序推进，不要跳步。
2. 每个步骤文档都标注了 **pi-web 参考文件**。写代码前必须先读参考文件——本计划的很多模块是从 pi-web 精简移植的纯函数，参考实现就是权威。
3. 每完成一个步骤，**更新本文末尾的进度清单**（勾选 checkbox），再开始下一步。
4. 每个步骤末尾有**验收（快速冒烟）**——目标是确认核心链路没有致命 bug，每步 5 分钟内可完成，**不是**全面回归测试，不要在验收上过度投入时间；冒烟不过关则不进下一步。
5. 移植 pi-web 代码时按下方「编码规范」改写注释（保留语义、去掉标点），文件头加来源注释并维护 `THIRD_PARTY_NOTICES.md`（详见 03 第 1 节），项目 README 中注明参考了 pi-web（MIT License）。
6. 写代码全程遵循下方「编码规范」一节。

执行顺序：

| 文档 | 内容 | 里程碑 |
|---|---|---|
| [01-architecture.md](./01-architecture.md) | 技术选型、架构、pi 核心概念、源码阅读地图 | 前置知识 |
| [02-scaffold.md](./02-scaffold.md) | Step 0：项目脚手架（含 pi SDK 冒烟验证） | A |
| [03-backend-core.md](./03-backend-core.md) | Step 1：后端核心（AgentSession 管理 + API + SSE） | A |
| [04-frontend-core.md](./04-frontend-core.md) | Step 2：前端核心（聊天 + 流式渲染） | A |
| [05-agent-display.md](./05-agent-display.md) | Step 3：工具调用 / 思考过程 / 停止 —— 完成即达成**里程碑 A** | A |
| [09-step-a-completion.md](./09-step-a-completion.md) | Step A+：项目与已有 worktree、文件树、会话管理、模型、图片、压缩、使用量、技能与设置 | A 后 B 前 |
| [06-history-branching.md](./06-history-branching.md) | Step 4：会话内分支（编辑重发 / 分支切换） | B（差异化增强） |
| [07-optional.md](./07-optional.md) | Step 5（可选）：fork、删除、单测、终端等加分项 | 加分项 |

## 当前执行基线

原 Step 0–3 已完成最小聊天演示闭环，但当前 Vue 实现尚未达到完整工作区形态。后续先执行 [09-step-a-completion.md](./09-step-a-completion.md) 的 Step A+ 基础工作区完善，再进入 Step B 的会话内分支；终端、fork、删除等仍属于原 07 的后续增强项。

特别注意：截图中左上角的 Git worktree 分支与 Step B 聊天中的会话内分支是两套独立模型，实施时不能合并处理。新开对话执行前应先阅读 09 的“新开对话先读这里”章节。

## 编码规范（执行任何步骤都适用）

1. **核心注释必须写，写「为什么」而不是「是什么」**：时序约束、陷阱、权衡取舍这类代码本身表达不了的信息必须加注释；pi-web 参考实现里的关键注释移植时保留语义。
2. **注释不带任何标点符号**：中文短句，用空格断句，关键术语保留英文。示例：
   ```ts
   // 先等 SSE 握手完成再发 prompt 短回复的事件才不会丢
   await connection.ensureConnected(sessionId.value)

   // fork 会原地改写 wrapper 内部状态 必须立刻销毁 否则后续请求拿到脏状态
   await this.destroy()
   ```
   （本计划示例代码里的注释带标点，落地时按本规范改写。）
3. **结构**：函数单一职责，一屏放不下就拆；嵌套超过三层用早返回拍平；命名能读出意图。
4. **TS 类型按需取复杂度，不追求复杂**：数据结构用 `interface`/`type` 命名清楚即可，不搞高阶类型体操；泛型只在真实复用时引入；字面量联合优先于 `enum`；禁用 `any`，必要时用 `unknown` 并尽快收窄。
5. **可读性优先**：在正确性和性能满足要求的前提下，选直白的写法，不为炫技增加复杂度。

## 技术栈一览

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | **Nuxt 4** + Vue 3.5 + TypeScript | 全栈单项目（`ssr: false`，纯客户端渲染） |
| 状态管理 | Pinia | `sessions` store（列表）+ `chat` store（当前会话/SSE/流式） |
| 路由 | Nuxt 文件路由（`app/pages/`） | `/`（新会话）与 `/session/:id` |
| 渲染 | markdown-it + highlight.js | 框架无关库，Vue 里 `v-html` 渲染 |
| 后端 | Nuxt server routes（Nitro/h3） | 标准 Web API，与 pi-web 的 Next 路由代码同构 |
| Agent | @earendil-works/pi-coding-agent 0.85.1 | 与 pi-web 锁定同版本；另装 pi-agent-core / pi-ai / pi-tui 同版本 |
| 运行时 | Node.js ≥ 22.19 | pi SDK 的硬性要求 |

单一 Nuxt 4 项目：`app/`（Vue 客户端）+ `server/`（API 路由）+ `shared/lib/`（两端共享纯函数，Nuxt 4 官方共享目录）。一条 `npm run dev` 同时跑前后端。

## 目录约定

- 新项目建议建在 `D:\project\pi-agent-vue`（与 pi-web 平级，方便对照阅读；名字随意）
- Nuxt dev 端口 **3000**（默认值，无需配置），与 pi-web 的 30141 不冲突，两个项目可以同时跑
- **安全边界**：本项目 API 无鉴权、Agent 可执行任意命令——**仅本机使用**（Nuxt dev 默认只绑 127.0.0.1），对外展示用录屏，**不要**裸奔到内网穿透/公网（详见 07）

## 环境前置条件（开始 Step 0 前确认）

1. Node ≥ 22.19：`node --version`
2. **pi 已配置好至少一个模型提供商**（`~/.pi/agent/models.json` + 凭证）。最简单的配置方式：跑一次 pi CLI，或打开本机已装的 pi-web（`npx @agegr/pi-web`，在 Models 面板里登录/填 API key）。验证方法见 `01-architecture.md` 末尾。
3. 会话数据目录 `~/.pi/agent/sessions/` 存在（pi 用过一次就会生成）。

## 时间预估（业余时间 vibe coding）

| 里程碑 | 步骤 | 预估 |
|---|---|---|
| **A：首个可演示版本**（创建 → SSE 流式 → 工具/思考可视化 → 停止 → 历史恢复） | Step 0–3 | 约 2–3 周 |
| 补最小单测（4 组纯函数测试，可选但推荐） | — | 2–3 小时 |
| **B：差异化增强**（编辑重发 / 分支切换） | Step 4 | 2–3 天 |
| 加分项（fork / 删除 / 终端 / 模型配置…） | Step 5 | 按需 |

## 进度清单

- [x] Step 0 脚手架完成（含 pi SDK 冒烟验证通过）
- [x] Step 1 后端核心完成
- [x] Step 2 前端核心完成（核心闭环跑通）
- [x] Step 3 工具/思考可视化完成 → **里程碑 A：首个可演示版本（建议立刻录 2 分钟演示视频存档）**
- [x] 补最小单测（4 组，见 07；约 2–3 小时）
- [x] Step A+ 基础工作区完善（见 09：项目/worktree、文件、会话管理、运行控制、使用量、设置 —— 2026-09-10 全部 SA 阶段验收通过，107 测试）
- [ ] Step 4 会话内分支完成 → **里程碑 B：差异化增强**
- [ ] （可选）Step 5 加分项（fork / 删除 / 终端 / 模型配置…）
