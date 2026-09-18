# 版本管理规则

> 按需加载 — 用户说「更新更新日志为 vx.x.x」「发布新版本」「打 tag」时加载
> 关联技能：`version-release`

---

## 概述

本规则定义项目的版本更新流程：更新 `CHANGELOG.md`、升级 `VERSION.txt`、同步 `README.md`。
完整流程与格式已统一收敛到 `version-release` 技能。

---

## 🎯 触发条件

| 用户指令 | 触发动作 | 加载的规则/技能 |
|---------|---------|---------------|
| 「更新更新日志为 vx.x.x」 | 加载本文件 + 调用 `version-release` 技能 | 全量 |
| 「发布新版本」「打 tag」「release」 | 版本号更新 + CHANGELOG + git tag | 按需 |
| 「查看版本历史」「changelog」 | 读取 `CHANGELOG.md` | 按需 |

---

## 🔄 默认流程（由 `version-release` 技能执行）

详见 `.agents/skills/version-release/SKILL.md`：

1. 确认版本号
2. 读取 `VERSION.txt`
3. 获取 git 提交记录（含提交日期）
4. 更新 `CHANGELOG.md`（分类 + emoji + 面向用户描述 + 日期取提交日期）
5. 更新 `VERSION.txt`
6. 同步 `README.md`（当前版本号 + 更新日志摘要 + **本次改动涉及的正文内容**）
7. 验证，并按需 `npm run build`

---

## ⚠️ 强制规则

**更新版本时必须使用 `version-release` 技能**，禁止不加载技能、凭记忆手改 `VERSION.txt` 与 `CHANGELOG.md`。

---

## 📝 项目自定义

<!-- psm:project-custom -->

### 从项目 AGENTS.md 提取的规则

**触发指令：** 当说"更新更新日志为 vx.x.x"时触发。

详细流程与格式见 `.agents/skills/version-release/SKILL.md`
调用技能：`version-release`

### 日期规则

版本条目日期 `(YYYY-MM-DD)` 取**该版本 git 提交的实际日期**，不得使用任务执行当天的日期（任务/系统日期）。
获取方式：`git log -1 --format="%ad" --date=short <发布提交>`。

### README 同步规则

发版时 README 要同步两类内容，**缺一不可**：

1. **版本相关信息** — 当前版本号、「📝 更新日志」摘要（保留最近 3 条）
2. **与本次改动对应的正文内容** — 按本次提交逐项核对「功能特性 / 架构说明 / 目录结构 / 部署指南 / 环境变量 / 缓存与版本管理 / 技术栈」等章节，把已与代码不符的描述改到一致（含数量、清单、表格行）

判据是「README 现有描述是否已与代码不符」，与更新日志的取舍标准不同：纯内部重构不必写进更新日志，但只要让 README 描述失真就必须改。确实对应不上任何章节时，需显式说明原因，不得默认跳过。

详见 `.agents/skills/version-release/SKILL.md` 第 6 步。

---


<!-- 安装后，项目专属的版本管理规则（如特殊版本号格式、发布流程）写在此处 -->
