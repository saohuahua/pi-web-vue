# 认识 pi SDK 与 Web 工作台

> 本篇是 [核心链路](00-从最小Agent到Web工作台.md) 的 SDK 补充。最小程序、流式输出和工具调用已经在主线讲过，这里继续解释会话、记录、上下文和资源怎样配合。

## 实现思路 先确定会话依赖 再创建执行对象

### 先确定需要保证什么

同一段历史恢复后，任务仍应在原目录运行，并利用已有记录继续推理。模型、认证、设置和资源又都可能与目录有关，所以不能先随意创建 Agent，再把历史文字塞进去就当作恢复完成。

### 三个设计决定

1. **以记录管理器确定新建还是恢复。** 新建时用选择的 cwd 创建记录，恢复时从原记录取得 cwd。这个顺序让目录成为后续依赖准备的输入，减少“消息恢复了但工具在另一目录执行”的错配。
2. **先准备 services，再创建 AgentSession。** 模型、认证、设置与资源属于运行依赖，SessionManager 属于记录依赖。项目将两者组合成运行会话，便于在初始化层处理配置锁等问题，而不把这些处理重复塞进每次 prompt。
3. **把操作入口与观察入口同时交给应用。** prompt 驱动执行，subscribe 暴露过程，abort 和 dispose 分别处理停止与释放。理解这些入口后，Web 层才能决定何时提交、何时展示、何时解除监听。

> 本篇的代码重点是依赖顺序与对象归属。工具循环的完整路径仍以首读核心篇为主。

## 一 从一次回答走向持续会话

最小示例创建会话、发送任务、等待完成，最后释放对象。现在用户想连续提问：

1. “阅读 README，告诉我启动方式。”
2. “第二条命令为什么要先执行？”

第二句话依赖前面的回答。应用需要保留会话上下文，而不是每次都创建一个没有历史的新对象。

### 两个对象分别做什么

| 对象 | 关注点 | 可以怎样理解 |
| --- | --- | --- |
| `AgentSession` | 执行 模型状态 事件和压缩 | 当前可操作的 Agent 会话 |
| `SessionManager` | 记录 历史位置与 cwd | 这段会话的记录管理器 |

- `session.prompt(text)` 提交下一次任务。
- `session.subscribe(listener)` 观察执行过程。
- `session.abort()` 请求停止。
- `session.dispose()` 释放运行对象。

> 取消订阅只解除一个观察者，不等于停止执行；释放对象和删除历史记录也不是同一操作。

## 二 怎样从内存示例扩展到保存历史

### 1 先只在内存保存

主线示例显式使用：

```ts
const sessionManager = SessionManager.inMemory(cwd);
```

它适合验证 SDK 用法。进程结束后，不能依靠这份内存记录恢复历史。

### 2 新建持久会话

需要保存会话时，使用：

```ts
const sessionManager = SessionManager.create(cwd);
```

SDK 负责后续记录写入。新建空会话并不保证文件已立即落盘，应用读取详情时还需要考虑存活的内存对象。

### 3 打开已有记录

恢复时使用：

```ts
const sessionManager = SessionManager.open(sessionFile);
const sessionCwd = sessionManager.getCwd();
```

这里先从记录取得 cwd，再准备执行环境。这样旧会话仍在原目录下工作，不会因为用户此刻选了另一项目就改读别处的 README。

## 三 本项目怎样创建 SDK 会话

实际接入把依赖准备拆开。下面是 `startRpcSession` 的源码节选，省略注册和异常清理：

```ts
const sessionManager = sessionFile
  ? SessionManager.open(sessionFile)
  : SessionManager.create(cwd!);

const sessionCwd = sessionManager.getCwd();
const agentDir = getAgentDir();
const settingsManager = SettingsManager.create(sessionCwd, agentDir);
const services = await createAgentServicesWithRetry({ cwd: sessionCwd, settingsManager });
const { session } = await createAgentSessionFromServices({ services, sessionManager });
```

按依赖顺序理解：

1. **记录**：创建新记录，或打开已有记录。
2. **目录**：取得这段会话自己的执行目录。
3. **设置**：从项目与 agent 配置位置准备运行设置。
4. **services**：准备模型、认证与资源相关服务。
5. **运行对象**：把 services 和记录管理器交给 SDK 工厂。

这里有两个来源不同的函数：

- `createAgentSessionFromServices` 是 SDK 接口。
- `createAgentServicesWithRetry` 是项目辅助函数，包装 SDK services 初始化，并处理特定配置锁竞争。

最小示例的 `createAgentSession()` 将相关步骤封装起来。项目显式拆开，便于根据历史目录恢复，并加入应用侧的复用和错误处理。

## 四 会话上下文里到底有什么

模型回答“第二条命令”时，需要拿到此前内容。上下文可能包含：

- 用户消息与助手回答。
- 模型提出的工具调用及工具结果。
- 系统指令和加载的相关资源。
- 长会话压缩后产生的摘要等信息。

以读文件为例：

```text
用户要求读 README
  → 工具调用记录
  → README 内容作为工具结果
  → 模型生成启动说明
  → 用户追问第二条命令
```

后一次模型请求利用已经取得的信息，不意味着 SDK 每次都重新扫描全部项目，也不意味着模型永久记住了本地文件。

### 为什么需要压缩

1. 对话和工具结果不断增加。
2. 模型一次请求可容纳的上下文有限。
3. SDK 用压缩机制重新组织后续模型输入。
4. Web 应用调用压缩并展示执行状态。

> 压缩改变后续模型输入的组织方式。网页能显示早期历史，不代表模型本次仍接收了全部原文。

本项目没有自行实现摘要算法。历史和上下文统计的区别见 [会话存储与上下文](08-会话存储与上下文.md)。

## 五 工具 技能 模板和扩展怎样区分

假设要完成代码审查任务：

| 资源 | 作用 | 例子 |
| --- | --- | --- |
| 工具 | 执行具体动作 | 读取文件 执行命令 修改内容 |
| Skill | 提供方法与约束 | 先检查接口 再分析异常路径 |
| 提示模板 | 组织用户输入 | 填入审查范围与关注点 |
| Extension | 通过代码扩展能力或参与流程 | 注册工具 监听或拦截特定事件 |
| 插件包 | 分发一组资源 | 同时包含技能 模板或扩展代码 |

一次任务可以先加载审查方法，再通过读取工具取得代码，由模型结合这些信息分析。

- 写一句“你可以读文件”不会自动产生读取实现。
- 加载 Skill 不等于注册了新工具。
- 安装插件包不等于所有存活会话已经重新加载它。

这些区别决定了能力中心为什么需要分别处理资源发现、信任、持久配置和运行生效。

## 六 方法 事件和状态如何配合

### 方法表达操作

- `prompt()`：提交任务。
- `abort()`：请求停止。
- 模型切换与压缩接口：改变运行条件或上下文组织。

### 事件表达变化

- 文本新增了一段。
- 工具开始或结束。
- 当前消息已经完成。

### 状态表达此刻的完整描述

- 已保存的历史有哪些消息。
- 正在生成的消息已经有哪些内容。
- 当前实例使用哪个模型。

可以用一个例子区分：

```text
状态原本是 启动方式：
收到事件 新增 npm run dev
状态变成 启动方式：npm run dev
```

刷新后的页面没经历前面的事件，仅收到最后一段就无法重建完整状态，所以 Web 层还需要历史查询和当前快照。

> SDK 提供执行能力与观察入口；HTTP、SSE、前端状态和重连对账由应用接起来。

## 七 SDK 能力怎样落到 Web 功能

1. 服务端保留 session ID 与 wrapper 的映射。
2. wrapper 持有 `AgentSession`，把 HTTP 命令转成 SDK 方法。
3. wrapper 订阅 SDK，再把事件交给 SSE 监听者。
4. 浏览器组装消息并展示。
5. 再把停止、模型切换、历史读取和资源管理接入对应入口。

SDK 的能力范围大于项目当前接入范围：

- 已接入提交、事件、工具展示、历史恢复和压缩等主线能力。
- 服务端存在部分历史导航入口，但前端分支流程还不完整。
- 项目未完成会话 fork，也没有完整 MCP 管理闭环。

## 八 读源码与检查理解

建议顺序：

1. [本地 SDK 文档](../../node_modules/@earendil-works/pi-coding-agent/docs/sdk.md)：查当前安装版本的调用方式。
2. [services 初始化](../../server/utils/agent-services.ts)：看项目增加的初始化处理。
3. [会话管理](../../server/utils/rpc-manager.ts)：看 SDK 对象如何被应用持有。
4. [历史读取](../../server/utils/session-reader.ts)：看记录怎样转为页面数据。

读完应能回答：

- 为什么运行会话和历史记录要分开理解？
- 为什么恢复时要从会话记录取得目录？
- Skill 和工具分别给 Agent 增加了什么？
- 为什么只订阅新事件无法恢复完整页面？

本文依据仓库固定的 SDK `0.85.1` 与当前源码，不表示已经执行真实模型或资源加载验收。返回 [目录](../README.md)。
