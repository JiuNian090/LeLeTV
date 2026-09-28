// 添加显示/隐藏 loading 的函数





/**
 * 统一模态框创建方法
 * @param {Object} options
 * @param {string} options.title - 模态框标题
 * @param {function|string} options.content - 内容构建函数(container, overlay) 或 HTML字符串
 * @param {string} [options.width='max-w-md'] - 最大宽度类
 * @param {boolean} [options.closeOnBackdrop=true] - 点击遮罩关闭
 * @param {function} [options.onClose] - 关闭回调
 * @returns {HTMLElement} overlay 元素
 */

// 获取搜索历史的增强版本 - 支持新旧格式

// 保存搜索历史的增强版本 - 添加时间戳和最大数量限制，现在缓存2个月

// 渲染搜索历史下拉菜单内容

// 显示搜索历史下拉菜单（带可选过滤文字）

// 固定定位：计算下拉菜单位置（相对于视口，覆盖所有内容）


// 隐藏搜索历史下拉菜单

// 移动端全屏搜索覆盖层 - 渲染搜索历史

// 搜索框底部变平，与下拉菜单无缝衔接


// 删除单条搜索历史记录

// 增加清除搜索历史功能



// 格式化时间戳为友好的日期时间格式

// 获取观看历史记录

// 加载观看历史并渲染

// 渲染单个历史卡片 - 左1/4封面 + 右3/4信息


// 格式化播放时间为 mm:ss 格式

// 删除单个历史记录项

// 从历史记录播放

// 添加观看历史 - 确保每个视频标题只有一条记录
// IMPORTANT: videoInfo passed to this function should include a 'showIdentifier' property
// (ideally `${sourceName}_${vod_id}`), 'sourceName', and 'vod_id'.

// 清空观看历史

// 点击外部关闭历史面板
document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('click', function(e) {
        const historyPanel = document.getElementById('historyPanel');
        const historyButton = document.querySelector('button[onclick="toggleHistory(event)"]');

        if (historyPanel && historyButton &&
            !historyPanel.contains(e.target) &&
            !historyButton.contains(e.target) &&
            historyPanel.classList.contains('show')) {
            historyPanel.classList.remove('show');
        }
    });
});

// 清除本地存储缓存并刷新页面

// 显示配置文件导入页面
function showImportBox(fun) {
    const overlay = showModal({
        title: '导入配置',
        content: (body, modal) => {
            body.innerHTML = `
                <div id="dropZone" class="v2-dropzone">
                    <span class="v2-dropzone-icon" aria-hidden="true">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/></svg>
                    </span>
                    <p class="v2-dropzone-title">将配置文件拖到这里</p>
                    <p class="v2-dropzone-sub">支持由「导出配置」生成的 ZIP 备份包</p>
                    <div class="v2-dropzone-actions">
                        <label class="v2-btn v2-btn--primary v2-btn--sm">
                            <input type="file" id="ChooseFile" accept=".zip,application/zip" hidden>
                            选择文件
                        </label>
                        <button type="button" data-action="import-config-from-url" class="v2-btn v2-btn--secondary v2-btn--sm">从链接导入</button>
                    </div>
                </div>
            `;
            // 拖拽文件事件
            const dropZone = document.getElementById('dropZone');
            const fileInput = document.getElementById('ChooseFile');
            if (dropZone) {
                dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('is-over'); });
                dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('is-over'); });
                dropZone.addEventListener('drop', (e) => { e.preventDefault(); fun(e.dataTransfer.files[0]); });
            }
            if (fileInput) {
                fileInput.addEventListener('change', () => { fun(fileInput.files[0]); });
            }
        }
    });
}
