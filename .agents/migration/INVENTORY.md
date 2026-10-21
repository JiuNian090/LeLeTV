# INVENTORY — 全量文件清单（阶段 -1 初版）

> 权威来源：`git ls-files`（当前共 **369** 个跟踪文件；迁移前基线 326，阶段 -1 / 0 新增的文档与脚本均已登记）。
> 本表逐文件登记，一个不许漏；`check-coverage` 校验要求条目数 == `git ls-files` 数量。
> 生成时间：2026-10-21；分支：`refactor/slim-arch`；基线 tag：`pre-refactor`。

## 图例

| 去向类型 | 含义 |
|---|---|
| `migrated` | 计划搬到新路径（阶段 4 执行，迁移前状态保持 pending） |
| `keep` | 保留原位（红区、第三方库、AI 资产、工具配置等） |
| `pending` | 归属或合并目标尚未定稿，留待阶段 1 的 `MAP.md` |
| `suspected-unused` | 疑似无用，**不删除**，留待阶段 4.5 人工确认 |
| `delete` | 本阶段 -1 **没有**任何 delete 记录 |
| `merge` | 本阶段 -1 **没有**任何 merge 记录；归并需 `APPROVALS.md` 批准 |

## 汇总

| 去向类型 | 数量 |
|---|---|
| keep | 278 |
| migrated | 85 |
| pending | 2 |
| suspected-unused | 4 |
| **合计** | **369** |

> 疑似无用初判：`service-worker.js`、`image/brand/leletv-lockup.svg`、`image/brand/leletv-mark.svg`、`image/brand/leletv-wordmark-currentcolor.svg`。全部只登记，不删除。

## 根目录

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 1 | `.env.example` | 环境变量示例（无密钥） | keep | — | — | — | done | — |
| 2 | `.gitignore` | Git 忽略规则 | keep | — | — | — | done | — |
| 3 | `AGENTS.md` | AI 开发指南索引（唯一真相源） | keep | — | — | — | done | — |
| 4 | `CHANGELOG.md` | 版本变更记录 | keep | — | — | — | done | — |
| 5 | `CLAUDE.md` | Claude 专属配置（导入 AGENTS.md） | keep | — | — | — | done | — |
| 6 | `LICENSE` | PolyForm Noncommercial 许可证 | keep | — | — | — | done | — |
| 7 | `README.md` | 项目说明与使用文档 | keep | — | — | — | done | — |
| 8 | `VERSION.txt` | 当前版本号（构建读取） | keep | — | — | — | done | — |
| 9 | `_headers` | Cloudflare Pages 缓存与 CSP 配置（红区） | keep | — | — | — | done | — |
| 10 | `_routes.json` | Cloudflare Pages Functions 路由配置（红区） | keep | — | — | — | done | — |
| 11 | `build.config.js` | 构建配置 / bundle 清单单一来源（阶段 3 新增） | keep | — | — | — | done | — |
| 12 | `index.html` | 应用壳 + 首页骨架 + 启动动画 | migrated | `src/index.html` | — | — | pending | — |
| 13 | `manifest.json` | PWA 清单 | migrated | `public/manifest.json` | — | — | pending | — |
| 14 | `nodemon.json` | nodemon 开发配置 | keep | — | — | — | done | — |
| 15 | `package.json` | 依赖与 scripts | keep | — | — | — | done | — |
| 16 | `player.html` | 独立播放页文档入口 | migrated | `src/pages/player/index.html` | — | — | pending | — |
| 17 | `server.mjs` | 本地开发/生产 Express 服务器与代理 | keep | — | — | — | done | — |
| 18 | `service-worker.js` | Service Worker 退役 kill-switch（静态零引用） | suspected-unused | — | — | — | pending | 仅服务残留旧 SW；注释写明老访客清理后可删。阶段 4.5 人工确认，禁止迁移期删除 |
| 19 | `tsconfig.json` | TypeScript 编译配置（阶段 1 新增） | keep | — | — | — | done | — |
| 20 | `wrangler.toml` | Workers / D1 部署绑定（红区） | keep | — | — | — | done | — |

## .agents/（现有 AI 资产，逐条登记）

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 21 | `.agents/README.md` | AI 资产（规则/技能）目录说明与接线指南 | keep | — | — | — | done | 阶段 1 更新接线说明 |
| 22 | `.agents/migration/APPROVALS.md` | 人工批准记录（本阶段新增） | keep | — | — | — | done | 阶段 -1 新增资产，纳入后续阶段维护 |
| 23 | `.agents/migration/CLEANUP.md` | 清理检测与处理记录（本阶段新增） | keep | — | — | — | done | 阶段 -1 新增资产，纳入后续阶段维护 |
| 24 | `.agents/migration/INVENTORY.md` | 阶段 -1 全量文件登记表（本阶段新增） | keep | — | — | — | done | 阶段 -1 新增资产，纳入后续阶段维护 |
| 25 | `.agents/migration/MAP.md` | 迁移任务队列（阶段 1 新增） | keep | — | — | — | done | 阶段 -1 新增资产，纳入后续阶段维护 |
| 26 | `.agents/migration/PHASE-1-REPORT.md` | 阶段 -1 勘察报告（本阶段新增） | keep | — | — | — | done | 阶段 -1 新增资产，纳入后续阶段维护 |
| 383 | `.agents/migration/RESUME.md` | 重构续接状态（分支 / 进度 / 下一步 / 验证命令） | keep | — | — | — | done | 阶段 4 续接文件，压缩上下文或重开会话时先读它 |
| 27 | `.agents/rules/01-layering.md` | 架构规则：分层与依赖 | keep | — | — | — | done | 阶段 1 新增架构规则，长期保留 |
| 28 | `.agents/rules/02-page-structure.md` | 架构规则：页面结构 | keep | — | — | — | done | 阶段 1 新增架构规则，长期保留 |
| 29 | `.agents/rules/03-chunking.md` | 架构规则：代码分割 | keep | — | — | — | done | 阶段 1 新增架构规则，长期保留 |
| 30 | `.agents/rules/04-naming.md` | 架构规则：命名 | keep | — | — | — | done | 阶段 1 新增架构规则，长期保留 |
| 31 | `.agents/rules/05-cloudflare.md` | 架构规则：Cloudflare 部署 | keep | — | — | — | done | 阶段 1 新增架构规则，长期保留 |
| 32 | `.agents/rules/06-forbidden.md` | 架构规则：禁止事项 | keep | — | — | — | done | 阶段 1 新增架构规则，长期保留 |
| 33 | `.agents/rules/07-typescript.md` | 架构规则：TypeScript | keep | — | — | — | done | 阶段 1 新增架构规则，长期保留 |
| 34 | `.agents/rules/code-graph-rules.md` | AI 规则：CodeGraph 影响分析 | keep | — | — | — | done | 阶段 1 归并进 01-07 的候选；归并需 APPROVALS.md 批准 |
| 35 | `.agents/rules/code-standards-rules.md` | AI 规则：代码与提交规范 | keep | — | — | — | done | 阶段 1 归并进 01-07 的候选；归并需 APPROVALS.md 批准 |
| 36 | `.agents/rules/deployment-rules.md` | AI 规则：Cloudflare 部署与排查 | keep | — | — | — | done | 阶段 1 归并进 01-07 的候选；归并需 APPROVALS.md 批准 |
| 37 | `.agents/rules/project-rules.md` | AI 规则：任务分类与技能分派（必读） | keep | — | — | — | done | 阶段 1 归并进 01-07 的候选；归并需 APPROVALS.md 批准 |
| 38 | `.agents/rules/security-rules.md` | AI 规则：安全基线 | keep | — | — | — | done | 阶段 1 归并进 01-07 的候选；归并需 APPROVALS.md 批准 |
| 39 | `.agents/rules/skill-lifecycle-rules.md` | AI 规则：技能安装/升级/卸载 | keep | — | — | — | done | 阶段 1 归并进 01-07 的候选；归并需 APPROVALS.md 批准 |
| 40 | `.agents/rules/skill-scheduling-rules.md` | AI 规则：技能编排与设计技能选择 | keep | — | — | — | done | 阶段 1 归并进 01-07 的候选；归并需 APPROVALS.md 批准 |
| 41 | `.agents/rules/templates/code-standards-node.md` | 规则模板：code-standards-node.md | keep | — | — | — | done | 现有 AI 资产，阶段 1 评估归并，不得丢弃 |
| 42 | `.agents/rules/templates/project-rules-base.md` | 规则模板：project-rules-base.md | keep | — | — | — | done | 现有 AI 资产，阶段 1 评估归并，不得丢弃 |
| 43 | `.agents/rules/version-management-rules.md` | AI 规则：版本发布流程 | keep | — | — | — | done | 阶段 1 归并进 01-07 的候选；归并需 APPROVALS.md 批准 |
| 44 | `.agents/skills-config.template.json` | 技能配置模板 | keep | — | — | — | done | — |
| 45 | `.agents/skills-registry.json` | 技能注册表 | keep | — | — | — | done | — |
| 46 | `.agents/skills/INDEX.md` | 技能与规则索引（脚本自动生成） | keep | — | — | — | done | — |
| 47 | `.agents/skills/brainstorming/SKILL.md` | 技能正文：brainstorming | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 48 | `.agents/skills/codegraph-cli/SKILL.md` | 技能正文：codegraph-cli | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 49 | `.agents/skills/create-page/SKILL.md` | 技能正文：create-page | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 50 | `.agents/skills/design-taste-frontend/SKILL.md` | 技能正文：design-taste-frontend | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 51 | `.agents/skills/full-output-enforcement/SKILL.md` | 技能正文：full-output-enforcement | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 52 | `.agents/skills/gh-cli/SKILL.md` | 技能正文：gh-cli | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 53 | `.agents/skills/git-commit/SKILL.md` | 技能正文：git-commit | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 54 | `.agents/skills/high-end-visual-design/SKILL.md` | 技能正文：high-end-visual-design | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 55 | `.agents/skills/impeccable/SKILL.md` | 技能正文：impeccable | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 56 | `.agents/skills/impeccable/agents/impeccable_asset_producer.toml` | 技能资源：impeccable/agents/impeccable_asset_producer.toml | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 57 | `.agents/skills/impeccable/agents/impeccable_documenter.toml` | 技能资源：impeccable/agents/impeccable_documenter.toml | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 58 | `.agents/skills/impeccable/agents/impeccable_finish_reviewer.toml` | 技能资源：impeccable/agents/impeccable_finish_reviewer.toml | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 59 | `.agents/skills/impeccable/agents/impeccable_manual_edit_applier.toml` | 技能资源：impeccable/agents/impeccable_manual_edit_applier.toml | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 60 | `.agents/skills/impeccable/agents/openai.yaml` | 技能资源：impeccable/agents/openai.yaml | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 61 | `.agents/skills/impeccable/reference/adapt.md` | 技能资源：impeccable/reference/adapt.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 62 | `.agents/skills/impeccable/reference/adapt.native.md` | 技能资源：impeccable/reference/adapt.native.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 63 | `.agents/skills/impeccable/reference/android.md` | 技能资源：impeccable/reference/android.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 64 | `.agents/skills/impeccable/reference/animate.md` | 技能资源：impeccable/reference/animate.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 65 | `.agents/skills/impeccable/reference/audit.md` | 技能资源：impeccable/reference/audit.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 66 | `.agents/skills/impeccable/reference/audit.native.md` | 技能资源：impeccable/reference/audit.native.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 67 | `.agents/skills/impeccable/reference/bolder.md` | 技能资源：impeccable/reference/bolder.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 68 | `.agents/skills/impeccable/reference/clarify.md` | 技能资源：impeccable/reference/clarify.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 69 | `.agents/skills/impeccable/reference/colorize.md` | 技能资源：impeccable/reference/colorize.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 70 | `.agents/skills/impeccable/reference/craft-floor.md` | 技能资源：impeccable/reference/craft-floor.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 71 | `.agents/skills/impeccable/reference/craft.md` | 技能资源：impeccable/reference/craft.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 72 | `.agents/skills/impeccable/reference/critique.md` | 技能资源：impeccable/reference/critique.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 73 | `.agents/skills/impeccable/reference/degraded/asset-producer.md` | 技能资源：impeccable/reference/degraded/asset-producer.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 74 | `.agents/skills/impeccable/reference/degraded/documenter.md` | 技能资源：impeccable/reference/degraded/documenter.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 75 | `.agents/skills/impeccable/reference/degraded/finish-reviewer.md` | 技能资源：impeccable/reference/degraded/finish-reviewer.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 76 | `.agents/skills/impeccable/reference/degraded/manual-edit-applier.md` | 技能资源：impeccable/reference/degraded/manual-edit-applier.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 77 | `.agents/skills/impeccable/reference/delight.md` | 技能资源：impeccable/reference/delight.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 78 | `.agents/skills/impeccable/reference/distill.md` | 技能资源：impeccable/reference/distill.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 79 | `.agents/skills/impeccable/reference/doctor.md` | 技能资源：impeccable/reference/doctor.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 80 | `.agents/skills/impeccable/reference/document.md` | 技能资源：impeccable/reference/document.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 81 | `.agents/skills/impeccable/reference/extract.md` | 技能资源：impeccable/reference/extract.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 82 | `.agents/skills/impeccable/reference/harden.md` | 技能资源：impeccable/reference/harden.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 83 | `.agents/skills/impeccable/reference/hooks.md` | 技能资源：impeccable/reference/hooks.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 84 | `.agents/skills/impeccable/reference/init.md` | 技能资源：impeccable/reference/init.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 85 | `.agents/skills/impeccable/reference/ios.md` | 技能资源：impeccable/reference/ios.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 86 | `.agents/skills/impeccable/reference/layout.md` | 技能资源：impeccable/reference/layout.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 87 | `.agents/skills/impeccable/reference/live-setup.md` | 技能资源：impeccable/reference/live-setup.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 88 | `.agents/skills/impeccable/reference/live.md` | 技能资源：impeccable/reference/live.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 89 | `.agents/skills/impeccable/reference/new-work.md` | 技能资源：impeccable/reference/new-work.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 90 | `.agents/skills/impeccable/reference/onboard.md` | 技能资源：impeccable/reference/onboard.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 91 | `.agents/skills/impeccable/reference/operate.md` | 技能资源：impeccable/reference/operate.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 92 | `.agents/skills/impeccable/reference/optimize.md` | 技能资源：impeccable/reference/optimize.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 93 | `.agents/skills/impeccable/reference/overdrive.md` | 技能资源：impeccable/reference/overdrive.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 94 | `.agents/skills/impeccable/reference/polish.md` | 技能资源：impeccable/reference/polish.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 95 | `.agents/skills/impeccable/reference/quieter.md` | 技能资源：impeccable/reference/quieter.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 96 | `.agents/skills/impeccable/reference/routing.md` | 技能资源：impeccable/reference/routing.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 97 | `.agents/skills/impeccable/reference/shape.md` | 技能资源：impeccable/reference/shape.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 98 | `.agents/skills/impeccable/reference/typeset.md` | 技能资源：impeccable/reference/typeset.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 99 | `.agents/skills/impeccable/reference/visualize.md` | 技能资源：impeccable/reference/visualize.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 100 | `.agents/skills/impeccable/scripts/command-metadata.json` | 技能资源：impeccable/scripts/command-metadata.json | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 101 | `.agents/skills/impeccable/scripts/concept-seed.mjs` | 技能资源：impeccable/scripts/concept-seed.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 102 | `.agents/skills/impeccable/scripts/context-signals.mjs` | 技能资源：impeccable/scripts/context-signals.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 103 | `.agents/skills/impeccable/scripts/context.mjs` | 技能资源：impeccable/scripts/context.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 104 | `.agents/skills/impeccable/scripts/critique-storage.mjs` | 技能资源：impeccable/scripts/critique-storage.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 105 | `.agents/skills/impeccable/scripts/detect-csp.mjs` | 技能资源：impeccable/scripts/detect-csp.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 106 | `.agents/skills/impeccable/scripts/detect.mjs` | 技能资源：impeccable/scripts/detect.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 107 | `.agents/skills/impeccable/scripts/detector/browser/injected/index.mjs` | 技能资源：impeccable/scripts/detector/browser/injected/index.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 108 | `.agents/skills/impeccable/scripts/detector/cli/main.mjs` | 技能资源：impeccable/scripts/detector/cli/main.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 109 | `.agents/skills/impeccable/scripts/detector/design-system.mjs` | 技能资源：impeccable/scripts/detector/design-system.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 110 | `.agents/skills/impeccable/scripts/detector/detect-antipatterns-browser.js` | 技能资源：impeccable/scripts/detector/detect-antipatterns-browser.js | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 111 | `.agents/skills/impeccable/scripts/detector/detect-antipatterns.mjs` | 技能资源：impeccable/scripts/detector/detect-antipatterns.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 112 | `.agents/skills/impeccable/scripts/detector/engines/browser/detect-url.mjs` | 技能资源：impeccable/scripts/detector/engines/browser/detect-url.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 113 | `.agents/skills/impeccable/scripts/detector/engines/regex/detect-text.mjs` | 技能资源：impeccable/scripts/detector/engines/regex/detect-text.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 114 | `.agents/skills/impeccable/scripts/detector/engines/static-html/css-cascade.mjs` | 技能资源：impeccable/scripts/detector/engines/static-html/css-cascade.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 115 | `.agents/skills/impeccable/scripts/detector/engines/static-html/detect-html.mjs` | 技能资源：impeccable/scripts/detector/engines/static-html/detect-html.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 116 | `.agents/skills/impeccable/scripts/detector/engines/visual/screenshot-contrast.mjs` | 技能资源：impeccable/scripts/detector/engines/visual/screenshot-contrast.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 117 | `.agents/skills/impeccable/scripts/detector/findings.mjs` | 技能资源：impeccable/scripts/detector/findings.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 118 | `.agents/skills/impeccable/scripts/detector/node/file-system.mjs` | 技能资源：impeccable/scripts/detector/node/file-system.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 119 | `.agents/skills/impeccable/scripts/detector/profile/profiler.mjs` | 技能资源：impeccable/scripts/detector/profile/profiler.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 120 | `.agents/skills/impeccable/scripts/detector/registry/antipatterns.mjs` | 技能资源：impeccable/scripts/detector/registry/antipatterns.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 121 | `.agents/skills/impeccable/scripts/detector/rules/checks.mjs` | 技能资源：impeccable/scripts/detector/rules/checks.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 122 | `.agents/skills/impeccable/scripts/detector/shared/color.mjs` | 技能资源：impeccable/scripts/detector/shared/color.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 123 | `.agents/skills/impeccable/scripts/detector/shared/constants.mjs` | 技能资源：impeccable/scripts/detector/shared/constants.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 124 | `.agents/skills/impeccable/scripts/detector/shared/fonts.mjs` | 技能资源：impeccable/scripts/detector/shared/fonts.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 125 | `.agents/skills/impeccable/scripts/detector/shared/inline-ignores.mjs` | 技能资源：impeccable/scripts/detector/shared/inline-ignores.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 126 | `.agents/skills/impeccable/scripts/detector/shared/page.mjs` | 技能资源：impeccable/scripts/detector/shared/page.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 127 | `.agents/skills/impeccable/scripts/doctor.mjs` | 技能资源：impeccable/scripts/doctor.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 128 | `.agents/skills/impeccable/scripts/embed-prompt.mjs` | 技能资源：impeccable/scripts/embed-prompt.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 129 | `.agents/skills/impeccable/scripts/generate-image.mjs` | 技能资源：impeccable/scripts/generate-image.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 130 | `.agents/skills/impeccable/scripts/hook-admin.mjs` | 技能资源：impeccable/scripts/hook-admin.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 131 | `.agents/skills/impeccable/scripts/hook-before-edit.mjs` | 技能资源：impeccable/scripts/hook-before-edit.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 132 | `.agents/skills/impeccable/scripts/hook-lib.mjs` | 技能资源：impeccable/scripts/hook-lib.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 133 | `.agents/skills/impeccable/scripts/hook.mjs` | 技能资源：impeccable/scripts/hook.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 134 | `.agents/skills/impeccable/scripts/lib/artifact-schema.mjs` | 技能资源：impeccable/scripts/lib/artifact-schema.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 135 | `.agents/skills/impeccable/scripts/lib/composition-catalog.mjs` | 技能资源：impeccable/scripts/lib/composition-catalog.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 136 | `.agents/skills/impeccable/scripts/lib/concept-catalog.mjs` | 技能资源：impeccable/scripts/lib/concept-catalog.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 137 | `.agents/skills/impeccable/scripts/lib/design-parser.mjs` | 技能资源：impeccable/scripts/lib/design-parser.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 138 | `.agents/skills/impeccable/scripts/lib/impeccable-config.mjs` | 技能资源：impeccable/scripts/lib/impeccable-config.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 139 | `.agents/skills/impeccable/scripts/lib/impeccable-paths.mjs` | 技能资源：impeccable/scripts/lib/impeccable-paths.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 140 | `.agents/skills/impeccable/scripts/lib/is-generated.mjs` | 技能资源：impeccable/scripts/lib/is-generated.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 141 | `.agents/skills/impeccable/scripts/lib/open-system-browser.mjs` | 技能资源：impeccable/scripts/lib/open-system-browser.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 142 | `.agents/skills/impeccable/scripts/lib/provider.mjs` | 技能资源：impeccable/scripts/lib/provider.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 143 | `.agents/skills/impeccable/scripts/lib/roll-selection.mjs` | 技能资源：impeccable/scripts/lib/roll-selection.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 144 | `.agents/skills/impeccable/scripts/lib/staleness-deep.mjs` | 技能资源：impeccable/scripts/lib/staleness-deep.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 145 | `.agents/skills/impeccable/scripts/lib/staleness-notice.mjs` | 技能资源：impeccable/scripts/lib/staleness-notice.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 146 | `.agents/skills/impeccable/scripts/lib/staleness.mjs` | 技能资源：impeccable/scripts/lib/staleness.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 147 | `.agents/skills/impeccable/scripts/lib/surface-briefs.mjs` | 技能资源：impeccable/scripts/lib/surface-briefs.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 148 | `.agents/skills/impeccable/scripts/lib/target-args.mjs` | 技能资源：impeccable/scripts/lib/target-args.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 149 | `.agents/skills/impeccable/scripts/lib/target-slug.mjs` | 技能资源：impeccable/scripts/lib/target-slug.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 150 | `.agents/skills/impeccable/scripts/lib/template-extensions.mjs` | 技能资源：impeccable/scripts/lib/template-extensions.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 151 | `.agents/skills/impeccable/scripts/live-accept.mjs` | 技能资源：impeccable/scripts/live-accept.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 152 | `.agents/skills/impeccable/scripts/live-browser-dom.js` | 技能资源：impeccable/scripts/live-browser-dom.js | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 153 | `.agents/skills/impeccable/scripts/live-browser-session.js` | 技能资源：impeccable/scripts/live-browser-session.js | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 154 | `.agents/skills/impeccable/scripts/live-browser.js` | 技能资源：impeccable/scripts/live-browser.js | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 155 | `.agents/skills/impeccable/scripts/live-commit-manual-edits.mjs` | 技能资源：impeccable/scripts/live-commit-manual-edits.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 156 | `.agents/skills/impeccable/scripts/live-complete.mjs` | 技能资源：impeccable/scripts/live-complete.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 157 | `.agents/skills/impeccable/scripts/live-copy-edit-agent.mjs` | 技能资源：impeccable/scripts/live-copy-edit-agent.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 158 | `.agents/skills/impeccable/scripts/live-discard-manual-edits.mjs` | 技能资源：impeccable/scripts/live-discard-manual-edits.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 159 | `.agents/skills/impeccable/scripts/live-inject.mjs` | 技能资源：impeccable/scripts/live-inject.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 160 | `.agents/skills/impeccable/scripts/live-insert.mjs` | 技能资源：impeccable/scripts/live-insert.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 161 | `.agents/skills/impeccable/scripts/live-manual-edit-evidence.mjs` | 技能资源：impeccable/scripts/live-manual-edit-evidence.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 162 | `.agents/skills/impeccable/scripts/live-poll.mjs` | 技能资源：impeccable/scripts/live-poll.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 163 | `.agents/skills/impeccable/scripts/live-resume.mjs` | 技能资源：impeccable/scripts/live-resume.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 164 | `.agents/skills/impeccable/scripts/live-server.mjs` | 技能资源：impeccable/scripts/live-server.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 165 | `.agents/skills/impeccable/scripts/live-status.mjs` | 技能资源：impeccable/scripts/live-status.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 166 | `.agents/skills/impeccable/scripts/live-target.mjs` | 技能资源：impeccable/scripts/live-target.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 167 | `.agents/skills/impeccable/scripts/live-wrap.mjs` | 技能资源：impeccable/scripts/live-wrap.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 168 | `.agents/skills/impeccable/scripts/live.mjs` | 技能资源：impeccable/scripts/live.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 169 | `.agents/skills/impeccable/scripts/live/accept-css.mjs` | 技能资源：impeccable/scripts/live/accept-css.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 170 | `.agents/skills/impeccable/scripts/live/accept-verify.mjs` | 技能资源：impeccable/scripts/live/accept-verify.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 171 | `.agents/skills/impeccable/scripts/live/browser-script-parts.mjs` | 技能资源：impeccable/scripts/live/browser-script-parts.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 172 | `.agents/skills/impeccable/scripts/live/completion.mjs` | 技能资源：impeccable/scripts/live/completion.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 173 | `.agents/skills/impeccable/scripts/live/event-validation.mjs` | 技能资源：impeccable/scripts/live/event-validation.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 174 | `.agents/skills/impeccable/scripts/live/frameworks/astro.mjs` | 技能资源：impeccable/scripts/live/frameworks/astro.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 175 | `.agents/skills/impeccable/scripts/live/frameworks/detect-utils.mjs` | 技能资源：impeccable/scripts/live/frameworks/detect-utils.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 176 | `.agents/skills/impeccable/scripts/live/frameworks/index.mjs` | 技能资源：impeccable/scripts/live/frameworks/index.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 177 | `.agents/skills/impeccable/scripts/live/frameworks/journal.mjs` | 技能资源：impeccable/scripts/live/frameworks/journal.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 178 | `.agents/skills/impeccable/scripts/live/frameworks/nextjs.mjs` | 技能资源：impeccable/scripts/live/frameworks/nextjs.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 179 | `.agents/skills/impeccable/scripts/live/frameworks/nuxt.mjs` | 技能资源：impeccable/scripts/live/frameworks/nuxt.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 180 | `.agents/skills/impeccable/scripts/live/frameworks/script-src.mjs` | 技能资源：impeccable/scripts/live/frameworks/script-src.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 181 | `.agents/skills/impeccable/scripts/live/frameworks/static-html.mjs` | 技能资源：impeccable/scripts/live/frameworks/static-html.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 182 | `.agents/skills/impeccable/scripts/live/frameworks/sveltekit.mjs` | 技能资源：impeccable/scripts/live/frameworks/sveltekit.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 183 | `.agents/skills/impeccable/scripts/live/frameworks/tag-strategy.mjs` | 技能资源：impeccable/scripts/live/frameworks/tag-strategy.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 184 | `.agents/skills/impeccable/scripts/live/frameworks/tanstack-start.mjs` | 技能资源：impeccable/scripts/live/frameworks/tanstack-start.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 185 | `.agents/skills/impeccable/scripts/live/frameworks/vite-generic.mjs` | 技能资源：impeccable/scripts/live/frameworks/vite-generic.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 186 | `.agents/skills/impeccable/scripts/live/generation-preflight.mjs` | 技能资源：impeccable/scripts/live/generation-preflight.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 187 | `.agents/skills/impeccable/scripts/live/insert-ui.mjs` | 技能资源：impeccable/scripts/live/insert-ui.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 188 | `.agents/skills/impeccable/scripts/live/instructions.mjs` | 技能资源：impeccable/scripts/live/instructions.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 189 | `.agents/skills/impeccable/scripts/live/manual-apply.mjs` | 技能资源：impeccable/scripts/live/manual-apply.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 190 | `.agents/skills/impeccable/scripts/live/manual-edit-routes.mjs` | 技能资源：impeccable/scripts/live/manual-edit-routes.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 191 | `.agents/skills/impeccable/scripts/live/manual-edits-buffer.mjs` | 技能资源：impeccable/scripts/live/manual-edits-buffer.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 192 | `.agents/skills/impeccable/scripts/live/poll-lanes.mjs` | 技能资源：impeccable/scripts/live/poll-lanes.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 193 | `.agents/skills/impeccable/scripts/live/roots.mjs` | 技能资源：impeccable/scripts/live/roots.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 194 | `.agents/skills/impeccable/scripts/live/session-store.mjs` | 技能资源：impeccable/scripts/live/session-store.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 195 | `.agents/skills/impeccable/scripts/live/source-lock.mjs` | 技能资源：impeccable/scripts/live/source-lock.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 196 | `.agents/skills/impeccable/scripts/live/source-search.mjs` | 技能资源：impeccable/scripts/live/source-search.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 197 | `.agents/skills/impeccable/scripts/live/svelte-ast.mjs` | 技能资源：impeccable/scripts/live/svelte-ast.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 198 | `.agents/skills/impeccable/scripts/live/svelte-component.mjs` | 技能资源：impeccable/scripts/live/svelte-component.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 199 | `.agents/skills/impeccable/scripts/live/sveltekit-adapter.mjs` | 技能资源：impeccable/scripts/live/sveltekit-adapter.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 200 | `.agents/skills/impeccable/scripts/live/tanstack-adapter.mjs` | 技能资源：impeccable/scripts/live/tanstack-adapter.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 201 | `.agents/skills/impeccable/scripts/live/vocabulary.mjs` | 技能资源：impeccable/scripts/live/vocabulary.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 202 | `.agents/skills/impeccable/scripts/modern-screenshot.umd.js` | 技能资源：impeccable/scripts/modern-screenshot.umd.js | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 203 | `.agents/skills/impeccable/scripts/palette.mjs` | 技能资源：impeccable/scripts/palette.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 204 | `.agents/skills/impeccable/scripts/pin.mjs` | 技能资源：impeccable/scripts/pin.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 205 | `.agents/skills/impeccable/scripts/serve-question.mjs` | 技能资源：impeccable/scripts/serve-question.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 206 | `.agents/skills/impeccable/scripts/surface-brief.mjs` | 技能资源：impeccable/scripts/surface-brief.mjs | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 207 | `.agents/skills/installing-project-skills/SKILL.md` | 技能正文：installing-project-skills | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 208 | `.agents/skills/karpathy-guidelines/SKILL.md` | 技能正文：karpathy-guidelines | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 209 | `.agents/skills/managing-project-skills/SKILL.md` | 技能正文：managing-project-skills | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 210 | `.agents/skills/migrate-module/SKILL.md` | 技能正文：migrate-module | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 211 | `.agents/skills/redesign-existing-projects/SKILL.md` | 技能正文：redesign-existing-projects | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 212 | `.agents/skills/regression-check/SKILL.md` | 技能正文：regression-check | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 213 | `.agents/skills/scheduling-project-skills/SKILL.md` | 技能正文：scheduling-project-skills | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 214 | `.agents/skills/split-chunk/SKILL.md` | 技能正文：split-chunk | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 215 | `.agents/skills/superpowers-systematic-debugging/SKILL.md` | 技能正文：superpowers-systematic-debugging | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 216 | `.agents/skills/syncing-agent-index/SKILL.md` | 技能正文：syncing-agent-index | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 217 | `.agents/skills/test-driven-development/SKILL.md` | 技能正文：test-driven-development | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 218 | `.agents/skills/test-driven-development/testing-anti-patterns.md` | 技能资源：test-driven-development/testing-anti-patterns.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 219 | `.agents/skills/type-module/SKILL.md` | 技能正文：type-module | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 220 | `.agents/skills/version-release/SKILL.md` | 技能正文：version-release | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 221 | `.agents/skills/writing-plans/SKILL.md` | 技能正文：writing-plans | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 222 | `.agents/skills/writing-plans/plan-document-reviewer-prompt.md` | 技能资源：writing-plans/plan-document-reviewer-prompt.md | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 223 | `.agents/skills/writing-skills/SKILL.md` | 技能正文：writing-skills | keep | — | — | — | done | 现有技能资产，不得因目标结构未列到而丢弃 |
| 224 | `.agents/templates/page/index.ts` | 代码模板：page/index.ts | keep | — | — | — | done | 阶段 1 新增模板，新增代码时复制 |
| 225 | `.agents/templates/page/style.css` | 代码模板：page/style.css | keep | — | — | — | done | 阶段 1 新增模板，新增代码时复制 |
| 226 | `.agents/templates/page/template.html` | 代码模板：page/template.html | keep | — | — | — | done | 阶段 1 新增模板，新增代码时复制 |
| 227 | `.agents/templates/service-module.ts` | 代码模板：service-module.ts | keep | — | — | — | done | 阶段 1 新增模板，新增代码时复制 |
| 228 | `.agents/templates/types.ts` | 代码模板：types.ts | keep | — | — | — | done | 阶段 1 新增模板，新增代码时复制 |
| 229 | `.agents/templates/ui-component.ts` | 代码模板：ui-component.ts | keep | — | — | — | done | 阶段 1 新增模板，新增代码时复制 |

## .github/

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 230 | `.github/CODE_OF_CONDUCT.md` | GitHub 仓库配置 / CI / 模板 | keep | — | — | — | done | keep，不删改 |
| 231 | `.github/CONTRIBUTING.md` | GitHub 仓库配置 / CI / 模板 | keep | — | — | — | done | keep，不删改 |
| 232 | `.github/ISSUE_TEMPLATE/bug_report.yml` | GitHub 仓库配置 / CI / 模板 | keep | — | — | — | done | keep，不删改 |
| 233 | `.github/ISSUE_TEMPLATE/config.yml` | GitHub 仓库配置 / CI / 模板 | keep | — | — | — | done | keep，不删改 |
| 234 | `.github/ISSUE_TEMPLATE/feature_request.yml` | GitHub 仓库配置 / CI / 模板 | keep | — | — | — | done | keep，不删改 |
| 235 | `.github/PULL_REQUEST_TEMPLATE.md` | GitHub 仓库配置 / CI / 模板 | keep | — | — | — | done | keep，不删改 |
| 236 | `.github/SECURITY.md` | GitHub 仓库配置 / CI / 模板 | keep | — | — | — | done | keep，不删改 |
| 237 | `.github/workflows/nomore-spam.yml` | GitHub 仓库配置 / CI / 模板 | keep | — | — | — | done | keep，不删改 |
| 238 | `.github/workflows/sync.yml` | GitHub 仓库配置 / CI / 模板 | keep | — | — | — | done | keep，不删改 |

## .vscode/

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 239 | `.vscode/launch.json` | VSCode 调试配置 | keep | — | — | — | done | keep，不删改 |

## css/

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 240 | `css/v2/admin.css` | 设置/管理面板样式（运行时按需加载） | migrated | `src/pages/settings/style.css` | — | — | pending | page-loader.js 运行时插入 <link>，属动态引用白名单 |
| 241 | `css/v2/base.css` | 全局基础样式/布局/组件 | migrated | `src/styles/base.css` | — | — | pending | — |
| 242 | `css/v2/home.css` | 首页样式 | migrated | `src/pages/home/style.css` | — | — | pending | — |
| 243 | `css/v2/player.css` | 播放页样式 | migrated | `src/pages/player/style.css` | — | — | pending | — |
| 244 | `css/v2/tokens.css` | 设计令牌与主题变量 | migrated | `src/styles/variables.css` | — | — | pending | — |
| 245 | `css/v2/views.css` | 内页共享视图样式（运行时按需加载） | migrated | `src/styles/views.css` | — | — | pending | page-loader.js 运行时插入 <link>，属动态引用白名单 |

## docs/

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 246 | `docs/BASELINE-stage3.md` | 项目文档：BASELINE-stage3.md | keep | — | — | — | done | 阶段 0 新增文档，纳入版本控制 |
| 247 | `docs/BASELINE.md` | 阶段 0 构建体积基线 | keep | — | — | — | done | 阶段 0 新增文档，纳入版本控制 |
| 248 | `docs/MIGRATION.md` | 阶段 -1 勘察报告（与 .agents/migration/PHASE-1-REPORT.md 同步） | keep | — | — | — | done | 阶段 0 新增文档，纳入版本控制 |
| 249 | `docs/REGRESSION.md` | 回归清单 | keep | — | — | — | done | 阶段 0 新增文档，纳入版本控制 |
| 250 | `docs/STAGE2.md` | 项目文档：STAGE2.md | keep | — | — | — | done | 阶段 0 新增文档，纳入版本控制 |
| 251 | `docs/STAGE3.md` | 项目文档：STAGE3.md | keep | — | — | — | done | 阶段 0 新增文档，纳入版本控制 |

## functions/（红区）

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 252 | `functions/_middleware.js` | Cloudflare Pages Function（红区） | keep | — | — | — | done | 禁止修改 |
| 253 | `functions/proxy/[[path]].js` | Cloudflare Pages Function（红区） | keep | — | — | — | done | 禁止修改 |

## image/

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 254 | `image/brand/apple-touch-icon-180.png` | Apple 主屏图标 | migrated | `public/icons/apple-touch-icon-180.png` | — | — | pending | — |
| 255 | `image/brand/favicon-32.png` | 站点 favicon | migrated | `public/icons/favicon-32.png` | — | — | pending | — |
| 256 | `image/brand/leletv-app-icon-maskable.svg` | PWA maskable 图标母版 | migrated | `public/icons/leletv-app-icon-maskable.svg` | — | — | pending | — |
| 257 | `image/brand/leletv-app-icon.svg` | PWA 图标母版 | migrated | `public/icons/leletv-app-icon.svg` | — | — | pending | — |
| 258 | `image/brand/leletv-favicon.svg` | 矢量 favicon | migrated | `public/icons/leletv-favicon.svg` | — | — | pending | — |
| 259 | `image/brand/leletv-icon-192.png` | PWA 图标 192 | migrated | `public/icons/leletv-icon-192.png` | — | — | pending | — |
| 260 | `image/brand/leletv-icon-512.png` | PWA 图标 512 | migrated | `public/icons/leletv-icon-512.png` | — | — | pending | — |
| 261 | `image/brand/leletv-icon-maskable-192.png` | PWA maskable 图标 192 | migrated | `public/icons/leletv-icon-maskable-192.png` | — | — | pending | — |
| 262 | `image/brand/leletv-icon-maskable-512.png` | PWA maskable 图标 512 | migrated | `public/icons/leletv-icon-maskable-512.png` | — | — | pending | — |
| 263 | `image/brand/leletv-lockup.svg` | 品牌组合锁版 SVG（静态检索零引用） | suspected-unused | — | — | — | pending | 静态检索零引用；可能是品牌设计母版。阶段 4.5 由人工确认，禁止迁移期删除 |
| 264 | `image/brand/leletv-mark-currentcolor.svg` | 品牌图形标（currentColor） | migrated | `public/icons/leletv-mark-currentcolor.svg` | — | — | pending | — |
| 265 | `image/brand/leletv-mark.svg` | 品牌图形标 SVG（静态检索零引用） | suspected-unused | — | — | — | pending | 静态检索零引用；可能是品牌设计母版。阶段 4.5 由人工确认，禁止迁移期删除 |
| 266 | `image/brand/leletv-wordmark-currentcolor.svg` | 品牌字标 SVG（静态检索零引用） | suspected-unused | — | — | — | pending | 静态检索零引用；可能是品牌设计母版。阶段 4.5 由人工确认，禁止迁移期删除 |
| 267 | `image/logo-black.png` | 播放页详情占位 Logo | migrated | `public/images/logo-black.png` | — | — | pending | — |
| 268 | `image/logo.png` | README/品牌 Logo | migrated | `public/images/logo.png` | — | — | pending | — |

## js/（56 个模块）

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 269 | `js/api/api-config.js` | 采集站 API 配置（selectedAPIs / customAPIs） | migrated | `src/services/sources/config.ts` | — | — | verified | 全局脚本迁移，函数/变量名保持不变 |
| 270 | `js/api/api.js` | 采集站请求与详情/搜索 API 封装 | migrated | `src/services/api.ts` | — | — | verified | 已迁移至 `src/services/api.ts`；类型检查通过 |
| 271 | `js/api/loadBalancer.js` | 采集站负载均衡与延迟调度 | migrated | `src/services/balancer.ts` | — | — | verified | 已迁移至 `src/services/balancer.ts`；类型检查通过 |
| 272 | `js/api/remote-sources.js` | 远端数据源同步与合并 | migrated | `src/services/sources/remote.ts` | — | — | pending | — |
| 273 | `js/api/search.js` | 跨源聚合搜索与结果缓存 | migrated | `src/services/search.ts` | — | — | pending | — |
| 274 | `js/api/source-port.js` | 视频源导入/导出（LibreTV 互操作） | migrated | `src/services/sources/port.ts` | — | — | pending | — |
| 275 | `js/api/tmdb.js` | TMDB 分类/详情接口封装 | migrated | `src/services/tmdb.ts` | — | — | pending | — |
| 276 | `js/app/app-config.js` | 配置导入/导出（ZIP）与本地配置读写 | migrated | `src/services/config.ts` | — | — | verified | 已迁移至 `src/services/config.ts`；类型检查通过 |
| 277 | `js/app/app-init.js` | 应用初始化协调器 | pending | — | — | — | pending | 拟并入 src/main.ts，需阶段 1 的 MAP.md 定稿并走 merge 批准 |
| 278 | `js/app/app-routing.js` | hash 路由、页面切换与页面装载 | migrated | `src/router/index.ts` | — | — | pending | — |
| 279 | `js/app/app-search.js` | 搜索流程与结果页编排 | migrated | `src/pages/search/index.ts` | — | — | pending | — |
| 280 | `js/app/app.js` | 应用主装配（首页/导航/事件委托） | migrated | `src/main.ts` | — | — | pending | — |
| 281 | `js/app/boot-sequence.js` | 启动编排（鉴权 → 首页加载） | pending | — | — | — | pending | 拟并入 src/main.ts，需阶段 1 的 MAP.md 定稿并走 merge 批准 |
| 282 | `js/app/page-loader.js` | 按需加载 pages/*.html 片段与页面 bundle | migrated | `src/router/page-loader.ts` | — | — | pending | — |
| 283 | `js/auth/admin-panel.js` | 邀请码管理面板（管理员） | migrated | `src/pages/settings/admin-panel.ts` | — | — | pending | — |
| 284 | `js/auth/invite-auth.js` | 邀请码验证与设备准入 | migrated | `src/services/invitation.ts` | — | — | verified | 已迁移至 `src/services/invitation.ts`；类型检查通过 |
| 285 | `js/auth/password.js` | 密码哈希与校验 | migrated | `src/core/crypto.ts` | — | — | verified | 已迁移至 `src/core/crypto.ts`；类型检查通过 |
| 286 | `js/auth/proxy-auth.js` | 代理请求鉴权（PASSWORD 签名） | migrated | `src/core/http.ts` | — | — | verified | 已迁移至 `src/core/http.ts`；类型检查通过 |
| 287 | `js/auth/sha256.js` | SHA-256 动态加载兜底实现 | merge | `src/core/crypto.ts` | `src/core/crypto.ts` | AP-001 | verified | 与 `crypto.ts` 的 sha256 重复，已合并；删除原文件 |
| 288 | `js/auth/user-devices.js` | 设备管理面板（普通用户） | migrated | `src/pages/settings/user-devices.ts` | — | — | pending | — |
| 289 | `js/core/cache-manager.js` | 本地存储缓存管理与 24h 清理 | migrated | `src/core/cache.ts` | — | — | verified | 已迁移至 `src/core/cache.ts`；类型检查与回归通过 |
| 290 | `js/core/config.js` | 全局常量与 API_SITES 基础配置 | migrated | `src/core/config.ts` | — | — | verified | 已迁移至 `src/core/config.ts`；类型检查与回归通过 |
| 291 | `js/core/leletv-global.js` | 全局命名空间适配器 | migrated | `src/core/global.ts` | — | — | verified | 已迁移至 `src/core/global.ts`；类型检查通过 |
| 292 | `js/core/listener-tracker.js` | 事件监听追踪与批量解绑 | migrated | `src/core/listener-tracker.ts` | — | — | verified | 已迁移至 `src/core/listener-tracker.ts`；类型检查通过 |
| 293 | `js/core/storage-service.js` | 统一存储服务（localStorage 封装） | migrated | `src/core/storage.ts` | — | — | verified | 已迁移至 `src/core/storage.ts`；类型检查通过 |
| 294 | `js/core/timing.js` | 时间常量配置 | migrated | `src/core/timing.ts` | — | — | verified | 已迁移至 `src/core/timing.ts`；类型检查通过 |
| 295 | `js/effects/hub-flow.js` | 首页聚合动效 | migrated | `src/pages/home/hub-flow.ts` | — | — | pending | — |
| 296 | `js/filter-config.json` | 广告过滤规则配置（运行时 fetch） | migrated | `src/services/adfilter-config.json` | — | — | verified | fetch 路径已同步为 `/src/services/adfilter-config.json` |
| 297 | `js/player/player-bridge.js` | 播放页与搜索/详情接口桥接 | migrated | `src/ui/player/bridge.ts` | — | — | pending | — |
| 298 | `js/player/player-core.js` | HLS + ArtPlayer 核心初始化 | migrated | `src/ui/player/core.ts` | — | — | pending | — |
| 299 | `js/player/player-detail.js` | 播放页详情/海报信息 | migrated | `src/ui/player/detail.ts` | — | — | pending | — |
| 300 | `js/player/player-episodes.js` | 剧集列表与选集 | migrated | `src/ui/player/episodes.ts` | — | — | pending | — |
| 301 | `js/player/player-failover.js` | 起播失败自动换线 | migrated | `src/ui/player/failover.ts` | — | — | pending | — |
| 302 | `js/player/player-lights.js` | 播放页氛围灯/背景 | migrated | `src/ui/player/lights.ts` | — | — | pending | — |
| 303 | `js/player/player-manager.js` | 播放器生命周期管理 | migrated | `src/ui/player/manager.ts` | — | — | pending | — |
| 304 | `js/player/player-quality.js` | 清晰度切换 | migrated | `src/ui/player/quality.ts` | — | — | pending | — |
| 305 | `js/player/player-shortcuts.js` | 播放器键盘快捷键 | migrated | `src/ui/player/shortcuts.ts` | — | — | pending | — |
| 306 | `js/player/player-ui.js` | 播放器覆盖层/进度条/资源切换 | migrated | `src/ui/player/ui.ts` | — | — | pending | — |
| 307 | `js/player/player.js` | 播放页入口与返回导航 | migrated | `src/ui/player/index.ts` | — | — | pending | — |
| 308 | `js/ui/brand-canvas.js` | 品牌组合 canvas 绘制 | migrated | `src/ui/brand-canvas.ts` | — | — | pending | — |
| 309 | `js/ui/hero-glass.js` | 首页主视觉光效 | migrated | `src/pages/home/hero-glass.ts` | — | — | pending | — |
| 310 | `js/ui/home-recent.js` | 首页最近更新货架 | migrated | `src/pages/home/recent.ts` | — | — | pending | — |
| 311 | `js/ui/home-shelves.js` | 首页继续观看/片源货架 | migrated | `src/pages/home/shelves.ts` | — | — | pending | — |
| 312 | `js/ui/layout-pref.js` | 首页与导航布局偏好 | migrated | `src/ui/layout-pref.ts` | — | — | pending | — |
| 313 | `js/ui/line-probe.js` | 线路可用性探测 | migrated | `src/services/line-probe.ts` | — | — | pending | — |
| 314 | `js/ui/motion-pref.js` | 动态效果偏好 | migrated | `src/ui/motion-pref.ts` | — | — | pending | — |
| 315 | `js/ui/movies-page.js` | 分类/影片列表页 | migrated | `src/pages/category/index.ts` | — | — | pending | — |
| 316 | `js/ui/nav-search.js` | 导航栏迷你搜索 | migrated | `src/pages/home/nav-search.ts` | — | — | pending | — |
| 317 | `js/ui/pwa-install.js` | PWA 安装提示 | migrated | `src/ui/pwa-install.ts` | — | — | pending | — |
| 318 | `js/ui/search-cards.js` | 搜索结果卡片渲染 | migrated | `src/pages/search/cards.ts` | — | — | pending | — |
| 319 | `js/ui/theme-system.js` | 11 套主题切换与配色存储 | migrated | `src/services/theme.ts` | — | — | pending | — |
| 320 | `js/ui/ui-core.js` | Toast / 通用 UI 反馈 | migrated | `src/ui/toast.ts` | — | — | pending | — |
| 321 | `js/ui/ui-search-history.js` | 搜索历史读写 | migrated | `src/services/search-history.ts` | — | — | pending | — |
| 322 | `js/ui/ui-viewing-history.js` | 观看历史读写 | migrated | `src/services/viewing-history.ts` | — | — | pending | — |
| 323 | `js/ui/ui.js` | 通用 UI 工具与弹窗 | migrated | `src/ui/index.ts` | — | — | pending | — |
| 324 | `js/utils/version-updater.js` | 版本检测与更新提示 | migrated | `src/services/version-updater.ts` | — | — | pending | — |

## libs/

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 325 | `libs/artplayer.min.js` | ArtPlayer 播放器（第三方） | keep | — | — | — | done | 第三方库，保留原位；阶段 3 再评估独立 chunk |
| 326 | `libs/geist/Geist-Bold.woff2` | Geist 字体 Bold | migrated | `public/fonts/Geist-Bold.woff2` | — | — | pending | — |
| 327 | `libs/geist/Geist-Medium.woff2` | Geist 字体 Medium | migrated | `public/fonts/Geist-Medium.woff2` | — | — | pending | — |
| 328 | `libs/geist/Geist-Regular.woff2` | Geist 字体 Regular | migrated | `public/fonts/Geist-Regular.woff2` | — | — | pending | — |
| 329 | `libs/geist/Geist-SemiBold.woff2` | Geist 字体 SemiBold | migrated | `public/fonts/Geist-SemiBold.woff2` | — | — | pending | — |
| 330 | `libs/hls.min.js` | HLS.js（第三方） | keep | — | — | — | done | 第三方库，保留原位；阶段 3 再评估独立 chunk |
| 331 | `libs/jszip.min.js` | JSZip：配置导入/导出（第三方） | keep | — | — | — | done | 第三方库，保留原位；阶段 3 再评估独立 chunk |
| 332 | `libs/marked.min.js` | Markdown 渲染，README 弹窗按需加载（第三方） | keep | — | — | — | done | 第三方库，保留原位；阶段 3 再评估独立 chunk |
| 333 | `libs/sha256.min.js` | SHA-256 浏览器实现（第三方） | keep | — | — | — | done | 第三方库，保留原位；阶段 3 再评估独立 chunk |

## migrations/（红区）

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 334 | `migrations/001_create_tables.sql` | D1 数据库迁移（红区） | keep | — | — | — | done | 禁止修改 |
| 335 | `migrations/002_add_remark.sql` | D1 数据库迁移（红区） | keep | — | — | — | done | 禁止修改 |
| 336 | `migrations/003_add_device_signature.sql` | D1 数据库迁移（红区） | keep | — | — | — | done | 禁止修改 |
| 337 | `migrations/004_add_api_sites.sql` | D1 数据库迁移（红区） | keep | — | — | — | done | 禁止修改 |

## pages/

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 338 | `pages/about.html` | 关于页片段（page-loader 拉取） | migrated | `src/pages/about/template.html` | — | — | pending | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 339 | `pages/category.html` | 分类页片段 | migrated | `src/pages/category/template.html` | — | — | pending | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 340 | `pages/history.html` | 历史页片段 | migrated | `src/pages/history/template.html` | — | — | pending | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 341 | `pages/movies.html` | 影片结果页片段 | migrated | `src/pages/movies/template.html` | — | — | pending | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 342 | `pages/readme.html` | README/说明页片段 | migrated | `src/pages/readme/template.html` | — | — | pending | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |
| 343 | `pages/settings.html` | 设置页片段 | migrated | `src/pages/settings/template.html` | — | — | pending | page-loader.js 通过 FRAGMENTS 映射运行时 fetch，属动态引用白名单 |

## scripts/

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 344 | `scripts/analyze.js` | bundle 体积分析（阶段 0 新增） | keep | — | — | — | done | — |
| 345 | `scripts/bootstrap.js` | 引导/环境自检（手工运行） | keep | — | — | — | done | — |
| 346 | `scripts/brand/README.md` | 品牌资产生成流程说明 | keep | — | — | — | done | 手工运行的品牌资产工具，非构建链路引用；建议保留 |
| 347 | `scripts/brand/bump-version.mjs` | 品牌图缓存版本号升级（手工运行） | keep | — | — | — | done | 手工运行的品牌资产工具，非构建链路引用；建议保留 |
| 348 | `scripts/brand/gen-splash.mjs` | 生成 PWA 启动屏（手工运行） | keep | — | — | — | done | 手工运行的品牌资产工具，非构建链路引用；建议保留 |
| 349 | `scripts/brand/make-brand.mjs` | 品牌图生成主脚本（手工运行） | keep | — | — | — | done | 手工运行的品牌资产工具，非构建链路引用；建议保留 |
| 350 | `scripts/brand/png-info.mjs` | PNG 信息查看（手工运行） | keep | — | — | — | done | 手工运行的品牌资产工具，非构建链路引用；建议保留 |
| 351 | `scripts/brand/quantize.mjs` | PNG 量化工具（被 make-brand 调用） | keep | — | — | — | done | 手工运行的品牌资产工具，非构建链路引用；建议保留 |
| 352 | `scripts/brand/render-svg.mjs` | SVG 渲染为 PNG（被 make-brand 调用） | keep | — | — | — | done | 手工运行的品牌资产工具，非构建链路引用；建议保留 |
| 353 | `scripts/build-bundles.mjs` | 版本注入后的 bundle 拼接 + esbuild 压缩，并原地更新 HTML | keep | — | — | — | done | — |
| 354 | `scripts/check-agents.js` | 硬规则校验（阶段 1 新增） | keep | — | — | — | done | — |
| 355 | `scripts/check-budget.js` | bundle 体积预算（阶段 1 新增） | keep | — | — | — | done | — |
| 356 | `scripts/check-coverage.js` | 文件全覆盖校验（阶段 1 新增） | keep | — | — | — | done | — |
| 357 | `scripts/check-deps.js` | 分层与循环依赖检查（阶段 1 新增） | keep | — | — | — | done | — |
| 358 | `scripts/check-orphans.js` | 零引用文件检测（阶段 1 新增） | keep | — | — | — | done | — |
| 359 | `scripts/check-types.js` | tsc --noEmit 封装（阶段 1 新增） | keep | — | — | — | done | — |
| 360 | `scripts/generate-version.mjs` | 把 VERSION.txt 注入 HTML / service-worker 缓存版本 | keep | — | — | — | done | — |
| 361 | `scripts/orphans.config.js` | 零引用检测白名单（阶段 1 新增） | keep | — | — | — | done | — |
| 362 | `scripts/setup-agent-links.mjs` | 建立各 AI 工具到 .agents 的接线 | keep | — | — | — | done | — |
| 363 | `scripts/setup-hooks.mjs` | 安装 pre-commit 钩子 | keep | — | — | — | done | — |
| 364 | `scripts/sync-agent-index.mjs` | 生成 AGENTS.md 与 .agents/skills/INDEX.md 索引 | keep | — | — | — | done | — |

## src/（阶段 2 起）

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 365 | `src/router/prefetch.ts` | 导航预取页面片段与按需 bundle（阶段 3 新增） | keep | — | — | — | done | 阶段 2 / 3 新增源码，按 01 / 02 规则维护 |
| 366 | `src/ui/invite-login.ts` | 邀请码登录弹窗逻辑（阶段 2 新增） | keep | — | — | — | done | 阶段 2 / 3 新增源码，按 01 / 02 规则维护 |
| 367 | `src/ui/modals.ts` | 全局模态框 / Toast 运行时注入（阶段 2 新增） | keep | — | — | — | done | 阶段 2 / 3 新增源码，按 01 / 02 规则维护 |
| 368 | `src/ui/nav-scroll.ts` | 导航栏滚动毛玻璃（阶段 2 新增） | keep | — | — | — | done | 阶段 2 / 3 新增源码，按 01 / 02 规则维护 |
| 370 | `src/core/cache.ts` | 缓存管理与 24h 清理（迁移自 `js/core/cache-manager.js`） | keep | — | — | — | done | 阶段 4 第 1 条迁移目标 |
| 371 | `src/core/config.ts` | 全局常量与 API_SITES 配置（迁移自 `js/core/config.js`） | keep | — | — | — | done | 阶段 4 第 2 条迁移目标 |
| 372 | `src/core/crypto.ts` | SHA-256 哈希（迁移自 `js/auth/password.js`） | keep | — | — | — | done | 阶段 4 第 3 条迁移目标 |
| 373 | `src/core/global.ts` | 全局命名空间适配器（迁移自 `js/core/leletv-global.js`） | keep | — | — | — | done | 阶段 4 第 4 条迁移目标 |
| 374 | `src/core/http.ts` | 代理请求鉴权（迁移自 `js/auth/proxy-auth.js`） | keep | — | — | — | done | 阶段 4 第 5 条迁移目标 |
| 375 | `src/core/listener-tracker.ts` | 事件监听追踪器（迁移自 `js/core/listener-tracker.js`） | keep | — | — | — | done | 阶段 4 第 6 条迁移目标 |
| 376 | `src/core/storage.ts` | 统一存储服务（迁移自 `js/core/storage-service.js`） | keep | — | — | — | done | 阶段 4 第 8 条迁移目标 |
| 377 | `src/core/timing.ts` | 时间常量配置（迁移自 `js/core/timing.js`） | keep | — | — | — | done | 阶段 4 第 9 条迁移目标 |
| 378 | `src/services/adfilter-config.json` | 广告过滤规则配置（迁移自 `js/filter-config.json`） | keep | — | — | — | done | 阶段 4 第 10 条迁移目标 |
| 379 | `src/services/api.ts` | 采集站请求 / 详情 / 搜索 API（迁移自 `js/api/api.js`） | keep | — | — | — | done | 阶段 4 第 11 条迁移目标 |
| 380 | `src/services/balancer.ts` | 采集站负载均衡（迁移自 `js/api/loadBalancer.js`） | keep | — | — | — | done | 阶段 4 第 12 条迁移目标 |
| 381 | `src/services/config.ts` | 配置导入/导出与 JSZip 懒加载（迁移自 `js/app/app-config.js`） | keep | — | — | — | done | 阶段 4 第 13 条迁移目标 |
| 382 | `src/services/invitation.ts` | 邀请码验证 / 设备指纹 / 心跳（迁移自 `js/auth/invite-auth.js`） | keep | — | — | — | done | 阶段 4 第 14 条迁移目标 |
| 384 | `src/services/sources/config.ts` | 采集站 API 配置（迁移自 `js/api/api-config.js`） | keep | — | — | — | done | 阶段 4 第 15 条迁移目标 |

## workers/（红区）

| # | 原路径 | 职责 | 去向类型 | 目标路径 | 合并目标 | 批准记录 | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 369 | `workers/tmdb-worker.js` | Cloudflare Worker：TMDB 代理 / 邀请码 / 云源管理（红区） | keep | — | — | — | done | 禁止修改 |

## 生成后自检

- 生成器未覆盖文件：0
- `delete` 记录：0
- `merge` 记录：0
- 疑似无用文件：仅登记，未删除
