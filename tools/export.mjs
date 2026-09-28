// 逐帧渲染 Canvas 并用 ffmpeg 合成 MP4（1920×1080，30fps）。
//
//   node tools/export.mjs                 # 字幕烧录进画面，输出 dist/urticaria.mp4
//   node tools/export.mjs --soft-subs     # 画面不带字幕，改为封装可开关的中文字幕轨
//   node tools/export.mjs --out a.mp4 --fps 30
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';
import { writeSubtitles } from './subtitles.mjs';
import { openStage } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const SOFT = args.includes('--soft-subs');
const FPS = Number(opt('--fps', 30));
const OUT = path.resolve(ROOT, opt('--out', 'dist/urticaria.mp4'));

function findFfmpeg() {
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'];
  const py = spawnSync('python3', ['-c', 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())'], { encoding: 'utf8' });
  if (py.status === 0) candidates.push(py.stdout.trim());
  for (const c of candidates) {
    if (c && spawnSync(c, ['-version']).status === 0) return c;
  }
  throw new Error('找不到 ffmpeg：请安装 ffmpeg，或设置 FFMPEG_PATH，或 pip install imageio-ffmpeg');
}

const ffmpeg = findFfmpeg();
writeSubtitles();
const stage = await openStage({ subs: !SOFT });
const { duration, hasAudio } = stage.info;
const total = Math.ceil(duration * FPS);
const narration = path.join(ROOT, 'audio', 'narration.wav');
const withAudio = hasAudio && fs.existsSync(narration);
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const ff = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
if (withAudio) ff.push('-i', narration);
if (SOFT) ff.push('-i', path.join(ROOT, 'subtitles', 'zh-CN.srt'));
ff.push('-map', '0:v');
if (withAudio) ff.push('-map', '1:a', '-c:a', 'aac', '-b:a', '160k');
if (SOFT) ff.push('-map', `${withAudio ? 2 : 1}:s`, '-c:s', 'mov_text', '-metadata:s:s:0', 'language=chi', '-metadata:s:s:0', 'title=中文');
ff.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-t', duration.toFixed(3), '-movflags', '+faststart', OUT);

console.log(`导出 ${total} 帧（${duration.toFixed(1)}s @ ${FPS}fps），${withAudio ? '含 Gemini 配音' : '无配音（尚未运行 npm run tts）'}，字幕：${SOFT ? '软字幕轨' : '烧录'}`);
const proc = spawn(ffmpeg, ff, { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => proc.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg 退出码 ' + code)))));

let lastPct = -1;
for (let i = 0; i < total; i++) {
  const buf = await stage.frame(i / FPS, 'jpeg', 0.93);
  if (!proc.stdin.write(buf)) await new Promise((r) => proc.stdin.once('drain', r));
  const pct = Math.floor((i / total) * 10);
  if (pct !== lastPct) { lastPct = pct; console.log(`  ${pct * 10}%`); }
}
proc.stdin.end();
await done;
await stage.close();
console.log('完成：' + path.relative(ROOT, OUT));
