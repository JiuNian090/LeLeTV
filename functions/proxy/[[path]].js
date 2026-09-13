// functions/proxy/[[path]].js

// --- 配置 (现在从 Cloudflare 环境变量读取) ---
// 在 Cloudflare Pages 设置 -> 函数 -> 环境变量绑定 中设置以下变量:
// CACHE_TTL (例如 86400)
// MAX_RECURSION (例如 5)
// FILTER_DISCONTINUITY (不再需要，设为 false 或移除)
// USER_AGENTS_JSON (例如 ["UA1", "UA2"]) - JSON 字符串数组
// DEBUG (例如 false 或 true)
// PASSWORD (例如 "your_password") - 鉴权密码
// --- 配置结束 ---

// --- 常量 (之前在 config.js 中，现在移到这里，因为它们与代理逻辑相关) ---
const MEDIA_FILE_EXTENSIONS = [
    '.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.f4v', '.m4v', '.3gp', '.3g2', '.ts', '.mts', '.m2ts',
    '.mp3', '.wav', '.ogg', '.aac', '.m4a', '.flac', '.wma', '.alac', '.aiff', '.opus',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.avif', '.heic'
];
const MEDIA_CONTENT_TYPES = ['video/', 'audio/', 'image/'];
// --- 常量结束 ---

// ===================== 播放列表广告过滤（保守策略） =====================
// 目的：去掉正片中间插播的广告分片段（真正缩短时长），而不是只删 #EXT-X-DISCONTINUITY 标签。
// 保守原则：
//   ① 只在「被 #EXT-X-DISCONTINUITY 明确分隔」的多个块之间判断，整条列表没有 discontinuity 时一律不动；
//   ② 时长最长的块视为正片，永不删除；
//   ③ 必须命中高置信度特征：CUE-OUT/SCTE35、URI 广告关键词、与正片不同目录、分片时长明显异常；
//   ④ 删除总时长不超过全部时长的 40%（安全阀）；
//   ⑤ 存在独立音频/字幕轨（#EXT-X-MEDIA）时不做任何删除，避免音画不同步。

const AD_URI_PATTERN = /(^|[/_.-])(ad|ads|adv|advert|preroll|midroll)([/_.-]|$)/i;

function _resolveAgainst(baseUrl, uri) {
    if (/^https?:\/\//i.test(uri)) return uri;
    try {
        return new URL(uri, baseUrl).toString();
    } catch (e) {
        return uri;
    }
}

function _extinfDuration(tags) {
    for (let i = tags.length - 1; i >= 0; i--) {
        const m = /#EXTINF:\s*([0-9.]+)/.exec(tags[i]);
        if (m) return parseFloat(m[1]) || 0;
    }
    return 0;
}

/** 把媒体播放列表解析为有序 item：segment（前导标签 + URI）与 tags（独立标签行） */
export function parseMediaItems(content) {
    const items = [];
    const lines = String(content || '').split('\n');
    let pending = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('#')) { pending.push(line); continue; }
        items.push({ kind: 'segment', head: pending, uri: line, duration: _extinfDuration(pending) });
        pending = [];
    }
    if (pending.length) items.push({ kind: 'tags', lines: pending });
    return items;
}

/** 按 #EXT-X-DISCONTINUITY 把段切块；该标签归属到它后面的块 */
export function groupAdBlocks(items) {
    const blocks = [];
    let cur = { segments: [], items: [], cueAd: false, discontinuity: false };
    for (const it of items) {
        if (it.kind !== 'segment') { cur.items.push(it); continue; }
        const head = it.head.join('\n');
        const disc = head.indexOf('#EXT-X-DISCONTINUITY') !== -1;
        if (disc && cur.segments.length) {
            blocks.push(cur);
            cur = { segments: [], items: [], cueAd: false, discontinuity: true };
        }
        if (disc) cur.discontinuity = true;
        if (head.indexOf('#EXT-X-CUE-OUT') !== -1 || head.indexOf('#EXT-X-SCTE35') !== -1) cur.cueAd = true;
        cur.items.push(it);
        cur.segments.push(it);
    }
    blocks.push(cur);
    return blocks;
}

export function blockDuration(block) {
    return block.segments.reduce((sum, s) => sum + (s.duration || 0), 0);
}

/** 块的公共目录（host + 目录）；块内跨目录则返回 null（不判定） */
export function blockDir(block, baseUrl) {
    let dir = null;
    for (const seg of block.segments) {
        let d;
        try {
            const u = new URL(_resolveAgainst(baseUrl, seg.uri));
            const idx = u.pathname.lastIndexOf('/');
            d = u.host + (idx >= 0 ? u.pathname.slice(0, idx + 1) : '/');
        } catch (e) { return null; }
        if (dir === null) dir = d;
        else if (dir !== d) return null;
    }
    return dir;
}

/** 返回广告判定依据；null 表示"不够确定 → 保留" */
export function detectAdBlockReason(block, mainDir, mainAvgSeconds, baseUrl) {
    if (block.cueAd) return 'cue-out/scte35';
    for (const seg of block.segments) {
        if (AD_URI_PATTERN.test(seg.uri)) return 'ad-uri-keyword';
    }
    const duration = blockDuration(block);
    const dir = blockDir(block, baseUrl);
    if (dir && mainDir && dir !== mainDir && duration > 0 && duration <= 300) return 'other-directory';
    const avg = duration / Math.max(1, block.segments.length);
    if (mainAvgSeconds > 0 && mainAvgSeconds <= 8 && avg >= mainAvgSeconds * 2.5) return 'duration-outlier';
    return null;
}

/**
 * 过滤媒体播放列表中的广告块
 * @returns {{content: string, removedBlocks: number, removedSeconds: number, reason: string|null, reasons?: string[]}}
 */
export function filterAdsFromMediaPlaylist(content, baseUrl) {
    const result = { content: content, removedBlocks: 0, removedSeconds: 0, reason: null };
    if (!content) { result.reason = 'empty'; return result; }
    if (content.indexOf('#EXT-X-DISCONTINUITY') === -1) { result.reason = 'no-discontinuity'; return result; }
    if (content.indexOf('#EXT-X-MEDIA:') !== -1) { result.reason = 'has-media-tracks'; return result; }
    try {
        const blocks = groupAdBlocks(parseMediaItems(content));
        if (blocks.length < 2) { result.reason = 'single-block'; return result; }

        // 正片目录由「段数最多的目录」投票决定（不能用时最长的那一块：
        // 插播广告块常常比正片被切开后的单块还长，那样会把正片当广告删掉）
        const dirOf = blocks.map(b => blockDir(b, baseUrl));
        const stats = new Map();
        blocks.forEach((b, i) => {
            const dir = dirOf[i];
            if (!dir) return;
            const cur = stats.get(dir) || { segments: 0, duration: 0 };
            cur.segments += b.segments.length;
            cur.duration += blockDuration(b);
            stats.set(dir, cur);
        });

        let mainDir = null;
        let mainSegments = 0;
        let mainDuration = 0;
        for (const [dir, st] of stats) {
            if (st.segments > mainSegments || (st.segments === mainSegments && st.duration > mainDuration)) {
                mainDir = dir; mainSegments = st.segments; mainDuration = st.duration;
            }
        }
        if (!mainDir) { result.reason = 'no-main-directory'; return result; }

        const mainAvg = mainDuration / Math.max(1, mainSegments);
        const total = blocks.reduce((s, b) => s + blockDuration(b), 0);
        // 上限：总时长的 40%，且不少于 300s（短片源里 40% 太小，会连正常插播广告都不敢删）
        const maxRemovable = Math.max(300, total * 0.4);

        const drop = new Set();
        let removedSeconds = 0;
        blocks.forEach((b, i) => {
            const reason = detectAdBlockReason(b, mainDir, mainAvg, baseUrl);
            if (!reason) return;
            // 落在正片目录里的块，只有高置信度特征才允许删；
            //「目录不同」「时长异常」这类弱信号不足以覆盖「它就在正片目录里」
            const inMainDir = !!(dirOf[i] && dirOf[i] === mainDir);
            if (inMainDir && reason !== 'cue-out/scte35' && reason !== 'ad-uri-keyword') return;
            const d = blockDuration(b);
            if (removedSeconds + d > maxRemovable) return;       // 安全阀
            drop.add(i);
            removedSeconds += d;
            result.reasons = (result.reasons || []).concat(`${reason}(${d.toFixed(1)}s)`);
        });

        if (!drop.size) { result.reason = 'no-high-confidence-block'; return result; }

        const out = [];
        blocks.forEach((b, i) => {
            if (drop.has(i)) return;
            for (const it of b.items) {
                if (it.kind === 'tags') out.push(...it.lines);
                else { out.push(...it.head); out.push(it.uri); }
            }
        });
        result.content = out.join('\n') + '\n';
        result.removedBlocks = drop.size;
        result.removedSeconds = removedSeconds;
        return result;
    } catch (e) {
        result.content = content;
        result.reason = 'error:' + (e && e.message);
        return result;
    }
}

/** 把播放列表里所有 URI 绝对化（分片保持直连采集站，只修相对路径的解析基准） */
export function absolutizePlaylistUris(content, baseUrl) {
    const out = [];
    for (const it of parseMediaItems(content)) {
        if (it.kind === 'tags') { out.push(...it.lines); continue; }
        for (const h of it.head) out.push(absolutizeTagUri(h, baseUrl));
        out.push(_resolveAgainst(baseUrl, it.uri));
    }
    return out.join('\n') + '\n';
}

/** #EXT-X-KEY / #EXT-X-MAP 里的 URI 绝对化 */
export function absolutizeTagUri(line, baseUrl) {
    if (line.indexOf('#EXT-X-KEY') === 0 || line.indexOf('#EXT-X-MAP') === 0) {
        return line.replace(/URI="([^"]+)"/, (m, uri) => `URI="${_resolveAgainst(baseUrl, uri)}"`);
    }
    return line;
}


/**
 * 主要的 Pages Function 处理函数
 * 拦截发往 /proxy/* 的请求
 */
export async function onRequest(context) {
    const { request, env, next, waitUntil } = context; // next 和 waitUntil 可能需要
    const url = new URL(request.url);

    // 验证鉴权（主函数调用）
    const isValidAuth = await validateAuth(request, env);
    if (!isValidAuth) {
        return new Response(JSON.stringify({
            success: false,
            error: '代理访问未授权：请检查密码配置或鉴权参数'
        }), { 
            status: 401,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': 'application/json'
            }
        });
    }

    // --- 从环境变量读取配置 ---
    const DEBUG_ENABLED = (env.DEBUG === 'true');
    const CACHE_TTL = parseInt(env.CACHE_TTL || '86400'); // 默认 24 小时
    const MAX_RECURSION = parseInt(env.MAX_RECURSION || '5'); // 默认 5 层
    // 广告过滤已移至播放器处理，代理不再执行
    let USER_AGENTS = [ // 提供一个基础的默认值
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    try {
        // 尝试从环境变量解析 USER_AGENTS_JSON
        const agentsJson = env.USER_AGENTS_JSON;
        if (agentsJson) {
            const parsedAgents = JSON.parse(agentsJson);
            if (Array.isArray(parsedAgents) && parsedAgents.length > 0) {
                USER_AGENTS = parsedAgents;
            } else {
                 logDebug("环境变量 USER_AGENTS_JSON 格式无效或为空，使用默认值");
            }
        }
    } catch (e) {
        logDebug(`解析环境变量 USER_AGENTS_JSON 失败: ${e.message}，使用默认值`);
    }
    // --- 配置读取结束 ---


    // --- 辅助函数 ---

    // 验证代理请求的鉴权
    async function validateAuth(request, env) {
        const url = new URL(request.url);
        const authHash = url.searchParams.get('auth');
        const timestamp = url.searchParams.get('t');
        
        // 获取服务器端密码
        const serverPassword = env.HIDDENKEY;
        if (!serverPassword) {
            console.error('服务器未设置 HIDDENKEY 环境变量，代理访问被拒绝');
            return false;
        }
        
        // 使用 SHA-256 哈希算法（与其他平台保持一致）
        // 在 Cloudflare Workers 中使用 crypto.subtle
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(serverPassword);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const serverPasswordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            if (!authHash || authHash !== serverPasswordHash) {
                console.warn('代理请求鉴权失败：密码哈希不匹配');
                return false;
            }
        } catch (error) {
            console.error('计算密码哈希失败:', error);
            return false;
        }
        
        // 验证时间戳（10分钟有效期）
        if (timestamp) {
            const now = Date.now();
            const maxAge = 10 * 60 * 1000; // 10分钟
            if (now - parseInt(timestamp) > maxAge) {
                console.warn('代理请求鉴权失败：时间戳过期');
                return false;
            }
        }
        
        return true;
    }

    // 验证鉴权（主函数调用）
    if (!validateAuth(request, env)) {
        return new Response('Unauthorized', { 
            status: 401,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }

    // 输出调试日志 (需要设置 DEBUG: true 环境变量)
    function logDebug(message) {
        if (DEBUG_ENABLED) {
            console.log(`[Proxy Func] ${message}`);
        }
    }

    // 从请求路径中提取目标 URL
    function getTargetUrlFromPath(pathname) {
        // 路径格式: /proxy/经过编码的URL
        // 例如: /proxy/https%3A%2F%2Fexample.com%2Fplaylist.m3u8
        const encodedUrl = pathname.replace(/^\/proxy\//, '');
        if (!encodedUrl) return null;
        try {
            // 解码
            let decodedUrl = decodeURIComponent(encodedUrl);

             // 简单检查解码后是否是有效的 http/https URL
             if (!decodedUrl.match(/^https?:\/\//i)) {
                 // 也许原始路径就没有编码？如果看起来像URL就直接用
                 if (encodedUrl.match(/^https?:\/\//i)) {
                     decodedUrl = encodedUrl;
                     logDebug(`Warning: Path was not encoded but looks like URL: ${decodedUrl}`);
                 } else {
                    logDebug(`无效的目标URL格式 (解码后): ${decodedUrl}`);
                    return null;
                 }
             }
             return decodedUrl;

        } catch (e) {
            logDebug(`解码目标URL时出错: ${encodedUrl} - ${e.message}`);
            return null;
        }
    }

    // 创建标准化的响应
    function createResponse(body, status = 200, headers = {}) {
        const responseHeaders = new Headers(headers);
        // 关键：添加 CORS 跨域头，允许前端 JS 访问代理后的响应
        responseHeaders.set("Access-Control-Allow-Origin", "*"); // 允许任何来源访问
        responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS"); // 允许的方法
        responseHeaders.set("Access-Control-Allow-Headers", "*"); // 允许所有请求头

        // 处理 CORS 预检请求 (OPTIONS) - 放在这里确保所有响应都处理
         if (request.method === "OPTIONS") {
             // 使用下面的 onOptions 函数可以更规范，但在这里处理也可以
             return new Response(null, {
                 status: 204, // No Content
                 headers: responseHeaders // 包含上面设置的 CORS 头
             });
         }

        return new Response(body, { status, headers: responseHeaders });
    }

    // ===================== 仅播放列表模式（mode=m3u8）=====================
    // 与默认代理的差别：分片地址不做 /proxy/ 重写（保持直连采集站，省流量、不掉速），
    // 只把播放列表里插播的广告分片段删掉，并把相对 URI 绝对化（列表现在经 /proxy/ 访问，
    // 相对路径会以代理路径为基准解析，必须绝对化）。

    async function sha256Hex(text) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 生成指向本代理的 m3u8 链接（子列表用）；重新签名，避免长片播到一半子请求过期
    async function buildInternalM3u8ProxyUrl(targetUrl, env) {
        let u = `/proxy/${encodeURIComponent(targetUrl)}?mode=m3u8`;
        try {
            if (env && env.HIDDENKEY) {
                u += `&auth=${await sha256Hex(env.HIDDENKEY)}&t=${Date.now()}`;
            }
        } catch (e) {
            logDebug(`[广告过滤] 生成子列表签名失败: ${e.message}`);
        }
        return u;
    }

    function processMediaPlaylistFiltered(url, content) {
        const baseUrl = getBaseUrl(url);
        const filtered = filterAdsFromMediaPlaylist(content, baseUrl);
        if (filtered.removedBlocks > 0) {
            logDebug(`[广告过滤] 删除 ${filtered.removedBlocks} 个广告块 / ${filtered.removedSeconds.toFixed(1)}s：${(filtered.reasons || []).join(', ')}`);
        } else {
            logDebug(`[广告过滤] 未删除任何分段（${filtered.reason}）`);
        }
        return absolutizePlaylistUris(filtered.content, baseUrl);
    }

    // 主列表：保留全部清晰度，每个变体都指向本代理（各自再过滤一次）
    async function processMasterPlaylistFiltered(url, content, env) {
        const baseUrl = getBaseUrl(url);
        const lines = content.split('\n');
        const out = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            if (line.startsWith('#EXT-X-MEDIA:')) {
                // 音频/字幕轨：只绝对化、仍直连；媒体列表侧也会因 #EXT-X-MEDIA 放弃删段
                out.push(line.replace(/URI="([^"]+)"/, (m, uri) => `URI="${resolveUrl(baseUrl, uri)}"`));
                continue;
            }
            if (line.startsWith('#EXT-X-STREAM-INF')) {
                out.push(line);
                for (let j = i + 1; j < lines.length; j++) {
                    const v = lines[j].trim();
                    if (!v) continue;
                    if (v.startsWith('#')) break;
                    out.push(await buildInternalM3u8ProxyUrl(resolveUrl(baseUrl, v), env));
                    i = j;
                    break;
                }
                continue;
            }
            if (line.startsWith('#')) { out.push(line); continue; }
            out.push(resolveUrl(baseUrl, line));
        }
        return out.join('\n') + '\n';
    }

    async function processPlaylistOnly(targetUrl, content, env) {
        if (content.includes('#EXT-X-STREAM-INF') || content.includes('#EXT-X-MEDIA:')) {
            logDebug(`[广告过滤] 主播放列表（保留多清晰度）: ${targetUrl}`);
            return await processMasterPlaylistFiltered(targetUrl, content, env);
        }
        return processMediaPlaylistFiltered(targetUrl, content);
    }

    // 创建 M3U8 类型的响应
    function createM3u8Response(content) {
        return createResponse(content, 200, {
            "Content-Type": "application/vnd.apple.mpegurl", // M3U8 的标准 MIME 类型
            "Cache-Control": `public, max-age=${CACHE_TTL}` // 允许浏览器和CDN缓存
        });
    }

    // 获取随机 User-Agent
    function getRandomUserAgent() {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }

    // 获取 URL 的基础路径 (用于解析相对路径)
    function getBaseUrl(urlStr) {
        try {
            const parsedUrl = new URL(urlStr);
            // 如果路径是根目录，或者没有斜杠，直接返回 origin + /
            if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
                return `${parsedUrl.origin}/`;
            }
            const pathParts = parsedUrl.pathname.split('/');
            pathParts.pop(); // 移除文件名或最后一个路径段
            return `${parsedUrl.origin}${pathParts.join('/')}/`;
        } catch (e) {
            logDebug(`获取 BaseUrl 时出错: ${urlStr} - ${e.message}`);
            // 备用方法：找到最后一个斜杠
            const lastSlashIndex = urlStr.lastIndexOf('/');
            // 确保不是协议部分的斜杠 (http://)
            return lastSlashIndex > urlStr.indexOf('://') + 2 ? urlStr.substring(0, lastSlashIndex + 1) : urlStr + '/';
        }
    }


    // 将相对 URL 转换为绝对 URL
    function resolveUrl(baseUrl, relativeUrl) {
        // 如果已经是绝对 URL，直接返回
        if (relativeUrl.match(/^https?:\/\//i)) {
            return relativeUrl;
        }
        try {
            // 使用 URL 对象来处理相对路径
            return new URL(relativeUrl, baseUrl).toString();
        } catch (e) {
            logDebug(`解析 URL 失败: baseUrl=${baseUrl}, relativeUrl=${relativeUrl}, error=${e.message}`);
            // 简单的备用方法
            if (relativeUrl.startsWith('/')) {
                // 处理根路径相对 URL
                const urlObj = new URL(baseUrl);
                return `${urlObj.origin}${relativeUrl}`;
            }
            // 处理同级目录相对 URL
            return `${baseUrl.replace(/\/[^/]*$/, '/')}${relativeUrl}`; // 确保baseUrl以 / 结尾
        }
    }

    // 将目标 URL 重写为内部代理路径 (/proxy/...)
    function rewriteUrlToProxy(targetUrl) {
        // 确保目标URL被正确编码，以便作为路径的一部分
        return `/proxy/${encodeURIComponent(targetUrl)}`;
    }

    // 获取远程内容及其类型
    async function fetchContentWithType(targetUrl) {
        const headers = new Headers({
            'User-Agent': getRandomUserAgent(),
            'Accept': '*/*',
            // 尝试传递一些原始请求的头信息
            'Accept-Language': request.headers.get('Accept-Language') || 'zh-CN,zh;q=0.9,en;q=0.8',
            // 尝试设置 Referer 为目标网站的域名，或者传递原始 Referer
            'Referer': request.headers.get('Referer') || new URL(targetUrl).origin
        });

        try {
            // 直接请求目标 URL
            logDebug(`开始直接请求: ${targetUrl}`);
            // Cloudflare Functions 的 fetch 默认支持重定向
            const response = await fetch(targetUrl, { headers, redirect: 'follow' });

            if (!response.ok) {
                 const errorBody = await response.text().catch(() => '');
                 logDebug(`请求失败: ${response.status} ${response.statusText} - ${targetUrl}`);
                 throw new Error(`HTTP error ${response.status}: ${response.statusText}. URL: ${targetUrl}. Body: ${errorBody.substring(0, 150)}`);
            }

            // 读取响应内容为文本
            const content = await response.text();
            const contentType = response.headers.get('Content-Type') || '';
            logDebug(`请求成功: ${targetUrl}, Content-Type: ${contentType}, 内容长度: ${content.length}`);
            return { content, contentType, responseHeaders: response.headers }; // 同时返回原始响应头

        } catch (error) {
             logDebug(`请求彻底失败: ${targetUrl}: ${error.message}`);
            // 抛出更详细的错误
            throw new Error(`请求目标URL失败 ${targetUrl}: ${error.message}`);
        }
    }

    // 判断是否是 M3U8 内容
    function isM3u8Content(content, contentType) {
        // 检查 Content-Type
        if (contentType && (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegurl') || contentType.includes('audio/mpegurl'))) {
            return true;
        }
        // 检查内容本身是否以 #EXTM3U 开头
        return content && typeof content === 'string' && content.trim().startsWith('#EXTM3U');
    }

    // 判断是否是媒体文件 (根据扩展名和 Content-Type) - 这部分在此代理中似乎未使用，但保留
    function isMediaFile(url, contentType) {
        if (contentType) {
            for (const mediaType of MEDIA_CONTENT_TYPES) {
                if (contentType.toLowerCase().startsWith(mediaType)) {
                    return true;
                }
            }
        }
        const urlLower = url.toLowerCase();
        for (const ext of MEDIA_FILE_EXTENSIONS) {
            if (urlLower.endsWith(ext) || urlLower.includes(`${ext}?`)) {
                return true;
            }
        }
        return false;
    }

    // 处理 M3U8 中的 #EXT-X-KEY 行 (加密密钥)
    function processKeyLine(line, baseUrl) {
        return line.replace(/URI="([^"]+)"/, (match, uri) => {
            const absoluteUri = resolveUrl(baseUrl, uri);
            logDebug(`处理 KEY URI: 原始='${uri}', 绝对='${absoluteUri}'`);
            return `URI="${rewriteUrlToProxy(absoluteUri)}"`; // 重写为代理路径
        });
    }

    // 处理 M3U8 中的 #EXT-X-MAP 行 (初始化片段)
    function processMapLine(line, baseUrl) {
         return line.replace(/URI="([^"]+)"/, (match, uri) => {
             const absoluteUri = resolveUrl(baseUrl, uri);
             logDebug(`处理 MAP URI: 原始='${uri}', 绝对='${absoluteUri}'`);
             return `URI="${rewriteUrlToProxy(absoluteUri)}"`; // 重写为代理路径
         });
     }

    // 处理媒体 M3U8 播放列表 (包含视频/音频片段)
    function processMediaPlaylist(url, content) {
        const baseUrl = getBaseUrl(url);
        const lines = content.split('\n');
        const output = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // 保留最后的空行
            if (!line && i === lines.length - 1) {
                output.push(line);
                continue;
            }
            if (!line) continue; // 跳过中间的空行

            if (line.startsWith('#EXT-X-KEY')) {
                output.push(processKeyLine(line, baseUrl));
                continue;
            }
            if (line.startsWith('#EXT-X-MAP')) {
                output.push(processMapLine(line, baseUrl));
                 continue;
            }
             if (line.startsWith('#EXTINF')) {
                 output.push(line);
                 continue;
             }
             if (!line.startsWith('#')) {
                 const absoluteUrl = resolveUrl(baseUrl, line);
                 logDebug(`重写媒体片段: 原始='${line}', 绝对='${absoluteUrl}'`);
                 output.push(rewriteUrlToProxy(absoluteUrl));
                 continue;
             }
             // 其他 M3U8 标签直接添加
             output.push(line);
        }
        return output.join('\n');
    }

    // 递归处理 M3U8 内容
     async function processM3u8Content(targetUrl, content, recursionDepth = 0, env) {
         if (content.includes('#EXT-X-STREAM-INF') || content.includes('#EXT-X-MEDIA:')) {
             logDebug(`检测到主播放列表: ${targetUrl}`);
             return await processMasterPlaylist(targetUrl, content, recursionDepth, env);
         }
         logDebug(`检测到媒体播放列表: ${targetUrl}`);
         return processMediaPlaylist(targetUrl, content);
     }

    // 处理主 M3U8 播放列表
    async function processMasterPlaylist(url, content, recursionDepth, env) {
        if (recursionDepth > MAX_RECURSION) {
            throw new Error(`处理主列表时递归层数过多 (${MAX_RECURSION}): ${url}`);
        }

        const baseUrl = getBaseUrl(url);
        const lines = content.split('\n');
        let highestBandwidth = -1;
        let bestVariantUrl = '';

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
                const currentBandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;

                 let variantUriLine = '';
                 for (let j = i + 1; j < lines.length; j++) {
                     const line = lines[j].trim();
                     if (line && !line.startsWith('#')) {
                         variantUriLine = line;
                         i = j;
                         break;
                     }
                 }

                 if (variantUriLine && currentBandwidth >= highestBandwidth) {
                     highestBandwidth = currentBandwidth;
                     bestVariantUrl = resolveUrl(baseUrl, variantUriLine);
                 }
            }
        }

         if (!bestVariantUrl) {
             logDebug(`主列表中未找到 BANDWIDTH 或 STREAM-INF，尝试查找第一个子列表引用: ${url}`);
             for (let i = 0; i < lines.length; i++) {
                 const line = lines[i].trim();
                 if (line && !line.startsWith('#') && (line.endsWith('.m3u8') || line.includes('.m3u8?'))) { // 修复：检查是否包含 .m3u8?
                    bestVariantUrl = resolveUrl(baseUrl, line);
                     logDebug(`备选方案：找到第一个子列表引用: ${bestVariantUrl}`);
                     break;
                 }
             }
         }

        if (!bestVariantUrl) {
            logDebug(`在主列表 ${url} 中未找到任何有效的子播放列表 URL。可能格式有问题或仅包含音频/字幕。将尝试按媒体列表处理原始内容。`);
            return processMediaPlaylist(url, content);
        }

        // --- 获取并处理选中的子 M3U8 ---

        const cacheKey = `m3u8_processed:${bestVariantUrl}`; // 使用处理后的缓存键

        let kvNamespace = null;
        try {
            kvNamespace = env.LELETV_PROXY_KV;
            if (!kvNamespace) throw new Error("KV 命名空间未绑定");
        } catch (e) {
            logDebug(`KV 命名空间 'LELETV_PROXY_KV' 访问出错或未绑定: ${e.message}`);
            kvNamespace = null;
        }

        if (kvNamespace) {
            try {
                const cachedContent = await kvNamespace.get(cacheKey);
                if (cachedContent) {
                    logDebug(`[缓存命中] 主列表的子列表: ${bestVariantUrl}`);
                    return cachedContent;
                } else {
                    logDebug(`[缓存未命中] 主列表的子列表: ${bestVariantUrl}`);
                }
            } catch (kvError) {
                logDebug(`从 KV 读取缓存失败 (${cacheKey}): ${kvError.message}`);
                // 出错则继续执行，不影响功能
            }
        }

        logDebug(`选择的子列表 (带宽: ${highestBandwidth}): ${bestVariantUrl}`);
        const { content: variantContent, contentType: variantContentType } = await fetchContentWithType(bestVariantUrl);

        if (!isM3u8Content(variantContent, variantContentType)) {
            logDebug(`获取到的子列表 ${bestVariantUrl} 不是 M3U8 内容 (类型: ${variantContentType})。可能直接是媒体文件，返回原始内容。`);
             // 如果不是M3U8，但看起来像媒体内容，直接返回代理后的内容
             // 注意：这里可能需要决定是否直接代理这个非 M3U8 的 URL
             // 为了简化，我们假设如果不是 M3U8，则流程中断或按原样处理
             // 或者，尝试将其作为媒体列表处理？（当前行为）
             // return createResponse(variantContent, 200, { 'Content-Type': variantContentType || 'application/octet-stream' });
             // 尝试按媒体列表处理，以防万一
             return processMediaPlaylist(bestVariantUrl, variantContent);

        }

        const processedVariant = await processM3u8Content(bestVariantUrl, variantContent, recursionDepth + 1, env);

        if (kvNamespace) {
             try {
                 // 使用 waitUntil 异步写入缓存，不阻塞响应返回
                 // 注意 KV 的写入限制 (免费版每天 1000 次)
                 waitUntil(kvNamespace.put(cacheKey, processedVariant, { expirationTtl: CACHE_TTL }));
                 logDebug(`已将处理后的子列表写入缓存: ${bestVariantUrl}`);
             } catch (kvError) {
                 logDebug(`向 KV 写入缓存失败 (${cacheKey}): ${kvError.message}`);
                 // 写入失败不影响返回结果
             }
        }

        return processedVariant;
    }

    // --- 主要请求处理逻辑 ---

    try {
        const targetUrl = getTargetUrlFromPath(url.pathname);

        if (!targetUrl) {
            logDebug(`无效的代理请求路径: ${url.pathname}`);
            return createResponse("无效的代理请求。路径应为 /proxy/<经过编码的URL>", 400);
        }

        logDebug(`收到代理请求: ${targetUrl}`);

        // mode=m3u8：仅改写播放列表（过滤插播广告分片），分片保持直连采集站
        const playlistOnly = (url.searchParams.get('mode') || '').split(',').includes('m3u8');
        if (playlistOnly) logDebug('[广告过滤] 仅播放列表模式');

        // --- 缓存检查 (KV) ---
        const cacheKey = `proxy_raw:${targetUrl}`; // 使用原始内容的缓存键
        let kvNamespace = null;
        try {
            kvNamespace = env.LELETV_PROXY_KV;
            if (!kvNamespace) throw new Error("KV 命名空间未绑定");
        } catch (e) {
            logDebug(`KV 命名空间 'LELETV_PROXY_KV' 访问出错或未绑定: ${e.message}`);
            kvNamespace = null;
        }

        if (kvNamespace) {
            try {
                const cachedDataJson = await kvNamespace.get(cacheKey); // 直接获取字符串
                if (cachedDataJson) {
                    logDebug(`[缓存命中] 原始内容: ${targetUrl}`);
                    const cachedData = JSON.parse(cachedDataJson); // 解析 JSON
                    const content = cachedData.body;
                    let headers = {};
                    try { headers = JSON.parse(cachedData.headers); } catch(e){} // 解析头部
                    const contentType = headers['content-type'] || headers['Content-Type'] || '';

                    if (isM3u8Content(content, contentType)) {
                        logDebug(`缓存内容是 M3U8，重新处理: ${targetUrl}`);
                        const processedM3u8 = playlistOnly
                            ? await processPlaylistOnly(targetUrl, content, env)
                            : await processM3u8Content(targetUrl, content, 0, env);
                        return createM3u8Response(processedM3u8);
                    } else {
                        logDebug(`从缓存返回非 M3U8 内容: ${targetUrl}`);
                        return createResponse(content, 200, new Headers(headers));
                    }
                } else {
                     logDebug(`[缓存未命中] 原始内容: ${targetUrl}`);
                 }
            } catch (kvError) {
                 logDebug(`从 KV 读取或解析缓存失败 (${cacheKey}): ${kvError.message}`);
                 // 出错则继续执行，不影响功能
            }
        }

        // --- 实际请求 ---
        const { content, contentType, responseHeaders } = await fetchContentWithType(targetUrl);

        // --- 写入缓存 (KV) ---
        if (kvNamespace) {
             try {
                 const headersToCache = {};
                 responseHeaders.forEach((value, key) => { headersToCache[key.toLowerCase()] = value; });
                 const cacheValue = { body: content, headers: JSON.stringify(headersToCache) };
                 // 注意 KV 写入限制
                 waitUntil(kvNamespace.put(cacheKey, JSON.stringify(cacheValue), { expirationTtl: CACHE_TTL }));
                 logDebug(`已将原始内容写入缓存: ${targetUrl}`);
            } catch (kvError) {
                 logDebug(`向 KV 写入缓存失败 (${cacheKey}): ${kvError.message}`);
                 // 写入失败不影响返回结果
            }
        }

        // --- 处理响应 ---
        if (isM3u8Content(content, contentType)) {
            logDebug(`内容是 M3U8，开始处理: ${targetUrl}`);
            const processedM3u8 = playlistOnly
                ? await processPlaylistOnly(targetUrl, content, env)
                : await processM3u8Content(targetUrl, content, 0, env);
            return createM3u8Response(processedM3u8);
        } else {
            logDebug(`内容不是 M3U8 (类型: ${contentType})，直接返回: ${targetUrl}`);
            const finalHeaders = new Headers(responseHeaders);
            finalHeaders.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
            // 添加 CORS 头，确保非 M3U8 内容也能跨域访问（例如图片、字幕文件等）
            finalHeaders.set("Access-Control-Allow-Origin", "*");
            finalHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
            finalHeaders.set("Access-Control-Allow-Headers", "*");
            return createResponse(content, 200, finalHeaders);
        }

    } catch (error) {
        logDebug(`处理代理请求时发生严重错误: ${error.message} \n ${error.stack}`);
        return createResponse(`代理处理错误: ${error.message}`, 500);
    }
}

// 处理 OPTIONS 预检请求的函数
export async function onOptions(context) {
    // 直接返回允许跨域的头信息
    return new Response(null, {
        status: 204, // No Content
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*", // 允许所有请求头
            "Access-Control-Max-Age": "86400", // 预检请求结果缓存一天
        },
    });
}
