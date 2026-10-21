# 06 禁止事项

1. 禁止 `any` / `as any` / `@ts-ignore` 绕过类型错误。
2. 禁止 `src/pages/` 之间互相 import。
3. 禁止在仓库根目录新建源文件（`.ts` / `.js` / `.css`）。
4. 禁止在迁移 commit 中混入功能、UI 或删除变更。
5. 禁止未经 `APPROVALS.md` 批准删除或合并文件。
6. 禁止 AI 自行扩充 `scripts/orphans.config.js` 白名单。
7. 禁止修改 11 套主题的视觉变量值。
8. 禁止修改邀请码、设备指纹、心跳的业务行为（只允许搬家）。
9. 禁止引入 React / Vue / Vite / Next.js 或其他前端框架。
10. 禁止在提交代码中保留 `console.log`；调试信息走 `core/logger` 或移除。
11. 禁止用 `innerHTML` 拼接不可信外部数据；先转义或走 `textContent`。
12. 禁止跳过 `npm run check` 直接提交。
