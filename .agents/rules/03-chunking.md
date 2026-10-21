# 03 代码分割

1. ArtPlayer / HLS.js 只允许出现在 `src/ui/player/`，且必须独立 chunk。
2. 播放器 chunk 只在进入播放页时动态 `import()`。
3. 采集站适配器放 `src/services/sources/`；单站 minified < 8 KB 合为 `sources` chunk，≥ 8 KB 单独 chunk。
4. 页面 chunk 与 `src/pages/<name>/` 一一对应，由 `src/router/prefetch.ts` 预取。
5. 首屏只允许：`main`、`core`、`home`、共享 UI。
6. 新增静态 import 若把非首屏模块带入首屏 → 失败。
7. 每个 chunk 必须纳入 `scripts/check-budget.js` 预算，超预算 → 失败。
8. 动态 `import()` 的目标必须是静态字符串字面量，禁止拼接路径。
9. 预取只允许在 hover / `requestIdleCallback` 触发，禁止在首屏同步加载。
10. 构建后必须用 `node scripts/analyze.js` 复测并记录体积。
