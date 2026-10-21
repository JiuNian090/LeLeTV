---
name: type-module
description: 'Use when converting one module to TypeScript; adds explicit types, narrows external data, forbids any and requires tsc --noEmit to pass.'
---

# 单模块类型化

1. 只处理一个文件，确认它是 `MAP.md` 的当前条目。
2. 先读清运行时行为与外部输入：API 响应、localStorage、URL、DOM 事件。
3. 为导出函数显式标注参数与返回值；为对象定义 `interface` / `type`。
4. 外部数据先收窄：`unknown` → 校验 → 具体类型，禁止直接断言。
5. 禁止 `any`、`as any`、`@ts-ignore`、`@ts-expect-error`。
6. 公共类型放 `src/core/types.ts` / `src/services/types.ts`；页面私有类型留在页面内。
7. 运行 `npm run typecheck`，错误必须修完。
8. 运行 `node scripts/check-deps.js`、`node scripts/check-agents.js`。
9. 按 `docs/REGRESSION.md` 跑相关项；行为有任何变化即 revert。
10. 更新 `MAP.md` / `INVENTORY.md` 状态。
