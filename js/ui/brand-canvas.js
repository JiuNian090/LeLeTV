/**
 * 在 canvas 上画品牌组合（圆角方块里的「Le」图形标 + LeLeTV 字标），供换色过渡、私密模式切换的粒子动画用。
 * 路径取自 index.html 里的品牌 sprite（#lele-mark / #lele-word），只解析一次。
 * 尺寸以方块边长 tile 计：字标高 0.4 tile、间距 0.3 tile，与导航栏的 .v2-lockup 同比例。
 */
(function () {
  'use strict';

  // 两个 symbol 的 viewBox：起点与宽高
  var MARK_BOX = { x: 170.6, y: 154.9, w: 432.4, h: 326.3 };
  var WORD_BOX = { x: 646.6, y: 235.6, w: 756.5, h: 204.5 };
  var paths = null;   // { mark: Path2D[], word: Path2D[] }；解析失败记为 false

  function load() {
    if (paths !== null) return paths;
    try {
      var mark = document.getElementById('lele-mark');
      var word = document.getElementById('lele-word');
      if (!mark || !word || typeof Path2D !== 'function') { paths = false; return paths; }
      var toPaths = function (root) {
        return Array.prototype.map.call(root.querySelectorAll('path'), function (p) { return new Path2D(p.getAttribute('d')); });
      };
      var m = toPaths(mark);
      var w = toPaths(word);
      paths = (m.length && w.length) ? { mark: m, word: w } : false;
    } catch (e) {
      paths = false;
    }
    return paths;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx 组合中心 x
   * @param {number} cy 组合中心 y
   * @param {number} tile 方块边长（像素）
   * @param {number[]} rgb 主色 [r, g, b]
   * @param {number} alpha 整体透明度
   * @param {number} scale 整体缩放
   * @returns {boolean} 画成功返回 true；页面里没有 sprite 时返回 false，调用方自行退回文字
   */
  function draw(ctx, cx, cy, tile, rgb, alpha, scale) {
    var p = load();
    if (!p) return false;
    var gap = tile * 0.3;
    var wordH = tile * 0.4;
    var wordW = wordH * WORD_BOX.w / WORD_BOX.h;
    var total = tile + gap + wordW;
    var color = function (a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; };

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale || 1, scale || 1);
    ctx.translate(-total / 2, -tile / 2);

    // 方块：深底、主色细描边，外圈一层主色光晕
    var r = tile * 0.29;
    ctx.shadowColor = color(0.5);
    ctx.shadowBlur = 28;
    ctx.fillStyle = 'rgba(20, 20, 24, 0.94)';
    roundRect(ctx, 0, 0, tile, tile, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color(0.4);
    ctx.lineWidth = 1;
    roundRect(ctx, 0.5, 0.5, tile - 1, tile - 1, r);
    ctx.stroke();

    // 图形标：方块内 0.7 tile 宽，居中（与 .v2-brand-tile .v2-mark 一致）
    var markW = tile * 0.7;
    var markH = markW * MARK_BOX.h / MARK_BOX.w;
    ctx.save();
    ctx.translate((tile - markW) / 2, (tile - markH) / 2);
    ctx.scale(markW / MARK_BOX.w, markH / MARK_BOX.h);
    ctx.translate(-MARK_BOX.x, -MARK_BOX.y);
    ctx.fillStyle = color(1);
    p.mark.forEach(function (path) { ctx.fill(path); });
    ctx.restore();

    // 字标：主色，带一点光晕
    ctx.save();
    ctx.translate(tile + gap, (tile - wordH) / 2);
    ctx.scale(wordW / WORD_BOX.w, wordH / WORD_BOX.h);
    ctx.translate(-WORD_BOX.x, -WORD_BOX.y);
    ctx.shadowColor = color(0.45);
    ctx.shadowBlur = 18;
    ctx.fillStyle = color(0.96);
    p.word.forEach(function (path) { ctx.fill(path); });
    ctx.restore();

    ctx.restore();
    return true;
  }

  window.LeLeBrandCanvas = { draw: draw };
})();
