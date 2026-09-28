/*
 * 画布绘制工具：缓动、确定性随机、文字、形状与图标。
 * 所有绘制都只依赖传入的时间 t，保证任意时刻可重复渲染（导出逐帧视频时需要）。
 */
(function (root) {
  var FONT = '"Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans GB","WenQuanYi Zen Hei",sans-serif';

  var C = {
    bg0: '#0D2131', bg1: '#173B53',
    ink: '#F4F7FA', muted: '#A9BCCD', dim: '#6F879C',
    teal: '#3FC1C9', tealDeep: '#1E8C94',
    gold: '#FFD166', red: '#FF5A6A', redDeep: '#D63447',
    orange: '#FF9F5A', violet: '#A78BFA',
    skin: '#F4C7A6', skinDark: '#E3A583', skinLight: '#FBE0CC',
    dermis: '#F6D5C6', fat: '#FBE7B0',
    wheal: '#FDEBE1', halo: 'rgba(232,72,86,',
    card: 'rgba(255,255,255,0.07)', cardLine: 'rgba(255,255,255,0.14)',
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  var ease = {
    out: function (k) { return 1 - Math.pow(1 - k, 3); },
    inOut: function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; },
    back: function (k) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
    in: function (k) { return k * k * k; },
  };
  // 在 [a, a+d] 内从 0 缓动到 1
  function appear(t, a, d, fn) { return (fn || ease.out)(seg(t, a, a + (d || 0.6))); }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5;
      var r = Math.imul(s ^ (s >>> 15), 1 | s);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(ctx, str, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = (o.weight || 500) + ' ' + (o.size || 40) + 'px ' + FONT;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.shadowBlur || 18; }
    if (o.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.strokeWidth || 8;
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || C.ink;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function measure(ctx, str, size, weight) {
    ctx.save();
    ctx.font = (weight || 500) + ' ' + size + 'px ' + FONT;
    var w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  // 平滑的不规则闭合曲线（风团、细胞等）
  function blobPath(ctx, cx, cy, r, seed, wobble, n) {
    n = n || 9;
    var rand = rng(seed);
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var rr = r * (1 - wobble / 2 + rand() * wobble);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.86]);
    }
    ctx.beginPath();
    for (var j = 0; j <= n; j++) {
      var p = pts[j % n], q = pts[(j + 1) % n];
      var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (j === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    ctx.closePath();
  }

  // 风团：红晕 + 苍白隆起的中心
  function wheal(ctx, x, y, r, seed, k, opts) {
    if (k <= 0.001 || r <= 0) return;
    opts = opts || {};
    ctx.save();
    ctx.globalAlpha *= clamp(k, 0, 1);
    var rr = r * (0.35 + 0.65 * k);
    var g = ctx.createRadialGradient(x, y, rr * 0.4, x, y, rr * 1.9);
    g.addColorStop(0, C.halo + '0.55)');
    g.addColorStop(0.55, C.halo + '0.28)');
    g.addColorStop(1, C.halo + '0)');
    ctx.fillStyle = g;
    blobPath(ctx, x, y, rr * 1.8, seed + 7, 0.35, 8);
    ctx.fill();
    blobPath(ctx, x, y, rr, seed, opts.wobble || 0.45, 9);
    var g2 = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr * 1.05);
    g2.addColorStop(0, '#FFF6F0');
    g2.addColorStop(0.7, C.wheal);
    g2.addColorStop(1, '#F3B3A6');
    ctx.fillStyle = g2;
    ctx.shadowColor = 'rgba(150,40,40,0.25)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fill();
    ctx.restore();
  }

  // 一块带纹理的皮肤
  function skinPatch(ctx, x, y, w, h, seed) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 60);
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, C.skinLight);
    g.addColorStop(0.5, C.skin);
    g.addColorStop(1, C.skinDark);
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.clip();
    var rand = rng(seed || 3);
    ctx.fillStyle = 'rgba(160,90,60,0.12)';
    for (var i = 0; i < 160; i++) {
      ctx.beginPath();
      ctx.arc(x + rand() * w, y + rand() * h, 1.2 + rand() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(160,90,60,0.08)';
    ctx.lineWidth = 2;
    for (var j = 0; j < 14; j++) {
      var yy = y + rand() * h, xx = x + rand() * w;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.quadraticCurveTo(xx + 40, yy - 10 + rand() * 20, xx + 90, yy + rand() * 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function card(ctx, x, y, w, h, o) {
    o = o || {};
    ctx.save();
    roundRect(ctx, x, y, w, h, o.r || 28);
    ctx.fillStyle = o.fill || C.card;
    if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; }
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = o.lineWidth || 2;
    ctx.strokeStyle = o.line || C.cardLine;
    ctx.stroke();
    ctx.restore();
  }

  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  // 以 (x, y) 为中心、缩放 s 进行绘制
  function at(ctx, x, y, s, fn, rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(s, s);
    fn(ctx);
    ctx.restore();
  }

  function line(ctx, pts, color, w, dash) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = w || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    ctx.restore();
  }

  function arrow(ctx, x1, y1, x2, y2, color, w, k) {
    k = k == null ? 1 : k;
    if (k <= 0) return;
    var x = lerp(x1, x2, k), y = lerp(y1, y2, k);
    line(ctx, [x1, y1, x, y], color, w || 4);
    var a = Math.atan2(y2 - y1, x2 - x1), hs = 14 + (w || 4) * 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(a - 0.45) * hs, y - Math.sin(a - 0.45) * hs);
    ctx.lineTo(x - Math.cos(a + 0.45) * hs, y - Math.sin(a + 0.45) * hs);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // ---------- 图标（以原点为中心，约占 ±50 的范围） ----------
  var icon = {};
  var G_roundRect = roundRect;

  icon.fish = function (ctx) {
    ctx.fillStyle = '#7FD1E8';
    ctx.beginPath();
    ctx.ellipse(-6, 0, 34, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(24, 0); ctx.lineTo(46, -18); ctx.lineTo(46, 18); ctx.closePath();
    ctx.fill();
    circle(ctx, -24, -5, 4.5, '#12324A');
    ctx.strokeStyle = 'rgba(18,50,74,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-12, 0, 14, -1, 1); ctx.stroke();
  };

  icon.egg = function (ctx) {
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF4DE'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#E9C99A'; ctx.stroke();
  };

  icon.shrimp = function (ctx) {
    ctx.strokeStyle = '#FF8A65'; ctx.lineCap = 'round';
    for (var i = 0; i < 5; i++) {
      ctx.lineWidth = 20 - i * 3;
      ctx.beginPath();
      var a0 = Math.PI * (0.95 + i * 0.22), a1 = a0 + 0.26;
      ctx.arc(0, 0, 24, a0, a1);
      ctx.stroke();
    }
    circle(ctx, -22, -8, 4, '#12324A');
    ctx.lineWidth = 2; ctx.strokeStyle = '#FF8A65';
    ctx.beginPath(); ctx.moveTo(-26, -14); ctx.quadraticCurveTo(-46, -34, -30, -46); ctx.stroke();
  };

  icon.virus = function (ctx, t) {
    ctx.save();
    ctx.rotate((t || 0) * 0.5);
    ctx.strokeStyle = '#8BE08B'; ctx.fillStyle = '#8BE08B'; ctx.lineWidth = 5;
    for (var i = 0; i < 10; i++) {
      var a = (i / 10) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 26); ctx.lineTo(Math.cos(a) * 42, Math.sin(a) * 42); ctx.stroke();
      circle(ctx, Math.cos(a) * 44, Math.sin(a) * 44, 6, '#8BE08B');
    }
    circle(ctx, 0, 0, 30, '#5CC35C');
    circle(ctx, -8, -6, 6, 'rgba(255,255,255,0.35)');
    circle(ctx, 10, 8, 4, 'rgba(255,255,255,0.3)');
    ctx.restore();
  };

  icon.bacterium = function (ctx) {
    ctx.save();
    ctx.rotate(-0.5);
    roundRect(ctx, -30, -13, 60, 26, 13);
    ctx.fillStyle = '#C9A3FF'; ctx.fill();
    ctx.strokeStyle = '#C9A3FF'; ctx.lineWidth = 2.5;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(30, -6 + i * 4); ctx.quadraticCurveTo(42, -12 + i * 8, 52, -4 + i * 5); ctx.stroke();
    }
    ctx.restore();
  };

  icon.capsule = function (ctx) {
    ctx.save();
    ctx.rotate(-0.6);
    roundRect(ctx, -42, -17, 84, 34, 17);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = C.red; ctx.fillRect(-42, -17, 42, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-36, -11, 70, 6);
    ctx.restore();
    ctx.restore();
  };

  icon.tablet = function (ctx) {
    circle(ctx, 0, 0, 20, '#EAF6FF', '#9CC7E6', 3);
    line(ctx, [-12, 0, 12, 0], '#9CC7E6', 3);
  };

  icon.vial = function (ctx) {
    roundRect(ctx, -14, -30, 28, 60, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    ctx.fillStyle = '#7FD1E8'; ctx.fillRect(-14, 0, 28, 22);
    ctx.fillStyle = '#8898AA'; ctx.fillRect(-16, -38, 32, 10);
  };

  icon.sun = function (ctx, t) {
    ctx.save();
    ctx.rotate((t || 0) * 0.3);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); ctx.stroke();
    }
    ctx.restore();
    circle(ctx, 0, 0, 22, C.gold);
  };

  icon.snow = function (ctx) {
    ctx.strokeStyle = '#BFE9FF'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (var i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * Math.PI * 2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(-10, -34); ctx.moveTo(0, -24); ctx.lineTo(10, -34); ctx.stroke();
      ctx.restore();
    }
  };

  icon.flower = function (ctx) {
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 18, Math.sin(a) * 18, 14, 9, a, 0, Math.PI * 2);
      ctx.fillStyle = '#FF9EC4'; ctx.fill();
    }
    circle(ctx, 0, 0, 11, C.gold);
    var r = rng(9);
    for (var j = 0; j < 7; j++) circle(ctx, 20 + r() * 26, -30 + r() * 20, 2.5, C.gold);
  };

  icon.bolt = function (ctx) {
    ctx.beginPath();
    ctx.moveTo(6, -44); ctx.lineTo(-22, 6); ctx.lineTo(-2, 6); ctx.lineTo(-10, 44); ctx.lineTo(22, -8); ctx.lineTo(2, -8); ctx.closePath();
    ctx.fillStyle = C.violet; ctx.fill();
  };

  icon.thermo = function (ctx) {
    roundRect(ctx, -9, -44, 18, 64, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    circle(ctx, 0, 28, 16, C.red);
    ctx.fillStyle = C.red; ctx.fillRect(-4, -20, 8, 44);
    ctx.fillStyle = '#7FD1E8';
    ctx.beginPath(); ctx.moveTo(30, -26); ctx.quadraticCurveTo(42, -8, 30, -4); ctx.quadraticCurveTo(18, -8, 30, -26); ctx.fill();
  };

  icon.scratch = function (ctx) {
    roundRect(ctx, -46, -34, 92, 68, 18);
    ctx.fillStyle = C.skin; ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(232,72,86,0.5)'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(-32, 18); ctx.bezierCurveTo(-10, -30, 10, 30, 32, -16); ctx.stroke();
    ctx.strokeStyle = '#FDEBE1'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-32, 18); ctx.bezierCurveTo(-10, -30, 10, 30, 32, -16); ctx.stroke();
  };

  icon.clock = function (ctx, k) {
    circle(ctx, 0, 0, 42, 'rgba(255,255,255,0.08)', C.ink, 4);
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      line(ctx, [Math.cos(a) * 34, Math.sin(a) * 34, Math.cos(a) * 39, Math.sin(a) * 39], C.muted, 3);
    }
    var a1 = -Math.PI / 2 + (k || 0) * Math.PI * 4;
    var a2 = -Math.PI / 2 + (k || 0) * Math.PI * 4 / 12;
    line(ctx, [0, 0, Math.cos(a2) * 20, Math.sin(a2) * 20], C.ink, 5);
    line(ctx, [0, 0, Math.cos(a1) * 30, Math.sin(a1) * 30], C.teal, 3.5);
    circle(ctx, 0, 0, 4, C.ink);
  };

  icon.notebook = function (ctx) {
    roundRect(ctx, -32, -40, 64, 80, 8);
    ctx.fillStyle = '#FFF6E5'; ctx.fill();
    ctx.fillStyle = C.teal; ctx.fillRect(-32, -40, 12, 80);
    for (var i = 0; i < 4; i++) line(ctx, [-10, -22 + i * 15, 22, -22 + i * 15], '#C9B79C', 3);
    ctx.save(); ctx.translate(28, 24); ctx.rotate(0.7);
    ctx.fillStyle = C.gold; ctx.fillRect(-5, -32, 10, 40);
    ctx.fillStyle = '#E07A5F'; ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(5, 8); ctx.lineTo(0, 18); ctx.fill();
    ctx.restore();
  };

  icon.shirt = function (ctx) {
    ctx.beginPath();
    ctx.moveTo(-16, -38); ctx.lineTo(-46, -24); ctx.lineTo(-36, 0); ctx.lineTo(-26, -6); ctx.lineTo(-26, 40);
    ctx.lineTo(26, 40); ctx.lineTo(26, -6); ctx.lineTo(36, 0); ctx.lineTo(46, -24); ctx.lineTo(16, -38);
    ctx.quadraticCurveTo(0, -24, -16, -38);
    ctx.closePath();
    ctx.fillStyle = '#9FD8C8'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, 10); ctx.quadraticCurveTo(0, 16, 8, 10); ctx.stroke();
  };

  icon.drop = function (ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -40); ctx.bezierCurveTo(24, -10, 30, 6, 30, 14);
    ctx.arc(0, 14, 30, 0, Math.PI); ctx.bezierCurveTo(-30, 6, -24, -10, 0, -40);
    ctx.fillStyle = '#FF8A65'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * 12, -52); ctx.quadraticCurveTo(i * 12 + 6, -60, i * 12, -68); ctx.stroke();
    }
  };

  icon.hand = function (ctx) {
    ctx.fillStyle = C.skin;
    roundRect(ctx, -26, -6, 52, 46, 16); ctx.fill();
    for (var i = 0; i < 4; i++) { roundRect(ctx, -26 + i * 13.5, -40 + (i === 0 || i === 3 ? 8 : 0), 11, 44, 5.5); ctx.fill(); }
    ctx.save(); ctx.translate(-26, 14); ctx.rotate(-0.8); roundRect(ctx, -6, -30, 12, 34, 6); ctx.fill(); ctx.restore();
  };

  icon.cross = function (ctx, r) {
    r = r || 50;
    ctx.strokeStyle = C.red; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.7); ctx.lineTo(r * 0.7, -r * 0.7); ctx.stroke();
  };

  icon.check = function (ctx, color) {
    ctx.strokeStyle = color || C.teal; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-20, 2); ctx.lineTo(-6, 16); ctx.lineTo(22, -16); ctx.stroke();
  };

  icon.phone = function (ctx) {
    // 电话听筒：C 形手柄 + 两端的听筒/话筒
    ctx.save();
    ctx.rotate(0.35);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineCap = 'round';
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(8, 0, 34, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    [[-1, Math.PI * 0.62], [1, Math.PI * 1.38]].forEach(function (e) {
      ctx.save();
      ctx.translate(8 + Math.cos(e[1]) * 34, Math.sin(e[1]) * 34);
      ctx.rotate(e[1] + Math.PI / 2);
      G_roundRect(ctx, -18, -8, 36, 20, 8); ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  };

  icon.syringe = function (ctx) {
    ctx.save();
    ctx.rotate(-0.7);
    roundRect(ctx, -34, -12, 56, 24, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    ctx.fillStyle = C.teal; ctx.fillRect(-10, -9, 30, 18);
    ctx.fillStyle = '#8898AA'; ctx.fillRect(-48, -4, 14, 8); ctx.fillRect(-54, -14, 6, 28); ctx.fillRect(22, -5, 8, 10);
    line(ctx, [30, 0, 52, 0], '#C8D3DD', 3);
    ctx.restore();
  };

  root.G = {
    FONT: FONT, C: C, clamp: clamp, lerp: lerp, seg: seg, ease: ease, appear: appear, rng: rng,
    roundRect: roundRect, text: text, measure: measure, blobPath: blobPath, wheal: wheal,
    skinPatch: skinPatch, card: card, circle: circle, at: at, line: line, arrow: arrow, icon: icon,
  };
})(typeof window !== 'undefined' ? window : globalThis);
