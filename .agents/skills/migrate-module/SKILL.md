---
name: migrate-module
description: 'Use when moving one legacy module from js/ into src/ per MAP.md; preserves runtime behavior, updates every reference and records verification.'
---

# 迁移单个模块

1. 在 `.agents/migration/MAP.md` 取下一条 `pending`，严格按 core → services → ui → pages → router 顺序。
2. 记录影响面：全仓搜索模块名、在当前构建清单中的位置、动态引用点。
3. `git mv` 到目标路径，同时把 `.js` 改为 `.ts`。
4. 只补类型注解 / `interface` / `type` / 必要收窄；不得改运行时行为。
5. 更新所有引用：`scripts/build-bundles.mjs` 清单、HTML `<script>`、动态 `import()`、`fetch()` 路径。
6. 运行 `npm run typecheck`，类型错误必须修完，禁止 `any` 绕过。
7. 运行 `node scripts/check-deps.js`、`node scripts/check-coverage.js`。
8. 按 `docs/REGRESSION.md` 跑相关项。
9. 更新 `MAP.md` 为 `migrated`，回归通过后改 `verified`；同步 `INVENTORY.md` 状态。
10. 失败立即 revert 本条；禁止跨条目打补丁或夹带删除。
