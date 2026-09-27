// 全局变量（跨文件共享，api-config.js 最先加载）
// 注意: 使用 typeof 而不用 in 检查，避免 var 提升导致误判
if (typeof window.selectedAPIs === 'undefined') {
    window.selectedAPIs = [];
}
if (typeof window.customAPIs === 'undefined') {
    window.customAPIs = JSON.parse(localStorage.getItem(scopedKey('customAPIs')) || '[]');
}
var selectedAPIs = window.selectedAPIs;
var customAPIs = window.customAPIs;

// 验证私密密码
function verifyAdminPassword() {
    return new Promise((resolve) => {
        // 检查是否设置了私密密码
        const adminPasswordHash = window.__ENV__ && window.__ENV__.HIDDENKEY;
        if (!adminPasswordHash) {
            showToast('未配置私密模式的访问密码，无法切换', 'error');
            resolve(false);
            return;
        }

        const overlay = showModal({
            title: '私密模式',
            // 点右上角 × 或点击遮罩关闭时也必须 resolve(false)。否则调用方的 await 会一直挂起，
            // 开关视觉停留在「开」（存储未写入，刷新后才回退）
            onClose: () => resolve(false),
            content: (body) => {
                body.innerHTML = `
                    <div class="v2-field">
                        <p class="v2-confirm-text">切换到私密片源前，请输入访问密码。</p>
                        <input type="password" id="adminPasswordInput" class="v2-input" placeholder="访问密码" autocomplete="current-password">
                        <p id="adminPasswordError" class="v2-error hidden" role="alert"></p>
                    </div>
                    <div class="v2-dialog-foot">
                        <button type="button" id="adminPasswordCancelBtn" class="v2-btn v2-btn--secondary">取消</button>
                        <button type="button" id="adminPasswordSubmitBtn" class="v2-btn v2-btn--primary">确认</button>
                    </div>
                `;
            }
        });


        const passwordInput = overlay.querySelector('#adminPasswordInput');
        const submitBtn = overlay.querySelector('#adminPasswordSubmitBtn');
        const cancelBtn = overlay.querySelector('#adminPasswordCancelBtn');
        const errorMsg = overlay.querySelector('#adminPasswordError');

        // 聚焦到密码输入框
        setTimeout(() => passwordInput?.focus(), 100);

        const cleanup = () => { overlay.remove(); resolve(false); };

        const verifyPassword = async () => {
            const inputPassword = passwordInput.value.trim();
            if (!inputPassword) {
                errorMsg.textContent = '请输入访问密码';
                errorMsg.classList.remove('hidden');
                return;
            }

            try {
                // 使用与服务器端相同的哈希方法
                const inputHash = await window._jsSha256(inputPassword);
                if (inputHash === adminPasswordHash) {
                    overlay.remove();
                    resolve(true);
                } else {
                    errorMsg.textContent = '密码不正确，请重试';
                    errorMsg.classList.remove('hidden');
                    passwordInput.select();
                }
            } catch (error) {
                console.error('密码验证失败:', error);
                errorMsg.textContent = '验证过程出错，请重试';
                errorMsg.classList.remove('hidden');
            }
        };

        submitBtn.addEventListener('click', verifyPassword);
        cancelBtn.addEventListener('click', cleanup);

        // 支持回车键提交
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') verifyPassword();
        });

        // 支持ESC键取消
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') cleanup();
        });
    });
}

// 重置数据源选择逻辑
function resetDataSourceLogic() {
    // 清除所有相关的本地存储项
    localStorage.removeItem('dataSourceLogicVersion');
    localStorage.removeItem(scopedKey('selectedAPIs'));
    localStorage.removeItem('hasUserSelectedAPIs');
    localStorage.removeItem('lastRefreshTime');
    
    // 显示提示信息
    showToast(isHiddenContentMode()
        ? '已重置，随机选取 5 个私密内容源'
        : `已重置，恢复默认 ${DEFAULT_DATA_SOURCE_KEYS.length} 个数据源`, 'success');
    
    // 重新初始化API复选框，应用新逻辑
    initAPICheckboxes();
}

// 初始化API复选框
function initAPICheckboxes() {
    const container = document.getElementById('apiCheckboxes');
    
    // 强制重新创建所有UI元素，确保每次刷新都能更新
    container.innerHTML = '';
    
    // 从当前版本开始，对所有用户应用新的数据源选择逻辑
    applyNewDataSourceLogic();

    // 立即更新选中的API数量显示
    updateSelectedApiCount();

    // 添加普通API组标题
    const normaldiv = document.createElement('div');
    normaldiv.id = 'normaldiv';
    normaldiv.className = 'contents';
    const normalTitle = document.createElement('div');
    normalTitle.className = 'api-group-title';
    // 标题与可见源都由当前数据域决定：正常域「普通资源」/ 隐藏域「私密资源采集站」
    if (isHiddenContentMode()) {
        normalTitle.className = 'api-group-title hidden';
        normalTitle.innerHTML = `私密片源 <span class="hidden-warning">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </span>`;
    } else {
        normalTitle.textContent = '全部片源';
    }
    normaldiv.appendChild(normalTitle);

    // 只渲染当前数据域的源，另一个域的内容完全不出现
    Object.keys(API_SITES).forEach(apiKey => {
        const api = API_SITES[apiKey];
        if (isHiddenContentMode() ? !api.hidden : !!api.hidden) return;

        const checked = selectedAPIs.includes(apiKey);

        // 一行一个小开关：input 只负责状态，开关本体是后面的 span，名字在最右
        const checkbox = document.createElement('label');
        checkbox.className = 'v2-src-item';
        checkbox.setAttribute('for', `api_${apiKey}`);
        checkbox.innerHTML = `
            <input type="checkbox" id="api_${apiKey}" class="v2-switch-input"
                   ${checked ? 'checked' : ''}
                   data-api="${apiKey}"
                   data-role="api-toggle">
            <span class="v2-switch" aria-hidden="true"></span>
            <span class="v2-src-name"></span>
        `;
        checkbox.querySelector('.v2-src-name').textContent = api.name;
        normaldiv.appendChild(checkbox);

        checkbox.querySelector('[data-role="api-toggle"]').addEventListener('change', function () {
            updateSelectedAPIs();
            checkHiddenAPIsSelected();
        });
    });
    container.appendChild(normaldiv);

    // 自定义API的「隐藏资源站」标记由当前数据域决定，不允许手动改
    const hiddenFlagInput = document.getElementById('customApiIsHidden');
    if (hiddenFlagInput) {
        hiddenFlagInput.checked = isHiddenContentMode();
        hiddenFlagInput.disabled = true;
    }

    // 同步开关状态
    checkHiddenAPIsSelected();
}

// 数据源选择逻辑版本：升版本会让所有用户按下面的默认逻辑重新选源（v2 起默认固定 6 个源）
const DATA_SOURCE_LOGIC_VERSION = 'v2';

// 从当前版本开始，对所有用户应用新的数据源选择逻辑
function applyNewDataSourceLogic() {
    const currentVersion = localStorage.getItem('dataSourceLogicVersion');
    const currentTime = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    // 按当前数据域取默认源（正常域固定 6 个，隐藏域随机 5 个）
    const defaultSelected = getDefaultDataSources();

    if (currentVersion !== DATA_SOURCE_LOGIC_VERSION) {
        selectedAPIs = defaultSelected.slice();
        localStorage.setItem(scopedKey('selectedAPIs'), JSON.stringify(selectedAPIs));
        localStorage.setItem('lastRefreshTime', currentTime.toString());
        localStorage.setItem('hasUserSelectedAPIs', 'false');
        localStorage.setItem('dataSourceLogicVersion', DATA_SOURCE_LOGIC_VERSION);
    } else {
        const lastRefreshTime = localStorage.getItem('lastRefreshTime');
        const hasUserSelected = localStorage.getItem('hasUserSelectedAPIs') === 'true';

        if (lastRefreshTime && currentTime - parseInt(lastRefreshTime) >= dayInMs) {
            refreshDataSources(hasUserSelected);
        }

        const savedSelectedAPIs = localStorage.getItem(scopedKey('selectedAPIs'));
        if (savedSelectedAPIs) {
            selectedAPIs = JSON.parse(savedSelectedAPIs);
        } else {
            selectedAPIs = defaultSelected.slice();
            localStorage.setItem(scopedKey('selectedAPIs'), JSON.stringify(selectedAPIs));
            localStorage.setItem('lastRefreshTime', currentTime.toString());
            localStorage.setItem('hasUserSelectedAPIs', 'false');
        }
    }
}

// 刷新数据源
function refreshDataSources(hasUserSelected) {
    const currentTime = Date.now();
    const savedSelectedAPIs = localStorage.getItem(scopedKey('selectedAPIs')) || '[]';
    const currentSelectedAPIs = JSON.parse(savedSelectedAPIs);
    // 保留所有内置源（含隐藏源）与有效自定义源；仅剔除已不存在的源
    const allDataSources = Object.keys(API_SITES);
    const updatedSelectedAPIs = currentSelectedAPIs.filter(api => 
        allDataSources.includes(api) || api.startsWith('custom_')
    );
    selectedAPIs = updatedSelectedAPIs;
    localStorage.setItem(scopedKey('selectedAPIs'), JSON.stringify(selectedAPIs));
    localStorage.setItem('lastRefreshTime', currentTime.toString());
}

// 默认选中的数据源（正常域固定，顺序即界面里的展示顺序）
const DEFAULT_DATA_SOURCE_KEYS = ['gszy', 'bfzy', 'zuid', 'lzzy', 'hnzy', 'jszy'];

// 数据域内的默认选中源：正常域取固定清单，隐藏域仍从私密源里随机抽 5 个
function getDefaultDataSources() {
    if (!isHiddenContentMode()) {
        const keys = DEFAULT_DATA_SOURCE_KEYS.filter(key => API_SITES[key] && !API_SITES[key].hidden);
        if (keys.length > 0) return keys;
    }
    return getRandomDataSources(5);
}

// 随机选择指定数量的数据源（按当前数据域取池子：正常域取普通源，隐藏域取隐藏源）
// 仅隐藏域还在用；正常域的默认源见 getDefaultDataSources()
function getRandomDataSources(count) {
    const pool = Object.keys(API_SITES).filter(key =>
        isHiddenContentMode() ? !!API_SITES[key].hidden : !API_SITES[key].hidden
    );
    if (pool.length <= count) {
        return pool;
    }
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// 同步"隐藏内容模式"开关的显示状态（当前数据域由开关本身决定，不再与源选择互斥）
function checkHiddenAPIsSelected() {
    const hiddenModeToggle = document.getElementById('hiddenContentModeToggle');
    if (hiddenModeToggle) {
        hiddenModeToggle.checked = isHiddenContentMode();
    }
}

// 渲染自定义API列表（只列出当前数据域的条目，另一个域完全不出现）
function renderCustomAPIsList() {
    const container = document.getElementById('customApisList');
    if (!container) return;

    const hiddenMode = isHiddenContentMode();
    const visible = customAPIs
        .map((api, index) => ({ api, index }))
        .filter(({ api }) => hiddenMode ? !!api.isHidden : !api.isHidden);

    if (visible.length === 0) {
        container.innerHTML = `<p class="v2-empty-line">${hiddenMode ? '尚未添加私密资源站' : '尚未添加自定义资源站'}</p>`;
        return;
    }

    container.innerHTML = '';
    visible.forEach(({ api, index }) => {
        const apiItem = document.createElement('div');
        apiItem.className = 'v2-custom-api';
        const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const hiddenTag = api.isHidden ? '<em>私密</em>' : '';
        apiItem.innerHTML = `
            <label class="v2-switch-wrap" for="custom_api_${index}">
                <input type="checkbox" id="custom_api_${index}"
                       class="v2-switch-input ${api.isHidden ? 'api-hidden' : ''}"
                       ${selectedAPIs.includes('custom_' + index) ? 'checked' : ''}
                       data-custom-index="${index}"
                       data-role="api-toggle" aria-label="启用 ${esc(api.name)}">
                <span class="v2-switch" aria-hidden="true"></span>
            </label>
            <div class="v2-custom-api-info">
                <div class="v2-custom-api-name">${hiddenTag}${esc(api.name)}</div>
                <div class="v2-custom-api-url" title="${esc(api.url)}">${esc(api.url)}</div>
                ${api.detail ? `<div class="v2-custom-api-url" title="${esc(api.detail)}">详情接口：${esc(api.detail)}</div>` : ''}
            </div>
            <div class="v2-custom-api-actions">
                <button type="button" class="v2-icon-btn" data-action="edit-custom-api" data-index="${index}" aria-label="编辑">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16.86 4.49 2.65 2.65M4 20l3.5-.9 11.3-11.3a1.87 1.87 0 0 0-2.65-2.65L4.85 16.45 4 20Z"/></svg>
                </button>
                <button type="button" class="v2-icon-btn is-danger" data-action="remove-custom-api" data-index="${index}" aria-label="删除">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
            </div>
        `;
        container.appendChild(apiItem);
        apiItem.querySelector('[data-role="api-toggle"]').addEventListener('change', function () {
            updateSelectedAPIs();
            checkHiddenAPIsSelected();
        });
    });
}

// 编辑自定义API
function editCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const api = customAPIs[index];
    document.getElementById('customApiName').value = api.name;
    document.getElementById('customApiUrl').value = api.url;
    document.getElementById('customApiDetail').value = api.detail || '';
    const isHiddenInput = document.getElementById('customApiIsHidden');
    if (isHiddenInput) isHiddenInput.checked = api.isHidden || false;
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
        const buttonContainer = form.querySelector('div:last-child');
        buttonContainer.innerHTML = `
            <button type="button" data-action="cancel-edit-custom-api" class="v2-btn v2-btn--secondary v2-btn--sm">取消</button>
            <button type="button" data-action="update-custom-api" data-index="${index}" class="v2-btn v2-btn--primary v2-btn--sm">保存</button>
        `;
    }
}

// 更新自定义API
function updateCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const detailInput = document.getElementById('customApiDetail');
    const isHiddenInput = document.getElementById('customApiIsHidden');
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const detail = detailInput ? detailInput.value.trim() : '';
    if (!name || !url) {
        showToast('请填写名称和接口地址', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('接口地址需以 http:// 或 https:// 开头', 'warning');
        return;
    }
    if (url.endsWith('/')) url = url.slice(0, -1);
    // 隐藏标记由当前数据域决定，与复选框无关
    customAPIs[index] = { name, url, detail, isHidden: isHiddenContentMode() };
    localStorage.setItem(scopedKey('customAPIs'), JSON.stringify(customAPIs));
    renderCustomAPIsList();
    checkHiddenAPIsSelected();
    restoreAddCustomApiButtons();
    nameInput.value = '';
    urlInput.value = '';
    if (detailInput) detailInput.value = '';
    if (isHiddenInput) isHiddenInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
    showToast('已保存：' + name, 'success');
}

// 取消编辑自定义API
function cancelEditCustomApi() {
    // 清空表单
    document.getElementById('customApiName').value = '';
    document.getElementById('customApiUrl').value = '';
    document.getElementById('customApiDetail').value = '';
    const isHiddenInput = document.getElementById('customApiIsHidden');
    if (isHiddenInput) isHiddenInput.checked = false;

    // 隐藏表单
    document.getElementById('addCustomApiForm').classList.add('hidden');

    // 恢复添加按钮
    restoreAddCustomApiButtons();
}

// 恢复自定义API添加按钮
function restoreAddCustomApiButtons() {
    const form = document.getElementById('addCustomApiForm');
    const buttonContainer = form.querySelector('div:last-child');
    buttonContainer.innerHTML = `
        <button type="button" data-action="cancel-add-custom-api" class="v2-btn v2-btn--secondary v2-btn--sm">取消</button>
        <button type="button" data-action="add-custom-api" class="v2-btn v2-btn--primary v2-btn--sm">添加</button>
    `;
}

// 更新选中的API列表
function updateSelectedAPIs() {
    // 获取所有内置API复选框
    const builtInApiCheckboxes = document.querySelectorAll('#apiCheckboxes input:checked');

    // 获取选中的内置API
    const builtInApis = Array.from(builtInApiCheckboxes).map(input => input.dataset.api);

    // 获取选中的自定义API
    const customApiCheckboxes = document.querySelectorAll('#customApisList input:checked');
    const customApiIndices = Array.from(customApiCheckboxes).map(input => 'custom_' + input.dataset.customIndex);

    // 合并内置和自定义API
    selectedAPIs = [...builtInApis, ...customApiIndices];

    // 保存到localStorage（当前数据域）
    localStorage.setItem(scopedKey('selectedAPIs'), JSON.stringify(selectedAPIs));
    // 标记用户已经做过选择
    localStorage.setItem('hasUserSelectedAPIs', 'true');

    // 更新显示选中的API数量
    updateSelectedApiCount();
}

// 更新选中的API数量显示
function updateSelectedApiCount() {
    const countEl = document.getElementById('selectedApiCount');
    if (countEl) {
        countEl.textContent = selectedAPIs.length;
    }
}

// 全选或取消全选API
function selectAllAPIs(selectAll = true, excludeHidden = false) {
    const checkboxes = document.querySelectorAll('#apiCheckboxes input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        if (excludeHidden && checkbox.classList.contains('api-hidden')) {
            checkbox.checked = false;
        } else {
            checkbox.checked = selectAll;
        }
    });

    updateSelectedAPIs();
    checkHiddenAPIsSelected();
}

// 显示添加自定义API表单
function showAddCustomApiForm() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
    }
}

// 取消添加自定义API - 修改函数来重用恢复按钮逻辑
function cancelAddCustomApi() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.add('hidden');
        document.getElementById('customApiName').value = '';
        document.getElementById('customApiUrl').value = 'https://xxx.example.com/api.php/provide/vod/';
        document.getElementById('customApiDetail').value = '';
        const isHiddenInput = document.getElementById('customApiIsHidden');
        if (isHiddenInput) isHiddenInput.checked = false;

        // 确保按钮是添加按钮
        restoreAddCustomApiButtons();
    }
}

// 添加自定义API
function addCustomApi() {
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const detailInput = document.getElementById('customApiDetail');
    const isHiddenInput = document.getElementById('customApiIsHidden');
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const detail = detailInput ? detailInput.value.trim() : '';
    if (!name || !url) {
        showToast('请填写名称和接口地址', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('接口地址需以 http:// 或 https:// 开头', 'warning');
        return;
    }
    if (url === 'https://xxx.example.com/api.php/provide/vod/') {
        showToast('请把示例地址替换为实际的接口地址', 'warning');
        return;
    }
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    // 隐藏标记由当前数据域决定，与复选框无关
    customAPIs.push({ name, url, detail, isHidden: isHiddenContentMode() });
    localStorage.setItem(scopedKey('customAPIs'), JSON.stringify(customAPIs));
    const newApiIndex = customAPIs.length - 1;
    selectedAPIs.push('custom_' + newApiIndex);
    localStorage.setItem(scopedKey('selectedAPIs'), JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();
    updateSelectedApiCount();
    checkHiddenAPIsSelected();
    nameInput.value = '';
    urlInput.value = '';
    if (detailInput) detailInput.value = '';
    if (isHiddenInput) isHiddenInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
    showToast('已添加：' + name, 'success');
}

// 移除自定义API
function removeCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;

    const apiName = customAPIs[index].name;

    // 从列表中移除API
    customAPIs.splice(index, 1);
    localStorage.setItem(scopedKey('customAPIs'), JSON.stringify(customAPIs));

    // 从选中列表中移除此API
    const customApiId = 'custom_' + index;
    selectedAPIs = selectedAPIs.filter(id => id !== customApiId);

    // 更新大于此索引的自定义API索引
    selectedAPIs = selectedAPIs.map(id => {
        if (id.startsWith('custom_')) {
            const currentIndex = parseInt(id.replace('custom_', ''));
            if (currentIndex > index) {
                return 'custom_' + (currentIndex - 1);
            }
        }
        return id;
    });

    localStorage.setItem(scopedKey('selectedAPIs'), JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();

    // 更新选中的API数量
    updateSelectedApiCount();

    // 重新检查隐藏API选中状态
    checkHiddenAPIsSelected();

    showToast('已删除：' + apiName, 'info');
}