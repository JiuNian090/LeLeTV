// 版本号工具函数

/**
 * 将数字格式的版本号转换为语义化版本号
 * @param {string} numericVersion - 数字格式的版本号，如"202508270043"
 * @returns {string} 语义化格式的版本号，如"v1.8.28.1"
 */
function convertToSemanticVersion(numericVersion) {
    // 验证输入
    if (!numericVersion || typeof numericVersion !== 'string') {
        return '未知版本';
    }
    
    // 清理版本字符串
    const cleanedVersion = numericVersion.trim().replace(/^v/, '');
    
    // 检查是否已经是语义化版本号
    if (cleanedVersion.match(/^\d+\.\d+\.\d+/)) {
        return `v${cleanedVersion}`;
    }
    
    // 根据项目当前版本格式（YYYYMMDDHHMM）创建语义化版本号
    // 新转换规则：vN（25年为1，以后年份递增）.Y（当前月份）.X（当前日期）.Z（当天提交的次序）
    if (cleanedVersion.length >= 12) {
        // 年份完整值
        const fullYear = cleanedVersion.substring(0, 4);
        // 计算版本年（25年为1，以后递增）
        const versionYear = Math.max(1, (parseInt(fullYear) - 2025) + 1);
        // 月份
        const month = parseInt(cleanedVersion.substring(4, 6));
        // 日期
        const day = parseInt(cleanedVersion.substring(6, 8));
        
        // 提交次序（基于CHANGELOG.md中相同日期的版本号统计）
        const commitOrder = calculateCommitOrderFromChangelog(fullYear, month, day);
        
        // 组合成新的版本号格式：vN.Y.X.Z
        return `v${versionYear}.${month}.${day}.${commitOrder}`;
    }
    
    // 如果无法解析，返回带有v前缀的原始版本
    return `v${cleanedVersion}`;
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

/**
 * 格式化版本号，确保它是语义化的
 * @param {string} versionString - 版本字符串
 * @returns {string} 格式化后的语义化版本号
 */
function formatVersionToSemantic(versionString) {
    return convertToSemanticVersion(versionString);
}

/**
 * 批量转换文本中的所有版本号为语义化版本号
 * @param {string} text - 包含版本号的文本
 * @returns {string} 转换后的文本
 */
function convertTextVersionNumbers(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    
    // 匹配格式为vYYYYMMDDHHMM的版本号
    const versionRegex = /v(\d{12})/g;
    
    return text.replace(versionRegex, (match, versionNumber) => {
        return convertToSemanticVersion(versionNumber);
    });
}

/**
 * 从CHANGELOG.md文件获取最新版本号
 * @returns {Promise<string>} 最新版本号
 */
async function getLatestVersionFromChangelog() {
    try {
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
        return '未知版本';
    } catch (error) {
        console.error('获取最新版本号出错:', error);
        return '未知版本';
    }
}

/**
 * 将格式化后的版本号添加到页脚
 */
function updateFooterVersion() {
    getLatestVersionFromChangelog().then(latestVersion => {
        // 查找页脚中的版本信息元素
        const versionElements = document.querySelectorAll('.footer p.text-gray-500.text-sm');
        
        // 查找或创建版本信息元素
        let versionElement = null;
        versionElements.forEach(el => {
            if (el.textContent.includes('版本:')) {
                versionElement = el;
            }
        });
        
        if (versionElement) {
            // 更新已存在的版本信息
            versionElement.innerHTML = `版本: ${latestVersion}`;
        } else {
            // 创建新的版本信息元素
            versionElement = document.createElement('p');
            versionElement.className = 'text-gray-500 text-sm mt-1 text-center md:text-left';
            versionElement.innerHTML = `版本: ${latestVersion}`;
            
            // 添加到页脚
            const footerElement = document.querySelector('.footer p.text-gray-500.text-sm');
            if (footerElement) {
                footerElement.insertAdjacentElement('afterend', versionElement);
            } else if (document.querySelector('.footer .container')) {
                document.querySelector('.footer .container div').appendChild(versionElement);
            }
        }
    });
}

/**
 * 处理CHANGELOG.md中的版本号转换
 * 在实际应用中，这个函数会被用在显示更新日志的页面上
 * @param {HTMLElement} containerElement - 包含更新日志的DOM元素
 */
function updateChangelogVersions(containerElement) {
    if (!containerElement) {
        return;
    }
    
    // 获取容器内的所有文本内容
    const text = containerElement.innerHTML;
    
    // 转换文本中的版本号
    const updatedText = convertTextVersionNumbers(text);
    
    // 更新容器内容
    containerElement.innerHTML = updatedText;
}

// 导出函数以便在其他地方使用
window.versionUtils = {
    convertToSemanticVersion,
    formatVersionToSemantic,
    convertTextVersionNumbers,
    getFormattedVersion,
    updateFooterVersion,
    updateChangelogVersions
};