---
name: regression-check
description: 'Use after each migration or chunk split; runs the documented regression checklist, records the environment and reverts on any behavior change.'
---

# 回归检查

1. 打开 `docs/REGRESSION.md`，确定本次改动涉及的条目。
2. 运行 `npm run build`，确认 `git status` 无意外改动。
3. 启动 `npm start`，按条目逐项验证；涉及 PWA / 播放器的项在真机各跑一次。
4. 记录：日期、阶段 / 条目、环境、跑过的项、结果。
5. 失败：记录现象与控制台报错，立即 revert 当前条目。
6. 通过：把 `MAP.md` 状态改为 `verified`，在提交信息附回归结果。
7. 阶段结束跑全量清单，并复测 `node scripts/analyze.js`。
8. 回归数据与基线（`docs/BASELINE.md`）对比，首屏回退即视为失败。
