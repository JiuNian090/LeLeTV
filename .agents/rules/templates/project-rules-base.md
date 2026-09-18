<!-- psm:auto-generated version=1.0 -->
<!-- 本文件由 psm install 根据项目技术栈动态生成，非模板部分不会被覆盖 -->

# 项目通用规则

> 全量加载 — 每次对话开始时自动注入

---

## 📋 通用规范（适用于所有项目）

### 技能使用

- 优先使用 `.agents/skills/` 下的项目级技能
- 复杂任务先拆解再执行
- 多技能任务执行后必须汇总结果

### 提交消息

- 遵循 Conventional Commits 格式：`<type>: <简短描述>`
- 类型：`feat:` / `fix:` / `docs:` / `refactor:` / `style:` / `perf:` / `test:` / `chore:`
- 描述不超过 50 字，说明**做了什么**而非**为什么做**

### 架构约束

- 新增依赖前检查是否与现有技术栈兼容
- 不引入不必要的构建工具或框架

---

## ⚡ 规则按需加载决策表（强制执行）

> 本表是"按需加载"的执行机制。**每次收到用户消息后，先匹配下表，再决定加载哪些规则文件。**
> 本文件始终全量加载，所以此决策表始终可见。

### 决策流程

```
收到用户消息
  ↓
匹配「触发条件」列 → 匹配 → 加载对应规则文件（按需）
  ↓ 不匹配
仅使用本文件（project-rules.md）执行任务
```

### 触发条件 → 规则加载映射

| 触发条件（用户说/场景） | 按需加载的规则文件 | 关联技能 |
|------------------------|-------------------|---------|
| "更新更新日志""发布新版本""打 tag""release""版本号" | `.agents/rules/version-management-rules.md` | `version-release` |
| "修改代码""新增""实现""写代码""编码" | `.agents/rules/code-standards-rules.md` | — |
| "安装技能""更新技能""卸载技能""查看技能" | `.agents/rules/skill-lifecycle-rules.md` | `installing-project-skills` |
| 技能执行时编排/调度任务 | `.agents/rules/skill-scheduling-rules.md` | `scheduling-project-skills` |
| "更新更新日志为 vx.x.x" | `.agents/rules/version-management-rules.md` | **必须调用 `version-release` 技能** |
| 未匹配以上任何条件 | 不额外加载，仅使用本文件 | — |

### 加载方式说明

| 加载方式 | 含义 | 文件 |
|---------|------|------|
| **全量加载** | 每次对话开始时自动注入上下文 | `project-rules.md`（本文件） |
| **按需加载** | 匹配左侧触发条件时加载，否则不加载 | `version-management-rules.md`, `code-standards-rules.md`, `skill-lifecycle-rules.md`, `skill-scheduling-rules.md` |

> **注意：** 按需加载的文件存放在 `.agents/rules/` 目录。Agent 在匹配触发条件后，应主动读取对应规则文件的内容并应用到当前任务。

---

## 🔧 代码规范（项目专属）

> 触发条件：修改源代码时自动应用。

<!-- psm:code-standards -->

---

## 📦 版本管理规则

> 触发条件：用户说「更新更新日志为 vx.x.x」「发布新版本」「打 tag」时加载
> 关联技能：`version-release`

<!-- psm:version-management-placeholder -->
<!-- 安装时如检测到 AGENTS.md/CLAUDE.md 中有版本管理/CHANGELOG 规则，提取到此文件 -->

版本管理详细流程见 `.agents/rules/version-management-rules.md`（按需加载）

---

## 🎯 任务前置分类铁律（强制执行）

> 每次收到改动请求后，在写任何代码之前，必须执行以下步骤

### 第 0 步：加载规则文件

- 本文件由 AGENTS.md 引用的技能树入口加载（全量加载）
- 技能树导航见 `.agents/skills/INDEX.md`（优先读取，了解技能层级关系）
- 如需技能调度细则，加载 `.agents/rules/skill-scheduling-rules.md`
### 第一步：任务分类

| 类别 | 判定标准 | 触发条件 |
|------|---------|---------|
| 🎨 UI/设计 | 修改外观、布局、样式、新建界面 | 用户描述涉及视觉/布局 |
| 🔧 Bug 修复 | 排查报错、异常行为、逻辑错误 | 用户说"报错""bug""不工作" |
| 🏗️ 新功能/复杂改动 | 新增模块、跨文件改动、架构调整 | 用户说"实现""添加""新增" |
| 🧹 代码改进 | 重构、简化、去冗余、性能优化 | 用户说"优化""重构""清理" |
| ✏️ 简单改动 | ≤10行、文案/配置/单文件样式微调 | 明显是微小改动 |

### 第二步：调用对应的技能入口（按技能树分派）

> 完整技能树见 `.agents/skills/INDEX.md`。先匹配 L1 类别，再由 L2 技能执行。

| 类别 | L1 树类别 | 分派说明 |
|------|-----------|---------|
| 🎨 UI/设计 | 🎨 设计技能（安装 psm-taste 后可用） | 调用 `frontend-design` 或 `redesign-existing-projects` |
| 🔧 Bug 修复 | — | 不调用技能树，直接加载 `systematic-debugging` |
| 🏗️ 新功能/复杂改动 | — | 不调用技能树，直接加载 `brainstorming` 或 `writing-plans` |
| 🧹 代码改进 | 📋 任务调度 | 加载 `scheduling-project-skills` 进行编排 |
| ✏️ 简单改动 | — | 直接执行，不调用技能
> 如果任务跨多个类别，按最高优先级执行（UI/设计 > Bug修复 > 新功能 > 代码改进 > 简单改动）
> 技能调用后，按技能返回的指导执行。不得以"跳过"或"太简单"为由绕过分类步骤。
