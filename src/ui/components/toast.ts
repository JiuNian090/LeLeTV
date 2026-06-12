/**
 * Toast 消息组件
 */

const toastQueue: { message: string; duration: number }[] = [];
let isShowingToast = false;
let currentToastTimeout: ReturnType<typeof setTimeout> | null = null;
let loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function showToast(
  message: string,
  _type: string = 'error',
  duration: number = 3000
): void {
  if (!message || typeof message !== 'string') {
    console.warn('Invalid toast message:', message);
    return;
  }

  let toast = document.getElementById('toast');
  let toastMessage = document.getElementById('toastMessage');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className =
      'fixed bottom-20 left-1/2 -translate-x-1/2 text-white px-5 py-2.5 shadow-lg transform transition-all duration-300 opacity-0 scale-50 z-50 pointer-events-none';
    toast.style.cssText = 'z-index: 2147483647';
    toastMessage = document.createElement('p');
    toastMessage.id = 'toastMessage';
    toast.appendChild(toastMessage);
    document.body.appendChild(toast);
  }

  const maxMessageLength = 120;
  if (message.length > maxMessageLength) {
    message = message.substring(0, maxMessageLength) + '...';
  }

  toastQueue.push({ message, duration });
  if (!isShowingToast) {
    showNextToast();
  }
}

function showNextToast(): void {
  if (toastQueue.length === 0) {
    isShowingToast = false;
    return;
  }

  if (currentToastTimeout) {
    clearTimeout(currentToastTimeout);
    currentToastTimeout = null;
  }

  isShowingToast = true;
  const { message, duration } = toastQueue.shift()!;
  const toast = document.getElementById('toast')!;
  const toastMessage = document.getElementById('toastMessage')!;

  toast.style.background = 'rgba(40, 40, 40, 0.8)';
  toast.style.backdropFilter = 'blur(8px)';
  toast.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  toast.style.borderRadius = '999px';
  toast.style.fontSize = window.innerWidth <= 640 ? '0.85rem' : '0.9rem';
  toast.style.lineHeight = '1.4';
  toast.style.padding = window.innerWidth <= 640 ? '0.5rem 1rem' : '0.55rem 1.25rem';
  toast.style.textAlign = 'center';
  toast.style.color = 'rgba(255, 255, 255, 0.9)';
  toast.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';

  toastMessage.textContent = message;

  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform =
      window.innerWidth <= 640
        ? 'translateX(0) scale(1)'
        : 'translateX(-50%) scale(1)';
    toast.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
  }, 50);

  currentToastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform =
      window.innerWidth <= 640
        ? 'translateX(0) scale(0.5)'
        : 'translateX(-50%) scale(0.5)';
    toast.style.transition = 'all 0.2s ease-in';

    setTimeout(() => {
      showNextToast();
    }, 250);
  }, duration);
}

export function showLoading(message: string = '加载中...'): void {
  if (loadingTimeoutId) clearTimeout(loadingTimeoutId);

  const loading = document.getElementById('loading');
  if (!loading) return;
  const msgEl = loading.querySelector('p');
  if (msgEl) msgEl.textContent = message;
  loading.style.display = 'flex';

  loadingTimeoutId = setTimeout(() => {
    hideLoading();
    showToast('操作超时，请稍后重试', 'warning');
  }, 30000);
}

export function hideLoading(): void {
  if (loadingTimeoutId) {
    clearTimeout(loadingTimeoutId);
    loadingTimeoutId = null;
  }
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return minutes <= 0 ? '刚刚' : `${minutes}分钟前`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  }
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}天前`;
  }

  const y = date.getFullYear();
  const M = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${y}-${M}-${d} ${h}:${m}`;
}

export function formatPlaybackTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
