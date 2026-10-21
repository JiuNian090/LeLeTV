#!/usr/bin/env node
/**
 * 零引用文件检测（REFACTOR_PLAN 5.7）
 *
 * 只报告，不删除。分级：
 *   A 可自动删候选：零引用 + 不在白名单
 *   B 需人工确认：零引用 + dynamic 白名单（动态加载 / 命名疑似动态）
 *   C 明确保留：keep 白名单
 *
 * 用法：
 *   node scripts/check-orphans.js                # 报告，退出码 0
 *   node scripts/check-orphans.js --fail-on-a    # 存在 A 级时退出码 1
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import config from './orphans.config.js';

const ROOT = process.cwd();
const FAIL_ON_A = process.argv.includes('--fail-on-a');

const tracked = execSync('git ls-files', { encoding: 'utf8', cwd: ROOT })
  .trim().split(/\r?\n/).filter(Boolean);

const CANDIDATE = /\.(js|mjs|ts|tsx|css|html|svg|png|webp|jpg|jpeg|woff2|json)$/;
// 引用源：只算代码 / 页面 / 构建配置，不算文档与 AI 资产
const REF_SOURCE = /\.(js|mjs|ts|tsx|html|css|json|toml|yml|yaml|txt)$/;
const SKIP_SOURCE = [/^\.agents\//, /^docs\//];

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp('^' + escaped + '$');
}

const keepRes = config.keep.map(globToRegExp);
const dynamicRes = config.dynamic.map(globToRegExp);

const candidates = tracked.filter(p => CANDIDATE.test(p) && !p.startsWith('.agents/'));
const sourceFiles = tracked.filter(p =>
  REF_SOURCE.test(p) &&
  !SKIP_SOURCE.some(re => re.test(p))
);

const texts = new Map();
for (const file of sourceFiles) {
  try {
    texts.set(file, fs.readFileSync(path.join(ROOT, file), 'utf8'));
  } catch {
    // 二进制或不可读，跳过
  }
}

function referencedBy(target) {
  const base = path.basename(target);
  const safeBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^A-Za-z0-9_.\\-])' + safeBase + '([^A-Za-z0-9_.\\-]|$)');
  const hits = [];
  for (const [source, text] of texts) {
    if (source === target) continue;
    if (text.includes(target) || re.test(text)) hits.push(source);
  }
  return hits;
}

const A = [];
const B = [];
const C = [];

for (const target of candidates) {
  if (keepRes.some(re => re.test(target))) {
    C.push(target);
    continue;
  }
  const hits = referencedBy(target);
  if (hits.length) continue;
  if (dynamicRes.some(re => re.test(target))) B.push(target);
  else A.push(target);
}

console.log(`[orphans] 候选 ${candidates.length} 个；A=${A.length} B=${B.length} C=${C.length}`);
console.log('\nA 级（零引用，可自动删候选 —— 阶段 4.5 需人工批准）');
for (const p of A) console.log('  A ' + p);
console.log('\nB 级（零引用，但命中 dynamic 白名单 —— 人工确认）');
for (const p of B) console.log('  B ' + p);
console.log('\nC 级（keep 白名单，直接保留）');
for (const p of C) console.log('  C ' + p);

if (FAIL_ON_A && A.length) {
  console.error('\n[orphans] FAIL：存在 A 级候选');
  process.exit(1);
}
console.log('\n[orphans] 完成（阶段 4.5 前不删除任何文件）');
