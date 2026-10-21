# 构建体积基线

> 生成命令：`node scripts/analyze.js`
>
> 版本：`v4.1.2`
>
> 生成时间：2026-10-21

## 口径说明

- **入口**：esbuild 入口文件体积（不含 import 的共享 chunk）。
- **闭包**：入口及其静态 import 的全部 chunk（按 metafile 递归、去重）。
- **首屏**：`leletv-core` + `leletv-app` 闭包并集，共享 chunk 只计一次。

## 总览

| bundle | 首屏 | 入口 | 闭包 | 产物 |
|---|---|---|---|---|
| `leletv-core` | 是 | 29.7 KB | 48.4 KB | dist/leletv-core.TLP7XLZ7.js |
| `leletv-app` | 是 | 151.8 KB | 219.7 KB | dist/leletv-app.HIH44NNA.js |
| `leletv-category` | 否 | 0.2 KB | 24.8 KB | dist/leletv-category.MC4E3V2Z.js |
| `leletv-settings` | 否 | 40.4 KB | 40.6 KB | dist/leletv-settings.K6HVJ4BS.js |
| `leletv-player` | 否 | 60.9 KB | 111.8 KB | dist/leletv-player.HTLYS5FH.js |
| **首屏 core + app** | 是 | — | **253.3 KB** | 共享 chunk 去重 |

## 共享 chunk

| chunk | 体积 |
|---|---|
| `dist/chunks/chunk-WHDQFA34.js` | 1.7 KB |
| `dist/chunks/chunk-OU5FXBAD.js` | 19.1 KB |
| `dist/chunks/chunk-7Q6E6MP4.js` | 3.8 KB |
| `dist/chunks/chunk-4LHFJ6FC.js` | 33.9 KB |
| `dist/chunks/chunk-BBO4XO2U.js` | 7.6 KB |
| `dist/chunks/chunk-HUQAYQNG.js` | 5.3 KB |
| `dist/chunks/chunk-DWOYCZYJ.js` | 0.2 KB |
