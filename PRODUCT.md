# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

运行时唯一用户是作者本人：在本机浏览器（127.0.0.1:3000）打开，对自己的代码项目与 pi 会话进行操作。没有多用户、鉴权或协作场景。

作品的第二受众是秋招面试官：通过公开的 GitHub 仓库阅读代码，通过录屏或现场演示观看产品运行。

## Product Purpose

用 Vue 3（Nuxt 4）从零实现 [pi coding agent](https://github.com/earendil-works/pi) 的浏览器客户端：创建/恢复 agent 会话、发送消息、SSE 流式渲染回复、工具调用与思考过程可视化、会话分支。

项目存在的原因是秋招核心作品集，覆盖两条能力主线：

1. **Agent 工程**：AgentSession 生命周期、`.jsonl` 会话持久化与树状分支模型、SSE 事件流、流式增量渲染、断线状态对账
2. **前端工程**：Vue 3 Composition API、Pinia、vue-router、SSE 长连接管理、Markdown/代码高亮、复杂列表性能

成功 = 核心闭环无可致命 bug（里程碑 A，已达成）+ 会话分支差异化（里程碑 B，进行中）+ 经得起阅读的代码与测试。

## Positioning

与 pi CLI / pi-web 共享同一套 `~/.pi/agent` 配置与 `.jsonl` 会话文件——任一端创建的会话，其他端都能看到并继续。这份生态同源是产品机制的根本。

相对参考实现 pi-web（Next.js，约 6 万行）：刻意精简为约 1/6 规模的 Vue 3 重实现，只做核心闭环 + agent 能力展示，不做全量功能对齐。差异点是「同一份 pi 生态数据上的另一种前端工程实现」本身。

## Operating Context

- 本机 Windows 11 + Git Bash；`npm run dev` 一条命令同时跑前后端（Nuxt dev，127.0.0.1:3000）
- 前置条件：Node ≥ 22.19（pi SDK 硬性要求）；`~/.pi/agent` 已配置至少一个模型提供商（models.json + 凭证，可借 pi CLI 或 pi-web 配置）
- 与 pi CLI 并行使用是常态：会话文件在 `~/.pi/agent/sessions/`，多端互见
- 对外展示只走录屏/现场演示，不做公网部署（见约束）
- 执行计划文档在 `vue-agent-plan/`（README + 01–10），按步骤推进并维护进度清单

## Capabilities and Constraints

已实现（截至 2026-09-10，Step 0–3 + 里程碑 A + Step A+ SA-1~8 全部验收）：

- 项目/worktree 选择器；会话创建、恢复、重命名、自动标题、列表操作
- SSE 流式渲染、工具调用卡片、思考块、停止；π 数字运行指示器
- 顶栏用量可见化；输入控制面（模型切换、思考模式、图片附件、上下文压缩、@ 文件引用与命令补全）
- 文件树 + 安全文件访问 + 预览面板；配置面板（模型/技能/应用设置）；深色主题
- 测试：20 个 vitest 测试文件覆盖 shared/lib、server/utils、app/stores、app/utils（Step A+ 收口时 107 个用例）

技术约束：

- pi SDK 锁 0.85.1（与 pi-web 同版本：pi-coding-agent / pi-agent-core / pi-ai / pi-tui）
- Nuxt `ssr: false` 纯客户端渲染；Nitro/h3 server routes 提供无鉴权 API
- **安全边界（不可协商）**：API 无鉴权且 Agent 可执行任意命令——仅本机使用（只绑 127.0.0.1），不暴露到内网穿透或公网
- 已确认的 SDK 行为事实（前端已适配，改动时勿回退）：首条消息前不落盘 `.jsonl`（详情路由用 wrapper 内存态兜底）；纯文本模型静默丢弃图片附件（前端按模型 input 能力阻止）；过小的会话拒绝压缩（"session too small"）

待办与未决：

- 下一步：Step B 会话内分支（`vue-agent-plan/06-history-branching.md`，里程碑 B）
- 可选加分项清单见 `vue-agent-plan/07-optional.md` 与 `10-feature-candidates-research.md`
- 仓库将公开到 GitHub 作为作品集（已确认）；具体发布时间未定

## Brand Commitments

用户已确认的绑定约束，只记录不扩展：

- 产品名与标识：**π agent**，数学衬线斜体的 π 字形为品牌标记
- 设计系统「清新纸面」：冷白纸面 `#F7F9FA` + 纯白面板 + 水青 `#0F9D95` 主色 + 大圆角
- 字体 IBM Plex Sans / IBM Plex Mono
- π 数字运行指示器：agent 运行时循环显示 π 的数字（3 1 4 1 5 9…），替代通用转圈动画
- 深色主题（`#141a20` 系）与浅色主题并存，用户可切换

## Evidence on Hand

- 可运行的产品：里程碑 A + Step A+ 已全部验收，核心闭环可现场演示
- 测试套件：vitest，20 个测试文件（分布见上）
- 计划与过程文档：`vue-agent-plan/`（架构、分步计划、验收方案 08、Step A 收口 09、功能候选研究 10）
- 合规材料：`THIRD_PARTY_NOTICES.md` 记录移植自 pi-web（MIT）的纯函数模块清单
- 没有真实用户证言、客户案例、性能基准数据——未来工作不得虚构这些

## Product Principles

1. **核心闭环优先**：创建 → 流式 → 可视化 → 停止 → 恢复的链路永远先于新功能保真
2. **刻意精简**：不做 pi-web 全量翻译，规模约束在约 1/6；每个功能都要能讲清工程取舍
3. **生态同源**：共享 `~/.pi/agent` 数据是与 pi CLI 互操作的根基，任何功能不得破坏它
4. **本机安全边界**：无鉴权 + 任意命令执行 = 永远只绑 127.0.0.1，对外只走录屏
5. **经得起阅读**：注释讲为什么（时序/陷阱/权衡）、测试覆盖关键纯函数——面试官会读代码
