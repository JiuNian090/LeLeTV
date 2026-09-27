#!/usr/bin/env node
/**
 * 把 SVG 渲染成指定尺寸的 PNG —— 用系统 Chrome 的 headless 截图，不依赖 playwright。
 *
 * 为什么不用 <img src="file://...">：那种方式在 file:// 页面里会被 Chromium 拦截，
 * 截出来是空白（实测 512x512 只有 1.8KB、全是背景色）。这里把 SVG 源码【内联】进 HTML
 * 再 --screenshot，不触发任何子资源加载，稳定可复现。
 *
 * 用法（5 元组可重复，bg 可省略，默认 transparent）：
 *   node scripts/brand/render-svg.mjs <svg> <out.png> <宽> <高> [bg] [<svg> <out.png> <宽> <高> [bg] ...]
 *   bg: transparent | #RRGGBB
 *
 * bg 必须按产物区分：本项目的应用图标 SVG 是圆角矩形，四角应当是透明，
 * 写成不透明背景会在深色壁纸上留下一圈白角。favicon 同样用 transparent。
 *
 * 环境变量 CHROME_PATH 可覆盖 Chrome 位置（默认 Windows 安装路径）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const args = process.argv.slice(2);
const jobs = [];
for (let i = 0; i + 3 < args.length; i += 5) {
  jobs.push({
    svg: args[i],
    out: args[i + 1],
    w: Number(args[i + 2]),
    h: Number(args[i + 3]),
    bg: args[i + 4] || 'transparent',
  });
}
if (!jobs.length) {
  console.error('用法: node scripts/brand/render-svg.mjs <svg> <out.png> <宽> <高> [bg] [...]');
  process.exit(2);
}
if (!fs.existsSync(CHROME)) {
  console.error('找不到 Chrome:', CHROME, '（用 CHROME_PATH 指定）');
  process.exit(1);
}

// 中间 HTML 放系统临时目录，不落到仓库里
const TMP = path.join(os.tmpdir(), 'leletv-brand-render');
fs.mkdirSync(TMP, { recursive: true });
const htmlPath = path.join(TMP, 'render.html');

function buildHtml(svgSrc, w, h, bg) {
  // 去掉根上写死的 width/height，尺寸交给 CSS；保留 viewBox 作为坐标系
  const svg = svgSrc.replace(/<svg\b[^>]*>/, (tag) =>
    tag.replace(/\s(?:width|height)="[^"]*"/g, ''));
  return `<!doctype html><meta charset="utf-8">
<style>
html,body{margin:0;padding:0;overflow:hidden;background:${bg === 'transparent' ? 'transparent' : bg}}
svg{display:block;width:${w}px;height:${h}px}
</style>
${svg}
`;
}

for (const job of jobs) {
  const svgSrc = fs.readFileSync(job.svg, 'utf8');
  fs.writeFileSync(htmlPath, buildHtml(svgSrc, job.w, job.h, job.bg), 'utf8');

  const outAbs = path.resolve(job.out);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  if (fs.existsSync(outAbs)) fs.unlinkSync(outAbs);

  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    // 文档默认背景透明：页面背景只由上面的 CSS 决定
    '--default-background-color=00000000',
    '--virtual-time-budget=2000',
    `--window-size=${job.w},${job.h}`,
    `--screenshot=${outAbs.replace(/\//g, '\\')}`,
    'file:///' + htmlPath.replace(/\\/g, '/'),
  ], { stdio: 'pipe' });

  if (!fs.existsSync(outAbs)) {
    console.error('渲染失败，未产出文件:', outAbs);
    process.exit(1);
  }
  console.log(`  ${path.basename(outAbs).padEnd(30)} ${job.w}x${job.h}`
    + `  bg=${job.bg.padEnd(11)} ${(fs.statSync(outAbs).size / 1024).toFixed(1)}KB`);
}
