# 构建体积基线

> 生成命令：`node scripts/analyze.js`
>
> 版本：`v4.1.2`
>
> 生成时间：2026-10-21

## 口径说明

- **原始**：源文件字节数之和。
- **模块 minified**：每个源文件单独交给 `esbuild.transform({ minify: true })` 后的字节数，用于模块间排序，不等于最终 bundle 体积。
- **bundle minified**：与 `scripts/build-bundles.mjs` 相同的拼接顺序压缩后的字节数。
- **dist 实际**：`dist/` 中当前构建产物（带内容哈希）的字节数；若为 0，说明尚未构建。

## 总览

| bundle | 首屏 | 模块数 | 原始 | 模块 minified 合计 | bundle minified | dist 实际 |
|---|---|---|---|---|---|---|
| `leletv-core` | 是 | 13 | 94.1 KB | 50.4 KB | 50.4 KB | 50.4 KB |
| `leletv-app` | 是 | 31 | 427.7 KB | 213.0 KB | 213.1 KB | 213.1 KB |
| `leletv-category` | 否 | 1 | 28.4 KB | 21.1 KB | 21.1 KB | 21.1 KB |
| `leletv-settings` | 否 | 3 | 80.4 KB | 41.2 KB | 40.7 KB | 40.7 KB |
| `leletv-player` | 否 | 15 | 217.3 KB | 103.1 KB | 103.1 KB | 103.1 KB |
| **首屏 core + app** | 是 | — | **521.8 KB** | — | **263.5 KB** | **263.5 KB** |

## 模块体积排序

### leletv-core（首屏）

| # | 模块 | 原始 | minified |
|---|---|---|---|
| 1 | `src/ui/modals.ts` | 11.8 KB | 13.2 KB |
| 2 | `js/auth/invite-auth.js` | 22.5 KB | 11.0 KB |
| 3 | `js/core/config.js` | 13.2 KB | 6.2 KB |
| 4 | `js/ui/ui-core.js` | 8.9 KB | 5.2 KB |
| 5 | `js/api/remote-sources.js` | 7.5 KB | 3.3 KB |
| 6 | `js/core/storage-service.js` | 7.4 KB | 3.2 KB |
| 7 | `js/ui/line-probe.js` | 4.3 KB | 1.7 KB |
| 8 | `js/ui/motion-pref.js` | 3.2 KB | 1.7 KB |
| 9 | `js/auth/proxy-auth.js` | 3.4 KB | 1.6 KB |
| 10 | `js/core/leletv-global.js` | 5.0 KB | 1.3 KB |
| 11 | `js/core/timing.js` | 3.3 KB | 0.8 KB |
| 12 | `js/core/listener-tracker.js` | 3.0 KB | 0.8 KB |
| 13 | `js/auth/password.js` | 0.7 KB | 0.4 KB |

### leletv-app（首屏）

| # | 模块 | 原始 | minified |
|---|---|---|---|
| 1 | `js/ui/movies-page.js` | 42.3 KB | 26.2 KB |
| 2 | `js/app/app-routing.js` | 55.3 KB | 25.8 KB |
| 3 | `js/app/app-search.js` | 48.8 KB | 22.2 KB |
| 4 | `js/api/api-config.js` | 23.6 KB | 14.4 KB |
| 5 | `js/ui/ui-viewing-history.js` | 23.9 KB | 12.3 KB |
| 6 | `js/api/api.js` | 25.3 KB | 10.3 KB |
| 7 | `js/player/player-bridge.js` | 13.4 KB | 9.0 KB |
| 8 | `js/ui/search-cards.js` | 14.9 KB | 8.8 KB |
| 9 | `js/ui/ui-search-history.js` | 12.7 KB | 7.4 KB |
| 10 | `js/api/source-port.js` | 14.1 KB | 7.3 KB |
| 11 | `js/utils/version-updater.js` | 13.2 KB | 7.0 KB |
| 12 | `js/app/app-config.js` | 10.4 KB | 6.0 KB |
| 13 | `js/app/app.js` | 15.2 KB | 5.3 KB |
| 14 | `js/ui/home-recent.js` | 9.1 KB | 5.2 KB |
| 15 | `js/api/loadBalancer.js` | 13.7 KB | 5.2 KB |
| 16 | `js/ui/home-shelves.js` | 10.3 KB | 5.2 KB |
| 17 | `js/effects/hub-flow.js` | 11.3 KB | 4.9 KB |
| 18 | `js/api/search.js` | 10.1 KB | 4.1 KB |
| 19 | `js/ui/pwa-install.js` | 6.6 KB | 3.9 KB |
| 20 | `js/ui/ui.js` | 6.4 KB | 3.6 KB |
| 21 | `js/app/boot-sequence.js` | 7.4 KB | 3.2 KB |
| 22 | `js/app/page-loader.js` | 6.8 KB | 2.9 KB |
| 23 | `js/core/cache-manager.js` | 7.1 KB | 2.7 KB |
| 24 | `src/ui/invite-login.ts` | 6.4 KB | 2.7 KB |
| 25 | `js/ui/layout-pref.js` | 5.8 KB | 2.4 KB |
| 26 | `js/ui/brand-canvas.js` | 3.8 KB | 1.5 KB |
| 27 | `js/ui/nav-search.js` | 2.4 KB | 1.1 KB |
| 28 | `js/ui/hero-glass.js` | 2.2 KB | 1.1 KB |
| 29 | `js/app/app-init.js` | 3.3 KB | 1.0 KB |
| 30 | `src/router/prefetch.ts` | 1.2 KB | 0.4 KB |
| 31 | `src/ui/nav-scroll.ts` | 0.7 KB | 0.3 KB |

### leletv-category

| # | 模块 | 原始 | minified |
|---|---|---|---|
| 1 | `js/api/tmdb.js` | 28.4 KB | 21.1 KB |

### leletv-settings

| # | 模块 | 原始 | minified |
|---|---|---|---|
| 1 | `js/ui/theme-system.js` | 50.6 KB | 20.1 KB |
| 2 | `js/auth/admin-panel.js` | 17.7 KB | 12.5 KB |
| 3 | `js/auth/user-devices.js` | 12.1 KB | 8.6 KB |

### leletv-player

| # | 模块 | 原始 | minified |
|---|---|---|---|
| 1 | `js/player/player-ui.js` | 46.3 KB | 22.8 KB |
| 2 | `js/player/player.js` | 37.3 KB | 15.5 KB |
| 3 | `js/ui/ui-viewing-history.js` | 23.9 KB | 12.3 KB |
| 4 | `js/api/api.js` | 25.3 KB | 10.3 KB |
| 5 | `js/player/player-core.js` | 18.4 KB | 8.6 KB |
| 6 | `js/utils/version-updater.js` | 13.2 KB | 7.0 KB |
| 7 | `js/player/player-detail.js` | 8.7 KB | 6.3 KB |
| 8 | `js/player/player-failover.js` | 10.3 KB | 4.6 KB |
| 9 | `js/api/search.js` | 10.1 KB | 4.1 KB |
| 10 | `js/player/player-episodes.js` | 6.3 KB | 3.4 KB |
| 11 | `js/core/cache-manager.js` | 7.1 KB | 2.7 KB |
| 12 | `js/player/player-quality.js` | 3.3 KB | 2.3 KB |
| 13 | `js/player/player-manager.js` | 4.0 KB | 1.2 KB |
| 14 | `js/player/player-shortcuts.js` | 1.5 KB | 1.2 KB |
| 15 | `js/player/player-lights.js` | 1.6 KB | 0.9 KB |
