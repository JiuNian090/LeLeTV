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
    // 转换规则：v1.8.28.1（年、月、日、当天提交次序）
    if (cleanedString.length >= 12) {
        // 年份完整值
        const fullYear = cleanedString.substring(0, 4);
        // 计算版本年（25年为1，以后递增）
        const versionYear = Math.max(1, Math.floor((parseInt(fullYear) - 2025) / 25) + 1);
        // 月份
        const month = parseInt(cleanedString.substring(4, 6));
        // 日期
        const day = parseInt(cleanedString.substring(6, 8));
        // 时间部分
        const hour = parseInt(cleanedString.substring(8, 10));
        const minute = parseInt(cleanedString.substring(10, 12));
        
        // 计算总分钟数
        const totalMinutes = hour * 60 + minute;
        // 每5分钟一个版本，计算提交次序（从1开始）
        const commitOrder = Math.floor(totalMinutes / 5) + 1;
        // 设置最大值限制
        const maxCommitOrder = 288; // 一天最多288个5分钟间隔 (24*60/5)
        const normalizedCommitOrder = Math.min(commitOrder, maxCommitOrder);
        
        // 组合成新的版本号格式：v1.8.28.1
        return `v${versionYear}.${month}.${day}.${normalizedCommitOrder}`;
    }
    
    // 基础格式：在版本号前面添加v前缀
    return `v${cleanedString}`;
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
    // 只获取并显示当前版本
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
