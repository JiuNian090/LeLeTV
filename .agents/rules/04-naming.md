# 04 命名

1. 源文件用 kebab-case（`player-core.ts`）；页面入口固定 `index.ts`。
2. 类型 / 接口 / 类用 PascalCase；函数 / 变量用 camelCase；常量用 UPPER_SNAKE_CASE。
3. 公共类型放 `types.ts` 或用 `export type` 显式导出。
4. 事件名格式 `leletv:<scope>:<action>`；DOM id 用 `page-<name>` 或 `leletv-<component>`。
5. CSS 变量沿用现有 `--v2-*` 前缀，不新增第二套命名。
6. localStorage / sessionStorage key 沿用现值，禁止重命名。
7. 文件名不得包含中文、空格、大写字母。
8. 页面与组件默认导出其入口；工具函数一律命名导出。
9. 布尔变量以 `is` / `has` / `can` / `should` 开头。
10. 禁止用 `data`、`info`、`temp`、`obj` 作为导出名。
