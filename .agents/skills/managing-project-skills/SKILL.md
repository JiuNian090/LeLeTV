---
name: managing-project-skills
description: Use when the user asks to install, update, upgrade, uninstall, or check status of project skills and rules, or when setting up skills for a new project
tree: root
version: 1.0.0
author: JiunianTV
requires:
  - installing-project-skills
  - scheduling-project-skills
  - version-release
requires_tools:
  - git
platforms:
  - cursor
  - windsurf
  - trae
  - claude-code
tags:
  - core
  - orchestrator
  - lifecycle
---

# Managing Project Skills

> 📍 **技能树位置：L0 — 根节点** — 所有技能调度的统一入口
> 子节点：L1「生命周期管理」→ [installing-project-skills] / L1「任务调度」→ [scheduling-project-skills] / L1「版本发布」→ [version-release]

## Overview

Orchestration entry point for project skill management. Dispatches to the appropriate sub-skill based on the user's intent.

## First-Load Detection

### 1. Check INDEX.md
If **`.agents/skills/INDEX.md` is missing or empty**, the project has not yet run skill installation.

### 2. Check for Unextracted Rules
If INDEX.md exists, check AGENTS.md and CLAUDE.md for version management or code standards rules that should have been extracted to `.agents/rules/`.

Look for these patterns in AGENTS.md/CLAUDE.md:

| Rule type | Detection keywords | Expected location |
|-----------|-------------------|------------------|
| 版本管理 | 版本管理、版本更新、版本号、versioning、changelog、更新日志 | `.agents/rules/version-management-rules.md` |
| 代码规范 | 代码规范、编码规范、提交规范、code style、commit convention | `.agents/rules/code-standards-rules.md` |

If patterns found but rule files missing, warn the user:
> "检测到 AGENTS.md/CLAUDE.md 中包含版本管理/代码规范规则，但未提取到 `.agents/rules/`。建议运行 `npx psm install --yes` 来自动提取。"

### 3. Bootstrap hint
If INDEX.md missing, print:
> "检测到技能尚未安装。在 IDE 中输入「安装技能和规则」即可自动扫描项目并安装匹配的技能。"
> 或运行 `node scripts/bootstrap.js` 查看项目检测报告和引导信息

### 4. Proceed
Then proceed to [installing-project-skills] when the user confirms.

## 技能树调度（L0 → L1 → L2）

> 使用树形分层调度：先匹配 L1 类别（用户意图所属域），再分派到 L2 具体技能。
> 完整的技能树结构见 `.agents/skills/INDEX.md`

### 技能树结构

```
L0: managing-project-skills（根节点 — 统一入口）
  │
  ├── L1: 🔧 生命周期管理
  │     └── L2: [installing-project-skills] — 安装/更新/卸载/查看
  │
  ├── L1: 📋 任务调度
  │     └── L2: [scheduling-project-skills] — 编排/难度分级/场景映射
  │
  └── L1: 📦 版本发布
        └── L2: [version-release] — 版本更新（CHANGELOG/VERSION/README）
```

### L0 → L1 匹配规则

| 用户意图 | 匹配的 L1 类别 | 匹配后再加载的 L2 技能 |
|---------|---------------|----------------------|
| "安装技能和规则" / "setup skills" / 首次配置 | 🔧 生命周期管理 | [installing-project-skills] — full install flow |
| "更新技能" / "升级技能" / "同步技能" | 🔧 生命周期管理 | [installing-project-skills] — upgrade flow |
| "卸载技能 xxx" | 🔧 生命周期管理 | [installing-project-skills] — uninstall flow |
| "查看技能" / "技能状态" | 🔧 生命周期管理 | [installing-project-skills] — status check |
| 技能执行时编排任务 | 📋 任务调度 | [scheduling-project-skills] |
| "更新更新日志为 vx.x.x" / "changelog" | 📦 版本发布 | [version-release] |
| "版本管理规则" / "版本规范" / "版本号" | 📦 版本发布 | 检查 .agents/rules/version-management-rules.md |

## Cross-references## Cross-references

- **REQUIRED SUB-SKILL:** [installing-project-skills] — lifecycle management
- **REQUIRED SUB-SKILL:** [scheduling-project-skills] — task orchestration
- **REQUIRED SUB-SKILL:** [version-release] — version release & changelog
- **REQUIRED RULES:** `.agents/rules/version-management-rules.md` — 版本管理（缺失时提示）
- **REQUIRED RULES:** `.agents/rules/code-standards-rules.md` — 代码规范（缺失时提示）
