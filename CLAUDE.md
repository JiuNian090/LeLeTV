# Claude 专属配置

@AGENTS.md

> 上面导入的 `AGENTS.md` 是**索引**：规则与技能正文都在 `.agents/` 下，按场景按需读取，不要全量加载。

---

## Claude 专属行为约束

- 修改代码前必须先罗列要改的文件和改动内容
- 复杂需求先分步拆解，每步完成后确认再继续
- 不自动生成 README、CHANGELOG 等文档（除非明确要求）
- 遇到模糊需求优先提问澄清，不擅自脑补业务逻辑
- 写操作限制在工作区内；工作区外写入、密钥读取需先征求同意

---

## 工具调用

- **有 CLI 就用 CLI，不接 MCP**（通用约定见 `.agents/rules/project-rules.md`）；代码图谱命令清单见 `.agents/rules/code-graph-rules.md`
- 技能实体唯一存在于 `.agents/skills/`；`.claude/skills` 是指向它的 junction（同一份内容，两条路径等价）
- 全部规则文件在 `.agents/rules/`，索引见 `AGENTS.md` 的「规则索引」表

---

## 上下文与性能设置

推荐在 `~/.claude/settings.json` 中配置：

```json
{
  "model": "sonnet",
  "env": {
    "MAX_THINKING_TOKENS": "10000",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "50"
  }
}
```

- `model: sonnet` — 覆盖 80%+ 编码任务，成本约为 opus 的 40%
- `MAX_THINKING_TOKENS: 10000` — 降低每次请求的隐性思考开销
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: 50` — 更早压缩上下文，长会话保质量

上下文管理：

- 不相关任务之间用 `/clear`
- 逻辑断点（研究完成、里程碑达成）用 `/compact`
- MCP 保持 ≤10 个启用，总工具数 ≤80
