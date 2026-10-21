# REGRESSION — 回归清单

> 用途：阶段 2 / 3 / 4 / 4.5 / 5 每次改动后按本清单验证，确保"功能与 UI 零变更"。
> 执行环境：本地 `npm start`（默认 <http://127.0.0.1:8080>）；涉及真机的项需在 iOS Safari 与 Android Chrome 各跑一次。
> 标记：`[ ]` 未跑 · `[x]` 通过 · `[!]` 失败（失败即 revert 当前条目，禁止打补丁绕过）。

---

## 0. 通用前置

- [ ] `npm run build` 成功，`git status` 无意外改动。
- [ ] 浏览器控制台无新增报错（允许采集站跨域 / 网络相关警告）。
- [ ] 首屏可见后，导航、搜索框、首页货架均可交互。

---

## 1. 邀请码与准入

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 首次访问 | 清空站点数据后打开首页 | 出现邀请码登录框 `#inviteLoginModal`，未登录不能进入内容区 |
| 有效邀请码 | 输入有效邀请码 | 校验成功、写入本地准入状态、弹窗关闭、首页正常加载 |
| 无效邀请码 | 输入错误邀请码 | 明确报错，不写入准入状态，不泄露服务端细节 |
| 已准入回访 | 刷新页面 | 不再弹登录框，直接进入首页 |
| 设备准入 | 登录后查看设备列表 | 当前设备被记录；设备指纹与心跳接口正常 |
| 管理员面板 | 用管理员身份进入设置页 | 邀请码列表、生成、禁用/启用功能正常 |
| 退出/清除 | 清除本地准入状态后刷新 | 重新要求邀请码，不残留旧设备状态 |

相关模块：`js/auth/invite-auth.js`、`js/auth/admin-panel.js`、`js/auth/user-devices.js`、`functions/_middleware.js`、`workers/tmdb-worker.js`、D1 `INVITE_DB`。

> 红区：邀请码校验、设备指纹、心跳的业务逻辑只允许搬家，不允许改行为。

---

## 2. 设备心跳

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 心跳上报 | 登录后停留首页 ≥ 1 个心跳周期 | Network 中 `heartbeat` 请求按预期发出，返回成功 |
| 设备在线状态 | 打开设置 › 设备管理 | 当前设备显示在线 / 最近活跃时间更新 |
| 多设备 | 另一浏览器登录同一邀请码 | 设备列表出现两条记录，互不覆盖 |
| 断网恢复 | 断网一段时间后恢复 | 心跳恢复上报，不重复注册设备 |

相关模块：`js/auth/user-devices.js`、`js/auth/invite-auth.js`、`workers/tmdb-worker.js`。

---

## 3. PWA 安装到桌面

> 当前 `service-worker.js` 是退役 kill-switch，**不测离线缓存**；只测"安装到桌面"。

| 项 | 步骤 | 通过标准 |
|---|---|---|
| Android Chrome | 打开首页 → 等待安装提示 | 出现"安装到桌面"入口；点击后触发系统安装 |
| Windows Edge/Chrome | 地址栏安装图标 / 页面安装按钮 | 可安装，应用名、图标、主题色正确 |
| iOS Safari | 分享 → 添加到主屏幕 | 图标、启动图、`start_url` 正确；独立窗口打开 |
| 已安装启动 | 从桌面图标启动 | 启动动画正常，不出现白屏 / 缩放异常 |
| 旧 SW 清理 | 曾安装过旧版本 SW 的浏览器 | `service-worker.js` 被拉取后旧 SW 自行注销并清缓存 |
| manifest | 查看 `manifest.json` | 名称、图标 192/512、maskable、`start_url`、`theme_color` 正确 |

相关模块：`manifest.json`、`js/ui/pwa-install.js`、`service-worker.js`、`image/brand/*`、`index.html` 启动动画。

---

## 4. 主题系统（11 套 + 自定义）

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 11 套预设 | 设置页逐个切换 `neon` … `silent` | 主色、辅助色、背景、光效同步变化，无闪白 |
| 自定义配色 | 选择"自定义"并改主色/辅助色 | 颜色即时生效，刷新后保持 |
| 首帧防闪烁 | 切换主题后刷新 | 首屏内联脚本按存档回放，无先亮后暗 |
| 跨页面一致 | 切换后进入分类 / 播放 / 设置 | 所有页面主题一致 |
| 无障碍对比度 | 逐套检查正文与背景 | 文字可读，无低对比度回归 |

相关模块：`js/ui/theme-system.js`、`css/v2/tokens.css`、`index.html` 首屏内联脚本。

> 红区：**11 套主题的视觉变量值禁止修改**。

---

## 5. 采集站负载均衡

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 多源并发 | 搜索一个热门片名 | 多个采集站并发请求，结果按速度合并 |
| 慢源降权 | 人为限速某源 | 慢源不阻塞整体结果，排序靠后 |
| 失败源跳过 | 断开某源域名 | 错误被吞掉并记录，其他源正常返回 |
| 线路探测 | 结果页最佳匹配 | `line-probe` 选中可用线路，播放按钮指向可用源 |
| 远端源同步 | 刷新 / 进入首页 | `remote-sources` 拉取并合并远端源，不覆盖本地自定义源 |

相关模块：`js/api/loadBalancer.js`、`js/api/search.js`、`js/api/remote-sources.js`、`js/ui/line-probe.js`。

---

## 6. 广告过滤

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 规则加载 | 搜索后查看 Network | `js/filter-config.json` 正常加载 |
| 过滤生效 | 用带广告标记的片源搜索 | 广告条目被过滤，正常条目保留 |
| 规则缺失 | 人为让规则 404 | 搜索仍可用，仅记录警告 |

相关模块：`js/app/app-search.js`、`js/filter-config.json`。

> 迁移时注意：`fetch('/js/filter-config.json')` 的路径要随文件位置同步。

---

## 7. 播放器

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 起播 | 从结果页点播放 | 进入 `player.html`，ArtPlayer + HLS.js 正常起播 |
| 换线 | 手动切换线路 | 新线路起播，进度不丢 |
| 自动换线 | 模拟首线路 404 / 超时 | 15 秒内自动切到下一条可用线路 |
| 选集 | 多集剧集切换集数 | 标题、集数、播放地址同步更新 |
| 进度保存 | 播放 ≥ 10 秒后返回首页 | "继续观看"出现该片，进度正确 |
| 续播 | 点击"继续观看" | 从保存进度继续播放 |
| 清晰度 | 切换清晰度 | 画面切换，进度保持 |
| 快捷键 | 空格 / 方向键 / F / M | 播放暂停、快进快退、全屏、静音符合预期 |
| 返回 | 播放页返回 | 回到来源页，不重复触发导航 |
| iOS Safari | 真机起播与全屏 | 无缩放 / 安全区异常，可正常全屏 |

相关模块：`player.html`、`js/player/*`（11 个）、`libs/artplayer.min.js`、`libs/hls.min.js`、`js/ui/ui-viewing-history.js`。

> 红区：ArtPlayer / HLS.js 只允许出现在 `ui/player/`。

---

## 8. 页面导航与返回

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 首页 ↔ 分类 | 点击导航 | 首次进入按需拉取 `pages/category.html` + category bundle；二次进入即时 |
| 首页 ↔ 历史 | 点击导航 | 历史页片段与 `views.css` 正常加载 |
| 首页 ↔ 设置 | 点击导航 | 设置页片段 + `views.css` + `admin.css` + settings bundle 正常 |
| 关于 / 说明 | 进入关于 → 说明 | `about.html`、`readme.html` 正常；README 按需加载 `marked.min.js` |
| 浏览器前进/后退 | 连续切换后前进后退 | hash 与页面一致，无空白页 |
| 刷新深链 | 直接刷新 `#category` 等 | 目标页面正确恢复 |
| 片段加载失败 | 人为让 `pages/*.html` 404 | 显示占位页，导航仍可继续，不白屏 |

相关模块：`js/app/app-routing.js`、`js/app/page-loader.js`、`pages/*.html`、`css/v2/views.css`、`css/v2/admin.css`。

---

## 9. 搜索与结果页

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 首页搜索 | 输入片名回车 | 结果区展开，卡片渲染正常 |
| 导航迷你搜索 | 桌面点搜索图标 | 输入框展开，回车走同一搜索流程 |
| 移动端搜索 | 窄屏点搜索 | `#mobileSearchOverlay` 正常打开 / 关闭 |
| 搜索历史 | 搜索后聚焦输入框 | 历史下拉出现，可点击复搜、可清空 |
| 筛选标签 | 结果页切换来源筛选 | 结果按来源过滤，计数正确 |
| 空结果 / 报错 | 搜索不存在的片名 | 明确空状态，不残留旧结果 |
| 结果缓存 | 重复搜索同一关键词 | 命中缓存，二次更快且结果一致 |

相关模块：`js/app/app-search.js`、`js/api/search.js`、`js/ui/search-cards.js`、`js/ui/ui-search-history.js`、`js/ui/nav-search.js`。

---

## 10. 配置导入 / 导出

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 导出 | 设置页导出配置 | 生成 ZIP，包含源与主题配置 |
| 导入 | 导入刚导出的 ZIP | 配置恢复，页面刷新后仍生效 |
| 非法文件 | 导入损坏 / 非 ZIP 文件 | 明确报错，不破坏现有配置 |

相关模块：`js/app/app-config.js`、`libs/jszip.min.js`。

---

## 11. 版本更新提示

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 版本读取 | 打开首页 | `VERSION.txt` / 内嵌版本号一致 |
| 更新检测 | 修改 `VERSION.txt` 后刷新 | 出现更新提示，CHANGELOG 正常展示 |
| 更新执行 | 点击"立即更新" | 清理缓存并刷新到新版本，不重复弹窗 |

相关模块：`js/utils/version-updater.js`、`VERSION.txt`、`CHANGELOG.md`。

---

## 12. 缓存与本地数据

| 项 | 步骤 | 通过标准 |
|---|---|---|
| 24h 清理 | 构造超过 24h 的缓存 | 自动清理过期项，不影响登录态与观看历史 |
| 手动清理 | 设置页清理缓存 | 缓存清空，准入状态与主题保持不变 |
| 存储异常 | 禁用 localStorage / 配额满 | 页面仍可用，仅记录警告 |

相关模块：`js/core/cache-manager.js`、`js/core/storage-service.js`。

---

## 13. 运行时指标（每次阶段结束复测）

| 指标 | 采集方式 | 基线（阶段 0） |
|---|---|---|
| 首屏 bundle | `node scripts/analyze.js` | core 37.2 KB + app 209.2 KB = **246.4 KB** |
| 首屏 CSS | Network / 文件体积 | **88.9 KB** |
| `index.html` 体积 | `ls -l` | **111.6 KB / 1636 行** |
| DOM 节点数 | `document.querySelectorAll('*').length` | **1170** |
| FCP / LCP | Performance / Lighthouse | **232 ms / 3952 ms**（localhost，无节流） |

> 阶段 2 / 3 完成后按同一口径复测，目标：首屏 bundle 下降 ≥ 50%、DOM 节点显著减少。

---

## 执行记录模板

```
日期：
阶段 / 条目：
环境：Chrome / Safari / Edge / Android / iOS
跑过的项：1 2 3 …
结果：全部通过 / 第 X 项失败（现象、控制台报错）
处理：继续 / revert <commit>
```
