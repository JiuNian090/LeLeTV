# PHASE-5-PLAN — ESM splitting 分步方案

> 生成时间：2026-10-21
> 前置：阶段 4 / 4.5 已完成，`js/` 已清零，`src/` 共 58 个 `.ts` 文件。
> 当前构建：`scripts/build-bundles.mjs` 按 `build.config.js` 的 `files` 数组做字符串拼接 + `esbuild.transform`。
> 本文件只描述方案，**不含任何代码改动**。

---

## 1. 目标 / 非目标

### 目标

1. 58 个全局脚本改为 ESM（显式 `import` / `export`）。
2. 构建切换为 `esbuild.build` + `splitting: true`，由入口 import 图决定 chunk。
3. 首屏预算继续守住 **275 KB**（当前 267.2 KB）。
4. 运行时行为、URL、Cloudflare 部署配置**零变化**。

### 非目标

- 不改 UI / 样式 / 采集站业务逻辑。
- 不改 `_headers` / `_routes.json` / `functions/` / `wrangler.toml`（红区）。
- 不引入前端框架或新的运行时依赖。
- 不删除全局桥（`window.LeLeTV` / `LeLeBoot` / `LeLePages` / 各页面对外函数）——它们是 HTML 内联脚本与外部调用的契约。

---

## 2. 现状评估（2026-10-21 只读扫描）

| 指标 | 数值 |
|---|---|
| `.ts` 文件 | 58 |
| 含 `import` / `export` 的文件 | **0** |
| 顶层运行时声明（`var/let/const/function/class`） | 213 个存在跨文件引用 |
| 双向引用（潜在 import 环） | **23 对** |
| bundle 数 | 5（core / app / category / settings / player） |
| 首屏 core+app | 267.2 KB / 275 KB |

### 高引用面（需优先收敛的共享符号）

| 符号 | 归属 | 被引用文件数（上限值） |
|---|---|---|
| `API_SITES` | `src/core/config.ts` | 13 |
| `isHiddenContentMode` | `src/core/config.ts` | 12 |
| `selectedAPIs` / `customAPIs` | `src/services/sources/config.ts` | 11 / 11 |
| `INVITE_AUTH` | `src/services/invitation.ts` | 8 |
| `TMDB_WORKER_URL` | `src/core/config.ts` | 6 |
| `TIMING` | `src/core/timing.ts` | 6 |
| `getCustomApiInfo` | `src/services/line-probe.ts` | 6 |
| `LeLePages` | `src/router/page-loader.ts` | 5 |
| `getViewingHistory` | `src/services/viewing-history.ts` | 5 |
| `currentEpisodeIndex` / `currentEpisodes` / `currentVideoTitle` / `art` | `src/ui/player/index.ts` | 12 / 10 / 9 / 8 |

> 「被引用文件数」来自词边界静态扫描，包含同名局部变量误报（如 `search`、`scopedKey`、`themeColor`），只能作为**上限**。5A-1 必须人工复核后落表。

### 双向引用（必须在 5B 拆掉）

```
core/config.ts            <-> services/sources/config.ts
core/config.ts            <-> services/tmdb.ts
core/config.ts            <-> ui/player/index.ts
core/storage.ts           <-> ui/player/index.ts
core/listener-tracker.ts  <-> ui/player/manager.ts
services/viewing-history  <-> ui/player/index.ts
main.ts                   <-> pages/search/index.ts
main.ts                   <-> router/index.ts
pages/category/index.ts   <-> pages/search/index.ts
pages/category/index.ts   <-> ui/player/bridge.ts
pages/search/cards.ts     <-> services/tmdb.ts
pages/search/index.ts     <-> services/search-history.ts
ui/player/index.ts        <-> ui/player/{core,episodes,ui,bridge,detail,shortcuts}.ts
ui/player/core.ts         <-> ui/player/{manager,quality}.ts
ui/player/detail.ts       <-> ui/player/ui.ts
ui/player/episodes.ts     <-> ui/player/ui.ts
```

**结论：不能一步改成 ESM + splitting。** 必须拆成 5A（ESM 化、保留全局引用）与 5B（拆环、启用 splitting）两个子阶段。

---

## 3. 两个子阶段

### 5A — ESM 化（不改变依赖模型）

- 每个文件加 `export`，顶层声明与副作用位置不变。
- 入口文件按**原 `files` 数组顺序**写 `import './module'`，保证副作用求值顺序。
- 跨文件引用**仍走全局作用域**（不 import），因此不产生 import 边、不引入环。
- 构建从「concat + transform」改为「单入口 `esbuild.build`」。
- 收益：源码具备模块语义、构建链简化；**体积与行为基本不变**。
- 这一步是所有后续工作的基础，可独立回滚。

**全局兼容桥（5A 的硬性前提）**：文件一旦成为 ESM 模块，顶层 `var` 不再自动成为全局，
仍走全局访问的模块会立刻断裂。因此每个文件的改造必须成对完成：

1. 顶层声明改为 `export`（或保留声明并追加 `export { ... }`）；
2. 把该模块的对外符号显式挂回 `window`（如 `window.API_SITES = API_SITES`），
   直到 5B 把所有引用方改成 `import` 后再逐项删除。

两者缺一不可；只加 `export` 会破坏与未改造模块的兼容。

### 5B — 拆环 + splitting

- 抽出共享状态模块（`src/core/state.ts`），把高频共享符号收敛为显式导出。
- 拆 player 内部环（状态与 UI 分离）。
- 逐模块把全局引用改为 `import`，优先「下层 ← 上层」方向。
- 入口改为真正的 import 图，启用 `splitting: true`。
- HTML 只引入口 chunk；共享 chunk 由 esbuild 生成。
- 收益：tree-shaking、共享 chunk、按需加载边界清晰。

---

## 4. 分步计划（每步独立 commit）

### 5A-1. 依赖图复核与入口定稿（只读 + 文档）

- 复核静态扫描结果，剔除同名误报，产出「符号 → 归属文件 → 引用方」矩阵。
- 定稿入口：`src/main.ts`（app）、`src/boot.ts`、`src/pages/*`、`src/ui/player/index.ts`（player）。
- 产出：`.agents/migration/PHASE-5-GRAPH.md`。
- 验证：文档评审；不改代码。

### 5A-2. 垂直试点（category bundle，1 文件）

- **状态：已完成（commit `7d02171`）**。category bundle 21.2 → 19.1 KB；
  `export + declare global + window 桥` 模式验证通过（裸名与 `window.*` 均可访问）。
- 实际入口为 `src/pages/category/entry.ts`（`src/entries/` 属新建层，违反硬规则 6）。
- `src/services/tmdb.ts` 加 `export` + `declare global` + `window` 兼容桥。
- `build-bundles.mjs` 对被标记 `entry` 的 bundle 改用 `esbuild.build({ bundle: true, format: 'iife' })`，其余仍走 concat。
- 验证：category 页 reload；`window.TMDB_STATE` / `TMDB_CONFIG` / `GENRE_MAP` 与裸名访问均正常。
- 后续文件改造沿用同一模式（export + declare global + window 桥 + 入口 import）。

### 5A-3. core 层 ESM 化（9 文件）

- **状态：已完成（commit `986a8ca`）**。core bundle 实际含 14 个文件（core / services / ui 混合），已整体切 entry。
- `export` 推迟到 5B（引用方改 import 时再加）；本阶段只加 `window` 兼容桥。
- 结果：core 51.4 → 47.8 KB，首屏 core+app 267.2 → 263.5 KB；首页 / 分类 / 设置 / 播放页回归通过。
- 教训：`declare function`（仅类型声明）不是本文件实现，不能进兼容桥。

### 5A-4. services 层 ESM 化（15 文件）

- 同样逐个加 `export`；`sources/*`、`tmdb`、`search`、`api`、`invitation` 等注意与 `core/config` 的双向引用（5A 阶段允许保留）。

### 5A-5. ui 层 ESM 化（17 文件）

- 先 `toast` / `modals` / `motion-pref` / `layout-pref` / `pwa-install` 等低耦合项；player 子目录最后。

### 5A-6. pages 层 ESM 化（20 文件）

- 页面入口保持「片段插入后初始化」的现有契约。

### 5A-7. router / boot / main ESM 化

- `router/index.ts`、`router/page-loader.ts`、`router/prefetch.ts`、`boot.ts`、`main.ts`。
- 这一步完成后，58 个文件均有 `export`。

### 5A-8. 构建全量切换（单入口 `esbuild.build`）

- `build.config.js` 增加 `entry` 字段，`files` 保留为过渡期的 import 顺序清单。
- 全部 bundle 改为 `esbuild.build({ bundle: true, format: 'iife' })`（暂不 splitting）。
- HTML 引用逻辑不变；产物文件名仍带 hash。
- 验证：bundle 体积、首屏预算、页面 reload、player 页。

### 5B-1. 共享状态抽离

- 新增 `src/core/state.ts`：`API_SITES`、`selectedAPIs`、`customAPIs`、`isHiddenContentMode`、`search` 状态、`TMDB_WORKER_URL` 等高频符号的显式读写接口。
- 旧位置保留 getter/setter 兼容层，避免一次性改所有调用方。

### 5B-2. player 内部拆环

- 把 `art`、`currentEpisodeIndex`、`currentEpisodes`、`currentVideoTitle` 收敛到 `ui/player/state.ts`。
- 拆 `index ↔ core/episodes/ui/bridge/detail/shortcuts` 的双向边。

### 5B-3. 逐模块 import 化

- 按层从下往上：core → services → ui → pages → router/entry。
- 每个模块改完跑一次 check + reload；出现环立即停止并回退该模块。

### 5B-4. 启用 splitting

- `esbuild.build({ splitting: true, format: 'esm' })`，入口产出 ESM。
- 共享 chunk 用 `chunkNames: 'chunks/[name]-[hash]'`。
- HTML 的 `<script>` 改为 `type="module"`，按需加 `modulepreload`。
- 验证：首屏请求数、瀑布、预算。

### 5B-5. 清理

- 移除 `build.config.js` 的 `files` 清单，只保留入口与预算。
- 全局桥收敛：保留 HTML 内联脚本实际使用的 `window.*`，其余移除。
- 更新 `check-deps.js`，从「扫描 js/」改为「扫描 import 图 + 环检测」。

---

## 5. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 23 对双向引用 | ESM 运行时报 TDZ / undefined | 5B 之前不产生 import 边；5B-1/5B-2 先拆环 |
| 静态扫描同名误报 | 工作量评估偏高 | 5A-1 人工复核矩阵 |
| 副作用顺序 | 启动屏 / 鉴权 / 首页加载异常 | 5A 入口 import 顺序严格等于原 `files` 顺序；`boot.ts` 永远最后 |
| player 与 app 共享 chunk | player 页被塞入 app 专有代码 | 5B-4 为 player 建独立入口，检查产物 |
| 预算回退 | 首屏超 275 KB | 每步跑 `check-budget`，超预算即停在当前步骤 |
| HTML 缓存键 | 部署后旧 bundle 残留 | 文件名继续带 hash，`generate-version` 注入 `?v=` |
| 回滚粒度 | 大面积返工 | 每步独立 commit，可单独 revert |

---

## 6. 验收标准

- `npm run typecheck` / `npm run build` / `npm run check` 全绿。
- `docs/REGRESSION.md` 第 0 / 1 / 3 / 5 / 6 / 7 / 8 节通过（首页、邀请码、PWA、搜索、播放器、导航）。
- 首屏 core+app ≤ **275 KB**。
- 无 `any` / `as any` / `@ts-ignore`。
- 红区文件零改动。
- 每步 `git status` 干净、独立 commit。

---

## 7. 建议起点

先做 **5A-1**（只读复核 + 依赖矩阵）与 **5A-2 的前三个文件**（`timing` / `listener-tracker` / `cache`）：

- 三者依赖面小，能验证「加 export + 入口 import」的过渡模式是否成立。
- 不改变任何运行时行为，失败可整步 revert。
- 完成后可据此估算 58 个文件的剩余工作量。
