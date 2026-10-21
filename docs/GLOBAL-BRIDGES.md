# 全局桥白名单（阶段 5B-5）

> 5B-3 / 5B-4 已把同层与合法方向的跨文件引用改为 ESM `import`。
> 下列 `window.*` 不是遗漏，而是**必须保留的契约**。新增桥必须先在此登记，并说明为什么不能 import。

---

## 1. HTML 内联脚本契约

首帧主题、启动屏、邀请码与按需脚本都由 HTML 内联脚本在模块求值前执行，必须保持全局：

| 全局 | 归属 | 原因 |
|---|---|---|
| `__ENV__` / `__LELETV_VERSION__` | `src/index.html`、Pages Functions | 部署时注入，模块启动前读取 |
| `__LELETV_BOOT_UI__` | `src/index.html` | 启动屏的 `setStage/waitAuth/authReady/homeReady` |
| `__LELETV_INIT_SETTINGS_PAGE__` / `__LELETV_BIND_SETTINGS_PAGE__` | `src/main.ts` / `src/pages/search/index.ts` | 路由在片段插入后调用 |
| `__LELETV_BOOT_READY__` / `__LELETV_REFRESH_API_CHECKBOXES__` | `src/main.ts` | 启动信号与设置页刷新 |
| `LeLeBoot` | `src/boot.ts` | HTML 启动屏等待 `start()` |
| `LeLePages` | `src/router/page-loader.ts` | 路由与预取 |
| `LeLeLayout` / `LeLeMotion` | `src/ui/layout-pref.ts` / `motion-pref.ts` | 首帧 `data-*` 属性与设置页开关 |
| `LeLeBrandCanvas` | `src/ui/brand-canvas.ts` | 换色 / 私密模式粒子动画 |
| `LeLePwa` | `src/ui/pwa-install.ts` | 首页底部安装提示 |
| `LeLeThemeSystem` / `LeLeLineProbe` | `src/services/theme.ts` / `line-probe.ts` | 设置页主题盘 / 播放页线路探测 |
| `INVITE_AUTH` | `src/services/invitation.ts` | 邀请码登录与心跳（跨 bundle 单例） |
| `AppInit` | `src/main.ts` | router 注册初始化阶段 |
| `showToast` / `showModal` / `showLoading` / `hideLoading` | `src/ui/toast.ts` | services 层与 HTML 内联脚本的反馈入口 |
| `showImportBox` / `showSourceImportBox` | `src/ui/index.ts` | settings / port 的导入弹窗 |
| `_cardImgFallback` / `_posterLoaded` | `src/pages/search/cards.ts` | 卡片 HTML 的 `onerror` / `onload` 属性 |
| `selectedAPIs` / `customAPIs` | `src/services/sources/config.ts` | 兼容旧全局访问；读写代理到 `core/state` |
| `_moviesState` | `src/pages/category/index.ts` | 播放页返回地址判断（`ui/player/bridge.ts`） |
| `switchPage` / `dissolveThenRemove` / `parseChangelogMarkdown` | `src/router/index.ts` | pages / services 不能反向 import router |

---

## 2. 跨层契约（规则不允许 import 的方向）

| 方向 | 调用方 | 全局 |
|---|---|---|
| services → ui | `services/config.ts`、`sources/config.ts`、`sources/port.ts`、`viewing-history.ts` | `showToast/showModal/showLoading/hideLoading/showImportBox/showSourceImportBox` |
| services → router | `services/tmdb.ts`、`viewing-history.ts`、`version-updater.ts` | `switchPage`、`dissolveThenRemove`、`parseChangelogMarkdown`、`LeLePages` |
| ui → pages | `ui/player/bridge.ts` | `cacheSearchContext`（保留；bridge 在 ui 层） |
| pages → router | `pages/search/index.ts`、`pages/settings/*` | 路由函数按 `window` 属性在调用时读取（不能在模块顶层解构） |
| pages ↔ pages | `pages/category/index.ts` ↔ `pages/search/cards.ts` | 卡片工具函数（跨页面，禁止 import） |
| router → main | `router/index.ts` | `AppInit`、`setupEmailClickHandlers` |
| router → services | `router/index.ts` | `TMDB_STATE`、`initTmdbCategory`、`saveTmdbScroll`、`loadViewingHistory` |
| core → app | `core/global.ts` | `LeLeTV` / `AppInit` |
| ui/player ↔ player | `bridge.ts` ↔ `index.ts` | 一次整页导航，跨 bundle 通过 localStorage + window 传递播放状态 |

> 重要：跨模块的 `window.*` 函数必须在**调用时**读取属性（`window.switchPage()`），
> 不能在模块顶层解构（`const { switchPage } = window`）。模块求值顺序不保证对方已挂载。

---

## 3. 跨 bundle 单例

以下模块只应在首屏 bundle 中求值一次；settings / category / player 等按需 bundle
通过 `window` 使用首屏实例，不 `import`，避免出现两份内存状态：

- `INVITE_AUTH`（登录态、心跳定时器）
- `showToast` 的队列与定时器
- `syncRemoteApiSites` / `applyRemoteApiSitesFromCache`（远端源缓存）
- `core/config` 的可变状态与 `themeColor`
- `LeLePages`（按需脚本与片段的 Promise 缓存）

---

## 4. 清理记录

- 5B-3 已删除：`core/config` 与 `services/sources/config` 之间由字符串键造成的伪桥、
  `pages/search` 对 `main` 搜索状态的裸名访问、`cards` 的 `_lastAllResults` 全局读写。
- 5B-5 已删除：`core/state.ts` 的过渡 `declare global`（ApiSite / selectedAPIs / cards 工具函数等）。
- 仍保留的桥以本文件为准；新增桥需同时更新本文件。
