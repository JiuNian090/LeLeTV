// 页面加载后显示弹窗脚本
document.addEventListener('DOMContentLoaded', function() {
    // 检测是否为本地开发环境
    const isLocalDevelopment = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1' || 
                              window.location.port !== ''; // 非默认端口通常是开发环境
    
    // 弹窗显示脚本 - 本地开发环境强制显示，生产环境按原有逻辑
    if (isLocalDevelopment) {
        // 本地开发环境：每次都显示使用说明
        const disclaimerModal = document.getElementById('disclaimerModal');
        disclaimerModal.style.display = 'flex';
        
        // 添加接受按钮事件
        document.getElementById('acceptDisclaimerBtn').addEventListener('click', function() {
            // 在本地开发环境不需要保存接受时间戳
            disclaimerModal.style.display = 'none';
        });
        
        // 本地开发环境：强制显示密码验证，忽略之前的验证状态
        if (typeof showPasswordModal === 'function') {
            // 清除之前的验证状态
            localStorage.removeItem(PASSWORD_CONFIG.localStorageKey);
            // 显示密码验证弹窗
            setTimeout(() => {
                showPasswordModal();
            }, 500); // 延迟显示，确保DOM完全加载
        }
    } else {
        // 生产环境：保持原有逻辑
        // 检查用户是否已经看过声明以及上次查看时间
        const lastAcceptedDisclaimer = localStorage.getItem('lastAcceptedDisclaimer');
        const now = new Date().getTime();
        const oneDayInMs = 24 * 60 * 60 * 1000; // 24小时的毫秒数
        
        // 如果上次接受时间超过24小时或从未接受过，则显示弹窗
        if (!lastAcceptedDisclaimer || (now - parseInt(lastAcceptedDisclaimer)) > oneDayInMs) {
            // 显示弹窗
            const disclaimerModal = document.getElementById('disclaimerModal');
            disclaimerModal.style.display = 'flex';
            
            // 添加接受按钮事件
            document.getElementById('acceptDisclaimerBtn').addEventListener('click', function() {
                // 保存用户接受声明的时间戳
                localStorage.setItem('lastAcceptedDisclaimer', now.toString());
                // 隐藏弹窗
                disclaimerModal.style.display = 'none';
            });
        }
    }

    // URL搜索参数处理脚本
    // 首先检查是否是播放URL格式 (/watch 开头的路径)
    if (window.location.pathname.startsWith('/watch')) {
        // 播放URL，不做额外处理，watch.html会处理重定向
        return;
    }
    
    // 检查页面路径中的搜索参数 (格式: /s=keyword)
    const path = window.location.pathname;
    const searchPrefix = '/s=';
    
    if (path.startsWith(searchPrefix)) {
        // 提取搜索关键词
        const keyword = decodeURIComponent(path.substring(searchPrefix.length));
        if (keyword) {
            // 设置搜索框的值
            document.getElementById('searchInput').value = keyword;
            // 显示清空按钮
            toggleClearButton();
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
