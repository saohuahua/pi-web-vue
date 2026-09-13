---
name: Agent Workspace
description: 高密度 AI coding agent 工作台
colors:
  canvas: "#EAF0F4"
  surface: "#F9FBFC"
  surface-subtle: "#E5ECF1"
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  primary-ink: "#FFFFFF"
  accent-text: "#1D4ED8"
  primary-soft: "#E4EDFF"
  ink: "#17212B"
  ink-muted: "#536271"
  line: "#D1DBE4"
  success: "#15803D"
  warning: "#A16207"
  danger: "#B42318"
typography:
  title:
    fontFamily: "Inter, Segoe UI Variable, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: "24px"
    letterSpacing: "0"
  body:
    fontFamily: "Inter, Segoe UI Variable, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "0"
  mono:
    fontFamily: "IBM Plex Mono, Cascadia Code, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "0"
  code:
    fontFamily: "Noto Sans Mono, JetBrains Mono, Fira Code, Consolas, ui-monospace, PingFang SC, Microsoft YaHei, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
---

# Design System: Agent Workspace

## Overview

**Creative North Star: "The Code Review Desk"**

这是一个让用户同时观察会话 意图 工具执行与文件证据的操作型工作台。整体布局以 `pi_web_agent_2` 的三栏工作台为唯一参考 权限和能力管理以独立的全屏级 Modal 呈现 `pi_web_agent_1` 和 `pi_web_agent_3` 只定义其中的主从详情关系。产品名 图标 文案 凭证与权限语义必须以真实实现为准。

界面以冷白画布和低对比边线组织密集信息。电蓝只表达当前焦点 主要提交与实时执行线索 让它像一支标记笔而不是整片底色。品牌资产尚未确定 任何品牌锁定区域必须通过 `design/brand/README.md` 的契约替换。

**Key Characteristics:**

- 固定导航 加载核心任务的中央画布和按需出现的证据 Inspector
- 低频的模型 技能 扩展 MCP 与通用设置归入能力中心 Modal 不占用 Inspector
- 普通叙述用无衬线 技术对象 路径 Token 与命令用等宽字体
- 面板靠层级和发丝边线分隔 不依赖厚重阴影或装饰性渐变
- 每个异步状态都配文字 动作结果和可恢复出口

## Colors

电蓝是稀缺的交互墨水 冷灰负责结构 成功 警告和失败有独立语义而不与品牌色混用。

### Primary

- **Signal Blue** 用于当前会话 主要提交 链接和运行中状态
- **Focus Blue** 用于悬停与键盘焦点的加深状态
- **Blue Wash** 用于选中行和非破坏性的提示背景

**The One Signal Rule.** `primary` 不得覆盖大面积容器 只用于一屏中的当前动作和需要立即定位的状态。

### Secondary

- **Success Green** 仅表示已完成 已连接或可用状态 同时必须显示文字
- **Warning Ochre** 表示即将达到资源上限或需要注意的操作
- **Error Red** 表示失败 破坏性操作与不可恢复的问题

### Neutral

- **Cool Canvas** 是页面底色
- **Clean Surface** 是侧栏 卡片 输入区和浮层底色
- **Quiet Surface** 组织工具头部 代码预览和次级区域
- **Hairline** 分隔所有高密度区域

## Typography

**Display Font:** Inter 或系统无衬线后备

**Body Font:** Inter 或系统无衬线后备

**Label/Mono Font:** IBM Plex Mono 或 Cascadia Code 后备

**Code Font:** Noto Sans Mono 用于文件预览与代码块 英文代码后备 JetBrains Mono Fira Code Consolas 中文回退 PingFang SC 或 Microsoft YaHei

**Character:** 文字以中等字重和清晰行距承担信息层级。等宽字体只用于模型 名称 路径 Token 命令与代码 不用于长说明。

### Hierarchy

- **Title** 使用 `title` 表达会话名 面板标题与重要设置名
- **Body** 使用 `body` 表达消息 正文和表单说明
- **Mono** 使用 `mono` 表达可复制或机器可读信息
- **Code** 使用 `code` 表达文件预览和需要逐字符对齐的代码内容
- **Supporting text** 不小于 12px 不用全大写和字距制造伪层级

**The Technical Voice Rule.** 一段文字只有在用户可能复制 检查或比较时才使用等宽字体。

## Layout

桌面布局由 256px 左侧工作区导航 中央任务画布和按需打开的右侧 Inspector 组成。中央消息列的可读宽度保持在 860px 以内 但工具结果可占满任务画布。能力中心是独立于三栏布局的 viewport 级 Modal 桌面尺寸最大 1180px 乘 860px 在 1200px 以下转全屏覆盖。

在 1100px 以下 Inspector 覆盖中央画布而不是挤压它。在 760px 以下 侧栏和 Inspector 都变为抽屉 主操作和输入区保持可见。所有面板最小高度服从视口 不使用固定的 900px 级高度。

## Elevation & Depth

默认平面化。边线与冷灰表面区分区域 只有抽屉 下拉和 Composer 使用一层低不透明度环境阴影。悬停通过背景和文字变化反馈 不让每张卡片浮起。

**The Evidence Layer Rule.** Inspector 和下拉面板是临时证据层 允许阴影 主内容卡片不允许以阴影制造优先级。

## Shapes

小控件采用 6px 圆角 普通容器采用 8px 圆角 Composer 和图片预览可使用 12px。不可把胶囊圆角用于普通按钮或所有容器 仅用于紧凑状态标签与数值 Chip。

## UI System Contract

视觉规则以本文件为唯一事实来源 组件库和样式分层的实施要求见 `design/ui-system.md`。项目复用组件统一使用 `Pi` 前缀 例如 `PiButton` 和 `PiDialog` 不使用通用的 `Ui` 前缀。`app/assets/css/main.css` 仅作为 CSS layer 和导入入口 不承载业务组件规则。

## Components

### Buttons

- **Shape:** 轻微圆角 6px
- **Primary:** 蓝色填充 只用于发送 保存和确认这类单一首要动作
- **Secondary:** 白色底和发丝边线 用于可逆操作
- **Ghost:** 无边框 用于工具栏 图标必须有可访问名称与提示

### Chips

- **Style:** 紧凑的浅色底 等宽数值或状态文本
- **State:** 颜色之外显示可读状态名称 不把色点当成唯一信息

### Cards / Containers

- **Corner Style:** 8px
- **Background:** 白色 或安静灰底
- **Shadow Strategy:** 默认无阴影
- **Border:** 1px Hairline
- **Internal Padding:** 使用 8px 的倍数

### Inputs / Fields

- **Style:** 白色底 发丝边线 6px 圆角
- **Focus:** 边线切换为 Focus Blue 并保留 2px 可见焦点轮廓
- **Error / Disabled:** 错误文字说明问题和下一步 禁用态保持可读对比

### Navigation

侧栏当前项使用浅蓝底与左侧 2px 蓝线 不是整块高饱和填充。导航项保留文字标签 图标不能独立承担含义。

### Tool Execution

工具调用是 Agent 工作过程的证据块 头部显示工具名 目标与状态 主体才展示参数和结果。运行 失败和完成状态必须在标题旁以文字呈现。

### Capability Center

- **Shape:** 只承载低频资源管理 不是右侧 Inspector 的扩展
- **Topology:** 顶部页签承载常规 模型 技能 扩展 MCP 模型和技能可采用左侧索引和右侧详情
- **Persistence:** 浏览器偏好立即生效 会话控制立即应用 资源配置使用草稿 作用域和保存确认
- **Truth:** 数量 连通性 凭证和工具信息必须来自真实 API 未接入 MCP 时只显示说明空态

## Do's and Don'ts

### Do:

- **Do** 使用 `design/tokens.css` 的语义变量而不是直接抄原型的 Tailwind 色值
- **Do** 将文件预览作为由工具调用打开的可关闭 Inspector
- **Do** 在保存 删除 写入和凭证变更前显示真实作用域与结果
- **Do** 为 760px 以下设计抽屉和触摸尺寸而不是保留三栏横向滚动

### Don't:

- **Don't** 继承参考原型中的产品名 假 API Key 或尚未实现的 Daemon 连接承诺
- **Don't** 将模型 MCP 技能 权限和通用设置拆成多个互相独立的工作台抽屉 能力中心是唯一配置入口
- **Don't** 用 10px 灰字 色点或图标单独表达重要状态
- **Don't** 直接在应用运行时依赖参考原型的 CDN Tailwind 或 Google Fonts
