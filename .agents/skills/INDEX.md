# 技能与规则索引

> 由 `node scripts/sync-agent-index.mjs` 自动生成，请勿手改。
> 技能实体在 `.agents/skills/<name>/SKILL.md`，规则实体在 `.agents/rules/`。
> 各 AI 工具的接线方式见 `.agents/README.md`。

---

## 技能（24）

| 技能 | 用途 | 路径 |
|------|------|------|
| `brainstorming` | You MUST use this before any creative work - creating features, building components,… | `.agents/skills/brainstorming/` |
| `codegraph-cli` | CLI wrapper for CodeGraph semantic code intelligence | `.agents/skills/codegraph-cli/` |
| `create-page` | Use when adding a new page under src/pages; creates index.ts, template.html, style.css,… | `.agents/skills/create-page/` |
| `design-taste-frontend` | Anti-slop frontend skill for landing pages, portfolios, and redesigns | `.agents/skills/design-taste-frontend/` |
| `full-output-enforcement` | Overrides default LLM truncation behavior | `.agents/skills/full-output-enforcement/` |
| `gh-cli` | GitHub CLI (gh) comprehensive reference for repositories, issues, pull requests,… | `.agents/skills/gh-cli/` |
| `git-commit` | Execute git commit with conventional commit message analysis, intelligent staging, and… | `.agents/skills/git-commit/` |
| `high-end-visual-design` | Teaches the AI to design like a high-end agency | `.agents/skills/high-end-visual-design/` |
| `impeccable` | Use when the user wants to design, redesign, shape, critique, audit, polish, clarify,… | `.agents/skills/impeccable/` |
| `installing-project-skills` | Use when installing skills for a new project, or when the user asks to update, upgrade,… | `.agents/skills/installing-project-skills/` |
| `karpathy-guidelines` | Behavioral guidelines to reduce common LLM coding mistakes | `.agents/skills/karpathy-guidelines/` |
| `managing-project-skills` | Use when the user asks to install, update, upgrade, uninstall, or check status of… | `.agents/skills/managing-project-skills/` |
| `migrate-module` | Use when moving one legacy module from js/ into src/ per MAP.md; preserves runtime… | `.agents/skills/migrate-module/` |
| `redesign-existing-projects` | Upgrades existing websites and apps to premium quality | `.agents/skills/redesign-existing-projects/` |
| `regression-check` | Use after each migration or chunk split; runs the documented regression checklist,… | `.agents/skills/regression-check/` |
| `scheduling-project-skills` | Use when orchestrating multiple skills for a task — determining execution order,… | `.agents/skills/scheduling-project-skills/` |
| `split-chunk` | Use when a bundle exceeds budget or a page/player/source should load on demand; moves… | `.agents/skills/split-chunk/` |
| `superpowers-systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior, before proposing… | `.agents/skills/superpowers-systematic-debugging/` |
| `syncing-agent-index` | 当新增、重命名或删除了 .agents/rules/ 下的规则文件或 .agents/skills/ 下的技能后，同步 AGENTS.md 与… | `.agents/skills/syncing-agent-index/` |
| `test-driven-development` | Use when implementing any feature or bugfix, before writing implementation code | `.agents/skills/test-driven-development/` |
| `type-module` | Use when converting one module to TypeScript; adds explicit types, narrows external… | `.agents/skills/type-module/` |
| `version-release` | 版本更新：更新 CHANGELOG.md、升级 VERSION.txt、同步 README。当用户说'更新更新日志'、'更新版本'、'发版'、'打 tag'… | `.agents/skills/version-release/` |
| `writing-plans` | Use when you have a spec or requirements for a multi-step task, before touching code | `.agents/skills/writing-plans/` |
| `writing-skills` | Use when creating new skills, editing existing skills, or verifying skills work before… | `.agents/skills/writing-skills/` |

## 规则文件（15）

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

---

## 新增内容后

```bash
node scripts/sync-agent-index.mjs          # 重新生成索引
node scripts/sync-agent-index.mjs --check  # 只检查是否已同步
```

## 完整技能树与场景分派

场景 → 技能的对应关系见 `.agents/rules/skill-scheduling-rules.md`，
任务分类铁律见 `.agents/rules/project-rules.md`。
