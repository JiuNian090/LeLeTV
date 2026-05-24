// 全局变量（在 api-config.js 中初始化）
var selectedAPIs = window.selectedAPIs;
var customAPIs = window.customAPIs;

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
async function loadFilterConfig() {
    if (_filterConfig) return _filterConfig;
    try {
        const res = await fetch('/js/filter-config.json');
        _filterConfig = await res.json();
    } catch (e) {
        console.warn('过滤配置加载失败，使用默认空配置:', e);
        _filterConfig = { mode: 'blacklist', blacklist: [], whitelist: [] };
    }
    return _filterConfig;
}

// 对搜索结果应用内容过滤
async function applyFilter(results) {
    if (!results || results.length === 0) return results;
    const config = await loadFilterConfig();
    if (config.mode === 'whitelist') {
        // 白名单模式：只保留分类在白名单中的结果
        return results.filter(item => {
            const typeName = (item.type_name || '').toLowerCase();
            return config.whitelist.some(w => typeName.includes(w.toLowerCase()));
        });
    }
    // 黑名单模式（默认）：过滤掉匹配黑名单的结果
    return results.filter(item => {
        const typeName = (item.type_name || '').toLowerCase();
        return !config.blacklist.some(k => typeName.includes(k.toLowerCase()));
    });
}

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

// 设置事件监听器
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');

    // 回车搜索
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            hideSearchHistory();
            search();
        }
    });

    // 搜索历史下拉：点击/触摸时显示（不用 focus 避免浏览器自动聚焦触发）
    searchInput.addEventListener('pointerdown', function () {
        if (!_searchReady) return;
        showSearchHistory(this.value);
    });

    // 搜索历史下拉：输入时过滤
    searchInput.addEventListener('input', function () {
        if (!_searchReady) return;
        showSearchHistory(this.value);
    });

    // 搜索历史下拉：Escape 关闭
    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            hideSearchHistory();
        }
    });

    // 搜索历史下拉：事件委托（点击条目、删除、清除全部）
    const historyDropdown = document.getElementById('searchHistoryDropdown');
    if (historyDropdown) {
        historyDropdown.addEventListener('click', function (e) {
            const deleteBtn = e.target.closest('.history-delete');
            const clearBtn = e.target.closest('.search-history-clear');
            const item = e.target.closest('.search-history-item');

            if (deleteBtn) {
                e.stopPropagation();
                const query = deleteBtn.dataset.query;
                if (query) {
                    deleteSingleSearchHistory(query);
                    showSearchHistory(document.getElementById('searchInput').value);
                }
                return;
            }

            if (clearBtn) {
                e.stopPropagation();
                clearSearchHistory();
                return;
            }

            if (item) {
                e.stopPropagation();
                const query = item.dataset.query;
                if (query) {
                    document.getElementById('searchInput').value = query;
                    hideSearchHistory();
                    search();
                }
            }
        });
    }

    // 点击页面其他位置关闭下拉
    document.addEventListener('click', function (e) {
        const dropdown = document.getElementById('searchHistoryDropdown');
        const searchInput = document.getElementById('searchInput');
        if (dropdown && !dropdown.classList.contains('hidden')) {
            if (!dropdown.contains(e.target) && e.target !== searchInput) {
                hideSearchHistory();
            }
        }
    });

    // 滚动或窗口大小变化时重新定位下拉（fixed定位需要同步位置）
    window.addEventListener('scroll', repositionSearchHistory, { passive: true });
    window.addEventListener('resize', repositionSearchHistory, { passive: true });

    // 移动端键盘弹出/收起时重新定位下拉
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', repositionSearchHistory);
        window.visualViewport.addEventListener('scroll', repositionSearchHistory);
    }
    
    // 初始化邮箱点击事件处理器
    setupEmailClickHandlers();

    // 隐藏内容过滤开关事件绑定
    const hiddenFilterToggle = document.getElementById('hiddenFilterToggle');
    if (hiddenFilterToggle) {
        hiddenFilterToggle.addEventListener('change', async function (e) {
            // 如果是尝试关闭过滤器（即显示隐藏内容），需要验证管理员密码
            if (!e.target.checked) {
                const isAdminVerified = await verifyAdminPassword();
                if (!isAdminVerified) {
                    // 如果验证失败，恢复开关状态并显示提示
                    e.target.checked = true;
                    showToast('需要管理员密码才能关闭隐藏内容过滤，密码提示:⟲', 'warning');
                    return;
                }
            }

            // 验证通过或开启过滤器，执行原有逻辑
            localStorage.setItem('hiddenFilterEnabled', e.target.checked);

            // 控制隐藏内容接口的显示状态
            const hiddendiv = document.getElementById('hiddendiv');
            if (e.target.checked === true) {
                // 如果启用过滤，则隐藏隐藏内容API
                if (hiddendiv) {
                    hiddendiv.style.display = 'none';
                }
            } else if (e.target.checked === false) {
                // 如果禁用过滤，刷新并显示隐藏内容API列表
                // 先移除已有的隐藏API区域
                if (hiddendiv) {
                    hiddendiv.remove();
                }
                // 重新创建隐藏API列表，确保所有隐藏API都显示出来
                addHiddenAPI();
            }
        });
    }

    // 广告过滤开关事件绑定
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.addEventListener('change', function (e) {
            localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, e.target.checked);
        });
    }

    // 搜索源过滤标签切换（事件委托）
    const sourceFilterTabs = document.getElementById('sourceFilterTabs');
    if (sourceFilterTabs) {
        sourceFilterTabs.addEventListener('click', function (e) {
            const tab = e.target.closest('.source-filter-tab');
            if (!tab) return;
            const sourceFilter = tab.dataset.source;
            if (!sourceFilter || sourceFilter === _activeSourceFilter) return;
            _applySourceFilter(sourceFilter);
        });
    }
}

// 重置搜索区域
function resetSearchArea() {
    // 关闭搜索历史下拉
    hideSearchHistory();

    // 清理搜索结果
    document.getElementById('results').innerHTML = '';
    document.getElementById('searchInput').value = '';

    // 恢复搜索区域的样式（恢复到初始状态：无flex-1、无mb-8）
    document.getElementById('searchArea').classList.remove('flex-1', 'mb-8');
    document.getElementById('resultsArea').classList.add('hidden');

    // 恢复居中布局 + 隐藏关闭按钮
    const homeLayout = document.querySelector('.home-layout');
    if (homeLayout) {
        homeLayout.classList.remove('has-results');
        void homeLayout.offsetHeight;
    }
    document.getElementById('closeSearchResults')?.classList.add('hidden');

    // 确保页脚正确显示，移除相对定位
    const footer = document.querySelector('.footer');
    if (footer) {
        footer.style.position = '';
    }

    // 重置URL为主页
    try {
        window.history.pushState(
            {},
            `LeLeTV - 乐乐影视`,
            `/`
        );
        // 更新页面标题
        document.title = `LeLeTV - 乐乐影视`;
    } catch (e) {
        console.error('更新浏览器历史失败:', e);
    }

    // 清空源过滤标签和状态
    const filterTabs = document.getElementById('sourceFilterTabs');
    if (filterTabs) filterTabs.innerHTML = '';
    _activeSourceFilter = 'all';
    _lastAllResults = [];
}

// 获取自定义API信息
function getCustomApiInfo(customApiIndex) {
    const index = parseInt(customApiIndex);
    if (isNaN(index) || index < 0 || index >= customAPIs.length) {
        return null;
    }
    return customAPIs[index];
}

// ========== 骨架屏辅助 ==========
function generateSkeletonCards(count = 8) {
    const cols = window.innerWidth < 640 ? 1 : window.innerWidth < 768 ? 2 : window.innerWidth < 1024 ? 3 : 4;
    const cards = [];
    for (let i = 0; i < Math.max(count, cols * 2); i++) {
        cards.push(`
            <div class="skeleton-card">
                <div class="skeleton-card-img"></div>
                <div class="skeleton-card-body">
                    <div class="skeleton-line" style="width: 85%"></div>
                    <div class="skeleton-line" style="width: 55%"></div>
                    <div class="skeleton-tags">
                        <div class="skeleton-tag"></div>
                        <div class="skeleton-tag"></div>
                    </div>
                    <div class="skeleton-line-sm" style="margin-top: auto;"></div>
                    <div class="skeleton-line-xs"></div>
                </div>
            </div>
        `);
    }
    return cards.join('');
}

// 搜索功能节流锁
let _searchThrottled = false;

// 搜索功能 - 修改为支持多选API和多页结果
async function search() {
    // 防重复搜索节流
    if (_searchThrottled) {
        showToast('请等待当前搜索完成', 'info');
        return;
    }
    _searchThrottled = true;
    hideSearchHistory();
    const releaseThrottle = () => { _searchThrottled = false; };
    // 强化的密码保护校验 - 防止绕过
    try {
        if (window.ensurePasswordProtection) {
            window.ensurePasswordProtection();
        } else {
            // 兼容性检查
            if (window.isPasswordProtected && window.isPasswordVerified) {
                if (window.isPasswordProtected() && !window.isPasswordVerified()) {
                    showPasswordModal && showPasswordModal();
                    releaseThrottle();
                    return;
                }
            }
        }
    } catch (error) {
        console.warn('Password protection check failed:', error.message);
        releaseThrottle();
        return;
    }
    const query = document.getElementById('searchInput').value.trim();

    if (!query) {
        showToast('请输入搜索内容', 'info');
        releaseThrottle();
        return;
    }

    if (selectedAPIs.length === 0) {
        showToast('请至少选择一个API源', 'warning');
        releaseThrottle();
        return;
    }

    // 在搜索前加入骨架屏
    const resultsDiv = document.getElementById('results');
    const resultsArea = document.getElementById('resultsArea');
    if (resultsDiv) {
        resultsDiv.innerHTML = generateSkeletonCards();
    }
    if (resultsArea) {
        resultsArea.classList.remove('hidden');
    }

    // 重置过滤状态
    _activeSourceFilter = 'all';
    _lastAllResults = [];

    // 初始渲染标签：基于 selectedAPIs，但过滤掉配置中已不存在的源
    _initFilterTabs();

    showLoading();

    try {
        // 保存搜索历史
        saveSearchHistory(query);

        // 从所有选中的API源搜索（渐进式渲染）
        let allResults = [];
        const hiddenFilterEnabled = localStorage.getItem('hiddenFilterEnabled') === 'true';

        // 显示结果区域，调整搜索区域
        document.getElementById('searchArea').classList.remove('flex-1');
        document.getElementById('searchArea').classList.add('mb-8');
        document.getElementById('resultsArea').classList.remove('hidden');

        // 抬升布局 + 显示关闭按钮
        document.querySelector('.home-layout')?.classList.add('has-results');
        document.getElementById('closeSearchResults')?.classList.remove('hidden');
        document.getElementById('closeSearchResults')?.classList.add('flex');

        // 更新URL
        try {
            const encodedQuery = encodeURIComponent(query);
            window.history.pushState(
                { search: query },
                `搜索: ${query} - LeLeTV`,
                `/s=${encodedQuery}`
            );
            document.title = `搜索: ${query} - LeLeTV`;
        } catch (e) {}

        
        // 构建搜索任务：每个API独立执行，结果立即追加
        const searchTasks = selectedAPIs.map(async (apiId) => {
            try {
                if (window.loadBalancer && window.loadBalancer.isApiOverloaded(apiId)) {
                    return;
                }
                const results = await searchByAPIAndKeyWord(apiId, query);
                if (!results || results.length === 0) return;

                let filtered = results;
                if (hiddenFilterEnabled) {
                    filtered = await applyFilter(results);
                }
                if (filtered.length === 0) return;

                allResults = allResults.concat(filtered);

                resultsDiv.insertAdjacentHTML('beforeend', _buildSearchCardsHtml(filtered));
                _updateAllTabCount(allResults.length);
            } catch (e) {
                console.warn(`API ${apiId} 搜索失败:`, e);
            }
        });

        if (!window.loadBalancer) {
            const fallbackResults = await performTraditionalSearch(query);
            if (fallbackResults.length > 0) {
                let filtered = fallbackResults;
                if (hiddenFilterEnabled) {
                    filtered = await applyFilter(fallbackResults);
                }
                allResults = filtered;
                resultsDiv.innerHTML = _buildSearchCardsHtml(filtered);
                _updateAllTabCount(filtered.length);
            }
        } else {
            await Promise.allSettled(searchTasks);
        }

        if (allResults.length > 0) {
            allResults.sort((a, b) => {
                const nameA = a.vod_name || '';
                const nameB = b.vod_name || '';
                const { base: baseA, season: seasonA } = _extractSeasonInfo(nameA);
                const { base: baseB, season: seasonB } = _extractSeasonInfo(nameB);
                const baseCompare = baseA.localeCompare(baseB, 'zh-CN');
                if (baseCompare !== 0) return baseCompare;
                if (seasonA !== null && seasonB !== null) return seasonA - seasonB;
                if (seasonA !== null) return -1;
                if (seasonB !== null) return 1;
                return (a.source_name || '').localeCompare(b.source_name || '', 'zh-CN');
            });
            _lastAllResults = allResults;
            _renderSourceFilterTabs(allResults.length);
            _applySourceFilter(_activeSourceFilter);
        } else {
            resultsDiv.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 class="mt-2 text-lg font-medium text-gray-400">没有找到匹配的结果</h3>
                    <p class="mt-1 text-sm text-gray-500">请尝试其他关键词或更换数据源</p>
                </div>
            `;
            document.getElementById('sourceFilterTabs').innerHTML = '';
            hideLoading();
            return;
        }

    } catch (error) {
        console.error('搜索错误:', error);
        if (error.name === 'AbortError') {
            showToast('搜索请求超时，请检查网络连接', 'error');
        } else {
            showToast('搜索请求失败，请稍后重试', 'error');
        }
    } finally {
        hideLoading();
        // 释放节流锁（延迟释放，防止短暂连点）
        setTimeout(releaseThrottle, 500);
    }
}

// 生成搜索卡片HTML（带XSS保护）
function _buildSearchCardsHtml(items) {
    return items.map(item => {
        const safeId = item.vod_id ? item.vod_id.toString().replace(/[^\w-]/g, '') : '';
        const safeName = (item.vod_name || '').toString()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const sourceInfo = item.source_name ?
            `<span class="bg-[#222] text-xs px-1.5 py-0.5 rounded-full">${item.source_name}</span>` : '';
        const sourceCode = item.source_code || '';
        const apiUrlAttr = item.api_url ?
            `data-api-url="${item.api_url.replace(/"/g, '&quot;')}"` : '';
        const hasCover = item.vod_pic && item.vod_pic.startsWith('http');

        return `
            <div class="card-hover rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] h-full shadow-sm hover:shadow-md" 
                 onclick="playDirectly('${safeId}','${safeName}','${sourceCode}')" ${apiUrlAttr}>
                <div class="flex h-full">
                    ${hasCover ? `
                    <div class="relative flex-shrink-0 search-card-img-container image-container">
                        <img src="${item.vod_pic}" alt="${safeName}" loading="lazy"
                             class="h-full w-full object-cover transition-transform hover:scale-110 loading-fade" 
                             onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=无封面'; this.classList.add('object-contain');"
                             onload="this.classList.add('loaded')">
                        <div class="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent"></div>
                    </div>` : ''}
                    
                    <div class="p-2 flex flex-col flex-grow">
                        <div class="flex-grow">
                            <h3 class="font-semibold mb-2 break-words line-clamp-2 ${hasCover ? '' : 'text-center'}" title="${safeName}">${safeName}</h3>
                            
                            <div class="flex flex-wrap ${hasCover ? '' : 'justify-center'} gap-1 mb-2">
                                ${(item.type_name || '').toString().replace(/</g, '&lt;') ?
                    `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">
                                      ${(item.type_name || '').toString().replace(/</g, '&lt;')}
                                  </span>` : ''}
                                ${(item.vod_year || '') ?
                    `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-purple-500 text-purple-300">
                                      ${item.vod_year}
                                  </span>` : ''}
                            </div>
                            <p class="text-gray-400 line-clamp-2 overflow-hidden ${hasCover ? '' : 'text-center'} mb-2">
                                ${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '&lt;')}
                            </p>
                        </div>
                        
                        <div class="flex justify-between items-center mt-1 pt-1 border-t border-gray-800">
                            ${sourceInfo ? `<div>${sourceInfo}</div>` : '<div></div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 中文数字转阿拉伯数字
function _chineseToNumber(str) {
    const chineseNums = {
        '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
        '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
        '十': 10, '百': 100, '千': 1000
    };
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    let result = 0;
    let temp = 0;
    for (const char of str) {
        const num = chineseNums[char];
        if (num === undefined) continue;
        if (num >= 10) {
            result += (temp || 1) * num;
            temp = 0;
        } else {
            temp = num;
        }
    }
    return result + temp;
}

// 从视频标题中提取基础片名和季/部/集序号
function _extractSeasonInfo(title) {
    const pattern = /第([一二三四五六七八九十百千\d]+)(季|部|集)/;
    const match = title.match(pattern);
    if (match) {
        const base = title.replace(pattern, '').replace(/\s+$/, '');
        return { base, season: _chineseToNumber(match[1]) };
    }
    const sPattern = /S(\d+)/i;
    const sMatch = title.match(sPattern);
    if (sMatch) {
        const base = title.replace(sPattern, '').replace(/\s+$/, '');
        return { base, season: parseInt(sMatch[1], 10) };
    }
    return { base: title, season: null };
}

// 获取API源的人类可读名称
function _getSourceLabel(apiId, results) {
    // 优先从结果中取实际返回的 source_name（来自搜索时实时读取的配置）
    if (results) {
        const match = results.find(r => r.source_code === apiId);
        if (match && match.source_name) return match.source_name;
    }
    if (apiId.startsWith('custom_')) {
        const idx = parseInt(apiId.replace('custom_', ''));
        const api = customAPIs[idx];
        return api ? api.name : `自定义源${idx + 1}`;
    }
    if (API_SITES[apiId]) return API_SITES[apiId].name;
    return apiId;
}

// 基于当前配置初始化过滤标签（初始渲染用，搜索完成后会被实际结果覆盖）
function _initFilterTabs() {
    const container = document.getElementById('sourceFilterTabs');
    if (!container) return;
    if (!selectedAPIs || selectedAPIs.length === 0) {
        container.innerHTML = '';
        return;
    }
    // 只保留当前配置中真实存在的源
    const validApis = selectedAPIs.filter(id => {
        if (id.startsWith('custom_')) {
            const idx = parseInt(id.replace('custom_', ''));
            return idx >= 0 && idx < customAPIs.length;
        }
        return !!API_SITES[id];
    });
    if (validApis.length === 0) {
        container.innerHTML = '';
        return;
    }
    let html = '<button class="source-filter-tab active" data-source="all">全部 (0)</button>';
    validApis.forEach(id => {
        const label = _getSourceLabel(id);
        html += `<button class="source-filter-tab" data-source="${id}">${label}</button>`;
    });
    container.innerHTML = html;
}

// 渲染搜索源过滤标签（从实际搜索结果中提取源列表）
function _renderSourceFilterTabs(totalCount) {
    const container = document.getElementById('sourceFilterTabs');
    if (!container) return;
    if (!_lastAllResults || _lastAllResults.length === 0) {
        container.innerHTML = '';
        return;
    }
    const allCount = totalCount || _lastAllResults.length;

    // 从搜索结果中收集唯一的 source_code
    const seen = new Set();
    const uniqueSources = [];
    _lastAllResults.forEach(item => {
        const code = item.source_code;
        if (code && !seen.has(code)) {
            seen.add(code);
            uniqueSources.push(code);
        }
    });

    let html = `<button class="source-filter-tab active" data-source="all">全部 (${allCount})</button>`;
    uniqueSources.forEach(code => {
        const label = _getSourceLabel(code, _lastAllResults);
        const count = _lastAllResults.filter(r => r.source_code === code).length;
        html += `<button class="source-filter-tab" data-source="${code}">${label} (${count})</button>`;
    });
    container.innerHTML = html;
}

// 更新「全部」标签的计数
function _updateAllTabCount(count) {
    const allTab = document.querySelector('#sourceFilterTabs .source-filter-tab[data-source="all"]');
    if (allTab) {
        allTab.textContent = `全部 (${count})`;
    }
    // 同步更新各源标签计数
    const container = document.getElementById('sourceFilterTabs');
    if (!container || !_lastAllResults) return;
    container.querySelectorAll('.source-filter-tab:not([data-source="all"])').forEach(tab => {
        const code = tab.dataset.source;
        const count = _lastAllResults.filter(r => r.source_code === code).length;
        const label = _getSourceLabel(code, _lastAllResults);
        tab.textContent = `${label} (${count})`;
    });
}

// 按源过滤搜索结果并重绘
function _applySourceFilter(sourceFilter) {
    _activeSourceFilter = sourceFilter;

    // 更新标签激活状态
    document.querySelectorAll('#sourceFilterTabs .source-filter-tab').forEach(tab => {
        const isActive = tab.dataset.source === sourceFilter;
        tab.classList.toggle('active', isActive);
    });

    // 过滤结果
    let filteredResults = _lastAllResults;
    if (sourceFilter !== 'all') {
        filteredResults = _lastAllResults.filter(item => item.source_code === sourceFilter);
    }

    // 重绘
    document.getElementById('results').innerHTML = _buildSearchCardsHtml(filteredResults);

    // 重置滚动位置到结果区域顶部
    const resultsArea = document.getElementById('resultsArea');
    if (resultsArea) {
        resultsArea.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
}

// 设置邮箱点击事件处理器
function setupEmailClickHandlers() {
    const contactElements = [
        document.getElementById('contactLeLe'),
        document.getElementById('contactLeLe2'),
        document.getElementById('contactLeLe3'),
        document.getElementById('contactLeLe4'),
        document.getElementById('contactLeLe5'),
        document.getElementById('contactLeLe6'),
        document.getElementById('contactLeLe7')
    ];
    contactElements.forEach(element => {
        if (element) {
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
        }
    });
}

// 关闭搜索结果，恢复居中布局
function closeSearchResults() {
    resetSearchArea();
}

// 劫持搜索框的value属性以检测外部修改
function hookInput() {
    const input = document.getElementById('searchInput');
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    // 重写 value 属性的 getter 和 setter
    Object.defineProperty(input, 'value', {
        get: function () {
            // 确保读取时返回字符串（即使原始值为 undefined/null）
            const originalValue = descriptor.get.call(this);
            return originalValue != null ? String(originalValue) : '';
        },
        set: function (value) {
            // 显式将值转换为字符串后写入
            const strValue = String(value);
            descriptor.set.call(this, strValue);
            this.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // 初始化输入框值为空字符串（避免初始值为 undefined）
    input.value = '';
}
document.addEventListener('DOMContentLoaded', hookInput);

// 从URL导入配置
async function importConfigFromUrl() {
    // 创建模态框元素
    let modal = document.getElementById('importUrlModal');
    if (modal) {
        document.body.removeChild(modal);
    }

    modal = document.createElement('div');
    modal.id = 'importUrlModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';

    modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeUrlModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold mb-4">从URL导入配置</h3>
            
            <div class="mb-4">
                <input type="text" id="configUrl" placeholder="输入配置文件URL" 
                       class="w-full px-3 py-2 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-2">
                <button id="confirmUrlImport" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">导入</button>
                <button id="cancelUrlImport" class="bg-[#444] hover:bg-[#555] text-white px-4 py-2 rounded">取消</button>
            </div>
        </div`;

    document.body.appendChild(modal);

    // 关闭按钮事件
    document.getElementById('closeUrlModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 取消按钮事件
    document.getElementById('cancelUrlImport').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 确认导入按钮事件
    document.getElementById('confirmUrlImport').addEventListener('click', async () => {
        const url = document.getElementById('configUrl').value.trim();
        if (!url) {
            showToast('请输入配置文件URL', 'warning');
            return;
        }

        // 验证URL格式
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                showToast('URL必须以http://或https://开头', 'warning');
                return;
            }
        } catch (e) {
            showToast('URL格式不正确', 'warning');
            return;
        }

        showLoading('正在从URL导入配置...');

        try {
            // 获取配置文件 - 直接请求URL
            const response = await fetch(url, {
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) throw '获取配置文件失败';

            // 验证响应内容类型
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw '响应不是有效的JSON格式';
            }

            const config = await response.json();
            if (config.name !== 'LeLeTV-Settings') throw '配置文件格式不正确';

            // 验证哈希
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

            // 导入配置
            for (let item in config.data) {
                localStorage.setItem(item, config.data[item]);
            }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '导入配置失败';
            showToast(`从URL导入配置出错 (${message})`, 'error');
        } finally {
            hideLoading();
            document.body.removeChild(modal);
        }
    });

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// 配置文件导入功能
async function importConfig() {
    showImportBox(async (file) => {
        try {
            // 检查文件类型
            if (!(file.type === 'application/json' || file.name.endsWith('.json'))) throw '文件类型不正确';

            // 检查文件大小
            if (file.size > 1024 * 1024 * 10) throw new Error('文件大小超过 10MB');

            // 读取文件内容
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject('文件读取失败');
                reader.readAsText(file);
            });

            // 解析并验证配置
            const config = JSON.parse(content);
            if (config.name !== 'LeLeTV-Settings') throw '配置文件格式不正确';

            // 验证哈希
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

            // 导入配置
            for (let item in config.data) {
                localStorage.setItem(item, config.data[item]);
            }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '配置文件格式错误';
            showToast(`配置文件读取出错 (${message})`, 'error');
        }
    });
}

// 配置文件导出功能
async function exportConfig() {
    // 存储配置数据
    const config = {};
    const items = {};

    const settingsToExport = [
        'selectedAPIs',
        'customAPIs',
        'hiddenFilterEnabled',
        'adFilteringEnabled',
        'hasInitializedDefaults'
    ];

    // 导出设置项
    settingsToExport.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            items[key] = value;
        }
    });

    // 导出历史记录
    const viewingHistory = localStorage.getItem('viewingHistory');
    if (viewingHistory) {
        items['viewingHistory'] = viewingHistory;
    }

    const searchHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (searchHistory) {
        items[SEARCH_HISTORY_KEY] = searchHistory;
    }

    const times = Date.now().toString();
    config['name'] = 'LeLeTV-Settings';  // 配置文件名，用于校验
    config['time'] = times;               // 配置文件生成时间
    config['cfgVer'] = '1.0.0';           // 配置文件版本
    config['data'] = items;               // 配置文件数据
    config['hash'] = await sha256(JSON.stringify(config['data']));  // 计算数据的哈希值，用于校验

    // 将配置数据保存为 JSON 文件
    saveStringAsFile(JSON.stringify(config), 'LeLeTV-Settings_' + times + '.json');
}

// 将字符串保存为文件
function saveStringAsFile(content, fileName) {
    // 创建Blob对象并指定类型
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    // 生成临时URL
    const url = window.URL.createObjectURL(blob);
    // 创建<a>标签并触发下载
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    // 清理临时对象
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// 传统搜索方式（作为降级选项）
async function performTraditionalSearch(query) {
    const searchPromises = selectedAPIs.map(apiId => 
        searchByAPIAndKeyWord(apiId, query)
    );
    
    // 等待所有搜索请求完成
    const resultsArray = await Promise.all(searchPromises);
    
    let allResults = [];
    resultsArray.forEach(results => {
        if (Array.isArray(results) && results.length > 0) {
            allResults = allResults.concat(results);
        }
    });
    
    return allResults;
}
