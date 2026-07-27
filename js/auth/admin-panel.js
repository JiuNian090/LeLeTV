/**
 * admin-panel.js — 邀请码管理面板（管理员专用）
 * 
 * 显示在设置页面，仅管理员可见
 * 功能：生成邀请码、查看列表、启用/禁用、统计数据
 */

const INVITE_ADMIN_PANEL = {
  // 本地开发环境强制走本地 API
  _isLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
  
  _baseUrl(path) {
    const workerBase = window.__ENV__?.TMDB_WORKER_URL || '';
    if (workerBase && !this._isLocalhost) {
      return `${workerBase}${path}`;
    }
    return `/api${path}`;
  },
  
  _getAdminToken() {
    try {
      const admin = JSON.parse(localStorage.getItem('leletv_admin_session') || '{}');
      return admin.token || '';
    } catch {
      return '';
    }
  },
  
  async generateCode() {
    try {
      const response = await fetch(this._baseUrl('/invite/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._getAdminToken()}`
        }
      });
      const data = await response.json();
      if (data.ok) {
        return { ok: true, code: data.code };
      }
      return { ok: false, error: data.error };
    } catch (error) {
      return { ok: false, error: '网络错误' };
    }
  },
  
  async fetchList() {
    try {
      const response = await fetch(this._baseUrl('/invite/list'), {
        headers: { 'Authorization': `Bearer ${this._getAdminToken()}` }
      });
      const data = await response.json();
      return data.ok ? data.codes : [];
    } catch {
      return [];
    }
  },
  
  async toggleCode(code, isActive) {
    try {
      const response = await fetch(this._baseUrl('/invite/toggle'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._getAdminToken()}`
        },
        body: JSON.stringify({ code, is_active: isActive })
      });
      const data = await response.json();
      return data.ok;
    } catch {
      return false;
    }
  },
  
  async fetchStats() {
    try {
      const response = await fetch(this._baseUrl('/invite/stats'), {
        headers: { 'Authorization': `Bearer ${this._getAdminToken()}` }
      });
      const data = await response.json();
      return data.ok ? data : null;
    } catch {
      return null;
    }
  },
  
  async deleteDevice(code, targetFingerprint) {
    try {
      const response = await fetch(this._baseUrl('/invite/remove-device'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._getAdminToken()}`
        },
        body: JSON.stringify({ code, device_fingerprint: '', target_fingerprint: targetFingerprint })
      });
      return (await response.json()).ok;
    } catch {
      return false;
    }
  },

  async deleteCode(code) {
    try {
      const response = await fetch(this._baseUrl('/invite/delete-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._getAdminToken()}`
        },
        body: JSON.stringify({ code })
      });
      return (await response.json()).ok;
    } catch {
      return false;
    }
  },

  async setRemark(code, remark) {
    try {
      const response = await fetch(this._baseUrl('/invite/set-remark'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._getAdminToken()}`
        },
        body: JSON.stringify({ code, remark })
      });
      return (await response.json()).ok;
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
              <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>
            </svg>
          </span>
          <h3 class="dash-card-title">邀请码管理</h3>
          <div class="header-actions">
            <button id="inviteGenerateBtn" class="gen-btn">＋ 生成</button>
            <button id="inviteRefreshBtn" class="header-btn" title="刷新">⟳</button>
            <button id="inviteAdminLogoutBtn" class="header-btn" title="退出登录">⏻</button>
          </div>
        </div>
        <div class="dash-card-body">
          <div id="inviteStats" class="invite-stats-grid">
            <div class="invite-stat-card"><div class="text-gray-500 text-xs text-center py-2">加载中...</div></div>
          </div>
          <div id="inviteCodeList" class="invite-code-list">
            <p class="text-gray-500 text-sm text-center">点击刷新加载列表</p>
          </div>
        </div>
      </div>
      <div id="inviteGenModal" class="gen-modal-overlay">
        <div class="gen-modal-box">
          <div class="gen-modal-title">生成邀请码</div>
          <input id="inviteGenRemarkInput" class="gen-modal-input" placeholder="备注（可选，如：朋友、家人）" maxlength="30" autocomplete="off">
          <div class="gen-modal-actions">
            <button id="inviteGenCancel" class="gen-modal-btn">取消</button>
            <button id="inviteGenConfirm" class="gen-modal-btn gen-modal-btn-primary">确定生成</button>
          </div>
        </div>
      </div>
    `;
    
    container.querySelector('#inviteGenerateBtn').addEventListener('click', () => this._handleGenerate(container));
    container.querySelector('#inviteRefreshBtn').addEventListener('click', async function clickRefresh() {
      const btn = this;
      btn.classList.add('refreshing');
      await INVITE_ADMIN_PANEL._refresh(container);
      btn.classList.remove('refreshing');
      btn.blur();
      showToast('已刷新', 'success');
    });
    container.querySelector('#inviteAdminLogoutBtn').addEventListener('click', () => {
      if (window.INVITE_AUTH && confirm('确定退出登录吗？')) {
        window.INVITE_AUTH.logout();
      }
    });
    // 生成弹窗事件
    container.querySelector('#inviteGenCancel').addEventListener('click', () => this._closeGenModal());
    container.querySelector('#inviteGenConfirm').addEventListener('click', () => this._confirmGenerate(container));
    // Enter 键确认
    const modalInput = container.querySelector('#inviteGenRemarkInput');
    modalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._confirmGenerate(container);
    });
    
    this._refresh(container);
  },
  
  _openGenModal() {
    const modal = document.getElementById('inviteGenModal');
    if (!modal) return;
    modal.classList.add('show');
    const input = document.getElementById('inviteGenRemarkInput');
    if (input) { input.value = ''; setTimeout(() => input.focus(), 100); }
  },
  
  _closeGenModal() {
    const modal = document.getElementById('inviteGenModal');
    if (modal) modal.classList.remove('show');
  },
  
  async _confirmGenerate(container) {
    const remark = document.getElementById('inviteGenRemarkInput')?.value?.trim() || '';
    this._closeGenModal();
    
    const result = await this.generateCode();
    if (result.ok) {
      if (remark) await this.setRemark(result.code, remark);
      const display = remark ? `${result.code}（${remark}）` : result.code;
      showToast(`邀请码已生成: ${display}`, 'success');
      this._refresh(container);
    } else {
      showToast(result.error || '生成失败', 'error');
    }
  },
  
  async _refresh(container) {
    const statsEl = container.querySelector('#inviteStats');
    const listEl = container.querySelector('#inviteCodeList');
    
    const [codes, stats] = await Promise.all([
      this.fetchList(),
      this.fetchStats()
    ]);
    
    if (stats) {
      statsEl.innerHTML = `
        <div class="invite-stat-card"><div class="invite-stat-value" style="color:#f472b6">${stats.total_codes}</div><div class="invite-stat-label">总邀请码</div></div>
        <div class="invite-stat-card"><div class="invite-stat-value" style="color:#22c55e">${stats.active_codes}</div><div class="invite-stat-label">活跃</div></div>
        <div class="invite-stat-card"><div class="invite-stat-value" style="color:#ef4444">${stats.total_codes - stats.active_codes}</div><div class="invite-stat-label">已禁用</div></div>
        <div class="invite-stat-card"><div class="invite-stat-value" style="color:#60a5fa">${stats.total_devices}</div><div class="invite-stat-label">总设备数</div></div>
      `;
    }
    
    if (codes.length === 0) {
      listEl.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">暂无邀请码</p>';
      return;
    }
    
    listEl.innerHTML = codes.map(invite => {
      const devices = invite.devices || [];
      const lastActive = devices.length > 0 ? devices[0].last_active_at : null;
      const recentDot = lastActive ? _recentDot(lastActive) : '';
      return `
      <div class="invite-card ${lastActive ? '' : 'invite-card-idle'}">
        <div class="invite-card-top">
          <div>
            <span class="invite-code-text" data-code="${invite.code}" title="点击复制">${invite.code}</span>
            ${invite.remark ? `<span class="invite-remark-text">（${invite.remark}）</span>` : ''}
          </div>
          <div class="invite-card-actions" style="display:flex;align-items:center;gap:0.3rem;flex-shrink:0;flex-wrap:wrap;">
            <span class="invite-status-badge ${invite.is_active ? 'invite-status-active' : 'invite-status-disabled'}">● ${invite.is_active ? '启用' : '禁用'}</span>
            <button class="invite-action-btn toggle-btn" data-code="${invite.code}" data-active="${invite.is_active}">${invite.is_active ? '禁用' : '启用'}</button>
            <button class="invite-action-btn remark-btn" data-code="${invite.code}" title="编辑备注">✎</button>
            <button class="invite-action-btn invite-action-btn-danger delete-code-btn" data-code="${invite.code}" title="删除">🗑️</button>
          </div>
        </div>
        <div class="invite-card-meta">
          <span>${_formatTime(invite.created_at)}</span>
          <span>设备：${invite.device_count}/${invite.max_devices}</span>
          ${lastActive ? `<span>${recentDot} 最近使用：${_timeAgo(lastActive)}</span>` : '<span class="text-gray-600">暂无使用</span>'}
        </div>
        ${devices.length > 0 ? `
        <details class="invite-devices" open>
          <summary class="invite-device-toggle">设备详情（${devices.length}）</summary>
          ${devices.map(d => `
          <div class="invite-device-item ${_isRecentlyActive(d.last_active_at) ? 'invite-device-recent' : ''}">
            <span class="invite-device-name">${_recentDot(d.last_active_at)} ${_deviceIcon(d.browser)} ${d.device_name}</span>
            <span>${_timeAgo(d.last_active_at)} <button class="invite-action-btn invite-action-btn-danger delete-device-btn" data-code="${invite.code}" data-fp="${d.device_fingerprint}" title="删除设备">✕</button></span>
          </div>
          `).join('')}
        </details>
        ` : ''}
      </div>`;
    }).join('');
    
    // 启用/禁用
    listEl.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        const isActive = btn.dataset.active === 'true';
        const success = await this.toggleCode(code, !isActive);
        if (success) this._refresh(container);
        else showToast('操作失败', 'error');
      });
    });
    
    // 点击邀请码复制
    listEl.querySelectorAll('.invite-code-text').forEach(el => {
      el.addEventListener('click', async () => {
        const code = el.dataset.code;
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
    });
    
    // 编辑备注
    listEl.querySelectorAll('.remark-btn').forEach(el => {
      el.addEventListener('click', async () => {
        const code = el.dataset.code;
        const current = el.closest('.invite-card')?.querySelector('.invite-remark-text')?.textContent?.replace(/[（）]/g, '').trim() || '';
        const remark = prompt('编辑备注（留空则清除）：', current);
        if (remark === null) return;
        const ok = await this.setRemark(code, remark.trim());
        if (ok) this._refresh(container);
        else showToast('设置失败', 'error');
      });
    });

    // 删除设备
    listEl.querySelectorAll('.delete-device-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        const fp = btn.dataset.fp;
        const deviceName = btn.closest('.invite-device-item')?.querySelector('.invite-device-name')?.textContent?.trim() || fp;
        if (!confirm(`确定删除设备「${deviceName}」？`)) return;
        const ok = await this.deleteDevice(code, fp);
        if (ok) {
          showToast('设备已删除', 'success');
          this._refresh(container);
        } else {
          showToast('删除失败', 'error');
        }
      });
    });

    // 删除邀请码
    listEl.querySelectorAll('.delete-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        if (!confirm(`确定删除邀请码「${code}」？关联的设备也将一并删除。`)) return;
        if (!confirm('此操作不可恢复，再次确认？')) return;
        const ok = await this.deleteCode(code);
        if (ok) {
          showToast('邀请码已删除', 'success');
          this._refresh(container);
        } else {
          showToast('删除失败', 'error');
        }
      });
    });
  },
  
  async _handleGenerate(container) {
    this._openGenModal();
  }
};

function _formatTime(ts) {
  const d = new Date(ts);
  return `${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

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

const _RECENT_DOT_GREEN = '<span class="invite-recent-dot" style="color:#22c55e;">●</span>';
const _RECENT_DOT_FADED = '<span class="invite-recent-dot" style="color:#22c55e80;">●</span>';
const _RECENT_DOT_YELLOW = '<span class="invite-recent-dot" style="color:#eab30880;">●</span>';

function _recentDot(ts) {
  const diff = Date.now() - ts;
  if (diff < 3600000) return _RECENT_DOT_GREEN;      // < 1h
  if (diff < 86400000) return _RECENT_DOT_FADED;     // < 24h
  if (diff < 604800000) return _RECENT_DOT_YELLOW;   // < 7d
  return '';
}

function _isRecentlyActive(ts) {
  return Date.now() - ts < 86400000;  // 24h 内
}

window.INVITE_ADMIN_PANEL = INVITE_ADMIN_PANEL;
