/**
 * 代理请求鉴权模块
 * 为代理请求添加基于 PASSWORD 的鉴权机制
 */

import { sha256 } from './sha256';

/** 缓存的密码哈希 */
let cachedPasswordHash: string | null = null;

/**
 * 获取当前会话的密码哈希
 */
export async function getPasswordHash(): Promise<string | null> {
  if (cachedPasswordHash) {
    return cachedPasswordHash;
  }

  // 1. 优先从已存储的代理鉴权哈希获取
  const storedHash = localStorage.getItem('proxyAuthHash');
  if (storedHash) {
    cachedPasswordHash = storedHash;
    return storedHash;
  }

  // 2. 尝试从密码验证状态获取
  const passwordVerified = localStorage.getItem('passwordVerified');
  const storedPasswordHash = localStorage.getItem('passwordHash');
  if (passwordVerified === 'true' && storedPasswordHash) {
    localStorage.setItem('proxyAuthHash', storedPasswordHash);
    cachedPasswordHash = storedPasswordHash;
    return storedPasswordHash;
  }

  // 3. 尝试从用户输入的密码生成哈希
  const userPassword = localStorage.getItem('userPassword');
  if (userPassword) {
    try {
      const hash = await sha256(userPassword);
      localStorage.setItem('proxyAuthHash', hash);
      cachedPasswordHash = hash;
      return hash;
    } catch (error) {
      console.error('生成密码哈希失败:', error);
    }
  }

  // 4. 使用环境变量中的密码哈希
  if (window.__ENV__?.PASSWORD) {
    cachedPasswordHash = window.__ENV__.PASSWORD;
    return window.__ENV__.PASSWORD;
  }

  return null;
}

/**
 * 为代理请求 URL 添加鉴权参数
 */
export async function addAuthToProxyUrl(url: string): Promise<string> {
  try {
    const hash = await getPasswordHash();
    if (!hash) {
      console.warn('无法获取密码哈希，代理请求可能失败');
      return url;
    }

    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}auth=${encodeURIComponent(hash)}&t=${timestamp}`;
  } catch (error) {
    console.error('添加代理鉴权失败:', error);
    return url;
  }
}

/**
 * 验证代理请求的鉴权
 */
export function validateProxyAuth(
  authHash: string | null,
  serverPasswordHash: string | null,
  timestamp: string | number | null
): boolean {
  if (!authHash || !serverPasswordHash) {
    return false;
  }

  if (authHash !== serverPasswordHash) {
    return false;
  }

  // 验证时间戳（10分钟有效期）
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10分钟

  if (timestamp && now - Number(timestamp) > maxAge) {
    console.warn('代理请求时间戳过期');
    return false;
  }

  return true;
}

/**
 * 清除缓存的鉴权信息
 */
export function clearAuthCache(): void {
  cachedPasswordHash = null;
  localStorage.removeItem('proxyAuthHash');
}

// 监听密码变化，清除缓存
window.addEventListener('storage', (e: StorageEvent) => {
  if (
    e.key === 'userPassword' ||
    e.key === PASSWORD_CONFIG_LOCAL_STORAGE_KEY
  ) {
    clearAuthCache();
  }
});

const PASSWORD_CONFIG_LOCAL_STORAGE_KEY = 'passwordVerified';
