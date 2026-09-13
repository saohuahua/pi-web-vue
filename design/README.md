# UI Design Assets

这个目录是 UI 重构的唯一设计入口 参考资料和可执行规范分开存放。

| 路径 | 作用 |
| --- | --- |
| `../DESIGN.md` | 设计系统的规范性说明和 token 定义 |
| `ui-system.md` | Pi 组件库 样式分层 迁移与验收的实施契约 |
| `tokens.css` | 应用样式可直接导入的语义变量 |
| `patterns.md` | 可复用的工作台组件模式 |
| `component-map.md` | 组件 状态 参考页面和实施顺序 |
| `interaction-contract.md` | 状态 交互 响应式与无障碍约束 |
| `capability-center.md` | 三栏工作台和能力中心 Modal 的页面规范 |
| `brand/` | 新 Logo 和标识的替换入口 |
| `reference/stitch-agentcraft-studio/` | 原型原始 HTML 截图和说明 仅供视觉参考 |

## 迁移边界

参考原型来自 `C:\Users\htlocal\Downloads\stitch_agentcraft_studio` 并于 2026-09-10 原样迁入。原型中出现的产品名 文案 凭证 权限和连接状态不属于可迁移资产。

后续调整 UI 时先改 `tokens.css` 和 `DESIGN.md` 中的共同规则 再遵守 `ui-system.md` 的组件和样式所有权。不要从 `reference/` 复制运行时代码或外部 CDN 依赖。

能力中心的实现顺序 安全边界和验收见 `../vue-agent-plan/11-capability-center.md`。整体工作台只以 `pi_web_agent_2` 作为布局基准 `pi_web_agent_1` 和 `pi_web_agent_3` 只能用于能力中心的局部交互参考。
