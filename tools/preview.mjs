// 渲染若干关键帧 PNG 用于检查画面：node tools/preview.mjs [输出目录] [每个场景取样数]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { openStage } from './browser.mjs';

const out = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'preview'));
const per = Number(process.argv[3] || 3);
fs.mkdirSync(out, { recursive: true });
const stage = await openStage();
const files = [];
for (const s of stage.info.scenes) {
  for (let i = 1; i <= per; i++) {
    const t = s.start + ((s.end - s.start) * i) / (per + 1);
    const f = path.join(out, `${s.id}-${i}.png`);
    fs.writeFileSync(f, await stage.frame(t, 'png'));
    files.push(`${f}  @${t.toFixed(1)}s`);
  }
}
await stage.close();
console.log(files.join('\n'));
