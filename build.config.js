/**
 * LeLeTV 构建配置（单一入口清单）
 *
 * 阶段 5B-5：每个 bundle 都有持久 ESM 入口，构建统一走
 * esbuild.build({ splitting: true, format: 'esm', metafile: true })。
 * 入口文件的 import 顺序即副作用执行顺序，禁止随意调整。
 */

export const BUNDLES = [
  {
    name: 'leletv-core',
    firstScreen: true,
    entry: 'src/core-entry.ts',
  },
  {
    name: 'leletv-app',
    firstScreen: true,
    entry: 'src/main.ts',
  },
  {
    name: 'leletv-category',
    firstScreen: false,
    entry: 'src/pages/category/entry.ts',
  },
  {
    name: 'leletv-settings',
    firstScreen: false,
    entry: 'src/pages/settings/entry.ts',
  },
  {
    name: 'leletv-player',
    firstScreen: false,
    entry: 'src/player-entry.ts',
  },
];

export function getBundle(name) {
  const bundle = BUNDLES.find(item => item.name === name);
  if (!bundle) throw new Error(`未知 bundle：${name}`);
  return bundle;
}
