# `.agents/` — 全项目 AI Agent 单一内容源

> 本目录是**规则与技能的唯一存放处**。新增任何 AI 工具时，让它的配置指向本目录，不要另建副本。

---

## 目录结构

```
.agents/
├── rules/                    # 规则正文（按需加载，索引在 AGENTS.md）
│   ├── project-rules.md              # 任务分类与技能分派（每个任务开始前必读）
│   ├── code-standards-rules.md       # 编码规范 + 提交规范 + 错误处理等级
│   ├── security-rules.md             # ECC 安全基线
│   ├── deployment-rules.md           # Cloudflare 部署与排查
│   ├── code-graph-rules.md           # CodeGraph / GitNexus 用法
│   ├── skill-scheduling-rules.md     # 技能编排 + 设计技能选择指南
│   ├── skill-lifecycle-rules.md      # 技能安装/升级/卸载
│   ├── version-management-rules.md   # 版本发布流程
│   └── templates/                    # psm 模板（重装时用）
├── skills/                   # 技能正文，每个技能一个目录
│   └── <skill-name>/SKILL.md
├── skills-registry.json      # psm 上游技能源
├── tools.json                # codegraph / gitnexus 安装状态
└── skills/INDEX.md           # 自动生成的技能与规则索引
```

## 索引文件

| 文件 | 作用 | 生成方式 |
|---|---|---|
| `AGENTS.md`（仓库根） | 所有 Agent 的入口索引 | 手写骨架 + 自动生成技能表 |
| `CLAUDE.md`（仓库根） | Claude 专属配置，`@AGENTS.md` 导入通用部分 | 手写 |
| `.agents/skills/INDEX.md` | 技能树与规则入口 | `node scripts/sync-agent-index.mjs` 自动生成 |

**新增技能或规则后，必须重跑：**

```bash
node scripts/sync-agent-index.mjs          # 重新生成索引
node scripts/sync-agent-index.mjs --check  # 只检查是否已同步（CI / 提交前用）
```

---

## 各工具接线方式

原则：**能通过配置文件指向单一源的，优先用配置；配置改不了的，用目录联接（junction / symlink）。**

| 工具 | 机制 | 接线 |
|---|---|---|
| **Reasonix** | `reasonix.toml` 原生支持额外技能根 | `[skills] paths = [".agents/skills"]`（已配置） |
| **Claude Code** | 技能路径固定为 `.claude/skills/`，无配置项 | `.claude/skills` 是 Junction → `.agents/skills` |
| **Cursor / Windsurf / Trae / Codex 等** | 读根目录 `AGENTS.md` | 无需额外配置，索引里已含路径 |
| **纯 MCP 类工具** | 读 `AGENTS.md` | 同上 |

### 检查接线是否正常

```bash
# Windows：确认 .claude/skills 是联接且能读到内容
Get-Item .claude/skills | Select-Object LinkType, Target
(Get-ChildItem .claude/skills -Directory).Count   # 应等于 .agents/skills 下的技能数

# 跨平台一致性检查
node scripts/setup-agent-links.mjs --check
```

### 换机器 / 重新 clone 后

junction 是本地文件系统特性，不进版本控制。clone 后跑一次：

```bash
node scripts/setup-agent-links.mjs
```

该脚本在 Windows 上建 Junction，在 macOS / Linux 上建 symlink，已存在则跳过。

---

## 版本控制说明

| 路径 | 是否纳入 git | 原因 |
|---|---|---|
| `.agents/`、`AGENTS.md`、`CLAUDE.md` | ✅ 纳入 | 通用层，跨 Agent / 跨机器共用 |
| `.reasonix/` | ❌ 忽略 | Reasonix 私有运行时目录（含 tasks、会话状态） |
| `.claude/skills` | ❌ 忽略 | 只是 junction，换机器用脚本重建 |
| `reasonix.toml` | ❌ 忽略 | 含本机绝对路径 |

> reasonix.toml 里的 `[skills] paths = [".agents/skills"]` 与 `.claude/skills` 的 junction 是本机接线，
> 不入库；新机器由 `scripts/setup-agent-links.mjs` 重建。
