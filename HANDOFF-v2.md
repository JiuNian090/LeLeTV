# LeLeTV v2 改版 · 交接文档

日期：2026-09-27（第二版，含 logo 重做、玻璃材质、起播预检）　基线：朋友仓库 `JiuNian090/LeLeTV` 提交 `cb51f54`（v3.6.5）　工作目录：`~/leletv-v2`

改版范围只有界面与交互：内容源、代理、Cloudflare 部署配置（`wrangler.toml` / `_headers` / `_routes.json` / `functions` / `workers`）一律没动。所有改动都在工作区，**没有提交、没有推送**。

---

## 1. 状态一览

### 已完成并验证

| 模块 | 内容 |
|---|---|
| 样式底座 | 旧样式全部撤下，新样式在 `css/v2/`（tokens → base → home → views → admin；播放页另有 player.css）；三团光的动态背景（`.v2-glow`）两页共用；搜索框、历史弹框、全站按钮统一为「光学薄玻璃」材质（见 §5） |
| 首页 | 光学薄玻璃刻字的 leleTV 字标 + 一行小字口号「自由观影 畅享精彩」+ 清玻璃搜索框，首屏居中，聚合区在首屏只露第一行；「多源聚合」动效（复刻 flux.inch.red，画布按视口动态加宽，2K/4K 铺满，上下渐隐）；继续观看；最近更新的电影 / 电视剧 / 动漫 / 综艺四行，带「更多」 |
| 导航 | 新 logo：圆角方块里的「Le」图形标 + leleTV 手写字标（跟随配色）；导航项在右侧，搜索图标在导航项左边（桌面展开输入框往左长、导航项不动；手机点开搜索层）；手机端底部标签栏 |
| 结果页 | 常驻搜索框 + 计数；「全部 / 正片 / 其他版本 / 衍生作品 / 相关影片」分段 + 来源延迟；最佳匹配（海报取色背景、季切换、播放、线路列表、简介）；分组货架；单个片源平铺；播放页返回秒开；**起播前线路预检**（最佳匹配一出现就并行探前 3 条线路，死线路挪到最后并标「不可用」，多个版本组时默认显示线路最多的一组） |
| 分类 / 历史 / 关于 / 项目说明 | 全部按新样式重做；关于页两栏等高 |
| 设置 | 数据源小开关；自定义资源站；私密模式 / 广告过滤开关；**首页与导航**（首页聚合动效、首页内容板块、导航只显示图标三个开关 + 动态效果三档，前两项全关就是只有搜索框的简洁首页）；**主题配色** 11 套方案 + 自定义 + 恢复默认；导入 / 导出 / 清除 |
| 播放页 | 两栏布局、ArtPlayer 皮肤、选集、线路切换、锁定、返回；**起播失败自动换线**（清单 / 分片加载失败或 15 秒没起播就换到同一部片的下一条可用线路，已被预检判死的线路进页即换）；播放页脚本在结果页预取；**关灯**（侧栏按钮，整页压黑只留播放器，点黑色区域或 Esc 开灯，偏好记 `leletv_lights`）；修好网页全屏（我们的 CSS 曾把 ArtPlayer 网页全屏需要的 `position: fixed` 压成 relative） |
| PWA | manifest、图标、iOS 启动图全部换成新 logo，品牌图片地址带版本号 `?v=le2`（服务器给图片缓存一天，换图必须换版本号）；安装提示条（有安装事件时弹系统框，iOS / 局域网 http 给手动步骤）；关于页「安装到桌面」 |
| 邀请码 | 只做了弹窗的视觉框架：本地模式不校验、直接进入（用户要求） |
| 流畅度 | 首页可交互约 180ms；搜索首批结果 0.9～2.3s、全部片源 2.5～5.4s；点播放到跳转约 260ms；活线路 2～3s 起播，死线路自动换线 7～11s（原来 18～25s） |

验证：桌面 1440、宽屏 2560 / 3840、手机 390 全部跑过脚本回归（见 §9），无脚本报错、无横向溢出。第二轮（logo、玻璃材质、预检换线）的截图在交付目录 `03_验证截图/第二轮-logo与玻璃材质/`。

### 没做 / 没验证的

1. **线上模式没有联调。** 配置了 `TMDB_WORKER_URL` 后走 Worker 的邀请码校验、设备管理面板、邀请码管理面板，这些逻辑保留在代码里，样式移植到了 `css/v2/admin.css`，但没有对着真实 Worker 跑过。
2. **没有部署。** Cloudflare Pages 的构建、`_headers`、Worker 都没动也没试。
3. **没有提交 git**，没有更新 `VERSION.txt` / `CHANGELOG.md`（仓库规则要求走 `version-release` 技能，等你决定版本号再做）。
4. 旧的 Tailwind 流程还在：`npm run build` 最后一步仍会把 `css/tailwind.css` 编译成 `css/output.css`，但页面已经不引用它。`css/` 下的 `output.css / pages.css / player.css / styles.css / tailwind.css / variables.css` 都可以删。
5. 私密模式只做了基础适配（铜色主题、隐藏分类入口、片源分域），没有逐页回归。
6. 结果页的分组、首页「最近更新」的选片都是启发式规则（见 §6），会有归错组的情况。
7. 线路预检只探当前显示的最佳匹配组；同一组里所有线路都死时播放按钮仍指向死线路，交给播放页自动换线（会多等几秒）。

---

## 2. 文件变更清单（相对 v3.6.5）

**新增**

```
css/v2/tokens.css     设计变量、配色派生变量、动态背景、减少动态效果的覆盖规则
css/v2/base.css       重置、通用组件（按钮 / 输入 / 弹窗 / 提示条 / 页脚）、安装提示条
css/v2/home.css       导航（含 logo 组合、迷你搜索）、首页、聚合动效、海报卡片、货架
css/v2/views.css      结果页、分类、历史、设置（开关 / 配色方案 / 取色气泡）、关于、项目说明
css/v2/admin.css      设备管理、邀请码管理面板（线上模式用）
css/v2/player.css     播放页
image/brand/          新 logo：lockup / mark / mark-currentcolor / wordmark-currentcolor、favicon、PWA 图标（any + maskable）、apple-touch-icon（源图与描图管线在交付目录 02_设计素材/新logo-Le图形标/）
js/effects/hub-flow.js   聚合动效
js/ui/home-shelves.js    首页继续观看、片源数、海报卡片构造器、给动效供海报
js/ui/home-recent.js     首页「最近更新」四行
js/ui/nav-search.js      导航迷你搜索
js/ui/brand-canvas.js    在 canvas 上画 logo（换色过渡、私密切换的粒子动画用）
js/ui/motion-pref.js     动态效果偏好（跟随系统 / 开启 / 关闭），在 CORE 包
js/ui/pwa-install.js     安装提示
js/ui/layout-pref.js     首页与导航布局偏好（简洁首页）
js/ui/line-probe.js      线路预检（详情有集数 + m3u8 能按 CORS 取到），结论存 sessionStorage 10 分钟；结果页与播放页共用，在 CORE 包
js/ui/hero-glass.js      首屏玻璃字标的高光方位随指针
js/player/player-failover.js   播放页起播失败自动换线
js/player/player-lights.js     播放页关灯
```

**修改**（相对基线 51 个已有文件有改动、14 个新增文件，逐文件行数见交付目录的 `改动清单.txt`）

```
index.html / player.html     全部页面骨架重写；head 首帧脚本：主题色、配色派生变量、动态效果偏好；品牌 sprite；安装提示条
js/ui/movies-page.js         结果页重写（分组、最佳匹配、货架、线路预检、默认版本选择）
js/ui/search-cards.js        合并键、封面占位、卡片入场
js/ui/theme-system.js        配色方案（主色 + 辅助色）、恢复默认、取色气泡、换色过渡画 logo
js/api/tmdb.js               分类页卡片、openTmdbCategory(type) 预置类型
js/api/api-config.js         数据源小开关、自定义资源站行
js/app/app-search.js         search() 直接进结果页、事件委托新增 action、手机幽灵点击
js/app/app-routing.js        视图过渡异常处理、私密切换动画画 logo、减少动态效果判断
js/app/app.js                本地模式跳过设备 / 管理面板
js/app/app-config.js         导入导出带上主题键
js/auth/invite-auth.js       本地模式（没配 Worker 地址）免门禁、不发心跳；?invite 重新弹框
js/core/config.js            持久化键名加 leletv_motion / leletv_layout / leletv_lights
js/player/player-core.js     hls.js 超时参数收紧（清单 6s 不重试、分片 8s 重试 2 次），加载失败时交给 LeLeFailover
image/splash/*               iOS 启动图重做（黑底 + 新图标）
js/ui/ui-viewing-history.js  历史页
js/ui/ui-search-history.js / ui.js / ui-core.js / player-episodes.js / version-updater.js   样式类名与文案
js/api/api.js                fetch 拦截只拦同源 /api/search、/api/detail
scripts/build-bundles.mjs    打包清单登记新文件
server.mjs                   读 .env.local；默认只听 127.0.0.1；调试日志遮掉 key
manifest.json                新图标（带 ?v=le2 版本号）、颜色
```

---

## 3. 本地运行

```bash
cd ~/leletv-v2
npm install                                 # 已装过可跳过
node scripts/build-bundles.mjs              # 改了 js 后重新打包（产物在 dist/，index/player 会自动改引用）
node server.mjs                             # http://127.0.0.1:8080
HOST=0.0.0.0 node server.mjs                # 局域网联调：手机访问 http://<本机IP>:8080
```

- TMDB key 放在 `~/leletv-v2/.env.local`（`TMDB_API_KEY=...`，已 chmod 600，在 .gitignore 里，**不在交付包里**）。没有 key 时首页热门、最近更新、分类页为空，搜索和播放不受影响。
- `server.mjs` 支持的环境变量：`HOST`、`PORT`、`TMDB_API_KEY`、`TMDB_WORKER_URL`、`HIDDENKEY`、`DEBUG`、`CORS_ORIGIN` 等（见文件头）。
- 打包命令**不要接 grep 管道**：这台机器的 grep 是 ugrep，模式以 `-` 开头会当参数报错；管道一断，脚本在更新 HTML 前中止，页面引用的 bundle 会 404。
- 浏览器原生的 PWA 安装框只在 HTTPS 或 localhost 出现，`http://192.168.x.x` 永远不会有，这不是站的问题。

## 4. 两种运行模式

| | 本地模式 | 线上模式 |
|---|---|---|
| 判定 | `TMDB_WORKER_URL` 为空 | 配置了 Worker 地址 |
| 邀请码 | 弹框只是视觉框架，点进入即可；地址带 `?invite` 重新弹 | 走 Worker 校验 + 设备心跳（未联调） |
| 设置页 | 不渲染设备 / 邀请码管理面板 | 渲染（样式在 admin.css，未联调） |
| TMDB | 本机 `/api/tmdb` 代理，key 在 .env.local | Worker 代理 |

## 5. 设计系统

**配色方案**（设置 › 主题配色；`js/ui/theme-system.js` 的 `PRESETS`）

| 方案 | 主色 | 辅助色 | 底色 |
|---|---|---|---|
| 霓虹夜场（默认） | 霓虹粉 #EC4899 | 樱花白 #FFE4F1 | #0A0A0B |
| 私人放映厅 | 黄铜金 #F0B862 | 丝绒红 #6E1F38 | #0E0B0A |
| 极光穹顶 | 极光紫 #8B7BFF | 极光青 #46E3D0 | #07070F |
| 胶片暗房 | 安全灯红 #D9695F | 相纸白 #F2E7DC | #0D0A0A |
| 魔幻时刻 | 晚霞橘 #E8956B | 暮光紫 #8D7CC6 | #0C0A0E |
| 露天影院 | 萤火绿 #9DC47F | 灯串黄 #EFD48E | #090B09 |
| 海岸放映 | 海雾青 #6CBFB5 | 珊瑚橘 #EE9D87 | #080B0B |
| 深夜影院 | 月夜蓝 #7FA5DC | 星光银 #DAE2EE | #08090E |
| 谢幕时分 | 帷幕紫 #B48BD8 | 追光白 #F4EDE2 | #0B090E |
| 春日影展 | 桃花粉 #E2799F | 新芽绿 #B7D59B | #0C0A0B |
| 黑白默片 | 银盐灰 #C4C8D0 | 碳素灰 #5C606A | #0A0A0A |

前三套就是 logo 的三套配色。主色管按钮、选中态、logo 图形；辅助色管左上角背景光、logo 圆角底、字标。彩度压在 OKLCH C 0.08～0.15，主色在底色上的对比度都 ≥ 5.5:1；浅主色（黄铜金、萤火绿等）的按钮文字自动换成深色（`--v2-on-accent`）。私密模式默认铜色 #B87333。

**变量落点**：主色写 `--color-primary*` 一组（首帧脚本按同一套 HSL 算法现算）；派生的 `--v2-blush / --v2-word / --v2-aux(-rgb) / --v2-glow-2 / --v2-tile / --v2-on-accent / --v2-bg` 由 `deriveVars()` 算好，连同存档一起存进 localStorage（`leletv_theme_normal` / `leletv_theme_hidden` 的 `vars` 字段），首帧脚本按 `ALLOW` 名单回放。**改名单要三处同步**：theme-system.js 的 `EXTRA_VARS`、index.html 与 player.html 的 head 脚本。

**logo**：`index.html` 开头有品牌 sprite（`#lele-mark` viewBox `170.6 154.9 432.4 326.3`，`#lele-word` viewBox `646.6 235.6 756.5 204.5`），页面里都用 `<svg viewBox="0 0 432.4 326.3"><use href="#lele-mark"/></svg>`——外层 viewBox 必须从 0 0 起算，写原始坐标会裁掉。图形标是横版，方块里按宽 0.7 倍放；组合的尺寸只看 `.v2-lockup` 的 `--lockup`（方块边长）。canvas 里画 logo 用 `LeLeBrandCanvas.draw()`，它的 `MARK_BOX / WORD_BOX` 要和 sprite 的 viewBox 一致。再换 logo 时按交付目录 `02_设计素材/新logo-Le图形标/描图管线/README.md` 的顺序重做，并把品牌图片的版本号（`?v=le2`）升一位。

**材质（光学薄玻璃）**：用户明确要的是 Apple `.glassEffect(.clear)` 那种薄片清玻璃——玻璃本身无色、不发光、不带阴影，只有轻微折射和细窄的边缘高光，轮廓干净；明确不要果冻 / 水滴 / 泡泡 / 厚 bevel / 霓虹。落点：
- 首屏字标：`.v2-hero-glass` 按字形 clip-path（`#heroWordClip`，objectBoundingBox 单位）做 backdrop 轻折射；`.v2-hero-word` 的 SVG 滤镜 `#heroWordGlass` 只画边缘高光（SourceAlpha 模糊 1.6 当高度图、高光指数 48）和一圈极细轮廓线；高光方位跟指针（hero-glass.js）；进场从左往右写出，减少动态效果时不动。
- 搜索框、历史弹框：0.5px 发丝边 + 顶边 0.5px 高光 + backdrop blur，无阴影（`.home-search-bar.v2-search`、`#searchHistoryDropdown.v2-dropdown`）。
- 按钮：`.v2-btn--primary`、`.v2-search-btn`、`.dash-btn-primary`、手机搜索层的「去」都是半透明主色 + 0.5px 主色边 + 顶边高光；`.v2-btn--secondary` 是无色清玻璃；`.v2-btn--danger` 同法换成红。0.5px 在 1 倍屏会按 1px 显示。

**动效**：所有动画尊重 `prefers-reduced-motion`（Windows 关掉「动画效果」、macOS 开「减弱动态效果」都会触发，Parallels 里的 Windows 默认就是关的）。设置里三档覆盖：`html[data-motion="on|off"]`，css 用 `html:not([data-motion="on"])` 放行，脚本统一问 `LeLeMotion.reduced()`；地址带 `?motion=on` 可一次性强制开启。

## 6. 各页面要点

- **聚合动效**（hub-flow.js）：设计画布高 850，宽度 = max(1920, 视口宽 ÷ 缩放比)，缩放比按断点 1 / 0.7 / 0.45（≥2400 放大 1.25、≥3400 放大 1.7）。三排，行距 212，卡片与海报同为 120×180、间距 32；左半边卡片沿半径 1800 的弧线，右半边海报走直线，同一个运动坐标 u，过线处两者完全重合。只改 transform；离开视口、页面隐藏、减少动态效果时停。
- **最近更新**（home-recent.js）：TMDB discover——电影：近 60 天数字 / 实体发行；电视剧：近 10 天有新集，排除动画 / 真人秀 / 脱口秀 / 新闻 / 肥皂剧 / 儿童；动漫：近 10 天有新集的日本动画；综艺：近 3 周有新集的中韩港台真人秀。每行 6 张，sessionStorage 缓存半小时。「更多」→ `openTmdbCategory(type)` 切到分类页并预置类型。
- **结果页分组**（movies-page.js）：先按 `_mergeKey`（去「$别名」和末尾括号别名再规范化）合并同名；再分：片名去季序后等于关键词 → 正片（各季进最佳匹配）；关键词后只剩版本词（`VERSION_TOKENS`：粤语版、特别版、预告片……）→ 其他版本；关键词后接「之」或标点、或分类是短剧 → 衍生作品；其余 → 相关影片。没有精确命中时片源最多的一组顶上当最佳匹配。选中单个片源时不合并、平铺。
- **简洁首页**（layout-pref.js）：偏好存 `leletv_layout`（JSON：hub / shelves / navIcons），首帧脚本据此把 `data-home-hub="off"`、`data-home-shelves="off"`、`data-nav="icons"` 打到 `<html>` 上，css 直接隐藏；关着时 home-shelves.js 不建聚合节点、home-recent.js 不发请求，运行时打开会补建（`leletv:layoutchange` 事件）。两块都关时首页只剩标题和搜索框，在视口里居中。「只显示图标」只作用于桌面导航，手机底栏保留文字，按钮带 `title` 供悬停。
- **起播前预检**（line-probe.js + movies-page.js）：`LeLeLineProbe.check(source, vodId, index)` = 拉详情看有没有集数，再按 hls.js 的方式（CORS、不带 `cache:'no-cache'`，否则会触发预检请求）取当前集的 m3u8；结论按 `source|vodId|index` 存 `leletv_line_probe`，10 分钟内不重复探。最佳匹配每次渲染都会把已判死的线路排到最后并探未知的前 3 条；判死的正好是播放按钮指向的那条就重绘。
- **自动换线**（player-failover.js）：起播前清单 / 分片失败、原生 HLS 出错、15 秒没起播，或进页时当前线路已被预检判死 → 从结果页缓存里找同一部片的其它片源（片名规范化后相同或只多几个字），并行校验，第一条通过的就 `switchToResource` 整页跳转；试过的线路记 sessionStorage `leletv_line_failover`，最多换 3 次，换过后在新页面提示一句。
- **导航搜索**（nav-search.js）：桌面展开输入框后回车走首页同一个 `search()`；手机点图标开手机搜索层（`openMobileSearch`）。
- **取色气泡**：Chrome 的 scroll 事件异步派发，点击前那下滚动可能在气泡打开后才到，已按打开 400ms 内忽略滚动处理。
- **PWA**：仓库故意不注册 Service Worker（旧 SW 会拦视频分片拖慢播放；`service-worker.js` 是注销用的 kill switch，别往里加逻辑）。新版 Chrome 安装不再要求 SW。
- **不要给 `.hidden` 加 `!important`**：邀请码、使用须知等弹窗靠行内 `display:flex` 显示。

## 7. 已知限制

- 个别片源的 m3u8 被 CORS 拦（如 `v.lzcdn28.com`），点播放后要在播放页换线路，与界面无关。
- 首页「最近更新」按 TMDB 的「近期有新集」取，会出现老剧新季（如 1971 年的假面骑士）。
- 图床普遍慢：卡片先显示片名首字占位，封面到了再淡入；非 2:3 的封面完整居中 + 同图模糊垫底。
- 结果页的分组是启发式，例如「庆余年[电影解说]」会进「衍生作品」。
- 片源本身不稳定：同一片名每次检索回来的线路和顺序都可能不同，预检和自动换线只能兜底，不能保证首条一定能播。
- 浏览器标签页上的小图标（favicon）换新后可能要重开浏览器才刷新，这是浏览器自己的缓存。

## 8. 如何接入旧项目

三条路，按你和朋友的习惯选：

**A. 整包替换（最省事）**
把交付包解开覆盖到朋友仓库的工作区（包里不含 `node_modules`、`.git`、`.env.local`），`npm install` 后 `node scripts/build-bundles.mjs`，本地 `node server.mjs` 看一遍，再按仓库规则走 `version-release` 提交。交付包里的 `dist/` 是已打好的 bundle，Cloudflare 云端构建会自己重打。

**B. 按 patch 合并（保留朋友那边的新提交）**
交付目录里有 `LeLeTV-v2-相对v3.6.5的改动.patch`（含二进制图标）。在朋友仓库里：

```bash
git checkout -b v2-ui
git apply --3way --binary LeLeTV-v2-相对v3.6.5的改动.patch
```

朋友的仓库如果在 cb51f54 之后又改过同一批文件，`--3way` 会留冲突标记，逐个处理即可。冲突最可能出现在 `index.html`、`app-search.js`、`app-routing.js`、`tmdb.js`。

**C. 按文件清单手工合并**
§2 的新增文件直接拷进去；修改的文件按 `git diff` 逐个看。注意顺序：先拷 `css/v2/`、`image/brand/`，再换 `index.html` / `player.html`（它们引用这些资源），最后登记 `scripts/build-bundles.mjs` 的打包清单并重新打包。

**合并后的检查点**

1. `scripts/build-bundles.mjs` 三个清单：CORE 多了 `js/ui/motion-pref.js`、`js/ui/line-probe.js`；APP 多了 `hub-flow / brand-canvas / home-shelves / hero-glass / home-recent / nav-search / pwa-install / layout-pref`；PLAYER 多了 `js/player/player-failover.js`、`js/player/player-lights.js`。
2. `index.html` head 里的两段首帧脚本（主题色 + 配色派生变量、动态效果偏好）与 `player.html` 一致。
3. 线上模式：把 `TMDB_WORKER_URL` 配回去后，先测邀请码弹框、设备面板、邀请码管理面板（这三块本地没联调）。
4. `wrangler.toml / _headers / _routes.json / functions / workers` 一个都没改，直接沿用。
5. 想删旧样式：`css/output.css pages.css player.css styles.css tailwind.css variables.css` 都没有被引用了；`package.json` 的 `build` 里 Tailwind 那一步也可以去掉。

## 9. 验证方法

自动脚本（需要正式版 Chrome，`NODE_PATH=/opt/homebrew/lib/node_modules node xxx.js`，脚本在交付目录 `04_验证脚本/`）：

| 脚本 | 覆盖 |
|---|---|
| `v3.js` | 整站：宽屏铺满、首页四行、更多入口、导航搜索、设置（开关 / 配色 / 恢复默认 / 对齐）、关于对齐、手机 |
| `res.js` | 结果页：`Q=庆余年` 搜索 → 最佳匹配 / 分段 / 货架 / 选季 / 线路 / 播放跳转 / 返回秒开，桌面 + 手机 |
| `final.js` | 搜索 → 真实播放 → 历史 → 各页截图（视频分片只放前 3 个） |
| `pwa.js` | 安装提示条、步骤弹窗、已安装不显示 |
| `motion.js` | 减少动态效果下的静止 / 强制开启 / 关闭 |
| `layout.js` | 简洁首页：关掉 / 打开三个开关、刷新首帧、手机底栏 |
| 第二轮 `logo.js` / `logo2.js` | 新 logo 在导航、页脚、关于页、弹窗徽标、PWA 横幅、闪屏、换色 canvas、集合占位、手机导航的渲染 |
| 第二轮 `glass.js` | 首屏玻璃字标：进场、静止、指针在三个方位时的高光、手机 |
| 第二轮 `buttons.js` / `invite.js` | 历史弹框、结果页按钮、手机搜索层、邀请码登录框 |
| 第二轮 `probe.js` / `probe-diag.js` / `perf.js` | 起播前预检的换线结果、最佳匹配各组线路状态、整站流畅度数字 |
| 第二轮 `lights.js` | 播放页网页全屏尺寸、关灯 / 开灯、刷新记忆、关灯下进网页全屏 |

手工清单：换一套配色看 logo、按钮、背景光、换色过渡；切私密模式看铜色与分类入口；手机横竖屏看结果页最佳匹配与底部标签栏；播放页换线路、选集、返回。

## 10. 交付物

```
2026-09-27_LeLeTV-v2改版/
├── 01_交付包/      LeLeTV-v2-完整项目-20260927.zip（不含 node_modules / .git / .env.local）、
│                   LeLeTV-v2-相对v3.6.5的改动.patch、改动清单.txt、本文档
├── 02_设计素材/    首版 logo 源文件与脚本；新logo-Le图形标/（原图、描图管线、全部 SVG / PNG 输出、对照图）
├── 03_验证截图/    各轮回归截图、首页完整长图；第二轮-logo与玻璃材质/
├── 04_验证脚本/    上表的 Playwright 脚本；第二轮/
├── 05_用户反馈截图/ 对话里发来的截图
└── 06_前期报告与示意稿/ 界面体检报告、结果页改版示意稿、两套 logo 压缩包
```
