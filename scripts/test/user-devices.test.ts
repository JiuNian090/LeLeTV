import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub';

const devices = await import('../../src/pages/settings/user-devices');

test('_timeAgo 输出相对时间', () => {
  const now = Date.now();
  assert.equal(devices._timeAgo(now - 30_000), '刚刚');
  assert.equal(devices._timeAgo(now - 2 * 60_000), '2分钟前');
  assert.equal(devices._timeAgo(now - (60 + 5) * 60_000), '1小时5分钟前');
});

test('_deviceIcon 按浏览器给图标', () => {
  assert.equal(devices._deviceIcon(), '📱');
  assert.equal(devices._deviceIcon('Chrome'), '🌐');
  assert.equal(devices._deviceIcon('Firefox'), '🦊');
  assert.equal(devices._deviceIcon('Safari'), '🧭');
  assert.equal(devices._deviceIcon('Edge'), '🌙');
  assert.equal(devices._deviceIcon('Opera'), '📱');
});
