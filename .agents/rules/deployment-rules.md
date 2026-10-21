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

## Cloudflare Pages 构建设置

| 设置 | 值 |
|---|---|
| 根目录 | 留空（仓库根即项目根） |
| 构建命令 | `npm run build` |
| 构建输出目录 | `/` |
| Node 版本 | 环境变量 `NODE_VERSION=20` |

说明：

- 根 `index.html` 与 `dist/` 都由 `scripts/build-bundles.mjs` 生成，输出目录必须是仓库根 `/`。
- `src/index.html`、`src/pages/player/index.html` 在构建时会被版本号与 bundle hash 改写，构建容器需要可写。
- Pages 项目只使用 `TMDB_WORKER_URL`、`HIDDENKEY` 与代理相关变量；**不需要 D1 绑定**。
- `package-lock.json` 已纳入版本控制，Pages 构建会按锁文件安装依赖。

## D1 绑定排查

- Worker 的 D1 绑定来自 `wrangler.toml` 的 `[[d1_databases]]`，当前绑定名为 `INVITE_DB`。
- Pages 的 D1 绑定在 **Pages 项目 → Settings → Functions → D1 database bindings**，Production 与 Preview 分开配置。
- Pages Functions 当前不使用 D1；如果部署报 `D1 binding 'DB' references database ... not found`，删除 Pages 项目里的 `DB` 绑定即可，不要改 `wrangler.toml`。
- 跨账户的 D1 不能直接绑定到 Pages；需要数据库时通过 Worker API 访问。

## D1 备份

```bash
npx wrangler d1 export leletv-invite-db --remote --output "backup-$(date +%F).sql"
```

- 在 `wrangler.toml` 所在目录执行，确认当前登录的是 Worker 所属账户。
- 备份文件不要提交到仓库；建议保存到本机或私有对象存储。
- 恢复前先在测试库验证 `migrations/001`–`004` 的表结构与备份一致。
