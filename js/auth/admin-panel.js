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
  
  async render(container) {
    container.innerHTML = `
      <div class="dash-card" id="inviteAdminCard">
        <div class="dash-card-header">
          <span class="dash-card-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>
            </svg>
          </span>
          <h3 class="dash-card-title">邀请码管理</h3>
          <button id="inviteRefreshBtn" class="dash-add-btn" title="刷新">⟳</button>
        </div>
        <div class="dash-card-body">
          <div id="inviteStats" class="flex justify-around text-center mb-4 text-sm text-gray-400">
            <div>加载中...</div>
          </div>
          <button id="inviteGenerateBtn" class="dash-btn dash-btn-green w-full mb-4">＋ 生成邀请码</button>
          <div id="inviteCodeList" class="space-y-2 max-h-80 overflow-y-auto">
            <p class="text-gray-500 text-sm text-center">点击刷新加载列表</p>
          </div>
        </div>
      </div>
    `;
    
    container.querySelector('#inviteGenerateBtn').addEventListener('click', () => this._handleGenerate(container));
    container.querySelector('#inviteRefreshBtn').addEventListener('click', () => this._refresh(container));
    this._refresh(container);
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
        <div>总邀请码 <span class="text-white font-bold">${stats.total_codes}</span></div>
        <div>活跃 <span class="text-green-400 font-bold">${stats.active_codes}</span></div>
        <div>总设备 <span class="text-blue-400 font-bold">${stats.total_devices}</span></div>
      `;
    }
    
    if (codes.length === 0) {
      listEl.innerHTML = '<p class="text-gray-500 text-sm text-center">暂无邀请码</p>';
      return;
    }
    
    listEl.innerHTML = codes.map(invite => `
      <div class="bg-[#1a1a1a] rounded-lg border border-[#333] p-3">
        <div class="flex justify-between items-center">
          <div>
            <code class="text-sm font-mono text-pink-400">${invite.code}</code>
            <button class="copy-code-btn text-xs text-gray-500 hover:text-white ml-1" data-code="${invite.code}" title="复制邀请码">📋</button>
            <span class="text-xs text-gray-500 ml-2">${_formatTime(invite.created_at)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs ${invite.is_active ? 'text-green-400' : 'text-red-400'}">
              ${invite.is_active ? '✅ 启用' : '❌ 禁用'}
            </span>
            <span class="text-xs text-gray-400">${invite.device_count}/${invite.max_devices}</span>
            <button class="text-xs text-gray-500 hover:text-white toggle-btn" data-code="${invite.code}" data-active="${invite.is_active}">
              ${invite.is_active ? '禁用' : '启用'}
            </button>
          </div>
        </div>
        ${invite.devices.length > 0 ? `
        <div class="mt-2 pl-2 border-l-2 border-gray-700 space-y-1">
          ${invite.devices.map(d => `
            <div class="flex justify-between text-xs text-gray-400">
              <span>${d.device_name}</span>
              <span>${d.browser || ''} · ${_timeAgo(d.last_active_at)}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
    `).join('');
    
    listEl.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        const isActive = btn.dataset.active === 'true';
        const success = await this.toggleCode(code, !isActive);
        if (success) this._refresh(container);
        else showToast('操作失败', 'error');
      });
    });
    
    // 复制邀请码
    listEl.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        try {
          await navigator.clipboard.writeText(code);
          showToast('邀请码已复制: ' + code, 'success');
        } catch {
          // fallback
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
  },
  
  async _handleGenerate(container) {
    const result = await this.generateCode();
    if (result.ok) {
      showToast(`邀请码已生成: ${result.code}`, 'success');
      this._refresh(container);
    } else {
      showToast(result.error || '生成失败', 'error');
    }
  }
};

function _formatTime(ts) {
  const d = new Date(ts);
  return `${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function _timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff/60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}小时前`;
  return `${Math.floor(diff/86400000)}天前`;
}

window.INVITE_ADMIN_PANEL = INVITE_ADMIN_PANEL;
