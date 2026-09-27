// Toast queue variables (moved from ui.js for self-containment)
const toastQueue = [];
let isShowingToast = false;
let currentToastTimeout = null;
let loadingTimeoutId = null;

function showToast(message, type = 'error', duration = 3000) {
    if (!message || typeof message !== 'string') {
        console.warn('Invalid toast message:', message);
        return;
    }

    let toast = document.getElementById('toast');

    // 播放页等没有预置提示条的页面：按首页同一结构补一个
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'v2-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        const dot = document.createElement('span');
        dot.className = 'v2-toast-dot';
        dot.setAttribute('aria-hidden', 'true');
        const text = document.createElement('p');
        text.id = 'toastMessage';
        toast.append(dot, text);
        document.body.appendChild(toast);
    }

    const maxMessageLength = 120;
    if (message.length > maxMessageLength) {
        message = message.substring(0, maxMessageLength) + '…';
    }

    toastQueue.push({ message, type, duration });

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
    const { message, type, duration } = toastQueue.shift();

    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    // 类型只决定左侧状态点的颜色：success / error / warning / info
    toast.dataset.type = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    toastMessage.textContent = message;

    requestAnimationFrame(() => toast.classList.add('is-visible'));

    currentToastTimeout = setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => {
            showNextToast();
        }, 220);
    }, duration);
}

function showLoading(message = '正在加载') {
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
    const { title, content, width = 'narrow', closeOnBackdrop = true, onClose } = options;

    // 移除已有模态框
    const existing = document.getElementById('leletv-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'leletv-modal';
    overlay.className = 'v2-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const dialog = document.createElement('div');
    // width 兼容旧调用写法（Tailwind 的 max-w-*）：较宽的一律用宽版弹窗
    dialog.className = 'v2-dialog' + (/wide|max-w-(lg|xl|2xl|3xl|4xl)/.test(width) ? ' v2-dialog--wide' : '');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'v2-icon-btn v2-dialog-close modal-close-btn';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12"/></svg>';
    dialog.appendChild(closeBtn);

    if (title) {
        const head = document.createElement('div');
        head.className = 'v2-dialog-head';
        const h = document.createElement('h3');
        h.className = 'v2-dialog-title';
        h.textContent = title;
        head.appendChild(h);
        dialog.appendChild(head);
    }

    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    dialog.appendChild(bodyEl);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 填充内容
    if (typeof content === 'function') {
        content(bodyEl, overlay);
    } else if (typeof content === 'string') {
        bodyEl.innerHTML = content;
    }

    const close = () => {
        overlay.remove();
        if (onClose) onClose();
    };

    closeBtn.addEventListener('click', close);

    // 点击遮罩关闭
    if (closeOnBackdrop) {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) close();
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
        title: '清除本地数据',
        content: (body, modal) => {
            body.innerHTML = `
                <p class="v2-confirm-text">将删除本机保存的观看记录、搜索历史、自定义资源站与 Cookie。<strong>此操作无法撤销。</strong></p>
                <div class="v2-dialog-foot is-end">
                    <button type="button" id="cancelClearBtn" class="v2-btn v2-btn--secondary">取消</button>
                    <button type="button" id="confirmClearBtn" class="v2-btn v2-btn--danger">清除</button>
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
                    <p class="v2-confirm-text">本地数据已清除，<span id="countdown">3</span> 秒后重新载入页面。</p>
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
