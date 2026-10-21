#!/usr/bin/env node
/**
 * 文件全覆盖校验（REFACTOR_PLAN 5.5）
 *
 *   1. git ls-files 得到集合 A
 *   2. INVENTORY.md 登记的「原路径」得到集合 B
 *   3. A - B 非空 → 未登记文件，失败
 *   4. delete / merge → APPROVALS.md 必须有批准记录
 *   5. --strict：migrated 的目标路径必须已存在（迁移完成后启用）
 */

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');
const INVENTORY = '.agents/migration/INVENTORY.md';
const APPROVALS = '.agents/migration/APPROVALS.md';

function read(file) {
  if (!fs.existsSync(file)) {
    console.error(`[coverage] 缺少文件：${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

const tracked = execSync('git ls-files', { encoding: 'utf8', cwd: ROOT })
  .trim().split(/\r?\n/).filter(Boolean);

const inventory = read(INVENTORY);
const approvals = read(APPROVALS);

const rows = [];
for (const line of inventory.split(/\r?\n/)) {
  if (!/^\| \d+ \| `/.test(line)) continue;
  const cells = line.split('|').map(s => s.trim());
  const clean = v => (v || '').replace(/^`|`$/g, '');
  rows.push({
    path: clean(cells[2]),
    type: cells[4],
    target: clean(cells[5]),
    approval: cells[7],
  });
}

const trackedSet = new Set(tracked);
const inventorySet = new Set(rows.map(r => r.path));
const duplicated = rows.map(r => r.path).filter((p, i, arr) => arr.indexOf(p) !== i);
const missing = tracked.filter(p => !inventorySet.has(p));
const extra = rows.map(r => r.path).filter(p => !trackedSet.has(p));

const errors = [];
if (duplicated.length) errors.push(`INVENTORY 存在重复条目：${[...new Set(duplicated)].join('、')}`);
if (missing.length) errors.push(`存在未登记文件（A - B）：\n  ${missing.join('\n  ')}`);
if (extra.length) errors.push(`INVENTORY 登记了未跟踪文件（B - A）：\n  ${extra.join('\n  ')}`);

for (const row of rows) {
  if (row.type !== 'delete' && row.type !== 'merge') continue;
  if (!row.approval || row.approval === '—') {
    errors.push(`${row.type} 缺少批准记录：${row.path}`);
    continue;
  }
  const line = approvals.split(/\r?\n/).find(l => l.includes(row.path));
  if (!line) errors.push(`${row.type} 未在 APPROVALS.md 登记：${row.path}`);
  else if (line.includes('待人工判定') || line.includes('未批准')) {
    errors.push(`${row.type} 仍为待判定状态：${row.path}`);
  }
}

if (STRICT) {
  for (const row of rows) {
    if (row.type !== 'migrated' || !row.target || row.target === '—') continue;
    if (!fs.existsSync(row.target)) errors.push(`migrated 目标不存在：${row.path} -> ${row.target}`);
  }
}

const counts = {};
for (const row of rows) counts[row.type] = (counts[row.type] || 0) + 1;

console.log('[coverage] tracked =', tracked.length, '| inventory =', rows.length);
console.log('[coverage] types =', JSON.stringify(counts));
if (STRICT) console.log('[coverage] strict mode: migrated 目标存在性已检查');

if (errors.length) {
  console.error('\n[coverage] FAIL');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

console.log('[coverage] OK');
