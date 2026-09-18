---
name: installing-project-skills
description: Use when installing skills for a new project, or when the user asks to update, upgrade, uninstall, or check status of project skills
tree: lifecycle/install
version: 1.0.0
author: JiunianTV
requires: []
requires_tools:
  - git
  - node (>=18)
platforms:
  - cursor
  - windsurf
  - trae
  - claude-code
tags:
  - lifecycle
  - install
  - upgrade
  - uninstall
---

# Installing Project Skills

> 📍 **技能树位置：L1/L2 — 生命周期管理/安装** — 受 managing-project-skills（根节点）分派

## Overview

Covers the full lifecycle of project skills: first-time install, migration from other directories, upgrade from upstream repos, uninstall, and status checks.

## When to Use

- User says "安装技能和规则" / "setup skills" — full install
- User says "更新技能" / "升级技能" / "同步技能" — upgrade existing
- User says "卸载技能 xxx" — remove a skill
- User says "查看技能" / "技能状态" — list and verify
- User says "有什么技能适合我" / "推荐技能" / "discover skills" — skill discovery

## Skill Discovery

When the user asks what skills are available or suitable for their project:

1. **Read the registry** — open `.agents/skills-registry.json` and list all available sources
2. **Scan project tech stack** — detect `package.json` / `go.mod` / `Cargo.toml` / `requirements.txt`
3. **Filter by tech stack** — match registry source `filter` and `match` rules against project deps
4. **Show recommendations** — present a table of available skills with:
   - ✅ **always** — recommended for every project
   - ⚠️ **tech-stack** — only if project dependencies match
   - 🔄 **self-managed** — installed via their own CLI
5. **Ask user** which ones to install, then proceed to Core Flow step 5 (confirmation)

Also check `.agents/skills-config.json` for user-defined custom sources and include them in the recommendation list.

## Core Flow

### 1. Detect Project Info

Read `package.json` / `requirements.txt` / `Cargo.toml` / `go.mod` to determine tech stack. If none found, ask.

### 2. Scan Existing Skills

Search `**/SKILL.md` and `**/skill.md` across the project. Target dirs: `.agents/skills/`, `.trae/skills/`, `skills/`, `.skills/`, `docs/skills/`.

**Self-managed tools (DO NOT migrate):** codegraph — it manages its own skill dirs via CLI.

### 2.5. Scan & Extract Existing Rules from AGENTS.md / CLAUDE.md

**Why:** Projects often have version management and code standards rules embedded in AGENTS.md or CLAUDE.md. These should be extracted to `.agents/rules/` so they become discoverable by psm and don't duplicate across files.

**Detection:** Scan AGENTS.md and CLAUDE.md for these patterns:

| Rule type | Search keywords |
|-----------|----------------|
| 版本管理 | 版本管理、版本更新、版本号、versioning、changelog、更新日志、release |
| 代码规范 | 代码规范、编码规范、提交规范、code style、commit convention、代码风格、lint |

**Action for each detected match:**

1. **Ask the user:** "检测到 AGENTS.md 中包含版本管理/代码规范规则。要提取到 `.agents/rules/` 并替换为引用吗？"
2. **If yes:** Extract the section(s) to the corresponding rule file (`version-management-rules.md` or `code-standards-rules.md`), then replace the original section in AGENTS.md with a short reference: `> **版本管理：** 详见 \`.agents/rules/version-management-rules.md\``
3. **If no:** Leave as-is, but record in INDEX.md as "未提取（用户选择保留）"
4. **If AGENTS.md doesn't exist:** Generate AGENTS.md with the required loading chain reference

**Loading chain:** Ensure AGENTS.md has the mandatory skill tree entry. If not, inject:
```markdown
## psm 技能树入口

读取 `.agents/skills/INDEX.md` 了解技能树和按需加载规则。
```

**CLAUDE.md:** If CLAUDE.md exists and doesn't have `@AGENTS.md`, prepend it. This is automatically handled by `npx psm install`.

### 3. Read Skill Registry

Read `.agents/skills-registry.json` to discover available skill sources. The registry defines:

- **Source name & URL** — where to clone from
- **Filter rule** — `always` (install for every project) or `tech-stack` (only when dependencies match)
- **Skill list** — which skills each source provides
- **selfManaged** — tools that manage their own skill directories (codegraph), skip migration

```json
// 示例：skills-registry.json 结构
{
  "sources": [
    { "name": "superpowers", "filter": "always" },
    { "name": "ecc", "filter": "tech-stack", "match": { "dependencies": ["react", "vue"] } },
    { "name": "codegraph", "selfManaged": true }
  ],
  "customSources": { "hint": "新建 .agents/skills-config.json 可自定义源" }
}
```

**Self-managed tools** (marked `selfManaged: true`): they automatically download/update skills to their own directories via CLI. Detect and skip during migration — do NOT move them into `.agents/skills/`.

**Design skill evaluation rule:** For sources with `filter: tech-stack`, check the project's dependency files (`package.json`, `go.mod`, etc.) against the `match` criteria. Only install when the project's dependencies satisfy the match.

### 3a. Custom Sources (User Config)

Check if `.agents/skills-config.json` exists in the project. If it does, merge its `customSources` into the registry:

```json
// .agents/skills-config.json — 用户自定义技能源
{
  "customSources": [
    {
      "name": "my-team-skills",
      "url": "https://github.com/myorg/team-skills",
      "filter": "always",
      "skills": ["my-standards", "my-deployment"]
    }
  ],
  "ignore": ["impeccable-ui"],        // 强制忽略某些技能
  "alwaysInstall": ["my-standards"]     // 强制安装某些技能
}
```

**Template:** `.agents/skills-config.template.json` can be copied as a starting point.
**Note:** This file is NEVER overwritten by `psm install`, so users can safely customize it.

### 4. Tech-Stack Filtering

| Project type | Priority skills |
|---|---|
| Node/frontend (package.json) | Design, testing, code-quality |
| Python (requirements.txt/pyproject.toml) | Data, ML, API |
| Rust (Cargo.toml) | Memory-safe, concurrent |
| Go (go.mod) | Microservice, container |
| Full-stack | Combined from both tiers |

### 5. User Confirmation & Customization

**Before any files are written**, present a full checklist to the user and let them customize:

#### 5a. Present the Checklist

Show the user a structured summary:

```
📋 安装计划确认

【待安装】来自上游仓库
  □ superpowers/test-driven-development
  □ superpowers/systematic-debugging
  □ karpathy/karpathy-engineering
  □ ECC/frontend-react          ← 仅在匹配技术栈时
  □ impeccable/impeccable-ui    ← 仅在有 UI 框架时

【待迁移】来自旧目录
  □ .trae/skills/xxx → .agents/skills/xxx

【待删除】旧目录（迁移完成后）
  □ .trae/skills/
  □ skills/                      ← 仅当所有内容已迁移
  □ .skills/

【待生成】规则文件
  □ skill-lifecycle-rules.md
  □ skill-scheduling-rules.md
  □ project-rules.md              ← 根据项目技术栈动态生成代码规范
  □ version-management-rules.md  ← 如 AGENTS.md 中有版本管理规则
  □ code-standards-rules.md      ← 如 AGENTS.md 中有代码规范规则

【待注入】技能树入口
  □ AGENTS.md → 指向 .agents/skills/INDEX.md
  □ CLAUDE.md → @AGENTS.md（如不存在）
```

#### 5b. Offer Customization Actions

For each item, the user can say:

| 用户指令 | 处理方式 |
|---------|---------|
| "保留 xxx" | Skip deletion, keep the skill/rules as-is where it is |
| "删除 xxx" | Remove from the install/migrate list entirely |
| "只安装 xxx 和 yyy" | Prune the list to only the named items |
| "这个不需要" | Remove that specific item |
| "先安装全部，再手动清理" | Skip confirmation, proceed with full plan |

#### 5c. Apply User Choices

After the user confirms (with or without modifications), proceed with the approved list. Skip items the user rejected. Record skipped items in INDEX.md as "用户选择跳过".

### 6. Handle Conflicts

| Conflict | Action |
|---|---|
| Same name, different version | Ask: keep old / install new / keep both (rename) |
| Functional overlap | Ask user to pick one |
| Dependency conflict | Auto-select compatible version or report |

### 7. Install & Migrate

- Move migratable skills into `.agents/skills/<name>/SKILL.md`
- Keep self-managed tool dirs untouched
- Install new skills from upstream repos into `.agents/skills/`
- Record migration history (原位置 → 新位置) in INDEX.md

### 8. Clean Up Old Dirs

Delete `.trae/skills/`, `skills/`, `.skills/` **only if** all content has been migrated and no self-managed tools remain.

### 9. Tool Dependency Resolution

For each skill that declares `requires_tools` in its frontmatter:

1. **Check tools.json** — read `.agents/tools.json` to see if the tool has been installed or configured before
2. **Check system PATH** — run `psm tool list [target]` to see which tools are available
3. **If not found** — ask the user: "技能 xxx 需要 Y 能力，要安装吗？"
   - 使用 `npx psm tool install <name>` 进行交互式安装（CLI 或 MCP，用户自选）
   - 安装完成后自动更新 `.agents/tools.json`
4. **Batch check** — run `npx psm tool setup` to scan all installed skills and install missing tools in one go

**工具定义来源：** `.agents/skills-registry.json` 中的 `tools` 字段，每个工具定义了：
- `checkCommand` — 检测是否已安装
- `cli` — CLI 安装命令和安装后配置
- `mcp` — MCP 服务器配置方式（command + args）

**自管理工具**（如 CodeGraph）：它们有自己的 CLI 来管理技能和更新，通过 `psm tool install` 安装后，其技能由自身 CLI 管理，PSM 不做迁移。

### 10. Generate INDEX.md

List all installed skills with purpose, source, version, and migration notes.

---

## Upgrade Flow

1. Compare installed versions against upstream repos
2. Identify new applicable skills (based on current tech stack)
3. **Present upgrade plan** to the user as a checklist (same format as 5a), with:
   - Skills that will be updated
   - New skills that will be installed
   - Skills that will be removed (if upstream dropped them)
   - Whether rules will be overwritten or merged
4. Let user customize: "保留旧版", "这个不更新", "只更新 xxx" etc.
5. Download updates; merge custom rules (do NOT overwrite user customizations)
6. Update INDEX.md; clean up obsolete entries

## Uninstall Flow

1. Confirm skill name
2. Remove from `.agents/skills/<name>/`
3. Remove from INDEX.md
4. Check if any rule file references it; ask about cleanup

## Status Check

1. List `.agents/skills/` contents
2. Show version / source / last-updated for each
3. Verify dependency tools are installed
4. Report any unmigrated skills (excluding self-managed dirs)
