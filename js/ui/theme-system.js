/* LeLeTV - 主题配色系统（设置页「主题配色」卡片）
 *
 * 组成：
 *   1) 配色方案：11 套预设 + 自定义（两行 × 6）。每套由主色、辅助色、底色组成：
 *      主色管按钮、选中态和 logo 图形；辅助色管左上角的背景光和 logo 的圆角底；
 *   2) Popover ColorPicker：点击色盘弹出气泡，内含主色系、辅助色系两条梯度色块 + 主色的二维取色板；
 *      自定义额外提供色相条与 RGB / HEX 输入框（全色彩），辅助色取主色的浅色；
 *   3) 原地换色：应用后全屏粒子自四周螺旋凝聚 → 爆开瞬间闪换成新配色，
 *      不重载页面、不丢当前状态；粒子视觉语言与私密模式切换同源；
 *   4) 按模式各存一套：正常模式 / 私密模式各记自己的配色，互不干扰；
 *      某模式从未设置过时不写入任何覆盖，沿用 css 的默认色（正常 = 霓虹夜场，私密 = 铜色）；
 *      「恢复默认」就是删掉这份存档、撤掉覆盖。
 *
 * 落点：主色写 --color-primary 一组变量（其余派生色 rgba(var(--color-primary-rgb), …) 自动跟随），
 * 辅助色等派生值写 --v2-* 变量，算好后连同存档一起保存。
 * 刷新时的首帧由 index.html / player.html 的 head 内联脚本先行应用：主色按同一套算法现算，
 * 派生变量直接读存档（避免先闪默认色再切到目标色），改动主色派生算法时三处需同步。
 */
(function () {
    'use strict';

    // ===================== 常量 =====================

    // 存储键：按数据域分开，正常/私密模式各存一套主题
    var KEY_NORMAL = 'leletv_theme_normal';
    var KEY_HIDDEN = 'leletv_theme_hidden';
    var MODE_ATTR = 'data-hidden-mode';

    // 键名对外暴露一份，供设置项的导入/导出等模块复用（键名在这里是唯一来源，
    // 免得别处再抄一遍字符串、两边不同步）
    window.LeLeThemeStore = {
        KEYS: [KEY_NORMAL, KEY_HIDDEN],
        isKey: function (key) { return key === KEY_NORMAL || key === KEY_HIDDEN; }
    };

    // 默认落点：与 css 的 :root 默认色一致的预设
    var DEFAULT_KEY = 'neon';

    /*
     * 配色方案（两行 × 6，与卡片中的网格顺序一致）
     * 命名：方案名取自观影的场景或电影术语，色名 = 意象 + 颜色。
     * 前三套沿用 logo 的三套配色；其余按色相铺开，彩度（OKLCH C）压在 0.08～0.15，
     * 只有默认的霓虹粉保留品牌原色。主色在夜黑底上的对比度都在 5.5:1 以上。
     *   word：导航字标颜色，'main' 取主色、'aux' 取辅助色，缺省取主色的浅色
     *   blush：主色浅色的替代值，'aux' 表示直接用辅助色（樱花白本就是霓虹粉的浅色）
     */
    var PRESETS = [
        { key: 'neon', name: '霓虹夜场', main: { name: '霓虹粉', hex: '#EC4899' }, aux: { name: '樱花白', hex: '#FFE4F1' }, bg: '#0A0A0B', word: 'aux', blush: 'aux' },
        { key: 'screening', name: '私人放映厅', main: { name: '黄铜金', hex: '#F0B862' }, aux: { name: '丝绒红', hex: '#6E1F38' }, bg: '#0E0B0A', word: 'main' },
        { key: 'aurora', name: '极光穹顶', main: { name: '极光紫', hex: '#8B7BFF' }, aux: { name: '极光青', hex: '#46E3D0' }, bg: '#07070F' },
        { key: 'darkroom', name: '胶片暗房', main: { name: '安全灯红', hex: '#D9695F' }, aux: { name: '相纸白', hex: '#F2E7DC' }, bg: '#0D0A0A' },
        { key: 'magichour', name: '魔幻时刻', main: { name: '晚霞橘', hex: '#E8956B' }, aux: { name: '暮光紫', hex: '#8D7CC6' }, bg: '#0C0A0E' },
        { key: 'openair', name: '露天影院', main: { name: '萤火绿', hex: '#9DC47F' }, aux: { name: '灯串黄', hex: '#EFD48E' }, bg: '#090B09' },
        { key: 'seaside', name: '海岸放映', main: { name: '海雾青', hex: '#6CBFB5' }, aux: { name: '珊瑚橘', hex: '#EE9D87' }, bg: '#080B0B' },
        { key: 'latenight', name: '深夜影院', main: { name: '月夜蓝', hex: '#7FA5DC' }, aux: { name: '星光银', hex: '#DAE2EE' }, bg: '#08090E' },
        { key: 'curtain', name: '谢幕时分', main: { name: '帷幕紫', hex: '#B48BD8' }, aux: { name: '追光白', hex: '#F4EDE2' }, bg: '#0B090E' },
        { key: 'spring', name: '春日影展', main: { name: '桃花粉', hex: '#E2799F' }, aux: { name: '新芽绿', hex: '#B7D59B' }, bg: '#0C0A0B' },
        { key: 'silent', name: '黑白默片', main: { name: '银盐灰', hex: '#C4C8D0' }, aux: { name: '碳素灰', hex: '#5C606A' }, bg: '#0A0A0A' },
        { key: 'custom', name: '自定义', main: null, aux: null }
    ];

    // 私密模式的默认主色（css html[data-hidden-mode] 的铜色），恢复默认时粒子过渡用
    var HIDDEN_DEFAULT_RGB = [184, 115, 51];
    var DEFAULT_BG = '#0A0A0B';
    var INK_DARK = '#111113';          // 浅色主色按钮上的深色文字
    var TILE_BASE = [20, 20, 24];      // logo 圆角底：辅助色按深浅混进这个深底
    // 除主色外，由配色派生、写在 <html> 行内样式上的变量（首帧脚本按同一份名单读存档）
    var EXTRA_VARS = ['--v2-blush', '--v2-word', '--v2-aux', '--v2-aux-rgb', '--v2-glow-2', '--v2-tile', '--v2-on-accent', '--v2-bg'];

    function presetOf(key) {
        for (var i = 0; i < PRESETS.length; i++) {
            if (PRESETS[i].key === key) return PRESETS[i];
        }
        return null;
    }

    // Tailwind pink 调色板的档位与对应亮度（暗色主题下由深到浅的层次）
    var RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    var RAMP_L = [96, 93, 87, 80, 70, 60, 51, 43, 35, 26];
    // 无彩色（灰色系、或自定义选到纯灰）另用一套：从白到黑铺满，
    // 让「灰色系」拿到的是一整条黑—灰—白，而不是被压在中间的一小段浅色
    var RAMP_L_MONO = [100, 89, 78, 67, 56, 44, 33, 22, 11, 0];
    var MONO_SAT_THRESHOLD = 5; // 饱和度低于此值视作无彩色

    // 自定义色盘未设置过时的占位：一条彩虹渐变，提示"可自由选色"
    var CUSTOM_PLACEHOLDER =
        'conic-gradient(from 210deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899, #ef4444)';

    var RAMP_STOPS_SET = RAMP_STOPS.map(function (n) { return '--tw-pink-' + n + '-rgb'; });
    var BASE_VARS = [
        '--color-primary', '--color-primary-rgb',
        '--color-primary-300', '--color-primary-400', '--color-primary-400-rgb',
        '--color-primary-600', '--color-primary-600-rgb'
    ];

    // ===================== 颜色工具 =====================

    function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

    /** 十六进制（#rgb / #rrggbb）→ [r, g, b]，非法值返回 null */
    function hexToRgb(hex) {
        var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex == null ? '' : hex).trim());
        if (!m) return null;
        var h = m[1];
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }

    function rgbToHex(rgb) {
        return '#' + rgb.map(function (v) {
            return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
        }).join('');
    }

    /** [r, g, b] → [h(0-360), s(0-1), v(0-1)] */
    function rgbToHsv(rgb) {
        var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        var h = 0;
        if (d > 1e-6) {
            if (mx === r) h = 60 * (((g - b) / d) % 6);
            else if (mx === g) h = 60 * ((b - r) / d + 2);
            else h = 60 * ((r - g) / d + 4);
        }
        if (h < 0) h += 360;
        return [h, mx <= 0 ? 0 : d / mx, mx];
    }

    /** [h(0-360), s(0-1), v(0-1)] → [r, g, b]（0-255 浮点） */
    function hsvToRgb(h, s, v) {
        h = ((h % 360) + 360) % 360;
        var c = v * s;
        var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        var m = v - c;
        var r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
    }

    /** [r, g, b] → [h(0-360), s(0-100), l(0-100)] */
    function rgbToHsl(rgb) {
        var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        var l = (mx + mn) / 2, d = mx - mn;
        var h = 0, s = 0;
        if (d > 1e-6) {
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            if (mx === r) h = 60 * (((g - b) / d) % 6);
            else if (mx === g) h = 60 * ((b - r) / d + 2);
            else h = 60 * ((r - g) / d + 4);
        }
        if (h < 0) h += 360;
        return [h, s * 100, l * 100];
    }

    /** [h(0-360), s(0-100), l(0-100)] → [r, g, b]（0-255 浮点） */
    function hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360;
        s /= 100;
        l /= 100;
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        var m = l - c / 2;
        var r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
    }

    /**
     * 由主色派生整套主题色。
     * 只调整亮度、保留原色相与饱和度：无彩色主色（灰色系）自然得到灰阶，
     * 彩色主色则得到与霓虹粉同構的明度层次。
     */
    function buildPalette(hex) {
        var rgb = hexToRgb(hex) || hexToRgb(presetOf(DEFAULT_KEY).main.hex);
        var hsl = rgbToHsl(rgb);
        var h = hsl[0];
        var s = clamp(hsl[1], 0, 100);
        // 无彩色另走一套明度表：铺满黑→白，含中间各档灰
        var lTable = s < MONO_SAT_THRESHOLD ? RAMP_L_MONO : RAMP_L;
        var ramp = lTable.map(function (l) { return hslToRgb(h, s, l); });
        return {
            hex: rgbToHex(rgb),
            rgb: rgb.map(function (v) { return Math.round(v); }),
            ramp: ramp,
            p300: rgbToHex(ramp[3]),
            p400: rgbToHex(ramp[4]),
            p600: rgbToHex(ramp[6])
        };
    }

    /** WCAG 相对亮度 */
    function relLum(rgb) {
        var f = function (v) {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
    }

    function contrastRatio(a, b) {
        var x = relLum(a), y = relLum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }

    /** 两色按比例混合，t 为 a 的占比 */
    function mixRgb(a, b, t) {
        return [0, 1, 2].map(function (i) { return a[i] * t + b[i] * (1 - t); });
    }

    /** 自定义主色没有配套的辅助色：取主色的浅色，和霓虹粉 / 樱花白的关系一致 */
    function defaultAuxFor(pal, preset) {
        if (preset && preset.aux) return preset.aux.hex;
        return rgbToHex(mixRgb(pal.rgb, [255, 255, 255], 0.16));
    }

    /**
     * 由主色 + 辅助色派生其余变量：
     *   --v2-blush      主色的浅色：渐变字顶端、链接悬停、聚合区分割线的光芯
     *   --v2-word       导航字标
     *   --v2-aux(-rgb)  辅助色本身
     *   --v2-glow-2     左上角背景光：浅辅助色透明度 0.15，越深越浓（最高 0.36），否则深底上看不出来
     *   --v2-tile       logo 图形的圆角底：浅辅助色只混 10%，深辅助色混到一半
     *   --v2-on-accent  主色按钮上的文字：白字对比度不到 3:1（黄铜金、萤火绿这类浅色）改用深色字
     *   --v2-bg         页面底色
     */
    function deriveVars(pal, auxHex, preset) {
        var aux = hexToRgb(auxHex) || hexToRgb(defaultAuxFor(pal, preset));
        var auxRgb = aux.map(function (v) { return Math.round(v); });
        var auxL = relLum(aux);
        var blush = (preset && preset.blush === 'aux') ? rgbToHex(aux) : rgbToHex(mixRgb(pal.rgb, [255, 255, 255], 0.18));
        var word = blush;
        if (preset && preset.word === 'main') word = pal.hex;
        else if (preset && preset.word === 'aux') word = rgbToHex(aux);
        var glowA = clamp(0.15 + (0.35 - auxL) * 0.6, 0.15, 0.36);
        var tile = mixRgb(aux, TILE_BASE, clamp(0.5 - auxL * 1.1, 0.1, 0.5));
        var btnMid = mixRgb(hexToRgb(pal.p400), hexToRgb(pal.p600), 0.5);
        return {
            '--v2-blush': blush.toUpperCase(),
            '--v2-word': word.toUpperCase(),
            '--v2-aux': rgbToHex(aux).toUpperCase(),
            '--v2-aux-rgb': auxRgb.join(', '),
            '--v2-glow-2': 'rgba(' + auxRgb.join(', ') + ', ' + glowA.toFixed(3) + ')',
            '--v2-tile': rgbToHex(tile).toUpperCase(),
            '--v2-on-accent': contrastRatio([255, 255, 255], btnMid) >= 3 ? '#FFFFFF' : INK_DARK,
            '--v2-bg': (preset && preset.bg) || DEFAULT_BG
        };
    }

    /** 一套完整配色：{ key, pal（主色派生）, aux, vars（其余派生变量） } */
    function buildTheme(key, mainHex, auxHex) {
        var preset = presetOf(key);
        var pal = buildPalette(mainHex);
        var auxRgb = hexToRgb(auxHex);
        var aux = auxRgb ? rgbToHex(auxRgb) : defaultAuxFor(pal, preset);
        return { key: key, pal: pal, aux: aux, vars: deriveVars(pal, aux, preset) };
    }

    // ===================== 应用 / 清除主题变量 =====================

    function applyTheme(theme) {
        applyPalette(theme.pal);
        var st = document.documentElement.style;
        EXTRA_VARS.forEach(function (name) {
            if (typeof theme.vars[name] === 'string') st.setProperty(name, theme.vars[name]);
            else st.removeProperty(name);
        });
    }

    /** 把派生色写进 <html> 的行内样式：行内样式优先级高于 css 的 html[data-hidden-mode] 规则 */
    function applyPalette(pal) {
        var st = document.documentElement.style;
        st.setProperty('--color-primary', pal.hex);
        st.setProperty('--color-primary-rgb', pal.rgb.join(', '));
        st.setProperty('--color-primary-300', pal.p300);
        st.setProperty('--color-primary-400', pal.p400);
        st.setProperty('--color-primary-400-rgb', hexToRgb(pal.p400).join(', '));
        st.setProperty('--color-primary-600', pal.p600);
        st.setProperty('--color-primary-600-rgb', hexToRgb(pal.p600).join(', '));
        RAMP_STOPS.forEach(function (stop, i) {
            st.setProperty('--tw-pink-' + stop + '-rgb', pal.ramp[i].map(function (v) {
                return Math.round(v);
            }).join(' '));
        });
    }

    /** 撤掉覆盖，回落到 css 的默认色（正常 = 霓虹夜场，私密 = 铜色） */
    function clearPalette() {
        var st = document.documentElement.style;
        BASE_VARS.concat(RAMP_STOPS_SET, EXTRA_VARS).forEach(function (name) {
            st.removeProperty(name);
        });
    }

    /** 当前主色（取 CSS 变量的真实值，取不到时回落到霓虹粉） */
    function readPrimaryRgb() {
        try {
            var v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim();
            var parts = v.split(',').map(function (n) { return parseInt(n, 10); });
            if (parts.length === 3 && parts.every(function (n) { return n >= 0 && n <= 255; })) return parts;
        } catch (e) { /* 忽略 */ }
        return [236, 72, 153];
    }

    // ===================== 持久化（按模式各存一套） =====================

    function isHiddenMode() {
        try { return document.documentElement.hasAttribute(MODE_ATTR); } catch (e) { return false; }
    }

    function storageKey() { return isHiddenMode() ? KEY_HIDDEN : KEY_NORMAL; }

    /**
     * 读取当前模式已保存的配色：{ key, hex, aux, vars }；从未设置过返回 null。
     * 旧版存档只有 { key, hex }，且色系已换成配色方案：撤下的旧色系（红色系、棕褐色系……）
     * 保留用户选过的颜色，归到「自定义」。
     */
    function loadState() {
        try {
            var raw = localStorage.getItem(storageKey());
            if (!raw) return null;
            var st = JSON.parse(raw);
            var rgb = st && hexToRgb(st.hex);
            if (!rgb) return null;
            var key = String(st.key || 'custom');
            if (!presetOf(key)) key = 'custom';
            var auxRgb = hexToRgb(st.aux);
            return {
                key: key,
                hex: rgbToHex(rgb),
                aux: auxRgb ? rgbToHex(auxRgb) : '',
                vars: (st.vars && typeof st.vars === 'object') ? st.vars : null
            };
        } catch (e) { return null; }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(storageKey(), JSON.stringify({
                key: theme.key,
                hex: theme.pal.hex,
                aux: theme.aux,
                vars: theme.vars
            }));
        } catch (e) { /* 隐私模式等场景忽略 */ }
    }

    function clearState() {
        try { localStorage.removeItem(storageKey()); } catch (e) { /* 忽略 */ }
    }

    /** 已保存配色对应的完整主题；没存过返回 null */
    function savedTheme() {
        var saved = loadState();
        return saved ? buildTheme(saved.key, saved.hex, saved.aux) : null;
    }

    // ===================== 配色卡片 =====================

    /** 色盘显示的主色：自定义且没存过自定义色时用彩虹占位 */
    function discColorOf(preset) {
        if (preset.key !== 'custom') return preset.main.hex;
        var saved = loadState();
        return (saved && saved.key === 'custom') ? saved.hex : CUSTOM_PLACEHOLDER;
    }

    /** 色盘显示的辅助色：自定义且没存过时留空，让主色占满整圆 */
    function auxColorOf(preset) {
        if (preset.key !== 'custom') return preset.aux.hex;
        var saved = loadState();
        return (saved && saved.key === 'custom' && saved.aux) ? saved.aux : 'transparent';
    }

    /** 方案卡片第二行：预设写主色名与辅助色名；自定义写已存的色值，没存过就提示可自选 */
    function subtitleOf(preset) {
        if (preset.main) return preset.main.name + ' · ' + preset.aux.name;
        var saved = loadState();
        if (saved && saved.key === 'custom') return saved.hex.toUpperCase() + (saved.aux ? ' · ' + saved.aux.toUpperCase() : '');
        return '自选主色与辅助色';
    }

    /** 方案卡片的颜色：大圆是主色，右下角的小圆是辅助色；没有辅助色（自定义未设置）时只画主色 */
    function paintScheme(btn, preset) {
        var aux = auxColorOf(preset);
        btn.style.setProperty('--disc-color', discColorOf(preset));
        btn.style.setProperty('--disc-aux', aux);
        btn.classList.toggle('is-mono', aux === 'transparent');
        var sub = btn.querySelector('.theme-scheme-sub');
        if (sub) sub.textContent = subtitleOf(preset);
    }

    function renderCard() {
        var grid = document.getElementById('themeDiscGrid');
        if (!grid) return;
        grid.textContent = ''; // 内容全部由代码生成（无用户输入），先清空避免重复渲染
        var frag = document.createDocumentFragment();
        PRESETS.forEach(function (preset) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'theme-scheme';
            btn.setAttribute('data-theme-key', preset.key);
            btn.title = preset.main ? '主色 ' + preset.main.name + ' ' + preset.main.hex + '　辅助色 ' + preset.aux.name + ' ' + preset.aux.hex : '自定义主色与辅助色';

            var swatch = document.createElement('span');
            swatch.className = 'theme-swatch';
            swatch.setAttribute('aria-hidden', 'true');

            var text = document.createElement('span');
            text.className = 'theme-scheme-text';
            var name = document.createElement('b');
            name.textContent = preset.name;
            var sub = document.createElement('small');
            sub.className = 'theme-scheme-sub';
            text.appendChild(name);
            text.appendChild(sub);

            btn.appendChild(swatch);
            btn.appendChild(text);
            paintScheme(btn, preset);
            frag.appendChild(btn);
        });
        grid.appendChild(frag);
        syncSelection();
    }

    /** 高亮当前生效的配色（从未设置过时，正常模式与默认配色算作选中） */
    function syncSelection() {
        var grid = document.getElementById('themeDiscGrid');
        if (!grid) return;
        var saved = loadState();
        var activeKey = saved ? saved.key : (isHiddenMode() ? '' : DEFAULT_KEY);
        Array.prototype.forEach.call(grid.querySelectorAll('.theme-scheme'), function (btn) {
            var on = btn.getAttribute('data-theme-key') === activeKey;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        var custom = grid.querySelector('.theme-scheme[data-theme-key="custom"]');
        if (custom) paintScheme(custom, presetOf('custom'));
        var reset = document.getElementById('themeResetBtn');
        if (reset) reset.hidden = !saved;
    }

    // ===================== 换色过渡 =====================
    // 与首屏加载动画同一套视觉：粒子自四周螺旋凝聚（旧色）→ 中心实体化出 LeLeTV（旧色）
    // → 爆开，粒子与页面同时切成新色并向外飞散。
    // 关键：不重载、不改动 DOM —— 页面在整段过渡里保持静止（不抖动、不重排、不换内容），
    // 动的只有这层透明画布；新颜色要到"爆开"那一刻才落到页面上。

    var PHASE_GATHER_MS = 560;   // 粒子自四周收拢到星环上
    var PHASE_BRAND_MS = 480;    // 中心 LeLeTV 实体化 + 停留（此时页面仍是旧色）
    var PHASE_BURST_MS = 430;    // 爆开：这一刻换色，粒子自星环向外飞散
    var PHASE_FADE_MS = 200;     // 覆盖层淡出
    var BRAND_TEXT = 'LeLeTV';
    // 星环：基准半径与首屏加载动画的 brandRadius 一致（字号 × 1.5），尺寸所以对得上。
    // 它的环带是 [0.72R, 1.2R]；这里刻意做得更厚，外围散落也更多
    var RING_IN = 0.62;          // 星环内径 / 基准半径
    var RING_OUT = 1.55;         // 星环外径 / 基准半径
    var RING_SPIN = 0.00025;     // 星环整体缓慢自转（弧度/毫秒）

    function reducedMotion() {
        if (window.LeLeMotion) return window.LeLeMotion.reduced();   // 设置里可强制开启 / 关闭
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function playThemeBurst(oldRgb, newRgb, switchTheme, onDone) {
        var done = function () { if (onDone) onDone(); };
        if (reducedMotion()) { switchTheme(); done(); return; }

        var w = window.innerWidth, h = window.innerHeight;
        var cv = document.createElement('canvas');
        cv.className = 'theme-burst-canvas';
        // 样式内联：这层只是过渡用的覆盖画布，不必占用样式表里的规则
        cv.style.cssText = 'position:fixed;inset:0;z-index:9990;display:block;pointer-events:none;background:transparent;';
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.max(1, Math.floor(w * dpr));
        cv.height = Math.max(1, Math.floor(h * dpr));
        cv.style.width = w + 'px';
        cv.style.height = h + 'px';
        var ctx = cv.getContext('2d');
        if (!ctx) { switchTheme(); done(); return; }
        document.body.appendChild(cv);
        ctx.scale(dpr, dpr);

        var cx = w / 2, cy = h / 2;
        var maxR = Math.sqrt(cx * cx + cy * cy);
        var brandSize = clamp(w * 0.15, 26, 82);   // 与首屏占位字样的 clamp(26px, 15vw, 82px) 对齐
        var ringBase = brandSize * 1.5;            // 与加载动画 drawRing 的 brandRadius 同值
        var count = clamp(Math.round((w * h) / 2000), 320, 900);
        var parts = [];
        for (var i = 0; i < count; i++) {
            var rnd = Math.random();
            parts.push({
                a0: Math.random() * Math.PI * 2,
                r0: maxR * (0.65 + Math.random() * 0.55),   // 凝聚起点：都在环外，保证是"收进来"
                ring: RING_IN + Math.random() * (RING_OUT - RING_IN), // 该粒子落在哪一圈：内→外径之间散布
                r1: maxR * (0.35 + Math.random() * 0.90),   // 爆开终点半径
                swirl: (0.7 + Math.random() * 0.9) * (rnd < 0.5 ? -1 : 1),
                size: 0.8 + Math.random() * 1.7,
                delay: Math.random() * 0.18
            });
        }

        var brandFrom = PHASE_GATHER_MS * 0.68;            // 凝聚尾段就让字样浮现，避免"停一下再出字"
        var burstAt = PHASE_GATHER_MS + PHASE_BRAND_MS;    // 爆开时刻 = 换色时刻
        var total = burstAt + PHASE_BURST_MS + PHASE_FADE_MS;
        var start = 0, switched = false, useRgb = oldRgb;

        function frame(now) {
            if (!start) start = now;
            var t = now - start;
            ctx.clearRect(0, 0, w, h);

            // 颜色直到爆开那一帧才切换；此前粒子与字样一律旧色，页面也保持旧色
            if (t >= burstAt && !switched) {
                switched = true;
                switchTheme();
            }
            useRgb = switched ? newRgb : oldRgb;
            ctx.fillStyle = 'rgb(' + useRgb[0] + ',' + useRgb[1] + ',' + useRgb[2] + ')';

            var inGather = t < PHASE_GATHER_MS;
            var inBrand = !inGather && t < burstAt;
            var gp = clamp(t / PHASE_GATHER_MS, 0, 1);
            var up = clamp((t - burstAt) / PHASE_BURST_MS, 0, 1);
            var spin = t * RING_SPIN;    // 星环整体缓慢自转

            for (var i = 0; i < parts.length; i++) {
                var q = parts[i];
                var lp, le, r, alpha, a;
                // 每颗粒子有自己的环半径：在内径与外径之间铺开，环带所以有厚度、外围也更散
                var ringR = q.ring * ringBase;
                // 三段共用同一套角度：起始角 + 一点旋进 + 整体自转。
                // 旋进量刻意压得很小——每颗粒子随机正反大幅旋转正是"花瓣"的来源
                var swirl = q.swirl * 0.3;
                if (inGather) {
                    // 自四周收到星环上（终点是环，不是中心）
                    lp = clamp((gp - q.delay) / (1 - q.delay), 0, 1); // 每颗粒子的延迟，避免整齐划一
                    le = 1 - Math.pow(1 - lp, 3);                    // easeOutCubic
                    r = q.r0 * (1 - le) + ringR * le;
                    alpha = 0.10 + 0.78 * le;
                    a = q.a0 + swirl * le + spin;
                } else if (inBrand) {
                    // 停在星环上缓慢转动，把中间留给字样
                    r = ringR;
                    alpha = 0.88;
                    a = q.a0 + swirl + spin;
                } else {
                    // 自星环向外飞散
                    lp = clamp((up - q.delay) / (1 - q.delay), 0, 1);
                    le = 1 - Math.pow(1 - lp, 3);
                    r = ringR + q.r1 * le;
                    alpha = 0.85 * (1 - lp);
                    a = q.a0 + swirl + spin + le * 0.5;
                }
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, q.size, 0, 6.2832);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // 中心字样：凝聚尾段浮现 → 停留（旧色）→ 随爆开淡出，颜色取当前 useRgb
            var brandIn = clamp((t - brandFrom) / (PHASE_GATHER_MS - brandFrom), 0, 1);
            var brandOut = 1 - clamp((t - burstAt) / (PHASE_BURST_MS * 0.42), 0, 1);
            var brandAlpha = brandIn * brandOut;
            if (brandAlpha > 0.01) drawBrand(brandAlpha, 0.92 + 0.08 * brandIn);

            if (t >= burstAt + PHASE_BURST_MS) {
                cv.style.opacity = String(1 - clamp((t - burstAt - PHASE_BURST_MS) / PHASE_FADE_MS, 0, 1));
            }
            if (t < total) {
                requestAnimationFrame(frame);
            } else {
                if (cv.parentNode) cv.parentNode.removeChild(cv);
                done();
            }
        }

        /** 中心 logo：圆角方块里的乐字 + 字标（brand-canvas.js，路径取自页面的品牌 sprite）；取不到 sprite 时退回文字 */
        function drawBrand(alpha, scale) {
            var brand = window.LeLeBrandCanvas;
            if (brand && brand.draw(ctx, cx, cy, brandSize * 1.1, useRgb, alpha, scale)) return;
            var rgba = function (v) { return 'rgba(' + useRgb[0] + ',' + useRgb[1] + ',' + useRgb[2] + ',' + v + ')'; };
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.font = '900 ' + brandSize + 'px "MapleMono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = rgba(0.55);
            ctx.shadowBlur = 28;
            ctx.fillStyle = rgba(0.5);
            ctx.fillText(BRAND_TEXT, 0, 0);
            ctx.shadowBlur = 0;
            var grad = ctx.createLinearGradient(0, -brandSize * 0.6, 0, brandSize * 0.6);
            grad.addColorStop(0, rgba(0.95));
            grad.addColorStop(0.45, rgba(0.45));
            grad.addColorStop(1, rgba(0.18));
            ctx.fillStyle = grad;
            ctx.fillText(BRAND_TEXT, 0, 0);
            ctx.strokeStyle = rgba(0.25);
            ctx.lineWidth = 1;
            ctx.strokeText(BRAND_TEXT, 0, 0);
            ctx.restore();
        }

        requestAnimationFrame(frame);
    }

    /** app-routing.js 在模块顶层缓存了主题色；换色后置空，让它的粒子下次重新读取新色 */
    function resetParticleThemeCache() {
        try { if (window._themeRgbCache !== undefined) window._themeRgbCache = null; } catch (e) { /* 忽略 */ }
    }

    // ===================== Popover ColorPicker =====================

    var _picker = null;
    var _dragging = null;
    var _dragCleanup = null;
    var _busy = false; // 过渡动画进行中：忽略重复提交
    var _openedAt = 0; // 气泡打开的时刻：滚动事件是异步派发的，点击前那下滚动可能在打开之后才到，得放过

    function currentPickerRgb() { return hsvToRgb(_picker.h, _picker.s, _picker.v); }
    function currentPickerHex() { return rgbToHex(currentPickerRgb()); }

    function ensurePicker() {
        if (_picker) return _picker;

        var el = document.createElement('div');
        el.className = 'theme-picker-popover';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', '主题色选择器');
        el.innerHTML =
            '<div class="theme-picker-head">' +
                '<span class="theme-picker-swatch" data-role="swatch"></span>' +
                '<span class="theme-picker-name" data-role="name"></span>' +
                '<span class="theme-picker-hex" data-role="hex"></span>' +
                '<button type="button" class="theme-picker-close" data-role="close" aria-label="关闭">&times;</button>' +
            '</div>' +
            '<div class="theme-picker-row" data-role="rampRow">' +
                '<span class="theme-picker-row-label" data-role="rampLabel">主色</span>' +
                '<div class="theme-picker-ramp" data-role="ramp"></div>' +
            '</div>' +
            '<div class="theme-picker-row">' +
                '<span class="theme-picker-row-label" data-role="rampAuxLabel">辅助色</span>' +
                '<div class="theme-picker-ramp" data-role="rampAux"></div>' +
            '</div>' +
            '<div class="theme-picker-plane" data-role="plane">' +
                '<span class="theme-picker-plane-dot" data-role="planeDot"></span>' +
            '</div>' +
            '<div class="theme-picker-hue" data-role="hue" hidden>' +
                '<span class="theme-picker-hue-dot" data-role="hueDot"></span>' +
            '</div>' +
            '<div class="theme-picker-rgb" data-role="rgbBox" hidden>' +
                '<label>R<input type="number" min="0" max="255" step="1" inputmode="numeric" data-role="r" aria-label="红色分量"></label>' +
                '<label>G<input type="number" min="0" max="255" step="1" inputmode="numeric" data-role="g" aria-label="绿色分量"></label>' +
                '<label>B<input type="number" min="0" max="255" step="1" inputmode="numeric" data-role="b" aria-label="蓝色分量"></label>' +
            '</div>' +
            '<div class="theme-picker-code" data-role="hexBox" hidden>' +
                '<label>HEX<input type="text" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" data-role="hexInput" placeholder="#3366FF" aria-label="十六进制色值"></label>' +
            '</div>' +
            '<div class="theme-picker-actions">' +
                '<button type="button" class="v2-btn v2-btn--secondary v2-btn--sm" data-role="cancel">取消</button>' +
                '<button type="button" class="v2-btn v2-btn--primary v2-btn--sm" data-role="apply">应用</button>' +
            '</div>';
        document.body.appendChild(el);

        var q = function (role) { return el.querySelector('[data-role="' + role + '"]'); };
        var p = {
            el: el,
            swatch: q('swatch'), name: q('name'), hexText: q('hex'),
            rampRow: q('rampRow'), ramp: q('ramp'), rampAux: q('rampAux'),
            rampLabel: q('rampLabel'), rampAuxLabel: q('rampAuxLabel'),
            plane: q('plane'), planeDot: q('planeDot'),
            hue: q('hue'), hueDot: q('hueDot'),
            rgbBox: q('rgbBox'), r: q('r'), g: q('g'), b: q('b'),
            hexBox: q('hexBox'), hexInput: q('hexInput'),
            custom: false, presetKey: '', presetName: '',
            auxHex: '#FFE4F1', auxBaseHex: '#FFE4F1',
            h: 330, s: 0.8, v: 0.93
        };
        _picker = p;

        // 辅助色的十档色块只建一次，打开时只换颜色
        for (var i = 0; i < RAMP_STOPS.length; i++) {
            var auxSw = document.createElement('button');
            auxSw.type = 'button';
            auxSw.setAttribute('data-ramp-index', String(i));
            auxSw.setAttribute('aria-label', '辅助色阶 ' + RAMP_STOPS[i]);
            p.rampAux.appendChild(auxSw);
        }

        // --- 拖动取色：二维板（饱和度 × 明度）与色相条 ---
        var startDrag = function (kind) {
            return function (e) {
                e.preventDefault();
                _dragging = kind;
                updateFromPointer(kind, e);
                window.addEventListener('pointermove', onDragMove);
                window.addEventListener('pointerup', endDrag);
                window.addEventListener('pointercancel', endDrag);
            };
        };
        function onDragMove(e) { if (_dragging) updateFromPointer(_dragging, e); }
        function endDrag() {
            _dragging = null;
            window.removeEventListener('pointermove', onDragMove);
            window.removeEventListener('pointerup', endDrag);
            window.removeEventListener('pointercancel', endDrag);
        }
        _dragCleanup = endDrag; // 供 closePicker 中途收起时解除拖动监听
        p.plane.addEventListener('pointerdown', startDrag('plane'));
        p.hue.addEventListener('pointerdown', startDrag('hue'));

        // --- 梯度色块：点一下即取该档颜色（主色改取色点，辅助色只换辅助色）---
        p.ramp.addEventListener('click', function (e) {
            var swatch = e.target.closest ? e.target.closest('[data-ramp-index]') : null;
            if (!swatch) return;
            var idx = parseInt(swatch.getAttribute('data-ramp-index'), 10);
            var rgb = buildPalette(_picker.presetHex).ramp[idx];
            if (!rgb) return;
            var hsv = rgbToHsv(rgb);
            _picker.h = hsv[0];
            _picker.s = hsv[1];
            _picker.v = hsv[2];
            paintPicker(true);
        });

        p.rampAux.addEventListener('click', function (e) {
            var swatch = e.target.closest ? e.target.closest('[data-ramp-index]') : null;
            if (!swatch) return;
            var idx = parseInt(swatch.getAttribute('data-ramp-index'), 10);
            var rgb = buildPalette(_picker.auxBaseHex).ramp[idx];
            if (!rgb) return;
            _picker.auxHex = rgbToHex(rgb);
            paintAuxRamp();
        });

        // --- RGB 输入：手动快速填写 ---
        function onRgbInput() {
            if (!_picker.custom) return;
            var rr = clamp(parseInt(_picker.r.value, 10) || 0, 0, 255);
            var gg = clamp(parseInt(_picker.g.value, 10) || 0, 0, 255);
            var bb = clamp(parseInt(_picker.b.value, 10) || 0, 0, 255);
            var hsv = rgbToHsv([rr, gg, bb]);
            _picker.h = hsv[0];
            _picker.s = hsv[1];
            _picker.v = hsv[2];
            // 回写输入框（会同步 HEX；正在编辑的那一格由 paintPicker 自行跳过）
            paintPicker(true);
        }
        [p.r, p.g, p.b].forEach(function (input) {
            input.addEventListener('input', onRgbInput);
            input.addEventListener('change', onRgbInput);
        });

        // --- HEX 输入：与 RGB 等价的手动填写方式（#RGB / #RRGGBB，可省略 #）---
        function onHexInput() {
            if (!_picker.custom) return;
            var rgb = hexToRgb(_picker.hexInput.value);
            // 输入中途（如刚敲到 "33"）解析不通过就保持现状，不打断输入
            if (!rgb) return;
            var hsv = rgbToHsv(rgb);
            _picker.h = hsv[0];
            _picker.s = hsv[1];
            _picker.v = hsv[2];
            // 回写输入框（会同步 RGB；HEX 自己正在编辑，由 paintPicker 跳过）
            paintPicker(true);
        }
        p.hexInput.addEventListener('input', onHexInput);
        p.hexInput.addEventListener('change', onHexInput);
        // 失焦时把随手输入的 "3366ff" 规范成 "#3366FF"
        p.hexInput.addEventListener('blur', function () {
            p.hexInput.value = currentPickerHex().toUpperCase();
        });

        q('close').addEventListener('click', closePicker);
        q('cancel').addEventListener('click', closePicker);
        q('apply').addEventListener('click', function () {
            var mainHex = currentPickerHex();
            var key = _picker.custom ? 'custom' : _picker.presetKey;
            var auxHex = _picker.auxHex;
            closePicker();
            commitTheme(key, mainHex, auxHex);
        });

        return p;
    }

    function updateFromPointer(kind, e) {
        var p = _picker;
        if (!p) return;
        if (kind === 'plane') {
            var pr = p.plane.getBoundingClientRect();
            if (!pr.width || !pr.height) return;
            p.s = clamp((e.clientX - pr.left) / pr.width, 0, 1);
            p.v = 1 - clamp((e.clientY - pr.top) / pr.height, 0, 1);
        } else {
            var hr = p.hue.getBoundingClientRect();
            if (!hr.width) return;
            p.h = clamp((e.clientX - hr.left) / hr.width, 0, 1) * 360;
        }
        paintPicker(true);
    }

    /**
     * 重绘选择器内部状态。
     * syncInputs=true 时回写 RGB / HEX 输入框，但跳过当前正在编辑的那一格，
     * 这样 RGB 与 HEX 能互相同步、又不会打断正在敲的输入。
     */
    function paintPicker(syncInputs) {
        var p = _picker;
        if (!p) return;
        var hex = currentPickerHex();
        var rgb = currentPickerRgb().map(function (v) { return Math.round(v); });
        var pure = rgbToHex(hsvToRgb(p.h, 1, 1)); // 当前色相的最饱和色，用作二维板右端

        p.plane.style.background =
            'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ' + pure + ')';
        p.planeDot.style.left = (p.s * 100) + '%';
        p.planeDot.style.top = ((1 - p.v) * 100) + '%';
        p.planeDot.style.background = hex;
        p.hueDot.style.left = (p.h / 360 * 100) + '%';
        p.hueDot.style.background = pure;
        p.swatch.style.background = hex;
        p.hexText.textContent = hex.toUpperCase();

        // 始终同步 RGB / HEX 输入框：即使当前是预设色盘（这两个输入框隐藏），也避免残留上一次的旧值
        if (syncInputs) {
            if (document.activeElement !== p.r) p.r.value = String(rgb[0]);
            if (document.activeElement !== p.g) p.g.value = String(rgb[1]);
            if (document.activeElement !== p.b) p.b.value = String(rgb[2]);
            if (document.activeElement !== p.hexInput) p.hexInput.value = hex.toUpperCase();
        }
    }

    /** 辅助色色块：预设按该方案辅助色的色相铺十档，自定义按主色铺开；最接近当前辅助色的一档高亮 */
    function paintAuxRamp() {
        var p = _picker;
        if (!p) return;
        var ramp = buildPalette(p.auxBaseHex).ramp;
        var target = hexToRgb(p.auxHex) || [0, 0, 0];
        var best = -1, bestD = Infinity;
        ramp.forEach(function (rgb, i) {
            var d = Math.sqrt(Math.pow(rgb[0] - target[0], 2) + Math.pow(rgb[1] - target[1], 2) + Math.pow(rgb[2] - target[2], 2));
            if (d < bestD) { bestD = d; best = i; }
        });
        var swatches = p.rampAux.children;
        for (var i = 0; i < swatches.length && i < ramp.length; i++) {
            var hex = rgbToHex(ramp[i]);
            swatches[i].style.background = hex;
            swatches[i].title = hex.toUpperCase();
            swatches[i].classList.toggle('is-active', i === best && bestD < 48);
        }
    }

    function buildRamp(presetHex) {
        var p = _picker;
        var ramp = buildPalette(presetHex).ramp;
        p.ramp.textContent = '';
        var frag = document.createDocumentFragment();
        ramp.forEach(function (rgb, i) {
            var sw = document.createElement('button');
            sw.type = 'button';
            sw.setAttribute('data-ramp-index', String(i));
            sw.style.background = rgbToHex(rgb);
            sw.title = rgbToHex(rgb).toUpperCase();
            sw.setAttribute('aria-label', '色阶 ' + RAMP_STOPS[i]);
            frag.appendChild(sw);
        });
        p.ramp.appendChild(frag);
    }

    function positionPicker(anchorEl) {
        var p = _picker;
        var el = p.el;
        var rect = anchorEl.getBoundingClientRect();
        var w = el.offsetWidth || 248;
        var h = el.offsetHeight || 260;

        var left = clamp(rect.left + rect.width / 2 - w / 2, 8, Math.max(8, window.innerWidth - w - 8));
        var top = rect.bottom + 8;
        if (top + h > window.innerHeight - 8) {
            var above = rect.top - h - 8;
            top = above >= 8 ? above : clamp(window.innerHeight - h - 8, 8, Math.max(8, window.innerHeight - h - 8));
        }
        el.style.left = left + 'px';
        el.style.top = top + 'px';
    }

    function openPicker(anchorEl, preset) {
        var p = ensurePicker();
        var saved = loadState();
        var baseHex;
        if (preset.key === 'custom') {
            baseHex = (saved && saved.key === 'custom' && saved.hex) ? saved.hex : rgbToHex(readPrimaryRgb());
        } else {
            baseHex = preset.main.hex;
        }

        p.custom = preset.key === 'custom';
        p.presetKey = preset.key;
        p.presetName = preset.name;
        p.presetHex = baseHex;

        var hsv = rgbToHsv(hexToRgb(baseHex));
        p.h = hsv[0];
        p.s = hsv[1];
        p.v = hsv[2];

        // 辅助色：预设取该方案的辅助色（用户改过就用他改的），自定义取主色的浅色
        p.auxHex = (saved && saved.key === preset.key && saved.aux)
            ? saved.aux
            : defaultAuxFor(buildPalette(baseHex), preset);
        p.auxBaseHex = p.custom ? baseHex : preset.aux.hex;

        p.name.textContent = p.custom ? '自定义颜色' : preset.name;
        p.rampLabel.textContent = preset.main ? '主色 · ' + preset.main.name : '主色';
        p.rampAuxLabel.textContent = preset.aux ? '辅助色 · ' + preset.aux.name : '辅助色';
        // 色块梯度的基准色：预设 = 该方案的主色 / 辅助色；自定义 = 主色的浅色
        p.ramp.hidden = false;
        p.rampRow.hidden = false;
        // 自定义是全色彩取色器，另给色相条 + RGB / HEX 输入
        p.hue.hidden = !p.custom;
        p.rgbBox.hidden = !p.custom;
        p.hexBox.hidden = !p.custom;
        buildRamp(baseHex);
        paintAuxRamp();
        paintPicker(true);

        // 先显示再测量，保证气泡按真实高度决定朝上还是朝下
        p.el.style.visibility = 'hidden';
        p.el.classList.add('is-open');
        positionPicker(anchorEl);
        p.el.style.visibility = '';
        _openedAt = Date.now();
    }

    function closePicker() {
        if (!_picker) return;
        if (_dragging && _dragCleanup) _dragCleanup();
        _dragging = null;
        _picker.el.classList.remove('is-open');
    }

    // ===================== 应用主题 =====================

    /**
     * 应用配色：存档后原地播放过渡动画，由它在"爆开"那一刻把新色落到页面上。
     * 全程不重载、不动 DOM —— 页面保持静止，只有那层过渡画布在动。
     */
    function commitTheme(key, mainHex, auxHex) {
        if (_busy) return;
        var theme = buildTheme(key, mainHex, auxHex);
        var oldRgb = readPrimaryRgb();
        _busy = true;
        saveTheme(theme);

        playThemeBurst(oldRgb, theme.pal.rgb, function () {
            applyTheme(theme);
            resetParticleThemeCache();
            syncSelection();
        }, function () {
            _busy = false;
        });
    }

    /** 恢复默认：删掉当前模式的存档、撤掉覆盖，回落到 css 默认配色 */
    function resetTheme() {
        if (_busy) return;
        var oldRgb = readPrimaryRgb();
        var target = isHiddenMode() ? HIDDEN_DEFAULT_RGB : hexToRgb(buildTheme(DEFAULT_KEY, presetOf(DEFAULT_KEY).main.hex, '').pal.hex);
        _busy = true;
        clearState();
        playThemeBurst(oldRgb, target, function () {
            clearPalette();
            resetParticleThemeCache();
            syncSelection();
        }, function () {
            _busy = false;
        });
    }

    // ===================== 全局事件 =====================

    function bindGlobalEvents() {
        var grid = document.getElementById('themeDiscGrid');
        if (grid) {
            grid.addEventListener('click', function (e) {
                var btn = e.target.closest ? e.target.closest('.theme-scheme') : null;
                if (!btn) return;
                var preset = presetOf(btn.getAttribute('data-theme-key'));
                if (!preset) return;
                openPicker(btn, preset);
            });
        }

        // 点击气泡外部关闭（方案卡片自身除外，否则会被立即关掉）
        document.addEventListener('pointerdown', function (e) {
            if (!_picker || !_picker.el.classList.contains('is-open')) return;
            if (_picker.el.contains(e.target)) return;
            if (e.target.closest && e.target.closest('.theme-scheme')) return;
            closePicker();
        }, true);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && _picker && _picker.el.classList.contains('is-open')) {
                closePicker();
            }
        });

        // 恢复默认：清掉当前模式的存档，回到 css 的默认配色
        var resetBtn = document.getElementById('themeResetBtn');
        if (resetBtn) resetBtn.addEventListener('click', resetTheme);

        // 滚动 / 改变窗口尺寸后锚点会错位，直接收起更干净；刚打开 400ms 内的滚动事件是点击前那下滚动的余波，不算
        window.addEventListener('scroll', function () {
            if (!_picker || !_picker.el.classList.contains('is-open')) return;
            if (Date.now() - _openedAt < 400) return;
            closePicker();
        }, true);
        window.addEventListener('resize', function () {
            if (_picker && _picker.el.classList.contains('is-open')) closePicker();
        });
    }

    // ===================== 初始化 =====================

    function init() {
        // 已保存过配色才写覆盖；否则保持 css 默认（正常霓虹夜场 / 私密铜色）
        var theme = savedTheme();
        if (theme) applyTheme(theme);
        else clearPalette();
        renderCard();
        bindGlobalEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
