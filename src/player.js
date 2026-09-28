/*
 * 播放器：时间轴 → 逐帧渲染（背景、场景、章节、字幕）。
 * 有配音时以 <audio> 的 currentTime 作为主时钟，保证音画同步；
 * 没有配音时用系统时钟静音播放。
 * window.VIDEO.renderAt(t) 供导出脚本逐帧调用。
 */
(function () {
  var G = window.G, C = G.C;
  var W = 1920, H = 1080, FADE = 0.45;
  var audioInfo = window.NARRATION_AUDIO || null;
  var TL = window.Timeline.build(window.NARRATION, audioInfo);
  var params = new URLSearchParams(location.search);
  var exportMode = params.has('export');

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var showSubs = params.get('subs') !== '0';

  // ---------- 背景 ----------
  var BOKEH = (function () {
    var r = G.rng(2024), list = [];
    for (var i = 0; i < 18; i++) list.push({ x: r() * W, y: r() * H, r: 60 + r() * 180, s: 0.2 + r() * 0.6, p: r() * 6.28, hue: r() });
    return list;
  })();

  function background(T) {
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.bg0);
    g.addColorStop(1, C.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    BOKEH.forEach(function (b) {
      var x = (b.x + T * 12 * b.s) % (W + 400) - 200;
      var y = b.y + Math.sin(T * 0.4 * b.s + b.p) * 30;
      var rg = ctx.createRadialGradient(x, y, 0, x, y, b.r);
      var col = b.hue < 0.5 ? '63,193,201' : '255,90,106';
      rg.addColorStop(0, 'rgba(' + col + ',0.07)');
      rg.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill();
    });
  }

  function sceneAt(T) {
    for (var i = TL.scenes.length - 1; i >= 0; i--) if (T >= TL.scenes[i].start) return TL.scenes[i];
    return TL.scenes[0];
  }

  function cueAt(T) {
    for (var i = 0; i < TL.cues.length; i++) {
      var c = TL.cues[i];
      if (T >= c.start && T < c.end + 0.12) return c;
    }
    return null;
  }

  function chapterChip(scene, T) {
    var k = G.appear(T, scene.start + 0.2, 0.6);
    var str = scene.chapter;
    var w = G.measure(ctx, str, 32, 700) + 110;
    ctx.save();
    ctx.globalAlpha = k;
    G.roundRect(ctx, 60, 44, w, 64, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    G.circle(ctx, 92, 76, 22, C.teal);
    G.text(ctx, String(scene.index + 1), 92, 78, { size: 26, weight: 800, align: 'center', baseline: 'middle', color: C.bg0 });
    G.text(ctx, str, 128, 78, { size: 32, weight: 700, baseline: 'middle' });
    ctx.restore();
    // 右上角：章节进度点
    for (var i = 0; i < TL.scenes.length; i++) {
      var on = i <= scene.index;
      G.circle(ctx, W - 80 - (TL.scenes.length - 1 - i) * 30, 76, on ? 8 : 6, on ? C.teal : 'rgba(255,255,255,0.2)');
    }
  }

  function subtitle(T) {
    var cue = cueAt(T);
    if (!cue) return;
    var k = Math.min(G.seg(T, cue.start - 0.05, cue.start + 0.12), 1 - G.seg(T, cue.end, cue.end + 0.12));
    var str = cue.text.replace(/[，；、]$/, '');
    var size = 50;
    var w = G.measure(ctx, str, size, 600);
    if (w > W - 200) { size = Math.floor(size * (W - 200) / w); w = G.measure(ctx, str, size, 600); }
    ctx.save();
    ctx.globalAlpha = k;
    G.roundRect(ctx, W / 2 - w / 2 - 36, 968, w + 72, size + 34, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    G.text(ctx, str, W / 2, 968 + (size + 34) / 2 + 2, { size: size, weight: 600, align: 'center', baseline: 'middle', color: '#FFFFFF' });
    ctx.restore();
  }

  function renderAt(T) {
    T = Math.max(0, Math.min(T, TL.duration));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    background(T);
    var scene = sceneAt(T);
    var local = T - scene.start, dur = scene.end - scene.start;
    var fin = scene.index === 0 ? 1 : G.seg(local, 0, FADE);
    var fout = scene.index === TL.scenes.length - 1 ? 1 - G.seg(local, dur - 0.8, dur) : 1 - G.seg(local, dur - FADE, dur);
    var L = {
      t: local, dur: dur, T: T,
      cue: function (i) { var c = scene.cues[i]; return c ? c.start - scene.start : dur; },
      cueEnd: function (i) { var c = scene.cues[i]; return c ? c.end - scene.start : dur; },
    };
    ctx.save();
    ctx.globalAlpha = Math.min(fin, fout);
    window.SCENES[scene.id](ctx, L);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.min(fin, fout);
    chapterChip(scene, T);
    ctx.restore();
    if (showSubs) subtitle(T);
  }

  window.VIDEO = { renderAt: renderAt, timeline: TL, duration: TL.duration, fps: 30, hasAudio: TL.hasAudio };
  if (exportMode) {
    document.body.classList.add('export');
    renderAt(0);
    return;
  }

  // ---------- 交互播放 ----------
  var audio = null;
  if (audioInfo && audioInfo.narration) {
    audio = new Audio(audioInfo.narration);
    audio.preload = 'auto';
  }
  var playing = false, clockBase = 0, clockStart = 0;
  var btn = document.getElementById('play');
  var seek = document.getElementById('seek');
  var time = document.getElementById('time');
  var cc = document.getElementById('cc');
  var note = document.getElementById('note');
  seek.max = TL.duration.toFixed(2);
  note.textContent = TL.hasAudio
    ? '配音：' + (audioInfo.model || 'Gemini TTS') + (audioInfo.voice ? ' · ' + audioInfo.voice : '')
    : '尚未生成配音（静音预览）。运行 npm run tts 生成 Gemini 配音后刷新页面。';

  function now() {
    if (audio && !audio.paused) return audio.currentTime;
    return playing ? clockBase + (performance.now() - clockStart) / 1000 : clockBase;
  }
  function fmt(s) { s = Math.max(0, s); return Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2); }

  function setTime(s) {
    clockBase = Math.max(0, Math.min(s, TL.duration));
    clockStart = performance.now();
    if (audio) { try { audio.currentTime = Math.min(clockBase, audio.duration || clockBase); } catch (e) { /* 未加载 */ } }
  }
  function play() {
    if (now() >= TL.duration - 0.05) setTime(0);
    playing = true;
    clockStart = performance.now();
    if (audio && clockBase < (audio.duration || Infinity)) {
      audio.currentTime = clockBase;
      audio.play().catch(function () { /* 浏览器拦截自动播放时继续静音播放 */ });
    }
    btn.textContent = '❚❚';
  }
  function pause() {
    clockBase = now();
    playing = false;
    if (audio) audio.pause();
    btn.textContent = '▶';
  }
  btn.onclick = function () { playing ? pause() : play(); };
  canvas.onclick = btn.onclick;
  seek.oninput = function () { setTime(parseFloat(seek.value)); };
  cc.onclick = function () { showSubs = !showSubs; cc.classList.toggle('off', !showSubs); };
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') { e.preventDefault(); btn.onclick(); }
    if (e.code === 'ArrowRight') setTime(now() + 5);
    if (e.code === 'ArrowLeft') setTime(now() - 5);
  });
  if (audio) {
    // 音频播完后（片尾静音段）切回系统时钟
    audio.addEventListener('ended', function () { clockBase = audio.currentTime; clockStart = performance.now(); });
  }

  function loop() {
    var T = now();
    if (playing && T >= TL.duration) { pause(); setTime(TL.duration); T = TL.duration; }
    renderAt(T);
    seek.value = T.toFixed(2);
    time.textContent = fmt(T) + ' / ' + fmt(TL.duration);
    requestAnimationFrame(loop);
  }
  loop();
})();
