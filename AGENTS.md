# 项目协作要求

## 沟通与判断

- 始终使用中文回答
- 先检查请求中的错误前提 逻辑错误和信息缺失 不迎合不成立的结论
- 明确区分事实 推测和主观判断 对不同意的方案给出依据 风险和替代策略
- 除非用户明确要求构建项目或任务确有必要 不运行构建
- 编写代码时只为时序 风险和取舍添加精炼注释 注释不使用标点

## UI 改动前必读

任何可见 UI 样式 组件 布局 响应式 无障碍或交互改动开始前 按顺序阅读：

1. `DESIGN.md` 视觉唯一事实来源
2. `design/ui-system.md` Pi 组件库 样式所有权 复用门槛与迁移契约
3. `design/interaction-contract.md` 交互 异步状态 响应式与无障碍约束
4. `design/component-map.md` 现有组件职责和变更边界
5. 修改能力中心时额外阅读 `design/capability-center.md`

`design/reference/` 只用于视觉核验 不得复制其中的运行时代码 外部 CDN 文案 凭证或虚构状态。

## UI 事实来源

- `DESIGN.md` 决定颜色 字体 密度 圆角 阴影 容器模型和断点
- `design/tokens.css` 是全部视觉值的唯一来源
- `design/ui-system.md` 决定样式文件归属 CSS layer Pi 原语接口和迁移顺序
- 既有 `main.css` 规则 参考原型和其他产品文档不能覆盖以上视觉要求
- 产品命名和业务文案属于产品决策 不得通过样式任务自行改写

## 样式架构

- `app/assets/css/main.css` 只能管理 CSS layer 和导入顺序 不得新增业务选择器
- 层级固定为 `reset -> theme -> base -> layout -> primitives -> features -> utilities`
- 所有 authored CSS 必须进入明确 layer 禁止未分层样式和末尾覆盖补丁
- `foundation` 只处理 reset 字体 焦点 减少动效和文档级行为
- `layout` 只处理工作台壳 三栏 抽屉和响应式
- `features` 只处理领域样式或 `v-html` 生成的 Markdown Highlight.js 内容
- 普通 Vue 组件和 Pi 原语默认使用局部样式 全局选择器必须以功能根节点开头
- 不在 `tokens.css` 之外新增普通 UI 的直接色值 阴影 圆角 动画时长 easing 或任意 Tailwind 色彩值
- 只允许经过说明的 Markdown 兼容场景使用 `!important`

## Pi 原语

- 公共原语位于 `app/components/pi/` 命名使用 `Pi` 前缀 不创建 `components/ui/`
- 已批准的原语是 `PiButton` `PiIconButton` `PiInput` `PiPopover` `PiStatusTag` 和 `PiEmptyState`
- `PiDialog` 暂不创建 当前只有 `CapabilityCenterModal` 一个独立消费者 直到出现第二个独立对话框需求才允许提取
- 任何新 `Pi*` 原语必须先在 `design/ui-system.md` 的复用清单中记录至少两个独立消费者
- 复用必须共享视觉状态 键盘行为或无障碍行为 不能只因为标签同为 `button` 或 `input` 就抽象
- 不给公共原语增加 catch all variant 自由 class 自由颜色或 style props 来迁就单一业务面
- 会话行 文件行 Tab 树节点 Prompt 编辑器等拥有独立交互契约的控件保持领域组件
- `PiButton` 和 `PiIconButton` 只承载命令动作 图标按钮必须有程序可读名称和 tooltip
- `PiInput` 不承载表单校验策略和 Composer textarea 的特有行为
- `PiPopover` 承载触发 关闭 Escape 焦点恢复和浮层外观 内容与业务选择逻辑归调用方

## 交互与视觉硬约束

- Signal blue 只用于当前选择 主操作 键盘焦点和运行中线索
- 状态不能只靠颜色表达 必须有可读文本
- 主工作区保持平面化 不叠加装饰卡片 大圆角 容器阴影或渐变
- `>= 1100px` 保持三栏可读 `760px - 1099px` Inspector 覆盖中央区 `< 760px` 侧栏和 Inspector 为抽屉
- 能力中心低于 `1200px` 为视口覆盖
- 所有图标操作需要 `aria-label` 焦点环必须可见
- 重要说明不低于 12px 禁用态和错误态仍须清晰可读
- 必须尊重 `data-reduce-motion=true` 和 `prefers-reduced-motion`
- 保留原生 `dialog` `tablist` `tab` `tabpanel` `role=status` `aria-live` 和 listbox 语义

## 实施与验证

- 先迁移样式所有权 再调整视觉细节 不以新增覆盖规则解决旧样式问题
- 每次迁移保留会话 SSE 文件访问 草稿 恢复和能力中心的既有业务行为
- 可见 UI 变更需要核验桌面 平板和手机布局以及浅色 深色和减少动效状态
- 可见流程至少覆盖 工作区选择 发送消息 工具执行 文件 Inspector 和能力中心关闭
- 有可用浏览器能力时优先做实际页面核验和截图对比 无可用浏览器时如实说明未覆盖项
- 最终提交前运行与改动范围相称的类型检查和测试 不把构建成功当作视觉验收
