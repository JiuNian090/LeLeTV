/**
 * 全局 UI 层：模态框 / Toast / 加载层 / 移动搜索层 / 搜索历史下拉。
 * 阶段 2 从 index.html 抽出，在 core bundle 中、src/ui/toast.ts 之前注入，
 * 因为 toast 模块在初始化时会查找 #toast / #modal。
 */

(function mountGlobalUi(): void {
  if (document.getElementById('global-ui-root')) return;

  const root = document.createElement('div');
  root.id = 'global-ui-root';
  root.innerHTML = `
    <div id="pwaGuideModal" class="v2-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="pwaGuideTitle">
        <div class="v2-dialog">
            <div class="v2-dialog-head is-center">
                <span class="v2-emblem" aria-hidden="true"><svg class="v2-mark" viewBox="0 0 432.4 326.3"><use href="#lele-mark"/></svg></span>
                <h2 id="pwaGuideTitle" class="v2-dialog-title" data-role="title">添加到主屏幕</h2>
                <p class="v2-dialog-sub">安装后以独立窗口全屏运行，打开方式与原生应用一致。</p>
            </div>
            <ol class="v2-steps pwa-guide-steps" data-role="steps"></ol>
            <div class="v2-dialog-actions">
                <button type="button" class="v2-btn v2-btn--primary v2-btn--block" data-action="pwa-guide-close">知道了</button>
            </div>
        </div>
    </div>
    <!-- 影片详情（内容由脚本填充） -->
    <div id="modal" class="v2-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="v2-dialog v2-dialog--xl">
            <div class="v2-dialog-head">
                <h2 id="modalTitle" class="v2-dialog-title"></h2>
            </div>
            <button type="button" class="v2-icon-btn v2-dialog-close" data-action="close-modal" aria-label="关闭">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
            <div id="modalContent"></div>
        </div>
    </div>

    <!-- 邀请码登录 -->
    <div id="inviteLoginModal" class="v2-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="inviteTitle">
        <div class="v2-dialog">
            <div class="v2-dialog-head is-center">
                <span class="v2-emblem" aria-hidden="true"><svg class="v2-mark" viewBox="0 0 432.4 326.3"><use href="#lele-mark"/></svg></span>
                <h2 id="inviteTitle" class="v2-dialog-title">登录 LeLeTV</h2>
                <p class="v2-dialog-sub">本站采用邀请制，请输入邀请码继续访问。</p>
            </div>
            <form id="inviteLoginForm" class="v2-invite-form" autocomplete="on" novalidate>
                <div class="v2-field">
                    <label class="v2-label" for="inviteDeviceName">设备名称</label>
                    <input type="text" id="inviteDeviceName" name="username" class="v2-input" placeholder="例如：客厅电视、我的 iPhone" autocomplete="username" maxlength="30">
                    <p class="v2-help">用于在设备管理中识别这台设备，最多 30 个字符</p>
                </div>
                <div class="v2-field">
                    <div class="v2-invite-meta">
                        <label class="v2-label" for="inviteCodeInput">邀请码</label>
                        <span class="v2-help">每个邀请码可绑定 5 台设备</span>
                    </div>
                    <div class="v2-control">
                        <input type="password" id="inviteCodeInput" name="password" class="v2-input v2-input--mono has-trailing" placeholder="LELE-XXXX-XXXX" autocomplete="current-password" maxlength="19" spellcheck="false" autocapitalize="characters">
                        <button type="button" id="inviteCodeToggle" class="v2-icon-btn" aria-label="显示邀请码" aria-pressed="false">
                            <svg class="v2-eye-open" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                            <svg class="v2-eye-closed" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
                        </button>
                    </div>
                </div>
                <p id="inviteLoginError" class="v2-error hidden" role="alert"></p>
                <button type="submit" id="inviteLoginBtn" class="v2-btn v2-btn--primary v2-btn--block">
                    <span class="v2-spinner" aria-hidden="true"></span>
                    <span class="v2-btn-label">进入</span>
                </button>
            </form>
            <hr class="v2-divider">
            <p class="v2-invite-foot">还没有邀请码？<button type="button" class="v2-link" data-action="open-invite-guide">了解获取方式</button></p>
        </div>
    </div>

    <!-- 获取邀请码 -->
    <div id="inviteGuideModal" class="v2-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="inviteGuideTitle">
        <div class="v2-dialog">
            <div class="v2-dialog-head">
                <h2 id="inviteGuideTitle" class="v2-dialog-title">获取邀请码</h2>
                <p class="v2-dialog-sub">邀请码由站点管理员发放，用于登录与设备绑定。</p>
            </div>
            <ol class="v2-steps">
                <li>
                    <h3>联系管理员</h3>
                    <p>发送邮件至 <a class="v2-link" href="mailto:jiunian929@gmail.com">jiunian929@gmail.com</a>，并注明申请用途。</p>
                </li>
                <li>
                    <h3>登录并绑定设备</h3>
                    <p>收到邀请码后返回登录页，填写设备名称与邀请码即可进入。</p>
                </li>
                <li>
                    <h3>管理已绑定设备</h3>
                    <p>每个邀请码最多绑定 5 台设备，不再使用的设备可在「设置 › 设备管理」中移除。</p>
                </li>
            </ol>
            <div class="v2-dialog-foot">
                <button type="button" class="v2-btn v2-btn--secondary" data-action="close-invite-guide">返回登录</button>
            </div>
        </div>
    </div>

    <!-- 使用须知 -->
    <div id="disclaimerModal" class="v2-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="disclaimerTitle">
        <div class="v2-dialog v2-dialog--wide">
            <div class="v2-dialog-head">
                <h2 id="disclaimerTitle" class="v2-dialog-title">使用须知</h2>
                <p class="v2-dialog-sub">开始使用前，请阅读以下事项。</p>
            </div>
            <ol class="v2-steps">
                <li>
                    <h3>添加到主屏幕</h3>
                    <p>在 Safari 或 Chrome 中打开本站，通过「添加到主屏幕」安装后即可全屏使用，操作方式与原生应用一致。</p>
                </li>
                <li>
                    <h3>片源与线路</h3>
                    <p>可在「设置 › 数据源」中启用或停用资源站。播放不流畅时，可在播放页切换线路或刷新页面。</p>
                </li>
                <li>
                    <h3>第三方广告</h3>
                    <p>视频由第三方资源站提供，画面中出现的广告、网址与联系方式均与本站无关，请勿轻信。</p>
                </li>
                <li>
                    <h3>内容与版权</h3>
                    <p>本站仅提供检索服务，不存储、不上传任何视频内容，仅限个人学习与研究，禁止用于商业用途。</p>
                </li>
                <li>
                    <h3>请勿公开传播</h3>
                    <p>为保障访问稳定，请勿在公开渠道分享本站地址。</p>
                </li>
            </ol>
            <div class="v2-dialog-foot">
                <button type="button" id="acceptDisclaimerBtn" data-action="accept-disclaimer" class="v2-btn v2-btn--primary">我已阅读并同意</button>
            </div>
        </div>
    </div>

    <!-- 版本更新：有更新时必须点更新进入网站，不提供关闭 -->
    <div id="updateModal" class="v2-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="updateTitle">
        <div class="v2-dialog v2-dialog--wide">
            <div class="v2-dialog-head">
                <span class="v2-dialog-kicker">版本更新</span>
                <h2 id="updateTitle" class="v2-dialog-title">LeLeTV 已发布新版本</h2>
                <p class="v2-version-flow" id="updateModalVersion"></p>
            </div>
            <div class="v2-update-log" id="updateModalLog"></div>
            <div class="v2-dialog-foot">
                <button type="button" id="updateModalBtn" class="v2-btn v2-btn--primary">立即更新</button>
            </div>
        </div>
    </div>

    <!-- 提示条 -->
    <div id="toast" class="v2-toast" role="status" aria-live="polite">
        <span class="v2-toast-dot" aria-hidden="true"></span>
        <p id="toastMessage"></p>
    </div>

    <!-- 加载层 -->
    <div id="loading" class="v2-overlay hidden" role="status" aria-live="polite">
        <div class="v2-loading-card">
            <span class="v2-spinner" aria-hidden="true"></span>
            <p>正在加载</p>
        </div>
    </div>

    <!-- 手机搜索层（窄屏点搜索框时全屏打开） -->
    <div id="mobileSearchOverlay" role="dialog" aria-modal="true" aria-label="搜索">
        <div class="mobile-search-header">
            <div class="v2-msearch-field">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <input type="search" id="mobileSearchInput" placeholder="输入片名或 m3u8 直链" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="搜索影片">
                <button id="clearMobileSearchInput" type="button" class="search-input-clear" aria-label="清空搜索内容">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12"/></svg>
                </button>
                <button id="mobileSearchSubmit" type="button" class="v2-msearch-go" aria-label="搜索">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
            </div>
            <button id="mobileSearchClose" type="button" class="v2-msearch-cancel">取消</button>
        </div>
        <div id="mobileSearchHistoryList" class="mobile-search-history-list" role="listbox" aria-label="搜索历史"></div>
    </div>

    <!-- 搜索历史下拉（桌面） -->
    <div id="searchHistoryDropdown" class="v2-dropdown hidden" role="listbox" aria-label="搜索历史"></div>
`;

  const footer = document.querySelector('footer.footer');
  if (footer && footer.parentNode) {
    footer.parentNode.insertBefore(root, footer.nextSibling);
  } else {
    document.body.appendChild(root);
  }
})();
