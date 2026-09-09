# Third Party Notices

本项目从 [pi-web](https://github.com/agegr/pi-web)（MIT License）移植了部分纯函数模块（统一放 `shared/lib/`，两端以 `#shared/lib/...` 引用；server 侧的移植文件见下表）。移植即「实质性复制」，MIT 要求随附版权与许可声明：每个移植文件头部已加来源注释，本文件收录衍生文件清单与许可原文。

## 衍生文件清单

| 本项目文件 | pi-web 来源 | 改动说明 |
|---|---|---|
| `shared/lib/types.ts` | `lib/types.ts` | 删除 CustomMessage、ExtensionUiRequest/Response、子代理与 worktree 相关类型 |
| `shared/lib/normalize.ts` | `lib/normalize.ts` | 逻辑原样 注释改写 |
| `shared/lib/agent-event-wire.ts` | `lib/agent-event-wire.ts` | 删除 pi SDK 类型依赖 手写最小事件结构 |
| `shared/lib/streaming-message.ts` | `lib/streaming-message.ts` | 原样 |
| `shared/lib/agent-event-connection.ts` | `lib/agent-event-connection.ts` | 原样 |
| `shared/lib/agent-client.ts` | `lib/agent-client.ts` | 原样 |
| `server/utils/session-reader.ts` | `lib/session-reader.ts`（readBoundedLines / readBoundedTailLines / buildSessionContext / sliceActiveBranch / getSessionSettings） | 去掉 defer 选项与图片惰性化 列表改为全量扫描加 30 秒缓存 |
| `server/utils/event-stream.ts` | `lib/agent-event-stream.ts` | 原样 输入改为标准 AbortSignal |
| `server/utils/rpc-manager.ts` | `lib/rpc-manager.ts` | 简化重写（约 2118 行 → 约 280 行）去扩展 UI/子代理/工具预设/模型作用域/推送通知 |

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
