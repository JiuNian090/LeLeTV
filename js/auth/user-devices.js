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

  async removeDevice(targetFingerprint) {
    const auth = window.INVITE_AUTH?.getAuth();
    if (!auth) return false;

    try {
      const res = await fetch(this._inviteUrl('/invite/remove-device'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: auth.code,
          device_fingerprint: auth.device_fingerprint,
          target_fingerprint: targetFingerprint
        })
      });
      const data = await res.json();
      return data.ok;
    } catch {
      return false;
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
          <div class="header-actions">
            <button id="userDeviceRefreshBtn" class="header-btn" title="刷新">⟳</button>
            <button id="userDeviceLogoutBtn" class="header-btn" title="退出登录">⏻</button>
          </div>
        </div>
        <div class="dash-card-body">
          <div id="userDeviceInfo" class="invite-card-meta" style="margin-top:0;margin-bottom:0.5rem;">
            <span>邀请码：<code class="invite-code-text" style="font-size:0.8rem;" id="userDeviceCode"></code></span>
            <span>设备数 <strong id="userDeviceCount" style="color:#fff;">0</strong> / <span id="userDeviceMax">5</span></span>
          </div>
          <div id="userDeviceList" class="invite-code-list">
            <p class="text-gray-500 text-sm text-center py-4">加载中...</p>
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
    const currentFingerprint = window.INVITE_AUTH?.getAuth()?.device_fingerprint;

    if (!data) {
      listEl.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">加载失败</p>';
      return;
    }

    if (codeEl) codeEl.textContent = data.code;
    if (countEl) countEl.textContent = data.device_count;
    if (maxEl) maxEl.textContent = data.max_devices;

    if (data.devices.length === 0) {
      listEl.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">暂无设备</p>';
      return;
    }

    listEl.innerHTML = data.devices.map(d => {
      const isCurrent = d.device_fingerprint && d.device_fingerprint === currentFingerprint;
      return `
      <div class="invite-card" style="margin-bottom:0.35rem;">
        <div class="invite-card-top">
          <div>
            <span class="invite-device-name" style="font-size:0.82rem;color:#e2e8f0;">
              ${_deviceIcon(d.browser)} ${d.device_name}${isCurrent ? ' <span class="invite-status-badge invite-status-active" style="font-size:0.6rem;">当前</span>' : ''}
            </span>
          </div>
          <div class="invite-card-actions" style="display:flex;align-items:center;gap:0.3rem;flex-shrink:0;">
            <span class="text-xs text-gray-500">${_timeAgo(d.last_active_at)}</span>
            <button class="invite-action-btn ${isCurrent ? '' : 'invite-action-btn-danger'} del-device-btn" data-fp="${d.device_fingerprint}" data-current="${isCurrent}" title="${isCurrent ? '退出登录' : '删除设备'}">${isCurrent ? '退出' : '✕'}</button>
          </div>
        </div>
      </div>`;
    }).join('');

    // 绑定删除/退出事件
    listEl.querySelectorAll('.del-device-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fp = btn.dataset.fp;
        const isCurrent = btn.dataset.current === 'true';
        
        if (isCurrent) {
          if (window.INVITE_AUTH) window.INVITE_AUTH.logout();
          return;
        }
        
        if (!confirm('确定删除该设备？删除后该设备需要重新验证邀请码。')) return;
        const ok = await this.removeDevice(fp);
        if (ok) {
          showToast('设备已删除', 'success');
          this._refresh(container);
        } else {
          showToast('删除失败', 'error');
        }
      });
    });
  }
};

function _timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';

  const MS_MIN = 60000;
  const MS_HOUR = 3600000;
  const MS_DAY = 86400000;
  const MS_WEEK = 604800000;

  const weeks = Math.floor(diff / MS_WEEK);
  const days = Math.floor((diff % MS_WEEK) / MS_DAY);
  const hours = Math.floor((diff % MS_DAY) / MS_HOUR);
  const minutes = Math.floor((diff % MS_HOUR) / MS_MIN);

  const parts = [];
  if (weeks > 0) parts.push(`${weeks}周`);
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);

  return parts.slice(0, 2).join('') + '前';
}

function _deviceIcon(browser) {
  if (!browser) return '📱';
  if (browser.includes('Chrome')) return '🌐';
  if (browser.includes('Firefox')) return '🦊';
  if (browser.includes('Safari')) return '🧭';
  if (browser.includes('Edge')) return '🌙';
  return '📱';
}

window.USER_DEVICES_PANEL = USER_DEVICES_PANEL;
