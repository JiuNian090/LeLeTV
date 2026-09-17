function getSearchHistory() {
    try {
        const data = localStorage.getItem(scopedKey(SEARCH_HISTORY_KEY));
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
        localStorage.setItem(scopedKey(SEARCH_HISTORY_KEY), JSON.stringify(history));
    } catch (e) {
        console.error('保存搜索历史失败:', e);
        // 如果存储失败（可能是localStorage已满），尝试清理旧数据
        try {
            localStorage.removeItem(scopedKey(SEARCH_HISTORY_KEY));
            localStorage.setItem(scopedKey(SEARCH_HISTORY_KEY), JSON.stringify(history.slice(0, 3)));
        } catch (e2) {
            console.error('再次保存搜索历史失败:', e2);
        }
    }
}

// ==================== 搜索历史列表渲染 ====================
// 桌面下拉（#searchHistoryDropdown）与移动列表（#mobileSearchHistoryList）共用同一套
// 条目结构与过滤逻辑，只有外层容器、id 前缀和空态文案不同，避免两处各自维护。

function _escapeHistoryText(text) {
    return String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 单条历史。itemId 供键盘导航的 aria-activedescendant 引用
function _historyItemHtml(item, itemId) {
    const safeText = _escapeHistoryText(item.text);
    const attr = safeText.replace(/"/g, '&quot;');
    return `
            <div class="search-history-item" id="${itemId}" role="option" aria-selected="false" data-query="${attr}">
                <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="history-text">${safeText}</span>
                <button class="history-delete" data-query="${attr}" aria-label="删除搜索记录">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
}

function _historyListHtml(history, idPrefix) {
    let html = '';
    history.forEach((item, index) => { html += _historyItemHtml(item, idPrefix + index); });
    html += '<button class="search-history-clear" type="button">清除搜索历史</button>';
    return html;
}

// 历史内容指纹：只有内容真的变了才重建 DOM
function _historyFingerprint(history) {
    return history.map(item => item.text || '').join('\u0001');
}

// 重建（必要时）+ 记录指纹；空历史写入空态
function _renderHistoryInto(container, history, idPrefix, emptyHtml) {
    if (!container) return;
    if (history.length === 0) {
        container.innerHTML = emptyHtml || '';
        container.dataset.historyKey = '';
        return;
    }
    const fingerprint = _historyFingerprint(history);
    if (container.dataset.historyKey !== fingerprint) {
        container.innerHTML = _historyListHtml(history, idPrefix);
        container.dataset.historyKey = fingerprint;
    }
}

// 关键字过滤：只切 display，不重建 DOM。
// 这样输入法组合期间（拼音逐个字母触发 input）列表不会跟着闪烁重建。
function _filterHistoryIn(container, filterText) {
    if (!container) return false;
    const query = (filterText || '').trim().toLowerCase();
    let hasVisible = false;
    container.querySelectorAll('.search-history-item').forEach(el => {
        const text = (el.dataset.query || '').toLowerCase();
        const match = !query || text.includes(query);
        el.style.display = match ? '' : 'none';
        if (match) hasVisible = true;
    });
    const clearBtn = container.querySelector('.search-history-clear');
    if (clearBtn) clearBtn.style.display = hasVisible ? '' : 'none';
    return hasVisible;
}

function renderSearchHistory() {
    const dropdown = document.getElementById('searchHistoryDropdown');
    _renderHistoryInto(dropdown, getSearchHistory(), 'history-item-', '');
}

function showSearchHistory(filterText) {
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (!dropdown) return;

    const history = getSearchHistory();
    if (history.length === 0) {
        dropdown.innerHTML = '';
        dropdown.dataset.historyKey = '';
        dropdown.classList.add('hidden');
        _removeSearchBarFlush();
        resetSearchHistoryNav();
        return;
    }

    _renderHistoryInto(dropdown, history, 'history-item-', '');
    const hasVisible = _filterHistoryIn(dropdown, filterText);

    if (hasVisible) {
        _positionDropdown(dropdown);
        dropdown.classList.remove('hidden');
        _addSearchBarFlush();
        _syncSearchInputAria(true);
    } else {
        dropdown.classList.add('hidden');
        _removeSearchBarFlush();
        _syncSearchInputAria(false);
        resetSearchHistoryNav();
    }
}

function _positionDropdown(dropdown) {
    var searchBar = document.querySelector('[data-searchbar]');
    if (!searchBar) return;
    var rect = searchBar.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = rect.bottom + 'px';
    dropdown.style.width = rect.width + 'px';
}

// 滚动/缩放会高频触发，用 rAF 合并成每帧一次定位
var _repositionFrame = null;
function repositionSearchHistory() {
    var dropdown = document.getElementById('searchHistoryDropdown');
    if (!dropdown || dropdown.classList.contains('hidden')) return;
    if (_repositionFrame) return;
    _repositionFrame = requestAnimationFrame(function () {
        _repositionFrame = null;
        var el = document.getElementById('searchHistoryDropdown');
        if (el && !el.classList.contains('hidden')) _positionDropdown(el);
    });
}

function hideSearchHistory() {
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
    _removeSearchBarFlush();
    resetSearchHistoryNav();
}

// ==================== 下拉键盘导航（↑/↓ 高亮，Enter 采用） ====================

let _historyActiveIndex = -1;

function _visibleHistoryItems() {
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (!dropdown || dropdown.classList.contains('hidden')) return [];
    return Array.from(dropdown.querySelectorAll('.search-history-item'))
        .filter(el => el.style.display !== 'none');
}

function _syncSearchInputAria(expanded) {
    const input = document.getElementById('searchInput');
    if (input) input.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function _applyActiveHistoryItem(items, index) {
    items.forEach((el, i) => {
        const active = i === index;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const input = document.getElementById('searchInput');
    if (!input) return;
    if (index >= 0 && items[index]) {
        input.setAttribute('aria-activedescendant', items[index].id);
        // 高亮项文本回填输入框（不派发 input 事件，列表保持稳定）
        input.value = items[index].dataset.query || '';
        // 回填不会走 input 事件，这里手动同步清空按钮的显隐
        const clearBtn = document.getElementById('clearSearchInput');
        if (clearBtn) clearBtn.classList.toggle('is-visible', !!input.value);
    } else {
        input.removeAttribute('aria-activedescendant');
    }
}

// 返回 true 表示按键已被下拉消费
function navigateSearchHistory(delta) {
    const items = _visibleHistoryItems();
    if (items.length === 0) return false;
    const next = Math.max(0, Math.min(items.length - 1, _historyActiveIndex + delta));
    if (next === _historyActiveIndex) return true;
    _historyActiveIndex = next;
    _applyActiveHistoryItem(items, _historyActiveIndex);
    const activeEl = items[_historyActiveIndex];
    if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ block: 'nearest' });
    return true;
}

// 当前高亮的搜索词（没有高亮时返回 null，调用方回退到输入框内容）
function getActiveHistoryQuery() {
    const items = _visibleHistoryItems();
    if (_historyActiveIndex < 0 || !items[_historyActiveIndex]) return null;
    return items[_historyActiveIndex].dataset.query || null;
}

// 清掉高亮（用于手动输入后），但不动 aria-expanded —— 下拉可能仍然打开
function clearHistoryNavHighlight() {
    _historyActiveIndex = -1;
    const input = document.getElementById('searchInput');
    if (input) input.removeAttribute('aria-activedescendant');
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (dropdown) {
        dropdown.querySelectorAll('.search-history-item').forEach(el => {
            el.classList.remove('is-active');
            el.setAttribute('aria-selected', 'false');
        });
    }
}

function resetSearchHistoryNav() {
    clearHistoryNavHighlight();
    _syncSearchInputAria(false);
}

function renderMobileSearchHistory(filterText) {
    const container = document.getElementById('mobileSearchHistoryList');
    if (!container) return;

    const history = getSearchHistory();
    if (history.length === 0) {
        container.innerHTML = '<div class="search-history-empty">暂无搜索历史</div>';
        container.dataset.historyKey = '';
        return;
    }

    _renderHistoryInto(container, history, 'mobile-history-item-', '');
    const hasVisible = _filterHistoryIn(container, filterText);
    if (!hasVisible) {
        // 桌面是直接收起下拉，移动端列表常驻，用一句空态代替
        container.innerHTML = '<div class="search-history-empty">无匹配的历史记录</div>';
        container.dataset.historyKey = '';
    }
}

function _addSearchBarFlush() {
    const searchBar = document.querySelector('[data-searchbar]');
    if (searchBar) searchBar.classList.add('search-bar-flush');
}

function _removeSearchBarFlush() {
    const searchBar = document.querySelector('[data-searchbar]');
    if (searchBar) searchBar.classList.remove('search-bar-flush');
}

function deleteSingleSearchHistory(query) {
    // 当url中包含删除的关键词时，页面刷新后会自动加入历史记录，导致误认为删除功能有bug。此问题无需修复，功能无实际影响。
    try {
        let history = getSearchHistory();
        // 过滤掉要删除的记录
        history = history.filter(item => item.text !== query);
        localStorage.setItem(scopedKey(SEARCH_HISTORY_KEY), JSON.stringify(history));
    } catch (e) {
        console.error('删除单条搜索历史失败:', e);
        showToast('删除单条搜索历史失败', 'error');
    }
}

function clearSearchHistory() {
    try {
        localStorage.removeItem(scopedKey(SEARCH_HISTORY_KEY));
        hideSearchHistory();
        showToast('搜索历史已清除', 'success');
    } catch (e) {
        console.error('清除搜索历史失败:', e);
        showToast('清除搜索历史失败:', 'error');
    }
}
