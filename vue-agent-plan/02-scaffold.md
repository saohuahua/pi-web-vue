# 02 · Step 0：项目脚手架（Nuxt 4）

> 目标：一个能跑起来的 Nuxt 4 空壳——两栏布局、健康检查接口、**pi SDK 冒烟验证**（全项目唯一的技术风险点，在这一步就排除）。
> 本步骤不写任何业务逻辑。

## 1. 初始化

```bash
npm create nuxt@latest pi-agent-vue
cd pi-agent-vue
```

初始化问到的官方模块（UI 库等）**一个都不要**，样式自己写。装完确认 `package.json` 里 `nuxt` 是 **4.x**（`@latest` 将来可能装出别的版本，不对就手动锁定），并提交 lockfile 保证可复现。建议建在 `D:\project\pi-agent-vue`（与 pi-web 平级，方便对照）。

## 2. 目录结构（最终形态，一次建好骨架）

```
pi-agent-vue/
├── nuxt.config.ts               # 本步骤核心配置
├── package.json
├── THIRD_PARTY_NOTICES.md       # 移植代码的第三方声明（Step 1 起维护，见 03 第 1 节）
├── server/
│   ├── api/
│   │   ├── health.get.ts        # Step 0 健康检查
│   │   ├── sdk-check.get.ts     # Step 0 pi SDK 冒烟验证（最重要）
│   │   ├── sessions/
│   │   │   ├── index.get.ts     # Step 1 列表
│   │   │   ├── index.post.ts    # Step 1 创建空会话
│   │   │   └── [id].get.ts      # Step 1 详情
│   │   └── agent/
│   │       ├── running.get.ts   # Step 1 运行中会话
│   │       └── [id]/
│   │           ├── index.get.ts   # Step 1 运行状态
│   │           ├── index.post.ts  # Step 1 命令分发
│   │           └── events.get.ts  # Step 1 SSE
│   ├── utils/                   # Nitro 会自动 import 此目录，但文档统一写显式 import
│   │   ├── rpc-manager.ts       # Step 1
│   │   ├── event-stream.ts      # Step 1
│   │   └── session-reader.ts    # Step 1
│   └── plugins/
│       └── cleanup.ts           # Step 1（进程退出销毁 wrapper）
├── shared/
│   └── lib/                     # Nuxt 4 官方共享目录，#shared/lib/... 引用
│       ├── types.ts             # Step 1 起
│       ├── normalize.ts
│       ├── agent-event-wire.ts
│       ├── agent-event-connection.ts
│       ├── streaming-message.ts
│       └── agent-client.ts
└── app/
    ├── app.vue                  # 两栏布局壳
    ├── assets/css/main.css      # 全局样式（含 .markdown-body）
    ├── pages/
    │   ├── index.vue            # 新会话页
    │   └── session/[id].vue     # 会话页（Step 2）
    ├── components/
    │   ├── SessionSidebar.vue   # Step 2
    │   ├── ChatPanel.vue        # Step 2
    │   ├── MessageItem.vue      # Step 2
    │   ├── ChatComposer.vue     # Step 2
    │   ├── ThinkingBlock.vue    # Step 3
    │   ├── ToolCallCard.vue     # Step 3
    │   └── BranchNavigator.vue  # Step 4
    ├── stores/
    │   ├── sessions.ts          # Step 2
    │   └── chat.ts              # Step 2
    ├── composables/
    │   └── useAutoScroll.ts     # Step 2
    └── utils/
        └── markdown.ts          # Step 2（renderMarkdown）
```

约定：

- `shared/lib/` 里的模块**不得 import 任何 Nuxt/Vue/Node 专属 API**——它是两端共用的前提（类型、纯函数、浏览器/Node 通用的类）。
- server 代码里引共享层用 `#shared/lib/xxx`；app 代码里同样 `#shared/lib/xxx`。
- Nuxt 自动 import（components、composables、`server/utils`）都开着——文档为了可读统一写显式 import，两种都合法。

## 3. nuxt.config.ts（本步骤最重要的文件）

```ts
export default defineNuxtConfig({
  ssr: false,                        // 聊天 SPA，无 SSR 需求（pi-web 同为纯 CSR）
  modules: ["@pinia/nuxt"],
  css: ["~/assets/css/main.css"],
  nitro: {
    // pi SDK 是纯 Node ESM + 内嵌 WASM 的重包，必须排除出 Nitro 打包、
    // 运行时从 node_modules 原样加载。等价于 pi-web next.config.ts 的
    // serverExternalPackages（参考 D:\project\pi-web\next.config.ts 第 16–24 行）。
    externals: {
      external: [
        "@earendil-works/pi-coding-agent",
        "@earendil-works/pi-agent-core",
        "@earendil-works/pi-ai",
        "@earendil-works/pi-tui",
        "undici",
      ],
    },
  },
  devtools: { enabled: false },
  compatibilityDate: "2026-09-01",
});
```

## 4. package.json

```json
{
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.19.0" },
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "typecheck": "nuxt typecheck"
  }
}
```

dependencies：

- `nuxt` ^4、`@pinia/nuxt` + `pinia`
- **四个 pi 包锁定 0.85.1**（`@earendil-works/pi-coding-agent`、`pi-agent-core`、`pi-ai`、`pi-tui`——必须同版本混搭）
- `markdown-it`、`highlight.js`

devDependencies：`@types/markdown-it`、`@types/node`、`typescript`、`vue-tsc`。

**不要装**：任何 HTTP 框架（Nitro 就是服务器）、vite/tsx/concurrently（Nuxt 自带）、UI 组件库。

> pi 包只允许出现在 `server/` 的 import 里。**`app/` 和 `shared/` 一行 pi import 都不能有**——打进浏览器产物会直接报错。

## 5. 本步骤的三个文件

`server/api/health.get.ts`：

```ts
export default defineEventHandler(() => ({ ok: true, uptime: process.uptime() }));
```

`server/api/sdk-check.get.ts` —— **整个项目最高风险点的提前验证**：

```ts
import { createAgentSessionServices, getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent";

// ?cwd=<一个真实目录>。验证 pi SDK 能在 Nitro 服务端正常加载与初始化。
export default defineEventHandler(async (event) => {
  const cwd = getQuery(event).cwd as string | undefined;
  if (!cwd) {
    setResponseStatus(event, 400);
    return { error: "cwd query param required" };
  }
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const services = await createAgentSessionServices({ cwd, agentDir, settingsManager });
  return { ok: true, agentDir };
});
```

`app/app.vue`：

```vue
<script setup lang="ts">
// Sidebar 布局壳：左 280px 固定，右侧自适应
</script>

<template>
  <div class="layout">
    <SessionSidebar />
    <main class="main"><NuxtPage /></main>
  </div>
</template>
```

`app/assets/css/main.css` 写两栏 flex 布局 + 基础 reset，**样式别超过 30 分钟**，Step 2 再调。`app/pages/index.vue` 先放个「新会话」占位页。

项目 README.md 写上：本项目参考了 [pi-web](https://github.com/agegr/pi-web)（MIT）与 [pi](https://github.com/earendil-works/pi) 的实现。

## 6. 验收（2 分钟冒烟）

> 以下 curl 在 **Git Bash** 执行（Windows 上 PowerShell 的 `curl` 是 `Invoke-WebRequest` 的别名，语法不通用；后续文档同此约定）。

1. `npm run dev` 起在 `http://127.0.0.1:3000`，页面显示两栏布局；`curl http://127.0.0.1:3000/api/health` → `{"ok":true}`。
2. **`curl "http://127.0.0.1:3000/api/sdk-check?cwd=D:/project/pi-web"` → `{"ok":true,...}`** —— 全项目唯一的技术风险门禁，通过即排除。
   - 失败排查：报错含 `wasm` / `photon` / `Cannot find module` → 检查 `externals.external` 包名拼写；仍不行换 `"@earendil-works/*"` 通配再试（pi-web 在 Next 里也必须做同样排除，这是 pi SDK 的打包特征决定的，不是 Nuxt 的问题）。
3. 顺手：`npm run typecheck` 通过 → `git init` 提交骨架。

通过后回到 [README](./README.md) 勾选 Step 0。
