# Reusable UI Patterns

## Pattern Ownership

所有 UI 组件先匹配本文件的模式 再定义局部差异。局部样式只允许改变内容密度和状态 不允许重定义颜色 阴影 圆角或断点。

## Workspace Shell

- 左侧导航宽度 256px
- 中央区承载任务和消息流
- Inspector 默认关闭 桌面最大 540px
- 小于 1100px Inspector 覆盖中央区
- 小于 760px 所有辅助区域变抽屉

## Capability Center

- 能力中心通过独立的 viewport 级 Modal 打开 不属于右侧 Inspector
- 桌面 Modal 最大 1180px 宽和 860px 高 平板与手机改为全屏覆盖
- 顶栏放标题 当前作用域和关闭操作 横向 Tab 放常规 模型 技能 扩展 MCP
- 模型和技能采用左侧索引与右侧详情 扩展和 MCP 使用服务列表与详情
- 只有可写资源存在草稿时才显示底部保存栏 浏览器偏好立即生效
- 未接入的 MCP 显示说明空态 不显示假服务卡片或在线数量
- 关闭有草稿的 Modal 先要求继续编辑或放弃变更 关闭后把焦点还给触发入口

## Navigation Row

- 默认透明 悬停使用 Quiet Surface
- 当前项使用 Blue Wash 和中等字重
- 第一行是名称 第二行才放项目 时间或状态
- 行内动作只在悬停或键盘聚焦时可见

## Inspector

- 标题栏始终包含名称 元信息和关闭按钮
- 主内容独立滚动 标题栏和操作区固定
- 不在 Inspector 内再堆叠外层 Card
- 关闭后回到此前中央任务位置

## Execution Evidence

- 思考块和工具调用是折叠的执行证据
- 摘要行依次是状态 工具名 目标 持续时间
- 参数与输出使用深色等宽区域
- 完成 失败 执行中必须出现文字状态

## Composer

- 输入框是当前会话唯一的主要操作面
- 发送使用图标按钮并提供名称和提示
- 模型 思考等级 附件和上下文属于次级控制
- 弹层向上打开 不遮挡当前输入内容

## Forms

- 标签在字段上方 错误紧跟字段
- Primary Button 只出现在提交动作
- 危险动作明确说明影响范围
- 禁用状态保留文字可读性

## System States

| 状态 | 颜色角色 | 必须内容 |
| --- | --- | --- |
| loading | Quiet Surface | 当前对象和进行中的动作 |
| active | Signal Blue | 可停止或可查看的当前工作 |
| success | Success Green | 已完成的对象和结果入口 |
| warning | Warning Ochre | 原因和建议动作 |
| error | Error Red | 失败原因和恢复动作 |
| empty | Neutral | 下一步可执行动作 |
