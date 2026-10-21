---
name: create-page
description: 'Use when adding a new page under src/pages; creates index.ts, template.html, style.css, registers the route and prefetch entry.'
---

# 新增页面

1. 确认页面名与路由名一致（kebab-case），例如 `history`。
2. 创建 `src/pages/<name>/` 三个文件：`index.ts`、`template.html`、`style.css`。
3. `index.ts` 必须导出 `mount(container: HTMLElement)` 与 `unmount()`；事件绑定只在 `mount()` 内完成。
4. `template.html` 根节点必须是 `<div id="page-<name>" class="page-content">`。
5. 在 `src/router/index.ts` 注册路由，页面 chunk 用动态 `import()` 加载。
6. 在 `src/router/prefetch.ts` 加入 hover / idle 预取候选。
7. 共享逻辑下沉 `src/services/` 或 `src/ui/`，禁止 import 其他页面。
8. 运行 `node scripts/check-deps.js`、`npm run typecheck`、`node scripts/check-budget.js`。
9. 按 `docs/REGRESSION.md` 第 8 节验证导航与返回。
10. 更新 `docs/ARCHITECTURE.md` 的页面表。
