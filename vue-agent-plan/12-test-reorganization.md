# 测试目录集中化迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 29 个与被测文件同目录混放的 `*.test.ts` 一次性迁入顶层 `tests/` 镜像目录，配套 vitest include 收窄与 typecheck project 接线，并同步修订两处编码规范第 14 条。

**Architecture:** 新路径规则一句话——测试路径 = `tests/` + 被测文件所在目录。typecheck 侧新增 `tests/tsconfig.json` 独立 project（extends Nuxt 生成的 `.nuxt/tsconfig.json`，继承 `~` `#shared` `#server` 全部别名）挂进根 tsconfig 的 references，`nuxt typecheck`（内部 `vue-tsc -b --noEmit`）随之继续覆盖 tests/；vitest 侧补 `#server` 别名并把 `include` 收窄到 `tests/**/*.test.ts`，散落在业务目录的测试不再被收集，规范由配置机械强制。

**Tech Stack:** vitest 5 · Nuxt 4 生成的 tsconfig project references · Windows Git Bash

**Spec:** 本文件「背景与决策」一节即设计决策记录（2026-09-13 会话内三方案对比评审，选定方案 A 顶层 tests/ 镜像分模块）。

## 背景与决策

### 现状与痛点

- 29 个测试文件（共 1641 行）与被测文件同目录混放于 4 处：`app/stores/`（9）、`server/utils/`（9）、`app/utils/`（4）、`shared/lib/`（7）。`app/stores/` 目录 18 个文件里一半是测试
- 现行规范（CLAUDE.md 与 vue-agent-plan/README.md 第 14 条，两处同步维护）明确约定同目录同名——今天的混放是按规矩执行的结果，要改的是规范本身
- 已有重名冲突苗头：`app/stores/extensions.test.ts` 与 `server/utils/extensions.test.ts` 同名共存，决定了集中化必须镜像目录结构而非平铺

### 三方案与取舍

| 方案 | 结论 |
|---|---|
| A 顶层 `tests/` 镜像分模块 | **选定**。业务目录纯净、测试一处可寻、重名天然消解、为组件/e2e 测试留好结构 |
| B 业务目录内 `__tests__/` 子目录 | 否。解决观感但不满足「统一到一起」，测试仍散落 |
| C 维持现状只抽公共工具 | 否。完全不回应核心诉求 |

代价（已接受）：29 个文件导入改写 + typecheck 接线 + 规范两处同步；「改代码的人记得同步改测试」从文件邻接信号变为靠规范条文与 vitest include 强制兜底。

### 已验证机制（2026-09-13 spike，验证后已完全还原）

以下不是推测，是实测结论，执行时可放心依赖：

1. **typecheck 接线可行**：`tests/tsconfig.json`（extends `../.nuxt/tsconfig.json` + `include: ["./**/*.ts"]` + `types: ["node"]`）挂进根 tsconfig 第 5 个 reference 后，`npm run typecheck` exit 0；在 `tests/app/stores/ui.test.ts` 注入 `const _x: number = "s"` 后 exit 2 且错误精确定位 `tests/app/stores/ui.test.ts(28,7): error TS2322`——覆盖是实的，不是空 project 的虚假通过
2. **`#server` 别名 Nuxt 侧本就存在**：`.nuxt/tsconfig*.json` 的 paths 里已有 `"#server": ["../server"]`，tests project 经 extends 自动继承；vitest.config.ts 补同名别名后，`#server/utils/paths` 导入在 vitest 与 typecheck 双侧可用
3. **`nuxt typecheck` 的调用机制**：nuxi 读根 tsconfig 的 `references?.length`，非空则跑 `vue-tsc -b --noEmit`（build 模式跟随 project references）——所以「根 tsconfig 加 reference」就是让新目录进入检查的正确开关
4. **迁移中途不破绿**：vitest 默认 include（`**/*.test.ts`）同时匹配新旧位置，逐模块搬移过程中 `npm test` 始终收集到全量 29 个文件
5. **空项目陷阱**：`tests/tsconfig.json` 若在 `tests/` 还没有任何 `.ts` 文件时挂进 references，`vue-tsc -b` 会报 TS18003（No inputs were found）。因此步骤顺序刻意安排为「先搬第一个模块，再创建 tsconfig 接线」
6. **基线**：`npm test` = 29 files / 123 tests 全绿；`npm run typecheck` exit 0

## 全局约束

- 测试只允许出现在 `tests/` 下，迁移完成后由 vitest `include` 收窄机械强制
- 本迁移**零测试内容改动**：只挪位置与导入写法，123 个用例数不变（现有 123 个用例就是安全网，无需新增用例）
- 注释规范：中文短句、不带标点（编码规范第 2 条），新文件里的注释同样遵守
- 提交规范：conventional 前缀 + 中文描述（第 15 条）
- 行尾：`.prettierrc` 为 `endOfLine: "lf"`，git `core.autocrlf=true`；新文件一律 LF（Write 工具默认即 LF）
- 环境坑（CLAUDE.md「环境注意」）：Windows Git Bash 下带中文的请求体不能 curl 内联——本计划不涉及；`git mv` 多源一目录目标在 Git Bash 可用

## 前置条件（硬前提）

1. **工作区必须干净**。撰写本计划时工作区有大量 Step CC 在途改动（能力中心 store/组件等）与 **9 个未跟踪测试文件**：若不先提交在途工作，迁移提交会混入未提交的功能代码，且这 9 个未跟踪测试会先于其被测源码（同样未提交）入库，造成「有测试无被测代码」的破碎历史。执行前先由人工提交或 stash 全部在途改动。
2. 基线复核：`npm test` 29 文件 123 用例全绿、`npm run typecheck` exit 0、`git status --porcelain` 为空。

## Task 1: 迁移与接线

**Files:**

- Create: `tests/tsconfig.json`
- Modify: `tsconfig.json`（references 追加一项）
- Modify: `vitest.config.ts`（加 `#server` 别名，最后收窄 `include`）
- Move: 29 个 `.test.ts`（映射见下，20 个 `git mv` + 9 个普通 `mv`）

**Interfaces:**

- Consumes: 现有 29 个测试文件及其相对导入（已全量枚举，每个测试恰好一条 `./` 导入指向被测对象；`shared/lib` 的 streaming-message 与 session-stats 另有一条 `./types`；无 `../` 父级导入、无副作用导入、`vi.mock` 仅 chat.test.ts 一处且已是 `#shared` 别名）
- Produces: `tests/` 镜像结构；`#server` 别名（vitest 与 tests project 双侧可用）；vitest `include` 收窄后的强制约束

**迁移映射与 git 状态（20 已跟踪 / 9 未跟踪）：**

| 旧路径 | 新路径 | 方式 |
|---|---|---|
| `shared/lib/` 下 7 个：agent-event-wire、file-paths、image-attachments、images、message-text、session-stats、streaming-message | `tests/shared/lib/` 同名 | git mv |
| `server/utils/` 下 8 个：file-types、path-security、paths、project-identity、rpc-manager、session-reader、session-title、worktree | `tests/server/utils/` 同名 | git mv |
| `server/utils/extensions.test.ts` | `tests/server/utils/` 同名 | mv（未跟踪） |
| `app/stores/` 下 2 个：chat、sessions | `tests/app/stores/` 同名 | git mv |
| `app/stores/` 下 7 个：capability-center、extensions、file-viewer、models、settings、skills、ui | `tests/app/stores/` 同名 | mv（未跟踪） |
| `app/utils/` 下 3 个：at-query、session-groups、usage-format | `tests/app/utils/` 同名 | git mv |
| `app/utils/file-highlight.test.ts` | `tests/app/utils/` 同名 | mv（未跟踪） |

**导入改写规则（按目录整体 sed，已验证无例外匹配）：**

| 目录 | sed 规则 |
|---|---|
| `tests/app/stores/*.test.ts` | `from "./` → `from "~/stores/` |
| `tests/app/utils/*.test.ts` | `from "./` → `from "~/utils/` |
| `tests/server/utils/*.test.ts` | `from "./` → `from "#server/utils/` |
| `tests/shared/lib/*.test.ts` | `from "./` → `from "#shared/lib/` |

步骤顺序刻意安排为：**每一步完成后 `npm test` 与 `npm run typecheck` 都保持绿**，中断在任何一步都不留破窗。

- [ ] **Step 1: 基线确认**

Run: `git status --porcelain`
Expected: 无输出（前置条件 1 已满足）

Run: `npm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files 29 passed (29)` / `Tests 123 passed (123)`

Run: `npm run typecheck`
Expected: exit 0

- [ ] **Step 2: 迁移 shared/lib 7 个并验证**

```bash
mkdir -p tests/shared/lib
git mv shared/lib/agent-event-wire.test.ts shared/lib/file-paths.test.ts shared/lib/image-attachments.test.ts shared/lib/images.test.ts shared/lib/message-text.test.ts shared/lib/session-stats.test.ts shared/lib/streaming-message.test.ts tests/shared/lib/
sed -i 's|from "\./|from "#shared/lib/|' tests/shared/lib/*.test.ts
```

Run: `npx vitest run tests/shared`
Expected: 7 个文件全部通过（`./types` 同时被改写为 `#shared/lib/types`）

- [ ] **Step 3: 创建 tests/tsconfig.json 并挂进根 tsconfig references**

此时 `tests/` 已有 7 个 `.ts` 文件，不会触发 TS18003 空项目错误。`tests/tsconfig.json` 全文：

```jsonc
{
  // 继承 Nuxt 生成的全量别名(~ #shared #server)与编译选项 nuxt prepare 重新生成后自动跟进
  // 挂进根 tsconfig references 后 vue-tsc -b 才会检查 tests/ 否则集中化会让测试脱离 typecheck
  "extends": "../.nuxt/tsconfig.json",
  // 独立 project 只收 tests 不把业务源码重复纳入检查
  "include": ["./**/*.ts"],
  "compilerOptions": {
    // 基配置 types 是空数组 而 server 测试的 node: 导入需要 @types/node
    "types": ["node"]
  }
}
```

`tsconfig.json` 的 `references` 数组末尾追加（原四项不动，注意给原最后一项补逗号）：

```jsonc
    // 测试独立 project 没有它 集中化后 tests/ 会脱离 nuxt typecheck 的覆盖
    {
      "path": "./tests/tsconfig.json"
    }
```

Run: `npm run typecheck`
Expected: exit 0（tests project 首次进入检查，7 个 shared 测试的别名导入全部可解析）

- [ ] **Step 4: vitest.config.ts 加 #server 别名（此时不收窄 include）**

在 `resolve.alias` 中、`#shared` 行之后插入：

```ts
      // server 测试迁入 tests/ 后经此别名导入被测模块
      "#server": fileURLToPath(new URL("./server", import.meta.url)),
```

Run: `npx vitest run tests/shared`
Expected: 7 个文件通过（别名新增不影响现有收集）

- [ ] **Step 5: 迁移 server/utils 9 个并验证**

```bash
mkdir -p tests/server/utils
git mv server/utils/file-types.test.ts server/utils/path-security.test.ts server/utils/paths.test.ts server/utils/project-identity.test.ts server/utils/rpc-manager.test.ts server/utils/session-reader.test.ts server/utils/session-title.test.ts server/utils/worktree.test.ts tests/server/utils/
mv server/utils/extensions.test.ts tests/server/utils/extensions.test.ts
sed -i 's|from "\./|from "#server/utils/|' tests/server/utils/*.test.ts
```

Run: `npx vitest run tests/server`
Expected: 9 个文件全部通过

Run: `npm run typecheck`
Expected: exit 0（server 测试的 `#server/utils/...` 与 `node:` 导入在 tests project 内可解析）

- [ ] **Step 6: 迁移 app 13 个并验证**

```bash
mkdir -p tests/app/stores tests/app/utils
git mv app/stores/chat.test.ts app/stores/sessions.test.ts tests/app/stores/
mv app/stores/capability-center.test.ts app/stores/extensions.test.ts app/stores/file-viewer.test.ts app/stores/models.test.ts app/stores/settings.test.ts app/stores/skills.test.ts app/stores/ui.test.ts tests/app/stores/
git mv app/utils/at-query.test.ts app/utils/session-groups.test.ts app/utils/usage-format.test.ts tests/app/utils/
mv app/utils/file-highlight.test.ts tests/app/utils/file-highlight.test.ts
sed -i 's|from "\./|from "~/stores/|' tests/app/stores/*.test.ts
sed -i 's|from "\./|from "~/utils/|' tests/app/utils/*.test.ts
```

Run: `npx vitest run tests/app`
Expected: 13 个文件全部通过（chat.test.ts 的 `vi.mock("#shared/lib/agent-client")` 本就是别名，不受影响）

Run: `npm run typecheck`
Expected: exit 0

- [ ] **Step 7: 收窄 vitest include 并全量验证**

`vitest.config.ts` 最终全文：

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // 收窄后业务目录里的散落测试不会被收集 新测试只认 tests/ 规范由配置强制
  include: ["tests/**/*.test.ts"],
  resolve: {
    alias: {
      "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
      // server 测试迁入 tests/ 后经此别名导入被测模块
      "#server": fileURLToPath(new URL("./server", import.meta.url)),
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
});
```

Run: `npm test 2>&1 | grep -E "Test Files|Tests "`
Expected: **`Test Files 29 passed (29)` / `Tests 123 passed (123)`**——与基线完全一致，证明零丢失

Run: `find app server shared -name "*.test.ts"`
Expected: 无输出（业务目录零残留）

- [ ] **Step 8: typecheck 覆盖抽查**

在 `tests/app/stores/ui.test.ts` 末尾临时追加一行 `const _coverage: number = "x";`，运行 `npm run typecheck`，应 exit 2 且错误定位在该文件；删除该行后复跑，exit 0。（spike 已验证过同一手法，此步是执行期的廉价再证）

- [ ] **Step 9: 格式化触点文件**

```bash
npx prettier --write tests/tsconfig.json tsconfig.json vitest.config.ts
npx prettier --check tests/tsconfig.json tsconfig.json vitest.config.ts
```

Expected: check 通过（注：tsconfig.json 与 vitest.config.ts 当前盘上是 CRLF，`--write` 会顺带归一为 LF，git 侧 autocrlf 下无感知，属预期）

- [ ] **Step 10: 提交**

```bash
git add tests/ tsconfig.json vitest.config.ts
git status
```

人工确认 staged 内容只有：29 个测试的移动/新增、`tests/tsconfig.json` 新增、两个配置文件的修改。确认后：

```bash
git commit -m "refactor: 测试集中到 tests/ 镜像业务结构"
```

## Task 2: 编码规范两处同步修订

**Files:**

- Modify: `CLAUDE.md`（「目录」一节 + 编码规范第 14 条）
- Modify: `vue-agent-plan/README.md`（「执行顺序」表 + 编码规范第 14 条）

**Interfaces:**

- Consumes: Task 1 落地后的 `tests/` 结构
- Produces: 规范条文与实际结构一致（CLAUDE.md 引言明确两处同步维护，改一处必须同步另一处）

- [ ] **Step 1: CLAUDE.md「目录」一节，`shared/lib/` 行之后加一行**

```markdown
- `tests/` — vitest 测试集中目录，路径镜像业务结构（`tests/app/stores/ui.test.ts` 对应 `app/stores/ui.ts`）
```

- [ ] **Step 2: 两处第 14 条同步替换（一字不差）**

旧文（CLAUDE.md 与 vue-agent-plan/README.md 当前原文一致）：

> 14. **测试**：关键纯函数与 store 逻辑配 vitest 用例，测试文件与被测文件同目录同名（`xxx.test.ts`）。

新文：

> 14. **测试**：关键纯函数与 store 逻辑配 vitest 用例，测试文件统一放在 `tests/` 下，路径为 `tests/` + 被测文件所在目录（如 `tests/app/stores/ui.test.ts` 对应 `app/stores/ui.ts`）；导入被测模块一律用别名（`~/`、`#shared/`、`#server/`），vitest `include` 已收窄到 `tests/`，业务目录里的散落测试不会被收集。

- [ ] **Step 3: vue-agent-plan/README.md「执行顺序」表，11 那行之后加一行**

```markdown
| [12-test-reorganization.md](./12-test-reorganization.md) | 工程规范：测试集中到 tests/ 镜像结构（一次性迁移） | 工程规范 |
```

- [ ] **Step 4: 提交**

```bash
git add CLAUDE.md vue-agent-plan/README.md
git commit -m "docs: 编码规范第 14 条改为测试集中 tests/ 目录"
```

## 不做的事（明确出界）

- **不**收敛测试内重复的 fetch/localStorage stub 到 `tests/helpers/`——那是测试内容重构，与位置迁移混在一个提交会污染 review，留作后续独立小改动
- **不**预建空的 `tests/helpers/` 目录（git 不跟踪空目录；出现第一个真实共享工具时再建，届时规范里补一行位置约定）
- **不**动 `.prettierignore`（tests/ 就该被格式化）
- **不**为组件测试/e2e 预建目录（到时候按 `tests/components/`、`tests/e2e/` 自然扩展，镜像规则不变）

## 风险与回退

- 唯一机制风险（typecheck 接线）已 spike 实测验证，计划步骤即验证过的步骤
- 回退方式：`git revert` Task 1 的提交即可——全部是纯位置与导入写法变更，无内容耦合
