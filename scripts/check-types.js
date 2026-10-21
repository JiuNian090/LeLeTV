#!/usr/bin/env node
/**
 * 类型检查封装：tsc --noEmit
 * 单独执行：node scripts/check-types.js
 */

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['tsc', '--noEmit'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error('[types] 无法启动 tsc：', result.error.message);
  console.error('[types] 先运行 npm install -D typescript');
  process.exit(1);
}

process.exit(result.status ?? 1);
