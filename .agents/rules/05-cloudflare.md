# 05 Cloudflare

1. Pages 构建输出目录固定为仓库根 `/`；不得修改 `wrangler.toml`。
2. `functions/`、`workers/`、`migrations/` 是红区：只读，改动需人类书面批准。
3. `_headers`、`_routes.json`、`wrangler.toml` 是红区。
4. HTML 与 `/` 使用 `no-cache`；`dist/*` 使用 `max-age=31536000, immutable`。
5. 新增静态资源必须放既有目录（`image/`、`libs/`、`css/`），不得在根目录新建。
6. D1 绑定名固定 `INVITE_DB`，不得新增或重命名绑定。
7. 部署前必须 `npm run build`，并确认根目录 `index.html` / `player.html` 已更新。
8. 线上异常排查顺序：构建产物 → `_headers` 缓存 → Functions 路由 → D1。
9. `service-worker.js` 保持 kill-switch，不得恢复离线缓存逻辑。
10. 不得在前端硬编码密钥；密钥只通过 Cloudflare secret 注入。
