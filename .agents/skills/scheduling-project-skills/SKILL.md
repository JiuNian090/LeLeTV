---
name: scheduling-project-skills
description: Use when orchestrating multiple skills for a task — determining execution order, parallelism, and difficulty grading. Also use when the user asks how skills are dispatched
tree: schedule/orchestrate
version: 1.0.0
author: JiunianTV
requires: []
requires_tools: []
platforms:
  - cursor
  - windsurf
  - trae
  - claude-code
tags:
  - orchestration
  - scheduling
  - difficulty
---

# Scheduling Project Skills

> 📍 **技能树位置：L1/L2 — 任务调度/编排** — 受 managing-project-skills（根节点）分派

## Overview

Defines how skills are selected, ordered, and executed: difficulty grading (L1-L4), scenario-to-skill mapping, and serial/parallel orchestration.

## Difficulty Grading

| Level | Difficulty | Max parallel skills | Examples |
|---|---|---|---|
| L1 | Simple | 1 | Translation, formatting, simple fixes |
| L2 | Medium | 2 | Feature implementation, unit tests |
| L3 | Complex | 3 | Architecture design, multi-module coordination |
| L4 | Expert | 5 | Performance audit, security review, deep refactor |

**L3/L4 special rule:** If `brainstorming` skill is installed, call it first to decompose the task before dispatching other skills.

## 技能调度（参考技能树）

> 技能选择按树形分层：先在 INDEX.md 中匹配 L1 类别，再加载对应 L2 技能。
> 完整的调度映射表见 `.agents/skills/INDEX.md` 的导航指南和树形结构。

当 L2 技能被选中后，本技能负责其编排策略：决定串行/并行、难度分级、执行顺序。

## Skill Selection Priority

1. **Project-local first:** `.agents/skills/` over global skills
2. **Specialized over generic:** e.g. `vue-skill` before `frontend-generic`
3. **Higher version over lower:** same-function skills
4. **CLI over MCP:** prefer CLI tools over MCP server calls

## Orchestration Patterns

| Complexity | Pattern | Example |
|---|---|---|
| L1 | Single skill, direct execution | Translate a string |
| L2 | Main + helper, serial | Implement login → write tests → security check |
| L3 | Parallel + merge | Understand code + check coverage + analyze deps → merge → plan → refactor |
| L4 | Multi-agent + cross-verify | Coordinator dispatches sub-agents, results cross-checked |

## Pre-execution Checklist

- [ ] Task type identified
- [ ] Difficulty assessed
- [ ] Relevant skills installed
- [ ] Dependency tools available
- [ ] Call order correct (prerequisites first)
- [ ] Results verified
- [ ] Multi-skill output merged
