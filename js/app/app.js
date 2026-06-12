// 全局变量（在 api-config.js 中初始化，直接引用 window 上的值）
// var selectedAPIs / customAPIs 已在 api-config.js 中声明

// 添加当前播放的集数索引
let currentEpisodeIndex = 0;
// 添加当前视频的所有集数
let currentEpisodes = [];
// 添加当前视频的标题
let currentVideoTitle = '';
// 全局变量用于倒序状态
let episodesReversed = false;

// 搜索源过滤状态
let _activeSourceFilter = 'all';
let _lastAllResults = [];

// 搜索框就绪标志，初始化期间不响应任何事件
let _searchReady = false;

// 过滤配置缓存
let _filterConfig = null;

// 加载过滤配置（从外部 JSON，避免敏感词出现在代码中）

// 对搜索结果应用内容过滤

// 页面初始化
document.addEventListener('DOMContentLoaded', function () {
    // 设置默认API选择（必须在 initAPICheckboxes 之前，否则复选框不同步）
    if (!localStorage.getItem('hasInitializedDefaults')) {
        selectedAPIs = ["tyyszy", "bfzy", "dyttzy", "wolong"];
        localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
        localStorage.setItem('hiddenFilterEnabled', 'true');
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, 'true');
        localStorage.setItem('hasInitializedDefaults', 'true');
        localStorage.setItem('dataSourceLogicVersion', 'v1');
    }

    // 初始化API复选框
    initAPICheckboxes();

    // 初始化自定义API列表
    renderCustomAPIsList();

    // 初始化显示选中的API数量
    updateSelectedApiCount();

    // 设置隐藏内容过滤器开关初始状态
    const hiddenFilterToggle = document.getElementById('hiddenFilterToggle');
    if (hiddenFilterToggle) {
        hiddenFilterToggle.checked = localStorage.getItem('hiddenFilterEnabled') === 'true';
    }

    // 设置广告过滤开关初始状态
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        // 默认打开分片广告过滤功能
        adFilterToggle.checked = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false'; // 默认为true
    }

    // 设置事件监听器
    setupEventListeners();

    // 确保搜索历史下拉默认隐藏，并强制移除焦点
    hideSearchHistory();
    document.getElementById('searchInput').blur();

    // 延迟标记搜索就绪，防止浏览器自动填充/自动聚焦触发下拉
    setTimeout(() => { _searchReady = true; }, 200);

    // 初始检查隐藏API选中状态
    setTimeout(checkHiddenAPIsSelected, 100);
});

// 检测 bfcache 恢复（从播放页返回时），清除陈旧搜索状态
window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        document.getElementById('results').innerHTML = '';
        document.getElementById('resultsArea')?.classList.add('hidden');
        document.getElementById('searchArea')?.classList.remove('flex-1', 'mb-8');
        document.querySelector('.home-layout')?.classList.remove('has-results');
        document.getElementById('closeSearchResults')?.classList.add('hidden');
        _lastAllResults = [];
        _activeSourceFilter = 'all';
        const filterTabs = document.getElementById('sourceFilterTabs');
        if (filterTabs) filterTabs.innerHTML = '';
        // 用 replaceState 修正 URL 不额外增加历史条目，同时清除 hash
        if (window.location.pathname !== '/' || window.location.search || location.hash) {
            try {
                window.history.replaceState({}, 'LeLeTV - 乐乐影视', '/');
                document.title = 'LeLeTV - 乐乐影视';
            } catch (e) {}
        }
        // 恢复首页面板（bfcache 不会触发 hashchange）
        if (typeof showPage === 'function') {
            showPage('home');
        }
    }
});

// 设置事件监听器

// 重置搜索区域

// 获取自定义API信息

// ========== 骨架屏辅助 ==========

// 搜索功能节流锁
let _searchThrottled = false;

// 移动端全屏搜索覆盖层


// 搜索功能 - 修改为支持多选API和多页结果

// 生成搜索卡片HTML（带XSS保护）

// 中文数字转阿拉伯数字

// 从视频标题中提取基础片名和季/部/集序号

// 获取API源的人类可读名称

// 基于当前配置初始化过滤标签（初始渲染用，搜索完成后会被实际结果覆盖）

// 渲染搜索源过滤标签（从实际搜索结果中提取源列表）

// 更新「全部」标签的计数

// 按源过滤搜索结果并重绘

// 设置邮箱点击事件处理器（使用 .contact-link 类统一绑定）
function setupEmailClickHandlers() {
    const contactElements = document.querySelectorAll('.contact-link');
    contactElements.forEach(element => {
        element.addEventListener('click', function() {
                const email = 'jiunian929@gmail.com';
                const originalText = this.textContent; // 保存原始文本
                let clientOpened = false; // 标记客户端是否打开
                
                // 添加高亮效果到点击的元素
                this.classList.add('email-highlight');
                
                // 复制邮箱到剪贴板
                const textArea = document.createElement('textarea');
                textArea.value = email;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('复制失败:', err);
                }
                
                document.body.removeChild(textArea);
                
                // 创建a标签并设置mailto属性以打开邮件客户端
                const mailtoLink = document.createElement('a');
                mailtoLink.href = `mailto:${email}`;
                mailtoLink.style.display = 'none';
                document.body.appendChild(mailtoLink);
                mailtoLink.click();
                document.body.removeChild(mailtoLink);
                
                // 检查邮件客户端是否成功打开
                setTimeout(() => {
                    // 如果页面仍然可见，假设邮件客户端没有成功打开
                    if (document.visibilityState === 'visible' && !clientOpened) {
                        // 显示邮箱覆盖"联系乐乐"
                        this.textContent = email;
                        
                        // 显示指定的提示消息
                        showToast(`'${email}'已复制`, 'success');
                        
                        // 3秒后恢复原始文本和移除高亮效果
                        setTimeout(() => {
                            this.textContent = originalText;
                            this.classList.remove('email-highlight');
                        }, 3000);
                    } else {
                        // 客户端打开成功，显示原有提示
                        showToast(`邮箱 ${email} 已复制并正在打开邮件客户端`, 'success');
                        
                        // 3秒后移除高亮效果
                        setTimeout(() => {
                            this.classList.remove('email-highlight');
                        }, 3000);
                    }
                }, 1000); // 1秒后检查状态
            });
    });
}

// 关闭搜索结果，恢复居中布局

// 劫持搜索框的value属性以检测外部修改
document.addEventListener('DOMContentLoaded', hookInput);

// 从URL导入配置

// 配置文件导入功能

// 配置文件导出功能

// 将字符串保存为文件

// 传统搜索方式（作为降级选项）

// 卡片交错入场动画
