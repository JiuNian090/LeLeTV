import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub';

const legacyRelative = { title: '旧记录', url: 'player.html?url=https%3A%2F%2Fexample.com%2Fa.m3u8', timestamp: 1 };
const legacyAbsolute = { title: '旧记录2', url: 'https://example.com/player.html?url=x', timestamp: 2 };
const directLink = { title: '直链', url: 'https://example.com/a.m3u8', timestamp: 3 };
const currentEntry = { title: '新记录', url: 'src/pages/player/index.html?url=x', timestamp: 4 };

localStorage.setItem('viewingHistory', JSON.stringify([legacyRelative, legacyAbsolute, directLink, currentEntry]));
localStorage.setItem('hidden::viewingHistory', JSON.stringify([legacyRelative]));

// 模块顶层执行迁移，必须在写入 localStorage 之后再导入
const migration = await import('../../src/services/migrate-player-url');

test('正常域与私密域的旧播放页链接都会被改写', () => {
  const normal = JSON.parse(localStorage.getItem('viewingHistory') || '[]') as Array<{ url: string }>;
  assert.deepEqual(normal.map(entry => entry.url), [
    'src/pages/player/index.html?url=https%3A%2F%2Fexample.com%2Fa.m3u8',
    'https://example.com/src/pages/player/index.html?url=x',
    'https://example.com/a.m3u8',
    'src/pages/player/index.html?url=x',
  ]);

  const hidden = JSON.parse(localStorage.getItem('hidden::viewingHistory') || '[]') as Array<{ url: string }>;
  assert.equal(hidden[0].url, 'src/pages/player/index.html?url=https%3A%2F%2Fexample.com%2Fa.m3u8');
});

test('迁移幂等：再次运行不会重复改写', () => {
  const before = localStorage.getItem('viewingHistory');
  migration.migrateLegacyPlayerUrls();
  assert.equal(localStorage.getItem('viewingHistory'), before);
});
