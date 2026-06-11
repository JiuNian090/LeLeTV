function getSearchHistory() {
    try {
        const data = localStorage.getItem(SEARCH_HISTORY_KEY);
        if (!data) return [];

        const parsed = JSON.parse(data);

        // 检查是否是数组
        if (!Array.isArray(parsed)) return [];

        // 支持旧格式（字符串数组）和新格式（对象数组）
        return parsed.map(item => {
            if (typeof item === 'string') {
                return { text: item, timestamp: 0 };
            }
            return item;
        }).filter(item => item && item.text);
    } catch (e) {
        console.error('获取搜索历史出错:', e);
        return [];
    }
}

function saveSearchHistory(query) {
    if (!query || !query.trim()) return;

    // 清理输入，防止XSS
    query = query.trim().substring(0, 50).replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let history = getSearchHistory();

    // 获取当前时间
    const now = Date.now();

    // 过滤掉超过2个月的记录（约60天，60*24*60*60*1000 = 5184000000毫秒）
    history = history.filter(item =>
        typeof item === 'object' && item.timestamp && (now - item.timestamp < 5184000000)
    );

    // 删除已存在的相同项
    history = history.filter(item =>
        typeof item === 'object' ? item.text !== query : item !== query
    );

    // 新项添加到开头，包含时间戳
    history.unshift({
        text: query,
        timestamp: now
    });

    // 限制历史记录数量
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.error('保存搜索历史失败:', e);
        // 如果存储失败（可能是localStorage已满），尝试清理旧数据
        try {
            localStorage.removeItem(SEARCH_HISTORY_KEY);
            localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 3)));
        } catch (e2) {
            console.error('再次保存搜索历史失败:', e2);
        }
    }
}

function renderSearchHistory() {
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (!dropdown) return;

    const history = getSearchHistory();
    if (history.length === 0) {
        dropdown.innerHTML = '';
        return;
    }

    let html = '';
    history.forEach(item => {
        const safeText = (item.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `
            <div class="search-history-item" data-query="${safeText.replace(/"/g, '&quot;')}">
                <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="history-text">${safeText}</span>
                <button class="history-delete" data-query="${safeText.replace(/"/g, '&quot;')}" aria-label="删除搜索记录">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
    });

    html += `<button class="search-history-clear">清除搜索历史</button>`;
    dropdown.innerHTML = html;
}

function showSearchHistory(filterText) {
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (!dropdown) return;

    const history = getSearchHistory();
    if (history.length === 0) {
        dropdown.classList.add('hidden');
        _removeSearchBarFlush();
        return;
    }

    const query = (filterText || '').trim().toLowerCase();
    let html = '';
    let hasVisible = false;

    history.forEach(item => {
        const safeText = (item.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const match = !query || safeText.toLowerCase().includes(query);
        if (match) hasVisible = true;
        html += `
            <div class="search-history-item" data-query="${safeText.replace(/"/g, '&quot;')}"${match ? '' : ' style="display:none"'}">
                <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="history-text">${safeText}</span>
                <button class="history-delete" data-query="${safeText.replace(/"/g, '&quot;')}" aria-label="删除搜索记录">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
    });

    if (hasVisible) {
        html += `<button class="search-history-clear">清除搜索历史</button>`;
        dropdown.innerHTML = html;
        _positionDropdown(dropdown);
        dropdown.classList.remove('hidden');
        _addSearchBarFlush();
    } else {
        dropdown.classList.add('hidden');
        _removeSearchBarFlush();
    }
}

function _positionDropdown(dropdown) {
    var searchBar = document.querySelector('.relative.mb-3 > .h-12');
    if (!searchBar) return;
    var rect = searchBar.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = rect.bottom + 'px';
    dropdown.style.width = rect.width + 'px';
}

function repositionSearchHistory() {
    var dropdown = document.getElementById('searchHistoryDropdown');
    if (!dropdown || dropdown.classList.contains('hidden')) return;
    _positionDropdown(dropdown);
}

function hideSearchHistory() {
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
    _removeSearchBarFlush();
}

function renderMobileSearchHistory(filterText) {
    const container = document.getElementById('mobileSearchHistoryList');
    if (!container) return;

    const history = getSearchHistory();
    if (history.length === 0) {
        container.innerHTML = '<div class="search-history-empty" style="padding:1.5rem 1rem;text-align:center;color:#555;font-size:14px">暂无搜索历史</div>';
        return;
    }

    const query = (filterText || '').trim().toLowerCase();
    let html = '';
    let hasVisible = false;

    history.forEach(item => {
        const safeText = (item.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const match = !query || safeText.toLowerCase().includes(query);
        if (match) hasVisible = true;
        html += `
            <div class="search-history-item" data-query="${safeText.replace(/"/g, '&quot;')}"${match ? '' : ' style="display:none"'}>
                <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="history-text">${safeText}</span>
                <button class="history-delete" data-query="${safeText.replace(/"/g, '&quot;')}" aria-label="删除搜索记录">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
    });

    if (hasVisible) {
        html += `<button class="search-history-clear">清除搜索历史</button>`;
    } else {
        html = '<div class="search-history-empty" style="padding:1.5rem 1rem;text-align:center;color:#555;font-size:14px">无匹配的历史记录</div>';
    }

    container.innerHTML = html;
}

function _addSearchBarFlush() {
    const searchBar = document.querySelector('.relative.mb-3 > .h-12');
    if (searchBar) searchBar.classList.add('search-bar-flush');
}

function _removeSearchBarFlush() {
    const searchBar = document.querySelector('.relative.mb-3 > .h-12');
    if (searchBar) searchBar.classList.remove('search-bar-flush');
}

function deleteSingleSearchHistory(query) {
    // 当url中包含删除的关键词时，页面刷新后会自动加入历史记录，导致误认为删除功能有bug。此问题无需修复，功能无实际影响。
    try {
        let history = getSearchHistory();
        // 过滤掉要删除的记录
        history = history.filter(item => item.text !== query);
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.error('删除单条搜索历史失败:', e);
        showToast('删除单条搜索历史失败', 'error');
    }
}

function clearSearchHistory() {
    // 密码保护校验
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
        hideSearchHistory();
        showToast('搜索历史已清除', 'success');
    } catch (e) {
        console.error('清除搜索历史失败:', e);
        showToast('清除搜索历史失败:', 'error');
    }
}