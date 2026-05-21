#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

/* ---------- 1. 读取 VERSION.txt ---------- */
const versionFilePath = path.join(ROOT, 'VERSION.txt');
if (!fs.existsSync(versionFilePath)) {
  console.error('[错误] VERSION.txt 不存在，请先手动创建版本文件');
  process.exit(1);
}

const RAW_VERSION = fs.readFileSync(versionFilePath, 'utf8').trim();
if (!RAW_VERSION) {
  console.error('[错误] VERSION.txt 内容为空，请写入版本号');
  process.exit(1);
}

console.log(`[版本读取] 当前版本: ${RAW_VERSION}`);

/* ---------- 2. 替换 HTML 中的占位符和缓存引用 ---------- */
const HTML_FILES = ['index.html', 'player.html', 'about.html', 'watch.html'];

for (const fileName of HTML_FILES) {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`[跳过] ${fileName} 不存在`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/{{LELETV_VERSION}}/g, RAW_VERSION);

  // 替换 window.__LELETV_VERSION__ 硬编码版本号
  content = content.replace(
    /(window\.__LELETV_VERSION__\s*=\s*")[^"]*(")/,
    `$1${RAW_VERSION}$2`
  );

  content = content.replace(
    /(<link[^>]*href="[^"]*\.css)(\?v=[^"]*)?("[^>]*>)/g,
    `$1?v=${RAW_VERSION}$3`
  );

  content = content.replace(
    /(<script[^>]*src="[^"]*\.js)(\?v=[^"]*)?("[^>]*>)/g,
    `$1?v=${RAW_VERSION}$3`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[${fileName}] 版本号已注入 & 缓存引用已更新`);
}

/* ---------- 3. 更新 service-worker.js 中的 CACHE_VERSION ---------- */
const swPath = path.join(ROOT, 'service-worker.js');
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');

  swContent = swContent.replace(
    /const CACHE_VERSION = '[^']*'/,
    `const CACHE_VERSION = '${RAW_VERSION}'`
  );

  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log(`[service-worker.js] CACHE_VERSION 已更新为 ${RAW_VERSION}`);
}

console.log('[完成] 版本生成脚本执行完毕');
