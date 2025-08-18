// 添加动画样式
(function() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.6;
            }
        }
        .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
    `;
    document.head.appendChild(style);
})();

// 获取版本信息
async function fetchVersion(url, errorMessage, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(errorMessage);
    }
    return await response.text();
}

// 版本检查函数
async function checkForUpdates() {
    try {
        // 获取当前版本
        const currentVersion = await fetchVersion('/VERSION.txt', '获取当前版本失败', {
            cache: 'no-store'
        });
        
        // 获取最新版本
        let latestVersion;
        const VERSION_URL = {
            PROXY: 'https://ghfast.top/raw.githubusercontent.com/LibreSpark/LibreTV/main/VERSION.txt',
            DIRECT: 'https://raw.githubusercontent.com/LibreSpark/LibreTV/main/VERSION.txt'
        };
        const FETCH_TIMEOUT = 1500;
        
        try {
            // 尝试使用代理URL获取最新版本
            const proxyPromise = fetchVersion(VERSION_URL.PROXY, '代理请求失败');
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('代理请求超时')), FETCH_TIMEOUT)
            );
            
            latestVersion = await Promise.race([proxyPromise, timeoutPromise]);
            console.log('通过代理服务器获取版本成功');
        } catch (error) {
            console.log('代理请求失败，尝试直接请求:', error.message);
            try {
                // 代理失败后尝试直接获取
                latestVersion = await fetchVersion(VERSION_URL.DIRECT, '获取最新版本失败');
                console.log('直接请求获取版本成功');
            } catch (directError) {
                console.error('所有版本检查请求均失败:', directError);
                throw new Error('无法获取最新版本信息');
            }
        }
        
        console.log('当前版本:', currentVersion);
        console.log('最新版本:', latestVersion);
        
        // 清理版本字符串（移除可能的空格或换行符）
        const cleanCurrentVersion = currentVersion.trim();
        const cleanLatestVersion = latestVersion.trim();
        
        // 返回版本信息
        return {
            current: cleanCurrentVersion,
            latest: cleanLatestVersion,
            hasUpdate: parseInt(cleanLatestVersion) > parseInt(cleanCurrentVersion),
            currentFormatted: formatVersion(cleanCurrentVersion),
            latestFormatted: formatVersion(cleanLatestVersion)
        };
    } catch (error) {
        console.error('版本检测出错:', error);
        throw error;
    }
}

// 格式化版本号为可读形式 (yyyyMMddhhmm -> yyyy-MM-dd hh:mm)
function formatVersion(versionString) {
    // 检测版本字符串是否有效
    if (!versionString) {
        return '未知版本';
    }
    
    // 清理版本字符串（移除可能的空格或换行符）
    const cleanedString = versionString.trim();
    
    // 格式化标准12位版本号
    if (cleanedString.length === 12) {
        const year = cleanedString.substring(0, 4);
        const month = cleanedString.substring(4, 6);
        const day = cleanedString.substring(6, 8);
        const hour = cleanedString.substring(8, 10);
        const minute = cleanedString.substring(10, 12);
        
        return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    
    return cleanedString;
}

// 创建错误版本信息元素
function createErrorVersionElement(errorMessage) {
    const errorElement = document.createElement('p');
    errorElement.className = 'text-gray-500 text-sm mt-1 text-center md:text-left';
    errorElement.innerHTML = `版本: <span class="text-amber-500">检测失败</span>`;
    errorElement.title = errorMessage;
    return errorElement;
}

// 添加版本信息到页脚
function addVersionInfoToFooter() {
    checkForUpdates().then(result => {
        if (!result) {
            // 如果版本检测失败，显示错误信息
            const versionElement = createErrorVersionElement();
            // 在页脚显示错误元素
            displayVersionElement(versionElement);
            return;
        }
        
        // 创建版本信息元素
        const versionElement = document.createElement('p');
        versionElement.className = 'text-gray-500 text-sm mt-1 text-center md:text-left';
        
        // 添加当前版本信息
        versionElement.innerHTML = `版本: ${result.currentFormatted}`;
        
        // 如果有更新，添加更新提示
        if (result.hasUpdate) {
            versionElement.innerHTML += ` <span class="inline-flex items-center bg-red-600 text-white text-xs px-2 py-0.5 rounded-md ml-1 cursor-pointer animate-pulse font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                发现新版
            </span>`;
            
            setTimeout(() => {
                const updateBtn = versionElement.querySelector('span');
                if (updateBtn) {
                    updateBtn.addEventListener('click', () => {
                        window.open('https://github.com/LibreSpark/LeLeTV', '_blank');
                    });
                }
            }, 100);
        } else {
            // 如果没有更新，显示当前版本为最新版本
            const latestVersionElement = document.createElement('span');
            latestVersionElement.id = 'latestVersionText';
            latestVersionElement.className = 'text-green-500 cursor-pointer hover:underline';
            latestVersionElement.textContent = '最新版本';
            
            // 直接添加点击事件
            latestVersionElement.addEventListener('click', () => {
                console.log('点击了最新版本，显示更新日志');
                showChangelogModal();
            });
            
            // 将文本内容和元素组合起来
            versionElement.innerHTML = `版本: ${result.currentFormatted} `;
            versionElement.appendChild(latestVersionElement);
        }
        
        // 显示版本元素
        displayVersionElement(versionElement);
    }).catch(error => {
        console.error('版本检测出错:', error);
        // 创建错误版本信息元素并显示
        const errorElement = createErrorVersionElement(`错误信息: ${error.message}`);
        displayVersionElement(errorElement);
    });
}



// 在页脚显示版本元素的辅助函数
function displayVersionElement(element) {
    // 获取页脚元素
    const footerElement = document.querySelector('.footer p.text-gray-500.text-sm');
    if (footerElement) {
        // 在原版权信息后插入版本信息
        footerElement.insertAdjacentElement('afterend', element);
    } else {        // 如果找不到页脚元素，尝试在页脚区域最后添加
        const footer = document.querySelector('.footer .container');
        if (footer) {
            footer.querySelector('div').appendChild(element);
        }
    }
}

// 显示更新日志模态窗口
function showChangelogModal() {
    // 检查是否已存在更新日志模态窗口
    let changelogModal = document.getElementById('changelogModal');
    
    if (!changelogModal) {
        // 创建模态窗口容器
        changelogModal = document.createElement('div');
        changelogModal.id = 'changelogModal';
        changelogModal.className = 'fixed inset-0 bg-black/90 hidden items-center justify-center z-[60]';
        
        // 创建模态窗口内容
        changelogModal.innerHTML = `
            <div class="bg-[#111] p-8 rounded-lg border border-[#333] w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <div class="w-6"></div> <!-- 添加一个占位元素以确保标题居中 -->
                    <h2 class="text-2xl font-bold gradient-text mb-6 text-center">更新日志</h2>
                    <button id="closeChangelogBtn" class="close-btn text-gray-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center">
                        X
                    </button>
                </div>
                <div id="changelogContent" class="text-gray-300 space-y-4">
                    <div class="flex justify-center items-center py-8">
                        <svg class="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                </div>
                <div class="mt-6 flex justify-center">
                    <button id="closeChangelogBtnFooter" class="px-6 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300">
                        关闭
                    </button>
                </div>
            </div>
        `;
        
        // 添加到文档中
        document.body.appendChild(changelogModal);
        
        // 添加关闭按钮事件
        document.getElementById('closeChangelogBtn').addEventListener('click', () => {
            hideChangelogModal();
        });
        
        // 添加底部关闭按钮事件
        document.getElementById('closeChangelogBtnFooter').addEventListener('click', () => {
            hideChangelogModal();
        });
        
        // 添加点击外部关闭模态窗口
        changelogModal.addEventListener('click', (e) => {
            if (e.target === changelogModal) {
                hideChangelogModal();
            }
        });
        
        // 添加ESC键关闭模态窗口
        document.addEventListener('keydown', handleEscKey);
        
        // 隐藏模态窗口的函数
        function hideChangelogModal() {
            changelogModal.classList.add('hidden');
            changelogModal.classList.remove('flex');
            // 移除ESC键监听器
            document.removeEventListener('keydown', handleEscKey);
            // 延迟移除元素以允许动画完成
            setTimeout(() => {
                if (changelogModal.parentNode) {
                    changelogModal.parentNode.removeChild(changelogModal);
                }
            }, 300);
        }
        
        // 处理ESC键事件
        function handleEscKey(event) {
            if (event.key === 'Escape') {
                hideChangelogModal();
            }
        }
    }
    
    // 显示模态窗口
    changelogModal.classList.remove('hidden');
    changelogModal.classList.add('flex');
    
    // 加载更新日志内容
    loadChangelogContent();
}

// 加载更新日志内容
async function loadChangelogContent() {
    const changelogContent = document.getElementById('changelogContent');
    if (!changelogContent) return;
    
    try {
        // 获取CHANGELOG.md内容
        const response = await fetch('/CHANGELOG.md', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('获取更新日志失败');
        }
        
        const markdownContent = await response.text();
        
        // 将Markdown转换为HTML显示
        // 简单的Markdown解析和格式化
        let htmlContent = '';
        
        // 将Markdown按行分割
        const lines = markdownContent.split('\n');
        
        let inVersionSection = false;
        let versionContent = '';
        
        lines.forEach((line) => {
            // 处理标题
            if (line.startsWith('# ')) {
                htmlContent += `<h1 class="text-2xl font-bold mb-4 gradient-text">${line.substring(2)}</h1>`;
            } else if (line.startsWith('## ')) {
                htmlContent += `<h2 class="text-xl font-bold mb-3 mt-6">${line.substring(3)}</h2>`;
            } else if (line.startsWith('### ')) {
                // 如果之前有版本内容，先处理
                if (inVersionSection && versionContent) {
                    htmlContent += `
                        <div class="mb-6 p-4 bg-[#1a1a1a] rounded-lg">
                            ${versionContent}
                        </div>
                    `;
                    versionContent = '';
                }
                
                // 提取版本号和日期
                const versionMatch = line.match(/v(\d+)\s+\(([^)]+)\)/);
                if (versionMatch) {
                    const versionNumber = versionMatch[1];
                    const versionDate = versionMatch[2];
                    versionContent += `<h3 class="text-lg font-semibold mb-2 text-blue-400">v${versionNumber} (${versionDate})</h3>`;
                } else {
                    versionContent += `<h3 class="text-lg font-semibold mb-2">${line.substring(4)}</h3>`;
                }
                
                inVersionSection = true;
            } else if (line.startsWith('- ')) {
                // 处理列表项
                if (inVersionSection) {
                    // 提取标签和内容
                    const tagMatch = line.match(/- \[(.*?)\] (.*?)$/);
                    if (tagMatch) {
                        versionContent += `<p class="ml-4 mb-1">- <span class="text-green-400">[${tagMatch[1]}]</span> ${tagMatch[2]}</p>`;
                    } else {
                        versionContent += `<p class="ml-4 mb-1">${line.substring(2)}</p>`;
                    }
                } else {
                    htmlContent += `<p>${line}</p>`;
                }
            } else if (line.trim() !== '') {
                // 处理普通文本
                if (inVersionSection) {
                    versionContent += `<p class="text-gray-400 text-sm mt-2 ml-4">${line}</p>`;
                } else {
                    htmlContent += `<p>${line}</p>`;
                }
            }
        });
        
        // 处理最后一个版本内容
        if (inVersionSection && versionContent) {
            htmlContent += `
                <div class="mb-6 p-4 bg-[#1a1a1a] rounded-lg">
                    ${versionContent}
                </div>
            `;
        }
        
        changelogContent.innerHTML = htmlContent;
    } catch (error) {
        console.error('加载更新日志出错:', error);
        changelogContent.innerHTML = `
            <div class="text-center">
                <p class="text-red-500 font-medium mb-2">加载更新日志失败</p>
                <p class="text-sm text-gray-500">${error.message}</p>
            </div>
        `;
    }
}

// 页面加载完成后添加版本信息
document.addEventListener('DOMContentLoaded', addVersionInfoToFooter);
