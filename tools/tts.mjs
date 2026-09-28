// 用 Gemini TTS 为每一句旁白配音，并按时间轴拼接成 audio/narration.wav。
//
//   GEMINI_API_KEY=...  node tools/tts.mjs            # 生成（已生成且文本未变的句子会复用缓存）
//   node tools/tts.mjs --force                         # 全部重新生成
//   node tools/tts.mjs --only c05,c06                  # 只重录指定句子
//
// 环境变量：
//   GEMINI_API_KEY     必填（也接受 GOOGLE_API_KEY）
//   GEMINI_TTS_MODEL   模型 ID；不填时从 ListModels 中自动选择 Gemini 3.8 的 TTS 模型
//   GEMINI_TTS_VOICE   预置音色，默认 Kore
//   GEMINI_TTS_STYLE   朗读风格提示词（放在每句话前面）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AUDIO_DIR, MANIFEST_JSON, allCues, buildTimeline, readManifest } from './lib.mjs';
import { writeSubtitles } from './subtitles.mjs';

const API = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const VOICE = process.env.GEMINI_TTS_VOICE || 'Kore';
const STYLE = process.env.GEMINI_TTS_STYLE
  || '请用标准普通话，以亲切、清晰、自然的健康科普节目主播语气，语速适中偏快，朗读下面这句话（只读引号内的内容）：';
const WANTED = /3[.\-_]8/;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',')) : null;

if (!KEY) {
  console.error('缺少 GEMINI_API_KEY：请在运行环境中设置该变量后重试（不要把密钥写进代码或提交到仓库）。');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, init = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + pathname, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY, ...(init.headers || {}) },
    });
    if (res.ok) return res.json();
    const body = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 5) throw new Error(`Gemini API ${res.status}: ${body.slice(0, 600)}`);
    const hinted = /"retryDelay":\s*"(\d+)s"/.exec(body);
    const wait = hinted ? Number(hinted[1]) * 1000 + 500 : 4000 * 2 ** attempt;
    console.warn(`  ${res.status}，${(wait / 1000).toFixed(0)}s 后重试…`);
    await sleep(wait);
  }
}

async function resolveModel() {
  if (process.env.GEMINI_TTS_MODEL) return process.env.GEMINI_TTS_MODEL.replace(/^models\//, '');
  const models = [];
  let token = '';
  do {
    const page = await api(`/models?pageSize=1000${token ? `&pageToken=${token}` : ''}`);
    models.push(...(page.models || []));
    token = page.nextPageToken || '';
  } while (token);
  const tts = models.filter((m) => /tts/i.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent'));
  const match = tts.filter((m) => WANTED.test(m.name));
  if (!match.length) {
    throw new Error('没有找到 Gemini 3.8 的 TTS 模型。当前 API Key 可用的 TTS 模型：\n  '
      + (tts.map((m) => m.name.replace('models/', '')).join('\n  ') || '（无）')
      + '\n如需指定，请设置 GEMINI_TTS_MODEL。');
  }
  // 同一代有多个时，优先 pro，其次按名称排序取最新
  match.sort((a, b) => (/pro/.test(b.name) - /pro/.test(a.name)) || b.name.localeCompare(a.name));
  return match[0].name.replace('models/', '');
}

async function synthesize(model, text) {
  const json = await api(`/models/${model}:generateContent`, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${STYLE}“${text}”` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      },
    }),
  });
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error('响应中没有音频数据：' + JSON.stringify(json).slice(0, 400));
  const mime = part.inlineData.mimeType || '';
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] || 24000);
  let pcm = Buffer.from(part.inlineData.data, 'base64');
  if (/wav/i.test(mime) && pcm.toString('ascii', 0, 4) === 'RIFF') pcm = pcm.subarray(44);
  return { rate, samples: new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + (pcm.length & ~1))) };
}

// 去掉首尾静音，保证字幕与声音对齐
function trim(samples, rate) {
  const th = 400;
  let a = 0, b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < th) a++;
  while (b > a && Math.abs(samples[b]) < th) b--;
  a = Math.max(0, a - Math.round(rate * 0.04));
  b = Math.min(samples.length - 1, b + Math.round(rate * 0.12));
  return samples.slice(a, b + 1);
}

function wav(samples, rate) {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

function readWav(file) {
  const buf = fs.readFileSync(file);
  const rate = buf.readUInt32LE(24);
  const data = buf.subarray(44);
  return { rate, samples: new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length)) };
}

const model = await resolveModel();
console.log(`TTS 模型：${model} · 音色：${VOICE}`);
fs.mkdirSync(AUDIO_DIR, { recursive: true });

const prev = readManifest();
const prevById = new Map((prev?.cues || []).map((c) => [c.id, c]));
const cues = [];
let rate = 24000;
for (const cue of allCues()) {
  const sha = crypto.createHash('sha1').update([model, VOICE, STYLE, cue.text].join('\n')).digest('hex').slice(0, 12);
  const file = `audio/${cue.id}.wav`;
  const abs = path.join(AUDIO_DIR, `${cue.id}.wav`);
  const cached = prevById.get(cue.id);
  const reuse = !FORCE && !(ONLY && ONLY.has(cue.id)) && cached?.sha === sha && fs.existsSync(abs);
  if (reuse || (ONLY && !ONLY.has(cue.id) && fs.existsSync(abs))) {
    const w = readWav(abs);
    rate = w.rate;
    cues.push({ ...(cached || { id: cue.id, file, sha }), duration: w.samples.length / w.rate });
    console.log(`  ${cue.id} 复用缓存`);
    continue;
  }
  process.stdout.write(`  ${cue.id} ${cue.text} … `);
  const out = await synthesize(model, cue.text);
  const samples = trim(out.samples, out.rate);
  rate = out.rate;
  fs.writeFileSync(abs, wav(samples, out.rate));
  const duration = samples.length / out.rate;
  cues.push({ id: cue.id, file, sha, text: cue.text, duration });
  console.log(`${duration.toFixed(2)}s`);
}

// 按时间轴把每句放到正确位置，拼成整条旁白
const manifest = { model, voice: VOICE, rate, narration: 'audio/narration.wav', cues };
const tl = buildTimeline(manifest);
const mix = new Int16Array(Math.ceil(tl.duration * rate));
for (const c of tl.cues) {
  const { samples } = readWav(path.join(AUDIO_DIR, `${c.id}.wav`));
  mix.set(samples.subarray(0, Math.max(0, mix.length - Math.round(c.start * rate))), Math.round(c.start * rate));
}
fs.writeFileSync(path.join(AUDIO_DIR, 'narration.wav'), wav(mix, rate));
manifest.duration = tl.duration;
fs.writeFileSync(MANIFEST_JSON, JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(AUDIO_DIR, 'manifest.js'),
  '// 由 tools/tts.mjs 生成，勿手动修改\nwindow.NARRATION_AUDIO = ' + JSON.stringify(manifest, null, 2) + ';\n');
writeSubtitles(manifest);
if (tl.duration > 120) console.warn(`注意：总时长 ${tl.duration.toFixed(1)}s 超过 2 分钟，可在 GEMINI_TTS_STYLE 中要求更快语速，或精简 src/narration.js。`);
console.log(`完成：${cues.length} 句，视频总时长 ${tl.duration.toFixed(1)}s；已更新 audio/narration.wav 与 subtitles/zh-CN.srt/.vtt`);
