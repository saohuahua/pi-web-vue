# 13 插件包管理实施计划

> 状态：仅计划 尚未开始
>
> 前置：`11-capability-center.md` 的 CC-2 CC-6 已验收
>
> 参考实现：`D:\project\pi-web` 的 `app/api/plugins/route.ts` `lib/plugin-updates.ts` `lib/api-types.ts` `components/PluginsConfig.tsx`

## 0 执行目标

将 pi-web 的插件包（package）管理能力移植到本项目的 Vue 实现：在能力中心新增「插件」Tab 提供已配置包的读取 安装 卸载 启用 禁用与更新检查。数据源是 Pi SDK 的 `SettingsManager` 与 `DefaultPackageManager` 与 pi CLI 共享 `~/.pi/agent` 的 packages 配置。

完成定义：

```text
打开能力中心 -> 插件 Tab
  -> 按 global project 作用域查看已配置包及其提供的资源统计
  -> 安装 npm Git 或本地路径来源的包
  -> 启用 禁用 卸载 检查更新 一键更新
  -> 包变更后得到需要重建会话的明确提示
```

## 1 产品决定与安全边界

### 解除 CC-6 的非目标

`11-capability-center.md` 曾将「不实现远程安装 更新和自动执行包管理器」列为非目标。本步骤经产品确认正式解除该边界，理由：

- 包管理的收益（复用 pi 生态包 获得扩展 技能 提示词 主题）远大于手动编辑 settings.json 的替代方案
- pi-web 已在生产路径上验证了同一 SDK 0.85.1 的 `DefaultPackageManager` 契约
- 风险可以通过显式交互与作用域信任约束收敛

### 保留的安全边界

- 安装与更新执行第三方代码 属于显式用户触发的操作 不做任何自动安装或后台定时检查
- project 作用域的安装 卸载 启停与更新要求项目已 trust 未信任返回 403
- `PI_OFFLINE=1` 时更新检查直接返回 error 不发起网络请求
- 读取路径（GET 与 resolve）只做静态解析与元数据读取 不执行包内代码
- 包变更不会即时影响运行中的会话 UI 明确提示需重建会话生效 不伪造即时生效

## 2 数据契约

共享类型在 `shared/lib/types.ts` 定义（与 pi-web `api-types.ts` 对齐）：

| 类型 | 语义 |
| --- | --- |
| `PluginScope` | `global` 或 `project` |
| `PluginResourceKind` / `PluginResourceCounts` | 扩展 技能 提示词 主题四类资源及计数 |
| `PluginDiagnostic` | 读取阶段的警告与错误 未安装 配置缺失等 |
| `PluginPackageInfo` | 单个包 source 作用域 状态 版本 资源清单 |
| `PluginsResponse` | packages totals diagnostics projectResourcesLoaded |
| `PluginUpdateState` / `PluginUpdateResult` | npm Git 更新检查结果 |

`status` 语义：`loaded` 已解析出资源 `installed` 已安装未解析出资源 `missing` 配置了但路径不存在 `disabled` 资源数组全空。

## 3 API 契约

| 接口 | 语义 |
| --- | --- |
| `GET /api/capabilities/plugins?cwd=` | 读取包列表 资源统计 诊断与信任状态 |
| `POST /api/capabilities/plugins` | body `{action, source?, scope?, cwd}` action 为 install remove update disable enable 返回变更后的 `PluginsResponse` |
| `POST /api/capabilities/plugins/check` | body `{cwd, source?, scope?}` 返回 `PluginUpdateResult[]` source 与 scope 必须成对出现 |

服务端实现分两个 util：`server/utils/plugins.ts` 负责读取聚合 `server/utils/plugin-updates.ts` 负责更新检查（npm 用 `npm view` + semver 对比 Git 用 `git ls-remote` 对比 commit）。

## 4 前端

- `app/stores/plugins.ts` 承载数据与动作 UI 只读 store
- `app/components/capabilities/PluginsPanel.vue` 主从布局 侧栏按作用域分组 详情面板承载启停 卸载 更新与资源清单 安装面板支持粘贴 `pi install xxx` 自动归一化
- 包状态色：loaded 绿 installed 黄 disabled 灰 missing 红；有更新时侧栏条目加 ↑ 指示

## 5 测试矩阵

| 层 | 必测项 |
| --- | --- |
| 纯函数 | npm source 解析 可检查性判定（固定版本 固定 ref 不可检查） 配置版本解析 |
| Store | load 成功与失败 动作失败不清空已有数据 错误透传 |
| 浏览器 | 空态 安装 启停 卸载 更新检查 未选项目时 project 禁用 |

## 6 进度

- [x] PP-1 服务端读取聚合与包管理 API
- [x] PP-2 更新检查
- [x] PP-3 插件 Tab UI 与 store
- [x] PP-4 测试与文档收口

## 7 执行记录

- 新增 `server/utils/plugins.ts` 与 `server/utils/plugin-updates.ts` 三个路由 plugins.get plugins.post plugins/check.post
- 共享类型落在 `shared/lib/types.ts` 的插件包管理一节 与 pi-web api-types 对齐
- `app/stores/plugins.ts` 承载数据与动作 cwd 由面板传入 store 不保存工作区状态
- `PluginsPanel.vue` 主从布局 project 作用域未信任时禁用并提示 安装面板归一化 `pi install` 粘贴
- 更新检查 npm 走 `npm view` 加 semver 对比 git 走远端 commit 对比 PI_OFFLINE=1 时拒绝
- 包变更后提示需重建会话生效 不伪造即时生效
- 测试 19 例 纯函数覆盖 source 解析 可检查性 range 取版本 全量测试 166 例通过
- 验收基线 `npm run typecheck` 通过 `npm test` 34 文件 166 用例通过 2026-09-13
