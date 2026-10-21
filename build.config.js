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
      // 全局模态框 / Toast 必须在 src/ui/toast.ts 之前注入：toast 模块在初始化时就查找 #toast / #modal
      'src/ui/modals.ts',
      // remote-sources 必须排在 config.ts 之后（依赖 API_SITES / extendAPISites / isHiddenContentMode），
      // 且要在 app.js 与 player.js 之前（两个页面启动时都会调用它）
      'src/core/config.ts', 'src/services/sources/remote.ts',
      'src/core/global.ts', 'src/core/storage.ts',
      'src/core/listener-tracker.ts', 'src/core/timing.ts',
      'src/core/http.ts', 'src/core/crypto.ts', 'src/services/invitation.ts',
      'src/ui/toast.ts', 'src/ui/motion-pref.ts', 'src/services/line-probe.ts',
    ],
  },
  {
    name: 'leletv-app',
    firstScreen: true,
    files: [
      'src/services/sources/config.ts', 'src/services/balancer.ts',
      'src/services/search-history.ts', 'src/services/viewing-history.ts', 'src/ui/index.ts',
      'src/services/api.ts', 'src/services/search.ts',
      'src/ui/player/bridge.ts', 'js/ui/search-cards.js', 'src/pages/category/index.ts',
      'js/app/app-search.js', 'src/services/config.ts', 'src/services/sources/port.ts', 'js/app/app.js',
      'js/app/app-init.js', 'js/app/page-loader.js', 'js/app/app-routing.js',
      'src/services/version-updater.ts', 'src/core/cache.ts',
      'js/effects/hub-flow.js', 'src/ui/brand-canvas.ts', 'js/ui/home-shelves.js', 'js/ui/hero-glass.js',
      'js/ui/home-recent.js', 'js/ui/nav-search.js', 'src/ui/pwa-install.ts', 'src/ui/layout-pref.ts',
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
      'src/services/tmdb.ts',
    ],
  },
  {
    name: 'leletv-settings',
    firstScreen: false,
    files: [
      'src/services/theme.ts', 'js/auth/admin-panel.js', 'js/auth/user-devices.js',
    ],
  },
  {
    name: 'leletv-player',
    firstScreen: false,
    files: [
      'src/services/api.ts', 'src/services/search.ts',
      'src/services/viewing-history.ts',
      'src/ui/player/manager.ts', 'src/ui/player/shortcuts.ts',
      'src/ui/player/core.ts', 'src/ui/player/episodes.ts',
      'src/ui/player/ui.ts', 'src/ui/player/failover.ts', 'src/ui/player/lights.ts',
      'src/ui/player/detail.ts', 'src/ui/player/quality.ts', 'src/ui/player/index.ts',
      'src/services/version-updater.ts', 'src/core/cache.ts',
    ],
  },
];

export function getBundle(name) {
  const bundle = BUNDLES.find(item => item.name === name);
  if (!bundle) throw new Error(`未知 bundle：${name}`);
  return bundle;
}
