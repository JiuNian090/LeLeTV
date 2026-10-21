# 01 分层与依赖

> 可判定规则，违反即拒绝提交。适用于 `src/` 下的 `.ts` 文件。

## 层与允许的 import

```
core → services / ui → pages → router → main.ts
```

| 层 | 路径 | 允许 import |
|---|---|---|
| core | `src/core/**` | core |
| services | `src/services/**` | core、services |
| ui | `src/ui/**` | core、ui |
| pages | `src/pages/**` | core、services、ui |
| router | `src/router/**` | core、pages（仅动态 import） |
| main | `src/main.ts` | 全部 |

## 判定

1. import 解析后落在"禁止 import"列 → 失败。
2. `src/pages/a/**` import `src/pages/b/**` → 失败。
3. 非 router 层 import `src/pages/**` → 失败。
4. 任意循环依赖 → 失败。
5. `src/core/**` import `services|ui|pages|router` → 失败。
6. 新增文件不在既有层内 → 失败。
7. 检查命令：`node scripts/check-deps.js`，必须返回 0。
