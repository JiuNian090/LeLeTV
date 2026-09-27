#!/usr/bin/env node
/**
 * 升级品牌图片的缓存版本号（index.html / player.html / manifest.json / css/v2/home.css 里的 ?v=leN）。
 *
 * 为什么需要：服务器给图片缓存一天，换了 image/brand 下的图却不动版本号，
 * 浏览器和已装 PWA 会继续用旧图标。
 *
 * 用法: node scripts/brand/bump-version.mjs <新版本号>     例如 le3
 *        node scripts/brand/bump-version.mjs le3 --dry-run  只报告不改
 */
import fs from 'node:fs';

const FILE = ['index.html', 'player.html', 'manifest.json', 'css/v2/home.css'];

const [newVersion, ...flags] = process.argv.slice(2);
if (!newVersion || !/^le\d+$/.test(newVersion)) {
  console.error('用法: node scripts/brand/bump-version.mjs <新版本号，形如 le3> [--dry-run]');
  process.exit(2);
}
const dryRun = flags.includes('--dry-run');

let total = 0;
for (const f of FILE) {
  if (!fs.existsSync(f)) { console.log(`  ${f.padEnd(22)} 不存在，跳过`); continue; }
  const s = fs.readFileSync(f, 'utf8');
  const hits = s.match(/\?v=le\d+/g) || [];
  if (!hits.length) { console.log(`  ${f.padEnd(22)} 无 ?v=leN`); continue; }
  const before = [...new Set(hits)].join(', ');
  const next = s.replace(/\?v=le\d+/g, '?v=' + newVersion);
  if (!dryRun) fs.writeFileSync(f, next, 'utf8');
  console.log(`  ${f.padEnd(22)} ${hits.length} 处  ${before} → ?v=${newVersion}${dryRun ? '  (dry-run)' : ''}`);
  total += hits.length;
}
console.log(`${dryRun ? '将' : '已'}替换 ${total} 处`);
