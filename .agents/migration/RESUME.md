# RESUME — 重构续接状态

> 最后更新：2026-10-21
> 分支：`refactor/slim-arch`
> 基线 tag：`pre-refactor`
> 最新提交：`361c7b5 refactor: 迁移 search-cards 到 src/pages/search/cards.ts`

---

## 已完成阶段

| 阶段 | 结果 |
|---|---|
| -1 | 勘察 + `INVENTORY.md` 全量登记（迁移前 326 文件） |
| 0 | `scripts/analyze.js`、`docs/REGRESSION.md`、`docs/BASELINE.md` |
| 1 | `01`–`07` 规则、5 个技能、`.ts` 模板、`tsconfig.json`、`check-*` 脚本、`MAP.md` |
| 2 | 模态框 / 邀请码登录 / 导航滚动脚本外置（`index.html` 1636 → 1298 行） |
| 3 | `build.config.js` 单一清单、JSZip 按需加载、路由预取（首屏传输 694 → 365 KB） |
| 4 | **进行中：56 / 85 条已验证** |

---

## 阶段 4 已完成（MAP 1–56）

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

---

## 下一步

**MAP 第 57 条**：`js/app/app-search.js → src/pages/search/index.ts`

之后：

- 第 58–60 条 settings 页（admin-panel / admin.css / settings.html）
- pages 层共 20 条，再 router（2）、entry（2）、styles（3）、public（17）

> 已知非迁移问题：本地 Express 的 `renderPage` 只替换第一处 `{{TMDB_WORKER_URL}}`，
> 播放页 `window.__ENV__.TMDB_WORKER_URL` 仍为占位符（迁移前同样存在），线上由 Pages Functions 注入。

新会话开场：读本文件 → `npm start` 启动一次服务器 → 从第 57 条继续。

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

基线：首屏 core+app **266.6 KB**（预算 275 KB）；`js/` 剩余 `.js` **8**；tracked 370 / inventory 426。

---

## 关键决策（C-1～C-6 已在 PHASE-1-REPORT 12.1 落档）

- 保持 Cloudflare Pages 构建输出目录 `/`，不引入 `public/`，不改 `wrangler.toml`。
- 接受重写构建链路；阶段 3 已建立 `build.config.js` 单一清单，但仍是字符串拼接 + `esbuild.transform`，真正的 ESM splitting 留到全部 `js/` 迁移完成后。
- 保留 PWA 安装到桌面；`service-worker.js` 继续作为 kill-switch，不做离线缓存。
- `docs/` 已纳入版本控制。
- 现有资产（`libs/`、`server.mjs`、`_routes.json`、`scripts/brand/`、19 个技能）保持 `keep`。

---

## 注意事项

- `src/` 同时是源码与静态资源目录：`/src/services/adfilter-config.json` 由运行时 `fetch` 提供。
- `src/core/http.ts` 不再动态 import sha256，统一使用 `src/core/crypto.ts` 的全局 `sha256`。
- `check-coverage.js` 允许已完成的 `migrated` / `merge` / `delete` 原路径不存在。
- 提交前若 `git diff --cached --check` 报行尾空格，先用 `sed -i 's/[[:space:]]*$//' <file>` 清理。
- pre-commit 钩子会检测 `js/` 变更并自动构建 bundle。
