<!-- psm:tech-stack-rules -->
<!-- 由 psm install 根据项目技术栈自动生成 -->

### Node.js / TypeScript 规范

- 使用 ES6+ 语法：`async/await`、解构赋值、可选链、空值合并
- TypeScript 项目启用 `strict` 模式
- 优先使用 `import/export`（ESM），避免 `require`
- 错误处理：使用 `try/catch` 或 `Result` 模式，避免回调地狱
- 异步操作优先使用 `Promise.all` / `Promise.allSettled` 并行化
- 路径别名：使用模块别名而非深层相对路径（`@/` 代替 `../../../`）
- 测试框架：Jest / Vitest，测试文件与源码同目录（`*.test.ts`）
- 代码风格由 ESLint + Prettier 强制执行
- 依赖管理：定期运行 `npm audit`，避免引入冗余依赖
