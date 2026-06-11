function showToast(message, type = 'error', duration = 3000) {
    if (!message || typeof message !== 'string') {
        console.warn('Invalid toast message:', message);
        return;
    }

    let toast = document.getElementById('toast');
    let toastMessage = document.getElementById('toastMessage');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 text-white px-5 py-2.5 shadow-lg transform transition-all duration-300 opacity-0 scale-50 z-50 pointer-events-none';
        toast.style = 'z-index: 2147483647';
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

function showNextToast() {
    if (toastQueue.length === 0) {
        isShowingToast = false;
        return;
    }

    if (currentToastTimeout) {
        clearTimeout(currentToastTimeout);
        currentToastTimeout = null;
    }

    isShowingToast = true;
    const { message, duration } = toastQueue.shift();

    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toast.style.background = 'rgba(40, 40, 40, 0.8)';
    toast.style.backdropFilter = 'blur(8px)';
    toast.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    toast.style.borderRadius = '999px';
    toast.style.fontSize = '0.9rem';
    toast.style.lineHeight = '1.4';
    toast.style.padding = '0.55rem 1.25rem';
    toast.style.textAlign = 'center';
    toast.style.color = 'rgba(255, 255, 255, 0.9)';
    toast.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';

    if (window.innerWidth <= 640) {
        toast.style.fontSize = '0.85rem';
        toast.style.padding = '0.5rem 1rem';
    }

    toastMessage.textContent = message;

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = window.innerWidth <= 640 ? 'translateX(0) scale(1)' : 'translateX(-50%) scale(1)';
        toast.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
    }, 50);

    currentToastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = window.innerWidth <= 640 ? 'translateX(0) scale(0.5)' : 'translateX(-50%) scale(0.5)';
        toast.style.transition = 'all 0.2s ease-in';

        setTimeout(() => {
            showNextToast();
        }, 250);
    }, duration);
}

function showLoading(message = '加载中...') {
    // 清除任何现有的超时
    if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
    }

    const loading = document.getElementById('loading');
    const messageEl = loading.querySelector('p');
    messageEl.textContent = message;
    loading.style.display = 'flex';

    // 设置30秒后自动关闭loading，防止无限loading
    loadingTimeoutId = setTimeout(() => {
        hideLoading();
        showToast('操作超时，请稍后重试', 'warning');
    }, 30000);
}

function hideLoading() {
    // 清除超时
    if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
        loadingTimeoutId = null;
    }

    const loading = document.getElementById('loading');
    loading.style.display = 'none';
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    // 清除 iframe 内容
    document.getElementById('modalContent').innerHTML = '';
}

function showModal(options) {
    const { title, content, width = 'max-w-md', closeOnBackdrop = true, onClose } = options;

    // 移除已有模态框
    const existing = document.getElementById('leletv-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'leletv-modal';
    overlay.className = 'fixed inset-0 bg-black/95 items-center justify-center z-50 flex';

    overlay.innerHTML = `
        <div class="bg-[#111] rounded-lg p-6 w-11/12 ${width} max-h-[90vh] overflow-y-auto relative">
            <button class="modal-close-btn absolute top-4 right-4 text-gray-400 hover:text-white text-xl leading-none p-1 z-10">&times;</button>
            ${title ? `<h3 class="text-xl font-bold mb-4">${title}</h3>` : ''}
            <div class="modal-body"></div>
        </div>
    `;

    document.body.appendChild(overlay);
    const bodyEl = overlay.querySelector('.modal-body');

    // 填充内容
    if (typeof content === 'function') {
        content(bodyEl, overlay);
    } else if (typeof content === 'string') {
        bodyEl.innerHTML = content;
    }

    // 关闭按钮
    overlay.querySelector('.modal-close-btn').addEventListener('click', () => {
        overlay.remove();
        if (onClose) onClose();
    });

    // 点击遮罩关闭
    if (closeOnBackdrop) {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) {
                overlay.remove();
                if (onClose) onClose();
            }
        });
    }

    return overlay;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // 小于1小时，显示"X分钟前"
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return minutes <= 0 ? '刚刚' : `${minutes}分钟前`;
    }

    // 小于24小时，显示"X小时前"
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}小时前`;
    }

    // 小于7天，显示"X天前"
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}天前`;
    }

    // 其他情况，显示完整日期
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatPlaybackTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function clearLocalStorage() {
    const overlay = showModal({
        title: '⚠️ 警告',
        content: (body, modal) => {
            body.innerHTML = `
                <div class="text-sm font-medium text-gray-300">确定要清除页面缓存吗？</div>
                <div class="text-sm font-medium text-gray-300 mb-4">此功能会删除你的观看记录、自定义 API 接口和 Cookie，<span class="text-red-500 font-bold">此操作不可恢复！</span></div>
                <div class="flex justify-end space-x-2">
                    <button id="confirmClearBtn" class="px-4 py-1 rounded bg-gray-600 hover:bg-gray-700 text-white">确定</button>
                    <button id="cancelClearBtn" class="px-4 py-1 rounded bg-pink-600 hover:bg-pink-700 text-white">取消</button>
                </div>
            `;
            modal.querySelector('#confirmClearBtn').addEventListener('click', function () {
                // 清除所有localStorage数据
                localStorage.clear();
                // 清除所有cookie
                const cookies = document.cookie.split(";");
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i];
                    const eqPos = cookie.indexOf("=");
                    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                }
                body.innerHTML = `
                    <div class="text-sm font-medium text-gray-300 mb-4">页面缓存和Cookie已清除，<span id="countdown">3</span> 秒后自动刷新本页面。</div>
                `;
                let countdown = 3;
                const countdownElement = document.getElementById('countdown');
                const countdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown >= 0 && countdownElement) {
                        countdownElement.textContent = countdown;
                    } else {
                        clearInterval(countdownInterval);
                        window.location.reload();
                    }
                }, 1000);
            });
            modal.querySelector('#cancelClearBtn').addEventListener('click', () => overlay.remove());
        },
        closeOnBackdrop: true
    });
}