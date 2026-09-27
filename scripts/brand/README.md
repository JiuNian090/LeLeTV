# 品牌图生产管线

`image/brand/` 与 `image/splash/` 下的位图不要手工改，用这里的脚本重出。
换 logo 颜色、调 logo 占比、加新机型启动图都走同一条路径。

## 源文件

| 源 | 用途 |
|---|---|
| `image/brand/leletv-favicon.svg` | 浏览器标签页图标（1024×1024，圆角底 + Le + 氛围光晕） |
| `image/brand/leletv-app-icon.svg` | PWA 图标 / apple-touch-icon 的母版 |
| `image/brand/leletv-app-icon-maskable.svg` | maskable 图标母版（Le 缩到安全区内、满幅底色） |

三个 SVG 里 Le 路径的 `fill` 就是换色点；`radialGradient` 的粉色氛围光晕**不在**换色范围内。

## 一键重出

```bash
# 按现有颜色重出全部（6 张图标 + 27 张启动图）
node scripts/brand/make-brand.mjs

# 换成别的颜色（会同时改写上面三个源 SVG 的 Le 填充）
node scripts/brand/make-brand.mjs --color '#FFFFFF'

# 换色 + 顺手升缓存版本号
node scripts/brand/make-brand.mjs --color '#FFFFFF' --bump le3
```

产出：

| 文件 | 尺寸 | 背景 |
|---|---|---|
| `favicon-32.png` | 32×32 | 透明（四角留空） |
| `apple-touch-icon-180.png` | 180×180 | 透明 |
| `leletv-icon-192.png` / `leletv-icon-512.png` | 192 / 512 | 透明 |
| `leletv-icon-maskable-192.png` / `-512.png` | 192 / 512 | 满幅 |
| `image/splash/*.png` | 27 种（iPhone 11 + iPad 16） | 纯黑底 + 居中 logo |

## 单独用某个脚本

```bash
# SVG → PNG（系统 Chrome headless 截图；不装 playwright）
node scripts/brand/render-svg.mjs <svg> <out.png> <宽> <高> [transparent|#RRGGBB] ...

# 真彩 PNG → 256 色调色板（图标必须做，否则体积涨约 10 倍；黑底启动图不需要）
node scripts/brand/quantize.mjs <in.png> <out.png> [色数]

# 启动图（黑底居中合成）
node scripts/brand/gen-splash.mjs <logo.png> [ratio] <输出目录>

# 核对颜色分布（粉/白像素占比、透明比例、主色）
node scripts/brand/png-info.mjs image/brand/*.png

# 升缓存版本号（?v=leN）
node scripts/brand/bump-version.mjs le3 [--dry-run]
```

Chrome 不在默认路径时用 `CHROME_PATH` 指定。

## 几个必须知道的点

1. **图标一定要量化**。Chrome 渲染出的是真彩，同一张 512 图标真彩 110KB、调色板 15KB。
   启动图是纯黑底，deflate 已经足够小，反而真彩比量化版更小。
2. **四角必须透明**。应用图标 SVG 是圆角矩形，渲染时背景给 `transparent`；
   给成 `#ffffff` 会在深色壁纸上留下一圈白角。
3. **换图必须升版本号**。服务器给图片缓存一天，不动 `?v=leN` 浏览器会继续用旧图：
   `node scripts/brand/bump-version.mjs le3`。已装 PWA 的桌面图标还需删掉重新「添加到主屏」。
4. **启动图尺寸不能猜**。`gen-splash.mjs` 里的 27 组宽高是从 `image/splash/` 实测来的
   （文件名即 `短边x长边@dpr`）。iOS 的 `<link media="...">` 按 device-width/height 精确匹配，
   差一点那个方向就回退成白屏。加新机型时从现有图量出尺寸再补一行。
5. **启动图引用不带版本号**（沿用交付方做法），所以启动屏更新依赖系统缓存过期。
6. 这些脚本只依赖 Node 内置模块 + 系统 Chrome，不引入任何 npm 依赖。
