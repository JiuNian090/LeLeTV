#!/usr/bin/env node
/**
 * 把 8bit 真彩 PNG 量化成 256 色调色板 PNG（中位切分，不抖动）。
 *
 * 为什么必须量化：Chrome/playwright 渲染出来的是真彩，而项目里的图标是调色板 PNG。
 * 同一张 512 图标，调色板 8KB、真彩 110KB。直接落地就是 10 倍体积回归。
 * 中位切分把颜色数压到 256，与交付方 Pillow ADAPTIVE 的处理方式同级别，体积回到同一量级。
 *
 * 用法: node scripts/brand/quantize.mjs <in.png> <out.png> [色数，默认 256]
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

// ---------- PNG 解码（灰度 / 真彩 / 真彩+alpha / 调色板，8bit 非隔行）----------
function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let width = 0, height = 0, colorType = 0, bitDepth = 0, interlace = 0;
  const idat = [];
  let plte = null, trns = null;
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('仅支持 8bit');
  if (interlace !== 0) throw new Error('不支持隔行 PNG');

  const unfilter = (stride, channels) => {
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const out = Buffer.alloc(stride * height);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
      const f = raw[y * (stride + 1)];
      const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
      const cur = out.subarray(y * stride, (y + 1) * stride);
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? cur[x - channels] : 0;
        const b = prev[x];
        const c = x >= channels ? prev[x - channels] : 0;
        let v = line[x];
        if (f === 1) v += a;
        else if (f === 2) v += b;
        else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        }
        cur[x] = v & 0xff;
      }
      prev = cur;
    }
    return out;
  };

  if (colorType === 3) {
    if (!plte) throw new Error('缺少 PLTE');
    const idx = unfilter(width, 1);
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const pi = idx[i], o = i * 4;
      rgba[o] = plte[pi * 3]; rgba[o + 1] = plte[pi * 3 + 1]; rgba[o + 2] = plte[pi * 3 + 2];
      rgba[o + 3] = (trns && pi < trns.length) ? trns[pi] : 255;
    }
    return { width, height, channels: 4, data: rgba };
  }
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!channels) throw new Error('不支持 colorType=' + colorType);
  const raw = unfilter(width * channels, channels);
  if (channels === 4) return { width, height, channels, data: raw };
  const rgba = Buffer.alloc(width * height * 4);
  const gray = channels === 1;
  for (let i = 0, o = 0; i < raw.length; i += channels, o += 4) {
    rgba[o] = raw[i];
    rgba[o + 1] = gray ? raw[i] : raw[i + 1];
    rgba[o + 2] = gray ? raw[i] : raw[i + 2];
    rgba[o + 3] = 255;
  }
  return { width, height, channels: 4, data: rgba };
}

// ---------- PNG 编码（8bit 索引色）----------
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
function encodePaletted(width, height, indices, palette, hasTrans, transIndex) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 3; // 8bit 索引色
  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach((c, i) => { plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2]; });
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter: none
    indices.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('PLTE', plte),
  ];
  if (hasTrans) {
    const t = Buffer.alloc(palette.length).fill(255);
    t[transIndex] = 0;
    parts.push(chunk('tRNS', t));
  }
  parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

// ---------- 中位切分 ----------
function medianCut(hist, maxColors) {
  let boxes = [Array.from(hist.entries())]; // [ [key, count], ... ]
  const chan = (key, i) => (key >> (16 - i * 8)) & 0xff;
  const stats = (box) => {
    const lo = [255, 255, 255], hi = [0, 0, 0];
    for (const [k] of box) {
      for (let i = 0; i < 3; i++) {
        const v = chan(k, i);
        if (v < lo[i]) lo[i] = v;
        if (v > hi[i]) hi[i] = v;
      }
    }
    let best = 0, span = -1;
    for (let i = 0; i < 3; i++) { const s = hi[i] - lo[i]; if (s > span) { span = s; best = i; } }
    return { best, span };
  };
  while (boxes.length < maxColors) {
    let bi = -1, bspan = 0, bch = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const s = stats(boxes[i]);
      if (s.span > bspan) { bspan = s.span; bch = s.best; bi = i; }
    }
    if (bi < 0 || bspan === 0) break;
    const box = boxes[bi].slice().sort((a, b) => chan(a[0], bch) - chan(b[0], bch));
    const total = box.reduce((s, e) => s + e[1], 0);
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length; i++) {
      acc += box[i][1];
      if (acc >= total / 2) { cut = Math.max(1, Math.min(box.length - 1, i)); break; }
    }
    boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0, w = 0;
    for (const [k, c] of box) {
      r += chan(k, 0) * c; g += chan(k, 1) * c; b += chan(k, 2) * c; w += c;
    }
    return [Math.round(r / w), Math.round(g / w), Math.round(b / w)];
  });
}

// ---------- 主流程 ----------
const [inFile, outFile, colorArg] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('用法: node scripts/brand/quantize.mjs <in.png> <out.png> [色数]');
  process.exit(2);
}
const maxColors = Number(colorArg || 256);

const img = decodePng(fs.readFileSync(inFile));
const n = img.width * img.height;

const hist = new Map();
let hasTrans = false;
for (let i = 0; i < n; i++) {
  const o = i * 4;
  if (img.data[o + 3] < 128) { hasTrans = true; continue; }
  const key = (img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2];
  hist.set(key, (hist.get(key) || 0) + 1);
}

const room = hasTrans ? maxColors - 1 : maxColors;
const palette = medianCut(hist, room);
if (hasTrans) palette.push([0, 0, 0]);
const transIndex = hasTrans ? palette.length - 1 : -1;

// 最近邻映射（5-5-5 桶缓存，避免逐像素线性扫描 256 色）
const cache = new Int16Array(32768).fill(-1);
function nearest(r, g, b) {
  const ck = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  const hit = cache[ck];
  if (hit >= 0) return hit;
  let bi = 0, bd = Infinity;
  const limit = hasTrans ? palette.length - 1 : palette.length;
  for (let i = 0; i < limit; i++) {
    const c = palette[i];
    const d = (c[0] - r) * (c[0] - r) + (c[1] - g) * (c[1] - g) + (c[2] - b) * (c[2] - b);
    if (d < bd) { bd = d; bi = i; }
  }
  cache[ck] = bi;
  return bi;
}

const indices = Buffer.alloc(n);
for (let i = 0; i < n; i++) {
  const o = i * 4;
  indices[i] = img.data[o + 3] < 128 ? transIndex : nearest(img.data[o], img.data[o + 1], img.data[o + 2]);
}

const png = encodePaletted(img.width, img.height, indices, palette, hasTrans, transIndex);
fs.writeFileSync(outFile, png);
console.log(`  ${outFile.split(/[\\/]/).pop().padEnd(30)} ${img.width}x${img.height}`
  + `  ${palette.length} 色  输入 ${(fs.statSync(inFile).size / 1024).toFixed(1)}KB`
  + ` → 输出 ${(png.length / 1024).toFixed(1)}KB`);
