# 代码图谱规则（CodeGraph）

> 按需加载 — 做影响分析、调用链追踪、重构、Bug 排查时读取。

---

## 何时必须用

- **改任何函数/类/方法之前**：先跑 `codegraph impact <符号>`，把影响范围报告给用户
- **重命名符号**：先跑 `codegraph callers <符号>` 列出全部调用点，逐处改完再回查确认，禁止盲目的查找替换
- **发版前**：先跑 `codegraph sync` 刷新索引，再进入 `version-release` 流程

## CodeGraph CLI

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
| 增量重索引 | `sync` | `sync` |
| 全量重索引 | `index [--force]` | `index --force` |
| 受影响测试 | `affected [文件]` | `affected js/api.js` |

## 使用纪律

| 任务场景 | 做法 | 为什么 |
|---------|------|--------|
| 快速符号搜索 | `codegraph query` | 毫秒级 FTS5 本地索引 |
| 调用链追踪 | `codegraph callers` / `callees` | AST 级精确调用关系 |
| 影响范围分析 | `codegraph impact` | 按符号数定级 |
| 改名 / 抽取 / 拆分 | 先 `callers` 列调用点 → 逐处修改 → 再 `callers` 回查 | 避免遗漏调用方 |
| Bug 排查 | `query` 定位符号 → `callers` / `callees` 追调用链 | 先找到入口再顺链路 |
| 极简改动（1 行 / 文案） | 直接编辑 | 不调用图谱工具 |

## 维护

- 索引库位于 `.codegraph/`（已 gitignore，不提交）
- **换机器 / 重新 clone 后**先跑 `codegraph init` 建立索引（一条命令完成初始化 + 首次全量索引）
- 代码变更后跑 `codegraph sync` 增量刷新；仅当索引结构异常时才用 `codegraph index` 全量重建
- 全量重建需要索引库未被占用：若报 `EPERM ... database file is in use`，先停掉正在运行的 CodeGraph 服务（`codegraph daemon` 可交互停进程）再重试
- 命令细则见全局技能 `codegraph-cli`（`~/.trae-cn/skills/codegraph-cli/`）
