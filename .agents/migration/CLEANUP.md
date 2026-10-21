# CLEANUP — 无用文件检测与处理记录

> 清理**只在阶段 4.5** 执行。阶段 -1 只做"疑似无用"初判，**不删除任何文件**。
> 检测脚本 `scripts/check-orphans.js` 尚未创建（阶段 1 产出），因此本阶段没有正式检测报告。

---

## 当前状态（阶段 -1 结束）

- 正式检测次数：**0**
- 已删除文件：**0**
- 已移动隔离文件：**0**
- 清理 commit：**无**
- revert tag：**无**

---

## 阶段 -1 引用初判（非正式检测）

检测方式：对每个路径取 basename，在当前跟踪的源码 / HTML / CSS / `package.json` / `.github` 中做全仓字面检索，并人工核对动态加载点。

| 路径 | 级别 | 初判依据 | 处理 |
|---|---|---|---|
| `service-worker.js` | B | 文件头注释自述为"退役 kill switch"，全仓无注册调用；但仍服务历史上装过 SW 的老访客 | 登记 `suspected-unused`，不删 |
| `image/brand/leletv-lockup.svg` | B | 全仓零引用；可能是品牌锁版母版 | 登记 `suspected-unused`，不删 |
| `image/brand/leletv-mark.svg` | B | 全仓零引用；`leletv-mark-currentcolor.svg` 才是实际使用版本 | 登记 `suspected-unused`，不删 |
| `image/brand/leletv-wordmark-currentcolor.svg` | B | 全仓零引用 | 登记 `suspected-unused`，不删 |

### 已排除的"伪孤儿"（动态引用，阶段 4.5 必须进白名单）

| 路径 | 引用方式 |
|---|---|
| `css/v2/views.css`、`css/v2/admin.css` | `js/app/page-loader.js` 的 `STYLES` 映射运行时插入 `<link>` |
| `pages/*.html`（6 个） | `js/app/page-loader.js` 的 `FRAGMENTS` 映射运行时 `fetch` |
| `js/auth/sha256.js` | `js/auth/proxy-auth.js` 中 `await import('./sha256.js')` |
| `js/filter-config.json` | `js/app/app-search.js` 中 `fetch('/js/filter-config.json')` |
| `libs/marked.min.js` | `js/app/app-routing.js` 运行时动态插入 `<script>` |
| `libs/sha256.min.js`、`libs/jszip.min.js` | `index.html` / `player.html` 直接 `<script>`（非模块导入） |
| `libs/geist/*.woff2` | CSS `@font-face` 的 `url()` |
| `image/brand/*`（除上述 3 个） | `manifest.json` / `index.html` / `scripts/brand/make-brand.mjs` |
| `functions/**` | Cloudflare Pages 按文件路径路由，无 import 指向 |
| `.agents/**` | AI 按约定读取，代码零引用 |
| `scripts/**` | `package.json` scripts / 手工运行 |

> 结论：本阶段零删除；`suspected-unused` 只作为阶段 4.5 的人工复核输入。

---

## 清理记录

| 时间 | 检测命令 | 候选路径 | 级别 | 批准记录 | 删除 commit | 回归结果 | revert tag |
|---|---|---|---|---|---|---|---|
| 2026-10-22 | `find css -type f`（0 文件）→ `rmdir css/v2 css` | `css/`、`css/v2`（空目录） | cleanup | 用户授权（JiuNian090，2026-10-22） | —（空目录不被 Git 跟踪） | `npm test` 15/15、`npm run check` 通过 | — |
