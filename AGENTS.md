# LeLeTV — AI Agent 规范索引

> 本文件**只做索引**：规则与技能正文一律不内联在此，按场景到 `.agents/` 下**按需读取**，避免无谓的 token 消耗。
> 遵循 [AI 智能体开放标准](https://github.com/ai-agents-standards)。标记区块之外的内容不会被工具覆盖。

---

## 项目速览

| 项 | 值 |
|---|---|
| 项目 | LeLeTV（乐乐影视）— 自用的在线视频搜索与播放平台 |
| 技术栈 | Vanilla JS (ES6+) + Tailwind CSS + HTML5，**无前端框架**；迁移期逐步引入 TypeScript（esbuild 剥离类型，tsc 独立检查） |
| 部署 | Cloudflare Pages + Pages Functions + Workers + D1 |
| 播放器 | ArtPlayer + HLS.js |
| 主题色 | `#ec4899`（霓虹粉），HarmonyOS 深色调色板 |

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 热重载开发服务器（nodemon + Express 本地代理，默认 8080） |
| `npm run build` | 版本号注入 + esbuild 打包 + Tailwind 构建 |
| `npm start` | 生产模式启动 |
| `npm run typecheck` | `tsc --noEmit` 类型检查（阶段 1 起） |
| `npm run check` | 分层 / 预算 / 规则 / 覆盖 / 类型全量校验 |
| `npm run analyze` | 生成 bundle 体积报告（默认写 `docs/BASELINE.md`） |
| `npm run check:orphans` | 零引用文件检测（阶段 4.5 前只报告，不删除） |
| `npm run setup:hooks` | 安装 pre-commit 钩子（版本同步 + bundle 自动构建） |

## 关键目录

| 目录 | 说明 |
|------|------|
| `src/` | **迁移目标**：`core` / `services` / `ui` / `pages` / `router`（阶段 4 起） |
| `js/` | 现有 JS 模块（8 个子目录；阶段 4 逐个迁入 `src/`，迁移期两处并存） |
| `css/` | 手写 CSS + Tailwind 编译输出 |
| `libs/` | 第三方库（artplayer / hls.js / marked / sha256 / geist 字体） |
| `functions/` | Cloudflare Pages Functions：`/proxy/*` 采集站代理 + `_middleware.js` 注入 `window.__ENV__` |
| `workers/` | Cloudflare Workers：`tmdb-worker.js`（TMDB 代理 + 邀请码 API + 云端源管理） |
| `migrations/` | Cloudflare D1 迁移脚本 |
| `docs/` | 架构 / 迁移 / 回归 / 体积基线文档 |
| `scripts/` | 构建与校验脚本（`build-bundles` / `analyze` / `check-*`） |
| `.agents/rules/` | **规则正文**（`01`–`07` 为架构规则，其余为既有流程规则） |
| `.agents/skills/` | **技能正文**（单一内容源，所有 Agent 共用） |
| `.agents/templates/` | 新代码模板（`.ts` / 页面模板） |
| `.agents/migration/` | `INVENTORY` / `MAP` / `APPROVALS` / `CLEANUP` |

---

## 规则索引

> 「每个任务开始前」那条是必读，其余按场景读，不要全量加载。

### 架构规则（重构期）

| 场景 / 触发 | 读取 |
|---|---|
| 判断新文件放哪、能否 import | `.agents/rules/01-layering.md` |
| 新增 / 拆分页面 | `.agents/rules/02-page-structure.md` |
| 拆分 chunk、播放器 / 页面按需加载 | `.agents/rules/03-chunking.md` |
| 文件 / 类型 / 事件命名 | `.agents/rules/04-naming.md` |
| Cloudflare 部署、缓存、红区 | `.agents/rules/05-cloudflare.md` |
| 提交前检查禁止项 | `.agents/rules/06-forbidden.md` |
| 写 TS、类型化迁移 | `.agents/rules/07-typescript.md` |

### 现有流程规则

| 场景 / 触发 | 读取 |
|---|---|
| **每个任务开始前**（分类 + 技能分派，必读） | `.agents/rules/project-rules.md` |
| 写代码、改代码、写提交信息 | `.agents/rules/code-standards-rules.md` |
| 密钥、用户输入、外部请求、提交前安全自查 | `.agents/rules/security-rules.md` |
| 改部署配置、线上异常排查 | `.agents/rules/deployment-rules.md` |
| 影响分析、调用链、重命名、Bug 排查 | `.agents/rules/code-graph-rules.md` |
| 技能编排、难度分级、选设计技能 | `.agents/rules/skill-scheduling-rules.md` |
| 版本发布、更新日志、打 tag | `.agents/rules/version-management-rules.md` |
| 安装 / 升级 / 卸载技能 | `.agents/rules/skill-lifecycle-rules.md` |

---

## 技能索引

<!-- AGENT-INDEX:START -->

> 由 `node scripts/sync-agent-index.mjs` 自动生成（24 个技能、15 个规则文件），请勿手改。
> 新增技能或规则后重跑该脚本：`node scripts/sync-agent-index.mjs`

### 技能

| 技能 | 用途 |
|------|------|
| `brainstorming` | You MUST use this before any creative work - creating features, building components,… |
| `codegraph-cli` | CLI wrapper for CodeGraph semantic code intelligence |
| `create-page` | Use when adding a new page under src/pages; creates index.ts, template.html, style.css,… |
| `design-taste-frontend` | Anti-slop frontend skill for landing pages, portfolios, and redesigns |
| `full-output-enforcement` | Overrides default LLM truncation behavior |
| `gh-cli` | GitHub CLI (gh) comprehensive reference for repositories, issues, pull requests,… |
| `git-commit` | Execute git commit with conventional commit message analysis, intelligent staging, and… |
| `high-end-visual-design` | Teaches the AI to design like a high-end agency |
| `impeccable` | Use when the user wants to design, redesign, shape, critique, audit, polish, clarify,… |
| `installing-project-skills` | Use when installing skills for a new project, or when the user asks to update, upgrade,… |
| `karpathy-guidelines` | Behavioral guidelines to reduce common LLM coding mistakes |
| `managing-project-skills` | Use when the user asks to install, update, upgrade, uninstall, or check status of… |
| `migrate-module` | Use when moving one legacy module from js/ into src/ per MAP.md; preserves runtime… |
| `redesign-existing-projects` | Upgrades existing websites and apps to premium quality |
| `regression-check` | Use after each migration or chunk split; runs the documented regression checklist,… |
| `scheduling-project-skills` | Use when orchestrating multiple skills for a task — determining execution order,… |
| `split-chunk` | Use when a bundle exceeds budget or a page/player/source should load on demand; moves… |
| `superpowers-systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior, before proposing… |
| `syncing-agent-index` | 当新增、重命名或删除了 .agents/rules/ 下的规则文件或 .agents/skills/ 下的技能后，同步 AGENTS.md 与… |
| `test-driven-development` | Use when implementing any feature or bugfix, before writing implementation code |
| `type-module` | Use when converting one module to TypeScript; adds explicit types, narrows external… |
| `version-release` | 版本更新：更新 CHANGELOG.md、升级 VERSION.txt、同步 README。当用户说'更新更新日志'、'更新版本'、'发版'、'打 tag'… |
| `writing-plans` | Use when you have a spec or requirements for a multi-step task, before touching code |
| `writing-skills` | Use when creating new skills, editing existing skills, or verifying skills work before… |

### 规则文件

| 文件 | 标题 |
|------|------|
| `.agents/rules/01-layering.md` | 01 分层与依赖 |
| `.agents/rules/02-page-structure.md` | 02 页面结构 |
| `.agents/rules/03-chunking.md` | 03 代码分割 |
| `.agents/rules/04-naming.md` | 04 命名 |
| `.agents/rules/05-cloudflare.md` | 05 Cloudflare |
| `.agents/rules/06-forbidden.md` | 06 禁止事项 |
| `.agents/rules/07-typescript.md` | 07 TypeScript |
| `.agents/rules/code-graph-rules.md` | 代码图谱规则（CodeGraph） |
| `.agents/rules/code-standards-rules.md` | 代码规范规则 |
| `.agents/rules/deployment-rules.md` | 部署规则（Cloudflare） |
| `.agents/rules/project-rules.md` | 项目通用规则 |
| `.agents/rules/security-rules.md` | 安全规则（ECC 基线） |
| `.agents/rules/skill-lifecycle-rules.md` | 技能生命周期规则 |
| `.agents/rules/skill-scheduling-rules.md` | 技能调度规则 |
| `.agents/rules/version-management-rules.md` | 版本管理规则 |

<!-- AGENT-INDEX:END -->

---

## 硬规则（违反即拒绝提交）

1. 依赖只能向下：`core` 不 import `services` / `ui` / `pages`。
2. `pages/` 之间禁止互相 import，共享逻辑下沉 `services/` 或 `ui/`。
3. `index.html` 只含全局壳，页面业务 DOM 必须在 `pages/<name>/template.html`。
4. ArtPlayer / HLS.js 只允许出现在 `ui/player/`，必须独立 chunk。
5. `functions/`、`workers/`、`migrations/`、`wrangler.toml`、`_headers`、`_routes.json` 属红区，改动需人工确认。
6. 新增文件必须落在 `src/` 既有层内，禁止在根目录新建源文件。
7. 迁移完成后 `src/` 下新文件必须是 `.ts`，禁止新增 `.js`。
8. 禁止 `any` / `as any` 绕过类型错误。
9. 迁移 commit 不得改变运行时行为。
10. 禁止未经批准删除文件；删除必须在 `APPROVALS.md` 登记并跑回归。

## 现有流程规则

1. **更新版本必须调用 `version-release` 技能** —— 禁止凭记忆手改 `VERSION.txt` / `CHANGELOG.md`
2. **提交前过一遍安全检查清单** —— `.agents/rules/security-rules.md`
3. **未获明确要求不动部署配置**（`wrangler.toml` / `_headers` / `_routes.json` / CI 文件）
4. **改核心函数/类之前先跑影响分析** —— `.agents/rules/code-graph-rules.md`
5. **新增技能或规则后重跑索引** —— `node scripts/sync-agent-index.mjs`
6. **有 CLI 就用 CLI，不接 MCP** —— 避免常驻工具位与上下文，详见 `.agents/rules/project-rules.md`


