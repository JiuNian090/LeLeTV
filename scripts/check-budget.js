#!/usr/bin/env node
/**
 * bundle 体积预算（REFACTOR_PLAN 阶段 1 / 3）
 * 预算基于阶段 0 基线（docs/BASELINE.md），允许小幅波动，防止重构期悄悄变胖。
 */

import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';

// 单位 KB（1024 字节）；超预算即失败
// 阶段 2：全局模态框/Toast 从 index.html 外置到 core bundle（约 +13 KB），
// index.html 同步减少约 21 KB；因此 core 与首屏 JS 预算按"HTML→JS 迁移"上调，
// 阶段 3 完成真正的按需加载后再收紧。
const BUDGETS = [
  { prefix: 'leletv-core', max: 55, firstScreen: true },
  { prefix: 'leletv-app', max: 240, firstScreen: true },
  { prefix: 'leletv-category', max: 30, firstScreen: false },
  { prefix: 'leletv-settings', max: 50, firstScreen: false },
  { prefix: 'leletv-player', max: 120, firstScreen: false },
];
const FIRST_SCREEN_MAX = 275;

if (!fs.existsSync(DIST)) {
  console.warn('[budget] dist/ 不存在，先运行 npm run build');
  process.exit(0);
}

const files = fs.readdirSync(DIST).filter(f => f.endsWith('.js'));
const errors = [];
let firstScreenTotal = 0;

for (const budget of BUDGETS) {
  const file = files.find(f => f.startsWith(budget.prefix + '.'));
  if (!file) {
    console.warn(`[budget] 缺少产物：${budget.prefix}.*.js`);
    continue;
  }
  const size = fs.statSync(path.join(DIST, file)).size;
  const kb = size / 1024;
  if (budget.firstScreen) firstScreenTotal += size;
  const ok = kb <= budget.max;
  console.log(`[budget] ${budget.prefix}: ${kb.toFixed(1)} KB / ${budget.max} KB ${ok ? 'OK' : 'OVER'}`);
  if (!ok) errors.push(`${budget.prefix} ${kb.toFixed(1)} KB 超过 ${budget.max} KB`);
}

if (firstScreenTotal) {
  const kb = firstScreenTotal / 1024;
  const ok = kb <= FIRST_SCREEN_MAX;
  console.log(`[budget] 首屏 core+app: ${kb.toFixed(1)} KB / ${FIRST_SCREEN_MAX} KB ${ok ? 'OK' : 'OVER'}`);
  if (!ok) errors.push(`首屏 ${kb.toFixed(1)} KB 超过 ${FIRST_SCREEN_MAX} KB`);
}

if (errors.length) {
  console.error('\n[budget] FAIL');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

console.log('[budget] OK');
