# LeLeTV — AI Agent 规范索引

> 本文件**只做索引**：规则与技能正文一律不内联在此，按场景到 `.agents/` 下**按需读取**，避免无谓的 token 消耗。
> 遵循 [AI 智能体开放标准](https://github.com/ai-agents-standards)。标记区块之外的内容不会被工具覆盖。

---

## 项目速览

| 项 | 值 |
|---|---|
| 项目 | LeLeTV（乐乐影视）— 自用的在线视频搜索与播放平台 |
| 技术栈 | Vanilla JS (ES6+) + Tailwind CSS + HTML5，**无前端框架** |
| 部署 | Cloudflare Pages + Pages Functions + Workers + D1 |
| 播放器 | ArtPlayer + HLS.js |
| 主题色 | `#ec4899`（霓虹粉），HarmonyOS 深色调色板 |

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 热重载开发服务器（nodemon + Express 本地代理，默认 8080） |
| `npm run build` | 版本号注入 + esbuild 打包 + Tailwind 构建 |
| `npm start` | 生产模式启动 |
| `npm run setup:hooks` | 安装 pre-commit 钩子（版本同步 + bundle 自动构建） |

## 关键目录

| 目录 | 说明 |
|------|------|
| `js/` | 核心 JS 模块（8 个子目录；经 esbuild 打成 core / app / player 三个 bundle） |
| `css/` | 手写 CSS + Tailwind 编译输出 |
| `libs/` | 第三方库（artplayer / hls.js / marked / sha256 / geist 字体） |
| `functions/` | Cloudflare Pages Functions：`/proxy/*` 采集站代理 + `_middleware.js` 注入 `window.__ENV__` |
| `workers/` | Cloudflare Workers：`tmdb-worker.js`（TMDB 代理 + 邀请码 API + 云端源管理） |
| `migrations/` | Cloudflare D1 迁移脚本 |
| `.agents/rules/` | **规则正文**（按需读取） |
| `.agents/skills/` | **技能正文**（单一内容源，所有 Agent 共用） |

---

## 规则索引

> 「每个任务开始前」那条是必读，其余按场景读，不要全量加载。

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

> 由 `node scripts/sync-agent-index.mjs` 自动生成（19 个技能、8 个规则文件），请勿手改。
> 新增技能或规则后重跑该脚本：`node scripts/sync-agent-index.mjs`

### 技能

| 技能 | 用途 |
|------|------|
| `brainstorming` | You MUST use this before any creative work - creating features, building components,… |
| `codegraph-cli` | CLI wrapper for CodeGraph semantic code intelligence |
| `design-taste-frontend` | Anti-slop frontend skill for landing pages, portfolios, and redesigns |
| `full-output-enforcement` | Overrides default LLM truncation behavior |
| `gh-cli` | GitHub CLI (gh) comprehensive reference for repositories, issues, pull requests,… |
| `git-commit` | Execute git commit with conventional commit message analysis, intelligent staging, and… |
| `high-end-visual-design` | Teaches the AI to design like a high-end agency |
| `impeccable` | Use when the user wants to design, redesign, shape, critique, audit, polish, clarify,… |
| `installing-project-skills` | Use when installing skills for a new project, or when the user asks to update, upgrade,… |
| `karpathy-guidelines` | Behavioral guidelines to reduce common LLM coding mistakes |
| `managing-project-skills` | Use when the user asks to install, update, upgrade, uninstall, or check status of… |
| `redesign-existing-projects` | Upgrades existing websites and apps to premium quality |
| `scheduling-project-skills` | Use when orchestrating multiple skills for a task — determining execution order,… |
| `superpowers-systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior, before proposing… |
| `syncing-agent-index` | 当新增、重命名或删除了 .agents/rules/ 下的规则文件或 .agents/skills/ 下的技能后，同步 AGENTS.md 与… |
| `test-driven-development` | Use when implementing any feature or bugfix, before writing implementation code |
| `version-release` | 版本更新：更新 CHANGELOG.md、升级 VERSION.txt、同步 README。当用户说'更新更新日志'、'更新版本'、'发版'、'打 tag'… |
| `writing-plans` | Use when you have a spec or requirements for a multi-step task, before touching code |
| `writing-skills` | Use when creating new skills, editing existing skills, or verifying skills work before… |

### 规则文件

| 文件 | 标题 |
|------|------|
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

## 最高优先级强制规则

1. **更新版本必须调用 `version-release` 技能** —— 禁止凭记忆手改 `VERSION.txt` / `CHANGELOG.md`
2. **提交前过一遍安全检查清单** —— `.agents/rules/security-rules.md`
3. **未获明确要求不动部署配置**（`wrangler.toml` / `_headers` / `_routes.json` / CI 文件）
4. **改核心函数/类之前先跑影响分析** —— `.agents/rules/code-graph-rules.md`
5. **新增技能或规则后重跑索引** —— `node scripts/sync-agent-index.mjs`
6. **有 CLI 就用 CLI，不接 MCP** —— 避免常驻工具位与上下文，详见 `.agents/rules/project-rules.md`


