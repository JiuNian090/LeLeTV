# 技能生命周期规则

> 按需加载 — 用户说「安装 / 更新 / 升级 / 卸载 / 查看技能」时读取。

---

## 目录约定

- **技能实体唯一存放在 `.agents/skills/<name>/SKILL.md`**，这是全项目单一内容源
- 各 AI 工具通过接线指向它（`.claude/skills` 是 junction；Reasonix 由 `reasonix.toml` 的 `[skills] paths` 指向）
- 详细接线方式见 `.agents/README.md`

## 已安装技能清单

共 12 个，按用途分组：

| 分组 | 技能 |
|------|------|
| 技能管理 | `managing-project-skills`、`installing-project-skills`、`scheduling-project-skills` |
| 版本发布 | `version-release` |
| 索引维护 | `syncing-agent-index` |
| 工程规范 | `karpathy-guidelines` |
| 调度调试 | `superpowers-systematic-debugging` |
| 代码图谱 | `codegraph-cli`（全局技能，不在 `.agents/skills/` 内） |
| 设计风格 | `design-taste-frontend`、`redesign-existing-projects`、`high-end-visual-design`、`impeccable`、`full-output-enforcement` |

## 安装流程

由 `installing-project-skills` 技能执行：

1. 检测项目信息（读取依赖文件确定技术栈）
2. 扫描现有技能（搜索 `.agents/skills/` 下的 `SKILL.md`）
3. 整合上游来源（ECC、codegraph、superpowers、karpathy、设计技能集）
4. 按技术栈适配筛选
5. 冲突处理（同名技能合并而非覆盖）
6. 安装到 `.agents/skills/<name>/`
7. 重跑 `node scripts/sync-agent-index.mjs` 更新索引

## 升级流程

1. 对比已安装版本与上游最新版本
2. 识别新增的适用技能
3. 合并更新，**不覆盖项目自定义内容**
4. 重跑 `node scripts/sync-agent-index.mjs`

## 卸载流程

1. 确认技能名称
2. 从 `.agents/skills/<name>/` 删除
3. 检查 `.agents/rules/` 与 `AGENTS.md` 的引用，询问是否清理
4. 重跑 `node scripts/sync-agent-index.mjs`

## 状态检查

列出 `.agents/skills/` 下所有技能及其 `SKILL.md` 的 `description`；检查 `.agents/tools.json` 中的依赖工具（codegraph）是否可用；报告索引是否与磁盘一致（重跑 `node scripts/sync-agent-index.mjs --check`）。

## 注意事项

- `.agents/skills/INDEX.md` 由 `scripts/sync-agent-index.mjs` 生成。若它被其他工具覆盖成不完整的版本，重跑该脚本即可恢复
- 新增技能后**必须**重跑索引脚本，否则索引与磁盘不一致
- **工具注入式技能不要手动搬动**：`codegraph` 这类工具会自己安装与更新技能，落点可能是 `.agents/skills/codegraph/<name>/` 这类分组目录。索引脚本同时支持「顶层」与「分组」两种结构并按名称去重，因此**只需保证索引能收录，无需移动文件**
