// Node 端共用：加载浏览器同一份旁白脚本与时间轴，避免两边不一致。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const AUDIO_DIR = path.join(ROOT, 'audio');
export const MANIFEST_JSON = path.join(AUDIO_DIR, 'manifest.json');

function load(rel) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), { filename: rel });
}
load('src/narration.js');
load('src/timeline.js');

export const NARRATION = globalThis.NARRATION;
export const Timeline = globalThis.Timeline;

export function readManifest() {
  if (!fs.existsSync(MANIFEST_JSON)) return null;
  return JSON.parse(fs.readFileSync(MANIFEST_JSON, 'utf8'));
}

export function buildTimeline(manifest = readManifest()) {
  return Timeline.build(NARRATION, manifest);
}

export function allCues() {
  return NARRATION.scenes.flatMap((s) => s.cues);
}
