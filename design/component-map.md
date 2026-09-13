# Component Map

## Scope

本次重构先改变 UI 结构视觉层和可访问性标记 再按 `vue-agent-plan/11-capability-center.md` 分阶段补齐资源管理 API。会话 SSE 文件访问和右侧证据 Inspector 继续沿用现有职责。

## Shared Foundation

| Artifact | Responsibility | Source |
| --- | --- | --- |
| `app/assets/css/main.css` | 应用 token 布局 常见控件和深浅主题 | `design/tokens.css` `design/patterns.md` |
| `app/app.vue` | 工作台外壳 左导航 中央画布 右 Inspector 与能力中心 portal | `pi_web_agent_2` |
| `CapabilityCenterModal` | 资源作用域 Tab 草稿 保存与离开确认 | `pi_web_agent_1` |
| `app/pages/index.vue` | 空会话启动状态 | 工作台的轻量空态 |
| `app/pages/session/[id].vue` | 会话路由装配 | 现有功能结构 |

## Workspace Navigation

| Component | States | Reference | Change Boundary |
| --- | --- | --- | --- |
| `WorkspaceSelector` | 未选项目 已选项目 worktree 下拉 错误 | `pi_web_agent_1` | 只调整项目行 标签和弹层 |
| `SessionSidebar` | 搜索 新建 展开 分组 空列表 | `pi_web_agent_1` | 保留会话过滤和轮询 |
| `SessionRow` | 默认 当前 运行中 重命名 自动标题 | `pi_web_agent_1` | 保留导航和标题生成 |
| `NewSessionForm` | 默认 提交中 错误 最近目录 | 空会话启动模式 | 保留创建会话 API |

## Files And Inspector

| Component | States | Reference | Change Boundary |
| --- | --- | --- | --- |
| `FileExplorer` | 未选项目 加载 树 搜索 错误 | `pi_web_agent_2` | 保留白名单文件 API |
| `FileTreeNode` | 目录展开 加载 文件 悬停引用 | `pi_web_agent_2` | 保留递归和事件协议 |
| `FileViewer` | 文本 图片 截断 加载 错误 | `pi_web_agent_2` | 作为按需 Inspector |
| `RuntimeInfoDrawer` | 系统提示 工具列表 空状态 | `pi_web_agent_mcp` | 只读 不改变工具数据 |

## Conversation And Execution

| Component | States | Reference | Change Boundary |
| --- | --- | --- | --- |
| `ChatPanel` | 空会话 流式 通知 重试 队列 | `pi_web_agent_1` | 保留自动滚动和聊天状态 |
| `MessageItem` | 用户 Agent bash 图片 空内容 | `pi_web_agent_2` | 保留消息块顺序 |
| `ThinkingBlock` | 流式 已完成 可展开 | `pi_web_agent_2` | 只展示真实时长和字数 |
| `ToolCallCard` | 运行中 完成 失败 参数 输出 图片 | `pi_web_agent_2` | 保留结果配对逻辑 |
| `PiIndicator` | 运行中 减少动效 | `pi_web_agent_1` | 保留运行含义 品牌图形后续替换 |
| `ChatComposer` | 禁用 可发送 停止 附件 模型 思考 压缩 补全 | `pi_web_agent_2` | 保留快捷键和草稿队列 |

## Settings

| Component | States | Reference | Change Boundary |
| --- | --- | --- | --- |
| `CapabilityCenterModal` | Modal 焦点 Tab 草稿 保存冲突 关闭确认 | `pi_web_agent_1` | 替换 `SettingsDrawer` 但不把它放入 Inspector |
| `GeneralSettingsPanel` | 主题 提示音 减少动效 | 现有设置页 | 只写浏览器偏好 立即生效 |
| `ModelsPanel` | 模型目录 当前会话切换 默认模型 配置草稿 | `pi_web_agent_3` | 先只读和会话切换 后续才开放受控配置写入 |
| `SkillsPanel` | 搜索 来源 启用状态 主从详情 | `pi_web_agent_1` | 复用技能 loader 与 frontmatter 最小修改 |
| `ExtensionsPanel` | 扩展来源 可信状态 诊断 | 原型 Extensions 标签 | 不执行未知文件 不做远程安装 |
| `McpPanel` | 服务状态 连通性测试和重载提示 | `pi_web_agent_mcp` | 仅在 McpBridge 已接入后显示真实服务 |

## Delivery Order

1. 三栏工作台和能力中心 Modal 基础
2. 常规设置和技能主从页
3. 模型目录与当前会话切换
4. 模型配置 扩展注册表 MCP Bridge
5. 响应式 无障碍 深色主题和视觉验证

## Per Component Acceptance

- default hover focus disabled loading error empty states are present when the component owns them
- desktop and mobile do not create horizontal overflow
- icons include an accessible name
- technical text uses the mono token only where copying or comparison is meaningful
- no component imports runtime code from `design/reference`
