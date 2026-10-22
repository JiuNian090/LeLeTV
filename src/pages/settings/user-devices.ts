/**
 * user-devices.js — 设备管理面板（普通用户专用）
 *
 * 显示在设置页面，用户可查看自己的邀请码和名下设备
 */

interface DeviceInfo {
  device_fingerprint?: string;
  device_name?: string;
  browser?: string;
  last_active_at?: number;
  [key: string]: unknown;
}

interface MyDevicesResponse {
  ok?: boolean;
  code?: string;
  device_count?: number;
  max_devices?: number;
  devices?: DeviceInfo[];
  [key: string]: unknown;
}

interface InviteAuthApi {
  getAuth: () => { code?: string; device_fingerprint?: string } | null | undefined;
  computeDeviceSignature: (name: string) => Promise<string>;
  updateLocalDeviceName: (name: string, signature: string) => void;
  logout: () => void;
}

interface UserDevicesWindow extends Window {
  __ENV__?: { TMDB_WORKER_URL?: string };
  INVITE_AUTH?: InviteAuthApi;
  USER_DEVICES_PANEL?: unknown;
}

const devicesWindow = window as UserDevicesWindow;
// 跨 bundle：邀请码服务 / toast 由首屏 bundle 提供
const showToast = (window as Window & { showToast: (message: string, type?: string) => void }).showToast;

function uiIcon(name: 'refresh' | 'logout' | 'pencil' | 'close'): string {
  const paths = {
    refresh: '<path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
    pencil: '<path d="m14.5 5.5 4 4M4 20l4.2-.9L20 7.3a1.8 1.8 0 0 0 0-2.6l-.7-.7a1.8 1.8 0 0 0-2.6 0L4.9 15.8 4 20Z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
}

function escapeText(value: unknown): string {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const USER_DEVICES_PANEL = {
  _inviteUrl(path: string): string {
    const workerBase = devicesWindow.__ENV__?.TMDB_WORKER_URL || '';
    if (workerBase) return `${workerBase}${path}`;
    return `/api${path}`;
  },

  async fetchMyDevices() {
    const auth = INVITE_AUTH?.getAuth();
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
      const data: MyDevicesResponse = await res.json();
      return data.ok ? data : null;
    } catch {
      return null;
    }
  },

  async removeDevice(targetFingerprint: string) {
    const auth = INVITE_AUTH?.getAuth();
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
      const data: MyDevicesResponse = await res.json();
      return data.ok;
    } catch {
      return false;
    }
  },

  async renameDevice(newName: string) {
    const authApi = devicesWindow.INVITE_AUTH;
    const auth = authApi?.getAuth();
    if (!authApi || !auth) return false;

    // 签名叠加了设备名：改名后必须重算并上报，否则「设备 ID 丢失找回」会对不上
    let newSignature = '';
    try {
      newSignature = await authApi.computeDeviceSignature(newName);
    } catch {
      newSignature = '';
    }

    try {
      const res = await fetch(this._inviteUrl('/invite/rename-device'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: auth.code,
          device_fingerprint: auth.device_fingerprint,
          new_name: newName,
          new_signature: newSignature
        })
      });
      const data: MyDevicesResponse = await res.json();
      if (data.ok) {
        devicesWindow.INVITE_AUTH?.updateLocalDeviceName(newName, newSignature);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  async render(container: HTMLElement) {
    container.innerHTML = `
      <div class="dash-card user-device-panel">
        <div class="dash-card-header">
          <span class="dash-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/>
            </svg>
          </span>
          <h3 class="dash-card-title">设备管理<span class="dash-card-desc">查看当前账号的登录设备，可重命名或移除</span></h3>
          <div class="header-actions">
            <button type="button" id="userDeviceShareBtn" class="header-btn" title="分享邀请信息" aria-label="分享邀请信息">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/>
              </svg>
            </button>
            <button type="button" id="userDeviceRefreshBtn" class="header-btn" title="刷新" aria-label="刷新">${uiIcon('refresh')}</button>
            <button type="button" id="userDeviceLogoutBtn" class="header-btn" title="退出登录" aria-label="退出登录">${uiIcon('logout')}</button>
          </div>
        </div>
        <div class="dash-card-body">
          <div class="user-device-overview">
            <div class="user-device-overview-main">
              <span class="user-device-label">我的邀请码</span>
              <code class="invite-code-text" id="userDeviceCode" title="点击复制邀请码"></code>
            </div>
            <span class="user-device-count"><strong id="userDeviceCount">0</strong><span class="user-device-sep">/</span><span id="userDeviceMax">5</span> 台设备</span>
          </div>
          <div id="userDeviceList" class="user-device-list">
            <p class="invite-loading">正在读取设备…</p>
          </div>
        </div>
      </div>
    `;

    // 分享邀请信息：与关于页「分享」按钮同一入口（移动端系统分享 / 桌面端复制）
    container.querySelector('#userDeviceShareBtn')?.addEventListener('click', function () {
      if (typeof window.shareInviteInfo === 'function') window.shareInviteInfo();
    });

    container.querySelector('#userDeviceRefreshBtn')?.addEventListener('click', async function clickRefresh(this: HTMLElement) {
      const btn = this;
      btn.classList.add('refreshing');
      await USER_DEVICES_PANEL._refresh(container);
      btn.classList.remove('refreshing');
      btn.blur();
      showToast('已刷新', 'success');
    });
    container.querySelector('#userDeviceLogoutBtn')?.addEventListener('click', () => {
      const auth = devicesWindow.INVITE_AUTH;
      if (auth && confirm('确定退出登录吗？')) {
        auth.logout();
      }
    });
    this._refresh(container);
  },

  async _refresh(container: HTMLElement) {
    const data = await this.fetchMyDevices();
    const listEl = container.querySelector('#userDeviceList');
    const codeEl = container.querySelector<HTMLElement>('#userDeviceCode');
    const countEl = container.querySelector('#userDeviceCount');
    const maxEl = container.querySelector('#userDeviceMax');
    const currentFingerprint = INVITE_AUTH?.getAuth()?.device_fingerprint;
    if (!listEl) return;

    if (!data) {
      listEl.innerHTML = '<div class="user-device-empty">加载失败，请点击右上角刷新重试</div>';
      return;
    }

    if (codeEl) {
      const code = data.code || '';
      codeEl.textContent = code;
      codeEl.dataset.code = code;
    }
    if (countEl) countEl.textContent = data.device_count != null ? String(data.device_count) : '';
    if (maxEl) maxEl.textContent = data.max_devices != null ? String(data.max_devices) : '';

    const devices = data.devices || [];
    if (devices.length === 0) {
      listEl.innerHTML = '<div class="user-device-empty">暂无登录设备</div>';
      return;
    }

    listEl.innerHTML = devices.map((d: DeviceInfo) => {
      const isCurrent = !!d.device_fingerprint && d.device_fingerprint === currentFingerprint;
      const name = escapeText(d.device_name || '未知设备');
      const fp = escapeText(d.device_fingerprint);
      return `
      <div class="user-device-item ${isCurrent ? 'is-current' : ''}">
        <div class="user-device-main">
          ${isCurrent
            ? `<span class="invite-name-editable" data-fp="${fp}" data-name="${name}" title="点击修改设备名">${_deviceIcon(d.browser)} ${name}<span class="invite-rename-icon">${uiIcon('pencil')}</span></span>`
            : `<span class="user-device-name">${_deviceIcon(d.browser)} ${name}</span>`}
          ${isCurrent ? '<span class="invite-status-badge invite-status-active"><i class="invite-status-dot"></i>本机</span>' : ''}
        </div>
        <div class="user-device-side">
          <span class="user-device-time">${d.last_active_at != null ? _timeAgo(d.last_active_at) : '从未'}</span>
          <button type="button" class="invite-icon-btn ${isCurrent ? '' : 'invite-action-btn-danger'} del-device-btn" data-fp="${fp}" data-current="${isCurrent}" title="${isCurrent ? '退出登录' : '删除设备'}" aria-label="${isCurrent ? '退出登录' : '删除设备'}">${uiIcon(isCurrent ? 'logout' : 'close')}</button>
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
    listEl.querySelectorAll<HTMLElement>('.del-device-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fp = btn.dataset.fp;
        if (!fp) return;
        const isCurrent = btn.dataset.current === 'true';
        
        if (isCurrent) {
          const auth = devicesWindow.INVITE_AUTH;
          if (auth) auth.logout();
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
    listEl.querySelectorAll<HTMLElement>('.invite-name-editable').forEach(el => {
      el.addEventListener('click', function onClickEdit() {
        const fp = this.dataset.fp;
        if (!fp) return;

        const currentName = this.dataset.name || '';
        const originalHtml = this.innerHTML;

        // 替换为输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'invite-name-input';
        input.value = currentName;
        input.maxLength = 30;

        this.innerHTML = '';
        this.appendChild(input);
        input.focus();
        input.select();

        let settled = false;
        const restore = () => {
          if (settled) return;
          settled = true;
          this.innerHTML = originalHtml;
        };
        const save = async () => {
          if (settled) return;
          const val = input.value.trim();
          if (!val || val === currentName) {
            restore();
            return;
          }
          settled = true;
          const ok = await USER_DEVICES_PANEL.renameDevice(val);
          if (ok) {
            showToast('设备名已更新', 'success');
            USER_DEVICES_PANEL._refresh(container);
          } else {
            showToast('修改失败', 'error');
            this.innerHTML = originalHtml;
          }
        };

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          else if (e.key === 'Escape') { restore(); }
        });
        input.addEventListener('blur', save);
      });
    });
  }
};

export function _timeAgo(ts: number): string {
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

export function _deviceIcon(browser?: string): string {
  if (!browser) return '📱';
  if (browser.includes('Chrome')) return '🌐';
  if (browser.includes('Firefox')) return '🦊';
  if (browser.includes('Safari')) return '🧭';
  if (browser.includes('Edge')) return '🌙';
  return '📱';
}

devicesWindow.USER_DEVICES_PANEL = USER_DEVICES_PANEL;

// 阶段 5A-5 过渡期兼容桥：settings bundle 切 ESM 入口后，
// admin-panel 仍以裸名复用这两个 helper。5B 改为 import 后删除本段。
Object.assign(window, {
  _timeAgo,
  _deviceIcon,
});
