# 部署规则（Cloudflare）

> 按需加载 — 改部署配置、排查线上异常时读取。

---

## 部署架构

| 层 | 载体 | 职责 |
|---|---|---|
| 前端 | Cloudflare Pages | 静态资源 + SPA（`index.html` / `player.html`） |
| 边缘函数 | Pages Functions（`functions/`） | `proxy/[[path]].js` 处理 `/proxy/*` 采集站代理；`_middleware.js` 注入 `window.__ENV__` |
| Worker | `workers/tmdb-worker.js` | TMDB 代理、邀请码 API、云端数据源管理（`/admin` 面板） |
| 数据库 | Cloudflare D1 | `invitation_codes` / `devices` / `api_sites`，迁移脚本见 `migrations/` |

## 已踩过的坑

- `_headers` **不支持 `*.css` / `*.js` 等扩展名通配符**，必须写 `/css/*`、`/js/*` 这类目录通配符
- `_headers` 规则之间必须有空行分隔，否则后续规则会被判为无效行
- `wrangler.toml` 只服务于 Worker（`workers/tmdb-worker.js`）与 D1 绑定，**Pages 项目不读它**

## 本地正常、部署异常的排查顺序

1. 看部署日志，重点找 `invalid header lines`
2. 看浏览器 Console，定位是哪个文件 500
3. 检查 `_routes.json` 的 include / exclude 路径是否覆盖正确
4. 检查 `window.__ENV__` 是否注入成功
5. 清 Service Worker 缓存

## 缓存策略

- `_headers` 是响应头缓存策略的唯一来源；`/css/*`、`/js/*`、`/image/*`、`/libs/*` 缓存 7 天，`/dist/*` 一年，配合 `?v=` 参数失效
- HTML、`/service-worker.js`、`/manifest.json`、`/CHANGELOG.md`、`/VERSION.txt` 一律 `no-cache`
- 版本号注入与 `?v=` 刷新由 `scripts/generate-version.mjs` 在所有 `npm run build` 时完成
