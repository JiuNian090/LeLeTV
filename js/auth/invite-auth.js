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
  // 本机设备实例 ID 的存储键
  DEVICE_ID_KEY: 'leletv_device_id',
  DEVICE_ID_SESSION_KEY: 'leletv_device_id_session',
  HEARTBEAT_INTERVAL: 5 * 60 * 1000, // 5分钟
  
  _inviteUrl(path) {
    const workerBase = window.__ENV__?.TMDB_WORKER_URL || '';
    if (workerBase) {
      return `${workerBase}${path}`;
    }
    return `/api${path}`;
  },
  
  /* ===== 设备标识 =====
   * 旧版把「软指纹」当作设备唯一标识，同型号同系统的设备（例如两台 iPad 11 / iPadOS 26）
   * 会算出同一个值，被服务端误判为同一台设备，互相覆盖设备名与活跃时间。
   * 现在拆成两个概念：
   *   device_fingerprint（上报字段）= 设备实例 ID：本机生成并持久化的随机 ID，d_ 前缀
   *   device_signature（上报字段）  = 软指纹：仅用于本机 ID 丢失（清缓存/无痕）时找回记录
   */

  /** SHA-256(hex)；无 Web Crypto 时回退到简易哈希 */
  async _sha256Hex(raw) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fp_' + Math.abs(hash).toString(16);
  },

  _readStore(name, key) {
    try { return window[name].getItem(key); } catch { return null; }
  },

  _writeStore(name, key, value) {
    try { window[name].setItem(key, value); return true; } catch { return false; }
  },

  /** 设备实例 ID 形态：d_ + 32 位十六进制 */
  _isDeviceId(value) {
    return typeof value === 'string' && /^d_[0-9a-f]{32}$/.test(value);
  },

  /** 生成本机随机设备实例 ID */
  _generateDeviceId() {
    const c = window.crypto;
    if (c && typeof c.randomUUID === 'function') {
      return 'd_' + c.randomUUID().replace(/-/g, '');
    }
    const bytes = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(bytes);
    } else {
      // 兜底：环境无 Web Crypto
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return 'd_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * 获取本机设备实例 ID（首次访问生成并持久化）
   * localStorage 不可用（无痕/被清理）时退回本会话 ID，再退回临时 ID
   */
  getOrCreateDeviceId() {
    // 返回 { id, isNew }：isNew 表示本机本次是全新生成的 ID（首次访问或本地存储被清），
    // 服务端只在这种情况下才尝试用软指纹找回旧记录
    const local = INVITE_AUTH._readStore('localStorage', INVITE_AUTH.DEVICE_ID_KEY);
    if (INVITE_AUTH._isDeviceId(local)) {
      INVITE_AUTH._writeStore('sessionStorage', INVITE_AUTH.DEVICE_ID_SESSION_KEY, local);
      return { id: local, isNew: false };
    }

    // localStorage 被清但同一标签页仍在：沿用会话 ID，避免无谓地认成新设备
    const session = INVITE_AUTH._readStore('sessionStorage', INVITE_AUTH.DEVICE_ID_SESSION_KEY);
    if (INVITE_AUTH._isDeviceId(session)) {
      INVITE_AUTH._writeStore('localStorage', INVITE_AUTH.DEVICE_ID_KEY, session);
      return { id: session, isNew: false };
    }

    const fresh = INVITE_AUTH._generateDeviceId();
    const persisted = INVITE_AUTH._writeStore('localStorage', INVITE_AUTH.DEVICE_ID_KEY, fresh);
    INVITE_AUTH._writeStore('sessionStorage', INVITE_AUTH.DEVICE_ID_SESSION_KEY, fresh);
    if (!persisted) {
      console.warn('[invite-auth] localStorage 不可用，本次会话使用临时设备 ID，将依赖软指纹找回');
    }
    return { id: fresh, isNew: true };
  },

  /** canvas 渲染特征（字体栅格化/抗锯齿差异），失败返回空串 */
  _canvasSignature() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 120, 30);
      ctx.fillStyle = '#069';
      ctx.fillText('LeLeTV-signature', 2, 6);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('LeLeTV-signature', 4, 8);
      ctx.strokeStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(60, 40, 18, 0, Math.PI * 2);
      ctx.stroke();
      const data = canvas.toDataURL();
      return data.length + ':' + data.slice(-96);
    } catch {
      return '';
    }
  },

  /** WebGL 渲染器与能力特征，失败返回空串 */
  _gpuSignature() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return '';
      const parts = [];
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        parts.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '');
        parts.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
      }
      parts.push(gl.getParameter(gl.VERSION) || '');
      parts.push(gl.getParameter(gl.MAX_TEXTURE_SIZE) || '');
      parts.push(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || '');
      parts.push((gl.getSupportedExtensions() || []).length);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext(); // 及时释放，避免长期占用 GPU 上下文
      return parts.join('|');
    } catch {
      return '';
    }
  },

  /**
   * 软指纹：本机硬件/渲染特征哈希
   * 只作「设备 ID 丢失后找回」的依据——同型号同系统设备仍可能算出相同值，
   * 因此服务端仅在「同一邀请码下唯一命中」时才使用它
   */
  async computeDeviceSignature() {
    if (INVITE_AUTH._cachedSignature) return INVITE_AUTH._cachedSignature;
    const components = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      String(screen.colorDepth || ''),
      String(window.devicePixelRatio || 1),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      (navigator.languages || []).join(','),
      navigator.platform || '',
      String(navigator.hardwareConcurrency || ''),
      String(navigator.deviceMemory || ''),
      String(navigator.maxTouchPoints || ''),
      'gpu:' + INVITE_AUTH._gpuSignature(),
      'canvas:' + INVITE_AUTH._canvasSignature()
    ];
    const signature = await INVITE_AUTH._sha256Hex(components.join('||') + 'LELETV_SIGNATURE_SALT');
    INVITE_AUTH._cachedSignature = signature;
    return signature;
  },

  /** @deprecated 兼容旧调用：请用 computeDeviceSignature（软指纹已不是设备唯一标识） */
  generateFingerprint() {
    return INVITE_AUTH.computeDeviceSignature();
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
    const deviceInfo = INVITE_AUTH.getOrCreateDeviceId();
    const deviceId = deviceInfo.id;
    // 软指纹随注册一并上报：本机 ID 丢失（清缓存/无痕）时服务端可据此找回原记录
    const signature = await INVITE_AUTH.computeDeviceSignature();
    
    try {
      const url = INVITE_AUTH._inviteUrl('/invite/verify');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          device_name: deviceName.trim(),
          device_fingerprint: deviceId,
          device_signature: signature,
          device_id_lost: deviceInfo.isNew
        })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        // 管理员登录 - 存储管理员 session，同时保存普通 auth 以便刷新时识别
        if (data.is_admin) {
          const adminToken = await sha256(code.trim().toUpperCase() + '::' + deviceName.trim());
          localStorage.setItem('leletv_admin_session', JSON.stringify({
            token: adminToken,
            verified_at: Date.now()
          }));
          localStorage.setItem('leletv_is_admin', 'true');
          INVITE_AUTH.saveAuth({
            code: code.trim().toUpperCase(),
            device_name: deviceName.trim(),
            device_fingerprint: deviceId
          });
          document.dispatchEvent(new CustomEvent('passwordVerified'));
          return { ok: true, is_admin: true, action: 'admin', message: '管理员验证成功' };
        }
        
        INVITE_AUTH.saveAuth({
          code: code.trim().toUpperCase(),
          device_name: deviceName.trim(),
          device_fingerprint: deviceId
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
    // 防止重复创建定时器和 pagehide 监听
    if (INVITE_AUTH._heartbeatTimer) {
      clearInterval(INVITE_AUTH._heartbeatTimer);
    }
    if (INVITE_AUTH._heartbeatBound) {
      window.removeEventListener('pagehide', INVITE_AUTH._heartbeatBound);
    }
    
    INVITE_AUTH._heartbeatTimer = setInterval(() => {
      INVITE_AUTH.heartbeat(fingerprint);
    }, INVITE_AUTH.HEARTBEAT_INTERVAL);
    
    // 用 pagehide 而非 beforeunload：页面被 bfcache 冻结/卸载时均触发心跳，且不禁用 bfcache
    INVITE_AUTH._heartbeatBound = () => INVITE_AUTH.heartbeat(fingerprint);
    window.addEventListener('pagehide', INVITE_AUTH._heartbeatBound);
  },
  
  /**
   * 确保心跳运行（从 localStorage 读取指纹，页面加载时调用）
   */
  async ensureHeartbeat() {
    const auth = INVITE_AUTH.getAuth();
    if (!auth || !auth.device_fingerprint) return;

    // 旧版本遗留的软指纹（不是设备实例 ID）：重新登记为设备 ID，
    // 否则同型号设备会继续共用同一条设备记录
    if (!INVITE_AUTH._isDeviceId(auth.device_fingerprint)) {
      if (INVITE_AUTH._legacyMigrationTried) return;
      INVITE_AUTH._legacyMigrationTried = true;
      const result = await INVITE_AUTH.verify(auth.code, auth.device_name);
      if (result.ok) return; // verify 内部已写入新设备 ID，普通用户会自动启动心跳
      INVITE_AUTH._legacyMigrationTried = false; // 失败（离线等）→ 按旧标识继续心跳，下次访问再试
    }
    
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
      window.removeEventListener('pagehide', INVITE_AUTH._heartbeatBound);
      INVITE_AUTH._heartbeatBound = null;
    }
  }
};

// 暴露到全局
window.INVITE_AUTH = INVITE_AUTH;
