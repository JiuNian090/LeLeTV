#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function colour(code, text) {
  return process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;
}

const info = (s) => console.log(colour('0;36', `ℹ ${s}`));
const ok = (s) => console.log(colour('0;32', `✔ ${s}`));
const warn = (s) => console.log(colour('1;33', `⚡ ${s}`));
const err = (s) => console.log(colour('0;31', `✘ ${s}`));

const HOOKS_DIR = path.join(ROOT, '.git', 'hooks');
const PRE_COMMIT_HOOK = `#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function info(msg) {
  console.log(\`\\x1b[0;36m[pre-commit] \${msg}\\x1b[0m\`);
}

function ok(msg) {
  console.log(\`\\x1b[0;32m[pre-commit] ✔ \${msg}\\x1b[0m\`);
}

function warn(msg) {
  console.log(\`\\x1b[1;33m[pre-commit] ⚡ \${msg}\\x1b[0m\`);
}

function err(msg) {
  console.log(\`\\x1b[0;31m[pre-commit] ✘ \${msg}\\x1b[0m\`);
}

try {
  const stagedFiles = run('git diff --cached --name-only').split('\\n').filter(Boolean);

  // 1. 版本号同步：VERSION.txt 变更时，把版本号注入 HTML / service-worker
  if (stagedFiles.includes('VERSION.txt')) {
    info('检测到 VERSION.txt 变更，开始同步版本号...');
    const syncScript = path.join(ROOT, 'scripts', 'generate-version.mjs');
    if (!fs.existsSync(syncScript)) {
      warn(\`generate-version.mjs 不存在: \${syncScript}\`);
    } else {
      execSync(\`node "\${syncScript}"\`, { cwd: ROOT, stdio: 'inherit' });
      const filesToStage = ['index.html', 'player.html', 'service-worker.js']
        .filter(f => fs.existsSync(path.join(ROOT, f)));
      if (filesToStage.length > 0) {
        run(\`git add \${filesToStage.join(' ')}\`);
        ok(\`已重新暂存: \${filesToStage.join(', ')}\`);
      }
    }
  }

  // 2. Bundle 自动构建：检测到 js/ 变更但 dist/ 未暂存时，自动构建 bundle
  //    避免开发者忘记 npm run build 导致线上 dist 产物过时
  const jsChanged = stagedFiles.some(f => f.startsWith('js/'));
  const distChanged = stagedFiles.some(f => f.startsWith('dist/'));
  if (jsChanged && !distChanged) {
    info('检测到 js/ 变更但 dist/ 未暂存，自动构建 bundle...');
    try {
      execSync('node scripts/build-bundles.mjs', { cwd: ROOT, stdio: 'inherit' });
      // build-bundles.mjs 内部已自动 git add dist/ index.html player.html
      ok('已自动构建 bundle 并暂存 dist/ 与 HTML 引用');
    } catch (e) {
      err('bundle 构建失败，请手动运行 npm run build 排查错误');
      err(\`错误: \${e.message}\`);
      process.exit(1);
    }
  }

} catch (e) {
  err(\`pre-commit 失败: \${e.message}\`);
  process.exit(1);
}
`;

function main() {
  if (!fs.existsSync(HOOKS_DIR)) {
    err('.git/hooks 目录不存在，请先初始化 git 仓库');
    process.exit(1);
  }

  const preCommitPath = path.join(HOOKS_DIR, 'pre-commit');
  const backupPath = path.join(HOOKS_DIR, 'pre-commit.backup');

  if (fs.existsSync(preCommitPath)) {
    const existingContent = fs.readFileSync(preCommitPath, 'utf8');
    // 用 'build-bundles' 作为新版本 hook 的标志
    if (existingContent.includes('build-bundles')) {
      info('pre-commit 钩子已是最新版本（含 bundle 自动构建），跳过安装');
      process.exit(0);
    }
    warn('检测到旧版 pre-commit 钩子，已备份到 pre-commit.backup');
    fs.writeFileSync(backupPath, existingContent, 'utf8');
  }

  fs.writeFileSync(preCommitPath, PRE_COMMIT_HOOK, 'utf8');

  if (process.platform !== 'win32') {
    fs.chmodSync(preCommitPath, 0o755);
  }

  ok('pre-commit 钩子安装成功！');
  info('功能 1：VERSION.txt 变更时自动同步版本号到 HTML / service-worker');
  info('功能 2：js/ 变更但 dist/ 未暂存时，自动构建 bundle 并暂存');
}

main();
