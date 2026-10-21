# RESUME — 重构续接状态

> 最后更新：2026-10-21
> 分支：`refactor/slim-arch`
> 基线 tag：`pre-refactor`
> 最新提交：strictNullChecks 分批 3（category / settings 三个文件，见 git log）

---

## 已完成阶段

| 阶段 | 结果 |
|---|---|
| -1 | 勘察 + `INVENTORY.md` 全量登记（迁移前 326 文件） |
| 0 | `scripts/analyze.js`、`docs/REGRESSION.md`、`docs/BASELINE.md` |
| 1 | `01`–`07` 规则、5 个技能、`.ts` 模板、`tsconfig.json`、`check-*` 脚本、`MAP.md` |
| 2 | 模态框 / 邀请码登录 / 导航滚动脚本外置（`index.html` 1636 → 1298 行） |
| 3 | `build.config.js` 单一清单、JSZip 按需加载、路由预取（首屏传输 694 → 365 KB） |
| 4 | **完成：68 / 85 条已验证，69–85 条标 keep**（C-1：不引入 `public/`） |
| 4.5 | **收尾完成**：`js/` 清零（app-init 并入 main.ts，boot-sequence → `src/boot.ts`）；3 个零引用品牌 SVG 保留不删 |
| 5A-2 | **试点完成**：category bundle 改 ESM 入口（`src/pages/category/entry.ts`），21.2 → 19.1 KB；`export + declare global + window` 桥模式验证通过 |
| 5A-3 | **完成**：core bundle（14 文件）切 ESM 入口 + 10 个文件补 window 桥；core 47.8 KB，首屏 263.5 KB |
| 5A-4 | **完成**：app bundle（30 文件）切 ESM 入口 + 14 个文件补桥（可变状态用 getter/setter）；app 190.7 KB，首屏 238.4 KB |
| 5A-5 | **完成**：settings bundle（3 文件）切 ESM 入口；settings 40.5 KB，设置页 / 主题 / 邀请码 / 设备面板回归通过 |
| 5A-6 | **完成**：player bundle（15 文件）切 ESM 入口 + 8 个文件补桥（15 个播放器状态用 getter/setter）；player 94.2 KB |
| 5A-7 | **已达成**：5 个 bundle 全部走 esbuild.build；concat 分支暂留作回退 |
| 5B-1 | **完成（3 个 commit）**：新增 `src/core/state.ts`，收敛 `API_SITES` / 数据域函数 / `selectedAPIs` / `customAPIs` / 搜索状态；旧位置保留 re-export 与 window getter/setter 代理。首屏 238.3 KB |
| 5B-2 | **完成（6 个 commit）**：新增 `ui/player/state.ts`（15 个状态 + 选集 hook）、`session.ts`、`utils.ts`、`navigation.ts`；`core.ts` 改为 import state 并用 `advanceEpisode()` 断开 core→episodes；播放页起播/选集/自动连播/关灯/返回回归通过。player 94.4 KB |
| 5B-3 | **完成（25 个 commit）**：core / services / ui（含 player 与剩余 8 个 ui 模块）/ pages（home 5 个、search/cards、search/index、category、settings 2 个）/ router（page-loader、prefetch、index）/ main / boot 全部改为显式 import。跨页与跨层反向依赖保留 window 契约；`MergeGroup` 等共享类型下沉 `core/state`。首屏 248.5 KB |
| 5B-4 | **完成**：`build-bundles.mjs` 改为多入口 `esbuild.build({ splitting: true, format: 'esm', metafile: true })`；入口 / 共享 chunk 带 hash；HTML 入口改 `type="module"` 并按 metafile 注入 `modulepreload`；动态页面脚本改 module。首屏闭包 253.8 KB |
| 5B-5 | **完成**：删除 `files` / `esm` / concat / 临时入口，5 个 bundle 使用持久入口（`core-entry.ts`、`main.ts`、`category/entry.ts`、`settings/entry.ts`、`player-entry.ts`）；`check-deps` 改为真实 import 图（179 边 / 0 运行时环）并跳过 type-only；`check-budget` 按 metafile 闭包统计；全局桥收敛为 `docs/GLOBAL-BRIDGES.md`。首屏 253.3 KB |
| 类型收紧 1 | **完成**：`tsconfig.json` 开启 `noImplicitAny`；修复 294 处隐式 any（category 94、services 85、router 120、pages/settings 34、search 25、ui 3、home 2）。`npm run typecheck` 全绿，页面回归通过。下一步可评估 `strictNullChecks` |
| strictNullChecks 分批 1 | **完成**：给 `src/services/theme.ts`（66 处）与 `src/ui/player/ui.ts`（58 处）补齐 null 收窄；主题取色器、播放器进度条拖动、长按倍速/快捷键提示回归通过。剩余 305 处，继续按 search/router/player bridge 分批 |
| strictNullChecks 分批 2 | **完成**：`pages/search/index.ts`（45）、`router/index.ts`（37）、`ui/player/bridge.ts`（36）清零；首页启动、搜索、关于/README、播放续播与长按回归通过。剩余 187 处（category 25、settings 35、player detail/index 22、其余 105） |
| strictNullChecks 分批 3 | **完成（3 个 commit）**：`pages/category/index.ts`（25）、`pages/settings/admin-panel.ts`（21）、`pages/settings/user-devices.ts`（14）清零；分类页列表/筛选/分页、设置页邀请码/设备/主题取色器、播放页起播回归通过。剩余 127 处：player 35（detail 12、index 10、core 5、shortcuts 4、episodes 2、quality 1、failover 1）、services 49、pages/home 23、pages/search/cards 6、ui 9、router/page-loader 4、main 1 |

---

## 阶段 4 已完成（MAP 1–64、65–68）

| # | 原路径 | 目标 | 备注 |
|---|---|---|---|
| 1 | `js/core/cache-manager.js` | `src/core/cache.ts` | |
| 2 | `js/core/config.js` | `src/core/config.ts` | `ApiSite.detail` 已补 |
| 3 | `js/auth/password.js` | `src/core/crypto.ts` | |
| 4 | `js/core/leletv-global.js` | `src/core/global.ts` | |
| 5 | `js/auth/proxy-auth.js` | `src/core/http.ts` | 动态 import 已移除 |
| 6 | `js/core/listener-tracker.js` | `src/core/listener-tracker.ts` | |
| 7 | `js/auth/sha256.js` | `src/core/crypto.ts` | **merge，AP-001** |
| 8 | `js/core/storage-service.js` | `src/core/storage.ts` | |
| 9 | `js/core/timing.js` | `src/core/timing.ts` | |
| 10 | `js/filter-config.json` | `src/services/adfilter-config.json` | fetch 路径已同步 |
| 11 | `js/api/api.js` | `src/services/api.ts` | |
| 12 | `js/api/loadBalancer.js` | `src/services/balancer.ts` | |
| 13 | `js/app/app-config.js` | `src/services/config.ts` | JSZip 懒加载 |
| 14 | `js/auth/invite-auth.js` | `src/services/invitation.ts` | |
| 15 | `js/api/api-config.js` | `src/services/sources/config.ts` | 全局脚本，调用方零改动 |
| 16 | `js/api/source-port.js` | `src/services/sources/port.ts` | 导入/导出入口名不变 |
| 17 | `js/api/remote-sources.js` | `src/services/sources/remote.ts` | window 入口名不变 |
| 18 | `js/ui/line-probe.js` | `src/services/line-probe.ts` | LeLeLineProbe 接口不变 |
| 19 | `js/ui/ui-search-history.js` | `src/services/search-history.ts` | 全局函数名不变 |
| 20 | `js/api/search.js` | `src/services/search.ts` | 两个搜索入口名不变 |
| 21 | `js/ui/ui-viewing-history.js` | `src/services/viewing-history.ts` | 公开函数名不变 |
| 22 | `js/ui/theme-system.js` | `src/services/theme.ts` | 主题接口不变 |
| 23 | `js/utils/version-updater.js` | `src/services/version-updater.ts` | window 入口不变 |
| 24 | `js/api/tmdb.js` | `src/services/tmdb.ts` | TMDB 全局状态与配置不变 |
| 25 | `js/ui/brand-canvas.js` | `src/ui/brand-canvas.ts` | LeLeBrandCanvas.draw 接口不变 |
| 26 | `js/ui/ui.js` | `src/ui/index.ts` | 导入弹窗入口不变 |
| 27 | `js/ui/layout-pref.js` | `src/ui/layout-pref.ts` | LeLeLayout 接口不变 |
| 28 | `js/ui/motion-pref.js` | `src/ui/motion-pref.ts` | LeLeMotion 接口不变 |
| 29 | `js/player/player-bridge.js` | `src/ui/player/bridge.ts` | 公开函数与全局播放状态不变 |
| 30 | `js/player/player-core.js` | `src/ui/player/core.ts` | 公开函数不变，libs 接口本地声明 |
| 31 | `js/player/player-detail.js` | `src/ui/player/detail.ts` | 公开函数不变 |
| 32 | `js/player/player-episodes.js` | `src/ui/player/episodes.ts` | 公开函数不变 |
| 33 | `js/player/player-failover.js` | `src/ui/player/failover.ts` | LeLeFailover 接口不变 |
| 34 | `js/player/player.js` | `src/ui/player/index.ts` | 全局播放状态与入口函数不变 |
| 35 | `js/player/player-lights.js` | `src/ui/player/lights.ts` | LeLeLights 接口不变 |
| 36 | `js/player/player-manager.js` | `src/ui/player/manager.ts` | PlayerManager 接口不变 |
| 37 | `js/player/player-quality.js` | `src/ui/player/quality.ts` | 清晰度切换接口不变 |
| 38 | `js/player/player-shortcuts.js` | `src/ui/player/shortcuts.ts` | 快捷键行为不变 |
| 39 | `js/player/player-ui.js` | `src/ui/player/ui.ts` | 覆盖层与切源行为不变 |
| 40 | `js/ui/pwa-install.js` | `src/ui/pwa-install.ts` | `window.LeLePwa` 接口不变 |
| 41 | `js/ui/ui-core.js` | `src/ui/toast.ts` | 全局函数名不变 |
| 42 | `pages/about.html` | `src/pages/about/template.html` | FRAGMENTS 映射已同步，fetch 路径为 `src/pages/about/template.html` |
| 43 | `js/ui/movies-page.js` | `src/pages/category/index.ts` | 全局入口与 `_moviesState` 读取方式不变 |
| 44 | `pages/category.html` | `src/pages/category/template.html` | FRAGMENTS 映射已同步 |
| 45 | `pages/history.html` | `src/pages/history/template.html` | FRAGMENTS 映射已同步 |
| 46 | `js/ui/hero-glass.js` | `src/pages/home/hero-glass.ts` | 光效行为不变 |
| 47 | `js/effects/hub-flow.js` | `src/pages/home/hub-flow.ts` | `window.HubFlow` 接口不变 |
| 48 | `js/ui/nav-search.js` | `src/pages/home/nav-search.ts` | 桌面展开 / 移动搜索层行为不变 |
| 49 | `js/ui/home-recent.js` | `src/pages/home/recent.ts` | `window.HomeRecent` 接口不变 |
| 50 | `js/ui/home-shelves.js` | `src/pages/home/shelves.ts` | `window.HomeShelves` 接口不变 |
| 51 | `css/v2/home.css` | `src/pages/home/style.css` | 相对图片路径改为 `../../../image/*`，CRITICAL_STYLES 与 bump-version 已同步 |
| 52 | `pages/movies.html` | `src/pages/movies/template.html` | FRAGMENTS 映射已同步 |
| 53 | `player.html` | `src/pages/player/index.html` | 页面内资源改绝对路径；构建 / 版本 / server 路由同步；旧观看记录由 `src/services/migrate-player-url.ts` 启动时改写 |
| 54 | `css/v2/player.css` | `src/pages/player/style.css` | HTML link 已同步 |
| 55 | `pages/readme.html` | `src/pages/readme/template.html` | FRAGMENTS 映射已同步 |
| 56 | `js/ui/search-cards.js` | `src/pages/search/cards.ts` | 卡片渲染与排序函数不变；分享链接指向新播放页 |
| 57 | `js/app/app-search.js` | `src/pages/search/index.ts` | 全局搜索入口与事件绑定不变 |
| 58 | `js/auth/admin-panel.js` | `src/pages/settings/admin-panel.ts` | 面板接口不变；与 user-devices 完全相同的重复 helper 已去重 |
| 59 | `css/v2/admin.css` | `src/pages/settings/style.css` | page-loader STYLES 已同步 |
| 60 | `pages/settings.html` | `src/pages/settings/template.html` | FRAGMENTS 映射已同步 |
| 61 | `js/auth/user-devices.js` | `src/pages/settings/user-devices.ts` | 面板接口不变 |
| 62 | `js/app/app-routing.js` | `src/router/index.ts` | 路由与切页行为不变 |
| 63 | `js/app/page-loader.js` | `src/router/page-loader.ts` | `LeLePages` 接口不变 |
| 64 | `index.html` | `src/index.html` | 源迁入 `src/`，根 `index.html` 由 `build-bundles.mjs` 装配生成；Pages 入口与部署配置未改 |
| 65 | `js/app/app.js` | `src/main.ts` | 全局入口与启动信号不变 |
| 66 | `css/v2/base.css` | `src/styles/base.css` | HTML link 与 CRITICAL_STYLES 已同步 |
| 67 | `css/v2/tokens.css` | `src/styles/variables.css` | HTML link、CRITICAL_STYLES 与注释已同步 |
| 68 | `css/v2/views.css` | `src/styles/views.css` | page-loader STYLES 与 orphans 白名单已同步 |

---

## 下一步

**阶段 4 队列已完结。** 2026-10-21 用户确认的处理结果：

| 条目 | 结论 |
|---|---|
| 64 | **已解禁并完成（方案 A）**：`src/index.html` 为唯一手工编辑源，`build-bundles.mjs` 装配根 `index.html`；Pages 入口、`_headers`、`_routes.json`、`manifest.json` 均未改动 |
| 69–85 | **保持暂缓并标 keep**：与 C-1 一致，不引入 `public/`，字体 / 图标 / logo / manifest 保留 `/libs` 与 `/image` 原路径 |

> `pages/` 目录已清空；`js/` 已清零（app-init 并入 `src/main.ts`，boot-sequence → `src/boot.ts`）。
> styles 层已全部迁入 `src/styles/`；入口层 `index.html` 已迁入 `src/index.html`。

> 已知非迁移问题：本地 Express 的 `renderPage` 只替换第一处 `{{TMDB_WORKER_URL}}`，
> 播放页 `window.__ENV__.TMDB_WORKER_URL` 仍为占位符（迁移前同样存在），线上由 Pages Functions 注入。

阶段 5A 已完成：5 个 bundle 全部走 esbuild.build。
阶段 5B-2 已完成：`ui/player/state.ts` 等叶子模块落地，core 用 hook 断开 episodes。
阶段 5B-3 / 5B-4 / 5B-5 已完成：全部模块显式 import、多入口 ESM splitting、files/concat 清理。
下一步：阶段 6（待规划）。当前基线为 5B-5 构建；新会话开场读本文件与
`PHASE-5-GRAPH.md`、`docs/GLOBAL-BRIDGES.md` → `npm start` 启动一次服务器。
回归重点：启动屏 / 邀请码 / 主题首帧（module 入口默认 defer，不能再假设脚本同步执行）；
跨页 `window.*` 函数必须在调用时读取，不能在模块顶层解构。

---

## 硬约束

1. 顺序：`core → services → ui → pages → router`。
2. **一次只迁一条**，每条独立 commit，可单独 revert。
3. 迁移 commit 只允许"位置 + 引用路径 + 类型注解"，禁止夹带行为/UI/删除变更。
4. 禁止 `any` / `as any` / `@ts-ignore`。
5. 删除或合并必须先在 `APPROVALS.md` 登记（AP-001 已用于 `sha256.js`）。
6. 类型检查失败即 revert 当前条目，不打补丁绕过。

---

## 验证命令

```bash
npm run typecheck      # tsc --noEmit
npm run check          # deps + budget + agents + coverage + tsc
npm run build          # 构建 5 个 bundle
node scripts/analyze.js --out docs/BASELINE-stage3.md
npm run check:orphans  # 只报告，不删除
```

基线（5B-5）：首屏 core+app 依赖闭包 **253.3 KB**（预算 275 KB）；入口体积 core **29.7 KB** / app **151.8 KB** / category **0.2 KB** / settings **40.4 KB** / player **60.9 KB**；闭包 core 48.4 / app 219.7 / category 24.8 / settings 40.6 / player 111.8；共享 chunk 7 个（最大 33.9 KB）；`src/` 67 文件 / 182 条 import 边 / 0 运行时环；`js/` 剩余 `.js` **0**。

---

## 关键决策（C-1～C-6 已在 PHASE-1-REPORT 12.1 落档）

- 保持 Cloudflare Pages 构建输出目录 `/`，不引入 `public/`，不改 `wrangler.toml`。
- 接受重写构建链路；阶段 3 已建立 `build.config.js` 单一清单，但仍是字符串拼接 + `esbuild.transform`，真正的 ESM splitting 留到全部 `js/` 迁移完成后。
- 保留 PWA 安装到桌面；`service-worker.js` 继续作为 kill-switch，不做离线缓存。
- `docs/` 已纳入版本控制。
- 现有资产（`libs/`、`server.mjs`、`_routes.json`、`scripts/brand/`、19 个技能）保持 `keep`。

---

## 注意事项

- 根 `index.html` 是构建产物：只改 `src/index.html`，然后跑 `npm run build`；直接改根文件会被覆盖。
- `src/` 同时是源码与静态资源目录：`/src/services/adfilter-config.json` 由运行时 `fetch` 提供。
- `src/core/http.ts` 不再动态 import sha256，统一使用 `src/core/crypto.ts` 的全局 `sha256`。
- `check-coverage.js` 允许已完成的 `migrated` / `merge` / `delete` 原路径不存在。
- 提交前若 `git diff --cached --check` 报行尾空格，先用 `sed -i 's/[[:space:]]*$//' <file>` 清理。
- pre-commit 钩子会检测 `js/` 变更并自动构建 bundle。
