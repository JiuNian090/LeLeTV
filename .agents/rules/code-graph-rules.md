# 代码图谱规则（CodeGraph / GitNexus）

> 按需加载 — 做影响分析、调用链追踪、重构、Bug 排查时读取。

---

## 何时必须用

- **改任何函数/类/方法之前**：先跑影响分析（`codegraph impact` 或 `npx gitnexus impact`），把影响范围报告给用户
- **提交前**：跑 `npx gitnexus detect_changes`，确认改动只影响预期符号
- **重命名符号**：必须用 `npx gitnexus rename`，禁止用查找替换

## CodeGraph CLI（符号级分析）

```bash
codegraph <命令> <参数>
```

| 任务 | 命令 | 示例 |
|------|------|------|
| 搜索符号 | `query <关键词>` | `query search` |
| 谁调用了 X | `callers <符号>` | `callers searchByAPIAndKeyWord` |
| X 调用了谁 | `callees <符号>` | `callees validatePayment` |
| 影响范围 | `impact <符号>` | `impact searchByAPIAndKeyWord` |
| 任务上下文 | `context <描述>` | `context "调试搜索流程"` |
| 文件结构 | `files` | `files` |
| 索引状态 | `status` | `status` |
| 重索引 | `index [--force]` | `index --force` |
| 受影响测试 | `affected [文件]` | `affected js/api.js` |

## GitNexus CLI（执行流级分析）

```bash
npx gitnexus <命令> [参数]
```

| 任务 | 命令 | 示例 |
|------|------|------|
| 执行流搜索 | `query <词>` | `query "搜索流程"` |
| 符号全景 | `context <符号>` | `context searchByAPIAndKeyWord` |
| 影响范围 | `impact <符号>` | `impact searchByAPIAndKeyWord` |
| 变更检测 | `detect_changes` | `detect_changes` |
| 安全重命名 | `rename <旧> <新>` | `rename oldFunc newFunc` |
| 索引状态 | `status` | `status` |
| 重索引 | `analyze [--force]` | `analyze --force` |

## 工具选择矩阵

| 任务场景 | 首选 | 为什么 |
|---------|------|--------|
| 快速符号搜索 | `codegraph query` | 毫秒级 FTS5 本地索引 |
| 调用链追踪 | `codegraph callers/callees` | AST 级精确调用关系 |
| 影响范围分析 | `codegraph impact` | 快速出结果，按符号数定级 |
| 执行流分析 | `npx gitnexus query / context` | 预索引执行流，按相关性排序 |
| 安全重命名 | `npx gitnexus rename` | 理解调用图，不会遗漏 |
| 提交前变更检测 | `npx gitnexus detect_changes` | 验证改动是否超预期 |
| Bug 排查 | `codegraph query` → `npx gitnexus context` | 先搜符号，再追流程 |
| 大范围重构 | `codegraph impact` → `npx gitnexus context` | 先扫影响面，再验证流程完整性 |
| 极简改动（1 行/文案） | 直接编辑 | 不调用任何图谱工具 |

## 配套技能

`.agents/skills/gitnexus-*/SKILL.md` 提供各场景的操作细则：

| 场景 | 技能目录 |
|---|---|
| 理解架构 /「X 是怎么工作的」 | `.agents/skills/gitnexus-exploring/` |
| 影响范围 /「改 X 会破坏什么」 | `.agents/skills/gitnexus-impact-analysis/` |
| 排查 Bug /「X 为什么失败」 | `.agents/skills/gitnexus-debugging/` |
| 重命名 / 抽取 / 拆分 / 重构 | `.agents/skills/gitnexus-refactoring/` |
| 工具、资源、schema 参考 | `.agents/skills/gitnexus-guide/` |
| 索引、状态、清理等 CLI 命令 | `.agents/skills/gitnexus-cli/` |

> 本项目由 GitNexus 索引为 **LeLeTV**。若工具提示索引过期，先跑 `npx gitnexus analyze`。
