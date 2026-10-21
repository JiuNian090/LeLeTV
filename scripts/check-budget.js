#!/usr/bin/env node
/**
 * bundle 体积预算（REFACTOR_PLAN 阶段 1 / 3）
 *
 * 阶段 5B-4 起构建启用 ESM splitting：入口文件之外还有共享 chunk。
 * 本脚本从 dist/.build-meta.json 读取真实 import 图：
 *   - 单 bundle 预算按入口文件自身大小（防止单个入口悄悄变胖）
 *   - 首屏预算按 core + app 的依赖闭包并集（含共享 chunk，只计一次）
 * 没有 metafile 时回退为入口文件大小。
 */

import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';

// 单位 KB（1024 字节）；超预算即失败
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

let meta = null;
try {
  meta = JSON.parse(fs.readFileSync(path.join(DIST, '.build-meta.json'), 'utf8'));
} catch {
  console.warn('[budget] 缺少 .build-meta.json，回退为入口文件大小（先运行 npm run build）');
}

const files = fs.readdirSync(DIST).filter(f => f.endsWith('.js'));
const errors = [];

/** 入口名 → metafile 输出键（dist/xxx.js） */
function metaKey(prefix) {
  if (!meta || !meta.entries) return null;
  return meta.entryMeta[prefix] || null;
}

/** 递归收集一个输出键的依赖闭包（含自身） */
function closure(key) {
  const seen = new Set();
  function walk(k) {
    if (!k || seen.has(k)) return;
    const info = meta.outputs[k];
    if (!info) return;
    seen.add(k);
    for (const imp of info.imports || []) {
      if (imp.kind !== 'import-statement') continue;
      walk(imp.path);
    }
  }
  walk(key);
  return seen;
}

function kb(bytes) {
  return bytes / 1024;
}

let firstScreenTotal = 0;

for (const budget of BUDGETS) {
  const file = files.find(f => f.startsWith(budget.prefix + '.'));
  if (!file) {
    console.warn(`[budget] 缺少产物：${budget.prefix}.*.js`);
    continue;
  }
  const size = fs.statSync(path.join(DIST, file)).size;
  const entryKb = kb(size);
  const ok = entryKb <= budget.max;
  const key = metaKey(budget.prefix);
  const deps = key ? closure(key) : null;
  const closureKb = deps
    ? kb([...deps].reduce((sum, k) => sum + (meta.outputs[k]?.bytes || 0), 0))
    : entryKb;
  console.log(`[budget] ${budget.prefix}: ${entryKb.toFixed(1)} KB 入口 / ${closureKb.toFixed(1)} KB 闭包 / ${budget.max} KB ${ok ? 'OK' : 'OVER'}`);
  if (!ok) errors.push(`${budget.prefix} 入口 ${entryKb.toFixed(1)} KB 超过 ${budget.max} KB`);
}

if (meta) {
  const coreKey = metaKey('leletv-core');
  const appKey = metaKey('leletv-app');
  if (coreKey && appKey) {
    const first = new Set([...closure(coreKey), ...closure(appKey)]);
    firstScreenTotal = [...first].reduce((sum, k) => sum + (meta.outputs[k]?.bytes || 0), 0);
  }
}

if (firstScreenTotal) {
  const value = kb(firstScreenTotal);
  const ok = value <= FIRST_SCREEN_MAX;
  console.log(`[budget] 首屏 core+app（含共享 chunk）: ${value.toFixed(1)} KB / ${FIRST_SCREEN_MAX} KB ${ok ? 'OK' : 'OVER'}`);
  if (!ok) errors.push(`首屏 ${value.toFixed(1)} KB 超过 ${FIRST_SCREEN_MAX} KB`);
}

if (errors.length) {
  console.error('\n[budget] FAIL');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

console.log('[budget] OK');
