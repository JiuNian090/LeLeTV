/**
 * 密码保护模块
 *
 * 提供密码验证、弹窗显示、验证状态管理功能。
 * 与 password.html 中的密码弹窗 DOM 配合工作。
 */

import { sha256 } from './sha256';

// ==================== 配置 ====================

const PASSWORD_CONFIG = {
  localStorageKey: 'passwordVerified',
  verificationTTL: 30 * 24 * 60 * 60 * 1000, // 30 天
};

// ==================== 密码保护检查 ====================

/**
 * 检查是否设置了密码保护
 */
export function isPasswordProtected(): boolean {
  const pwd = window.__ENV__?.PASSWORD;
  return typeof pwd === 'string' && pwd.length === 64 && !/^0+$/.test(pwd);
}

/**
 * 检查是否强制要求设置密码
 */
export function isPasswordRequired(): boolean {
  return !isPasswordProtected();
}

/**
 * 强制密码保护检查 - 防止绕过
 */
export function ensurePasswordProtection(): boolean {
  if (isPasswordRequired()) {
    showPasswordModal();
    throw new Error('Password protection is required');
  }
  if (isPasswordProtected() && !isPasswordVerified()) {
    showPasswordModal();
    throw new Error('Password verification required');
  }
  return true;
}

// ==================== 密码验证 ====================

/**
 * 验证用户输入的密码是否正确
 */
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const correctHash = window.__ENV__?.PASSWORD;
    if (!correctHash) return false;

    const inputHash = await sha256(password);
    const isValid = inputHash === correctHash;

    if (isValid) {
      localStorage.setItem(
        PASSWORD_CONFIG.localStorageKey,
        JSON.stringify({
          verified: true,
          timestamp: Date.now(),
          passwordHash: correctHash,
        })
      );
    }
    return isValid;
  } catch (error) {
    console.error('验证密码时出错:', error);
    return false;
  }
}

/**
 * 检查密码是否已验证通过
 */
export function isPasswordVerified(): boolean {
  try {
    if (!isPasswordProtected()) return true;

    const stored = localStorage.getItem(PASSWORD_CONFIG.localStorageKey);
    if (!stored) return false;

    const { timestamp, passwordHash } = JSON.parse(stored);
    const currentHash = window.__ENV__?.PASSWORD;

    return (
      timestamp &&
      passwordHash === currentHash &&
      Date.now() - timestamp < PASSWORD_CONFIG.verificationTTL
    );
  } catch (error) {
    console.error('检查密码验证状态时出错:', error);
    return false;
  }
}

// ==================== 密码弹窗 DOM 操作 ====================

/**
 * 显示密码验证弹窗
 */
export function showPasswordModal(): void {
  const passwordModal = document.getElementById('passwordModal');
  if (!passwordModal) return;

  const cancelBtn = document.getElementById('passwordCancelBtn');
  if (cancelBtn) cancelBtn.classList.add('hidden');

  if (isPasswordRequired()) {
    // 强制设置密码模式
    const title = passwordModal.querySelector('h2');
    const description = passwordModal.querySelector('p');
    if (title) title.textContent = '需要设置密码';
    if (description)
      description.textContent = '请先在部署平台设置 PASSWORD 环境变量来保护您的实例';

    const form = passwordModal.querySelector('form');
    const errorMsg = document.getElementById('passwordError');
    if (form) form.style.display = 'none';
    if (errorMsg) {
      errorMsg.innerHTML =
        '为确保安全，必须设置 PASSWORD 环境变量才能使用本服务，请☞<span class="contact-link text-blue-400 underline cursor-pointer transition-all duration-300 hover:text-blue-300 hover:underline-offset-2">联系乐乐</span>进行配置';
      errorMsg.classList.remove('hidden');
      errorMsg.className = 'text-red-500 mt-2 font-medium';
    }
  } else {
    // 正常密码验证模式
    const title = passwordModal.querySelector('h2');
    const description = passwordModal.querySelector('p');
    if (title) title.textContent = '访问验证';
    if (description)
      description.innerHTML =
        '请输入密码继续访问，进入后请仔细阅读使用说明，包含了使用方法和反诈警告⚠️，如若密码错误可以☞<span class="contact-link text-blue-400 underline cursor-pointer transition-all duration-300 hover:text-blue-300 hover:underline-offset-2">联系乐乐</span>获取密码';

    const form = passwordModal.querySelector('form');
    if (form) form.style.display = 'block';

    // 聚焦输入框
    setTimeout(() => {
      const passwordInput = document.getElementById('passwordInput');
      passwordInput?.focus();
    }, 100);
  }

  passwordModal.style.display = 'flex';
}

/**
 * 隐藏密码验证弹窗
 */
export function hidePasswordModal(): void {
  const passwordModal = document.getElementById('passwordModal');
  if (!passwordModal) return;

  hidePasswordError();

  const passwordInput = document.getElementById('passwordInput') as HTMLInputElement | null;
  if (passwordInput) passwordInput.value = '';

  passwordModal.style.display = 'none';
}

/**
 * 显示密码错误信息
 */
export function showPasswordError(): void {
  const errorElement = document.getElementById('passwordError');
  if (errorElement) {
    errorElement.classList.remove('hidden');
  }
}

/**
 * 隐藏密码错误信息
 */
export function hidePasswordError(): void {
  const errorElement = document.getElementById('passwordError');
  if (errorElement) {
    errorElement.classList.add('hidden');
  }
}

/**
 * 处理密码提交事件
 */
export async function handlePasswordSubmit(): Promise<void> {
  const passwordInput = document.getElementById('passwordInput') as HTMLInputElement | null;
  const password = passwordInput ? passwordInput.value.trim() : '';
  if (await verifyPassword(password)) {
    hidePasswordModal();
    document.dispatchEvent(new CustomEvent('passwordVerified'));
  } else {
    showPasswordError();
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.focus();
    }
  }
}

/**
 * 初始化密码验证系统
 */
export function initPasswordProtection(): void {
  if (isPasswordRequired()) {
    showPasswordModal();
    return;
  }
  if (isPasswordProtected() && !isPasswordVerified()) {
    showPasswordModal();
  }
}
