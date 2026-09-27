// LeLeTV — 起播前线路失败自动换线
// 点卡片进来的是搜索时最快返回的片源，但它的 m3u8 可能跨域被拦、404 或超时。
// 起播前只要清单 / 分片加载失败（或 15 秒还没起播），就自动换到同一部片的下一条线路：
//   1. 候选先从结果页缓存里拿（同名结果的其它片源，按搜索时的响应快慢排），不用再搜；
//      缓存里没有再逐个片源搜片名
//   2. 换之前先真实校验（LeLeLineProbe）：详情接口有集数、m3u8 能按 CORS 方式取到；结果页预检过的结论直接复用
//   3. 校验通过才走 switchToResource 跳转；试过的线路记在 sessionStorage，整页跳转后不重复试，最多换 3 次
//   4. 已经播起来的（currentTime > 1s）不换，交给播放器自己的重试

(function () {
    'use strict';

    const STATE_KEY = 'leletv_line_failover';
    const SEARCH_CACHE_KEY = 'leletv_search_cache';
    const MAX_ATTEMPTS = 3;
    const SEARCH_TIMEOUT_MS = 5000;
    const STALL_WATCHDOG_MS = 15000;

    let busy = false;
    let playing = false;
    let watchdog = 0;

    function normTitle(name) {
        return String(name || '').split('$')[0].toLowerCase()
            .replace(/[（(【\[][^）)】\]]*[）)】\]]\s*$/, '')
            .replace(/[\s　·•・:：,，.。!！?？'"“”‘’()（）【】\[\]《》<>\-—_~～]/g, '');
    }

    function currentSource() {
        return new URLSearchParams(window.location.search).get('source') || '';
    }

    function currentTitle() {
        return (typeof currentVideoTitle === 'string' && currentVideoTitle)
            || new URLSearchParams(window.location.search).get('title') || '';
    }

    function readState() {
        try {
            const st = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
            if (st && st.title === currentTitle()) return st;
        } catch (e) { /* 忽略 */ }
        return { title: currentTitle(), tried: [], attempts: 0, switchedTo: '' };
    }

    function writeState(st) {
        try { sessionStorage.setItem(STATE_KEY, JSON.stringify(st)); } catch (e) { /* 忽略 */ }
    }

    function sourceName(key) {
        if (String(key).startsWith('custom_')) {
            const info = typeof getCustomApiInfo === 'function' ? getCustomApiInfo(String(key).replace('custom_', '')) : null;
            return (info && info.name) || '自定义资源';
        }
        const site = window.API_SITES && window.API_SITES[key];
        return (site && site.name) || key;
    }

    function withTimeout(promise, ms) {
        return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
    }

    /** 同一部片的判定：片名规范化后相同；或以它开头、后面只多几个字（沪语版、2023、第一季……），且不是短剧 */
    function sameShow(r, want) {
        const n = normTitle(r.vod_name);
        if (!n || !want) return 0;
        if (n === want) return 2;
        if (n.indexOf(want) === 0 && n.length - want.length <= 8 && !/短剧|微剧/.test(String(r.type_name || ''))) return 1;
        return 0;
    }

    /** 结果页缓存里同一部片的其它片源：片名完全一致的在前，再按搜索时的响应快慢排 */
    function candidatesFromCache(tried) {
        try {
            const cache = JSON.parse(sessionStorage.getItem(SEARCH_CACHE_KEY) || 'null');
            if (!cache || !Array.isArray(cache.results)) return [];
            const want = normTitle(currentTitle());
            if (!want) return [];
            const seen = {};
            return cache.results
                .map(r => ({ r, score: r && r.vod_id && r.source_code ? sameShow(r, want) : 0 }))
                .filter(x => x.score > 0)
                .filter(x => !tried.includes(String(x.r.source_code)) && !seen[x.r.source_code] && (seen[x.r.source_code] = true))
                .sort((a, b) => (b.score - a.score) || ((a.r.source_latency || 1e9) - (b.r.source_latency || 1e9)))
                .map(x => ({ key: String(x.r.source_code), vodId: String(x.r.vod_id), name: x.r.source_name || sourceName(x.r.source_code) }));
        } catch (e) { return []; }
    }

    /** 缓存里没有：搜片名，取最像的一条 */
    async function searchCandidate(src) {
        if (typeof searchByAPIAndKeyWord !== 'function') return null;
        const title = currentTitle();
        const want = normTitle(title);
        const results = await withTimeout(searchByAPIAndKeyWord(src.key, title), SEARCH_TIMEOUT_MS);
        if (!Array.isArray(results)) return null;
        let best = null, bestScore = 0;
        results.forEach(r => { const sc = r && r.vod_id ? sameShow(r, want) : 0; if (sc > bestScore) { best = r; bestScore = sc; } });
        return best ? { key: src.key, vodId: String(best.vod_id), name: src.name } : null;
    }

    /** 真实校验一条候选线路：详情有集数、当前集 m3u8 能按 CORS 取到（逻辑在 LeLeLineProbe，与结果页预检共用缓存） */
    function validate(candidate) {
        if (!window.LeLeLineProbe) return Promise.resolve(false);
        const index = (typeof currentEpisodeIndex === 'number' && currentEpisodeIndex > 0) ? currentEpisodeIndex : 0;
        return LeLeLineProbe.check(candidate.key, candidate.vodId, index);
    }

    /** 一批候选并行校验，按优先顺序取第一条通过的；校验失败的记进 tried */
    async function firstValid(cands, st) {
        if (!cands.length) return null;
        const checks = cands.map(c => validate(c).catch(() => false));
        for (let i = 0; i < cands.length; i++) {
            if (await checks[i]) return cands[i];
            st.tried.push(cands[i].key);
            writeState(st);
        }
        return null;
    }

    /**
     * 换线入口：起播前线路失败时由播放器错误处理调用。
     * 返回 true 表示已开始跳转到新线路（页面即将离开）
     */
    async function autoSwitchLine(reason) {
        if (busy || playing) return false;
        try {
            if (typeof art !== 'undefined' && art && art.video && art.video.currentTime > 1) return false;
        } catch (e) { /* 忽略 */ }
        const st = readState();
        if (st.attempts >= MAX_ATTEMPTS) return false;
        busy = true;
        const current = currentSource();
        if (current && !st.tried.includes(current)) st.tried.push(current);
        st.attempts++;
        writeState(st);
        if (typeof showToast === 'function') showToast((reason || '当前线路无法播放') + '，正在自动换线…', 'info', 6000);

        try {
            // 1) 缓存里的同名结果：一起校验，按优先顺序取第一条能播的
            let pick = await firstValid(candidatesFromCache(st.tried), st);
            // 2) 缓存里没有能播的：并行搜其它片源（4 个一批），搜到就校验
            if (!pick) {
                const scanSources = (typeof getResourceScanSources === 'function' ? getResourceScanSources() : [])
                    .filter(src => !st.tried.includes(String(src.key)));
                for (let i = 0; i < scanSources.length && !pick; i += 4) {
                    const batch = scanSources.slice(i, i + 4);
                    const found = (await Promise.all(batch.map(src => searchCandidate(src).catch(() => null)))).filter(Boolean);
                    batch.forEach(src => { if (!found.some(c => c.key === src.key)) { st.tried.push(String(src.key)); } });
                    writeState(st);
                    pick = await firstValid(found, st);
                }
            }
            if (!pick) {
                if (typeof showError === 'function') showError('所有线路都无法播放这一集，请稍后再试或换个片源');
                return false;
            }
            st.switchedTo = pick.name;
            writeState(st);
            if (typeof switchToResource === 'function') {
                await switchToResource(pick.key, pick.vodId);   // 整页跳到新线路
                return true;
            }
            return false;
        } finally {
            busy = false;
        }
    }

    /** 播放器建好后挂上：起播就停表；原生 HLS 出错、或 15 秒没起播都换线 */
    function watch(player) {
        playing = false;
        clearTimeout(watchdog);
        const video = player && player.video;
        if (!video) return;
        const onPlaying = () => {
            playing = true;
            clearTimeout(watchdog);
            try {
                const st = readState();
                st.attempts = 0;
                writeState(st);
            } catch (e) { /* 忽略 */ }
        };
        video.addEventListener('playing', onPlaying, { once: true });
        video.addEventListener('error', () => {
            if (!playing) autoSwitchLine('视频无法加载');
        });
        watchdog = setTimeout(() => {
            if (!playing && video.readyState < 2) autoSwitchLine('线路长时间没有响应');
        }, STALL_WATCHDOG_MS);

        // 结果页预检已经判死这条线路（比如这一组里没有别的线路可换才点进来的）：不等清单超时，马上换
        try {
            const params = new URLSearchParams(window.location.search);
            const vodId = params.get('id');
            const index = (typeof currentEpisodeIndex === 'number' && currentEpisodeIndex > 0) ? currentEpisodeIndex : (parseInt(params.get('index') || '0', 10) || 0);
            if (vodId && window.LeLeLineProbe && LeLeLineProbe.cached(currentSource(), vodId, index) === false) {
                setTimeout(() => { if (!playing) autoSwitchLine('当前线路预检未通过'); }, 0);
            }
        } catch (e) { /* 忽略 */ }

        // 上一页自动换过线：到这页提示一句
        const st = readState();
        if (st.switchedTo) {
            const name = st.switchedTo;
            st.switchedTo = '';
            writeState(st);
            if (typeof showToast === 'function') setTimeout(() => showToast('上一条线路无法播放，已自动切换到「' + name + '」', 'success', 4000), 600);
        }
    }

    window.LeLeFailover = { autoSwitchLine, watch, markPlaying() { playing = true; clearTimeout(watchdog); } };
})();
