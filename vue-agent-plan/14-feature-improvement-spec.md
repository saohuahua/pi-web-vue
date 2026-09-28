# π agent 功能改进实施规格

## 0 文档状态

| 项目 | 内容 |
| --- | --- |
| 状态 | 分支 草稿 恢复与运行中队列已实现 自动测试通过 真实模型验收受凭证缺失限制 |
| 当前阶段 | 等待配置模型凭证后完成真实分支与队列手工验收 |
| 本次交付 | 服务端会话树与上下文接口 Vue 分支交互 文字草稿和运行中队列 |
| 视觉改造 | 仅增加功能所需控件 遵循现有设计系统 |
| 当前基线 | 现有项目代码、`PRODUCT.md`、`DESIGN.md`、`vue-agent-plan/06-history-branching.md` 和 `10-feature-candidates-research.md` |

本文件记录原始第一阶段规格与实施结果。运行中指令队列作为用户确认的第二阶段实施 具体结果见文末实施记录。

## 1 已确认的产品取舍

### 1.1 目标比例

- 作品集与面试表达占 60%
- 日常使用效率占 40%

这意味着功能必须真实可用，同时要能清楚说明状态模型、时序设计、持久化边界和失败恢复。只做表面演示、不能和 `.jsonl` 真实数据互操作的功能不进入本阶段。

### 1.2 第一阶段功能范围

第一阶段包含三个相互关联的能力：

1. 会话内分支
2. 每会话草稿恢复
3. 请求、SSE 和分支切换失败恢复

三项必须作为一个闭环验收。单独完成分支而不保留用户输入，会让实际使用在失败路径上丢数据；只做草稿恢复而不处理分支切换回滚，则会留下前端上下文与服务端活跃分支不一致的问题。

### 1.3 明确不进入第一阶段的内容

- fork 新会话
- 会话删除
- 完整多层历史树界面
- HTML 会话导出
- 运行中 `steer`
- 运行中 `follow_up`
- 队列清空和追加指令状态机
- 终端面板
- MCP Bridge
- Git 写操作、暂存、提交和分支创建
- 文件实时 watcher

第一阶段运行中禁止编辑历史和切换分支。第二阶段允许显式选择纠偏或后续任务 但分支动作仍只发生在稳定状态。

## 2 当前代码事实

### 2.1 已经存在的能力

- `app/stores/chat.ts` 已持有 `messages`、与消息平行的 `entryIds`、当前草稿、SSE 流状态和 `isRunning`
- `server/utils/session-reader.ts` 已提供 `sliceActiveBranch` 和 `buildSessionContext`
- 原详情接口只读取当前活跃叶子 实施时新增独立的只读 `context` 接口读取指定叶子
- `server/utils/rpc-manager.ts` 已处理 `navigate_tree`，但 `fork` 仍明确抛出未实现错误
- `ChatPanel.vue` 已把 `entryIds[i]` 传给消息组件
- `ChatComposer.vue` 已在发送失败时把文本放回输入框，但草稿仍主要是组件和 store 当前实例中的内存状态
- 当前测试已有 `session-reader`、`chat` 和 `rpc-manager` 覆盖，可在原有测试结构上扩展

### 2.2 关键约束

1. `entryId` 是分支操作的唯一定位依据，不能使用消息数组下标或消息文本
2. `messages[i]` 与 `entryIds[i]` 必须始终保持平行
3. 会话首条消息前可能还没有落盘 `.jsonl`，首轮创建的内存态行为不能被分支功能破坏
4. SSE 事件可能晚于 HTTP 响应到达，前端不能把 HTTP 返回顺序当成完整运行结束信号
5. `navigate_tree` 失败时必须回滚前端分支状态和消息上下文
6. 深会话树遍历必须使用循环或显式栈，禁止递归遍历整个树
7. 项目 worktree 和会话内分支是两套独立模型，不能把 `activeLeafId` 放入 workspace store

## 3 目标行为

### 3.1 编辑历史消息

用户在已经完成的历史用户消息上选择编辑：

1. 输入框加载该消息的纯文本内容
2. 系统定位该消息的前一个 entry
3. 用户可以修改文本，但此时不会自动发送
4. 用户点击发送后，先切换到前一个 entry
5. 切换成功后再发送新的 prompt
6. 新 prompt 成为原消息的兄弟分支
7. 原分支内容保持不变

第一条用户消息没有前置 assistant entry，暂不支持编辑。编辑按钮应禁用并提供可访问说明，而不是点击后静默失败。

### 3.2 分支切换

当会话树存在分叉时，消息区顶部显示一个分支入口。入口只展示当前会话实际存在的分支，不显示虚构数量。

分支列表每行至少包含：

- 分支首条用户消息的截断预览
- 分支叶子 entryId 的内部绑定值
- 当前分支标记
- 分支切换中状态
- 失败后的恢复提示

分支列表不做完整递归树展示。第一阶段只抽取顶层可比较分支，降低认知负担和实现风险。

### 3.3 草稿恢复

草稿需要覆盖以下场景：

- 切换当前会话后返回原会话，文字草稿仍在
- 创建新会话后首条消息发送失败，输入仍可重试
- SSE 握手失败，输入不丢失
- prompt HTTP 请求失败，输入不丢失
- 分支切换失败，正在编辑的文本和当前分支都保持可恢复
- 浏览器刷新时，纯文字草稿可以恢复；图片不持久化到 localStorage

草稿以会话 id 为稳定键。当前产品先创建会话 id 再显示 Composer 因此不需要临时键和 rekey。

### 3.4 失败恢复

所有失败恢复都必须同时满足：

- 保留用户输入
- 恢复前端可继续操作状态
- 明确说明失败发生在哪一步
- 不把半成功的消息或分支误标为已完成
- 不覆盖服务端原有分支

错误提示至少区分：

| 阶段 | 用户可见信息 | 恢复动作 |
| --- | --- | --- |
| 上下文预览失败 | 无法加载目标分支 | 回到原分支 |
| `navigate_tree` 失败 | 分支切换未完成 | 恢复原分支并重试 |
| SSE 握手失败 | 尚未连接到当前会话 | 保留草稿并重试 |
| prompt 提交失败 | 请求未提交 | 保留草稿并重试 |
| 流式过程中断 | 输出连接中断 | 保留已显示内容，重新加载会话 |
| 重新加载失败 | 当前会话状态未确认 | 保留本地草稿，提供刷新动作 |

## 4 状态模型

### 4.1 Chat store 新增状态

建议在 `app/stores/chat.ts` 增加以下状态。命名可以按现有 store 风格调整，但语义不能改变。

```ts
type BranchState = {
  activeLeafId: string | null
  tree: SessionTreeNode[]
  branches: SessionBranch[]
  isNavigating: boolean
  navigationError: string | null
}

type SessionBranch = {
  id: string
  leafId: string
  preview: string
  isActive: boolean
}

type DraftState = {
  key: string
  text: string
  updatedAt: number
  imageCount: number
}
```

第一阶段不在 `DraftState` 中保存图片二进制数据。图片预览仍属于当前浏览器内存，刷新后清除并提示用户重新附加。

### 4.2 分支状态转换

```text
idle
  ├─ load session with no fork → stable
  ├─ load session with fork → branched
  └─ edit message → editing

editing
  ├─ cancel → stable or branched
  ├─ send → navigating
  └─ switch session → draft saved and leave editing

navigating
  ├─ preview context success + navigate_tree success → branched
  ├─ preview failure → rollback to previous branch
  ├─ navigate_tree failure → reload previous branch and show error
  └─ run starts → reject action before request is sent
```

### 4.3 运行状态门控

分支相关动作必须统一使用同一门控条件：

```ts
const canNavigateBranch = computed(() => {
  return Boolean(sessionId.value) && !isRunning.value && !branchState.isNavigating
})
```

门控必须同时存在于：

- 消息编辑按钮
- 分支选择器
- store action
- 服务端命令发送前

只在模板中禁用按钮是不够的，因为键盘事件、组件调用和异步竞态仍可能绕过模板状态。

## 5 数据和接口契约

### 5.1 会话详情响应扩展

现有 `GET /api/sessions/:id` 保留兼容字段，并增加真实树数据或可重建树所需的数据。推荐响应形状：

```ts
type SessionDetailResponse = {
  info: SessionInfo
  context: SessionContext
  activeLeafId: string | null
  tree: SessionTreeNode[]
}
```

`tree` 必须来自当前 `.jsonl` 的 `SessionManager.getTree()`，不允许前端根据消息文本猜测分支。

如果直接序列化 SDK 的树类型会泄漏不稳定字段，则在服务端转换成项目内部 DTO：

```ts
type SessionTreeNode = {
  entry: {
    id: string
    parentId: string | null
    type: string
    message?: AgentMessage
  }
  children: SessionTreeNode[]
}
```

只传递分支计算和消息预览需要的字段，避免把运行时对象或函数传到客户端。

### 5.2 独立上下文接口

新增：

```text
GET /api/sessions/:id/context?leafId=<entryId>
```

要求：

- 只读，不改变服务端当前活跃叶子
- 与详情接口共用 `buildSessionContext`
- `leafId` 为空时返回默认活跃上下文
- `leafId` 不存在、不是当前会话 entry 或无法回溯时返回 400
- 返回 `context` 和标准化的 `activeLeafId`
- 不创建新 wrapper，不触发 prompt，不写 `.jsonl`

### 5.3 `navigate_tree` 命令

客户端只发送：

```ts
{
  type: "navigate_tree",
  targetId: string
}
```

服务端继续复用 `rpc-manager.ts` 中的 `this.inner.navigateTree(targetId, {})`。本阶段不改变 SDK 命令语义，不加入自动 prompt。

### 5.4 错误响应

服务端错误至少返回：

```ts
{
  error: string
  code?: "invalid_leaf" | "session_busy" | "navigation_failed" | "session_not_found"
}
```

前端可以根据 `code` 决定恢复动作，但用户文案不能直接展示未经处理的 SDK 堆栈。

## 6 分支算法

### 6.1 从树中提取顶层分支

实现两个纯函数，放在 `shared/lib` 或 `app/utils`，具体目录以现有纯函数归属为准：

```ts
compressChain(tree: SessionTreeNode[]): SessionTreeNode[]
selectTopLevelBranches(tree: SessionTreeNode[]): SessionBranch[]
```

规则：

1. 多根树时，每个根节点视为一个顶层分支
2. 单根树沿唯一 child 链向下走，直到遇到第一个分叉节点
3. 第一个分叉节点的 children 作为顶层分支
4. 没有分叉时返回空列表
5. 每个分支沿最后一个 child 使用循环下钻，求出叶子 entryId
6. 首条用户消息预览从该分支子树中找到的第一个 message entry 提取
7. 预览文本使用统一 `extractTextBlocks`，再做长度截断

禁止：

- 用递归遍历深树
- 用数组下标作为分支 id
- 用消息文本作为唯一分支标识
- 为了显示分支而重新读取或修改 `.jsonl`

### 6.2 叶子求法

```ts
const findLeafId = (node: SessionTreeNode): string => {
  let current = node
  while (current.children.length > 0) {
    current = current.children[current.children.length - 1]
  }
  return current.entry.id
}
```

实际实现需要处理空树、缺失 entry id 和异常 children 数据，并通过测试固定行为。

## 7 交互时序

### 7.1 编辑重发

```text
用户点击历史用户消息的编辑
  ↓
前端校验 entryIds[i - 1] 存在
  ↓
保存当前草稿
  ↓
设置 editingMessageIndex 和 editingTargetId
  ↓
将消息文本填入 Composer
  ↓
用户修改并点击发送
  ↓
调用 navigateToLeaf(editingTargetId)
  ↓
GET context 只读预览
  ↓ 成功
发送 navigate_tree
  ↓ 成功
提交新的 prompt
  ↓
SSE 事件落定后 reload 权威上下文
  ↓
清除 editing 状态和已提交草稿
```

任何一步失败：

1. 恢复 `activeLeafId`
2. 重新加载原分支上下文
3. 保留用户修改后的文本
4. 显示可读错误和重试动作
5. 不自动再次发送 prompt

### 7.2 分支切换

```text
用户打开 BranchNavigator
  ↓
选择目标分支
  ↓
记录 previousLeafId
  ↓
乐观设置目标 activeLeafId
  ↓
加载目标 context
  ↓
发送 navigate_tree
  ↓
刷新消息和 entryIds
  ↓
关闭菜单并聚焦当前分支
```

失败时必须恢复 `previousLeafId`，不能只恢复下拉菜单选中项。消息列表、当前叶子和服务端会话必须重新对齐。

### 7.3 草稿 rekey

```text
新建会话
  ↓
生成 temporary:<random-id>
  ↓
Composer 输入写入临时键
  ↓
POST /api/sessions 返回 sessionId
  ↓
将 draft temporary key 迁移为 session:<sessionId>
  ↓
首条 prompt 成功后清空 session key
```

迁移操作必须幂等。重复执行不能创建两份草稿或删除新会话草稿。

## 8 前端文件改造清单

### 8.1 `app/stores/chat.ts`

新增职责：

- 持有 `activeLeafId`
- 持有树 DTO 和顶层分支列表
- 提供 `loadContext(leafId?)`
- 提供 `navigateToLeaf(leafId)`
- 提供 `beginEditMessage(index)`、`cancelEdit()` 和 `sendEditedPrompt()`
- 在 `isRunning` 时统一拒绝导航和编辑
- 在导航失败时执行三件套回滚
- 在 reload 期间用 session id 和请求序号丢弃过期响应

保持不变：

- SSE 连接生命周期
- streaming reducer
- 工具调用配对
- `sendPrompt` 的 ack 与 SSE 时序
- stop 的兜底定时器

### 8.2 `app/components/ChatPanel.vue`

新增职责：

- 会话有分叉时渲染 `BranchNavigator`
- 将当前分支状态、运行状态和错误状态传给导航器
- 展示导航失败的可恢复 notice
- 在编辑态中保持消息列表和 Composer 的关系

不负责：

- 解析树算法
- 直接调用 `fetch`
- 直接拼接 `navigate_tree` 命令

### 8.3 新增 `app/components/BranchNavigator.vue`

职责：

- 展示分支入口和数量
- 展示顶层分支预览
- 标记当前分支
- 在运行和导航中禁用选择
- 支持键盘上下移动和 Escape 关闭
- 选择后调用 store action，不拥有业务请求逻辑

### 8.4 `app/components/MessageItem.vue`

新增职责：

- 对已完成用户消息显示编辑命令
- 第一条用户消息禁用编辑
- 运行中和导航中禁用编辑
- 提供可访问名称和失败后的恢复提示
- 编辑动作只发出事件，不直接切换分支

### 8.5 `app/components/ChatComposer.vue`

新增职责：

- 显示编辑态标题和取消操作
- 草稿变化写入 draft store
- 发送编辑消息时等待导航成功后再提交 prompt
- 提交失败保留修改后文本

保持现有图片边界：图片只保留在当前页面内存，不写入 localStorage。

### 8.6 新增草稿模块

推荐新增：

```text
shared/lib/draft-store.ts
tests/shared/lib/draft-store.test.ts
```

职责：

- `get(key)`
- `set(key, value)`
- `clear(key)`
- `rekey(from, to)`
- `mergeOnFailure(key, value)`
- 文字草稿的持久化和过期清理

模块不依赖 Vue、Pinia、浏览器组件或 API，方便单测和面试说明。

## 9 服务端文件改造清单

### 9.1 `server/api/sessions/[id].get.ts`

- 解析并校验 `leafId`
- 读取 entries
- 复用 `buildSessionContext`
- 生成或转换 `tree`
- 返回 `activeLeafId`
- 不修改 session manager 的当前活跃分支

### 9.2 新增 `server/api/sessions/[id]/context.get.ts`

- 复用详情接口的 session path 解析
- 只做只读 context 构建
- 对非法 leaf 返回 400
- 对不存在会话返回 404
- 不开启 SSE，不触碰 RPC manager

### 9.3 `server/utils/session-reader.ts`

- 保持 `sliceActiveBranch` 的现有父链回溯语义
- 为 tree DTO 增加非递归转换函数
- 为非法 leaf、断链 parent 和重复 id 增加明确错误
- 不把未激活分支的消息放入当前 context

### 9.4 `server/utils/rpc-manager.ts`

- 保留 `navigate_tree` 现有分发
- 在命令入口检查 session 是否存在和是否正在运行
- 统一把 SDK 错误转换成前端可识别的错误 code
- 不实现 `fork`
- 不增加 follow-up 或 steer 命令

## 10 草稿持久化规则

### 10.1 存储内容

允许持久化：

- 文本
- 更新时间
- 会话键
- 编辑态目标 entryId

禁止持久化：

- 图片 base64
- API key
- 模型凭证
- 完整会话消息
- 工具输出
- 任意绝对文件路径

### 10.2 存储位置

第一阶段建议使用浏览器 `localStorage`，键名统一为：

```text
pi-agent:drafts:v1
```

值为版本化 JSON。解析失败时清理损坏值并给出一次非阻塞提示，不影响会话加载。

如果当前项目已经有 settings persistence helper，应复用其序列化和主题隔离约定，不要在 Composer 内直接散落 localStorage 读写。

### 10.3 容量和清理

- 单个草稿限制文本长度，超出时保留尾部还是拒绝必须在实现前定下来；推荐保留完整文本并在达到浏览器异常时显示错误
- 超过 30 天未更新的草稿可以清理
- 当前会话草稿不得因清理后台旧草稿而被删除
- localStorage 不可用时降级为内存态，并明确提示刷新后可能丢失

## 11 测试计划

### 11.1 纯函数测试

新增或扩展：

1. `selectTopLevelBranches`
   - 无分支返回空
   - 单根单链返回空
   - 单根首处分叉返回 children
   - 多根分别成为分支
   - 深链不触发递归栈
2. `findLeafId`
   - 单节点
   - 多级单链
   - 多 child 取最后一个 child
   - 空节点错误
3. `draft-store`
   - set/get/clear
   - temporary key rekey
   - rekey 幂等
   - 损坏 JSON 降级
   - 图片字段不写入

### 11.2 session-reader 测试

- 指定 leaf 只返回该父链上的消息
- 非法 leaf 返回错误
- context 的 `messages` 和 `entryIds` 长度相同
- 每个 `messages[i]` 对应正确的 `entryIds[i]`
- 树 DTO 不包含未允许字段
- 线性长会话使用循环完成转换

### 11.3 chat store 测试

- `reload` 默认加载当前 context
- `reload(leafId)` 加载指定 context
- 过期请求响应不会覆盖新会话
- 导航成功更新 active leaf、messages 和 entryIds
- context 成功但 `navigate_tree` 失败时恢复 previous leaf
- 导航失败保留编辑后的 draft
- `isRunning` 时不会发送导航命令
- 编辑第一条用户消息不会发送命令
- 编辑发送必须先 navigate 成功，再 prompt
- prompt 失败恢复文本草稿和编辑状态

### 11.4 RPC manager 测试

- 合法 `navigate_tree` 调用 SDK
- 缺少 targetId 返回明确错误
- 无效 entryId 返回 `invalid_leaf`
- session busy 时拒绝导航
- SDK 抛错不泄漏堆栈作为用户文案
- fork 仍保持未实现，不被本阶段误接入

### 11.5 手工验收

1. 创建会话并发送两条消息
2. 编辑第二条用户消息并发送改写内容
3. 确认消息区切换到新分支
4. 打开分支列表并切回原分支
5. 在任一分支继续发送，确认另一分支内容不变化
6. 模拟 context 请求失败，确认原分支恢复
7. 模拟 navigate_tree 失败，确认消息、active leaf 和服务端状态重新对齐
8. 运行中尝试编辑和切换，确认按钮禁用且没有命令请求
9. 切换会话后返回，确认草稿仍在
10. 刷新页面，确认文字草稿恢复，图片提示重新添加
11. 主路径回归：项目选择、会话创建、SSE 流式、工具调用、停止、文件 Inspector、能力中心关闭

## 12 实施阶段和提交边界

### F0 合同和测试基线

内容：

- 固定新增响应 DTO
- 固定 `activeLeafId` 语义
- 先写纯函数和 store 失败路径测试
- 记录当前测试数量和 typecheck 基线

完成标准：测试能表达失败回滚、草稿恢复和 entryId 约束。

### F1 服务端只读树和 context

内容：

- tree DTO
- `context.get.ts`
- session-reader 非递归转换
- 详情响应扩展

完成标准：不启动 prompt，不改变服务端活跃分支，测试通过。

### F2 前端分支状态和导航

内容：

- chat store active leaf
- BranchNavigator
- context 加载
- navigate_tree await、回滚和错误通知

完成标准：两条分支可以往返切换，失败后不会污染下一条 prompt。

### F3 编辑重发

内容：

- MessageItem 编辑命令
- Composer editing 状态
- 前置 entry 定位
- navigate 成功后再 prompt

完成标准：原分支保留，新消息成为兄弟分支，首条消息正确禁用编辑。

### F4 草稿和失败恢复

内容：

- draft-store
- session key 和 temporary key
- send failure、SSE failure、navigation failure 恢复
- 图片不持久化

完成标准：所有失败路径都保留文字输入，成功后清理正确的草稿键。

### F5 回归和文档

内容：

- 完整测试
- typecheck
- 主路径手工验收
- 更新 `vue-agent-plan/README.md` 和 `06-history-branching.md` 进度
- 补充面试演示记录

完成标准：F0 到 F4 的验收矩阵全通过，才进入下一轮 UI 重新确认。

每个阶段建议独立提交，避免把服务端协议、状态管理和交互样式混成无法回滚的大提交。

## 13 面试表达

完成后可以用以下事实说明功能价值：

1. 会话分支没有复制或覆盖整份会话，而是利用 `.jsonl` entry parent 链和 `entryId` 构建不同上下文
2. 前端在分支切换前先加载只读 context，在服务端 navigate 成功后才把新分支视为可继续执行
3. 导航失败会回滚 active leaf、消息列表和草稿，避免下一条 prompt 挂到错误分支
4. 新会话在 Composer 出现前已取得真实 session id 草稿直接使用该 id 首条消息未落盘时详情接口仍读取 wrapper 内存态
5. 运行中禁用分支切换是有意的时序取舍，先保证状态一致，再单独设计 steer 和 follow-up 队列

## 14 后续候选功能

完成 F5 后再按下面顺序评估：

| 优先级 | 功能 | 进入条件 |
| --- | --- | --- |
| P1 | Git 变更摘要和文件状态 | 会话分支回归通过，文件树 API 可提供只读状态 |
| P1 | 合法文件路径直达 Inspector | 服务端路径校验和消息路径 DTO 固定 |
| P1 | 消息与代码块复制 | Clipboard 失败有恢复提示 |
| P2 | 快捷键帮助 | 不影响中文输入法和浏览器保留快捷键 |
| P2 | Prompt template 统一发现 | 项目信任边界先完成 |
| 已实施 | follow-up 和 steer | 显式模式选择 队列快照 全部撤回 停止前清队列 |
| P3 | 终端面板 | 评估 Windows node-pty 生命周期和安全边界 |
| P3 | MCP Bridge | 先选定真实 Bridge 扩展和配置契约 |

## 15 当前不做的事情

- 仅为分支和队列控件修改必要样式 不改设计 token
- 不把视觉原型直接迁入应用
- 不为未接入的 MCP 服务生成假状态
- 不实现 fork、删除和导出后再回头补分支核心
- 不为了演示创建虚构的会话、模型、工具或连接数据
- 不以构建成功替代功能验收

## 16 完成定义

只有以下条件全部满足，才认为本阶段完成：

- 编辑重发、分支切换和失败回滚可用
- 文字草稿在会话切换、提交失败和刷新后按规则恢复
- 图片不进入 localStorage
- 运行中分支动作被可靠拒绝
- `.jsonl` 原分支没有被覆盖
- `messages` 和 `entryIds` 始终平行
- 服务端 context 接口只读且有非法 leaf 防护
- 纯函数、store、session-reader 和 RPC manager 测试通过
- typecheck 通过
- 主路径和失败路径手工验收通过
- 计划文档和面试记录更新

功能阶段完成后，再重新进行 UI 方向确认。视觉方案的任何改动都必须建立在这份功能契约不被破坏的前提上。

## 17 实施记录

- 会话详情返回扁平树节点与子节点 ID 只读 context 接口校验非法叶子与断链
- 分支操作按预览 导航 权威重载顺序执行 无法确认回退时锁住发送
- 草稿按真实会话 ID 存储文字和编辑目标 图片始终留在页面内存
- 运行中 prompt 使用 SDK `streamingBehavior` 服务端串行接纳阶段 `clear_queue` 返回实际剩余文本
- 队列通过 SSE 事件和 `get_state` 快照对账 停止前先撤回队列
- 类型检查与自动测试通过 浏览器已验证编辑取消 草稿刷新和三个断点布局
- 本机未配置可用模型凭证 首轮 prompt 被 SDK 拒绝 因此真实模型下的编辑重发 分支往返和队列交付仍待手工验收
