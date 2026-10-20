/**
 * LeLeBoot — 启动编排
 *
 * 冷启动顺序（与 index.html 的启动屏配合）：
 *   1. 启动屏 — HTML 首帧立即出现，不依赖任何 JS / 外部样式
 *   2. 鉴权   — 已登录直接通过；未登录时在启动屏之上弹出邀请码登录框
 *   3. 首页   — 鉴权通过后才开始加载首页数据（继续观看 / 最近更新）
 *   4. 进入   — 鉴权通过 + 首页就绪 + 启动动画落地，三者齐了才撤启动屏
 *   5. 预加载 — 进入首页后，按「分类 → 历史 → 设置 → 关于」顺序后台加载
 *
 * 启动屏 UI 由 index.html 内联脚本暴露为 window.__LELETV_BOOT_UI__，
 * 本模块只负责编排顺序，不直接操作启动屏 DOM。
 */
var LeLeBoot = (function () {
    'use strict';

    // 首页数据超时：TMDB 跨境慢时不让启动屏无限等待，到点先进入首页再继续补数据
    var HOME_TIMEOUT_MS = 4500;
    // 进入首页后的预加载顺序（固定，与用户点击习惯无关）
    var PRELOAD_ORDER = ['category', 'history', 'settings', 'about'];

    var authDone = false;
    var homeDone = false;
    var homeStarted = false;
    var entered = false;
    var preloadIndex = 0;

    function ui() {
        return window.__LELETV_BOOT_UI__ || null;
    }

    function stage(progress, text) {
        var api = ui();
        if (api && typeof api.setStage === 'function') api.setStage(progress, text);
    }

    function start() {
        stage(0.22, '正在验证身份…');
        waitAuth();
    }

    // ---------- 1. 鉴权 ----------
    function waitAuth() {
        var auth = window.INVITE_AUTH;
        if (!auth || typeof auth.isVerified !== 'function') {
            // 鉴权模块没起来（bundle 异常）：不把用户挡在启动屏后面
            console.warn('[boot] 鉴权模块不可用，跳过门禁');
            authPassed();
            return;
        }

        if (auth.isVerified()) {
            authPassed();
            // 已登录：心跳只做后台确认，不占用启动关键路径
            try {
                if (typeof auth.ensureHeartbeat === 'function') auth.ensureHeartbeat();
            } catch (e) {
                console.warn('[boot] 心跳启动失败:', e);
            }
            return;
        }

        // 未登录：登录框直接盖在启动屏上，进度停在「等待登录」
        stage(0.22, '等待登录…');
        var api = ui();
        if (api && typeof api.waitAuth === 'function') api.waitAuth();
        showLoginGate();

        var onVerified = function () {
            document.removeEventListener('inviteVerified', onVerified);
            document.removeEventListener('passwordVerified', onVerified);
            authPassed();
        };
        document.addEventListener('inviteVerified', onVerified);
        document.addEventListener('passwordVerified', onVerified);
    }

    function showLoginGate() {
        var modal = document.getElementById('inviteLoginModal');
        if (!modal) return;
        // 启动屏尚未退场：抬高登录框层级（见 index.html 启动层样式）
        if (document.getElementById('bootSplash')) modal.classList.add('is-boot');
        modal.style.display = 'flex';
    }

    function authPassed() {
        if (authDone) return;
        authDone = true;

        var modal = document.getElementById('inviteLoginModal');
        if (modal) modal.classList.remove('is-boot');

        stage(0.35, '身份验证通过，正在加载首页…');
        var api = ui();
        if (api) {
            if (typeof api.authReady === 'function') api.authReady();
            if (typeof api.resumeProgress === 'function') api.resumeProgress();
        }
        loadHome();
    }

    // ---------- 2. 首页 ----------
    function loadHome() {
        if (homeStarted) return;
        homeStarted = true;
        stage(0.4, '正在加载首页…');

        var jobs = [];
        var recent = null;

        if (window.HomeRecent && typeof window.HomeRecent.ensure === 'function') {
            recent = Promise.resolve(window.HomeRecent.ensure()).catch(function (e) {
                console.warn('[boot] 首页最近更新加载失败:', e);
            });
            jobs.push(recent);
        }

        // 继续观看是本地数据；聚合动效的海报属于装饰，不阻塞进入首页
        if (window.HomeShelves && typeof window.HomeShelves.ensure === 'function') {
            Promise.resolve(window.HomeShelves.ensure()).catch(function (e) {
                console.warn('[boot] 首页聚合内容加载失败:', e);
            });
        }

        if (recent) {
            recent.then(function () {
                if (!homeDone) stage(0.75, '正在整理首页…');
            });
        }

        var timeout = new Promise(function (resolve) {
            setTimeout(resolve, HOME_TIMEOUT_MS);
        });

        Promise.race([Promise.all(jobs), timeout]).then(homeArrived);
    }

    function homeArrived() {
        if (homeDone) return;
        homeDone = true;
        stage(0.95, '即将进入…');
        var api = ui();
        if (api && typeof api.homeReady === 'function') api.homeReady();
    }

    // ---------- 3. 进入首页后后台预加载 ----------
    // 启动屏完全退场后由 index.html 调用。
    function onEntered() {
        if (entered) return;
        entered = true;
        // 多等一拍，把首帧渲染和入场动画排在预加载前面
        setTimeout(function () { schedule(preloadNext); }, 400);
    }

    function schedule(fn) {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(fn, { timeout: 1200 });
        } else {
            setTimeout(fn, 200);
        }
    }

    function preloadNext() {
        if (preloadIndex >= PRELOAD_ORDER.length) return;
        var name = PRELOAD_ORDER[preloadIndex++];

        // 私密模式下分类页不可达，跳过它直接继续下一个
        if (name === 'category' && typeof isCategoryPageBlocked === 'function' && isCategoryPageBlocked('category')) {
            schedule(preloadNext);
            return;
        }

        if (!window.LeLePages || typeof window.LeLePages.ensure !== 'function'
            || (typeof window.LeLePages.has === 'function' && !window.LeLePages.has(name))) {
            schedule(preloadNext);
            return;
        }

        // 串行：上一页的片段 / 样式 / 专属脚本都就绪后，再开始下一页
        var task = window.LeLePages.ensure(name);
        Promise.resolve(task).then(preloadNext, preloadNext);
    }

    function boot() {
        // 此时 DOM 已解析、bundle 已执行，启动屏仍在播入场动画
        start();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    var api = {
        start: start,
        onEntered: onEntered,
        isAuthPassed: function () { return authDone; },
        isHomeReady: function () { return homeDone; }
    };

    window.LeLeBoot = api;
    return api;
})();
