/**
 * 测试 runner：用 esbuild 把 scripts/test/*.test.ts 打包成临时 ESM，
 * 再交给 Node 内置 test runner 执行。
 *
 * 直接 `node --test scripts/test/*.ts` 不可行：
 *   - 源码使用 bundler 风格的无扩展名 import，Node ESM 不能解析；
 *   - 测试依赖最小 DOM 桩，必须先于目标模块求值。
 * esbuild 负责解析 import 与剥离类型，产物写到系统临时目录，不污染仓库。
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(here, 'test');
const entryPoints = readdirSync(testDir)
  .filter(name => name.endsWith('.test.ts'))
  .map(name => path.join(testDir, name));

if (entryPoints.length === 0) {
  console.error('[test] scripts/test 下没有 *.test.ts');
  process.exit(1);
}

const outdir = mkdtempSync(path.join(tmpdir(), 'leletv-tests-'));

try {
  await build({
    entryPoints,
    outdir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: 'inline',
    outExtension: { '.js': '.mjs' },
    logLevel: 'warning',
  });

  const testFiles = readdirSync(outdir)
    .filter(name => name.endsWith('.test.mjs'))
    .map(name => path.join(outdir, name));

  const result = spawnSync(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
