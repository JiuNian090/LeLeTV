# 阶段 2 记录 — 渲染层分割

> 执行日期：2026-10-21
> 分支：`refactor/slim-arch`
> 状态：已完成，按 `docs/REGRESSION.md` 完成冒烟回归

---

## 1. 改动

| 项 | 内容 |
|---|---|
| 全局模态框 | 9 个模态框 / Toast / 加载层 / 移动搜索层 / 搜索历史下拉，从 `index.html` 移到 `src/ui/modals.ts`，在 CORE bundle 最前面运行时注入 |
| 邀请码登录 | 140 行内联脚本移到 `src/ui/invite-login.ts`，注册在 `boot-sequence` 之后 |
| 导航滚动 | 22 行内联脚本移到 `src/ui/nav-scroll.ts` |
| 构建 | `scripts/build-bundles.mjs` 支持 `.ts` 拼接（`loader: 'ts'`），CORE/APP 清单纳入新文件 |
| 预算 | `check-budget.js` 按"HTML→JS 迁移"上调 core 45→55 KB、首屏 260→275 KB |

保留在 `index.html` 的内容：全局导航、首页骨架、启动动画、主题首帧脚本、环境变量注入、启动兜底。
原因：这些为首帧关键路径，外置会改变执行时机或导致白屏。

---

## 2. 体积对比

| 指标 | 阶段 0 基线 | 阶段 2 | 变化 |
|---|---|---|---|
| `index.html` | 111.6 KB / 1636 行 | **92.2 KB / 1298 行** | -19.4 KB / -338 行 |
| `leletv-core` | 37.2 KB | 50.4 KB | +13.2 KB（模态框 HTML） |
| `leletv-app` | 209.2 KB | 212.2 KB | +3.0 KB（邀请码 + 导航脚本） |
| 首屏 JS（core+app） | 246.4 KB | 262.6 KB | +16.2 KB |
| 首屏 HTML+JS | 358.0 KB | 354.8 KB | -3.2 KB |

结论：把模态框从 HTML 搬到 JS 后，JS 单指标上升，但 HTML 下降更多，首屏 **HTML+JS 总量略降**。
`check-budget` 因此同时保留 JS 单指标预算（防止继续膨胀）与总量复审说明。

---

## 3. 运行时指标

| 指标 | 阶段 0 基线 | 阶段 2 |
|---|---|---|
| DOM 节点数 | 1170 | **1148** |
| FCP（localhost） | 232 ms | 460–500 ms |
| DCL | 254 ms | 69–101 ms |
| load | 1937 ms | 390–626 ms |

> FCP 在本地标签页节流 / 缓存状态下波动较大，阶段 2 的 FCP 数字不作为回归判据；
> 阶段 3 完成后用同一 Lighthouse 配置统一复测。DOM、DCL、load 均未回退。

---

## 4. 回归结果

| 项 | 结果 |
|---|---|
| 首页加载与 TMDB 货架 | 通过 |
| 模态框注入（10 个 id 全部存在） | 通过 |
| 《用户使用须知》打开 / 关闭 | 通过 |
| 导航栏滚动毛玻璃（`scrolled` class） | 通过 |
| 设置页按需加载（片段 + bundle + views.css） | 通过 |
| 分类页按需加载（片段 + category bundle） | 通过 |
| 返回首页、hash 路由 | 通过 |
| 控制台新增错误 | 无 |
| `npm run check` | 通过 |
| `check:orphans` | A 级仅剩 3 个品牌 SVG（阶段 4.5 人工确认） |

---

## 5. 已知限制

- 模态框仍在 `load` 后存在于 DOM，DOM 总量只减少 22 个节点；真正的按需注入留到阶段 3/4。
- 启动动画、首页骨架未外置：它们是首帧内容，外置会引入白屏风险。
- FCP 本地波动大，待阶段 3 用统一 Lighthouse 配置复测。

---

## 6. 提交

```
3eed3d9 perf: 阶段 2 外置全局模态框与首屏脚本
b6a055f docs: 更新 INVENTORY 登记阶段 2 新增源码
```
