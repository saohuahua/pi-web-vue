# Third Party Notices

本项目从 [pi-web](https://github.com/agegr/pi-web)（MIT License）移植了部分纯函数模块（统一放 `shared/lib/`，两端以 `#shared/lib/...` 引用；server 侧的移植文件见下表）。移植即「实质性复制」，MIT 要求随附版权与许可声明：每个移植文件头部已加来源注释，本文件收录衍生文件清单与许可原文。

## 衍生文件清单

| 本项目文件 | pi-web 来源 | 改动说明 |
|---|---|---|
| `shared/lib/types.ts` | `lib/types.ts` | 删除 CustomMessage、ExtensionUiRequest/Response、子代理与 worktree 相关类型 新增 SessionStatsInfo 与 SessionContext.stats |
| `shared/lib/normalize.ts` | `lib/normalize.ts` | 逻辑原样 注释改写 |
| `shared/lib/agent-event-wire.ts` | `lib/agent-event-wire.ts` | 删除 pi SDK 类型依赖 手写最小事件结构 |
| `shared/lib/streaming-message.ts` | `lib/streaming-message.ts` | 原样 |
| `shared/lib/agent-event-connection.ts` | `lib/agent-event-connection.ts` | 原样 |
| `shared/lib/agent-client.ts` | `lib/agent-client.ts` | 原样 |
| `shared/lib/image-attachments.ts` | `lib/image-attachments.ts` | 原样 注释改写 |
| `shared/lib/session-stats.ts` | `lib/session-stats.ts` | 只保留 computeSessionStats 省略为惰性加载准备的 mergeSessionStats 与 computeMessageStats 未移植 branch_summary 分支 本项目 SessionEntry 无该类型 |
| `shared/lib/file-paths.ts` | `lib/file-paths.ts` | 精简掉 upload 与 watch 相关辅助 |
| `server/utils/path-security.ts` | `lib/path-security.ts` 与 `lib/paths.ts` 的 isWindowsAbsolutePath | 原样 注释改写 |
| `server/utils/session-title.ts` | `lib/session-title.ts` | generateSessionTitle 改为直接接收 Agent 类型 跳过 AgentSession 包装 |
| `server/utils/models-cache.ts` | `lib/models-cache.ts` | 简化为模块级缓存 无 generation 对账 |
| `server/utils/skill-frontmatter.ts` | `lib/skill-frontmatter.ts` | 原样 BOM 字面量改用 charCode 判断 |
| `app/utils/image-compress.ts` | `components/ChatInput.tsx` 的压缩部分 | 抽取为独立纯函数模块 |
| `app/utils/at-query.ts` | `lib/file-fuzzy.ts` | 原样 注释改写 |
| `server/utils/session-reader.ts` | `lib/session-reader.ts`（readBoundedLines / readBoundedTailLines / buildSessionContext / sliceActiveBranch / getSessionSettings） | 去掉 defer 选项与图片惰性化 列表改为全量扫描加 30 秒缓存 buildSessionContext 增加文件累计统计 |
| `server/utils/event-stream.ts` | `lib/agent-event-stream.ts` | 原样 输入改为标准 AbortSignal |
| `server/utils/rpc-manager.ts` | `lib/rpc-manager.ts` | 简化重写（约 2118 行 → 约 280 行）去扩展 UI/子代理/工具预设/模型作用域/推送通知 |
| `server/utils/model-scope.ts` | `lib/model-scope.ts` | 只移植 resolveVisibleModels 未移植 selectInitialModelScope 本项目会话启动不经由模型选择 |
| `server/utils/atomic-file.ts` | `lib/atomic-file.ts` | 原样 注释改写 |
| `server/utils/models-config-store.ts` | `lib/models-config-store.ts` | 原样 类型改用 shared/lib/types 的 ModelsConfigFile 注释改写 |
| `server/api/models-config/test.post.ts` | `app/api/models-config/test/route.ts` | Next 路由改写为 Nitro handler 校验与错误文案本地化 |
| `server/utils/plugin-updates.ts` | `lib/plugin-updates.ts` | 逻辑原样 函数改 const 箭头 注释改写 信任状态改用本项目 readTrustDecision |
| `server/utils/plugins.ts` | `app/api/plugins/route.ts` 的读取聚合与动作逻辑 | Next 路由拆为 util 层 class PluginActionError 承载状态码 函数改 const 箭头 注释改写 |
| `server/api/capabilities/plugins/check.post.ts` | `app/api/plugins/check/route.ts` | Next 路由改写为 Nitro handler |
| `app/components/capabilities/PluginsPanel.vue` | `components/PluginsConfig.tsx` 的交互模型 | React 改写为 Vue SFC 复用本项目 cap-* 样式与 Pi 原语 |

## MIT License（pi-web）

```text
MIT License

Copyright (c) 2026 agegr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
