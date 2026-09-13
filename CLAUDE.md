# pi-web-vue

用 Vue 3（Nuxt 4）+ TypeScript 从零实现 pi coding agent 的 Web UI：会话管理、SSE 流式渲染、工具调用/思考可视化、文件浏览、能力中心（模型/技能/扩展）。后端直连 pi 官方 SDK（`@earendil-works/pi-coding-agent`），与 pi CLI 共享 `~/.pi/agent` 配置与会话文件。

## 常用命令

- `npm run dev` — 前后端一起跑（devServer 已固定绑 127.0.0.1）
- `npm run test` — vitest 全量测试
- `npm run typecheck` — nuxt typecheck
- `npm run format` — Prettier 格式化（配置在 `.prettierrc`，忽略清单在 `.prettierignore`）

## 目录

- `app/` — Vue 客户端（pages / components / stores / composables / utils）
- `server/` — Nitro API 路由与工具
- `shared/lib/` — 两端共享纯函数与类型，以 `#shared/lib/...` 引用
- `tests/` — vitest 测试集中目录，路径镜像业务结构（`tests/app/stores/ui.test.ts` 对应 `app/stores/ui.ts`）
- `vue-agent-plan/` — 执行计划文档；动代码前先读其 README，再只读当前步骤的文档
- 安全边界：API 无鉴权且 Agent 可执行任意命令，仅本机使用，不要暴露到公网或内网穿透

## 环境注意

- 装依赖用 `npx -y npm@11 install`（npm 10 解析 Nuxt 4 依赖树会崩）
- typescript 必须锁 ^5（latest 是 TS 7 原生重写版，vue-tsc 3.x 不兼容）
- Windows 下 Git Bash 的 curl 命令行内联中文会乱码，带中文的请求体用 `--data-binary @file`

## 编码规范

与 `vue-agent-plan/README.md`「编码规范」一节内容一致，**两处同步维护：改任何一处必须同步另一处**。

总原则：**可读性优先**——在正确性和性能满足要求的前提下，选直白的写法，不为炫技增加复杂度。

### 注释

1. **核心注释必须写，写「为什么」而不是「是什么」**：时序约束、陷阱、权衡取舍这类代码本身表达不了的信息必须加注释。
2. **注释不带任何标点符号**：中文短句，用空格断句，关键术语保留英文。示例：
   ```ts
   // 先等 SSE 握手完成再发 prompt 短回复的事件才不会丢
   await connection.ensureConnected(sessionId.value)

   // fork 会原地改写 wrapper 内部状态 必须立刻销毁 否则后续请求拿到脏状态
   await this.destroy()
   ```
3. **密度按需，不强制全覆盖**：不要求每个方法体、每一步都有注释；但导出函数、store action、复杂算法的入口处要有一句职责说明，长函数内部的逻辑段用空行隔开、段首补一句注释说明这段在做什么或为什么。已有注释要把话说完整——宁可多半个短句交代前提，不为短而砍掉关键信息。

### 命名与函数定义

4. **函数 `const` + 箭头优先**：`const xxx = () => {}`；裸 `function xxx() {}` 只在确实需要提升或递归时使用。
5. **命名能读出意图**：组件文件 PascalCase 多词（如 `FileKindIcon.vue`）；composable 以 `use` 开头；store 文件用单数名词（如 `chat.ts`）；常量 `UPPER_SNAKE_CASE`；事件名多词时用 kebab-case。
6. **结构**：函数单一职责，一屏放不下就拆；嵌套超过三层用早返回拍平；参数超过三个收成 options 对象。多分支的 if / else 与 switch，分支之间空行隔开，每个分支头补一句核心注释说明该分支对应的情形。

### 文件组织

7. **SFC 顺序**：`<template>` 在前，`<script setup>` 在后；组件导入统一用 `~/components/` 别名。
8. **每个文件按统一骨架分区，空行隔开**，同类文件布局一致，打开任何文件不用重新适应。`<script setup>` 内部分区顺序：
   ```
   import（vue/nuxt → 三方库 → ~/ 与 #shared 本地，组间空行）
   → 常量与变量定义（含 store 实例）
   → props / emits
   → 接口与类型定义
   → computed 与函数方法体
   → watch / 生命周期
   ```
   `.ts` 文件同思路：import → 类型 → 常量 → 函数。分区之间只用空行和必要的一句职责注释体现，**不用 `// ---- xxx ----` 这类横幅式分隔注释**。长函数内部也要用空行切分逻辑段。
   template 同样要求：大区块（输入区、工具栏、弹层这类模块）之间空行隔开，区块头加 `<!-- -->` 注释标注职责或关键约束；复杂嵌套、多属性的元素组之间也补空行。template 注释同样无标点，写职责或为什么，不复述标签结构。
9. **大文件适时拆分（软性要求，不强制）**：单文件超过约 400 行就评估拆分——组件拆子组件或 composable，store 拆纯函数到 `app/utils/` 或 `shared/lib/`，server 工具按职责拆文件。看时机拆，不为拆而拆。

### TypeScript

10. **类型按需取复杂度，不追求复杂**：数据结构用 `interface`/`type` 命名清楚即可，不搞高阶类型体操；泛型只在真实复用时引入；字面量联合优先于 `enum`；禁用 `any`，必要时用 `unknown` 并尽快收窄。
11. **跨端共享类型只在 `shared/lib/types.ts` 定义**：server API 的请求/响应结构与前端引用同源，不在两侧各手写一份。

### 样式

12. **Tailwind v4 与样式架构约定**：新组件的局部布局与间距用 Tailwind 工具类写；不引 preflight；色板经 `@theme` 桥接到 `--color-*`，组件取色走语义变量。进行 UI 样式架构重构时遵循 `DESIGN.md` 与 `design/ui-system.md`，将既有 `main.css` 语义类迁移到对应所有权文件，最终让 `main.css` 只保留 CSS layer 和导入入口，不新增末尾覆盖规则。公共 Pi 原语固定为 `app/components/pi/PiX/index.vue` 与同目录 `style.css`，`index.vue` 只负责 API 行为和无障碍逻辑；普通领域组件默认保持扁平 SFC，只有样式规模已经妨碍阅读或需要与复杂交互一起维护时才拆为目录模块。
13. **store 用显式 vue 导入**（`import { ref, computed } from 'vue'`），保证 vitest 可直接测试。

### 测试与提交

14. **测试**：关键纯函数与 store 逻辑配 vitest 用例，测试文件统一放在 `tests/` 下，路径为 `tests/` + 被测文件所在目录（如 `tests/app/stores/ui.test.ts` 对应 `app/stores/ui.ts`）；导入被测模块一律用别名（`~/`、`#shared/`、`#server/`），vitest `include` 已收窄到 `tests/`，业务目录里的散落测试不会被收集。
15. **提交**：conventional commit 前缀（feat / fix / test / docs / refactor / chore）+ 中文描述；每完成一块完整功能立即 commit，不留大杂烩。

### 格式化

16. **Prettier 统一机械格式**：引号、分号、缩进、换行宽度由根目录 `.prettierrc` 约定（printWidth 100 双引号 分号 trailing comma all LF），提交前跑 `npm run format`（单文件 `npx prettier --write <file>`，校验 `npm run format:check`）。分区、空行、注释 Prettier 不管理，仍按本规范人工维护——格式化是底线，不替代结构规范。
