# RESUME — 重构续接状态

> 最后更新：2026-10-21
> 分支：`refactor/slim-arch`
> 基线 tag：`pre-refactor`
> 最新提交：`a110e74 refactor: 迁移 invite-auth 到 src/services/invitation.ts`

---

## 已完成阶段

| 阶段 | 结果 |
|---|---|
| -1 | 勘察 + `INVENTORY.md` 全量登记（迁移前 326 文件） |
| 0 | `scripts/analyze.js`、`docs/REGRESSION.md`、`docs/BASELINE.md` |
| 1 | `01`–`07` 规则、5 个技能、`.ts` 模板、`tsconfig.json`、`check-*` 脚本、`MAP.md` |
| 2 | 模态框 / 邀请码登录 / 导航滚动脚本外置（`index.html` 1636 → 1298 行） |
| 3 | `build.config.js` 单一清单、JSZip 按需加载、路由预取（首屏传输 694 → 365 KB） |
| 4 | **进行中：23 / 85 条已验证** |

---

## 阶段 4 已完成（MAP 1–14）

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

---

## 下一步

**MAP 第 24 条**：`js/api/tmdb.js → src/services/tmdb.ts`

之后 services 层完成，进入 ui 层（17 条）。
- `js/ui/line-probe.js → src/services/line-probe.ts`
- `js/ui/ui-search-history.js → src/services/search-history.ts`
- `js/api/search.js → src/services/search.ts`
- `js/ui/ui-viewing-history.js → src/services/viewing-history.ts`
- `js/ui/theme-system.js → src/services/theme.ts`
- `js/utils/version-updater.js → src/services/version-updater.ts`
- `js/api/tmdb.js → src/services/tmdb.ts`

然后进入 ui（17）、pages（20）、router（2）、entry（2）、styles（3）、public（17）。

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

基线：首屏 core+app **264.5 KB**（预算 275 KB）；`js/` 剩余 `.js` **42**。

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
