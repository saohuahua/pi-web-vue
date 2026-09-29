# server/api 路由说明

本目录是后端的 HTTP 入口层。它是**薄转发层**：只做「接住请求 → 校验参数 → 转给 `server/utils` 或 SDK → 返回结果」，真正的业务逻辑在 `server/utils/rpc-manager.ts` 等文件里。

## 一 文件即路由的约定（Nitro）

文件名决定 URL，无需手动注册路由：

| 文件名 | 对应 URL | 说明 |
| --- | --- | --- |
| `foo.get.ts` | `GET /api/foo` | `.get` 表示只响应 GET |
| `foo.post.ts` | `POST /api/foo` | `.post` 表示只响应 POST |
| `[id].get.ts` | `GET /api/xxx/:id` | `[id]` 是动态参数，用 `getRouterParam(event, "id")` 取出 |
| `[...path].get.ts` | `GET /api/xxx/任意/多段` | `[...path]` 通配剩余路径 |

每个文件导出 `defineEventHandler` 函数，Nitro 调用它处理请求。几个常用工具函数：

- `readBody(event)` —— 解析请求体 JSON（POST/PUT/PATCH 用）
- `getQuery(event)` —— 取 URL 查询参数（`?a=1`）
- `getRouterParam(event, "id")` —— 取动态路径参数
- `setResponseStatus(event, 400)` —— 设置 HTTP 状态码
- 返回对象 `{ error: "..." }` —— 前端 `agent-client` 按这个结构解析错误

## 二 路由清单

### 会话

| 路由 | 职责 |
| --- | --- |
| `GET /api/sessions` | 会话列表（支持 `?force=1` 跳过缓存） |
| `POST /api/sessions` | 创建空会话，返回真实 sessionId |
| `GET /api/sessions/:id` | 会话详情与运行状态 |
| `PATCH /api/sessions/:id` | 重命名会话 |
| `GET /api/sessions/:id/context` | 只读读取指定分支的上下文（不切换服务端活跃分支） |
| `POST /api/sessions/:id/auto-name` | 用模型自动生成会话标题 |

### Agent 命令与事件（核心）

| 路由 | 职责 |
| --- | --- |
| `POST /api/agent/:id` | **命令分发**。body 的 `type` 字段决定命令，转给 `rpc-manager` 的 `send()` |
| `GET /api/agent/:id` | 单会话运行状态 |
| `GET /api/agent/:id/events` | **SSE 事件流**，持续推送文本/工具/结束事件 |
| `GET /api/agent/running` | 所有运行中会话 id 列表，前端刷新时用于恢复 SSE |

### 文件与目录

| 路由 | 职责 |
| --- | --- |
| `POST /api/cwd/validate` | 校验工作区目录，返回项目身份，并授权进文件浏览范围 |
| `GET /api/cwd/browse` | 浏览本机目录（Windows 下先选盘符） |
| `GET /api/file-index` | 文件索引，供 @ 补全与搜索（git 用 ls-files，否则遍历） |
| `GET /api/files/*` | 文件读取或目录列表（`?type=read\|list`），经过路径安全校验 |

### 模型与配置

| 路由 | 职责 |
| --- | --- |
| `GET /api/models` | 可用模型列表 |
| `GET /api/models-config` | 读取 `~/.pi/agent/models.json` |
| `PUT /api/models-config` | 写回模型配置 |
| `POST /api/models-config/test` | 测试某个模型配置可用性 |
| `PATCH /api/capabilities/models/default` | 写默认模型 |

### 技能 / 扩展 / 插件 / 信任

| 路由 | 职责 |
| --- | --- |
| `GET /api/skills` | 技能列表 |
| `PATCH /api/skills` | 切换技能 `disable-model-invocation` 开关 |
| `GET /api/capabilities/extensions` | 扩展列表（静态扫描，不执行项目代码） |
| `GET /api/capabilities/plugins` | 插件包列表 |
| `POST /api/capabilities/plugins` | 插件安装/移除/更新/禁用/启用 |
| `POST /api/capabilities/plugins/check` | 检查插件更新 |
| `PATCH /api/capabilities/project-trust` | 设置项目信任（写入 trust.json） |

### 其他

| 路由 | 职责 |
| --- | --- |
| `GET /api/health` | 健康检查，返回 uptime |
| `GET /api/sdk-check` | 验证 pi SDK 在服务端能否正常加载（脚手架期排障用） |
| `GET /api/worktrees` | 项目下的 worktree 列表 |

## 三 一条请求的路径

```
浏览器 fetch('/api/agent/123', { body: {type:'prompt', message:'...'} })
   → server/api/agent/[id]/index.post.ts   （薄转发）
   → server/utils/rpc-manager.ts 的 send()  （switch 分发命令）
   → SDK AgentSession                      （真正执行）
```

> 命令走 `POST /api/agent/:id`，结果走 `GET /api/agent/:id/events`（SSE）。两条通道各自独立，详细机制见 `docs/learning/05-HTTP与SSE协议.md`。
