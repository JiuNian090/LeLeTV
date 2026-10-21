/**
 * LeLeTV 构建配置（单一清单来源）
 *
 * 当前仍是「字符串拼接 + esbuild.transform」：源码是全局脚本，没有 ESM import/export，
 * 因此无法使用 esbuild 的 splitting。阶段 4 完成模块化后，本文件再扩展为
 * 多入口 + splitting 配置；在此之前，build-bundles.js 与 analyze.js 共用本清单，
 * 避免两处清单漂移。
 *
 * 顺序即执行顺序，禁止随意调整：
 *   core  → 全局注册 / 存储 / 鉴权
 *   app   → 首页装配 / 搜索 / 路由
 *   pages → 按需页面 bundle
 *   player→ 播放页独立 bundle
 */

export const BUNDLES = [
  {
    name: 'leletv-core',
    firstScreen: true,
    files: [
      // 全局模态框 / Toast 必须在 ui-core.js 之前注入：ui-core.js 在模块顶层就查找 #toast / #modal
      'src/ui/modals.ts',
      // remote-sources 必须排在 config.js 之后（依赖 API_SITES / extendAPISites / isHiddenContentMode），
      // 且要在 app.js 与 player.js 之前（两个页面启动时都会调用它）
      'src/core/config.ts', 'js/api/remote-sources.js',
      'js/core/leletv-global.js', 'js/core/storage-service.js',
      'js/core/listener-tracker.js', 'js/core/timing.js',
      'js/auth/proxy-auth.js', 'js/auth/password.js', 'js/auth/invite-auth.js',
      'js/ui/ui-core.js', 'js/ui/motion-pref.js', 'js/ui/line-probe.js',
    ],
  },
  {
    name: 'leletv-app',
    firstScreen: true,
    files: [
      'js/api/api-config.js', 'js/api/loadBalancer.js',
      'js/ui/ui-search-history.js', 'js/ui/ui-viewing-history.js', 'js/ui/ui.js',
      'js/api/api.js', 'js/api/search.js',
      'js/player/player-bridge.js', 'js/ui/search-cards.js', 'js/ui/movies-page.js',
      'js/app/app-search.js', 'js/app/app-config.js', 'js/api/source-port.js', 'js/app/app.js',
      'js/app/app-init.js', 'js/app/page-loader.js', 'js/app/app-routing.js',
      'js/utils/version-updater.js', 'src/core/cache.ts',
      'js/effects/hub-flow.js', 'js/ui/brand-canvas.js', 'js/ui/home-shelves.js', 'js/ui/hero-glass.js',
      'js/ui/home-recent.js', 'js/ui/nav-search.js', 'js/ui/pwa-install.js', 'js/ui/layout-pref.js',
      'src/ui/nav-scroll.ts',
      // 导航 hover / focus 预取页面片段与按需 bundle
      'src/router/prefetch.ts',
      // 启动编排必须最后执行：它要等所有首页模块与路由注册完成后再开始鉴权 / 首页加载
      'js/app/boot-sequence.js',
      // 邀请码弹窗逻辑注册 DOMContentLoaded，保持在 boot-sequence 之后（与拆分前顺序一致）
      'src/ui/invite-login.ts',
    ],
  },
  {
    name: 'leletv-category',
    firstScreen: false,
    files: [
      'js/api/tmdb.js',
    ],
  },
  {
    name: 'leletv-settings',
    firstScreen: false,
    files: [
      'js/ui/theme-system.js', 'js/auth/admin-panel.js', 'js/auth/user-devices.js',
    ],
  },
  {
    name: 'leletv-player',
    firstScreen: false,
    files: [
      'js/api/api.js', 'js/api/search.js',
      'js/ui/ui-viewing-history.js',
      'js/player/player-manager.js', 'js/player/player-shortcuts.js',
      'js/player/player-core.js', 'js/player/player-episodes.js',
      'js/player/player-ui.js', 'js/player/player-failover.js', 'js/player/player-lights.js',
      'js/player/player-detail.js', 'js/player/player-quality.js', 'js/player/player.js',
      'js/utils/version-updater.js', 'src/core/cache.ts',
    ],
  },
];

export function getBundle(name) {
  const bundle = BUNDLES.find(item => item.name === name);
  if (!bundle) throw new Error(`未知 bundle：${name}`);
  return bundle;
}
