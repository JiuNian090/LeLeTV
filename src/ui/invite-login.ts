/**
 * 邀请码登录弹窗逻辑（阶段 2 从 index.html 内联脚本抽出）。
 * 注册在 DOMContentLoaded，执行顺序保持在 boot-sequence 之后。
 */

interface InviteAuthApi {
    isLocalMode(): boolean;
    isVerified(): boolean;
    verify(code: string, deviceName: string): Promise<{
        ok: boolean;
        is_admin?: boolean;
        message?: string;
        error?: string;
    }>;
}

interface DisclaimerState {
    pending?: boolean;
    handled?: boolean;
}

declare function showToast(message: string, type?: string): void;

// 邀请码登录弹窗
// 线上（配置了 Worker 地址）：校验邀请码；本地版：只保留视觉框架，点「进入」即放行（见 js/auth/invite-auth.js 的本地模式）
document.addEventListener('DOMContentLoaded', function () {
    const loginModal = document.getElementById('inviteLoginModal') as HTMLElement | null;
    const guideModal = document.getElementById('inviteGuideModal') as HTMLElement | null;
    const loginForm = document.getElementById('inviteLoginForm') as HTMLFormElement | null;
    const deviceNameInput = document.getElementById('inviteDeviceName') as HTMLInputElement | null;
    const codeInput = document.getElementById('inviteCodeInput') as HTMLInputElement | null;
    const loginBtn = document.getElementById('inviteLoginBtn') as HTMLButtonElement | null;
    const loginError = document.getElementById('inviteLoginError') as HTMLElement | null;
    const codeToggle = document.getElementById('inviteCodeToggle') as HTMLButtonElement | null;
    const auth = (window as Window & { INVITE_AUTH?: InviteAuthApi }).INVITE_AUTH;
    const isLocal = !!(auth && typeof auth.isLocalMode === 'function' && auth.isLocalMode());

    if (auth && auth.isVerified()) {
        if (loginModal) loginModal.style.display = 'none';
    } else if (loginModal) {
        // 启动屏还在时，登录框要盖在启动层之上（与 boot-sequence.js 的 is-boot 一致）
        if (document.getElementById('bootSplash')) loginModal.classList.add('is-boot');
        loginModal.style.display = 'flex';
    }

    // 显示 / 隐藏邀请码
    if (codeToggle && codeInput) {
        codeToggle.addEventListener('click', function () {
            const reveal = codeInput.type === 'password';
            codeInput.type = reveal ? 'text' : 'password';
            codeToggle.setAttribute('aria-pressed', reveal ? 'true' : 'false');
            codeToggle.setAttribute('aria-label', reveal ? '隐藏邀请码' : '显示邀请码');
        });
    }

    // 设备名称里按回车：跳到邀请码，而不是直接提交
    if (deviceNameInput) {
        deviceNameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                codeInput?.focus();
            }
        });
    }

    [deviceNameInput, codeInput].forEach(function (input) {
        input?.addEventListener('input', function () {
            input?.removeAttribute('aria-invalid');
        });
    });

    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handleInviteLogin();
        });
    }

    // 登录 ⇄ 获取方式：两个弹窗互相切换
    document.querySelectorAll('[data-action="open-invite-guide"]').forEach(function (el) {
        el.addEventListener('click', function () {
            if (loginModal) loginModal.style.display = 'none';
            if (guideModal) guideModal.style.display = 'flex';
        });
    });
    document.querySelectorAll('[data-action="close-invite-guide"]').forEach(function (el) {
        el.addEventListener('click', function () {
            if (guideModal) guideModal.style.display = 'none';
            if (loginModal && !auth?.isVerified()) {
                loginModal.style.display = 'flex';
            }
        });
    });

    function setBusy(busy: boolean) {
        if (!loginBtn) return;
        loginBtn.disabled = busy;
        loginBtn.classList.toggle('is-busy', busy);
        const label = loginBtn.querySelector('.v2-btn-label');
        if (label) label.textContent = busy ? '正在验证' : '进入';
    }

    function showError(message: string, field?: HTMLElement | null) {
        if (loginError) {
            loginError.textContent = message;
            loginError.classList.remove('hidden');
        }
        if (field) {
            field.setAttribute('aria-invalid', 'true');
            field.focus();
        }
    }

    function clearError() {
        if (loginError) loginError.classList.add('hidden');
        deviceNameInput?.removeAttribute('aria-invalid');
        codeInput?.removeAttribute('aria-invalid');
    }

    // 关闭时先播放淡出，再收起
    function closeLoginModal() {
        if (!loginModal) return;
        loginModal.classList.add('is-leaving');
        setTimeout(function () {
            loginModal.style.display = 'none';
            loginModal.classList.remove('is-leaving', 'is-boot');
        }, 220);
    }

    async function handleInviteLogin() {
        const deviceName = deviceNameInput?.value?.trim() || '';
        const code = codeInput?.value?.trim() || '';

        if (!isLocal) {
            if (!deviceName) { showError('请填写设备名称', deviceNameInput); return; }
            if (!code) { showError('请填写邀请码', codeInput); return; }
        }

        clearError();
        setBusy(true);
        // 本地版没有网络往返，留一个短暂的验证态，完整呈现按钮的状态变化
        const results = await Promise.all([
            auth!.verify(code, deviceName),
            new Promise(function (resolve) { setTimeout(resolve, isLocal ? 650 : 0); })
        ]);
        const result = results[0];
        setBusy(false);

        if (result.ok) {
            closeLoginModal();
            // 管理员登录已由 invite-auth.js 内部触发 passwordVerified 事件
            if (!result.is_admin) {
                document.dispatchEvent(new CustomEvent('inviteVerified'));
            }
            const disclaimer = (window as Window & { LELETV_DISCLAIMER?: DisclaimerState }).LELETV_DISCLAIMER;
            const disclaimerNext = disclaimer && disclaimer.pending && !disclaimer.handled;
            if (!disclaimerNext) showToast(result.message || '欢迎使用 LeLeTV', 'success');
        } else {
            showError(result.error || '验证未通过，请检查邀请码后重试');
        }
    }
});
