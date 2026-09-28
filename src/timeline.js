/*
 * 由旁白脚本 + 配音时长构建整条时间轴。
 * - 有配音清单（audio/manifest.js）时，每句时长取真实音频时长；
 * - 没有配音时，按中文语速估算，视频照样可以完整播放（静音 + 字幕）。
 * 浏览器与 Node（生成字幕、拼接配音）共用本文件，保证两边时间完全一致。
 */
(function (root) {
  var CHARS_PER_SEC = 4.6;   // 估算语速（不含标点）
  var LEAD_IN = 1.2;         // 片头静默
  var SCENE_PAD_IN = 0.4;    // 每个场景开头留白
  var SCENE_PAD_OUT = 0.6;   // 每个场景结尾留白
  var CUE_GAP = 0.22;        // 句间停顿
  var OUTRO = 3.0;           // 片尾卡片停留

  function speakable(text) {
    return text.replace(/[，。；：、？！“”‘’\s,.;:?!"]/g, '').length;
  }

  function estimate(text) {
    return speakable(text) / CHARS_PER_SEC + 0.15;
  }

  function build(narration, audio) {
    var durations = {};
    if (audio && audio.cues) {
      audio.cues.forEach(function (c) { durations[c.id] = c.duration; });
    }
    var t = LEAD_IN;
    var scenes = [];
    var cues = [];
    narration.scenes.forEach(function (s, si) {
      var start = si === 0 ? 0 : t;
      t += SCENE_PAD_IN;
      var local = [];
      s.cues.forEach(function (c, ci) {
        var d = durations[c.id] != null ? durations[c.id] : estimate(c.text);
        var cue = { id: c.id, text: c.text, start: t, end: t + d, scene: si, index: ci };
        cues.push(cue);
        local.push(cue);
        t += d + (ci < s.cues.length - 1 ? CUE_GAP : 0);
      });
      t += SCENE_PAD_OUT;
      if (si === narration.scenes.length - 1) t += OUTRO;
      scenes.push({ id: s.id, chapter: s.chapter, index: si, start: start, end: t, cues: local });
    });
    return {
      duration: t,
      scenes: scenes,
      cues: cues,
      hasAudio: !!(audio && audio.cues && audio.cues.length),
    };
  }

  root.Timeline = { build: build, estimate: estimate, speakable: speakable };
})(typeof window !== 'undefined' ? window : globalThis);
