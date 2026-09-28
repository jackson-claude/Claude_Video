// 用无头 Chromium 打开 index.html?export=1，拿到 window.VIDEO 做逐帧渲染。
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ROOT } from './lib.mjs';

export async function openStage({ subs = true } = {}) {
  const exe = ['/opt/pw-browsers/chromium', process.env.CHROMIUM_PATH].find((p) => p && fs.existsSync(p) && fs.statSync(p).isFile());
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  const url = pathToFileURL(path.join(ROOT, 'index.html')).href + `?export=1&subs=${subs ? 1 : 0}`;
  await page.goto(url);
  await page.waitForFunction(() => window.VIDEO && window.VIDEO.duration > 0);
  await page.evaluate(() => document.fonts.ready);
  const info = await page.evaluate(() => ({ duration: window.VIDEO.duration, hasAudio: window.VIDEO.hasAudio,
    scenes: window.VIDEO.timeline.scenes.map((s) => ({ id: s.id, start: s.start, end: s.end })) }));
  async function frame(t, type = 'jpeg', quality = 0.92) {
    const data = await page.evaluate(([t, type, q]) => {
      window.VIDEO.renderAt(t);
      return document.getElementById('stage').toDataURL('image/' + type, q);
    }, [t, type, quality]);
    return Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
  }
  return { browser, page, info, frame, close: () => browser.close() };
}
