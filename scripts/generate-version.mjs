#!/usr/bin/env node

/**
 * LeLeTV 版本生成脚本
 *
 * 在构建时运行，完成以下工作：
 * 1. 生成基于当前时间戳的版本号 YYYYMMDDHHmm
 * 2. 写入 VERSION.txt
 * 3. 替换 HTML 文件中的 {{LELETV_VERSION}} 占位符
 * 4. 更新 service-worker.js 中的 CACHE_VERSION
 * 5. 为 CSS/JS 引用添加缓存失效查询参数
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');

// 原始版本号 YYYYMMDDHHmm
const RAW_VERSION = `${year}${month}${day}${hours}${minutes}`;

// 语义化版本号 vN.M.D.Z (年偏移.月.日.提交次序)
const versionYear = Math.max(1, (year - 2025) + 1);

// 从 CHANGELOG.md 统计当天已有几条记录，新版本的提交次序 = 记录数 + 1
let commitOrder = 1;
const changelogPath = path.join(ROOT, 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const todayStr = `${year}-${month}-${day}`;
  // 匹配格式：### vX.Y.Z (YYYY-MM-DD HH:MM)
  const regex = new RegExp(`\\(${todayStr}`, 'g');
  const matches = changelog.match(regex);
  if (matches) {
    commitOrder = matches.length;
  }
}

const SEMANTIC_VERSION = `v${versionYear}.${parseInt(month)}.${parseInt(day)}.${commitOrder}`;

console.log(`[版本生成] 原始: ${RAW_VERSION}  →  语义: ${SEMANTIC_VERSION}`);

/* ---------- 1. 写入 VERSION.txt ---------- */
fs.writeFileSync(path.join(ROOT, 'VERSION.txt'), RAW_VERSION, 'utf8');
console.log('[VERSION.txt] 已更新');

/* ---------- 2. 替换 HTML 中的占位符和缓存引用 ---------- */
const HTML_FILES = ['index.html', 'player.html', 'about.html', 'watch.html'];

for (const fileName of HTML_FILES) {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`[跳过] ${fileName} 不存在`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // 替换版本号占位符
  content = content.replace(/{{LELETV_VERSION}}/g, RAW_VERSION);

  // 为 CSS 引用添加缓存失效参数
  content = content.replace(
    /(<link[^>]*href="[^"]*\.css)(\?v=[^"]*)?("[^>]*>)/g,
    `$1?v=${SEMANTIC_VERSION}$3`
  );

  // 为 JS 引用添加缓存失效参数
  content = content.replace(
    /(<script[^>]*src="[^"]*\.js)(\?v=[^"]*)?("[^>]*>)/g,
    `$1?v=${SEMANTIC_VERSION}$3`
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
    `const CACHE_VERSION = '${SEMANTIC_VERSION}'`
  );

  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log(`[service-worker.js] CACHE_VERSION 已更新为 ${SEMANTIC_VERSION}`);
}

console.log('[完成] 版本生成脚本执行完毕');
