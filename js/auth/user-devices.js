/**
 * user-devices.js — 设备管理面板（普通用户专用）
 *
 * 显示在设置页面，用户可查看自己的邀请码和名下设备
 */

const USER_DEVICES_PANEL = {
  _inviteUrl(path) {
    const workerBase = window.__ENV__?.TMDB_WORKER_URL || '';
    if (workerBase) return `${workerBase}${path}`;
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

  async renameDevice(newName) {
    const auth = window.INVITE_AUTH?.getAuth();
    if (!auth) return false;

    try {
      const res = await fetch(this._inviteUrl('/invite/rename-device'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: auth.code,
          device_fingerprint: auth.device_fingerprint,
          new_name: newName
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
            <span>邀请码：<code class="invite-code-text" style="font-size:0.8rem;cursor:pointer;" id="userDeviceCode" title="点击复制"></code></span>
            <span>设备数 <strong id="userDeviceCount" style="color:#fff;">0</strong> / <span id="userDeviceMax">5</span></span>
          </div>
          <div id="userDeviceList" class="invite-code-list">
            <p class="text-gray-500 text-sm text-center py-4">加载中...</p>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#userDeviceRefreshBtn').addEventListener('click', async function clickRefresh() {
      const btn = this;
      btn.classList.add('refreshing');
      await USER_DEVICES_PANEL._refresh(container);
      btn.classList.remove('refreshing');
      btn.blur();
      showToast('已刷新', 'success');
    });
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

    if (codeEl) {
      codeEl.textContent = data.code;
      codeEl.dataset.code = data.code;
    }
    if (countEl) countEl.textContent = data.device_count;
    if (maxEl) maxEl.textContent = data.max_devices;

    if (data.devices.length === 0) {
      listEl.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">暂无设备</p>';
      return;
    }

    listEl.innerHTML = data.devices.map(d => {
      const isCurrent = d.device_fingerprint && d.device_fingerprint === currentFingerprint;
      const safeName = d.device_name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
      <div class="invite-card" style="margin-bottom:0.35rem;">
        <div class="invite-card-top" style="gap:0.4rem;">
          <div class="invite-device-name" style="font-size:0.82rem;color:#e2e8f0;display:flex;align-items:center;gap:0.3rem;flex:1;min-width:0;">
            ${isCurrent
              ? `<span class="truncate invite-name-editable" data-fp="${d.device_fingerprint}" title="点击修改设备名">${_deviceIcon(d.browser)} ${safeName} <span class="invite-rename-icon">✎</span></span>`
              : `<span class="truncate">${_deviceIcon(d.browser)} ${safeName}</span>`}
            ${isCurrent ? '<span class="invite-status-badge invite-status-active" style="font-size:0.6rem;flex-shrink:0;">当前</span>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:0.3rem;flex-shrink:0;">
            <span class="text-xs text-gray-500" style="white-space:nowrap;">${_timeAgo(d.last_active_at)}</span>
            <button class="invite-action-btn ${isCurrent ? '' : 'invite-action-btn-danger'} del-device-btn" data-fp="${d.device_fingerprint}" data-current="${isCurrent}" title="${isCurrent ? '退出登录' : '删除设备'}" style="flex-shrink:0;">${isCurrent ? '退出' : '✕'}</button>
          </div>
        </div>
      </div>`;
    }).join('');

    // 邀请码点击复制（防重复绑定）
    if (codeEl && !codeEl.dataset.copyBound) {
      codeEl.dataset.copyBound = 'true';
      codeEl.addEventListener('click', async () => {
        const code = codeEl.dataset.code;
        if (!code) return;
        try {
          await navigator.clipboard.writeText(code);
          showToast('邀请码已复制', 'success');
        } catch {
          const ta = document.createElement('textarea');
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast('邀请码已复制', 'success');
        }
      });
    }

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

    // 绑定当前设备名点击编辑
    listEl.querySelectorAll('.invite-name-editable').forEach(el => {
      el.addEventListener('click', function onClickEdit() {
        const fp = this.dataset.fp;
        if (!fp) return;

        // 提取纯文本（去掉尾部的 ✎ 图标）
        let rawText = this.textContent.replace('✎', '').trim();
        const iconMatch = rawText.match(/^(\p{Emoji})\s*/u);
        const icon = iconMatch ? iconMatch[1] + ' ' : '';
        const currentName = iconMatch ? rawText.slice(icon.length) : rawText;

        // 替换为输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'invite-name-input';
        input.value = currentName;
        input.maxLength = 30;
        input.style.cssText = 'background:#1a1a2e;border:1px solid #ec4899;color:#e2e8f0;border-radius:0.25rem;padding:0.1rem 0.3rem;font-size:0.82rem;width:100%;outline:none;';

        this.innerHTML = '';
        this.appendChild(input);
        input.focus();
        input.select();

        const save = async () => {
          const val = input.value.trim();
          if (!val || val === currentName) {
            this.innerHTML = rawText + ' <span class="invite-rename-icon">✎</span>';
            return;
          }
          const ok = await USER_DEVICES_PANEL.renameDevice(val);
          if (ok) {
            showToast('设备名已更新', 'success');
            USER_DEVICES_PANEL._refresh(container);
          } else {
            showToast('修改失败', 'error');
            this.innerHTML = rawText + ' <span class="invite-rename-icon">✎</span>';
          }
        };

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          else if (e.key === 'Escape') {
            this.innerHTML = rawText + ' <span class="invite-rename-icon">✎</span>';
          }
        });
        input.addEventListener('blur', save);
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
