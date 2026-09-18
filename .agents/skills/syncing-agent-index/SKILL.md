---
name: syncing-agent-index
description: 当新增、重命名或删除了 .agents/rules/ 下的规则文件或 .agents/skills/ 下的技能后，同步 AGENTS.md 与 .agents/skills/INDEX.md 索引。触发词：新增技能、新增规则、索引不同步、更新索引。
---

# 同步 Agent 索引

## 何时使用

- 新增 / 重命名 / 删除了 `.agents/skills/<name>/SKILL.md`
- 新增 / 重命名 / 删除了 `.agents/rules/*.md`
- 发现 `AGENTS.md` 的「技能索引」区块与实际技能对不上
- 提交前想确认索引没漏

## 原理

`.agents/` 是唯一内容源，索引是它的投影：

```
.agents/skills/<name>/SKILL.md  ─┐
                                 ├─→  node scripts/sync-agent-index.mjs  ─→  AGENTS.md（区块）
.agents/rules/*.md              ─┘                                        └→  .agents/skills/INDEX.md
```

脚本读取技能的 frontmatter（`name` / `description`）与规则文件的一级标题，重写
`AGENTS.md` 中 `<!-- AGENT-INDEX:START -->` 与 `<!-- AGENT-INDEX:END -->` 之间的区块，
并重新生成 `.agents/skills/INDEX.md`。**该区块内不要手写内容**，会被覆盖。

## 操作步骤

1. 确认技能实体已放在 `.agents/skills/<name>/SKILL.md`，且 frontmatter 含 `name` 与 `description`
2. 确认规则实体已放在 `.agents/rules/<name>.md`，且首行为一级标题
3. 运行：

   ```bash
   node scripts/sync-agent-index.mjs
   ```

4. 检查输出，确认技能数与规则数与预期一致
5. 提交前可只做校验（不一致时退出码 1）：

   ```bash
   node scripts/sync-agent-index.mjs --check
   ```

## 注意事项

- **不要**在任何工具私有目录（`.claude/skills/`、`.reasonix/skills/`）下新增或编辑技能，`.claude/skills`
  是指向 `.agents/skills` 的联接，写入会直接落到单一源里
- 若运行过 `npx psmgr install` 把 `.agents/skills/INDEX.md` 覆盖成只含 psm 技能的版本，
  重跑本脚本即可恢复
- 场景 → 技能的对应关系写在 `.agents/rules/skill-scheduling-rules.md`，**不会**被自动生成，
  新增技能后需要手动补进那张表
