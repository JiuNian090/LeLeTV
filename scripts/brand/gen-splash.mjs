#!/usr/bin/env node
/**
 * 生成 iOS 主屏启动图（纯黑底 + 居中 logo）。
 *
 * 算法与项目原有的 scripts/generate-splash.mjs 一致：
 *   面积平均（box filter）缩放 + 黑底居中 alpha 合成 + 手写 PNG 编码（只用 node zlib）。
 * 差别是本脚本覆盖全部 27 张（iPhone 11 + iPad 16），而原脚本只内置 8 个 iPad 机型。
 *
 * 尺寸来自现有 image/splash/*.png 的实测值（文件名即 短边x长边@dpr）。不要凭文件名猜——
 * iOS 的 <link media="..."> 按 device-width/height 精确匹配，尺寸差一点就回退成白屏。
 * 新增机型时：从 image/splash 里删掉旧图 → 按新机型的 device-width/height 补一行 → 重跑。
 *
 * 启动图是纯黑底，deflate 已足够小，不需要再量化（实测真彩比量化版更小）。
 *
 * 用法: node scripts/brand/gen-splash.mjs <logo.png> [ratio] <输出目录>
 *   logo.png 建议使用透明底的应用图标（1024x1024 渲染件）
 *   ratio 默认 0.2197（logo 可见边长 = 设备短边 × ratio，与既有启动图实测一致）
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ---- 27 个目标：文件名 + 像素宽高（实测自 image/splash）----
const TARGETS = [
  ['ipad-744x1133@2x.png', 1488, 2266],
  ['ipad-768x1024@2x.png', 1536, 2048],
  ['ipad-810x1080@2x.png', 1620, 2160],
  ['ipad-820x1180@2x.png', 1640, 2360],
  ['ipad-834x1112@2x.png', 1668, 2224],
  ['ipad-834x1194@2x.png', 1668, 2388],
  ['ipad-1024x768@2x.png', 2048, 1536],
  ['ipad-1024x1366@2x.png', 2048, 2732],
  ['ipad-1032x1376@2x.png', 2064, 2752],
  ['ipad-1080x810@2x.png', 2160, 1620],
  ['ipad-1112x834@2x.png', 2224, 1668],
  ['ipad-1133x744@2x.png', 2266, 1488],
  ['ipad-1180x820@2x.png', 2360, 1640],
  ['ipad-1194x834@2x.png', 2388, 1668],
  ['ipad-1366x1024@2x.png', 2732, 2048],
  ['ipad-1376x1032@2x.png', 2752, 2064],
  ['iphone-320x568@2x.png', 640, 1136],
  ['iphone-375x667@2x.png', 750, 1334],
  ['iphone-375x812@3x.png', 1125, 2436],
  ['iphone-390x844@3x.png', 1170, 2532],
  ['iphone-393x852@3x.png', 1179, 2556],
  ['iphone-402x874@3x.png', 1206, 2622],
  ['iphone-414x896@2x.png', 828, 1792],
  ['iphone-414x896@3x.png', 1242, 2688],
  ['iphone-428x926@3x.png', 1284, 2778],
  ['iphone-430x932@3x.png', 1290, 2796],
  ['iphone-440x956@3x.png', 1320, 2868],
];

// ---- PNG 解码（8bit 非隔行：灰度 / 真彩 / 真彩+alpha）----
function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let width = 0, height = 0, colorType = 0, bitDepth = 0, interlace = 0;
  const idat = [];
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('仅支持 8bit');
  if (interlace !== 0) throw new Error('不支持隔行 PNG');
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!channels) throw new Error('logo 源需要 8bit 灰度/真彩/真彩+alpha，当前 colorType=' + colorType);

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

// ---- PNG 编码（8bit 真彩 RGB）----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none（黑底大片同色，deflate 已足够）
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit 真彩
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 面积平均缩放 ----
function resampleRgba(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) {
    const y0 = (dy * sh) / dh, y1 = ((dy + 1) * sh) / dh;
    const sy0 = Math.floor(y0), sy1 = Math.min(sh - 1, Math.ceil(y1) - 1);
    for (let dx = 0; dx < dw; dx++) {
      const x0 = (dx * sw) / dw, x1 = ((dx + 1) * sw) / dw;
      const sx0 = Math.floor(x0), sx1 = Math.min(sw - 1, Math.ceil(x1) - 1);
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let sy = sy0; sy <= sy1; sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = sx0; sx <= sx1; sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const i = (sy * sw + sx) * 4;
          r += src[i] * w; g += src[i + 1] * w; b += src[i + 2] * w; a += src[i + 3] * w;
          wsum += w;
        }
      }
      const o = (dy * dw + dx) * 4;
      out[o] = Math.round(r / wsum); out[o + 1] = Math.round(g / wsum);
      out[o + 2] = Math.round(b / wsum); out[o + 3] = Math.round(a / wsum);
    }
  }
  return out;
}

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

// ---- 黑底 + 居中 logo ----
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
      canvas[d] = Math.round(scaled[s] * a);
      canvas[d + 1] = Math.round(scaled[s + 1] * a);
      canvas[d + 2] = Math.round(scaled[s + 2] * a);
    }
  }
  return canvas;
}

// ---- 主流程 ----
const [logoFile, ratioArg, outDir] = process.argv.slice(2);
if (!logoFile || !outDir) {
  console.error('用法: node scripts/brand/gen-splash.mjs <logo.png> [ratio] <输出目录>');
  process.exit(2);
}
const ratio = Number(ratioArg || 0.2197);
const logoImg = decodePng(fs.readFileSync(logoFile));
const logo = { width: logoImg.width, height: logoImg.height, rgba: toRgba(logoImg) };
fs.mkdirSync(outDir, { recursive: true });

console.log(`logo: ${path.basename(logoFile)} ${logo.width}x${logo.height} | 占比 ${ratio} | 目标 ${TARGETS.length} 张`);
for (const [name, w, h] of TARGETS) {
  const png = encodePng(w, h, compose(w, h, logo, ratio));
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(`  ${name.padEnd(28)} ${w}x${h}  ${(png.length / 1024).toFixed(1)}KB`);
}
console.log(`完成 → ${outDir}`);
