# LeLeTV Phase 1 迁移完成清单

> 验证日期：2026-06-12
> 当前版本：v2.8.5

---

## Phase 1 完成项（8/8 ✅）

- [x] **Step 1 — Vite 项目骨架**
  - `vite.config.ts`（多页面 + 路径别名）
  - `tsconfig.json`（渐进式 → `strict: true`）
  - `src/` 目录结构
  - `npm run dev/build` 正常

- [x] **Step 2 — 核心基础设施**
  - `src/core/timing.ts`
  - `src/core/listener-tracker.ts`
  - `src/core/storage-service.ts`
  - `src/core/leletv-global.ts`
  - `src/core/app-init.ts`

- [x] **Step 3 — auth + cache 服务**
  - `src/services/auth/sha256.ts`
  - `src/services/auth/password.ts`
  - `src/services/auth/proxy-auth.ts`
  - `src/services/cache.ts`

- [x] **Step 4 — API 服务层**★
  - `src/services/api/api-config.ts`
  - `src/services/api/load-balancer.ts`
  - `src/services/api/search.ts`
  - `src/services/api/api.ts`（fetch 覆写 → apiFetch）
  - `src/services/api/tmdb.ts`

- [x] **Step 5 — 播放器模块**
  - `src/services/player/player-state.ts`（共享状态模块）
  - `src/services/player/player-manager.ts`
  - `src/services/player/player-core.ts`
  - `src/services/player/player-episodes.ts`
  - `src/services/player/player-bridge.ts`
  - `src/services/player/player-ui.ts`

- [x] **Step 6 — UI 层**
  - `src/ui/components/toast.ts`
  - `src/ui/components/modal.ts`
  - `src/ui/components/search-history.ts`
  - `src/services/history.ts`
  - `src/ui/app/app-search.ts`
  - `src/ui/app/app-config.ts`
  - `src/ui/app/app-category.ts`
  - `src/ui/app/app.ts`
  - `src/effects/aurora-bg.ts`
  - `src/effects/title-animation.ts`

- [x] **Step 7 — 入口改造**
  - `index.html`：移除 28+ 旧 `<script>` + 300 行内联脚本
  - `player.html`：保留 libs（sha256/hls.js/artplayer）
  - 替换为 `<script type="module" src="/src/main.ts">`

- [x] **Step 8 — TypeScript 强化**
  - `tsconfig.json` → `strict: true`
  - `npm run typecheck` 零错误

---

## 迁移统计

| 指标 | 值 |
|------|:---:|
| TypeScript 源文件 | 36 个 |
| Vite 编译模块 | 36 个 |
| 构建时长 | ~1.1s |
| 类型检查 | `strict: true` 零错误 |
| E2E 测试 | 12/12 通过 + 分类页 4/4 通过 |

---

## 待迁移/待确认

- [ ] `js/utils/version-updater.js` → `src/utils/version-updater.ts`
- [ ] `service-worker.js` → 确认与 Vite 构建兼容
- [ ] Cloudflare Pages 部署验证（`dist/` 目录）
- [ ] 原有 `js/` 目录文件清理（确认无引用后删除）

---

## Phase 2 待开始

- [ ] 安装 Vue 3 + Pinia + Vue Router
- [ ] 创建首个 Vue 组件（关于面板）
- [ ] 逐步替换 UI 组件（绞杀者模式）
- [ ] 双架构并存验证
- [ ] 完全移除原生代码
