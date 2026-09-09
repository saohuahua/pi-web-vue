# pi-web-vue

用 Vue 3（Nuxt 4）从零实现的 [pi coding agent](https://github.com/earendil-works/pi) 浏览器客户端：创建/恢复 agent 会话、发送消息、SSE 流式渲染回复、工具调用可视化、会话分支。

后端直接调用 pi 官方 SDK（`@earendil-works/pi-coding-agent`），与 pi CLI / pi-web 共享同一套 `~/.pi/agent` 配置和会话文件——在任一端创建的会话，其他端都能看到。

## 参考

本项目参考了 [pi-web](https://github.com/agegr/pi-web)（MIT License）与 [pi](https://github.com/earendil-works/pi) 的实现，移植的纯函数模块清单见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## 开发

```bash
npm install
npm run dev        # http://127.0.0.1:3000
```

环境要求：

- Node.js ≥ 22.19（pi SDK 的硬性要求）
- `~/.pi/agent` 已配置至少一个模型提供商（跑一次 pi CLI 或用 pi-web 的 Models 面板配置）

## 安全边界

本项目 API 无鉴权 且 Agent 可执行任意命令 **仅限本机使用**（Nuxt dev 默认只绑 127.0.0.1），对外展示用录屏，不要暴露到内网穿透或公网。
