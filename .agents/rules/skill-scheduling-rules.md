# 技能调度规则

> 按需加载 — 需要编排多个技能、判断难度、选择设计技能时读取。

---

## 调度原则

1. **项目内技能优先**：先用 `.agents/skills/` 下的技能
2. **按需加载**：只加载当前任务相关的技能，读完即弃，不常驻上下文
3. **单一职责**：一个技能只干一件事
4. **串行优先**：有依赖的任务串行，互相独立的才并行

---

## 场景 → 技能分派表

> 只列**实际安装**的技能（共 19 个，索引见 `AGENTS.md`）。

| # | 场景 | 用户触发词 | 调用链 |
|---|------|-----------|--------|
| 1 | 新功能开发 | "实现""添加""新增" | `scheduling-project-skills` → 编码 → `karpathy-guidelines` 自查 |
| 2 | Bug 修复 | "报错""bug""不工作" | `superpowers-systematic-debugging` → 修复 → 验证 |
| 3 | 代码重构 | "重构""优化代码""重写" | `gitnexus-impact-analysis` → `gitnexus-refactoring` → 验证 |
| 4 | 影响分析 | "改了会怎样""影响范围" | `gitnexus-impact-analysis` |
| 5 | 架构理解 | "怎么实现的""代码怎么走" | `gitnexus-exploring` |
| 6 | 索引/图谱运维 | "重索引""索引过期" | `gitnexus-cli` |
| 7 | 工具用法咨询 | "gitnexus 怎么用" | `gitnexus-guide` |
| 8 | UI/UX 设计 | "设计""改界面""新页面" | 见下方「设计技能选择指南」 |
| 9 | 版本发布 | "发布""新版本""更新日志" | `version-release` + `.agents/rules/version-management-rules.md` |
| 10 | 技能管理 | "安装/更新/卸载技能" | `managing-project-skills` + `.agents/rules/skill-lifecycle-rules.md` |
| 11 | 长输出被截断 | 生成大文件时被省略 | `full-output-enforcement` |
| 12 | 索引过期 | 新增技能/规则后 | `syncing-agent-index` |

---

## 设计技能选择指南

> 项目设计语言已固定为 HarmonyOS 深色调色板 + 霓虹粉 `#ec4899` + Geist 字体，**不采用其它风格流派**，
> 因此不再安装极简 / 粗野等风格类技能（原先的 `minimalist-ui`、`industrial-brutalist-ui` 已移除：
> 前者明文禁止霓虹色与圆角按钮，与本项目设计语言直接冲突）。

| 任务特征 | 首选技能 | 备选 |
|---------|---------|------|
| 全新页面 / 组件设计（空白画布） | `design-taste-frontend` | `high-end-visual-design` |
| 现有页面 / 组件改造（有代码基础） | `redesign-existing-projects` | `design-taste-frontend` |
| 设计审查 / 质量审计 | `impeccable` | — |
| 最终打磨（发布前） | `impeccable` | `redesign-existing-projects` |
| 排版 / 字体 / 配色 / 布局细修 | `impeccable` | `design-taste-frontend` |
| 深色 / 高级感 / 动效质感 | `high-end-visual-design` | `design-taste-frontend` |
| 确保 Agent 完整输出 | `full-output-enforcement` | — |

> `impeccable` 是单一技能，内部按 `reference/*.md` 提供多个子命令（audit / critique / polish / typeset / colorize / layout / clarify / adapt / optimize 等），直接读 `.agents/skills/impeccable/SKILL.md` 了解可用子命令。
>
> **决策优先级：** ① 是否有现成代码（有 → `redesign-existing-projects`）→ ② 是否需审查（是 → `impeccable`）→ ③ 是否追求特定风格（是 → 对应风格技能）→ ④ 默认 → `design-taste-frontend`

---

## 难度分级

| 级别 | 最大并行 | 典型任务 |
|------|---------|---------|
| L1 | 1 | 文案、格式化、单点修复 |
| L2 | 2 | 功能实现、单模块改动 |
| L3 | 3 | 架构调整、跨模块协调 |
| L4 | 5 | 性能优化、安全审计、深度重构 |

| 难度 | 判断标准 | 示例 |
|------|---------|------|
| 简单 | 单文件 ≤ 20 行，无逻辑分支 | 文案、样式、配置 |
| 中等 | 2-5 步，涉及单模块 | 加一个搜索过滤条件 |
| 复杂 | 多模块跨文件，需设计方案 | 新增数据源、重构核心模块 |

## 编排模式

| 复杂度 | 方式 |
|--------|------|
| L1 | 单一技能直接执行 |
| L2 | 主技能 + 辅助技能串行 |
| L3 | 多技能并行 + 结果汇总 |
| L4 | 多 Agent 协作 + 交叉验证 |

## 并行执行原则

互相独立的操作并行跑：

```
✅ 并行：影响分析（codegraph）‖ 检索现有实现 ‖ 跑回归
❌ 串行：明明无依赖却一个个来
```

---

## 开发工作流

1. **规划** → 分类任务，判断难度（本文件）
2. **影响分析** → 改核心符号前先跑 `gitnexus-impact-analysis`
3. **开发** → 编码，遵守 `.agents/rules/code-standards-rules.md`
4. **自查** → `karpathy-guidelines`
5. **验证** → 跑最相关的检查；提交前 `npx gitnexus detect_changes`
6. **提交** → 提交规范见 `.agents/rules/code-standards-rules.md`
7. **版本** → 发版走 `version-release`
