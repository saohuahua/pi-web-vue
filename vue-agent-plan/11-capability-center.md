# 11 能力中心与三栏工作台实施计划

> 状态：仅计划 尚未开始
>
> 前置：`09-step-a-completion.md` 已全部验收
>
> 设计契约：`design/capability-center.md` 和 `DESIGN.md`

## 0 执行目标

本阶段将现有右侧 `SettingsDrawer` 替换为独立的能力中心 Modal 并以 `pi_web_agent_2` 的三栏工作台作为整体布局基准。工作台负责会话和证据 能力中心负责低频资源管理 两者不再混用。

完成定义：

```text
选择工作区和会话
  -> 在三栏工作台中完成对话 文件预览和工具核对
  -> 打开能力中心
  -> 在真实作用域内查看或修改常规 模型 技能 扩展 MCP
  -> 获得保存 重载 错误和安全边界反馈
```

## 1 事实与非目标

### 事实

- 当前项目已实现模型目录读取 当前会话模型切换 技能读取和技能调用开关 浏览器主题与提示音
- 当前 `SettingsDrawer` 只有模型 技能 设置三页 且作为右侧窄抽屉出现
- Pi `0.85.1` 没有原生 MCP 服务器管理 MCP 必须通过扩展提供
- 当前 Web RPC 只暴露会话级工具定义 不具备扩展或 MCP 服务注册表

### 本阶段非目标

- 不复制 Stitch 原型的产品名 凭证 示例模型 在线数量或 Daemon 状态
- 不在第一阶段提供 npm Git 一键插件安装 因为第三方 Pi 扩展可执行任意代码
- 不实现模型 OAuth 或远程目录发现 除非所需 SDK 契约与安全写入已经先完成
- 不让 MCP 页面在没有 `McpBridge` 时伪造可用服务
- 不修改会话内分支模型 Step B 仍由 `06-history-branching.md` 负责

## 2 架构和数据边界

### 2 1 前端状态

新增 `capability-center` store 只保存 UI 状态和可撤销草稿 不重复会话和工作区事实。

| 状态 | 责任 |
| --- | --- |
| `open` `activeTab` `returnFocus` | dialog 生命周期和快捷入口 |
| `scope` | global 或 project 以及对应路径 |
| `resources` | 模型 技能 扩展 MCP 的加载状态和最后成功版本 |
| `drafts` | 按资源和作用域隔离的可写草稿 |
| `dirtyKeys` `saveState` | 关闭拦截 底栏和错误恢复 |

浏览器偏好继续归 `settings` store 当前会话模型和思考等级继续归 `chat` store。`RuntimeInfoDrawer` 保持只读并只读取当前会话。

### 2 2 服务端资源层

新增 `server/utils/capabilities/` 目录 将文件读取 配置写入 扩展发现和 MCP Bridge 分开。页面和 route 不可直接读写 `~/.pi/agent`。

| 模块 | 职责 |
| --- | --- |
| `scope.ts` | 解析 global project 作用域 校验 cwd 和真实根目录 |
| `config-io.ts` | JSON 解析 revision 计算 临时文件原子替换 失败保留原文件 |
| `secrets.ts` | GET 结果脱敏 PATCH 只接收显式覆盖字段 不记录明文 |
| `models.ts` | 聚合 runtime 模型和受控 `models.json` 配置 |
| `skills.ts` | 复用现有 loader 和 frontmatter 最小修改 |
| `extensions.ts` | 静态发现 manifest 路径 可信状态和诊断 不执行未知扩展 |
| `mcp-bridge.ts` | 对接已安装的 MCP 扩展 返回标准化服务状态 |

所有写接口都使用 `scope` 加 revision。revision 不一致时返回冲突而不是覆盖其他 Pi 进程的最新配置。文件锁或权限错误必须提示重试或刷新。

### 2 3 API 契约

| 接口 | 阶段 | 语义 |
| --- | --- | --- |
| `GET /api/capabilities/overview?cwd=` | CC-2 | 返回可用 Tab 真实数量 作用域和诊断摘要 |
| `GET/PATCH /api/capabilities/models` | CC-4 CC-5 | 查询 runtime 和配置草稿 保存模型配置或默认模型 |
| `GET/PATCH /api/skills` | CC-3 | 保留现有读取和最小 frontmatter 更新 迁移至统一错误格式 |
| `GET/PATCH /api/capabilities/extensions` | CC-6 | 静态注册表和启用状态变更 |
| `GET/PATCH /api/capabilities/mcp` | CC-7 | 由 Bridge 返回服务与配置 |
| `POST /api/capabilities/mcp/test` | CC-7 | 用户显式触发并带超时的连接测试 |

`GET` 永不返回 API Key 完整值 环境变量内容或命令型凭证。所有作用域写入都返回实际目标路径 新 revision 和是否需要重新加载会话。

## 3 分阶段实施

### CC-0 先决核验与视觉基线

**目标**：避免以截图代替产品事实 并锁定实现时的 UI 规则。

1. 阅读 `design/capability-center.md` `DESIGN.md` `design/tokens.css` 以及本计划
2. 记录当前 `SettingsDrawer` API 与 SDK `0.85.1` 的模型 扩展 MCP 能力
3. 建立三组演示数据 模型为空 技能加载失败 未接入 MCP 不允许使用原型静态数据
4. 为 desktop 1440px tablet 1024px mobile 390px 定义截图基线

**验收**：无代码行为改动 已明确每一页的数据来源 可写范围和未接入空态。

### CC-1 三栏工作台收口

**目标**：将 `pi_web_agent_2` 的布局关系落实到现有 Vue 外壳 但不替换已验收的会话和文件逻辑。

| 修改范围 | 做法 |
| --- | --- |
| `app/app.vue` | 明确左导航 中央画布 右 Inspector 三个布局槽 不让配置 Modal 成为 Inspector 子元素 |
| `SessionSidebar.vue` | 底部改为能力中心入口和可访问快捷入口 移除多个独立设置抽屉语义 |
| `main.css` | 统一 256px 左栏 中栏最小宽度 Inspector 覆盖断点和紧凑行高 |
| `FileViewer.vue` `RuntimeInfoDrawer.vue` | 固定为按需右侧证据层 不承载配置 |

**状态**：侧栏收起 文件查看 运行时信息 同时打开冲突时后打开者替换右侧 Inspector 内容。能力中心打开时冻结背景交互但不销毁工作台状态。

**验收**：1440px 有完整三栏 1024px Inspector 覆盖中栏 390px 无横向溢出且 Composer 可见。

### CC-2 能力中心壳与常规设置

**目标**：先交付对话框生命周期和真实的浏览器偏好 作为所有后续 Tab 的承载层。

| 修改范围 | 做法 |
| --- | --- |
| `CapabilityCenterModal.vue` | 使用 `dialog` 或 portal 实现焦点捕获 关闭还焦点 背景滚动锁定和脏状态拦截 |
| `CapabilityCenterTabs.vue` | 使用 tablist 语义 键盘切换 数量来自 overview |
| `GeneralSettingsPanel.vue` | 主题 提示音 减少动效立即写 `settings` store |
| `ui.ts` | 用 `capabilityCenter` 状态替换 `settingsOpen` 和 `settingsTab` |

**验收**：所有入口能直达 Tab Esc 和遮罩可关闭 有草稿时不丢变更 深浅主题下焦点和可读性正确。

### CC-3 技能主从页

**目标**：把已有技能能力从列表抽屉迁移为可扫描的管理页面。

1. `SkillsPanel` 分为搜索索引和详情区
2. 详情显示真实名称 描述 路径 来源 允许模型调用状态
3. 复用现有 `GET/PATCH /api/skills` 对单一 frontmatter 开关立即保存 并显示成功或失败结果
4. 打开技能文件前使用现有允许根校验
5. 技能加载 保存 重载失败均保留草稿并提供恢复动作

**验收**：全局和项目技能可区分 搜索不改变源数据 切换开关不修改其他 frontmatter 未选择项目和不可写路径均有明确状态。

### CC-4 模型目录与当前会话切换

**目标**：先完成无凭证写入的真实模型管理闭环。

1. 将 `/api/models` 丰富为只读模型目录 包含 provider id name input 和真实思考等级
2. `ModelsPanel` 使用 Provider 分组和搜索 右侧展示选中模型详情
3. 当前会话模型切换继续调用 RPC `set_model` 成功后更新 `chat` 失败保留旧选择
4. 默认模型必须与当前会话模型并列展示 严禁用一个当前标识混淆两种状态
5. 没有 context cost 或能力数据时显示不可用 不填示例值

**验收**：模型切换成功和失败均与 Agent 实际状态一致 图片能力限制继续由 Composer 使用同一模型目录。

### CC-5 模型配置与凭证安全

**目标**：在 CC-4 已稳定后再开放模型配置编辑。

1. 实现 `models.json` 的结构化读取 验证和 revision 保护
2. 可编辑字段按 provider 配置和模型定义分层 展示保存前 diff
3. 密钥字段读取永远为空 写入仅覆盖目标字段 优先支持 `$ENV_VAR` 引用
4. 新增模型或替换 Provider 模型集合前提示 SDK 的整体替换影响
5. 保存成功后刷新对应 runtime 并显示当前会话是否需要重新创建

**验收**：非法 JSON 并发写入 权限错误 环境变量引用 取消编辑和 Provider 整体替换警告均有测试。不得在请求日志 测试快照或 UI 中出现明文凭证。

### CC-6 扩展注册表与可信边界

**目标**：将 Pi 扩展作为可执行资源处理 而不是普通设置项。

1. 扫描全局和项目允许目录中的 extension 文件和 package manifest
2. 仅解析静态元信息 路径 来源 诊断 工具和命令摘要 不执行文件以获得元数据
3. 对项目资源查询 project trust 未可信时显示阻断说明
4. 启用禁用写入支持的配置作用域 展示受影响路径和下次加载生效提示
5. 不实现远程安装 更新和自动执行包管理器

**实施边界**：SDK 没有稳定的单扩展启停状态 本阶段只提供静态注册表与项目可信决定 不伪造启停开关。

**验收**：未知扩展只读扫描无执行 禁用状态不伪造为已卸载 未信任项目无法加载可执行扩展并保留明确恢复路径。

### CC-7 MCP Bridge 与服务页

**目标**：在没有原生 MCP 的 SDK 上提供可验证的扩展适配层。

1. 先定义 `McpBridge` 接口 `listServers` `saveServers` `testServer` `reload` 和标准错误类型
2. 选择一个已安装并明确支持的 MCP 扩展作为第一个 adapter 不对任意扩展猜测配置格式
3. `McpPanel` 展示服务器名 transport 作用域 工具数 启用状态 最后错误和测试结果
4. 添加 修改 删除 启停操作均以草稿保存 并显示命令执行或网络访问风险
5. 测试仅由按钮触发 使用超时 输出脱敏和可取消状态
6. 保存后调用 adapter reload 或明确提示重新创建会话

**验收**：无 Bridge 时只有说明空态 不发生后台进程启动。有效 stdio 或 HTTP 服务可测试 失败时不会泄露环境变量 命令输出或凭证。

### CC-8 回归和文档收口

1. 更新 `design/component-map.md` `design/patterns.md` `design/interaction-contract.md` 到实际组件归属
2. 执行单元 Store API 与浏览器测试
3. 运行 Impeccable 检测和桌面 手机截图比对
4. 更新本文件阶段进度与 `vue-agent-plan/README.md`

## 4 测试矩阵

| 层 | 必测项 |
| --- | --- |
| 纯函数 | scope 根目录校验 JSON revision 冲突 凭证脱敏 原子写入失败 MCP 结果标准化 |
| API | 作用域拒绝 不存在 cwd 文件锁 保存冲突 密钥不回显 扩展未信任 MCP 测试超时 |
| Store | Tab 切换 草稿隔离 保存失败保留 关闭确认 模型切换失败回滚 |
| 组件 | dialog 焦点 Esc 还焦点 按键 Tab 状态 加载 空态 错误态 禁用态 |
| 浏览器 | 三个断点 深浅主题 长模型名 大量技能 无模型 未接入 MCP 正在运行的 Agent |

每阶段至少运行与变更相关的 `npm run typecheck` 和 `npm test`。CC-1 CC-2 CC-8 额外执行浏览器截图检查。配置和 MCP 写入测试应使用隔离临时目录 不触碰用户真实 `~/.pi/agent`。

## 5 实施依赖

```text
CC-0
  -> CC-1 三栏工作台
  -> CC-2 Modal 壳和常规设置
       -> CC-3 技能
       -> CC-4 模型目录和会话切换
            -> CC-5 模型配置写入
       -> CC-6 扩展注册表和可信边界
            -> CC-7 MCP Bridge
                 -> CC-8 验收和文档收口
```

CC-3 CC-4 可以在 CC-2 完成后并行阅读和测试 但共享 `capability-center` store 的修改应由一个阶段集中合入。CC-5 CC-6 CC-7 都涉及本机配置或可执行资源 不得与纯 UI 调整混在同一个提交。

## 6 进度

- [x] CC-0 先决核验与视觉基线
- [x] CC-1 三栏工作台收口
- [x] CC-2 能力中心壳与常规设置
- [x] CC-3 技能主从页
- [x] CC-4 模型目录与当前会话切换
- [~] CC-5 模型配置与凭证安全 已完成默认模型写入 Provider 凭证与 `models.json` 编辑待稳定写入契约
- [x] CC-6 扩展注册表与可信边界
- [ ] CC-7 MCP Bridge 与服务页 需要选择并安装支持的 MCP Bridge 扩展
- [ ] CC-8 回归和文档收口

## 7 本次执行记录

- 以 `pi_web_agent_2` 的三栏工作台为布局基准 将旧右侧 `SettingsDrawer` 替换为独立能力中心 Modal
- 新增常规 模型 技能 扩展 MCP 五个 Tab 常规 模型 技能和扩展均使用真实数据或真实空态
- 模型支持检索 200 项上限 当前会话切换和 SDK `SettingsManager` 默认模型写入 不回显凭证
- 技能支持主从详情和模型调用开关 扩展只静态扫描标准目录 项目资源的信任决定由显式操作写入 Pi trust store
- MCP 保持未接入状态 因为本机没有可用 Bridge Pi SDK 也没有原生 MCP 服务注册表
- 验收基线 `npm run typecheck` 通过 `npm test` 26 个文件 117 个用例通过 2026-09-10
