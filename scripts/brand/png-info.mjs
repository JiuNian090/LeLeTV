#!/usr/bin/env node
/**
 * PNG 检查器：解码 8bit 非隔行 PNG（灰度 / 真彩 / 真彩+alpha / 调色板），
 * 打印尺寸、透明比例、粉色与白色像素占比、主色 top N。
 *
 * 用途：改完品牌图后核对「粉色是否清零、白色占比是否与替换前相称、
 * 光晕色是否还在、四角是否透明」——比肉眼看截图可靠。
 *
 * 用法: node scripts/brand/png-info.mjs <a.png> [b.png ...]
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

export function decodePng(buf) {
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
  if (bitDepth !== 8) throw new Error('仅支持 8bit，当前 ' + bitDepth + 'bit');
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
    if (!plte) throw new Error('调色板 PNG 缺少 PLTE');
    const idx = unfilter(width, 1);
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const pi = idx[i], o = i * 4;
      rgba[o] = plte[pi * 3]; rgba[o + 1] = plte[pi * 3 + 1]; rgba[o + 2] = plte[pi * 3 + 2];
      rgba[o + 3] = (trns && pi < trns.length) ? trns[pi] : 255;
    }
    return { width, height, channels: 4, data: rgba, colorType };
  }
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!channels) throw new Error('不支持的颜色类型 colorType=' + colorType);
  const raw = unfilter(width * channels, channels);
  if (channels === 4) return { width, height, channels, data: raw, colorType };
  const rgba = Buffer.alloc(width * height * 4);
  const gray = channels === 1;
  for (let i = 0, o = 0; i < raw.length; i += channels, o += 4) {
    rgba[o] = raw[i];
    rgba[o + 1] = gray ? raw[i] : raw[i + 1];
    rgba[o + 2] = gray ? raw[i] : raw[i + 2];
    rgba[o + 3] = 255;
  }
  return { width, height, channels: 4, data: rgba, colorType };
}

const hex2 = (v) => v.toString(16).padStart(2, '0');

function describe(file) {
  const img = decodePng(fs.readFileSync(file));
  const n = img.width * img.height;
  const hist = new Map();
  let opaque = 0, transparent = 0, pinkish = 0, whitish = 0;

  for (let i = 0; i < n; i++) {
    const o = i * img.channels;
    const r = img.data[o];
    const g = img.channels === 1 ? r : img.data[o + 1];
    const b = img.channels === 1 ? r : img.data[o + 2];
    const a = img.channels === 4 ? img.data[o + 3] : 255;
    if (a > 8) opaque++; else transparent++;
    // 粉色判定：#EC4899 这类高 R、低 G 的品红
    if (a > 100 && r > 120 && g < r - 40 && b > g + 20) pinkish++;
    if (a > 100 && r > 225 && g > 225 && b > 225) whitish++;
    if (a > 128) {
      const key = hex2(r >> 4 << 4) + hex2(g >> 4 << 4) + hex2(b >> 4 << 4);
      hist.set(key, (hist.get(key) || 0) + 1);
    }
  }

  const top = [...hist.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
  return file.split(/[\\/]/).pop()
    + '  ' + img.width + 'x' + img.height
    + '  type=' + img.colorType + ' ch=' + img.channels
    + '  | 不透明 ' + (opaque / n * 100).toFixed(1) + '%'
    + '  透明 ' + (transparent / n * 100).toFixed(1) + '%'
    + '  | 粉 ' + (pinkish / n * 100).toFixed(2) + '%'
    + '  白 ' + (whitish / n * 100).toFixed(2) + '%'
    + '  | top: ' + top.map(([c, k]) => '#' + c + '(' + (k / n * 100).toFixed(1) + '%)').join(' ');
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法: node scripts/brand/png-info.mjs <a.png> [b.png ...]');
  process.exit(2);
}
for (const f of files) console.log(describe(f));
