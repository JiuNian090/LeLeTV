---
name: split-chunk
description: 'Use when a bundle exceeds budget or a page/player/source should load on demand; moves code behind a dynamic import and measures before/after size.'
---

# 拆分 chunk

1. 运行 `node scripts/analyze.js`，找出超预算或不在首屏却被打进首屏的模块。
2. 判断边界：页面级、播放器级、采集站级；一次只拆一个边界。
3. 把目标模块改为动态 `import()`，路径必须是静态字符串字面量。
4. 更新 `src/router/prefetch.ts` 的预取策略；首屏不得同步加载新 chunk。
5. 在 `scripts/check-budget.js` 登记新 chunk 的预算。
6. 运行 `npm run build`，再跑 `node scripts/analyze.js --out docs/BASELINE-<stage>.md`。
7. 确认首屏 bundle 未回退，按 `docs/REGRESSION.md` 跑相关项。
8. 在提交信息中记录拆分前后体积；超预算或回归失败即 revert。
