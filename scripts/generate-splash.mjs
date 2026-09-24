#!/usr/bin/env node
/**
 * 生成 iPad 主屏启动图（apple-touch-startup-image）
 *
 * 视觉规则与 image/splash/ 下已有的 iPhone 启动图完全一致（实测自现有图）：
 *   纯黑底 + 居中 logo，logo 可见边长 = 设备短边(CSS) × 像素比 × LOGO_RATIO
 * LOGO_RATIO 默认 0.2197 = 现有 iPhone 启动图实测值（290/1320、273/1242 等一致），
 * 横竖屏用同一短边规则，保证同一台 iPad 旋转前后 logo 一样大。
 *
 * 为什么竖屏、横屏都要出图：iOS 主屏启动屏按 media 查询精确匹配，
 * 缺哪个方向就意味着那个方向回退成白底闪屏（iOS 默认白屏）。
 * 横屏条目里 device-width/device-height 会随方向互换，因此图片像素也是长边 × 短边。
 *
 * 用法：
 *   node scripts/generate-splash.mjs                 # 生成竖屏 + 横屏共 16 张到 image/splash/
 *   node scripts/generate-splash.mjs --print-links   # 额外打印 index.html 需要的 <link> 片段
 *   node scripts/generate-splash.mjs --ratio 0.18    # 调整 logo 占比
 *   node scripts/generate-splash.mjs --logo image/logo-black.png
 *
 * 实现只用 Node 内置 zlib（不引入图像库）：启动图是纯黑底 + 单张 logo，
 * 手工解码/编码 PNG 比新增一个原生依赖更轻。
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SPLASH_DIR = path.join(ROOT, 'image', 'splash');

// 需要生成启动图的 iPad 机型：[CSS 短边, CSS 长边, 像素比]
// 短边/长边就是 Safari 的 device-width / device-height（竖屏），横屏条目由本脚本自动交换。
const IPAD_MODELS = [
  [768, 1024, 2],   // iPad mini 2/3/4/5、iPad Air 1/2、iPad 9.7"（5/6 代）
  [810, 1080, 2],   // iPad 10.2"（7/8/9 代）
  [744, 1133, 2],   // iPad mini 6（8.3"）
  [820, 1180, 2],   // iPad 10.9"（10 代）、iPad Air 4/5
  [834, 1112, 2],   // iPad Pro 10.5"、iPad Air 3
  [834, 1194, 2],   // iPad Pro 11"（1~4 代）
  [1024, 1366, 2],  // iPad Pro 12.9"（1~6 代）
  [1032, 1376, 2],  // iPad Pro 12.9"（M2）
];

const DEFAULTS = {
  logo: path.join(ROOT, 'image', 'logo-black.png'),
  ratio: 0.2197,
  printLinks: false,
};

const USAGE = [
  '用法: node scripts/generate-splash.mjs [--print-links] [--ratio 0.2197] [--logo image/logo-black.png]',
  '  生成 iPad（竖屏 + 横屏）主屏启动图到 image/splash/，视觉规则与现有 iPhone 启动图一致。',
  '  详细说明见本文件头部注释。',
].join('\n');

// ===================== 参数 =====================

function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--print-links') opts.printLinks = true;
    else if (a === '--logo') opts.logo = path.resolve(argv[++i]);
    else if (a === '--ratio') opts.ratio = Number(argv[++i]);
    else if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
    else { console.error('未知参数:', a); process.exit(2); }
  }
  if (!Number.isFinite(opts.ratio) || opts.ratio <= 0 || opts.ratio >= 1) {
    console.error('--ratio 需为 (0, 1) 之间的小数');
    process.exit(2);
  }
  return opts;
}

// ===================== PNG 解码（8bit，非隔行，灰度/RGB/RGBA）=====================

function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG 文件');

  let width = 0, height = 0, colorType = 0, bitDepth = 0, interlace = 0;
  const idat = [];
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    o += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('仅支持 8bit PNG，当前 ' + bitDepth + 'bit');
  if (interlace !== 0) throw new Error('不支持隔行扫描（Adam7）PNG');
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!channels) throw new Error('不支持的颜色类型 colorType=' + colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
    prev = cur;
  }
  return { width, height, channels, data: out };
}

// ===================== PNG 编码（8bit RGB）=====================

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgb) {
  const stride = width * 3;
  // 每行前置一个 filter 字节；黑底大片同色，none 过滤器配合 deflate 已足够小
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: truecolor RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ===================== 缩放 =====================

// 面积平均（box filter）重采样：把 RGBA 源缩放到目标尺寸。
// 启动图的 logo 始终是缩小（512px 源 → 300~450px），面积平均能保住手写笔画的抗锯齿灰度，
// 不会像最邻近那样把笔画边缘切成硬锯齿。
function resampleRgba(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) {
    const y0 = (dy * sh) / dh;
    const y1 = ((dy + 1) * sh) / dh;
    const sy0 = Math.floor(y0);
    const sy1 = Math.min(sh - 1, Math.ceil(y1) - 1);
    for (let dx = 0; dx < dw; dx++) {
      const x0 = (dx * sw) / dw;
      const x1 = ((dx + 1) * sw) / dw;
      const sx0 = Math.floor(x0);
      const sx1 = Math.min(sw - 1, Math.ceil(x1) - 1);
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let sy = sy0; sy <= sy1; sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = sx0; sx <= sx1; sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const i = (sy * sw + sx) * 4;
          r += src[i] * w;
          g += src[i + 1] * w;
          b += src[i + 2] * w;
          a += src[i + 3] * w;
          wsum += w;
        }
      }
      const o = (dy * dw + dx) * 4;
      out[o] = Math.round(r / wsum);
      out[o + 1] = Math.round(g / wsum);
      out[o + 2] = Math.round(b / wsum);
      out[o + 3] = Math.round(a / wsum);
    }
  }
  return out;
}

// ===================== 合成 =====================

// logo 常被读成单通道/三通道，这里统一补齐成 RGBA，再由调用方叠加
function toRgba(img) {
  if (img.channels === 4) return img.data;
  const out = Buffer.alloc(img.width * img.height * 4);
  const gray = img.channels === 1;
  for (let i = 0, o = 0; i < img.data.length; i += img.channels, o += 4) {
    out[o] = img.data[i];
    out[o + 1] = gray ? img.data[i] : img.data[i + 1];
    out[o + 2] = gray ? img.data[i] : img.data[i + 2];
    out[o + 3] = 255;
  }
  return out;
}

// 黑底画布 + 居中 logo（alpha 混合）。logo 可见边长 = 设备短边 × dpr × ratio，
// 位置按画布中心对齐，与现有 iPhone 启动图的实测中心（0.499~0.500）一致。
function compose(width, height, logo, logoRatio) {
  const canvas = Buffer.alloc(width * height * 3); // 全 0 = #000000
  const shortSide = Math.min(width, height);
  const side = Math.max(1, Math.round(shortSide * logoRatio));
  const scaled = resampleRgba(logo.rgba, logo.width, logo.height, side, side);
  const left = Math.round((width - side) / 2);
  const top = Math.round((height - side) / 2);

  for (let y = 0; y < side; y++) {
    const cy = top + y;
    if (cy < 0 || cy >= height) continue;
    for (let x = 0; x < side; x++) {
      const cx = left + x;
      if (cx < 0 || cx >= width) continue;
      const s = (y * side + x) * 4;
      const a = scaled[s + 3] / 255;
      if (a === 0) continue;
      const d = (cy * width + cx) * 3;
      // 底为纯黑：直接按 alpha 把 logo 像素写进去
      canvas[d] = Math.round(scaled[s] * a);
      canvas[d + 1] = Math.round(scaled[s + 1] * a);
      canvas[d + 2] = Math.round(scaled[s + 2] * a);
    }
  }
  return canvas;
}

// ===================== 主流程 =====================

function buildTargets() {
  const targets = [];
  for (const [shortSide, longSide, dpr] of IPAD_MODELS) {
    const pw = shortSide * dpr;
    const ph = longSide * dpr;
    targets.push({
      file: 'ipad-' + shortSide + 'x' + longSide + '@' + dpr + 'x.png',
      width: pw,
      height: ph,
      media: '(device-width: ' + shortSide + 'px) and (device-height: ' + longSide + 'px) and (-webkit-device-pixel-ratio: ' + dpr + ') and (orientation: portrait)',
      label: '竖屏 ' + shortSide + 'x' + longSide + '@' + dpr + 'x',
    });
    targets.push({
      file: 'ipad-' + longSide + 'x' + shortSide + '@' + dpr + 'x.png',
      width: ph,
      height: pw,
      media: '(device-width: ' + longSide + 'px) and (device-height: ' + shortSide + 'px) and (-webkit-device-pixel-ratio: ' + dpr + ') and (orientation: landscape)',
      label: '横屏 ' + longSide + 'x' + shortSide + '@' + dpr + 'x',
    });
  }
  return targets;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.logo)) { console.error('logo 文件不存在:', opts.logo); process.exit(1); }

  const logoImg = decodePng(fs.readFileSync(opts.logo));
  const logo = { width: logoImg.width, height: logoImg.height, rgba: toRgba(logoImg) };
  fs.mkdirSync(SPLASH_DIR, { recursive: true });

  const targets = buildTargets();
  console.log('[splash] logo:', path.relative(ROOT, opts.logo), logo.width + 'x' + logo.height,
    '| 占比:', opts.ratio, '| 目标:', targets.length, '张');

  for (const t of targets) {
    const rgb = compose(t.width, t.height, logo, opts.ratio);
    const png = encodePng(t.width, t.height, rgb);
    fs.writeFileSync(path.join(SPLASH_DIR, t.file), png);
    console.log('  ' + t.file.padEnd(26) + t.width + 'x' + t.height + '  ' + (png.length / 1024).toFixed(1) + 'KB  ' + t.label);
  }

  if (opts.printLinks) {
    console.log('\n<!-- 复制到 index.html 的 iOS 主屏启动屏区块（iPad 部分）-->');
    for (const t of targets) {
      console.log('    <link rel="apple-touch-startup-image" href="/image/splash/' + t.file + '"\n          media="' + t.media + '">');
    }
  }

  console.log('\n[splash] 完成 → image/splash/');
}

main();
