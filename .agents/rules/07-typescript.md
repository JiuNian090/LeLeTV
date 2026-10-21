# 07 TypeScript

1. `src/` 下新增文件必须是 `.ts`；禁止新增 `.js`。
2. 提交前必须 `npm run typecheck`（`tsc --noEmit`）通过。
3. 禁止 `any`、`as any`、`@ts-ignore`、`@ts-expect-error`；确需例外时写注释并获批准。
4. 外部数据（API / localStorage / postMessage）先收窄再使用，禁止直接断言。
5. 公共类型放 `src/core/types.ts` / `src/services/types.ts`；页面私有类型留在页面内。
6. 导出函数必须显式标注参数与返回值；回调参数可推断。
7. 渐进式 strict：`strictNullChecks` → `noImplicitAny` → `strict`，每步开启前跑回归。
8. 迁移 commit 只允许加类型、`interface` / `type`、必要收窄，不得改变运行时行为。
9. `tsconfig.json` 的 `include` 必须覆盖 `js/`，直到阶段 4 完成。
10. 类型检查失败即 revert 当前条目，禁止用断言绕过。
11. 第三方库缺类型时，在 `src/core/types/` 写最小声明，禁止 `declare module '*'`。
12. 类型检查命令：`node scripts/check-types.js`。
