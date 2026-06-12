// 全局变量（跨文件共享，api-config.js 最先加载）
// 注意: 使用 typeof 而不用 in 检查，避免 var 提升导致误判
if (typeof window.selectedAPIs === 'undefined') {
    window.selectedAPIs = [];
}
if (typeof window.customAPIs === 'undefined') {
    window.customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
}
var selectedAPIs = window.selectedAPIs;
var customAPIs = window.customAPIs;

// 验证管理员密码
function verifyAdminPassword() {
    return new Promise((resolve) => {
        // 检查是否设置了管理员密码
        const adminPasswordHash = window.__ENV__ && window.__ENV__.ADMINPASSWORD;
        if (!adminPasswordHash) {
            showToast('未设置隐藏内容密码，无法修改隐藏内容过滤设置', 'error');
            resolve(false);
            return;
        }

        const overlay = showModal({
            title: '隐藏内容验证',
            content: (body) => {
                body.innerHTML = `
                    <p class="text-gray-300 mb-4">请输入隐藏密码以解锁🔓隐藏🈲内容过滤设置，密码提示:⟲</p>
                    <input type="password" id="adminPasswordInput" class="w-full bg-[#111] border border-[var(--color-border-default)] text-white px-4 py-3 rounded-lg focus:outline-none focus:border-white transition-colors" placeholder="管理员密码...">
                    <div class="mt-4 flex space-x-4">
                        <button id="adminPasswordSubmitBtn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">确认</button>
                        <button id="adminPasswordCancelBtn" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">取消</button>
                    </div>
                    <p id="adminPasswordError" class="text-red-500 mt-2 hidden">隐藏密码错误，请重试，试试password反过来！</p>
                `;
            }
        });

        // 提升 z-index 使其高于其他弹窗
        overlay.style.zIndex = '70';

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
                errorMsg.textContent = '请输入隐藏内容密码';
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
                    errorMsg.textContent = '隐藏内容密码错误，请重试';
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
    localStorage.removeItem('selectedAPIs');
    localStorage.removeItem('hasUserSelectedAPIs');
    localStorage.removeItem('lastRefreshTime');
    
    // 显示提示信息
    showToast('数据源选择逻辑已重置，将应用新的选择规则', 'success');
    
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
    normalTitle.textContent = '普通资源';
    normaldiv.appendChild(normalTitle);

    // 创建普通API源的复选框
    Object.keys(API_SITES).forEach(apiKey => {
        const api = API_SITES[apiKey];
        if (api.hidden) return;

        const checked = selectedAPIs.includes(apiKey);

        const checkbox = document.createElement('div');
        checkbox.className = 'flex items-center';
        checkbox.innerHTML = `
            <input type="checkbox" id="api_${apiKey}" 
                   class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333]" 
                   ${checked ? 'checked' : ''} 
                   data-api="${apiKey}"
                       data-role="api-toggle">
            <label for="api_${apiKey}" class="ml-1 text-xs text-gray-400 truncate">${api.name}</label>
        `;
        normaldiv.appendChild(checkbox);

        checkbox.querySelector('[data-role="api-toggle"]').addEventListener('change', function () {
            updateSelectedAPIs();
            checkHiddenAPIsSelected();
        });
    });
    container.appendChild(normaldiv);

    // 添加隐藏API列表
    addHiddenAPI();

    // 初始检查隐藏内容状态
    checkHiddenAPIsSelected();
}

// 从当前版本开始，对所有用户应用新的数据源选择逻辑
function applyNewDataSourceLogic() {
    const DATA_SOURCE_LOGIC_VERSION = 'v1';
    const currentVersion = localStorage.getItem('dataSourceLogicVersion');
    const currentTime = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (currentVersion !== DATA_SOURCE_LOGIC_VERSION) {
        selectedAPIs = getRandomDataSources(5);
        localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
        localStorage.setItem('lastRefreshTime', currentTime.toString());
        localStorage.setItem('hasUserSelectedAPIs', 'false');
        localStorage.setItem('dataSourceLogicVersion', DATA_SOURCE_LOGIC_VERSION);
    } else {
        const lastRefreshTime = localStorage.getItem('lastRefreshTime');
        const hasUserSelected = localStorage.getItem('hasUserSelectedAPIs') === 'true';

        if (lastRefreshTime && currentTime - parseInt(lastRefreshTime) >= dayInMs) {
            refreshDataSources(hasUserSelected);
        }

        const savedSelectedAPIs = localStorage.getItem('selectedAPIs');
        if (savedSelectedAPIs) {
            selectedAPIs = JSON.parse(savedSelectedAPIs);
        } else {
            selectedAPIs = getRandomDataSources(5);
            localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
            localStorage.setItem('lastRefreshTime', currentTime.toString());
            localStorage.setItem('hasUserSelectedAPIs', 'false');
        }
    }
}

// 刷新数据源
function refreshDataSources(hasUserSelected) {
    const currentTime = Date.now();
    const savedSelectedAPIs = localStorage.getItem('selectedAPIs') || '[]';
    const currentSelectedAPIs = JSON.parse(savedSelectedAPIs);
    const allDataSources = Object.keys(API_SITES).filter(key => !API_SITES[key].hidden);
    const updatedSelectedAPIs = currentSelectedAPIs.filter(api => 
        allDataSources.includes(api) || api.startsWith('custom_')
    );
    selectedAPIs = updatedSelectedAPIs;
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
    localStorage.setItem('lastRefreshTime', currentTime.toString());
}

// 随机选择指定数量的数据源
function getRandomDataSources(count) {
    const normalDataSources = Object.keys(API_SITES).filter(key => !API_SITES[key].hidden);
    if (normalDataSources.length <= count) {
        return normalDataSources;
    }
    const shuffled = [...normalDataSources].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// 添加隐藏API列表
function addHiddenAPI() {
    // 仅在隐藏设置为false时添加隐藏API组
    if (!HIDE_BUILTIN_HIDDEN_APIS && (localStorage.getItem('hiddenFilterEnabled') === 'false')) {
        const container = document.getElementById('apiCheckboxes');

        // 添加隐藏API组标题
        const hiddendiv = document.createElement('div');
        hiddendiv.id = 'hiddendiv';
        hiddendiv.className = 'contents';
        const hiddenTitle = document.createElement('div');
        hiddenTitle.className = 'api-group-title hidden';
        hiddenTitle.innerHTML = `隐藏资源采集站 <span class="hidden-warning">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </span>`;
        hiddendiv.appendChild(hiddenTitle);

        // 创建隐藏API源的复选框
        Object.keys(API_SITES).forEach(apiKey => {
            const api = API_SITES[apiKey];
            if (!api.hidden) return; // 仅添加隐藏内容API

            const checked = selectedAPIs.includes(apiKey);

            const checkbox = document.createElement('div');
            checkbox.className = 'flex items-center';
            checkbox.innerHTML = `
                <input type="checkbox" id="api_${apiKey}" 
                       class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333] api-hidden" 
                       ${checked ? 'checked' : ''} 
                       data-api="${apiKey}"
                       data-role="api-toggle">
                <label for="api_${apiKey}" class="ml-1 text-xs text-pink-400 truncate">${api.name}</label>
            `;
            hiddendiv.appendChild(checkbox);

            // 添加事件监听器
            checkbox.querySelector('[data-role="api-toggle"]').addEventListener('change', function () {
                updateSelectedAPIs();
                checkHiddenAPIsSelected();
            });
        });
        container.appendChild(hiddendiv);
    }
}

// 检查是否有隐藏API被选中
function checkHiddenAPIsSelected() {
    // 查找所有内置隐藏API复选框
    const hiddenBuiltinCheckboxes = document.querySelectorAll('#apiCheckboxes .api-hidden:checked');

    // 查找所有自定义隐藏API复选框
    const customApiCheckboxes = document.querySelectorAll('#customApisList .api-hidden:checked');

    const hasHiddenSelected = hiddenBuiltinCheckboxes.length > 0 || customApiCheckboxes.length > 0;

    const hiddenFilterToggle = document.getElementById('hiddenFilterToggle');
    const hiddenFilterContainer = document.querySelector('[data-role="filter-section"]');
    const filterDescription = hiddenFilterContainer ? hiddenFilterContainer.querySelector('.dash-switch-desc') : null;

    // 如果选择了隐藏API，禁用隐藏内容过滤器
    if (hasHiddenSelected) {
        hiddenFilterToggle.checked = false;
        hiddenFilterToggle.disabled = true;
        localStorage.setItem('hiddenFilterEnabled', 'false');

        // 添加禁用样式
        hiddenFilterContainer.classList.add('filter-disabled');

        // 修改描述文字
        if (filterDescription) {
            filterDescription.innerHTML = '<strong class="text-pink-300">选中隐藏资源站时无法启用此过滤</strong>';
        }

        // 移除提示信息（如果存在）
        const existingTooltip = hiddenFilterContainer.querySelector('.filter-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    } else {
        // 启用隐藏内容过滤器
        hiddenFilterToggle.disabled = false;
        hiddenFilterContainer.classList.remove('filter-disabled');

        // 恢复原来的描述文字
        if (filterDescription) {
            filterDescription.innerHTML = '过滤"伦理片🈲"等隐藏内容';
        }

        // 移除提示信息
        const existingTooltip = hiddenFilterContainer.querySelector('.filter-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    }
}

// 渲染自定义API列表
function renderCustomAPIsList() {
    const container = document.getElementById('customApisList');
    if (!container) return;

    if (customAPIs.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 text-center my-2">未添加自定义API</p>';
        return;
    }

    container.innerHTML = '';
    customAPIs.forEach((api, index) => {
        const apiItem = document.createElement('div');
        apiItem.className = 'flex items-center justify-between p-1 mb-1 bg-[#222] rounded';
        const textColorClass = api.isHidden ? 'text-pink-400' : 'text-white';
        const hiddenTag = api.isHidden ? '<span class="text-xs text-pink-400 mr-1">(18+)</span>' : '';
        // 新增 detail 地址显示
        const detailLine = api.detail ? `<div class="text-xs text-gray-400 truncate">detail: ${api.detail}</div>` : '';
        apiItem.innerHTML = `
            <div class="flex items-center flex-1 min-w-0">
                <input type="checkbox" id="custom_api_${index}" 
                       class="form-checkbox h-3 w-3 text-blue-600 mr-1 ${api.isHidden ? 'api-hidden' : ''}" 
                       ${selectedAPIs.includes('custom_' + index) ? 'checked' : ''} 
                       data-custom-index="${index}"
                       data-role="api-toggle">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium ${textColorClass} truncate">
                        ${hiddenTag}${api.name}
                    </div>
                    <div class="text-xs text-gray-500 truncate">${api.url}</div>
                    ${detailLine}
                </div>
            </div>
            <div class="flex items-center">
                <button class="text-blue-500 hover:text-blue-700 text-xs px-1" onclick="editCustomApi(${index})">✎</button>
                <button class="text-red-500 hover:text-red-700 text-xs px-1" onclick="removeCustomApi(${index})">✕</button>
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
            <button onclick="updateCustomApi(${index})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">更新</button>
            <button onclick="cancelEditCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
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
    const isHidden = isHiddenInput ? isHiddenInput.checked : false;
    if (!name || !url) {
        showToast('请输入API名称和链接', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('API链接格式不正确，需以http://或https://开头', 'warning');
        return;
    }
    if (url.endsWith('/')) url = url.slice(0, -1);
    // 保存 detail 字段
    customAPIs[index] = { name, url, detail, isHidden };
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    renderCustomAPIsList();
    checkHiddenAPIsSelected();
    restoreAddCustomApiButtons();
    nameInput.value = '';
    urlInput.value = '';
    if (detailInput) detailInput.value = '';
    if (isHiddenInput) isHiddenInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
    showToast('已更新自定义API: ' + name, 'success');
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
        <button onclick="addCustomApi()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">添加</button>
        <button onclick="cancelAddCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
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

    // 保存到localStorage
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
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
        document.getElementById('customApiUrl').value = '';
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
    const isHidden = isHiddenInput ? isHiddenInput.checked : false;
    if (!name || !url) {
        showToast('请输入API名称和链接', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('API链接格式不正确，需以http://或https://开头', 'warning');
        return;
    }
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    // 保存 detail 字段
    customAPIs.push({ name, url, detail, isHidden });
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    const newApiIndex = customAPIs.length - 1;
    selectedAPIs.push('custom_' + newApiIndex);
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();
    updateSelectedApiCount();
    checkHiddenAPIsSelected();
    nameInput.value = '';
    urlInput.value = '';
    if (detailInput) detailInput.value = '';
    if (isHiddenInput) isHiddenInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
    showToast('已添加自定义API: ' + name, 'success');
}

// 移除自定义API
function removeCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;

    const apiName = customAPIs[index].name;

    // 从列表中移除API
    customAPIs.splice(index, 1);
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

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

    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();

    // 更新选中的API数量
    updateSelectedApiCount();

    // 重新检查隐藏API选中状态
    checkHiddenAPIsSelected();

    showToast('已移除自定义API: ' + apiName, 'info');
}