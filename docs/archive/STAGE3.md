# 阶段 3 记录 — 构建层代码分割

> 执行日期：2026-10-21
> 分支：`refactor/slim-arch`
> 状态：已完成；首屏传输下降 47.4%，未达到计划设定的 50%

---

## 1. 改动

| 项 | 内容 |
|---|---|
| 构建配置 | 新增 `build.config.js`，作为 5 个 bundle 的**单一清单来源**；`build-bundles.mjs` 与 `analyze.js` 共用，消除两处清单漂移 |
| JSZip | `libs/jszip.min.js`（95 KB）从 `index.html` 同步加载改为**按需加载**，仅在导入/导出配置时动态插入 `<script>` |
| 路由预取 | 新增 `src/router/prefetch.ts`：导航项 hover / focus 时调用 `LeLePages.prefetch()` 预取页面片段与按需 bundle |
| 分析脚本 | `analyze.js` 支持 `.ts` 输入（`loader: 'ts'`），基线输出到 `docs/BASELINE-stage3.md` |

---

## 2. 首屏资源对比

| 资源 | 阶段 0 | 阶段 3 | 变化 |
|---|---|---|---|
| `index.html` | 111.6 KB | 92.1 KB | -19.5 KB |
| 首屏 JS（core+app） | 246.4 KB | 263.5 KB | +17.1 KB |
| `libs/jszip.min.js` | **95 KB 同步** | **按需（首屏 0）** | -95 KB |
| `libs/sha256.min.js` | 9 KB | 9 KB | 0 |
| 首屏 CSS | 88.9 KB | 88.9 KB | 0 |
| **首屏实际传输（本地）** | **694 KB** | **365 KB** | **-47.4%** |

> 首屏 JS bundle 没有下降，因为 `app-routing` / `app-search` / `movies-page` 仍被首页直接依赖；
> 真正的 bundle 级下降要等阶段 4 把 `js/` 模块化为 ESM 后才能做。
> 本次 47.4% 的下降主要来自 JSZip 95 KB 移出关键路径与 `index.html` 缩减。

---

## 3. 验证

| 项 | 结果 |
|---|---|
| 首屏不加载 JSZip | 通过（resource 列表中无 jszip） |
| 导出配置时才加载 JSZip | 通过（调用 `exportConfig()` 后出现 `jszip.min.js` 95 KB） |
| 导航 hover 预取 | 通过（hover「设置」后 `settings.html`、`leletv-settings`、`views.css` 提前加载） |
| 首页搜索 → 结果页 | 通过（`#movies`，标题「测试视频」的检索结果） |
| 设置页 / 分类页按需加载 | 通过 |
| `npm run check` | 通过 |
| `node scripts/analyze.js` | 通过，基线写入 `docs/BASELINE-stage3.md` |

---

## 4. 未执行项与原因

| 计划项 | 状态 | 原因 |
|---|---|---|
| esbuild `splitting: true` + ESM 多入口 | 未执行 | 当前 `js/` 是全局脚本（无 import/export），esbuild 无法拆分；需等阶段 4 模块化 |
| 播放器动态 import | 不适用 | `player.html` 已是独立页面，`leletv-player` 只在播放页加载，已满足"独立 chunk" |
| 21 个采集站适配器分组 | 不适用 | 采集站是 `api-config.js` 中的配置 + 通用请求函数，不是 21 个文件 |
| 搜索 / 结果页懒加载 | 未执行 | 首页搜索框直接调用 `search()`，拆分需要先做代理入口与事件委托，风险高，留到阶段 4 |
| `public/sw.js` 预缓存 | 不适用 | 项目无 SW 注册，`service-worker.js` 是 kill-switch |

---

## 5. 阶段结论

- 首屏传输 **694 → 365 KB（-47.4%）**，接近 50% 目标。
- 首屏 JS **未下降**（246.4 → 263.5 KB），这是阶段 4 的主要任务。
- 构建清单已单一来源，后续阶段 4 可在此基础上改为真正的 ESM 入口与 splitting。
