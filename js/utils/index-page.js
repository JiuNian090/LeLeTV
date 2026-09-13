// 页面加载后显示弹窗脚本

// 隐私政策（使用说明）本次是否需要确认：脚本加载时即判定，
// 供更新弹窗编排使用（更新弹窗排在隐私政策之后，见 version-updater.js 的 whenHomeReady）
window.LELETV_DISCLAIMER = {
    pending: false,   // 本次进站需要用户确认
    handled: false    // 用户已点「我已知晓」
};

(function () {
    var lastAccepted = localStorage.getItem('lastAcceptedDisclaimer');
    var now = Date.now();
    var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    window.LELETV_DISCLAIMER.pending = !lastAccepted || (now - parseInt(lastAccepted, 10)) > THIRTY_DAYS;
})();
document.addEventListener('DOMContentLoaded', function() {
    // 需要确认时：等启动占位（#bootSplash，z-index 9999）退场后再弹，避免被盖住
    if (window.LELETV_DISCLAIMER.pending) {
        var disclaimerModal = document.getElementById('disclaimerModal');
        var acceptBtn = document.getElementById('acceptDisclaimerBtn');
        if (disclaimerModal && acceptBtn) {
            // 邀请码登录优先于任何弹窗：登录通过且启动占位退场后再显示隐私政策
            whenEnteringSite(function () { disclaimerModal.style.display = 'flex'; });

            // 关闭动作统一走 closeDisclaimerModal（写时间戳 + 标记已确认 + 派发 disclaimerAccepted）
            acceptBtn.addEventListener('click', function () {
                if (typeof closeDisclaimerModal === 'function') {
                    closeDisclaimerModal();
                } else {
                    localStorage.setItem('lastAcceptedDisclaimer', Date.now().toString());
                    disclaimerModal.style.display = 'none';
                }
            });
        } else {
            // DOM 缺失时立刻放行，避免更新弹窗一直等下去
            window.LELETV_DISCLAIMER.pending = false;
            window.LELETV_DISCLAIMER.handled = true;
        }
    }

    // URL搜索参数处理脚本
    
    // 从 bfcache 快照恢复时（浏览器返回秒回），页面内存状态完整，清理残留的搜索缓存
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            try { sessionStorage.removeItem('leletv_search_cache'); } catch (err) { /* 忽略 */ }
        }
    });
    
    // 优先恢复缓存的搜索结果（从播放页返回时秒开，不重新搜索）
    // 仅当 URL 为搜索结果页（/s= 或 ?s=）时恢复；恢复成功则不再走下方 URL 参数重新搜索逻辑
    const _searchPath = window.location.pathname;
    if ((_searchPath.startsWith('/s=') || window.location.search.startsWith('?s=')) 
        && typeof restoreSearchFromCache === 'function' && restoreSearchFromCache()) {
        return;
    }

    // 影片结果页（#movies）：由结果页模块自行恢复缓存或按 /s= 关键词自动搜索，避免重复触发
    if (location.hash === '#movies') return;

    // 检查页面路径中的搜索参数 (格式: /s=keyword)
    const path = window.location.pathname;
    const searchPrefix = '/s=';
    
    if (path.startsWith(searchPrefix)) {
        // 提取搜索关键词
        const keyword = decodeURIComponent(path.substring(searchPrefix.length));
        if (keyword) {
            // 设置搜索框的值
            document.getElementById('searchInput').value = keyword;
            // 执行搜索
            setTimeout(() => {
                // 使用setTimeout确保其他DOM加载和初始化完成
                search();
                // 更新浏览器历史，不改变URL (保持搜索参数在地址栏)
                try {
                    window.history.replaceState(
                        { search: keyword }, 
                        `搜索: ${keyword} - LeLeTV`, 
                        window.location.href
                    );
                } catch (e) {
                    console.error('更新浏览器历史失败:', e);
                }
            }, 300);
        }
    }
    
    // 也检查查询字符串中的搜索参数 (格式: ?s=keyword)
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('s');
    
    if (searchQuery) {
        // 设置搜索框的值
        document.getElementById('searchInput').value = searchQuery;
        // 执行搜索
        setTimeout(() => {
            search();
            // 更新URL为规范格式
            try {
                window.history.replaceState(
                    { search: searchQuery }, 
                    `搜索: ${searchQuery} - LeLeTV`, 
                    `/s=${encodeURIComponent(searchQuery)}`
                );
            } catch (e) {
                console.error('更新浏览器历史失败:', e);
            }
        }, 300);
    }
});
