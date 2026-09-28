// 生成中文字幕：subtitles/zh-CN.srt 与 subtitles/zh-CN.vtt
// 有配音时使用真实时长，没有配音时使用估算时长（与播放器一致）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, buildTimeline, readManifest } from './lib.mjs';

function stamp(sec, sep) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}

// 字幕里去掉句末的逗号/分号，读起来更干净
const clean = (text) => text.replace(/[，；、]$/, '');

export function writeSubtitles(manifest = readManifest()) {
  const tl = buildTimeline(manifest);
  const dir = path.join(ROOT, 'subtitles');
  fs.mkdirSync(dir, { recursive: true });
  const srt = tl.cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end + 0.1, ',')}\n${clean(c.text)}\n`).join('\n');
  const vtt = 'WEBVTT\n\n' + tl.cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end + 0.1, '.')}\n${clean(c.text)}\n`).join('\n');
  fs.writeFileSync(path.join(dir, 'zh-CN.srt'), srt);
  fs.writeFileSync(path.join(dir, 'zh-CN.vtt'), vtt);
  return { tl, count: tl.cues.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { tl, count } = writeSubtitles();
  console.log(`字幕已生成：${count} 条，总时长 ${tl.duration.toFixed(1)}s（${tl.hasAudio ? '按真实配音' : '按估算语速'}）`);
}
