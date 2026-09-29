# C01 Nuxt 工程与 Nitro 服务端

这个仓库的 `package.json` 里只有一个 `nuxt dev` 脚本，却能同时跑起浏览器页面和 Node 接口；目录里既有 `app/` 又有 `server/`，还有个含义不明的 `shared/`。

本篇讲清：Nuxt 是什么，`app/` `server/` `shared/` 怎么分工，`server/api` 里的文件名为什么就是 URL，以及本项目为什么关闭 SSR。

## 实现思路 先分清框架边界 再理解本项目选择

### 先确定需要解释什么

Vue 本身只负责浏览器端。要跑一个接口，传统做法是另起一个 Node 服务，两个进程分开启动、分开部署。这个项目却只有一个启动命令，因为 Nuxt 把两端装进了同一个工程。先理解这个框架的边界，再看它给本项目带来了什么约定，最后才是「为什么这么选」。

### 三个设计决定

1. **Nuxt 是「一个工程、两个运行环境」的全栈框架。** 它把浏览器代码放在 `app/`，把服务端代码放在 `server/`，用同一个启动命令分别交给 Vite 和 Nitro 运行。这不是两个独立服务，而是一个框架管理两段代码。
2. **服务端用「文件即路由」，不写路由表。** Nitro 扫描 `server/api/` 下的文件，用文件路径和 HTTP 方法决定 URL。新增接口就是新增一个文件，不需要在某个 `router.ts` 里注册。
3. **共享代码放在 `shared/`，用 `#shared` 别名引用。** 浏览器和服务端都能 import 同一份类型和纯函数，但要理解：它不是第三个进程，代码在哪端被 import 就在哪端执行。

## 一 Nuxt 把什么装进了同一个工程

先看启动命令。`package.json` 里没有 `dev:client` 和 `dev:server` 两个脚本，只有一个：

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build"
  }
}
```

执行 `nuxt dev` 后发生两件事，对应两个引擎：

| 引擎 | 负责 | 本项目代码位置 |
| --- | --- | --- |
| Vite（经 Nuxt 包装） | 编译 Vue 组件、跑开发服务器、提供浏览器页面 | `app/` |
| Nitro | 把 `server/` 编译成 Node 服务、提供 HTTP 接口 | `server/` |

> 「一个工程」是开发体验和组织方式，不是运行时合并。浏览器代码在浏览器跑，服务端代码在 Node 跑，只是由 Nuxt 一起编译、一起启动。

本项目对这两个引擎做了明确配置，见 [nuxt.config.ts](../../../nuxt.config.ts)：

```ts
export default defineNuxtConfig({
  ssr: false, // 页面纯客户端渲染
  modules: ["@pinia/nuxt"],
  css: ["~/assets/css/main.css"],
  nitro: {
    externals: { external: ["@earendil-works/pi-coding-agent", /* ... */] },
  },
});
```

- `ssr: false` 关闭服务端渲染，页面由浏览器渲染。
- `modules` 挂 Pinia 的 Nuxt 集成。
- `nitro.externals` 让 Nitro 打包时跳过 pi SDK，运行时从 `node_modules` 原样加载。

`nitro.externals` 这条最容易误解，留到 [C02 后端分层](C02-请求处理与后端分层.md) 讲 pi SDK 时再展开。

## 二 三个目录怎么分工

### 1 `app/` 浏览器端

Vue 页面、组件、状态和浏览器工具都在这里。Nuxt 4 约定把这个目录当作前端根目录。

```text
app/
  pages/          路由页面，文件名即页面 URL
  components/     组件，按文件名自动注册
  stores/         Pinia 状态
  composables/    依赖 Vue 生命周期的逻辑
  utils/          浏览器端解析与格式化
  assets/css/     样式
```

两个关键约定：

- **`pages/` 文件即页面路由**：`pages/index.vue` 对应 `/`，`pages/session/[id].vue` 对应 `/session/123`（`[id]` 是动态段）。
- **`components/` 自动注册**：组件按文件名在模板中直接使用，无需手动 import。本项目 [app.vue](../../../app/app.vue) 里 `<SessionSidebar />` 能直接用，就是这个机制。

> 本项目没有用 `components/` 的自动注册做异步拆分，而是显式 `defineAsyncComponent` 拆包，原因见 [02 工程结构](../02-工程结构与前端组织.md#六-前端实现亮点-延迟挂载与职责拆分)。

### 2 `server/` 服务端

Node 端代码，只在服务端进程运行。

```text
server/
  api/            文件即路由的 HTTP 接口
  utils/          业务逻辑，供 api 调用
  plugins/        服务端生命周期插件
```

`api/` 是网络入口，`utils/` 是业务实现，`plugins/` 挂进程级钩子。这个分层在 [C02](C02-请求处理与后端分层.md) 详细展开。

### 3 `shared/` 共享代码

类型定义和纯函数，浏览器和服务端都能 import。

```text
shared/
  lib/
    types.ts            会话、消息、配置的类型
    agent-event-wire.ts 事件裁剪
    streaming-message.ts 消息组装 reducer
```

[types.ts](../../../shared/lib/types.ts) 是共享层的核心类型定义，[agent-event-wire.ts](../../../shared/lib/agent-event-wire.ts) 和 [streaming-message.ts](../../../shared/lib/streaming-message.ts) 是前后端都要用的纯函数。

`shared` 只是代码归属，不是第三个运行环境。一份代码被浏览器 import 就在浏览器跑，被服务端 import 就在 Node 跑。

> 本项目规定：`shared/lib` 里的纯函数**不允许 import pi 包**。这样它们才能被打进浏览器产物而不把整个 SDK 拖进前端，这是「共享」的前提。

## 三 别名 `~` `#shared` 是什么

Nuxt 生成了一批路径别名，省去手写相对路径。本项目最常用的三个：

| 别名 | 指向 | 用途 |
| --- | --- | --- |
| `~` 或 `@` | `app/` | 前端内部引用，如 `~/components/...` |
| `#shared` | `shared/` | 前后端共用，如 `#shared/lib/types` |
| `#server` | `server/` | 服务端引用（本项目用得少） |

实际代码里的用法：

```ts
// 前端 app.vue
import SessionSidebar from "~/components/SessionSidebar.vue";

// 服务端 server/utils/event-stream.ts
import { toClientAgentEvent } from "#shared/lib/agent-event-wire";
```

> `~` 和 `@` 指向 `app/`，不是项目根。要引用项目根下的文件（如 `nuxt.config.ts`）才需要 `~~` 或 `@@`。本项目前端代码一律写 `~/`，服务端代码引用共享代码一律写 `#shared/`，看到前缀就能判断代码属于哪端。

## 四 文件即路由 文件名就是 URL

服务端不用写路由表。`server/api/` 下的文件路径加上方法后缀，就是接口地址。

| 文件名 | URL | 方法 |
| --- | --- | --- |
| `server/api/health.get.ts` | `GET /api/health` | GET |
| `server/api/sessions/index.post.ts` | `POST /api/sessions` | POST |
| `server/api/agent/[id]/index.post.ts` | `POST /api/agent/:id` | POST，动态段 |
| `server/api/files/[...path].get.ts` | `GET /api/files/任意/多段` | GET，通配段 |

规则只有两条：

1. **方法后缀** `.get.ts` `.post.ts` `.patch.ts` `.put.ts` 决定响应哪个 HTTP 方法。
2. **方括号是动态段**：`[id]` 匹配单段，`[...path]` 匹配剩余全部段。

每个文件默认导出一个 `defineEventHandler` 函数，Nitro 调用它处理请求。这是唯一的「路由注册」——写在文件名里，而不是集中在一个配置里。

> 目录 `/api/` 前缀自动成为 URL 的 `/api/`。所以文件在 `server/api/` 下，URL 就以 `/api/` 开头。完整路由清单见 [server/api/README.md](../../../server/api/README.md)。

动态段的取值，在 handler 里用 `getRouterParam` 读：

```ts
export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id")!;
  // ...
});
```

## 五 为什么关闭 SSR

`nuxt.config.ts` 里有一条带注释的配置：

```ts
// 聊天 SPA 无 SEO 与首屏需求 pi-web 同为纯 CSR
// 开着 SSR 只会引入 EventSource 与 localStorage 的水合麻烦 零收益
ssr: false,
```

拆开理解：

| 问题 | 解释 |
| --- | --- |
| 什么是 SSR | 服务端把 Vue 组件渲染成 HTML 返回，浏览器先看到内容再接管交互 |
| 本项目为什么不需要 | 应用是登录后才有的工作台，没有搜索引擎收录和首屏秒开需求 |
| 开着会怎样 | 服务端渲染会执行组件代码，而组件依赖 `localStorage`、`EventSource` 这些只在浏览器存在的对象，服务端执行会报错，需要额外做「两端都能跑」的兼容 |

> 关闭 SSR 只影响**页面渲染位置**。`server/api/` 里的接口照常工作——那是 Nitro 提供的 HTTP 服务，和页面渲染是两回事。很多人把「SSR 关了」误解成「服务端没了」，这是最需要纠正的一点。

所以「纯 CSR」和「Node 服务端」并存：页面由浏览器渲染，SDK 由 Node 执行，两者通过 HTTP 接口通信。

## 六 没有数据库 对话存在哪里

这个项目**没有数据库**。会话、模型配置、信任决定都是本地文件，统一放在 `~/.pi/agent/` 下。

对话保存在 JSONL 文件里，位置：

```text
~/.pi/agent/sessions/--<cwd 编码>--/<时间戳>_<uuid>.jsonl
```

- `<cwd 编码>` 是会话执行目录，路径里的 `/` 和 `:` 换成 `-`。例如 `D:\project\go` 对应目录 `--D--project-go--`。
- 文件名带时间戳和 uuid，是 SDK 落盘时生成的。

JSONL 是「每行一个独立 JSON 对象」的文本格式。真实会话文件的第一行：

```json
{"type":"session","version":3,"id":"01a03265...","timestamp":"2026-08-24T06:12:01.233Z","cwd":"C:\\Users\\htlocal"}
```

第一行是 header，记录会话身份和执行目录；后面每行是一个 entry，`type` 区分内容：

| entry 类型 | 含义 |
| --- | --- |
| `message` | 一条消息（用户 / 助手 / 工具结果） |
| `model_change` | 模型切换记录 |
| `thinking_level_change` | 思考等级切换 |
| `compaction` | 上下文压缩产生的摘要 |
| `session_info` | 会话改名等元信息 |

> 每条 entry 带 `id` 和 `parentId`，构成一棵树。编辑旧消息重发，就是在树上加一个新分支，而不是覆盖原记录——这就是「会话分支」的存储基础。

和传统理解的差异在三处：

**1. 追加写，不修改、不删除。** 传统数据库里「改名」是 UPDATE 一行、「删消息」是 DELETE 一行。这里只往文件末尾加行，已写过的内容永不变动。所以会话改名是追加一条 `session_info` 到文件末尾，而不是回头改 header。

**2. 会话是一棵树，不是一条消息列表。** 传统理解里，一次会话就是一个按时间排序的消息数组。这里每个 entry 用 `parentId` 指向它的前一条，构成树：

```text
e1 用户任务
  └─ e2 助手回答
       ├─ e3 追问 A
       └─ e4 追问 B  ← 当前叶节点
```

**3. 读历史 = 从叶节点回溯。** 打开会话时先确定「当前叶节点」，再沿 `parentId` 向上回溯，反转得到根到叶的链。这条链才是页面显示的历史——文件里旁支的记录（比如 e3）不在链上，就不显示。

编辑第 3 条消息重发，是追加一条 `parentId` 指向 e2 的新消息，原 e3 及其后续仍留在文件里，只是不再是活跃分支。

为什么不用数据库：

| 考虑 | 结果 |
| --- | --- |
| 只有单个用户在本机使用 | 不需要多用户并发和事务 |
| 会话是追加写入的日志 | JSONL 天然适合，改记录就是加一行 |
| 要和 pi CLI / pi-web 互通 | 三方读同一份文件，比各自连数据库简单 |

> 「没有数据库」不代表「数据会丢」。文件持久化后，进程重启也能读回历史。区别在于：内存里的运行状态（正在生成的消息）随进程消失，文件里的已落盘记录不会。

JSONL 的结构和上下文构建细节见 [08 会话存储与上下文](../08-会话存储与上下文.md)。

## 七 读一张接口清单验证理解

有了以上概念，再看 `server/api/README.md` 的路由清单，每个条目都能对上：

- `GET /api/sessions` → `server/api/sessions/index.get.ts`（列表）
- `GET /api/agent/:id/events` → `server/api/agent/[id]/events.get.ts`（SSE 事件流）
- `GET /api/files/*` → `server/api/files/[...path].get.ts`（文件读取）

> 本项目的 `events.get.ts` 返回的是 `text/event-stream` 流，`files/[...path].get.ts` 还能返回二进制图片。Nitro 的 handler 不限于返回 JSON 对象，[C02](C02-请求处理与后端分层.md) 会讲这两种特殊响应。

## 下一篇

- [C02 请求处理与后端分层](C02-请求处理与后端分层.md)
- [后端基础目录](README.md)
