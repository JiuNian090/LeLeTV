/**
 * user-devices.js — 设备管理面板（普通用户专用）
 *
 * 显示在设置页面，用户可查看自己的邀请码和名下设备
 */

const USER_DEVICES_PANEL = {
  _isLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1',

  _inviteUrl(path) {
    const workerBase = window.__ENV__?.TMDB_WORKER_URL || '';
    if (workerBase && !this._isLocalhost) return `${workerBase}${path}`;
    return `/api${path}`;
  },

  async fetchMyDevices() {
    const auth = window.INVITE_AUTH?.getAuth();
    if (!auth) return null;

    try {
      const res = await fetch(this._inviteUrl('/invite/my-devices'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: auth.code,
          device_fingerprint: auth.device_fingerprint
        })
      });
      const data = await res.json();
      return data.ok ? data : null;
    } catch {
      return null;
    }
  },

  async render(container) {
    container.innerHTML = `
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/>
            </svg>
          </span>
          <h3 class="dash-card-title">设备管理</h3>
          <div class="flex items-center gap-1">
            <button id="userDeviceLogoutBtn" class="dash-add-btn text-xs" title="退出登录">⏻</button>
            <button id="userDeviceRefreshBtn" class="dash-add-btn" title="刷新">⟳</button>
          </div>
        </div>
        <div class="dash-card-body">
          <div id="userDeviceInfo" class="text-sm mb-3">
            <p class="text-gray-400">邀请码：<code class="text-pink-400 font-mono" id="userDeviceCode"></code></p>
            <p class="text-gray-500 text-xs mt-1">设备数 <span id="userDeviceCount" class="text-white font-semibold">0</span> / <span id="userDeviceMax">5</span></p>
          </div>
          <div id="userDeviceList" class="space-y-2">
            <p class="text-gray-500 text-sm text-center">加载中...</p>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#userDeviceRefreshBtn').addEventListener('click', () => this._refresh(container));
    container.querySelector('#userDeviceLogoutBtn').addEventListener('click', () => {
      if (window.INVITE_AUTH && confirm('确定退出登录吗？')) {
        window.INVITE_AUTH.logout();
      }
    });
    this._refresh(container);
  },

  async _refresh(container) {
    const data = await this.fetchMyDevices();
    const listEl = container.querySelector('#userDeviceList');
    const codeEl = container.querySelector('#userDeviceCode');
    const countEl = container.querySelector('#userDeviceCount');
    const maxEl = container.querySelector('#userDeviceMax');

    if (!data) {
      listEl.innerHTML = '<p class="text-gray-500 text-sm text-center">加载失败</p>';
      return;
    }

    if (codeEl) codeEl.textContent = data.code;
    if (countEl) countEl.textContent = data.device_count;
    if (maxEl) maxEl.textContent = data.max_devices;

    if (data.devices.length === 0) {
      listEl.innerHTML = '<p class="text-gray-500 text-sm text-center">暂无设备</p>';
      return;
    }

    listEl.innerHTML = data.devices.map(d => `
      <div class="flex justify-between items-center bg-[#1a1a1a] rounded-lg px-3 py-2 border border-[#333]">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-gray-400 text-sm">${_deviceIcon(d.browser)}</span>
          <span class="text-white text-sm truncate">${d.device_name}</span>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <span class="text-xs text-gray-500">${d.browser || ''}</span>
          <span class="text-xs text-gray-500">${_timeAgo(d.last_active_at)}</span>
        </div>
      </div>
    `).join('');
  }
};

function _deviceIcon(browser) {
  if (!browser) return '📱';
  if (browser.includes('Chrome')) return '🌐';
  if (browser.includes('Firefox')) return '🦊';
  if (browser.includes('Safari')) return '🧭';
  if (browser.includes('Edge')) return '🌙';
  return '📱';
}

window.USER_DEVICES_PANEL = USER_DEVICES_PANEL;
