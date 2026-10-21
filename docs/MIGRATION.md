# LeLeTV 重构 · 阶段 -1 本地现状勘察报告

> 执行日期：2026-10-21
> 分支：`refactor/slim-arch`（从 `main` 新建）
> 基线 tag：`pre-refactor`（指向 `main` 当前 HEAD，即 `v4.1.2`）
> 本阶段只做勘察、登记与初判：**未修改任何被跟踪文件、未删除任何文件**。

---

## 0. 执行摘要

| 项目 | 结果 |
|---|---|
| 工作区初始状态 | 干净（`git status --short` 无输出） |
| 迁移分支 | `refactor/slim-arch` 已创建并切换 |
| 基线 tag | `pre-refactor` 已创建 |
| 迁移前 `git ls-files` 文件总数 | **326** |
| 阶段 -1 新增文档 | **4**（`.agents/migration/`） |
| 当前 `git ls-files` 文件总数 | **330** |
| `INVENTORY.md` 登记条目 | **330**（覆盖校验 330 == 330 ✅） |
| 构建 | `npm run build` 成功，且幂等（构建后 `git status` 仍干净） |
| 首屏 bundle | `core` 38.1 KB + `app` 209.1 KB = **247.2 KB**（minified，未计 gzip） |
| 首屏 CSS | tokens 8.7 KB + base 39.2 KB + home 41.0 KB = **88.9 KB** |
| DOM 节点数（首页内容加载后） | **1170** |
| FCP / LCP（localhost，无节流） | **232 ms / 3952 ms** |
| 疑似无用初判 | 4 个，**仅登记、未删除** |
| 本阶段 delete / merge | **0 / 0** |

**结论：可以按计划继续，但有 6 处实际情况与方案假设冲突，需人类先决策（见第 12 节）。**

---

## 1. Git 与分支

```
当前分支：main → refactor/slim-arch（新建）
已存在分支：main / V1 / V3 / fix-category-page-scrolling-E4KC1X / refactor/shadcn-ui-theming
已存在远端：origin/main, origin/V1, origin/V3, origin/backup/pre-rollback-v3.6.3, origin/feat/ios-pwa-notch-safe-area, origin/fix/api-grid-3col
工作区：干净
```

- 已在 `main` 的 HEAD 打 tag `pre-refactor`（同时该 commit 原本已有 `v4.1.2`）。
- 新建并切换到 `refactor/slim-arch`；后续阶段提交只进该分支。
- 计划 2 节要求的"改造开始前打 `pre-refactor`"已完成。

---

## 2. 部署与构建产物目录

### 2.1 `wrangler.toml` 实际内容

```toml
name = "leletv-tmdb-proxy"
main = "workers/tmdb-worker.js"
compatibility_date = "2025-05-19"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "INVITE_DB"
database_name = "leletv-invite-db"
database_id = "1552a435-fb37-4090-831d-5fe3ed67a755"
```

**关键结论：仓库里的 `wrangler.toml` 是 Workers + D1 配置，没有 `pages_build_output_dir`。**
Pages 项目是在 Cloudflare 控制台 / Git 集成里配置的，构建输出目录不在仓库内可见。

### 2.2 实际部署布局

| 项 | 现状 |
|---|---|
| 静态站点根 | **仓库根目录**（`index.html`、`player.html`、`pages/`、`css/`、`js/`、`libs/`、`image/`） |
| `dist/` | 只放 5 个构建 bundle（`.js` + `.js.map`），`dist/*.js` 在 `.gitignore` 中 |
| Functions | `functions/_middleware.js`、`functions/proxy/[[path]].js` |
| 路由配置 | 根目录 `_routes.json`（Pages Functions） |
| 缓存/CSP | 根目录 `_headers` |
| 重定向 | **不存在** `_redirects` |

`_headers` 已对 `dist/*` 设 `max-age=31536000, immutable`，对 HTML 设 `no-cache`。

---

## 3. 根目录对照目标结构

| 计划目标 | 现状 | 差异 |
|---|---|---|
| `AGENTS.md` | ✅ | 已存在，阶段 1 重写 |
| `CLAUDE.md`（仅 `@AGENTS.md`） | ⚠️ | 存在，但含较多 Claude 专属说明（1593 B） |
| `REFACTOR_PLAN.md` | ❌ | 只在桌面，未入仓 |
| `.agents/rules/01-07` | ⚠️ | 现有 8 份旧命名规则 + 2 个模板 |
| `.agents/skills/` 5 个 | ⚠️ | 现有 19 个技能（其中 impeccable 含 152 个资源文件） |
| `.agents/templates/` | ❌ | 不存在 |
| `.agents/migration/` | ✅ | 本阶段创建 |
| `public/` | ❌ | 不存在；静态资源散在根目录 |
| `src/` | ❌ | 不存在 |
| `docs/` | ❌ | **不存在，且被 `.gitignore` 忽略** |
| `scripts/` 12 个脚本 | ⚠️ | 现有 13 个（含 `brand/` 7 个），缺 `analyze/check-*` |
| `.github/` | ✅ | 9 个文件，keep |
| `.vscode/` | ✅ | `launch.json`，keep |
| `.editorconfig` | ❌ | 不存在 |
| `.gitattributes` | ❌ | 不存在 |
| `tsconfig.json` | ❌ | 不存在 |
| `build.config.js` | ❌ | 不存在（构建配置内联在 `scripts/build-bundles.mjs`） |
| `wrangler.toml` | ✅ | 存在但无 `pages_build_output_dir` |
| `_headers` / `_routes.json` | ✅ | 在根目录；计划目标结构未列 `_routes.json` |
| `workers/` | ✅ | keep（红区） |
| `migrations/` | ✅ | keep（红区） |
| `server.mjs` / `nodemon.json` | ✅ | 计划目标结构未列；本地开发用，建议 keep |

---

## 4. `index.html` 结构

- 行数：**1636 行**（`wc -l`；最后一行无换行时 `grep -c` 为 1637）
- 体积：**111,599 B**（`ls`）
- 资源引用：`tokens.css` / `base.css` / `home.css`；`libs/sha256.min.js`、`libs/jszip.min.js`（同步）；`dist/leletv-core.*`、`dist/leletv-app.*`（defer）

### 4.1 页面骨架块

| 区块 | 行范围 | id / 说明 |
|---|---|---|
| 启动动画 | 462–1022 | `#bootSplash`、`#bootLoading`、`#bootSplashHint` |
| 顶部导航 | 1035–1071 | 首页 / 分类 / 历史 / 设置 / 关于 |
| 首页 | 1074–1222 | `#page-home`、`#searchArea`、`#resultsArea`、`#homeContinue`、`#homeRecent` |
| 模态框组 | 1223–1415 | `#pwaGuideModal`、`#modal`、`#inviteLoginModal`、`#inviteGuideModal`、`#disclaimerModal`、`#updateModal`、`#toast`、`#loading`、`#mobileSearchOverlay`、`#searchHistoryDropdown` |
| 脚本 | 1417–1634 | 第三方库 + 内联脚本 |

**重要：`index.html` 只内联了首页 `#page-home`；其余 6 个页面已经是 `pages/*.html` 片段**，由 `js/app/page-loader.js` 在首次进入时 `fetch` 并插入。这与计划"所有页面骨架内联"的假设不同。

### 4.2 内联脚本占比

| 行范围 | 行数 | 用途 |
|---|---|---|
| 84–172 | 89 | 首屏主题色/防闪烁 |
| 174–188 | 15 | marked.js 移出首屏的说明性脚本区 |
| 563–1022 | 460 | 启动动画 / 启动序列 |
| 1420–1422 | 3 | 全局标记 |
| 1428–1443 | 16 | 环境变量 / 版本 |
| 1446–1467 | 22 | 启动参数 |
| 1476–1615 | 140 | 页面预取 / 路由预热 |
| 1619–1634 | 16 | 收尾 |

合计约 **761 行内联脚本**，是首屏 HTML 的主要体积来源。

---

## 5. JS / CSS 清单

### 5.1 JS

- **56 个** `js/` 文件（55 个 `.js` + `filter-config.json`），与计划预期一致。
- 原始体积合计 **765,605 B**。
- 8 个子目录：`api/`(7)、`app/`(7)、`auth/`(6)、`core/`(6)、`effects/`(1)、`player/`(11)、`ui/`(16)、`utils/`(1)。
- 最大的 10 个模块：

| 文件 | 体积 |
|---|---|
| `js/app/app-routing.js` | 56.6 KB |
| `js/ui/theme-system.js` | 51.8 KB |
| `js/app/app-search.js` | 49.9 KB |
| `js/player/player-ui.js` | 47.4 KB |
| `js/ui/movies-page.js` | 43.3 KB |
| `js/player/player.js` | 38.2 KB |
| `js/api/tmdb.js` | 29.1 KB |
| `js/api/api.js` | 25.9 KB |
| `js/ui/ui-viewing-history.js` | 24.4 KB |
| `js/api/api-config.js` | 24.2 KB |

### 5.2 CSS

- **6 个**，合计 **191,235 B**：

| 文件 | 体积 | 加载方式 |
|---|---|---|
| `css/v2/tokens.css` | 8.7 KB | 首屏 `<link>` |
| `css/v2/base.css` | 39.2 KB | 首屏 `<link>` |
| `css/v2/home.css` | 41.0 KB | 首屏 `<link>` |
| `css/v2/player.css` | 26.1 KB | `player.html` |
| `css/v2/views.css` | 61.7 KB | page-loader 运行时插入 |
| `css/v2/admin.css` | 10.1 KB | page-loader 运行时插入 |

---

## 6. `.agents/` 现有资产

迁移前共 **186 个跟踪文件**；阶段 -1 新增 4 个 migration 文档后为 **190 个**，全部逐条登记进 `INVENTORY.md`：

| 类别 | 数量 | 处理 |
|---|---|---|
| `.agents/rules/*.md` | 8 | 保留；阶段 1 评估归并进 `01-07` |
| `.agents/rules/templates/*` | 2 | 保留 |
| `.agents/skills/` | 19 个技能 | 保留；`impeccable` 占 152 个资源文件 |
| `skills/INDEX.md` | 1 | 保留（脚本生成） |
| `skills-registry.json` / `skills-config.template.json` / `README.md` | 3 | 保留 |

**没有任何 `.agents/` 文件被标为 delete 或 merge。** 现有资产全部按 `keep` 登记，阶段 1 再决定归并。

---

## 7. `package.json` 与构建方式

### 7.1 现有 scripts

| script | 命令 |
|---|---|
| `dev` | `nodemon server.mjs` |
| `start` | `node server.mjs` |
| `build` | `node scripts/generate-version.mjs && node scripts/build-bundles.mjs` |
| `setup:hooks` | `node scripts/setup-hooks.mjs` |
| `test` / `lint` / `format` | 均为 echo 占位 |

**没有** `typecheck` / `check` / `check:orphans`；`package.json` 中没有 `typescript`、`@cloudflare/workers-types`、`@types/*`。

### 7.2 构建方式（与计划假设不同）

`scripts/build-bundles.mjs` 的实际做法：

1. 按硬编码的 5 个清单（`CORE` / `APP` / `CATEGORY` / `SETTINGS` / `PLAYER`）把源文件**字符串拼接**；
2. 用 `esbuild.transform()`（不是 `esbuild.build()`）压缩；
3. 文件名带内容哈希；
4. **原地重写** `index.html`、`player.html`：删除旧 `<script src="js|dist/...">`，插入新的 `dist/*.js`；
5. **原地重写** `service-worker.js` 的 `CACHE_VERSION`。

没有 `splitting: true`、没有 ESM 多入口、没有 `build.config.js`。

---

## 8. 构建验证与体积基线

`npm run build` 执行成功，产物：

| bundle | 体积 |
|---|---|
| `dist/leletv-core.u1orfj.js` | 38,097 B |
| `dist/leletv-app.h2rfts.js` | 214,263 B |
| `dist/leletv-category.2u4fy.js` | 21,577 B |
| `dist/leletv-settings.f6kyfj.js` | 41,691 B |
| `dist/leletv-player.9t4ez0.js` | 105,527 B |

- 构建后 `git status --short` 为空 → 构建幂等，没有污染工作区。
- 首屏实际加载 `core + app = 252,360 B`。
- 页面切换时按需加载：`category` 21.6 KB、`settings` 41.7 KB、`player` 105.5 KB。
- `views.css` 61.7 KB 与 `admin.css` 10.1 KB 在进入内页时加载。

---

## 9. 运行时基线

测量环境：本地 `npm start`（`http://127.0.0.1:8080/index.html`），`localhost`，未做网络节流，浏览器已有本地缓存。

| 指标 | 数值 |
|---|---|
| DOM 节点数 | **1170**（首页 TMDB 卡片已渲染后） |
| FCP | **232 ms** |
| LCP | **3952 ms**（受 TMDB 封面图影响） |
| TTFB | 61 ms |
| DOMContentLoaded | 254 ms |
| load | 1937 ms |
| 资源请求数 | 74 |
| 传输量 | 694 KB（encodedBodySize 合计 862 KB） |

### 9.1 首屏资源体积

| 资源 | 体积 |
|---|---|
| `index.html` | 111.6 KB |
| `tokens.css` + `base.css` + `home.css` | 89 KB |
| `leletv-core` + `leletv-app` | 246 KB |
| `libs/jszip.min.js`（同步） | 95 KB |
| `libs/sha256.min.js`（同步） | 9 KB |
| Geist 字体 4 个 | 159 KB |
| `libs/marked.min.js` | 按需（README 弹窗） |

> 说明：以上为改造前基线，阶段 2 / 3 完成后按同一命令复测对比。

---

## 10. 疑似无用文件初判（仅登记，未删除）

| 路径 | 初判 | 依据 |
|---|---|---|
| `service-worker.js` | suspected-unused | 文件注释自述"退役 kill switch"；全仓无注册调用；但仍在帮老访客注销旧 SW |
| `image/brand/leletv-lockup.svg` | suspected-unused | 全仓静态检索 0 引用 |
| `image/brand/leletv-mark.svg` | suspected-unused | 全仓静态检索 0 引用（实际使用 `leletv-mark-currentcolor.svg`） |
| `image/brand/leletv-wordmark-currentcolor.svg` | suspected-unused | 全仓静态检索 0 引用 |

### 已排除的"伪孤儿"

`css/v2/views.css`、`css/v2/admin.css`、`pages/*.html`、`js/auth/sha256.js`、`js/filter-config.json`、`libs/marked.min.js`、`libs/sha256.min.js`、`libs/jszip.min.js`、`libs/geist/*.woff2`、`functions/**`、`.agents/**`、`scripts/**` 均有动态引用或约定引用，**不得按零引用处理**。

---

## 11. 覆盖校验结果

| 校验项 | 结果 |
|---|---|
| 迁移前 `git ls-files` 文件数 | 326 |
| 阶段 -1 新增文档 | 4 |
| 当前 `git ls-files` 文件数 | 330 |
| `INVENTORY.md` 登记条目数 | 330 |
| 差集 `A - B` | 空 ✅ |
| 未登记文件 | 0 ✅ |
| 生成器未覆盖文件 | 0 ✅ |
| `delete` 记录 | 0 |
| `merge` 记录 | 0 |

去向分布：

| 去向类型 | 数量 |
|---|---|
| `keep` | 239 |
| `migrated` | 85 |
| `pending` | 2 |
| `suspected-unused` | 4 |
| **合计** | **330** |

> `keep` 中含阶段 -1 新增的 4 个 migration 文档。阶段 -1 不执行计划 5.5 的 `scripts/check-coverage.js`（该脚本阶段 1 才创建）；本次用等价的临时校验完成对账，临时脚本不留在仓库。

---

## 12. 与 `REFACTOR_PLAN.md` 的冲突点（需人类决策）

> 计划第 0 节要求：遇到冲突时暂停并报告，禁止自行决策绕过。以下是必须在阶段 0 之前确认的点。

### C-1 部署产物目录与 `wrangler.toml`（高）

- 计划假设：`public/` + `dist/`，`wrangler.toml` 的 `pages_build_output_dir` 指向 `dist/`。
- 实际：根目录直接作为静态输出，`dist/` 只放 bundle；`wrangler.toml` 是 Workers/D1 配置，**没有** `pages_build_output_dir`。
- 影响：阶段 3 / 5 若把静态资源移入 `public/` 并改 `pages_build_output_dir`，会触碰红区 `wrangler.toml`，且必须同步 Cloudflare 控制台的构建配置，否则线上 404。
- 需要确认：Pages 的构建命令与输出目录目前配置在哪里？是否允许改 `wrangler.toml`？

### C-2 构建方式与"原地回写源 HTML"（高）

- 计划假设：`build.config.js` + esbuild `splitting: true` + ESM 多入口。
- 实际：`scripts/build-bundles.mjs` 用字符串拼接 + `esbuild.transform`，并**原地重写** `index.html` / `player.html` / `service-worker.js`。
- 影响：阶段 3 不是"改配置"而是重写构建链路；且迁移到 `src/` 后，回写目标路径要同步改。
- 需要确认：是否接受重写 `build-bundles.mjs`？是否保留"构建回写源文件"的模式（会与阶段 4 的 `src/` 迁移冲突）？

### C-3 `index.html` 已经部分瘦身（中）

- 计划假设：`index.html` 约 1524 行、所有页面骨架内联。
- 实际：1636 行，但非首页页面已拆成 `pages/*.html` + `page-loader.js`；`core/app/category/settings/player` 也已是独立 bundle。
- 影响：阶段 2 的"渲染层分割"大部分已完成，剩余收益主要在 761 行内联脚本、9 个模态框、111 KB HTML、209 KB app bundle、95 KB 同步 JSZip。
- 需要确认：阶段 2 是否改为"只拆内联脚本与模态框"，目标收益是否重估？

### C-4 PWA / Service Worker 已退役（中）

- 计划假设：`public/sw.js` 预缓存、离线启动回归。
- 实际：`service-worker.js` 是 kill-switch；项目已无 SW 注册，PWA 只保留 `manifest.json` 与安装提示。
- 影响：阶段 3 第 5 条、阶段 5 第 2 条不适用；回归清单中的"离线启动"应改为"旧 SW 自注销"。
- 需要确认：是否保留 PWA（安装提示 + manifest），还是彻底移除？

### C-5 `docs/` 被 `.gitignore` 忽略（中）

- 计划要求 `docs/MIGRATION.md`、`docs/ARCHITECTURE.md`、`docs/REGRESSION.md`。
- 实际：`.gitignore` 末段有 `docs/`，这些文件无法提交。
- 当前处理：本报告同时放在 `.agents/migration/PHASE-1-REPORT.md`（可提交），并在 `docs/MIGRATION.md` 留本地副本。
- 需要确认：是否允许从 `.gitignore` 移除 `docs/`？

### C-6 目标结构未覆盖的现有文件（低）

- `libs/`（第三方库，9 个）、`server.mjs`、`nodemon.json`、`_routes.json`、`scripts/brand/`（7 个）、`pages/movies|history|about|readme.html`、`.agents` 现有 19 个技能。
- 当前处理：全部标 `keep`，未删除、未强制归并。
- 需要确认：是否把这些纳入目标结构（建议纳入），还是阶段 1 再逐项定？

### 其他次要差异

- 计划目标结构列的是 `src/pages/{home,category,search,detail,player,settings}`；实际多出 `movies`、`history`、`about`、`readme` 四个页面。
- 计划假设 8 个子目录的 `js/`，实际确实是 8 个（api/app/auth/core/effects/player/ui/utils）。
- 计划假设 11 套主题：实际 `theme-system.js` 有 **11 个预设 + 1 个自定义**，一致。
- 计划要求 `npm run build`：当前构建会写回 3 个源文件，但幂等，已验证。

---

### 12.1 人类决策记录（2026-10-21）

| 编号 | 决策 |
|---|---|
| C-1 | **保持 Cloudflare Pages 构建输出目录为 `/`**，不改 `wrangler.toml`，不引入 `public/`。静态资源继续从仓库根提供；`dist/` 只放 bundle。 |
| C-2 | **接受重写构建链路**：阶段 3 改为 esbuild `build` + `splitting`；构建从 `src/` 模板装配根目录 HTML，根 HTML 不再手工编辑。 |
| C-3 | **阶段 2 只拆剩余首屏负担**：约 761 行内联脚本、9 个模态框、启动动画；不重复拆分已完成的 `pages/*.html`。 |
| C-4 | **保留 PWA 安装到桌面**：保留 `manifest.json`、`js/ui/pwa-install.js`，并补齐 iOS / Windows 安装适配；`service-worker.js` 继续保持退役 kill-switch，不恢复离线缓存。 |
| C-5 | **解除 `.gitignore` 对 `docs/` 的忽略**，`docs/` 纳入版本控制。 |
| C-6 | **现有资产全部纳入目标结构并保留**：`libs/` 作为第三方库目录；`server.mjs` / `nodemon.json` 作为本地开发工具；`_routes.json` 作为 Functions 配置；`pages/{movies,history,about,readme}.html` 纳入页面层；现有 19 个技能保留。 |

> C-1 + C-2 的组合意味着：`src/` 只承载源码（JS/TS、页面模板、样式），根目录 HTML 仍是对外部署入口，由构建装配；不追求把整个站点搬进 `public/`。

---

## 13. 阶段 -1 产出清单

| 文件 | 说明 |
|---|---|
| `.agents/migration/INVENTORY.md` | 330 条全量登记（keep 239 / migrated 85 / pending 2 / suspected-unused 4） |
| `.agents/migration/APPROVALS.md` | 空批准表 + 6 条待人工判定队列（未批准） |
| `.agents/migration/CLEANUP.md` | 空清理记录 + 4 条疑似无用初判 + 动态引用白名单候选 |
| `.agents/migration/PHASE-1-REPORT.md` | 本报告（可提交） |
| `docs/MIGRATION.md` | 本报告的副本（本地；`docs/` 当前被 gitignore） |

未改动的文件：所有被跟踪的源码、HTML、CSS、配置、Functions、Workers、migrations。

---

## 14. 等待确认的下一步

1. 对第 12 节的 C-1 ~ C-6 给出决策（尤其是 C-1 部署目录、C-2 构建方式、C-5 `docs/` 忽略）。
2. 确认本报告与 `INVENTORY.md` 无遗漏后，再进入**阶段 0**（`analyze.js` + `docs/REGRESSION.md` + 基线数据）。
3. 在人类确认前，不进入阶段 0，不迁移文件，不创建 `src/` / `public/`，不改 `wrangler.toml`。
