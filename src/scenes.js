/*
 * 八个场景的画面。每个场景是纯函数 draw(ctx, L)：
 *   L.t      场景内时间（秒）
 *   L.dur    场景时长
 *   L.cue(i) 第 i 句旁白在场景内的开始时间；L.cueEnd(i) 为结束时间
 * 画面节奏跟随旁白：配音变长或变短，动画会自动对齐。
 */
(function (root) {
  var G = root.G, C = G.C;
  var appear = G.appear, seg = G.seg, ease = G.ease, lerp = G.lerp, clamp = G.clamp;
  var W = 1920;

  // 场景内的小标题（居中，大字）
  function headline(ctx, str, y, k, o) {
    o = o || {};
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha *= k;
    G.text(ctx, str, o.x || W / 2, y + (1 - k) * 24, {
      size: o.size || 64, weight: 800, align: o.align || 'center', color: o.color || C.ink,
      shadow: 'rgba(0,0,0,0.35)',
    });
    ctx.restore();
  }

  function label(ctx, str, x, y, k, o) {
    if (k <= 0) return;
    o = o || {};
    var size = o.size || 34;
    var w = G.measure(ctx, str, size, 700) + 44, h = size + 26;
    var bx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.translate(0, (1 - k) * 12);
    G.roundRect(ctx, bx, y - h / 2, w, h, h / 2);
    ctx.fillStyle = o.fill || 'rgba(13,33,49,0.85)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = o.line || C.teal;
    ctx.stroke();
    G.text(ctx, str, bx + w / 2, y + 1, { size: size, weight: 700, align: 'center', baseline: 'middle', color: o.color || C.ink });
    ctx.restore();
  }

  function pop(ctx, x, y, k, fn) {
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha *= clamp(k * 1.4, 0, 1);
    G.at(ctx, x, y, 0.2 + 0.8 * ease.back(k), fn);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // 1. 片头：皮肤上冒出风团，又消失；引出“荨麻疹”
  // ------------------------------------------------------------------
  var INTRO_WHEALS = (function () {
    var r = G.rng(11), list = [], order = [5, 0, 10, 3, 7, 1, 9, 4, 11, 2, 8, 6];
    order.forEach(function (cell, i) {
      var gx = cell % 4, gy = Math.floor(cell / 4);
      list.push({ x: 250 + gx * 200 + (r() - 0.5) * 90, y: 300 + gy * 200 + (r() - 0.5) * 80, r: 32 + r() * 36, seed: 100 + i, d: r() });
    });
    return list;
  })();

  function intro(ctx, L) {
    var t = L.t, c1 = L.cue(1), c2 = L.cue(2);
    G.skinPatch(ctx, 140, 200, 820, 640, 5);

    ctx.save();
    ctx.beginPath(); G.roundRect(ctx, 140, 200, 820, 640, 60); ctx.clip();
    INTRO_WHEALS.forEach(function (w, i) {
      var inK = appear(t, 0.4 + i * 0.25, 0.7, ease.back);
      var outK = 1 - appear(t, c1 + 0.2 + w.d * 1.6, 0.9, ease.inOut);
      var back = c2 > 0 && i % 3 === 0 ? appear(t, c2 + 0.4 + i * 0.1, 0.8) * 0.9 : 0;
      var k = Math.max(inK * outK, back);
      var breathe = 1 + Math.sin(L.T * 2 + i) * 0.03;
      G.wheal(ctx, w.x, w.y, w.r * breathe, w.seed, k);
    });
    ctx.restore();

    // 瘙痒的小波浪线
    var itchK = seg(t, 1.2, 2) * (1 - seg(t, c1 + 0.5, c1 + 1.5));
    if (itchK > 0) {
      for (var i = 0; i < 5; i++) {
        var w = INTRO_WHEALS[i * 2];
        var ph = L.T * 6 + i;
        ctx.save();
        ctx.globalAlpha *= itchK;
        ctx.strokeStyle = C.redDeep; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        for (var s = 0; s <= 20; s++) {
          var xx = w.x + w.r + 16 + s * 3, yy = w.y - w.r - 10 + Math.sin(s * 0.9 + ph) * 6 - s * 1.2;
          if (s === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 右侧：先是问号，然后揭晓标题
    var qK = appear(t, 0.6, 0.8, ease.back) * (1 - appear(t, c2 - 0.2, 0.5));
    if (qK > 0) {
      ctx.save();
      ctx.globalAlpha *= qK;
      var bob = Math.sin(L.T * 3) * 8;
      G.text(ctx, '?', 1420, 640 + bob, { size: 420, weight: 900, align: 'center', color: C.gold, shadow: 'rgba(255,209,102,0.45)', shadowBlur: 50 });
      G.text(ctx, '起得快 · 消得快 · 很痒', 1420, 760, { size: 40, weight: 600, align: 'center', color: C.muted, alpha: seg(t, 2, 3) });
      ctx.restore();
    }

    var tK = appear(t, c2, 0.9, ease.back);
    if (tK > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(tK, 0, 1);
      G.at(ctx, 1420, 470, 0.8 + 0.2 * tK, function (c) {
        G.text(c, '荨麻疹', 0, 0, { size: 190, weight: 900, align: 'center', color: C.ink, shadow: 'rgba(255,90,106,0.55)', shadowBlur: 40 });
        G.text(c, 'Urticaria', 0, 80, { size: 52, weight: 500, align: 'center', color: C.muted });
      });
      ctx.restore();
      label(ctx, '俗称 “风疹块”', 1420, 680, appear(t, c2 + 0.9, 0.6), { size: 46, line: C.red });
      G.text(ctx, '“qián má zhěn”', 1420, 780, { size: 34, weight: 500, align: 'center', color: C.dim, alpha: appear(t, c2 + 1.3, 0.6) });
    }
  }

  // ------------------------------------------------------------------
  // 2. 发病机制：皮肤剖面，肥大细胞释放组胺 → 血管扩张渗漏 → 风团
  // ------------------------------------------------------------------
  function mechanism(ctx, L) {
    var t = L.t, c1 = L.cue(1), c2 = L.cue(2), c3 = L.cue(3);
    var X0 = 140, X1 = 1780;
    var build = appear(t, 0, 1.2);
    var dil = appear(t, c2, 1.4, ease.inOut);          // 血管扩张
    var leak = seg(t, c2 + 0.6, c3 + 1.6);             // 渗漏进度
    var bump = appear(t, c3 - 0.3, 1.5, ease.inOut);   // 风团隆起
    var BX = 1080;

    function surface(x) { return 330 - 90 * bump * Math.exp(-Math.pow((x - BX) / 230, 2)); }
    function epiBottom(x) { return 410 - 40 * bump * Math.exp(-Math.pow((x - BX) / 260, 2)); }

    ctx.save();
    ctx.globalAlpha *= build;
    ctx.beginPath(); ctx.rect(X0, 150, X1 - X0, 740); ctx.clip();
    // 皮下脂肪
    ctx.fillStyle = C.fat;
    ctx.fillRect(X0, 760, X1 - X0, 120);
    var fr = G.rng(21);
    for (var i = 0; i < 40; i++) {
      G.circle(ctx, X0 + 20 + fr() * (X1 - X0 - 40), 790 + fr() * 70, 22 + fr() * 14, 'rgba(255,255,255,0.35)', 'rgba(220,180,90,0.5)', 2);
    }
    // 真皮
    ctx.fillStyle = C.dermis;
    ctx.beginPath();
    ctx.moveTo(X0, epiBottom(X0));
    for (var x = X0; x <= X1; x += 10) ctx.lineTo(x, epiBottom(x));
    ctx.lineTo(X1, 760); ctx.lineTo(X0, 760); ctx.closePath(); ctx.fill();
    // 胶原纤维
    ctx.strokeStyle = 'rgba(210,140,120,0.25)'; ctx.lineWidth = 3;
    for (var f = 0; f < 22; f++) {
      var fx = X0 + fr() * (X1 - X0 - 200), fy = 460 + fr() * 260;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.bezierCurveTo(fx + 60, fy - 20, fx + 110, fy + 20, fx + 170, fy); ctx.stroke();
    }
    // 水肿区域（真皮浅层）
    if (leak > 0) {
      var eg = ctx.createRadialGradient(BX, 470, 20, BX, 470, 380);
      eg.addColorStop(0, 'rgba(140,200,255,' + (0.45 * leak) + ')');
      eg.addColorStop(1, 'rgba(140,200,255,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(X0, 330, X1 - X0, 330);
    }
    // 表皮
    var epi = ctx.createLinearGradient(0, 240, 0, 420);
    epi.addColorStop(0, '#F0B894'); epi.addColorStop(1, '#E9A987');
    ctx.fillStyle = epi;
    ctx.beginPath();
    ctx.moveTo(X0, surface(X0));
    for (x = X0; x <= X1; x += 10) ctx.lineTo(x, surface(x));
    for (x = X1; x >= X0; x -= 10) ctx.lineTo(x, epiBottom(x));
    ctx.closePath(); ctx.fill();
    // 表皮细胞纹理
    ctx.strokeStyle = 'rgba(170,95,70,0.25)'; ctx.lineWidth = 2;
    for (x = X0 + 30; x < X1; x += 46) {
      var top = surface(x), bot = epiBottom(x);
      ctx.beginPath(); ctx.moveTo(x, top + 8); ctx.lineTo(x + 6, bot - 6); ctx.stroke();
    }
    // 风团表面的红晕
    if (bump > 0) {
      ctx.save();
      ctx.globalAlpha *= bump;
      var rg = ctx.createRadialGradient(BX, surface(BX), 10, BX, surface(BX), 420);
      rg.addColorStop(0, 'rgba(253,235,225,0.9)');
      rg.addColorStop(0.45, 'rgba(232,72,86,0.45)');
      rg.addColorStop(1, 'rgba(232,72,86,0)');
      ctx.strokeStyle = rg; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath();
      for (x = BX - 420; x <= BX + 420; x += 10) { if (x === BX - 420) ctx.moveTo(x, surface(x)); else ctx.lineTo(x, surface(x)); }
      ctx.stroke();
      ctx.restore();
    }

    // 血管
    var VY = 620, vr = lerp(26, 42, dil);
    ctx.fillStyle = 'rgba(200,40,60,0.9)';
    G.roundRect(ctx, X0 - 10, VY - vr, X1 - X0 + 20, vr * 2, vr);
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#A31F37';
    if (dil > 0.3) ctx.setLineDash([36, lerp(0, 16, seg(dil, 0.3, 1))]);
    ctx.beginPath(); ctx.moveTo(X0 - 10, VY - vr); ctx.lineTo(X1 + 10, VY - vr); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X0 - 10, VY + vr); ctx.lineTo(X1 + 10, VY + vr); ctx.stroke();
    ctx.setLineDash([]);
    // 红细胞流动
    for (var b = 0; b < 26; b++) {
      var bx = X0 + (((b * 71 + L.T * 140) % (X1 - X0 + 60)) - 30);
      var by = VY + Math.sin(b * 2.3) * vr * 0.45;
      ctx.beginPath(); ctx.ellipse(bx, by, 14, 9, 0.3 * Math.sin(b), 0, Math.PI * 2);
      ctx.fillStyle = '#FF6B7D'; ctx.fill();
    }

    // 渗出的液体
    if (leak > 0) {
      var lr = G.rng(33);
      for (var p = 0; p < 70; p++) {
        var px0 = BX - 360 + lr() * 720;
        var delay = lr() * 0.6;
        var pk = clamp((leak - delay) / 0.5, 0, 1);
        if (pk <= 0) continue;
        var py = lerp(VY - vr, 440 + lr() * 140, ease.out(pk));
        var px = px0 + Math.sin(L.T * 1.5 + p) * 6;
        G.circle(ctx, px, py, 5 + lr() * 4, 'rgba(120,190,255,0.85)');
      }
    }

    // 肥大细胞
    var MX = 560, MY = 520;
    var burst = appear(t, c1 + 0.8, 1.2);
    ctx.save();
    G.blobPath(ctx, MX, MY, 78, 41, 0.18, 10);
    ctx.fillStyle = '#B794F6'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#7E57C2'; ctx.stroke();
    G.circle(ctx, MX - 8, MY + 4, 26, '#7E57C2');
    var gr = G.rng(51);
    for (var g = 0; g < 26; g++) {
      var ga = gr() * Math.PI * 2, gd = 34 + gr() * 34;
      var gx = MX + Math.cos(ga) * gd, gy = MY + Math.sin(ga) * gd * 0.8;
      var gone = burst > gr() ? 1 : 0;
      if (!gone) G.circle(ctx, gx, gy, 6, '#5E35B1');
    }
    ctx.restore();

    // 过敏原靠近
    var alK = appear(t, c1 - 0.2, 1.2, ease.inOut);
    for (var a = 0; a < 5; a++) {
      var ang = -Math.PI / 2 + (a - 2) * 0.45;
      var fromX = MX + Math.cos(ang) * 420, fromY = MY + Math.sin(ang) * 420;
      var toX = MX + Math.cos(ang) * 88, toY = MY + Math.sin(ang) * 72;
      var ax = lerp(fromX, toX, alK), ay = lerp(fromY, toY, alK);
      if (t < c1 - 0.2) continue;
      G.at(ctx, ax, ay, 0.35, function (c) { G.icon.virus(c, L.T); });
    }

    // 组胺颗粒扩散
    if (burst > 0) {
      var hr = G.rng(61);
      for (var h = 0; h < 40; h++) {
        var ha = hr() * Math.PI * 2, hd = hr();
        var hk = clamp(burst * 1.3 - hd * 0.3, 0, 1);
        var dist = 90 + hk * (180 + hr() * 260);
        var tx = MX + Math.cos(ha) * dist * 1.2 + hk * 160;
        var ty = MY + Math.sin(ha) * dist * 0.5 + hk * 60;
        G.circle(ctx, tx, ty, 7, 'rgba(255,209,102,' + (0.95 - hk * 0.3) + ')');
      }
    }
    ctx.restore();

    // 标注
    var lk = appear(t, 0.6, 0.6);
    G.text(ctx, '表皮', X1 - 10, 380, { size: 30, weight: 700, align: 'right', color: '#6B3A2A', alpha: lk });
    G.text(ctx, '真皮', X1 - 10, 520, { size: 30, weight: 700, align: 'right', color: '#8A4B3A', alpha: lk });
    G.text(ctx, '皮下组织', X1 - 10, 842, { size: 30, weight: 700, align: 'right', color: '#8A6A2A', alpha: lk });
    headline(ctx, '皮肤小血管暂时 “漏水”', 170, appear(t, 0.2, 0.8));
    label(ctx, '肥大细胞', MX, 680, appear(t, c1, 0.6), { line: C.violet });
    label(ctx, '释放组胺', MX + 420, 470, appear(t, c1 + 1.4, 0.6), { line: C.gold });
    label(ctx, '血管扩张 · 通透性↑', 1500, 690, appear(t, c2 + 0.4, 0.6), { line: C.red });
    label(ctx, '真皮浅层水肿 → 风团', BX, 250 - 60 * bump, appear(t, c3 + 0.6, 0.6), { line: C.teal, align: 'center' });
  }

  // ------------------------------------------------------------------
  // 3. 常见诱因：四张卡片
  // ------------------------------------------------------------------
  var CAUSES = [
    { title: '食物', lines: ['鱼虾蟹、蛋奶', '食品添加剂'], color: '#7FD1E8', draw: function (c) {
      G.at(c, -40, 10, 0.9, G.icon.fish); G.at(c, 46, -22, 0.8, G.icon.egg); G.at(c, 36, 44, 0.7, G.icon.shrimp);
    } },
    { title: '感染', lines: ['病毒、细菌', '真菌、寄生虫'], color: '#8BE08B', draw: function (c, T) {
      G.at(c, -22, -6, 1, function (cc) { G.icon.virus(cc, T); }); G.at(c, 46, 40, 0.8, G.icon.bacterium);
    } },
    { title: '药物', lines: ['抗生素、血清制剂', '疫苗等'], color: '#FF8A95', draw: function (c) {
      G.at(c, -18, -10, 1, G.icon.capsule); G.at(c, 44, 38, 0.9, G.icon.tablet); G.at(c, -52, 40, 0.6, G.icon.vial);
    } },
    { title: '其他因素', lines: ['花粉吸入、冷热日晒', '精神紧张、系统疾病'], color: '#FFD166', draw: function (c, T) {
      G.at(c, -36, -32, 0.6, function (cc) { G.icon.sun(cc, T); }); G.at(c, 38, -32, 0.55, G.icon.snow);
      G.at(c, -36, 36, 0.6, G.icon.flower); G.at(c, 38, 38, 0.55, G.icon.bolt);
    } },
  ];

  function causes(ctx, L) {
    var t = L.t;
    var cw = 380, ch = 520, gap = 40, x0 = (W - (cw * 4 + gap * 3)) / 2, y0 = 250;
    headline(ctx, '常见诱因 · 四大类', 170, appear(t, 0.1, 0.7));
    CAUSES.forEach(function (cz, i) {
      var x = x0 + i * (cw + gap);
      var ghost = appear(t, 0.2 + i * 0.12, 0.5);
      var k = appear(t, L.cue(i + 1), 0.7, ease.back);
      var active = t >= L.cue(i + 1) && (i === 3 || t < L.cue(i + 2));
      ctx.save();
      ctx.globalAlpha *= ghost * (0.35 + 0.65 * clamp(k, 0, 1));
      var lift = active ? -12 : 0;
      G.card(ctx, x, y0 + lift, cw, ch, { line: k > 0 ? cz.color : C.cardLine, lineWidth: active ? 4 : 2 });
      G.text(ctx, '0' + (i + 1), x + 32, y0 + lift + 62, { size: 40, weight: 800, color: cz.color, alpha: 0.9 });
      ctx.restore();
      if (k <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp(k, 0, 1);
      G.circle(ctx, x + cw / 2, y0 + lift + 190, 104, 'rgba(255,255,255,0.08)', cz.color, 3);
      G.at(ctx, x + cw / 2, y0 + lift + 190, 1.25 * (0.6 + 0.4 * ease.back(clamp(k, 0, 1))), function (c) { cz.draw(c, L.T); });
      G.text(ctx, cz.title, x + cw / 2, y0 + lift + 370, { size: 52, weight: 800, align: 'center' });
      cz.lines.forEach(function (ln, j) {
        G.text(ctx, ln, x + cw / 2, y0 + lift + 430 + j * 46, { size: 32, weight: 500, align: 'center', color: C.muted });
      });
      ctx.restore();
    });
    G.text(ctx, '提示：不少慢性荨麻疹患者查不到明确诱因', W / 2, 850, {
      size: 30, weight: 500, align: 'center', color: C.dim, alpha: appear(t, L.cueEnd(4) - 0.5, 0.8),
    });
  }

  // ------------------------------------------------------------------
  // 4. 临床特点：此起彼伏的风团 + 24 小时内消退
  // ------------------------------------------------------------------
  function features(ctx, L) {
    var t = L.t, c1 = L.cue(1), c2 = L.cue(2);
    headline(ctx, '来也匆匆，去也匆匆', 170, appear(t, 0.1, 0.8), { size: 76, color: C.gold });

    // 左：皮肤上风团此起彼伏
    var PX = 120, PY = 250, PW = 780, PH = 600;
    G.skinPatch(ctx, PX, PY, PW, PH, 17);
    ctx.save();
    ctx.beginPath(); G.roundRect(ctx, PX, PY, PW, PH, 60); ctx.clip();
    var r = G.rng(77);
    for (var i = 0; i < 9; i++) {
      var period = 3.2 + r() * 1.5, phase = r() * period;
      var life = ((L.t + phase) % period) / period;
      var k = Math.sin(Math.PI * clamp(life * 1.1, 0, 1));
      var x = PX + 90 + r() * (PW - 180), y = PY + 90 + r() * (PH - 180);
      G.wheal(ctx, x, y, 30 + r() * 50, 300 + i, k * appear(t, 0.3 + i * 0.1, 0.5));
    }
    // 一个固定的大风团用于标注
    var bigK = appear(t, c1 - 0.3, 0.8, ease.back);
    G.wheal(ctx, PX + 380, PY + 300, 110, 999, bigK, { wobble: 0.6 });
    ctx.restore();

    var lk = function (d) { return appear(t, c1 + d, 0.5); };
    G.arrow(ctx, 1000, 330, PX + 470, PY + 230, C.ink, 3, lk(0.2));
    label(ctx, '大小不一', 1010, 330, lk(0.2), { line: C.gold });
    G.arrow(ctx, 1000, 440, PX + 500, PY + 300, C.ink, 3, lk(0.8));
    label(ctx, '形状不规则', 1010, 440, lk(0.8), { line: C.gold });
    G.arrow(ctx, 1000, 550, PX + 510, PY + 400, C.ink, 3, lk(1.5));
    label(ctx, '周围常有红晕', 1010, 550, lk(1.5), { line: C.red });

    // 右下：24 小时时间条
    var tk = appear(t, c2, 0.6);
    if (tk > 0) {
      ctx.save();
      ctx.globalAlpha *= tk;
      var BX0 = 1080, BX1 = 1760, BY = 760;
      G.card(ctx, 1000, 640, 800, 230, {});
      var prog = seg(t, c2 + 0.3, c2 + 4.2);
      G.at(ctx, 1080, 700, 0.65, function (c) { G.icon.clock(c, prog); });
      G.text(ctx, '单个风团 < 24 小时', 1140, 712, { size: 38, weight: 800, color: C.ink });
      G.line(ctx, [BX0, BY, BX1, BY], 'rgba(255,255,255,0.2)', 10);
      G.line(ctx, [BX0, BY, lerp(BX0, BX1, prog), BY], C.teal, 10);
      G.text(ctx, '0h', BX0, BY + 52, { size: 28, align: 'center', color: C.muted });
      G.text(ctx, '24h', BX1, BY + 52, { size: 28, align: 'center', color: C.muted });
      var wk = prog < 0.25 ? ease.back(prog / 0.25) : 1 - ease.inOut(seg(prog, 0.35, 0.95));
      G.wheal(ctx, lerp(BX0, BX1, prog), BY - 2, 26, 555, wk);
      var done = appear(t, c2 + 4.2, 0.5, ease.back);
      if (done > 0) {
        G.at(ctx, 1640, 700, done, function (c) { G.icon.check(c, C.teal); });
        G.text(ctx, '不留痕迹', 1700, 712, { size: 32, weight: 700, color: C.teal, alpha: done });
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------
  // 5. 分型：6 周分界 + 特殊类型
  // ------------------------------------------------------------------
  var SPECIAL = [
    { name: '皮肤划痕症', sub: '搔抓后出现条状风团', draw: G.icon.scratch, color: '#FF8A95' },
    { name: '寒冷性', sub: '遇冷诱发', draw: G.icon.snow, color: '#BFE9FF' },
    { name: '日光性', sub: '日晒诱发', draw: function (c, T) { G.icon.sun(c, T); }, color: C.gold },
    { name: '胆碱能性', sub: '运动、出汗、体温升高', draw: G.icon.thermo, color: C.orange },
  ];

  function types(ctx, L) {
    var t = L.t, c0 = L.cue(0), c1 = L.cue(1), c2 = L.cue(2);
    var AX0 = 220, AX1 = 1700, AY = 340, MID = (AX0 + AX1) / 2;
    var axisK = appear(t, 0.1, 0.8);
    ctx.save();
    ctx.globalAlpha *= axisK;
    G.line(ctx, [AX0, AY, AX1, AY], 'rgba(255,255,255,0.18)', 26);
    for (var w = 0; w <= 12; w++) {
      var x = lerp(AX0, AX1, w / 12);
      G.line(ctx, [x, AY + 22, x, AY + 34], C.dim, 3);
      if (w % 2 === 0 && w !== 6) G.text(ctx, w + '周', x, AY + 72, { size: 26, align: 'center', color: C.muted });
    }
    ctx.restore();
    // 急性
    var ak = appear(t, c0, 1.2, ease.inOut);
    G.line(ctx, [AX0, AY, lerp(AX0, MID, ak), AY], C.teal, 26);
    label(ctx, '急性荨麻疹  < 6 周', (AX0 + MID) / 2, AY - 76, appear(t, c0 + 0.4, 0.6), { align: 'center', line: C.teal, size: 38 });
    // 慢性
    var ck = appear(t, c1, 1.6, ease.inOut);
    if (ck > 0) G.line(ctx, [MID, AY, lerp(MID, AX1, ck), AY], C.orange, 26);
    for (var r = 0; r < 12; r++) {
      var rx = MID + 40 + r * 58;
      var rk = appear(t, c1 + 0.3 + r * 0.12, 0.4, ease.back);
      if (rx < lerp(MID, AX1, ck)) G.wheal(ctx, rx, AY - 2, 16, 700 + r, rk * 0.9);
    }
    label(ctx, '慢性荨麻疹  > 6 周 · 每周 ≥ 2 次', (MID + AX1) / 2, AY - 76, appear(t, c1 + 0.5, 0.6), { align: 'center', line: C.orange, size: 38 });
    // 6 周分界线
    var dk = appear(t, c0 + 0.8, 0.6);
    if (dk > 0) {
      G.line(ctx, [MID, AY - 40, MID, AY + 40], C.red, 5, [10, 8]);
      G.text(ctx, '6 周', MID, AY + 72, { size: 32, weight: 800, align: 'center', color: C.red, alpha: dk });
    }

    // 特殊类型
    G.text(ctx, '特殊类型', W / 2, 540, { size: 40, weight: 800, align: 'center', color: C.ink, alpha: appear(t, c2, 0.5) });
    var cw = 360, gap = 36, x0 = (W - (cw * 4 + gap * 3)) / 2;
    SPECIAL.forEach(function (s, i) {
      var k = appear(t, c2 + 0.45 + i * 0.55, 0.6, ease.back);
      if (k <= 0) return;
      var x = x0 + i * (cw + gap), y = 580;
      ctx.save();
      ctx.globalAlpha *= clamp(k, 0, 1);
      ctx.translate(0, (1 - clamp(k, 0, 1)) * 40);
      G.card(ctx, x, y, cw, 270, { line: s.color });
      G.at(ctx, x + cw / 2, y + 92, 1.05, function (c) { s.draw(c, L.T); });
      G.text(ctx, s.name, x + cw / 2, y + 200, { size: 40, weight: 800, align: 'center' });
      G.text(ctx, s.sub, x + cw / 2, y + 245, { size: 26, weight: 500, align: 'center', color: C.muted });
      ctx.restore();
    });
  }

  // ------------------------------------------------------------------
  // 6. 危险信号：喉头水肿 / 过敏性休克 → 拨打 120
  // ------------------------------------------------------------------
  function danger(ctx, L) {
    var t = L.t, c1 = L.cue(1), c2 = L.cue(2);
    // 红色警示光晕
    var pulse = 0.5 + 0.5 * Math.sin(L.T * 4);
    var vg = ctx.createRadialGradient(W / 2, 540, 300, W / 2, 540, 1100);
    vg.addColorStop(0, 'rgba(255,60,80,0)');
    vg.addColorStop(1, 'rgba(255,60,80,' + (0.12 + 0.12 * pulse) * appear(t, 0, 0.8) + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, 1080);

    headline(ctx, '⚠ 危险信号', 170, appear(t, 0.1, 0.6), { color: C.red, size: 70 });

    // 左：头颈侧面与气道
    var HX = 520, HY = 470;
    var swell = appear(t, 0.8, 2.5, ease.inOut);
    ctx.save();
    ctx.globalAlpha *= appear(t, 0.2, 0.8);
    ctx.fillStyle = '#2E5670';
    ctx.beginPath();
    ctx.ellipse(HX, HY - 40, 170, 190, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); // 鼻、口
    ctx.moveTo(HX - 160, HY - 60); ctx.lineTo(HX - 215, HY + 10); ctx.lineTo(HX - 165, HY + 30);
    ctx.lineTo(HX - 180, HY + 70); ctx.lineTo(HX - 130, HY + 130); ctx.lineTo(HX - 60, HY + 140);
    ctx.lineTo(HX - 60, HY + 380); ctx.lineTo(HX + 110, HY + 380); ctx.lineTo(HX + 110, HY + 100); ctx.closePath();
    ctx.fill();
    // 气道
    var aw = lerp(34, 10, swell);
    ctx.strokeStyle = 'rgba(180,220,255,0.9)';
    ctx.lineWidth = 34; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(HX - 150, HY + 40); ctx.quadraticCurveTo(HX - 20, HY + 40, HX + 10, HY + 150); ctx.stroke();
    ctx.lineWidth = aw;
    ctx.beginPath(); ctx.moveTo(HX + 10, HY + 150); ctx.lineTo(HX + 16, HY + 250); ctx.stroke();
    ctx.lineWidth = 34;
    ctx.beginPath(); ctx.moveTo(HX + 16, HY + 250); ctx.lineTo(HX + 20, HY + 380); ctx.stroke();
    // 水肿的喉部
    if (swell > 0) {
      var sg = ctx.createRadialGradient(HX + 12, HY + 200, 4, HX + 12, HY + 200, 90);
      sg.addColorStop(0, 'rgba(255,90,106,' + 0.9 * swell + ')');
      sg.addColorStop(1, 'rgba(255,90,106,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(HX + 12, HY + 200, 90, 0, Math.PI * 2); ctx.fill();
    }
    // 呼吸气流（越来越弱）
    for (var a = 0; a < 4; a++) {
      var ph = ((L.T * 0.9 + a * 0.25) % 1);
      ctx.globalAlpha = (1 - ph) * (1 - swell * 0.8) * appear(t, 0.4, 0.8);
      G.arrow(ctx, HX - 330 + ph * 60, HY + 40, HX - 250 + ph * 60, HY + 40, '#BFE9FF', 4, 1);
    }
    ctx.restore();
    label(ctx, '喉头水肿', HX + 170, HY + 200, appear(t, 1.8, 0.6), { line: C.red, align: 'left' });

    // 右：症状清单
    var items = [
      { txt: '喉咙发紧', at: 0.6 }, { txt: '呼吸困难', at: 1.5 },
      { txt: '心慌', at: c1 + 0.1 }, { txt: '头晕', at: c1 + 0.6 }, { txt: '剧烈腹痛', at: c1 + 1.1 },
    ];
    items.forEach(function (it, i) {
      var k = appear(t, it.at, 0.5, ease.back);
      if (k <= 0) return;
      var col = i % 2, row = Math.floor(i / 2);
      var x = 1000 + col * 380, y = 290 + row * 120;
      ctx.save();
      ctx.globalAlpha *= clamp(k, 0, 1);
      G.card(ctx, x, y, 350, 96, { fill: 'rgba(255,90,106,0.14)', line: 'rgba(255,90,106,0.6)', r: 48 });
      G.circle(ctx, x + 48, y + 48, 26, C.red);
      G.text(ctx, '!', x + 48, y + 50, { size: 38, weight: 900, align: 'center', baseline: 'middle' });
      G.text(ctx, it.txt, x + 96, y + 50, { size: 40, weight: 700, baseline: 'middle' });
      ctx.restore();
    });

    // 拨打 120
    var ck = appear(t, c2 + 0.2, 0.7, ease.back);
    if (ck > 0) {
      var s = 1 + 0.04 * Math.sin(L.T * 8);
      ctx.save();
      ctx.globalAlpha *= clamp(ck, 0, 1);
      G.at(ctx, 1380, 770, ck * s, function (c) {
        G.roundRect(c, -380, -90, 760, 180, 90);
        c.fillStyle = C.red; c.shadowColor = 'rgba(255,90,106,0.7)'; c.shadowBlur = 50; c.fill();
        c.shadowColor = 'transparent';
        G.at(c, -270, 0, 1.2, G.icon.phone);
        G.text(c, '立即拨打 120', 50, 4, { size: 76, weight: 900, align: 'center', baseline: 'middle' });
      });
      ctx.restore();
      G.text(ctx, '可能是喉头水肿或过敏性休克', 1380, 910, { size: 34, weight: 600, align: 'center', color: '#FFC2C8', alpha: appear(t, c2 + 0.8, 0.6) });
    }
  }

  // ------------------------------------------------------------------
  // 7. 治疗：原则、抗组胺药机制、足疗程、激素与生物制剂
  // ------------------------------------------------------------------
  function treatment(ctx, L) {
    var t = L.t, c1 = L.cue(1), c2 = L.cue(2), c3 = L.cue(3), c4 = L.cue(4);
    // 治疗原则
    ['去除病因', '抗过敏', '对症治疗'].forEach(function (s, i) {
      var k = appear(t, 0.5 + i * 0.7, 0.5, ease.back);
      label(ctx, s, 560 + i * 400, 180, clamp(k, 0, 1), { size: 44, align: 'center', line: C.teal, fill: 'rgba(63,193,201,0.16)' });
      if (i < 2) G.text(ctx, '+', 760 + i * 400, 196, { size: 48, weight: 800, align: 'center', color: C.dim, alpha: k });
    });

    // 左：受体示意 —— 抗组胺药占住 H1 受体，组胺被挡开
    var pk = appear(t, c1 - 0.2, 0.7);
    if (pk > 0) {
      ctx.save();
      ctx.globalAlpha *= pk;
      G.card(ctx, 110, 280, 820, 590, {});
      var MY = 740;
      ctx.fillStyle = 'rgba(183,148,246,0.35)';
      ctx.fillRect(140, MY, 760, 100);
      G.line(ctx, [140, MY, 900, MY], '#B794F6', 6);
      G.text(ctx, '细胞', 170, MY + 64, { size: 28, weight: 700, color: '#D8C7FF' });
      var block = appear(t, c1 + 0.5, 1.0, ease.inOut);
      for (var r = 0; r < 4; r++) {
        var rx = 250 + r * 180;
        // H1 受体（Y 形）
        ctx.strokeStyle = '#D8C7FF'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(rx, MY + 10); ctx.lineTo(rx, MY - 40); ctx.lineTo(rx - 26, MY - 76);
        ctx.moveTo(rx, MY - 40); ctx.lineTo(rx + 26, MY - 76); ctx.stroke();
        // 药物分子落入受体
        var dy = lerp(MY - 300, MY - 70, ease.back(clamp(block * 1.2 - r * 0.08, 0, 1)));
        if (block > 0) {
          ctx.save();
          ctx.translate(rx, dy);
          ctx.beginPath();
          for (var h = 0; h < 6; h++) {
            var ha = h / 6 * Math.PI * 2 + Math.PI / 6;
            ctx[h ? 'lineTo' : 'moveTo'](Math.cos(ha) * 26, Math.sin(ha) * 26);
          }
          ctx.closePath();
          ctx.fillStyle = C.teal; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = '#E8FFFF'; ctx.stroke();
          ctx.restore();
        }
      }
      // 组胺被弹开
      var hr = G.rng(88);
      for (var i = 0; i < 14; i++) {
        var cyc = ((L.T * 0.7 + hr()) % 1);
        var hx = 180 + hr() * 700;
        var fall = cyc < 0.5 ? cyc / 0.5 : 1 - (cyc - 0.5) / 0.5;
        var hy = lerp(470, MY - 112, fall);
        hx += cyc > 0.5 ? (cyc - 0.5) * 120 * (hr() - 0.5) : 0;
        G.circle(ctx, hx, hy, 11, 'rgba(255,209,102,0.95)');
      }
      G.text(ctx, '● 组胺', 170, 340, { size: 28, weight: 700, color: C.gold });
      G.text(ctx, '⬢ 抗组胺药', 330, 340, { size: 28, weight: 700, color: C.teal });
      ctx.restore();
      label(ctx, '第二代抗组胺药 · 非镇静 · 首选', 520, 410, appear(t, c1 + 0.8, 0.6), { size: 36, align: 'center', line: C.teal });
    }

    // 右上：日历 —— 足疗程
    var ck = appear(t, c2 - 0.2, 0.6);
    if (ck > 0) {
      ctx.save();
      ctx.globalAlpha *= ck;
      var CX = 990, CY = 280, CWd = 810, CH = 300;
      G.card(ctx, CX, CY, CWd, CH, {});
      G.text(ctx, '遵医嘱 · 足疗程 · 逐渐减停', CX + 40, CY + 62, { size: 40, weight: 800 });
      var days = 14;
      for (var d = 0; d < days; d++) {
        var col = d % 7, row = Math.floor(d / 7);
        var dx = CX + 60 + col * 104, dy = CY + 110 + row * 88;
        G.roundRect(ctx, dx, dy, 84, 70, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
        var dk = appear(t, c2 + 0.2 + d * 0.16, 0.3, ease.back);
        if (dk > 0) G.at(ctx, dx + 42, dy + 36, dk * 0.9, function (c) { G.icon.check(c, C.teal); });
      }
      ctx.restore();
      // “症状一好就停药” 被划掉
      var nk = appear(t, c2 + 1.6, 0.5);
      if (nk > 0) {
        G.text(ctx, '✗ 症状好转就自行停药', 1395, 626, { size: 32, weight: 600, align: 'center', color: C.muted, alpha: nk });
        G.line(ctx, [1235, 616, lerp(1235, 1555, appear(t, c2 + 2.0, 0.4)), 616], C.red, 5);
      }
    }

    // 右下：激素 & 生物制剂
    var sk = appear(t, c3, 0.6, ease.back);
    if (sk > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(sk, 0, 1);
      G.card(ctx, 990, 670, 395, 200, { line: C.gold });
      G.at(ctx, 1060, 740, 0.75, G.icon.tablet);
      G.text(ctx, '糖皮质激素', 1110, 752, { size: 36, weight: 800 });
      G.text(ctx, '仅用于急性重症', 1030, 810, { size: 28, color: C.muted });
      G.text(ctx, '不宜长期使用', 1030, 850, { size: 28, color: C.muted });
      ctx.restore();
    }
    var bk = appear(t, c4, 0.6, ease.back);
    if (bk > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(bk, 0, 1);
      G.card(ctx, 1405, 670, 395, 200, { line: C.violet });
      G.at(ctx, 1470, 742, 0.8, G.icon.syringe);
      G.text(ctx, '生物制剂', 1525, 752, { size: 36, weight: 800 });
      G.text(ctx, '如奥马珠单抗', 1445, 810, { size: 28, color: C.muted });
      G.text(ctx, '用于难治性慢性患者', 1445, 850, { size: 28, color: C.muted });
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------
  // 8. 日常护理 + 片尾
  // ------------------------------------------------------------------
  var TIPS = [
    { title: '记录并避开诱因', sub: '饮食、用药、环境', draw: G.icon.notebook, color: C.gold },
    { title: '穿宽松衣物', sub: '减少摩擦和压迫', draw: G.icon.shirt, color: '#9FD8C8' },
    { title: '不烫洗、不搔抓', sub: '避免加重瘙痒', draw: function (c) {
      G.at(c, -26, 4, 0.8, G.icon.drop); G.at(c, 30, 4, 0.8, G.icon.hand); G.icon.cross(c, 62);
    }, color: C.red },
  ];

  function care(ctx, L) {
    var t = L.t, c0 = L.cue(0), c1 = L.cue(1), c2 = L.cue(2);
    var outK = appear(t, c2, 0.6, ease.inOut);
    var endK = appear(t, c2 + 0.5, 0.7);
    var starts = [c0 + 0.3, c1 + 0.1, c1 + 1.2];
    var cw = 480, gap = 50, x0 = (W - (cw * 3 + gap * 2)) / 2;
    ctx.save();
    ctx.globalAlpha *= 1 - outK;
    headline(ctx, '日常护理', 170, appear(t, 0.1, 0.6));
    TIPS.forEach(function (tip, i) {
      var k = appear(t, starts[i], 0.6, ease.back);
      if (k <= 0) return;
      var x = x0 + i * (cw + gap), y = 280;
      ctx.save();
      ctx.globalAlpha *= clamp(k, 0, 1);
      ctx.translate(0, (1 - clamp(k, 0, 1)) * 40);
      G.card(ctx, x, y, cw, 520, { line: tip.color });
      G.circle(ctx, x + cw / 2, y + 180, 115, 'rgba(255,255,255,0.07)');
      G.at(ctx, x + cw / 2, y + 180, 1.5, tip.draw);
      G.text(ctx, tip.title, x + cw / 2, y + 390, { size: 46, weight: 800, align: 'center' });
      G.text(ctx, tip.sub, x + cw / 2, y + 450, { size: 30, align: 'center', color: C.muted });
      ctx.restore();
    });
    ctx.restore();

    // 片尾
    if (endK > 0) {
      ctx.save();
      ctx.globalAlpha *= endK;
      var hk = appear(t, c2 + 0.5, 0.8, ease.back);
      G.at(ctx, W / 2, 330, 0.7 + 0.3 * hk, function (c) {
        G.circle(c, 0, 0, 92, 'rgba(63,193,201,0.18)', C.teal, 5);
        G.at(c, 0, 4, 2, function (cc) { G.icon.check(cc, C.teal); });
      });
      G.text(ctx, '规范治疗，大多可以良好控制', W / 2, 560, { size: 78, weight: 900, align: 'center', shadow: 'rgba(63,193,201,0.5)', shadowBlur: 30 });
      G.text(ctx, '出现危险信号，立即就医', W / 2, 650, { size: 42, weight: 700, align: 'center', color: '#FFC2C8', alpha: appear(t, c2 + 1.2, 0.6) });
      var fk = appear(t, L.cueEnd(2) + 0.2, 0.8);
      G.text(ctx, '本视频仅用于健康科普，不能替代医生的面诊与处方', W / 2, 780, { size: 30, align: 'center', color: C.muted, alpha: fk });
      G.text(ctx, '内容参考：南方医科大学珠江医院皮肤科《荨麻疹类皮肤病》课件', W / 2, 830, { size: 26, align: 'center', color: C.dim, alpha: fk });
      ctx.restore();
    }
  }

  root.SCENES = {
    intro: intro, mechanism: mechanism, causes: causes, features: features,
    types: types, danger: danger, treatment: treatment, care: care,
  };
})(typeof window !== 'undefined' ? window : globalThis);
