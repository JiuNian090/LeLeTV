import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub';

const cards = await import('../../src/pages/search/cards');

test('_escAttr 转义 HTML 特殊字符', () => {
  assert.equal(cards._escAttr(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('_normTitle 忽略空白、标点与大小写', () => {
  assert.equal(cards._normTitle(' 庆余年 · 第一季 '), '庆余年第一季');
  assert.equal(cards._normTitle('The Office'), 'theoffice');
});

test('_mergeKey 去掉别名后缀', () => {
  assert.equal(cards._mergeKey('庆余年$庆余年第一季'), '庆余年');
  assert.equal(cards._mergeKey('庆余年（别名）'), '庆余年');
});

test('_latencyLevel / _latencyText 分档', () => {
  assert.equal(cards._latencyLevel(999), 'fast');
  assert.equal(cards._latencyLevel(1000), 'mid');
  assert.equal(cards._latencyLevel(2000), 'slow');
  assert.equal(cards._latencyLevel(undefined), '');
  assert.equal(cards._latencyText(850), '850ms');
  assert.equal(cards._latencyText(1999), '1.9s');
  assert.equal(cards._latencyText(0), '');
});

test('_chineseToNumber 解析中文与阿拉伯数字', () => {
  assert.equal(cards._chineseToNumber('十二'), 12);
  assert.equal(cards._chineseToNumber('二十'), 20);
  assert.equal(cards._chineseToNumber('3'), 3);
});

test('_extractSeasonInfo 识别第 N 季与 S 编号', () => {
  assert.deepEqual(cards._extractSeasonInfo('庆余年第二季'), { base: '庆余年', season: 2 });
  assert.deepEqual(cards._extractSeasonInfo('庆余年 第2季'), { base: '庆余年', season: 2 });
  assert.deepEqual(cards._extractSeasonInfo('庆余年 S2'), { base: '庆余年', season: 2 });
  assert.deepEqual(cards._extractSeasonInfo('庆余年'), { base: '庆余年', season: null });
});

test('_mergeResultsByTitle 同名同年合并、不同年份分组', () => {
  const items = [
    { vod_name: '庆余年', vod_year: '2019', source_code: 'a' },
    { vod_name: '庆余年', vod_year: '2019', source_code: 'b' },
    { vod_name: '庆余年', vod_year: '2024', source_code: 'c' },
  ];
  const groups = cards._mergeResultsByTitle(items);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[1].items.length, 1);
});

test('_sourceFastestLatency 取每源最快耗时', () => {
  assert.deepEqual(cards._sourceFastestLatency([
    { source_code: 'a', source_latency: 500 },
    { source_code: 'a', source_latency: 300 },
    { source_code: 'b', source_latency: 900 },
  ]), { a: 300, b: 900 });
});

test('_orderSourcesByLatency 已知延迟优先，未知交给 fallback', () => {
  assert.deepEqual(cards._orderSourcesByLatency(['x', 'a', 'b'], { a: 200, b: 100 }, ids => ids), ['b', 'a', 'x']);
});

test('_sortResultsByLatencyThenName 快源在前', () => {
  const sorted = cards._sortResultsByLatencyThenName([
    { vod_name: 'Z', source_code: 'slow', source_latency: 2000 },
    { vod_name: 'A', source_code: 'fast', source_latency: 100 },
  ]);
  assert.deepEqual(sorted.map(r => r.source_code), ['fast', 'slow']);
});

test('generateSkeletonCards 生成指定数量', () => {
  const html = cards.generateSkeletonCards(3);
  assert.equal((html.match(/v2-skel/g) || []).length, 3);
});
