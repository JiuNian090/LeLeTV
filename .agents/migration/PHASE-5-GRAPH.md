# PHASE-5-GRAPH — 阶段 5B 只读依赖复核与拆环方案

> 生成时间：2026-10-21
> 分支：`refactor/slim-arch`，基线提交 `085ead7`
> 口径：`src/**/*.ts` 全量只读扫描（59 个文件），不修改任何源码。
> 上游文档：`.agents/migration/PHASE-5-PLAN.md` §2 / §4、`.agents/migration/RESUME.md`

---

## 1. 复核结论

| 项 | PHASE-5-PLAN 粗扫描 | 本次复核 |
|---|---|---|
| `.ts` 文件 | 58 | **59**（含 `src/pages/category/entry.ts`） |
| 跨文件符号引用边 | 未统计 | **139 条**（去重后） |
| 双向引用对 | 23 对 | **18 对**，其中 **11 对是同 bundle 运行时环** |
| 已证实误报 | 未剔除 | **5 对**（字符串键 / 同名 interface / 无引用） |
| 仅类型或仅单向 | 未区分 | **2 对仅类型边**，可直接用 `import type` 消除 |

**核心结论：**

1. `PHASE-5-PLAN` 的 23 对中有 5 对不成立（见 §4），真实的双向引用是 18 对。
2. 18 对里只有 11 对会在同一个 bundle 内产生 ESM 环；其余是跨 bundle（`app ↔ player`、`app ↔ category`）或仅类型边。
3. 最大的一块不是 player，而是 **`services → ui` 的 toast 调用（29 处）** 与 **`router → services` 的导航调用**。按 `.agents/rules/01-layering.md`，这些方向不能改成 `import`，只能保留 `window` 桥。这决定了 5B 的最终形态：**ESM 化覆盖同层/合法方向，跨层反向依赖保留显式桥**。
4. 5B-1 抽 `core/state.ts` 可以一次消掉 `main ↔ search`、`main ↔ category`、`category ↔ search`、`search ↔ bridge` 四条边；5B-2 抽 `ui/player/state.ts` + 3 个叶子模块可以消掉 player 内部全部 10 条边。

---

## 2. 复核方法与口径

- 用 `scripts` 级别的只读脚本解析每个 `.ts` 的顶层声明（`function/class/const/let/var/interface/type`）与 `window` 兼容桥。
- 对每个标识符出现位置按「`window.X`（显式桥）/ 裸名 / 有同名局部绑定（`?`）」分类；对象字面量键、interface 成员、字符串与注释已排除。
- 再叠加 `build.config.js` 的 `files` 清单，判断一条边是否落在同一 bundle。
- 所有 `?` 标记与高引用符号都已人工回读源码确认；确认结果见 §4 / §6。
- 未纳入：HTML 内联脚本对全局符号的引用（5B-4 单独扫描）。

> 说明：扫描脚本是会话级临时产物（`$TMPDIR`），不入库。复核口径与矩阵已完整落在本文档，后续可据此重跑。

---

## 3. 当前入口与 bundle 边界

| bundle | 入口 | 纳入文件（要点） |
|---|---|---|
| `leletv-core` | 临时入口（`files` 顺序） | `ui/modals`、`core/*`、`sources/remote`、`services/invitation`、`ui/toast`、`ui/motion-pref`、`services/line-probe` |
| `leletv-app` | 临时入口（`files` 顺序） | `sources/config`、`balancer`、`search*`、`viewing-history`、`ui/index`、`api`、`search`、`player/bridge`、`pages/*`、`main`、`router/*`、`boot` |
| `leletv-category` | `src/pages/category/entry.ts` | `services/tmdb` |
| `leletv-settings` | 临时入口 | `services/theme`、`pages/settings/*` |
| `leletv-player` | 临时入口 | `api`、`search`、`viewing-history`、`ui/player/*`、`version-updater`、`core/cache` |

关键事实：

- `services/tmdb.ts` 当前**只**属于 category bundle，但 app 侧的 `router`、`home/recent`、`home/shelves`、`search/index` 都直接引用它。5B-4 启用 splitting 后它会成为共享 chunk。
- `ui/player/bridge.ts` 属于 **app** bundle，`ui/player/index.ts` 属于 **player** bundle。两者之间的播放状态传递是整页导航（localStorage + window），不是同一次求值，不能也不需要 import。
- `core/config.ts` 已经被 app / player / settings 多个 bundle 引用，是事实上的共享模块。

---

## 4. 23 对双向引用逐条判定

图例：**真环** = 同 bundle 运行时双向；**类型** = 反向只有类型引用；**跨 bundle** = 两侧不同入口；**误报** = 不成立。

| # | PLAN 中的对 | 复核判定 | 关键符号 | 拆法 |
|---|---|---|---|---|
| 1 | `core/config` ↔ `services/sources/config` | **误报** | 仅 `SCOPED_STORAGE_KEYS` 里的字符串 `'selectedAPIs'` / `'customAPIs'` | 无动作 |
| 2 | `core/config` ↔ `services/tmdb` | **误报** | 无跨文件引用 | 无动作 |
| 3 | `core/config` ↔ `ui/player/index` | 单向 | `player/index → TMDB_WORKER_URL` | `ui → core` 合法，直接 import；删 config 的桥 |
| 4 | `core/storage` ↔ `ui/player/index` | 单向 | `player/index → StorageService` | `ui → core` 合法，直接 import |
| 5 | `core/listener-tracker` ↔ `ui/player/manager` | 单向（类型） | `manager → ListenerTracker` | `ui → core` 合法，直接 import |
| 6 | `services/viewing-history` ↔ `ui/player/index` | **误报 + 类型** | `currentEpisodes` 只是 localStorage 键；反向仅 `ViewingHistoryItem` | 类型下沉 `core/storage.ts`；`player/index` 不再依赖 services |
| 7 | `main` ↔ `pages/search/index` | **真环（app）** | search 侧：`_activeSourceFilter/_lastAllResults/_filterConfig/_searchReady`；main 侧：`setupEventListeners/hookInput` | 搜索状态抽到 `core/state.ts`；main 只 import search 入口（`main → pages` 合法） |
| 8 | `main` ↔ `router/index` | **真环（app）** | main → `showPage/handlePageLoad/playHomeIntro`；router → `AppInit/setupEmailClickHandlers` | `AppInit` 抽到 `router/app-init.ts`；`email-handler` 注册从 router 移到 main；main → router 保留 import |
| 9 | `pages/category/index` ↔ `pages/search/index` | **间接真环（app）** | search 读 `_moviesState`；category 写 `_lastAllResults`（main 顶层） | `_lastAllResults` 抽到 `core/state.ts`；category 调 `setLastAllResults()`；search 读 state，**禁止 page 互 import** |
| 10 | `pages/category/index` ↔ `ui/player/bridge` | 单向 | `bridge → _moviesState`（返回 URL 兜底） | bridge 改读 `core/state.lastAllResults`；不再 import page |
| 11 | `pages/search/cards` ↔ `services/tmdb` | 单向（但违规） | `tmdb → _cardImgFallback`（services → pages） | `_cardImgFallback` 下沉 `services/tmdb.ts` 或 `core/`，cards 侧删除本地副本 |
| 12 | `pages/search/index` ↔ `services/search-history` | 单向 | `search → clearSearchHistory` | `pages → services` 合法，直接 import |
| 13 | `ui/player/index` ↔ `ui/player/core` | **真环（player）** | core → `art(47)/episodeSwitchTimeout(15)/autoFullscreened/videoHasEnded/...`；index → `initPlayer` | 状态进 `ui/player/state.ts`；`getVideoId/saveToHistory/startProgressSaveInterval/updateMediaSession` 进 `ui/player/session.ts`；core 只 import state/session |
| 14 | `ui/player/index` ↔ `ui/player/episodes` | **真环（player）** | episodes → 全部播放状态；index → `renderEpisodes/playEpisode/...` | 状态进 state；episodes 不再 import index |
| 15 | `ui/player/index` ↔ `ui/player/ui` | **真环（player）** | ui → `art(49)/controlsLocked(15)/shortcutHintTimeout/currentVideoTitle/...` + `goHome`；index → `showError/toggleResourceList/...` | 状态进 state；`goHome` 下沉 `ui/player/navigation.ts`；ui 不再 import index |
| 16 | `ui/player/index` ↔ `ui/player/bridge` | **跨 bundle** | bridge → 播放状态；index → `DetailData/playVideo` | 保持 window 契约：bridge 跳转前写 localStorage；index 通过 window 读回 |
| 17 | `ui/player/index` ↔ `ui/player/detail` | **真环（player）** | detail → `currentVideoTitle/currentVideoUrl/currentEpisodeIndex/updateMediaSession`；index → detail 渲染函数 | 状态进 state；`updateMediaSession` 进 session；detail 不再 import index |
| 18 | `ui/player/index` ↔ `ui/player/shortcuts` | **真环（player）** | shortcuts → 全部状态 | 状态进 state；shortcuts 不再 import index |
| 19 | `ui/player/core` ↔ `ui/player/manager` | **真环（仅类型反向）** | manager → `HlsInstance/ArtplayerInstance`；core → `PlayerManager` | `manager` 用 `import type`；类型边被 esbuild 擦除，环消失 |
| 20 | `ui/player/core` ↔ `ui/player/quality` | **真环（仅类型反向）** | quality → `HlsInstance`；core → `setupQualitySwitcher` | 同 19：`import type` |
| 21 | `ui/player/detail` ↔ `ui/player/ui` | **真环（player）** | ui → `escHtml`；detail → `renderResourceCurrentSource/updateResourceSourceCount` | `escHtml` 下沉 `ui/player/utils.ts`；detail → ui 单向 |
| 22 | `ui/player/episodes` ↔ `ui/player/ui` | **真环（player）** | episodes → `clearVideoProgress`；ui → `playNextEpisode` | `clearVideoProgress` 下沉 `session.ts`；ui → episodes 单向 |
| 23 | `ui/player/core` ↔ `ui/player/episodes` | **真环（player）** | core → `playNextEpisode`；episodes → `initPlayer` | core 改为调用 state 的 `advanceEpisode()` 回调；index 启动时注册 `setEpisodeAdvanceHandler(playNextEpisode)`；episodes → core 保留 |

### 4.1 PLAN 未列出、本次新增的边

| 对 | 判定 | 说明 |
|---|---|---|
| `pages/search/index` ↔ `ui/player/bridge` | **真环（app）** | search → `playDirectly`；bridge → `cacheSearchContext`（ui → pages 违规） |
| `router/index` ↔ `services/tmdb` | **真环（跨 bundle）** | router → `TMDB_STATE/initTmdbCategory/saveTmdbScroll`；tmdb → `switchPage`（services → router 违规） |
| `router/index` ↔ `services/viewing-history` | 同 app，反向是全局函数 | router → `loadViewingHistory`；viewing-history → `dissolveThenRemove`（services → router 违规） |
| `services/tmdb` → `pages/search/cards` | 单向违规 | `_cardImgFallback` |
| `services/config` → `ui/index` | 单向违规 | `showImportBox` |
| `services/line-probe` → `ui/player/core` | 单向违规 | `shouldUseNativeHls` |
| `services/version-updater` → `router/index` | 单向违规 | `parseChangelogMarkdown` |

`search ↔ bridge` 的拆法：search → bridge 改 import（`pages → ui` 合法）；bridge → search 的 `cacheSearchContext` **保留 window**（ui 不能反向 import pages）。

---

## 5. 同 bundle 真环的拆解设计

### 5.1 app 层（4 条）

```
main ──import──> router/app-init.ts <──import── router/index.ts
  │                      ^
  └──import──> pages/search/index.ts ──import──> core/state.ts <──import── main
```

- **`core/state.ts` 承接**：`activeSourceFilter`、`lastAllResults`、`searchFilterConfig`、`searchReady`、`lastMoviesState`（只读快照）。
- **`router/app-init.ts` 承接**：`AppInit`（`PHASES/register/run/reset`），`main` 与 `router` 都 import。
- **`setupEmailClickHandlers`**：从 `main.ts` 迁到 `ui/email-links.ts`（`ui` 层）；`main` 注册 `email-handler` 任务，`router` 不再引用。若不想新增文件，可暂时保留 window 桥。
- **`search ↔ bridge`**：只把 `playDirectly` 改成 import；`cacheSearchContext` 保留 window，因为 bridge 在 ui 层，规则不允许 ui → pages。

### 5.2 player 层（6 个运行时环 + 2 个类型环）

新增 4 个叶子模块（均在 `src/ui/player/`，不新建层）：

| 新文件 | 承接 | 依赖 |
|---|---|---|
| `state.ts` | 15 个可变状态 + `PlayerArtInstance` 类型 + `setXxx()` + `setEpisodeAdvanceHandler` | 仅 `import type` 自 `core.ts` |
| `session.ts` | `getVideoId`、`saveToHistory`、`saveCurrentProgress`、`startProgressSaveInterval`、`updateMediaSession`、`clearVideoProgress` | `state`、`core/storage`、`core/config` |
| `utils.ts` | `escHtml`（以及后续纯函数） | 无 |
| `navigation.ts` | `goHome` | `state`、`core/timing` |

拆完后的 import 方向（单向、无环）：

```
state / utils / session / navigation   （叶子）
      ↑        ↑        ↑
   core   manager   quality
      ↑
  episodes ──> core(initPlayer)
      ↑
    ui  ──> episodes(playNextEpisode)
      ↑
   detail ──> ui
      ↑
   shortcuts
      ↑
   index（player 入口，只向下 import）
```

`state.ts` 的 API 形态（推荐）：

```ts
export let art: PlayerArtInstance | null = null;
export function setArt(v: PlayerArtInstance | null): void { art = v; }
```

- 读方 `import { art }` 直接沿用原表达式（ESM live binding）。
- 写方只改赋值语句为 `setArt(...)`；全 player 共 30 处写点（已逐文件统计）。
- 不引入 `state.art` 对象，避免 100+ 处读引用改写。

### 5.3 跨层/跨 bundle 边界（不拆，保留 window）

| 边界 | 原因 | 保留的全局 |
|---|---|---|
| `core/global` → `main` | core 不能依赖 app | `AppInit`、`LeLeTV.AppInit` |
| `ui/player/bridge` ↔ `player/index` | 两个 bundle，整页导航 | 播放状态 getter/setter、`playVideo`、`DetailData` |
| `services → ui/toast` | services 不能 import ui | `showToast/showModal/showLoading/hideLoading` |
| `services → ui/index` | 同上 | `showImportBox/showSourceImportBox` |
| `pages/search → router` | pages 不能 import router | `switchPage/dissolveThenRemove/...` |
| `services/tmdb → router` | services 不能 import router | `switchPage` |
| `services/viewing-history → router` | 同上 | `dissolveThenRemove` |
| `services/version-updater → router` | 同上 | `parseChangelogMarkdown` |
| `services/line-probe → ui/player/core` | services 不能 import ui | `shouldUseNativeHls`（或下沉 core，见 §13） |
| `router → services` | router 白名单只有 core/pages | `TMDB_STATE/initTmdbCategory/saveTmdbScroll/loadViewingHistory` |
| `pages/settings → router` | pages 不能 import router | `shareInviteInfo`（当前已是 `window.*`） |

> 这些桥在 5B-5 不会被删除，只收敛为「跨层契约」白名单并加注释。是否放宽分层规则见 §13 的决策 1。

---

## 6. 分层冲突清单（5B-3 的前置）

按 `.agents/rules/01-layering.md` 与 `scripts/check-deps.js`，以下现有引用**改成 import 会直接失败**：

| 方向 | 文件 | 符号 | 处理建议 |
|---|---|---|---|
| services → ui | `services/config.ts` | `showToast/showModal/showLoading/hideLoading/showImportBox` | 保留 window；或 toast 下沉 core |
| services → ui | `services/sources/config.ts`、`sources/port.ts` | `showToast/showModal/showSourceImportBox` | 同上 |
| services → ui | `services/viewing-history.ts` | `formatTimestamp/formatPlaybackTime` | 两个函数是纯格式化，下沉 `core/timing.ts` 后 import |
| services → ui | `services/line-probe.ts` | `shouldUseNativeHls` | 下沉 `core/http.ts` 或新 `core/env.ts` |
| services → pages | `services/tmdb.ts` | `_cardImgFallback` | 下沉 `services/tmdb.ts` 内部或 `core/` |
| services → router | `services/tmdb.ts` | `switchPage` | 保留 window；或回调注册 |
| services → router | `services/viewing-history.ts` | `dissolveThenRemove` | 保留 window；或回调注册 |
| services → router | `services/version-updater.ts` | `parseChangelogMarkdown` | 下沉 `core/markdown.ts`（纯函数） |
| services → router | `services/tmdb.ts` | `LeLePages` | 保留 window |
| ui → services | `ui/player/ui.ts` | `searchByAPIAndKeyWord`、`SearchResultItem` | 保留 window；类型可下沉 core |
| ui → services | `ui/player/index.ts`、`detail.ts`、`ui.ts` | `ViewingHistoryItem` | 类型下沉 `core/storage.ts` |
| ui → pages | `ui/player/bridge.ts` | `cacheSearchContext` | 保留 window |
| pages → pages | `pages/search/index.ts` | `_moviesState`（category） | 抽到 `core/state.ts` |
| pages → pages | `pages/category/index.ts` | `MergeGroup`（search/cards） | 类型下沉 `core/` 或 `services/` |
| pages → main | `pages/search/index.ts` | `_activeSourceFilter` 等 | 抽到 `core/state.ts` |
| router → main | `router/index.ts` | `AppInit/setupEmailClickHandlers` | 抽到 `router/app-init.ts` / `ui/` |
| core → services | `core/global.ts` | `selectedAPIs/customAPIs` | 抽到 `core/state.ts` |
| core → app | `core/global.ts` | `AppInit/PlayerManager` | 保留 window |

---

## 7. 5B-1 设计：`src/core/state.ts`

### 7.1 迁入内容

| 符号 | 现归属 | 迁移方式 |
|---|---|---|
| `ApiSite`（interface）、`API_SITES`、`extendAPISites` | `core/config.ts` | 物理迁入 state；config re-export 保持旧引用 |
| `isHiddenContentMode`、`HIDDEN_MODE_KEY` | `core/config.ts` | 迁入 state；config 的 `scopedKey` import state |
| `selectedAPIs`、`customAPIs`、`CustomApiEntry` | `services/sources/config.ts` | 迁入 state；`sources/config.ts` 保留 window getter/setter 代理 |
| `_activeSourceFilter`、`_lastAllResults`、`_filterConfig`、`_searchReady` | `main.ts` | 迁入 state；main / search / category / bridge 改 import |
| `TMDB_WORKER_URL` | `core/config.ts` | 可留 config 或迁 state；建议留 config（只读、无环） |

### 7.2 API 形态

```ts
export interface ApiSite { /* 从 core/config.ts 原样迁入 */ }
export const API_SITES: Record<string, ApiSite>;
export function extendAPISites(newSites: Record<string, ApiSite>): void;
export function isHiddenContentMode(): boolean;
export function scopedKey(key: string): string;

export let selectedAPIs: string[];
export function setSelectedAPIs(v: string[]): void;
export let customAPIs: CustomApiEntry[];
export function setCustomAPIs(v: CustomApiEntry[]): void;

export let activeSourceFilter: string;
export function setActiveSourceFilter(v: string): void;
export let lastAllResults: SearchResultItem[];
export function setLastAllResults(v: SearchResultItem[]): void;
export let searchFilterConfig: FilterConfig | null;
export let searchReady: boolean;
```

约束：

- `state.ts` **不得** import `services/ui/pages/router`；只允许 `core` 内类型。
- `SearchResultItem` 若定义在 `services/search.ts`，state 不能 import。方案：在 state 内定义最小结构，或把该类型下沉 `core/`（推荐后者，见 §13 决策 3）。
- 旧位置保留兼容层：`core/config.ts` 末尾的可变状态桥改为「读写 state」；`sources/config.ts` 的 `Object.defineProperty(window, 'selectedAPIs', ...)` 改为代理 state 的 getter/setter。5B-3 全部调用方改完后删除。

### 7.3 快速收益

抽 state 后立即消除的边：

- `main ↔ search`（状态与入口分离）
- `main ↔ category`（`_lastAllResults`）
- `category ↔ search`（`_moviesState.results` 通过 state 快照）
- `search ↔ bridge`（`_moviesState` 读取改 state；`cacheSearchContext` 仍保留 window）
- `core/global → sources/config`（selectedAPIs/customAPIs）

---

## 8. 5B-2 设计：`src/ui/player/state.ts`

### 8.1 状态清单与写点

| 状态 | 写点（文件:行） |
|---|---|
| `art` | `core.ts:559`、`manager.ts:83` |
| `currentEpisodeIndex` | `bridge.ts:184`、`episodes.ts:110`、`index.ts:308/349/355/884/920` |
| `currentEpisodes` | `bridge.ts:183`、`index.ts:325/329/354/885/962` |
| `currentVideoTitle` | `bridge.ts:149`、`detail.ts:139`、`index.ts:307/883` |
| `currentVideoUrl` | `episodes.ts:111`、`index.ts:304/919` |
| `episodesReversed` | `bridge.ts:306`、`episodes.ts:184`、`index.ts:351/356` |
| `autoplayEnabled` | `index.ts:311/317` |
| `videoHasEnded` | `core.ts:418/468/475`、`episodes.ts:112` |
| `userClickedPosition` | `episodes.ts:128`、`ui.ts:156` |
| `shortcutHintTimeout` | `ui.ts:81/295` |
| `autoFullscreened` | `core.ts:352/378/382`、`index.ts:9/15` |
| `progressSaveInterval` | `episodes.ts:96`、`index.ts:686` |
| `episodeSwitchTimeout` | `core.ts:150/235/245/403/414`、`episodes.ts:138/139/156` |
| `controlsLocked` | `ui.ts:698` |
| `currentHls` | `manager.ts:52` |

> `bridge.ts` 的写点属于 app bundle，跨 bundle，保持 localStorage/window 写入，不改成 state setter。

### 8.2 类型迁移

- `PlayerArtInstance` 从 `index.ts` 迁入 `state.ts`；`index.ts` re-export 兼容。
- `ArtplayerInstance`、`ArtplayerStatic`、`HlsInstance`、`FailoverApi` 保持在 `core.ts`，state 用 `import type`。
- `DetailData` 留在 `bridge.ts`（跨 bundle 契约）。

### 8.3 回调注册

```ts
let episodeAdvanceHandler: (() => void) | null = null;
export function setEpisodeAdvanceHandler(fn: () => void): void { episodeAdvanceHandler = fn; }
export function advanceEpisode(): void { if (episodeAdvanceHandler) episodeAdvanceHandler(); }
```

- `core.ts` 在自然结束时调用 `advanceEpisode()`（替换 `playNextEpisode()`）。
- `index.ts` 在初始化末尾注册 `setEpisodeAdvanceHandler(playNextEpisode)`。
- 同步调用，行为与当前一致；不引入事件总线或异步。

---

## 9. 5B-3 逐模块顺序

严格按 `core → services → ui → pages → router/main`，每个模块一个 commit：

1. **core**：`state.ts` 落地 → `config.ts` 改 import → `global.ts` → `storage.ts` → `crypto/http/timing/listener-tracker/cache`。
2. **services**：`sources/config` → `sources/remote` → `sources/port` → `balancer` → `api` → `search` → `search-history` → `viewing-history` → `invitation` → `config` → `line-probe` → `tmdb` → `version-updater`。
3. **ui**：`toast` → `index` → `invite-login` → player 叶子（`state/session/utils/navigation`）→ `core/manager/quality/episodes/ui/detail/shortcuts` → `bridge` → player `index` → `pwa-install/layout-pref/nav-scroll/brand-canvas`。
4. **pages**：home 5 个 → search/cards → search/index → category → settings 3 个。
5. **router/main/boot**：`app-init` → `page-loader` → `router/index` → `main` → `boot`。

每个模块完成时必须：

```bash
npm run typecheck && npm run build && npm run check
```

并记录该步后的 bundle 体积（首屏 core+app 必须 ≤ 275 KB）。出现环或体积回退立即 `git revert` 当前 commit，不打补丁。

---

## 10. 5B-4：splitting 与 HTML

构建改造（`scripts/build-bundles.mjs`）：

- 5 个入口一次性交给 `esbuild.build`：`{ entryPoints: [...], bundle: true, splitting: true, format: 'esm', outdir: 'dist', chunkNames: 'chunks/[name]-[hash]', metafile: true }`。
- 入口文件：`core` / `app` / `player` 仍按 `files` 顺序生成临时入口；`category` 用 `entry.ts`；`settings` 生成临时入口。
- 共享 chunk 由 esbuild 决定；`tmdb`、`api`、`search`、`viewing-history`、`core/*` 预计成为多入口共享。
- 构建后从 `metafile` 读取每个入口的 `imports`，把共享 chunk 以 `<link rel="modulepreload">` 注入 HTML。

HTML 改造：

- `src/index.html`、`src/pages/player/index.html` 的入口 `<script>` 改为 `type="module"`（module 自带 defer，删除 `defer`）。
- 保留 `sha256` / `artplayer` / `hls` 的普通 `<script>` 顺序（它们必须在模块求值前就绪）。
- **时序风险**：内联脚本（首帧主题、粒子引擎、邀请码弹窗）目前在 bundle 之前的普通 script 中执行；改为 module 后入口会延迟到 DOM 解析完成，必须在回归中重点检查启动屏、邀请码、主题首帧。
- 若时序无法保持，降级方案：入口保留 `defer` 的 IIFE，仅把按需 bundle 改为 module（不启用 splitting）——但这会放弃 5B-4 的收益，需另行决策。

验收：首屏请求数、瀑布图、core+app ≤ 275 KB、5 个页面回归。

---

## 11. 5B-5：清理

1. `build.config.js`：删除 `files` / `esm` / 特殊 `entry` 分支；保留 `entry` 与 `firstScreen` 预算信息。
2. `build-bundles.mjs`：删除 `concatFiles` 与 concat 回退分支。
3. 全局桥：
   - 删除已被 import 取代的模块间桥（逐模块在 5B-3 删除）。
   - 保留「HTML 内联脚本契约」与「跨层契约」白名单，集中到一个文件/注释块。
4. `check-deps.js`：改为基于真实 import 图的环检测（现有逻辑已支持），并保留「禁止 src 下 .js」检查。
5. `RESUME.md` / `PHASE-5-PLAN.md` 更新为完成状态。

---

## 12. 验证清单

| 步骤 | 命令 / 动作 | 通过标准 |
|---|---|---|
| 5B-1 | `npm run typecheck && npm run build && npm run check` | 全绿；首屏 ≤ 275 KB；首页 / 搜索 / 分类 / 设置回归 |
| 5B-2 | 同上 | 播放页起播 / 选集 / 快捷键 / 关灯 / 返回回归 |
| 5B-3 | 每个模块同上 + 对应页面 reload | 无控制台错误；无 TDZ / undefined |
| 5B-4 | 构建 + 页面 reload + 网络面板 | module 加载顺序正确；共享 chunk 只加载一次；预算守住 |
| 5B-5 | `npm run check` + 全页面回归 | 全局桥白名单之外无残留 |

体积记录表（每步填写）：

| 步骤 | core | app | 首屏 | category | settings | player |
|---|---|---|---|---|---|---|
| 5A 基线 | 47.7 | 190.7 | 238.4 | 19.1 | 40.5 | 94.2 |
| 5B-1 | 47.7 | 190.6 | 238.3 | 19.1 | 40.5 | 94.2 |
| 5B-2 | 47.7 | 190.6 | 238.3 | 19.1 | 40.5 | 94.4 |
| 5B-3（core/services） | 47.6 | 196.9 | 244.4 | 24.0 | 40.5 | 101.2 |
| 5B-3（player 完成） | 47.6 | 196.9 | 244.4 | 24.0 | 40.5 | 107.1 |
| 5B-4 | | | | | | |
| 5B-5 | | | | | | |

---

## 13. 待确认决策

### 决策 1：分层规则的执行口径

- **A（推荐，保守）**：严格遵守 `01-layering.md`。合法方向改 import；反向依赖（services → ui/router、ui → services/pages、pages → pages/router）保留 window 桥并列入白名单。
  - 优点：零规则变更，5B 风险最低。
  - 缺点：5B-5 无法把 window 桥清到零；`showToast` 等 29 处仍是全局。
- **B（彻底）**：把 `toast`、`showModal`、`showImportBox` 等基础 UI 下沉 `core/`，把 `parseChangelogMarkdown`、`shouldUseNativeHls`、`ViewingHistoryItem` 等纯函数/类型下沉 `core/`；只对真正的 UI 交互保留桥。
  - 优点：多数 window 桥可删，import 图更干净。
  - 缺点：多 3–5 个移动 commit，需要额外回归；`core` 会包含 DOM 代码。
- **C（放宽规则）**：允许 ui → services、router → services。需要改 `01-layering.md` 与 `check-deps.js`。
  - 不推荐：会削弱现有架构约束，且与「迁移期不改规则」的基调冲突。

### 决策 2：`toast` 的最终归属

- **A**：留在 `src/ui/toast.ts`，services 的调用保留 window。
- **B**：移到 `src/core/toast.ts`，所有层 import；HTML 内联脚本继续用 `window.showToast`。

### 决策 3：`SearchResultItem` / `ViewingHistoryItem` / `MergeGroup` 类型归属

- **A（推荐）**：下沉 `src/core/storage.ts`（或新建 `src/core/types.ts`），各层 `import type`。
- **B**：保留在 services/pages，跨层引用处保留 window / `declare`。

> 决策 1 与 2 会直接决定 5B-3 的 diff 规模和 5B-5 的白名单；决策 3 只影响 3 个类型。确认后从 5B-1 开始。

---

## 附录 A：符号矩阵（全量跨文件引用）

> 格式：`符号@归属 <- 引用方(次数)`。`(?)` 表示扫描时该文件存在同名局部绑定或同名 interface，已人工复核；误报结论见 §4 / §6。

```text
showToast@ui/toast.ts <- core/cache.ts(3?) , core/global.ts(1) , main.ts(2) , pages/search/index.ts(1) , pages/settings/admin-panel.ts(11) , pages/settings/user-devices.ts(7) , router/index.ts(3) , services/config.ts(7) , services/sources/config.ts(3?) , services/sources/port.ts(8) , ui/invite-login.ts(2?) , ui/player/bridge.ts(6) , ui/player/detail.ts(6) , ui/player/ui.ts(5) , ui/pwa-install.ts(3?)
scopedKey@core/config.ts <- core/global.ts(1) , core/storage.ts(8) , main.ts(1) , pages/home/shelves.ts(2) , router/index.ts(2) , services/balancer.ts(2) , services/config.ts(5) , services/migrate-player-url.ts(1) , services/search-history.ts(4) , services/sources/config.ts(7) , services/sources/port.ts(2) , services/viewing-history.ts(1) , ui/player/ui.ts(1)
isHiddenContentMode@core/config.ts <- pages/home/recent.ts(2) , pages/home/shelves.ts(2) , pages/search/index.ts(1) , router/index.ts(4) , services/sources/config.ts(8) , services/sources/port.ts(4) , services/sources/remote.ts(4) , services/viewing-history.ts(2) , ui/layout-pref.ts(2) , ui/player/ui.ts(1)
API_SITES@core/config.ts <- pages/home/hub-flow.ts(3) , pages/home/shelves.ts(3) , services/api.ts(5) , services/balancer.ts(2) , services/search.ts(6) , services/sources/config.ts(8) , services/sources/port.ts(8) , ui/player/ui.ts(5)
currentEpisodeIndex@ui/player/index.ts <- services/viewing-history.ts(1) , ui/player/bridge.ts(5) , ui/player/core.ts(1) , ui/player/detail.ts(1) , ui/player/episodes.ts(8) , ui/player/shortcuts.ts(2) , ui/player/ui.ts(4)
art@ui/player/index.ts <- ui/player/core.ts(47) , ui/player/episodes.ts(6) , ui/player/manager.ts(2) , ui/player/quality.ts(5?) , ui/player/shortcuts.ts(1) , ui/player/ui.ts(49)
currentEpisodes@ui/player/index.ts <- services/viewing-history.ts(3) , ui/player/bridge.ts(8) , ui/player/core.ts(1) , ui/player/episodes.ts(9) , ui/player/shortcuts.ts(1)
showModal@ui/toast.ts <- services/config.ts(1) , services/sources/config.ts(2?) , services/sources/port.ts(2?) , ui/index.ts(2) , ui/player/detail.ts(1)
TIMING@core/timing.ts <- main.ts(2) , services/api.ts(2) , ui/player/core.ts(10) , ui/player/index.ts(3) , ui/player/ui.ts(2)
ApiSite@core/config.ts <- services/sources/remote.ts(7?) , services/viewing-history.ts(1) , ui/player/failover.ts(1) , ui/player/ui.ts(1)
currentVideoTitle@ui/player/index.ts <- ui/player/bridge.ts(4) , ui/player/core.ts(1) , ui/player/detail.ts(3) , ui/player/ui.ts(5)
playNextEpisode@ui/player/episodes.ts <- ui/player/core.ts(1) , ui/player/index.ts(1) , ui/player/shortcuts.ts(1) , ui/player/ui.ts(2)
customAPIs@services/sources/config.ts <- services/balancer.ts(2?) , services/sources/port.ts(3) , ui/player/ui.ts(2?)
hideLoading@ui/toast.ts <- services/config.ts(2) , ui/player/bridge.ts(3?) , ui/player/ui.ts(3)
PlayerManager@ui/player/manager.ts <- core/global.ts(2) , ui/player/core.ts(4) , ui/player/episodes.ts(2)
selectedAPIs@services/sources/config.ts <- main.ts(2) , services/balancer.ts(3?) , services/sources/port.ts(3)
sha256@core/crypto.ts <- core/http.ts(1) , services/config.ts(2) , services/invitation.ts(1)
shareInviteInfo@router/index.ts <- pages/search/index.ts(1) , pages/settings/admin-panel.ts(2) , pages/settings/user-devices.ts(2)
showError@ui/player/ui.ts <- ui/invite-login.ts(4?) , ui/player/core.ts(2) , ui/player/index.ts(6)
showLoading@ui/toast.ts <- services/config.ts(2) , ui/player/bridge.ts(2?) , ui/player/ui.ts(1)
StorageService@core/storage.ts <- ui/player/detail.ts(6) , ui/player/index.ts(11) , ui/player/ui.ts(4)
updateMediaSession@ui/player/index.ts <- ui/player/core.ts(1) , ui/player/detail.ts(2) , ui/player/episodes.ts(1)
ViewingHistoryItem@services/viewing-history.ts <- ui/player/detail.ts(1) , ui/player/index.ts(4) , ui/player/ui.ts(3)
_moviesState@pages/category/index.ts <- pages/search/index.ts(9) , ui/player/bridge.ts(3)
addAuthToProxyUrl@core/http.ts <- services/api.ts(1) , services/search.ts(1)
API_CONFIG@core/config.ts <- services/api.ts(2) , services/search.ts(7)
applyRemoteApiSitesFromCache@services/sources/remote.ts <- main.ts(2) , ui/player/index.ts(2)
ArtplayerInstance@ui/player/core.ts <- ui/player/index.ts(1) , ui/player/manager.ts(1)
clearVideoProgress@ui/player/ui.ts <- ui/player/core.ts(1) , ui/player/episodes.ts(1)
controlsLocked@ui/player/index.ts <- ui/player/shortcuts.ts(1) , ui/player/ui.ts(15)
currentVideoUrl@ui/player/index.ts <- ui/player/detail.ts(2) , ui/player/episodes.ts(1)
CustomApiEntry@services/sources/config.ts <- services/sources/port.ts(1) , ui/player/ui.ts(1)
DetailData@ui/player/bridge.ts <- ui/player/index.ts(2) , ui/player/ui.ts(2)
dissolveThenRemove@router/index.ts <- pages/search/index.ts(5) , services/viewing-history.ts(1)
episodesReversed@ui/player/index.ts <- ui/player/bridge.ts(7) , ui/player/episodes.ts(6)
episodeSwitchTimeout@ui/player/index.ts <- ui/player/core.ts(15) , ui/player/episodes.ts(6)
HIDDEN_MODE_KEY@core/config.ts <- pages/search/index.ts(1) , services/config.ts(1)
HlsInstance@ui/player/core.ts <- ui/player/manager.ts(3) , ui/player/quality.ts(1)
initAPICheckboxes@services/sources/config.ts <- main.ts(2) , services/sources/port.ts(2)
initPlayer@ui/player/core.ts <- ui/player/episodes.ts(3) , ui/player/index.ts(2)
LeLePages@router/page-loader.ts <- pages/search/index.ts(3) , router/index.ts(4)
ListenerTracker@core/listener-tracker.ts <- core/global.ts(2) , ui/player/manager.ts(4)
openMobileSearch@services/config.ts <- pages/home/nav-search.ts(2) , pages/search/index.ts(1)
PlayerArtInstance@ui/player/index.ts <- ui/player/shortcuts.ts(1) , ui/player/ui.ts(3)
playPreviousEpisode@ui/player/episodes.ts <- ui/player/index.ts(1) , ui/player/shortcuts.ts(1)
PROXY_URL@core/config.ts <- services/api.ts(4) , services/search.ts(6)
renderCustomAPIsList@services/sources/config.ts <- main.ts(1) , services/sources/port.ts(2)
saveToHistory@ui/player/index.ts <- ui/player/core.ts(1) , ui/player/episodes.ts(1)
SEARCH_HISTORY_KEY@core/config.ts <- services/config.ts(2) , services/search-history.ts(4)
setupEmailClickHandlers@main.ts <- pages/search/index.ts(1) , router/index.ts(2)
setupProgressBarPreciseClicks@ui/player/ui.ts <- ui/player/core.ts(1) , ui/player/index.ts(1)
switchPage@router/index.ts <- pages/search/index.ts(2) , services/tmdb.ts(4)
TMDB_WORKER_URL@core/config.ts <- services/tmdb.ts(3) , ui/player/index.ts(3)
tmdbFetch@services/tmdb.ts <- pages/home/recent.ts(2) , pages/home/shelves.ts(2)
userClickedPosition@ui/player/index.ts <- ui/player/episodes.ts(1) , ui/player/ui.ts(1)
videoHasEnded@ui/player/index.ts <- ui/player/core.ts(3) , ui/player/episodes.ts(2)
_activeSourceFilter@main.ts <- pages/search/index.ts(5)
_cardImgFallback@pages/search/cards.ts <- services/tmdb.ts(1)
_filterConfig@main.ts <- pages/search/index.ts(5)
_lastAllResults@main.ts <- pages/search/index.ts(6)
_searchReady@main.ts <- pages/search/index.ts(3)
_timeAgo@pages/settings/user-devices.ts <- pages/settings/admin-panel.ts(1)
addLockFloatingButton@ui/player/ui.ts <- ui/player/core.ts(1)
addNextEpisodeDirectly@ui/player/ui.ts <- ui/player/core.ts(10)
AGGREGATED_SEARCH_CONFIG@core/config.ts <- services/search.ts(3)
AppInit@main.ts <- router/index.ts(9)
applyNewDataSourceLogic@services/sources/config.ts <- main.ts(2)
ArtplayerStatic@ui/player/core.ts <- ui/player/index.ts(1)
autoFullscreened@ui/player/index.ts <- ui/player/core.ts(4)
autoplayEnabled@ui/player/index.ts <- ui/player/core.ts(1)
cacheSearchContext@pages/search/index.ts <- ui/player/bridge.ts(5)
checkHiddenAPIsSelected@services/sources/config.ts <- main.ts(3)
clearLocalStorage@ui/toast.ts <- pages/search/index.ts(1)
clearSearchResidueFromUrl@router/index.ts <- pages/search/index.ts(8)
closeDisclaimerModal@router/index.ts <- pages/search/index.ts(1)
closeInviteGuideModal@router/index.ts <- pages/search/index.ts(1)
closeMobileSearch@services/config.ts <- pages/search/index.ts(6)
closeModal@ui/toast.ts <- pages/search/index.ts(1)
copyLinks@ui/player/ui.ts <- ui/player/index.ts(1)
currentHls@ui/player/index.ts <- ui/player/manager.ts(2)
DATA_SOURCE_LOGIC_VERSION@services/sources/config.ts <- main.ts(1)
escHtml@ui/player/detail.ts <- ui/player/ui.ts(5)
exportConfig@services/config.ts <- pages/search/index.ts(1)
exportVideoSources@services/sources/port.ts <- pages/search/index.ts(1)
FailoverApi@ui/player/core.ts <- ui/player/failover.ts(1)
formatPlaybackTime@ui/toast.ts <- services/viewing-history.ts(1?)
formatTimestamp@ui/toast.ts <- services/viewing-history.ts(1?)
GENRE_MAP@services/tmdb.ts <- pages/home/recent.ts(3)
getDefaultDataSources@services/sources/config.ts <- main.ts(2)
getVideoCover@ui/player/detail.ts <- ui/player/index.ts(1)
getVideoId@ui/player/index.ts <- ui/player/core.ts(1)
getViewingHistory@services/viewing-history.ts <- pages/home/shelves.ts(2)
goHome@ui/player/index.ts <- ui/player/ui.ts(2)
handleKeyboardShortcuts@ui/player/shortcuts.ts <- ui/player/index.ts(1)
handlePageLoad@router/index.ts <- main.ts(2)
HomeShelvesApi@pages/home/shelves.ts <- pages/home/recent.ts(1)
hookInput@pages/search/index.ts <- main.ts(1)
HubFlowApi@pages/home/hub-flow.ts <- pages/home/shelves.ts(2)
HubStage@pages/home/hub-flow.ts <- pages/home/shelves.ts(2)
importConfig@services/config.ts <- pages/search/index.ts(1)
importConfigFromUrl@services/config.ts <- pages/search/index.ts(1)
importVideoSources@services/sources/port.ts <- pages/search/index.ts(1)
initTmdbCategory@services/tmdb.ts <- router/index.ts(2)
InviteAuthApi@pages/settings/user-devices.ts <- ui/invite-login.ts(2?)
InviteAuthApi@ui/invite-login.ts <- pages/settings/user-devices.ts(2?)
isCategoryPageBlocked@router/index.ts <- boot.ts(2)
LeLeTVAdapter@core/global.ts <- main.ts(1)
LoadBalancer@services/balancer.ts <- services/search.ts(1)
loadTmdbResults@services/tmdb.ts <- pages/search/index.ts(1)
loadViewingHistory@services/viewing-history.ts <- router/index.ts(2)
M3U8_PATTERN@core/config.ts <- services/api.ts(1)
MAX_HISTORY_ITEMS@core/config.ts <- services/search-history.ts(2)
MergeGroup@pages/search/cards.ts <- pages/category/index.ts(1)
openDisclaimerModal@router/index.ts <- pages/search/index.ts(1)
openInviteGuideModal@router/index.ts <- pages/search/index.ts(1)
openTmdbCategory@services/tmdb.ts <- pages/search/index.ts(2)
parseChangelogMarkdown@router/index.ts <- services/version-updater.ts(3?)
playDirectly@ui/player/bridge.ts <- pages/search/index.ts(1)
playEpisode@ui/player/episodes.ts <- ui/player/index.ts(1)
playHomeIntro@router/index.ts <- main.ts(2)
playParticleDissolve@router/index.ts <- pages/search/index.ts(2)
playVideo@ui/player/bridge.ts <- ui/player/index.ts(1)
progressSaveInterval@ui/player/index.ts <- ui/player/episodes.ts(3)
rememberPageForReload@router/index.ts <- pages/search/index.ts(1)
renderEpisodes@ui/player/episodes.ts <- ui/player/index.ts(3)
renderPlayerDetailInfo@ui/player/detail.ts <- ui/player/index.ts(4)
renderResourceCurrentSource@ui/player/ui.ts <- ui/player/detail.ts(2)
renderResourceInfoBar@ui/player/detail.ts <- ui/player/index.ts(3)
resetDataSourceLogic@services/sources/config.ts <- pages/search/index.ts(1)
saveBlobAsFile@services/config.ts <- services/sources/port.ts(1)
saveCurrentProgress@ui/player/index.ts <- ui/player/episodes.ts(1)
saveTmdbScroll@services/tmdb.ts <- router/index.ts(2)
SEARCH_CACHE_KEY@pages/search/index.ts <- ui/player/failover.ts(1?)
searchByAPIAndKeyWord@services/search.ts <- ui/player/ui.ts(1)
SearchResultItem@services/search.ts <- ui/player/ui.ts(1)
setupControlsBehavior@ui/player/ui.ts <- ui/player/core.ts(1)
setupEventListeners@pages/search/index.ts <- main.ts(1)
setupLongPressSpeedControl@ui/player/ui.ts <- ui/player/core.ts(1)
setupQualitySwitcher@ui/player/quality.ts <- ui/player/core.ts(2)
shortcutHintTimeout@ui/player/index.ts <- ui/player/ui.ts(7)
shouldUseNativeHls@ui/player/core.ts <- services/line-probe.ts(3?)
showEditVideoInfoModal@ui/player/detail.ts <- ui/player/index.ts(1)
showImportBox@ui/index.ts <- services/config.ts(1)
showPage@router/index.ts <- main.ts(2)
showPositionRestoreHint@ui/player/ui.ts <- ui/player/core.ts(2)
showShortcutHint@ui/player/ui.ts <- ui/player/shortcuts.ts(8)
showSourceImportBox@ui/index.ts <- services/sources/port.ts(3?)
SOURCE_LATENCY_FAST_MS@core/config.ts <- ui/player/ui.ts(1)
SOURCE_LATENCY_SLOW_MS@core/config.ts <- ui/player/ui.ts(1)
startProgressSaveInterval@ui/player/index.ts <- ui/player/core.ts(1)
switchToResource@ui/player/ui.ts <- ui/player/index.ts(1)
TMDB_STATE@services/tmdb.ts <- router/index.ts(4)
TMDB_STATE_KEY@services/tmdb.ts <- router/index.ts(3)
toggleDetailInfo@ui/player/detail.ts <- ui/player/index.ts(1)
toggleEpisodeOrder@ui/player/episodes.ts <- ui/player/index.ts(1)
toggleEpisodeSection@ui/player/detail.ts <- ui/player/index.ts(1)
toggleResourceList@ui/player/ui.ts <- ui/player/index.ts(1)
updateButtonStates@ui/player/episodes.ts <- ui/player/index.ts(3)
updateEpisodeCollapseState@ui/player/detail.ts <- ui/player/index.ts(1)
updateEpisodeInfo@ui/player/episodes.ts <- ui/player/index.ts(3)
updateOrderButton@ui/player/episodes.ts <- ui/player/index.ts(2)
updateResourceSourceCount@ui/player/ui.ts <- ui/player/detail.ts(2)
verifyAdminPassword@services/sources/config.ts <- pages/search/index.ts(1)
```
