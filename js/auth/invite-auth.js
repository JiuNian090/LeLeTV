/**
 * invite-auth.js — 邀请码验证与设备管理
 * 
 * 负责：
 * 1. 生成设备指纹
 * 2. 验证邀请码
 * 3. 设备心跳
 * 4. 登录状态管理
 */

const INVITE_AUTH = {
  // localStorage key
  STORAGE_KEY: 'leletv_invite_auth',
  HEARTBEAT_INTERVAL: 5 * 60 * 1000, // 5分钟
  
  _inviteUrl(path) {
    const workerBase = window.__ENV__?.TMDB_WORKER_URL || '';
    if (workerBase) {
      return `${workerBase}${path}`;
    }
    return `/api${path}`;
  },
  
  /**
   * 生成设备指纹
   * 使用非硬件级信息组合，保护隐私
   */
  async generateFingerprint() {
    const components = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      navigator.platform || ''
    ];
    const raw = components.join('||') + 'LELETV_FINGERPRINT_SALT';
    
    if (window.crypto && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(raw);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // fallback
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fp_' + Math.abs(hash).toString(16);
  },
  
  /**
   * 获取已保存的认证信息
   */
  getAuth() {
    try {
      const stored = localStorage.getItem(INVITE_AUTH.STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },
  
  /**
   * 保存认证信息
   */
  saveAuth(data) {
    localStorage.setItem(INVITE_AUTH.STORAGE_KEY, JSON.stringify({
      code: data.code,
      device_name: data.device_name,
      device_fingerprint: data.device_fingerprint,
      verified_at: Date.now()
    }));
  },
  
  /**
   * 清除认证信息（登出）
   */
  clearAuth() {
    localStorage.removeItem(INVITE_AUTH.STORAGE_KEY);
  },
  
  /**
   * 清除所有登录状态（登出），保留其他数据
   * 恢复邀请码登录界面
   */
  logout() {
    try {
      // 停止心跳
      this.stopHeartbeat();
      
      // 清除所有认证相关的 localStorage
      localStorage.removeItem(INVITE_AUTH.STORAGE_KEY);
      localStorage.removeItem('leletv_admin_session');
      localStorage.removeItem('leletv_is_admin');
      localStorage.removeItem('passwordVerified');
      
      // 隐藏管理面板
      document.getElementById('inviteAdminContainer')?.classList.add('hidden');
      document.getElementById('userDeviceContainer')?.classList.add('hidden');
      
      // 重置并显示邀请码登录弹窗
      const loginModal = document.getElementById('inviteLoginModal');
      if (loginModal) {
        // 重置错误提示
        document.getElementById('inviteLoginError')?.classList.add('hidden');
        document.getElementById('inviteDeviceName') && (document.getElementById('inviteDeviceName').value = '');
        document.getElementById('inviteCodeInput') && (document.getElementById('inviteCodeInput').value = '');
        document.getElementById('inviteLoginBtn') && (document.getElementById('inviteLoginBtn').disabled = false);
        
        loginModal.style.display = 'flex';
        
        setTimeout(() => {
          const deviceInput = document.getElementById('inviteDeviceName');
          if (deviceInput) deviceInput.focus();
        }, 150);
      }
    } catch (e) {
      console.error('退出登录出错:', e);
    }
  },
  
  /**
   * 检查是否已验证
   */
  isVerified() {
    return !!INVITE_AUTH.getAuth();
  },
  
  /**
   * 验证邀请码
   */
  async verify(code, deviceName) {
    const fingerprint = await INVITE_AUTH.generateFingerprint();
    
    try {
      const url = INVITE_AUTH._inviteUrl('/invite/verify');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          device_name: deviceName.trim(),
          device_fingerprint: fingerprint
        })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        // 管理员登录 - 不保存普通设备信息，直接存储管理员 session
        if (data.is_admin) {
          const adminToken = await sha256(code.trim().toUpperCase() + '::' + deviceName.trim());
          localStorage.setItem('leletv_admin_session', JSON.stringify({
            token: adminToken,
            verified_at: Date.now()
          }));
          localStorage.setItem('leletv_is_admin', 'true');
          document.dispatchEvent(new CustomEvent('passwordVerified'));
          return { ok: true, is_admin: true, action: 'admin', message: '管理员验证成功' };
        }
        
        INVITE_AUTH.saveAuth({
          code: code.trim().toUpperCase(),
          device_name: deviceName.trim(),
          device_fingerprint: fingerprint
        });
        
        // 启动心跳
        INVITE_AUTH.ensureHeartbeat();
        
        return { ok: true, action: data.action, message: data.message };
      }
      
      return { ok: false, error: data.error || '验证失败' };
    } catch (error) {
      console.error('邀请码验证失败:', error);
      return { ok: false, error: '网络错误，请检查后重试' };
    }
  },
  
  /**
   * 发送心跳
   */
  async heartbeat(fingerprint) {
    try {
      const url = INVITE_AUTH._inviteUrl('/invite/heartbeat');
      
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_fingerprint: fingerprint })
      });
    } catch {
      // 静默失败，不影响用户体验
    }
  },
  
  /**
   * 启动心跳定时器
   */
  startHeartbeat(fingerprint) {
    // 防止重复创建定时器和 beforeunload 监听
    if (INVITE_AUTH._heartbeatTimer) {
      clearInterval(INVITE_AUTH._heartbeatTimer);
    }
    if (INVITE_AUTH._heartbeatBound) {
      window.removeEventListener('beforeunload', INVITE_AUTH._heartbeatBound);
    }
    
    INVITE_AUTH._heartbeatTimer = setInterval(() => {
      INVITE_AUTH.heartbeat(fingerprint);
    }, INVITE_AUTH.HEARTBEAT_INTERVAL);
    
    INVITE_AUTH._heartbeatBound = () => INVITE_AUTH.heartbeat(fingerprint);
    window.addEventListener('beforeunload', INVITE_AUTH._heartbeatBound);
  },
  
  /**
   * 确保心跳运行（从 localStorage 读取指纹，页面加载时调用）
   */
  ensureHeartbeat() {
    const auth = INVITE_AUTH.getAuth();
    if (!auth || !auth.device_fingerprint) return;
    
    // 立即发送一次心跳，记录本次访问
    INVITE_AUTH.heartbeat(auth.device_fingerprint);
    
    // 启动定时心跳
    INVITE_AUTH.startHeartbeat(auth.device_fingerprint);
  },
  
  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (INVITE_AUTH._heartbeatTimer) {
      clearInterval(INVITE_AUTH._heartbeatTimer);
      INVITE_AUTH._heartbeatTimer = null;
    }
    if (INVITE_AUTH._heartbeatBound) {
      window.removeEventListener('beforeunload', INVITE_AUTH._heartbeatBound);
      INVITE_AUTH._heartbeatBound = null;
    }
  }
};

// 暴露到全局
window.INVITE_AUTH = INVITE_AUTH;
