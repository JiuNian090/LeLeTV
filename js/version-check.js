// 引入版本工具函数
// 注意：在实际使用时，需要确保version-utils.js已经在页面中加载

// 获取版本信息
async function fetchVersion(url, errorMessage, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(errorMessage);
    }
    return await response.text();
}

// 格式化版本号为语义化格式
function formatVersion(versionString) {
    // 检测版本字符串是否有效
    if (!versionString) {
        return '未知版本';
    }
    
    // 清理版本字符串（移除可能的空格或换行符）
    const cleanedString = versionString.trim();
    
    // 优先使用versionUtils中的转换函数
    if (window.versionUtils && typeof window.versionUtils.formatVersionToSemantic === 'function') {
        return window.versionUtils.formatVersionToSemantic(cleanedString);
    }
    
    // 备用方案：如果versionUtils不可用，使用内置的转换逻辑
    // 根据项目当前版本格式（YYYYMMDDHHMM）创建语义化版本号
    // 新转换规则：vN（25年为1，以后年份递增）.Y（当前月份）.X（当前日期）.Z（当天提交的次序）
    if (cleanedString.length >= 12) {
        // 年份完整值
        const fullYear = cleanedString.substring(0, 4);
        // 计算版本年（25年为1，以后递增）
        const versionYear = Math.max(1, (parseInt(fullYear) - 2025) + 1);
        // 月份
        const month = parseInt(cleanedString.substring(4, 6));
        // 日期
        const day = parseInt(cleanedString.substring(6, 8));
        
        // 提交次序（基于CHANGELOG.md中相同日期的版本号统计）
        const commitOrder = calculateCommitOrderFromChangelog(fullYear, month, day);
        
        // 组合成新的版本号格式：vN.Y.X.Z
        return `v${versionYear}.${month}.${day}.${commitOrder}`;
    }
    
    // 基础格式：在版本号前面添加v前缀
    return `v${cleanedString}`;
}

/**
 * 从CHANGELOG.md中计算指定日期的提交次序
 * @param {string} year - 年份
 * @param {number} month - 月份
 * @param {number} day - 日期
 * @returns {number} 提交次序
 */
function calculateCommitOrderFromChangelog(year, month, day) {
    // 在浏览器环境中，我们无法直接读取CHANGELOG.md文件
    // 所以我们返回默认值1
    // 在实际项目中，这需要通过异步方式获取
    return 1;
}

// 解析CHANGELOG.md内容获取最新版本号
async function getLatestVersionFromChangelog() {
    try {
        // 获取CHANGELOG.md文件内容
        const response = await fetch('/CHANGELOG.md', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('获取更新日志失败');
        }
        const markdownContent = await response.text();
        
        // 直接从CHANGELOG.md中提取最新版本号
        const versionMatch = markdownContent.match(/### (v[\d\.]+) \(/);
        if (versionMatch) {
            return versionMatch[1];
        }
        return null;
    } catch (error) {
        console.error('解析更新日志获取最新版本号出错:', error);
        return null;
    }
}

// 解析CHANGELOG.md内容为版本历史条目数组
function parseChangelogMarkdown(markdownContent) {
    const versionEntries = [];
    let currentEntry = null;

    // 将Markdown按行分割
    const lines = markdownContent.split('\n');

    lines.forEach((line) => {
        // 处理标题
        if (line.startsWith('### ')) {
            // 如果已有当前条目，先保存
            if (currentEntry) {
                versionEntries.push(currentEntry);
            }

            // 创建新条目
            currentEntry = { content: '', version: '' };

            // 直接提取完整的版本号和日期信息
            const versionMatch = line.match(/### (v[\d\.]+) \(([\d\-:\s]+)\)/);
            if (versionMatch) {
                const versionNumber = versionMatch[1];
                const dateInfo = versionMatch[2];
                
                // 直接使用CHANGELOG.md中的版本号
                currentEntry.version = versionNumber;
                currentEntry.content += `<h4 class="text-lg font-semibold mb-2 text-blue-400">${versionNumber} (${dateInfo})</h4>`;
            } else if (line.includes('初始版本')) {
                currentEntry.version = '初始版本';
                currentEntry.content += `<h4 class="text-lg font-semibold mb-2 text-blue-400">初始版本</h4>`;
            }
        } else if (line.startsWith('- ') && currentEntry) {
            // 处理列表项
            // 提取标签和内容
            const tagMatch = line.match(/- \[(.*?)\] (.*?)$/);
            if (tagMatch) {
                currentEntry.content += `<p class="ml-4 mb-1"><span class="text-green-400">[${tagMatch[1]}]</span> ${tagMatch[2]}</p>`;
            } else {
                currentEntry.content += `<p class="ml-4 mb-1">${line.substring(2)}</p>`;
            }
        } else if (line.trim() !== '' && currentEntry) {
            // 处理普通文本（描述）
            currentEntry.content += `<p class="text-gray-400 text-sm mt-2 ml-4">${line}</p>`;
        }
    });

    // 处理最后一个条目
    if (currentEntry) {
        versionEntries.push(currentEntry);
    }

    return versionEntries;
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
    // 获取CHANGELOG.md中的最新版本号
    getLatestVersionFromChangelog().then(latestVersion => {
        if (latestVersion) {
            // 创建版本信息元素
            const versionElement = document.createElement('p');
            versionElement.className = 'text-gray-500 text-sm mt-1 text-center md:text-left';
            versionElement.innerHTML = `版本: ${latestVersion}`;
            
            // 显示版本元素
            displayVersionElement(versionElement);
        } else {
            // 如果无法获取最新版本，则使用当前版本
            fetchVersion('/VERSION.txt', '获取当前版本失败', {
                cache: 'no-store'
            }).then(currentVersion => {
                // 清理并格式化版本号
                const cleanCurrentVersion = currentVersion.trim();
                const formattedVersion = formatVersion(cleanCurrentVersion);
                
                // 创建版本信息元素
                const versionElement = document.createElement('p');
                versionElement.className = 'text-gray-500 text-sm mt-1 text-center md:text-left';
                versionElement.innerHTML = `版本: ${formattedVersion}`;
                
                // 显示版本元素
                displayVersionElement(versionElement);
            }).catch(error => {
                console.error('版本检测出错:', error);
                // 创建错误版本信息元素并显示
                const errorElement = createErrorVersionElement(`错误信息: ${error.message}`);
                displayVersionElement(errorElement);
            });
        }
    }).catch(error => {
        console.error('获取最新版本号出错:', error);
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

// 页面加载完成后添加版本信息
document.addEventListener('DOMContentLoaded', () => {
    addVersionInfoToFooter();
});