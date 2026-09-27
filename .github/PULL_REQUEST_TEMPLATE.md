<!--
感谢你为 LeLeTV 提交 PR！动手前请先读 CONTRIBUTING.md，并逐项确认下面的自查清单。
Thanks for contributing to LeLeTV! Please read CONTRIBUTING.md first and tick every box below.
-->

## 📝 PR 类型 / Type of Change

<!-- 勾选所有适用项 / Check all that apply -->

- [ ] 🐛 Bug 修复 / Bug fix
- [ ] ✨ 新功能 / New feature
- [ ] 🎨 界面与样式 / UI & styling
- [ ] ♻️ 重构或性能优化 / Refactor or performance
- [ ] 📄 文档 / Documentation
- [ ] 🔧 构建、脚本或配置 / Build, scripts or config
- [ ] 其他 / Other：

## 🔗 关联 Issue / Related Issue

<!-- 例：Closes #123；没有就写「无」 / e.g. Closes #123, or "None" -->

## 📌 变更说明 / What Changed

<!-- 改了什么、为什么这样改。涉及取舍时请说明为什么选这个方案 -->

## 🧪 如何验证 / How to Test

<!-- 复现/验证步骤；请写明环境：浏览器版本、桌面或移动、本地模式还是线上模式 -->

1.
2.

## 📸 截图 / Screenshots

<!-- 涉及界面改动时请附前后对比；纯逻辑改动可删掉本节 -->

| 改动前 / Before | 改动后 / After |
| --- | --- |
|  |  |

## ✅ 自查清单 / Checklist

- [ ] 我已阅读 [CONTRIBUTING.md](../CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
- [ ] 改动符合本项目技术约束：原生 JS（ES6+），**没有引入前端框架，没有擅自新增第三方依赖**
- [ ] 新增的 `js/` 模块已登记到 `scripts/build-bundles.mjs` 的打包清单
- [ ] 改了 `js/` 之后已执行 `npm run build`，`dist/` 产物与 `index.html` / `player.html` 的 bundle 引用已同步
- [ ] **没有提交任何密钥**（`.env` / `.env.local` / `ADMINKEY` / `HIDDENKEY` / `TMDB_API_KEY` 等）
- [ ] 没有改动部署配置（`wrangler.toml` / `_headers` / `_routes.json` / `functions/` / `workers/` / CI 文件）——确需改动时已在下方说明理由
- [ ] 没有改动 Service Worker 的缓存策略
- [ ] 已在本地自测（`npm run dev`），控制台无报错；涉及界面时桌面与手机都看过
- [ ] `VERSION.txt` / `CHANGELOG.md` 未被随意改动（发版由维护者按语义化版本统一处理）
- [ ] 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)（`feat:` / `fix:` / `style:` / `chore:` …）
- [ ] 我同意本次贡献按本项目的 [PolyForm Noncommercial License 1.0.0](../LICENSE) 授权

## ⚠️ 需要维护者注意 / Notes for Maintainers

<!-- 破坏性改动、需要新增环境变量、需要改部署配置、需要发版等，写这里 -->
