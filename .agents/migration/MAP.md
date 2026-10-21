# MAP — 迁移任务队列

> 状态：`pending` / `migrated` / `keep` / `delete` / `merge` / `suspected-unused` / `verified`。
>
> 顺序硬约束：**core → services → ui → pages → router**；下层未完成类型化前不得开始上层。
>
> 一次只迁一条；迁移 commit 只体现"位置 + 引用 + 类型注解"，禁止夹带行为变更或删除。
>
> 每条对应 `INVENTORY.md` 的 `migrated` 记录；完成后同步两边状态。

## 汇总

| 层 | 条目数 | 已完成 | 剩余 |
|---|---|---|---|
| core（通用 / 核心工具） | 9 | 0 | 9 |
| services（服务层） | 15 | 0 | 15 |
| ui（UI 组件 / 播放器） | 17 | 0 | 17 |
| pages（页面） | 20 | 0 | 20 |
| router（路由） | 2 | 0 | 2 |
| entry（入口 / 应用壳） | 2 | 0 | 2 |
| styles（样式） | 3 | 0 | 3 |
| public（静态资源） | 17 | 0 | 17 |
| **合计** | **85** | **0** | **85** |

## 队列

| # | 层 | 原路径 | 目标路径 | 状态 | 回归项 | 备注 |
|---|---|---|---|---|---|---|
| 1 | core | `js/core/cache-manager.js` | `src/core/cache.ts` | verified | 第 0 节通用前置 | — |
| 2 | core | `js/core/config.js` | `src/core/config.ts` | verified | 第 0 节通用前置 | — |
| 3 | core | `js/auth/password.js` | `src/core/crypto.ts` | verified | 第 0 节通用前置 | — |
| 4 | core | `js/core/leletv-global.js` | `src/core/global.ts` | verified | 第 0 节通用前置 | — |
| 5 | core | `js/auth/proxy-auth.js` | `src/core/http.ts` | verified | 第 0 节通用前置 | — |
| 6 | core | `js/core/listener-tracker.js` | `src/core/listener-tracker.ts` | verified | 第 0 节通用前置 | — |
| 7 | core | `js/auth/sha256.js` | `src/core/crypto.ts` | verified | 第 0 节通用前置 | 已合并（AP-001） |
| 8 | core | `js/core/storage-service.js` | `src/core/storage.ts` | verified | 第 0 节通用前置 | — |
| 9 | core | `js/core/timing.js` | `src/core/timing.ts` | verified | 第 0 节通用前置 | — |
| 10 | services | `js/filter-config.json` | `src/services/adfilter-config.json` | verified | 第 6 节 广告过滤 | fetch 路径已同步 |
| 11 | services | `js/api/api.js` | `src/services/api.ts` | verified | 第 5 / 9 节 搜索与详情 | — |
| 12 | services | `js/api/loadBalancer.js` | `src/services/balancer.ts` | verified | 第 5 节 负载均衡 | — |
| 13 | services | `js/app/app-config.js` | `src/services/config.ts` | verified | 第 10 节 配置导入导出 | — |
| 14 | services | `js/auth/invite-auth.js` | `src/services/invitation.ts` | verified | 第 1 节 邀请码与准入 | — |
| 15 | services | `js/ui/line-probe.js` | `src/services/line-probe.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，LeLeLineProbe 接口不变 |
| 16 | services | `js/ui/ui-search-history.js` | `src/services/search-history.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，调用方零改动 |
| 17 | services | `js/api/search.js` | `src/services/search.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，调用方零改动 |
| 18 | services | `js/api/api-config.js` | `src/services/sources/config.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，调用方零改动 |
| 19 | services | `js/api/source-port.js` | `src/services/sources/port.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，调用方零改动 |
| 20 | services | `js/api/remote-sources.js` | `src/services/sources/remote.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，window 入口不变 |
| 21 | services | `js/ui/theme-system.js` | `src/services/theme.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，主题接口不变 |
| 22 | services | `js/api/tmdb.js` | `src/services/tmdb.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，services 层收尾 |
| 23 | services | `js/utils/version-updater.js` | `src/services/version-updater.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，window 入口不变 |
| 24 | services | `js/ui/ui-viewing-history.js` | `src/services/viewing-history.ts` | verified | 对应功能节（2 / 5 / 6 / 9） | 2026-10-21 迁移完成，调用方零改动 |
| 25 | ui | `js/ui/brand-canvas.js` | `src/ui/brand-canvas.ts` | verified | 第 0 节通用前置 | 2026-10-21 迁移完成 |
| 26 | ui | `js/ui/ui.js` | `src/ui/index.ts` | verified | 第 0 节通用前置 | 2026-10-21 迁移完成 |
| 27 | ui | `js/ui/layout-pref.js` | `src/ui/layout-pref.ts` | verified | 第 0 节通用前置 | 2026-10-21 迁移完成 |
| 28 | ui | `js/ui/motion-pref.js` | `src/ui/motion-pref.ts` | verified | 第 0 节通用前置 | 2026-10-21 迁移完成 |
| 29 | ui | `js/player/player-bridge.js` | `src/ui/player/bridge.ts` | verified | 第 7 节 播放器 | 2026-10-21 迁移完成 |
| 30 | ui | `js/player/player-core.js` | `src/ui/player/core.ts` | verified | 第 7 节 播放器 | 2026-10-21 迁移完成 |
| 31 | ui | `js/player/player-detail.js` | `src/ui/player/detail.ts` | verified | 第 7 节 播放器 | 2026-10-21 迁移完成 |
| 32 | ui | `js/player/player-episodes.js` | `src/ui/player/episodes.ts` | verified | 第 7 节 播放器 | 2026-10-21 迁移完成 |
| 33 | ui | `js/player/player-failover.js` | `src/ui/player/failover.ts` | verified | 第 7 节 播放器 | 2026-10-21 迁移完成 |
| 34 | ui | `js/player/player.js` | `src/ui/player/index.ts` | verified | 第 7 节 播放器 | 2026-10-21 迁移完成 |
| 35 | ui | `js/player/player-lights.js` | `src/ui/player/lights.ts` | pending | 第 7 节 播放器 | — |
| 36 | ui | `js/player/player-manager.js` | `src/ui/player/manager.ts` | pending | 第 7 节 播放器 | — |
| 37 | ui | `js/player/player-quality.js` | `src/ui/player/quality.ts` | pending | 第 7 节 播放器 | — |
| 38 | ui | `js/player/player-shortcuts.js` | `src/ui/player/shortcuts.ts` | pending | 第 7 节 播放器 | — |
| 39 | ui | `js/player/player-ui.js` | `src/ui/player/ui.ts` | pending | 第 7 节 播放器 | — |
| 40 | ui | `js/ui/pwa-install.js` | `src/ui/pwa-install.ts` | pending | 第 0 节通用前置 | — |
| 41 | ui | `js/ui/ui-core.js` | `src/ui/toast.ts` | pending | 第 0 节通用前置 | — |
| 42 | pages | `pages/about.html` | `src/pages/about/template.html` | pending | 第 8 节 页面导航 | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 43 | pages | `js/ui/movies-page.js` | `src/pages/category/index.ts` | pending | 第 8 节 页面导航 | — |
| 44 | pages | `pages/category.html` | `src/pages/category/template.html` | pending | 第 8 节 页面导航 | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 45 | pages | `pages/history.html` | `src/pages/history/template.html` | pending | 第 8 节 页面导航 | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 46 | pages | `js/ui/hero-glass.js` | `src/pages/home/hero-glass.ts` | pending | 第 8 节 页面导航 | — |
| 47 | pages | `js/effects/hub-flow.js` | `src/pages/home/hub-flow.ts` | pending | 第 8 节 页面导航 | — |
| 48 | pages | `js/ui/nav-search.js` | `src/pages/home/nav-search.ts` | pending | 第 8 节 页面导航 | — |
| 49 | pages | `js/ui/home-recent.js` | `src/pages/home/recent.ts` | pending | 第 8 节 页面导航 | — |
| 50 | pages | `js/ui/home-shelves.js` | `src/pages/home/shelves.ts` | pending | 第 8 节 页面导航 | — |
| 51 | pages | `css/v2/home.css` | `src/pages/home/style.css` | pending | 第 8 节 页面导航 | — |
| 52 | pages | `pages/movies.html` | `src/pages/movies/template.html` | pending | 第 8 节 页面导航 | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 53 | pages | `player.html` | `src/pages/player/index.html` | pending | 第 8 节 页面导航 | — |
| 54 | pages | `css/v2/player.css` | `src/pages/player/style.css` | pending | 第 8 节 页面导航 | — |
| 55 | pages | `pages/readme.html` | `src/pages/readme/template.html` | pending | 第 8 节 页面导航 | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 56 | pages | `js/ui/search-cards.js` | `src/pages/search/cards.ts` | pending | 第 8 节 页面导航 | — |
| 57 | pages | `js/app/app-search.js` | `src/pages/search/index.ts` | pending | 第 8 节 页面导航 | — |
| 58 | pages | `js/auth/admin-panel.js` | `src/pages/settings/admin-panel.ts` | pending | 第 8 节 页面导航 | — |
| 59 | pages | `css/v2/admin.css` | `src/pages/settings/style.css` | pending | 第 8 节 页面导航 | page-loader.js 运行时插入 <link>，属动态引用白名单 |
| 60 | pages | `pages/settings.html` | `src/pages/settings/template.html` | pending | 第 8 节 页面导航 | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 61 | pages | `js/auth/user-devices.js` | `src/pages/settings/user-devices.ts` | pending | 第 8 节 页面导航 | — |
| 62 | router | `js/app/app-routing.js` | `src/router/index.ts` | pending | 第 8 节 页面导航 | — |
| 63 | router | `js/app/page-loader.js` | `src/router/page-loader.ts` | pending | 第 8 节 页面导航 | — |
| 64 | entry | `index.html` | `src/index.html` | pending | 第 0 节通用前置 | — |
| 65 | entry | `js/app/app.js` | `src/main.ts` | pending | 第 0 节通用前置 | — |
| 66 | styles | `css/v2/base.css` | `src/styles/base.css` | pending | 第 4 节 主题 | — |
| 67 | styles | `css/v2/tokens.css` | `src/styles/variables.css` | pending | 第 4 节 主题 | — |
| 68 | styles | `css/v2/views.css` | `src/styles/views.css` | pending | 第 4 节 主题 | page-loader.js 运行时插入 <link>，属动态引用白名单 |
| 69 | public | `libs/geist/Geist-Bold.woff2` | `public/fonts/Geist-Bold.woff2` | pending | 第 3 节 PWA / 资源 | — |
| 70 | public | `libs/geist/Geist-Medium.woff2` | `public/fonts/Geist-Medium.woff2` | pending | 第 3 节 PWA / 资源 | — |
| 71 | public | `libs/geist/Geist-Regular.woff2` | `public/fonts/Geist-Regular.woff2` | pending | 第 3 节 PWA / 资源 | — |
| 72 | public | `libs/geist/Geist-SemiBold.woff2` | `public/fonts/Geist-SemiBold.woff2` | pending | 第 3 节 PWA / 资源 | — |
| 73 | public | `image/brand/apple-touch-icon-180.png` | `public/icons/apple-touch-icon-180.png` | pending | 第 3 节 PWA / 资源 | — |
| 74 | public | `image/brand/favicon-32.png` | `public/icons/favicon-32.png` | pending | 第 3 节 PWA / 资源 | — |
| 75 | public | `image/brand/leletv-app-icon-maskable.svg` | `public/icons/leletv-app-icon-maskable.svg` | pending | 第 3 节 PWA / 资源 | — |
| 76 | public | `image/brand/leletv-app-icon.svg` | `public/icons/leletv-app-icon.svg` | pending | 第 3 节 PWA / 资源 | — |
| 77 | public | `image/brand/leletv-favicon.svg` | `public/icons/leletv-favicon.svg` | pending | 第 3 节 PWA / 资源 | — |
| 78 | public | `image/brand/leletv-icon-192.png` | `public/icons/leletv-icon-192.png` | pending | 第 3 节 PWA / 资源 | — |
| 79 | public | `image/brand/leletv-icon-512.png` | `public/icons/leletv-icon-512.png` | pending | 第 3 节 PWA / 资源 | — |
| 80 | public | `image/brand/leletv-icon-maskable-192.png` | `public/icons/leletv-icon-maskable-192.png` | pending | 第 3 节 PWA / 资源 | — |
| 81 | public | `image/brand/leletv-icon-maskable-512.png` | `public/icons/leletv-icon-maskable-512.png` | pending | 第 3 节 PWA / 资源 | — |
| 82 | public | `image/brand/leletv-mark-currentcolor.svg` | `public/icons/leletv-mark-currentcolor.svg` | pending | 第 3 节 PWA / 资源 | — |
| 83 | public | `image/logo-black.png` | `public/images/logo-black.png` | pending | 第 3 节 PWA / 资源 | — |
| 84 | public | `image/logo.png` | `public/images/logo.png` | pending | 第 3 节 PWA / 资源 | — |
| 85 | public | `manifest.json` | `public/manifest.json` | pending | 第 3 节 PWA / 资源 | — |

## 状态流转

```
pending ──迁移+类型化通过──> migrated ──回归通过──> verified
   │                                              │
   └── 失败：revert 当前条目 <─────────────────────┘
```

> `suspected-unused` 不在本队列；只在阶段 4.5 由 `CLEANUP.md` 与 `APPROVALS.md` 处理。
