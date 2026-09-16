// 取り込みの最初の画面を撮る。出るのは store-assets/import-<tag>.png。
//   node app/tools/shot-import.mjs before|after|compose  intro|found
import { chromium } from 'playwright';
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'store-assets');
const tag = process.argv[2] || 'after';
const phase = process.argv[3] || 'intro';
const F = "'Hiragino Sans','Yu Gothic',sans-serif";

if (tag === 'compose') {
  const a = join(OUT, `import-before-${phase}.png`), b = join(OUT, `import-after-${phase}.png`);
  const ma = await sharp(a).metadata(), mb = await sharp(b).metadata();
  const label = (t, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="26"><text x="0" y="17" font-family="${F}" font-size="14" font-weight="700" fill="#1E2024">${t}</text></svg>`);
  await sharp({ create: { width: 18 * 3 + ma.width + mb.width, height: 18 * 2 + 26 + Math.max(ma.height, mb.height), channels: 3, background: '#C9CDD4' } })
    .composite([{ input: label('直す前', ma.width), top: 18, left: 18 }, { input: a, top: 44, left: 18 },
      { input: label('直したあと', mb.width), top: 18, left: 36 + ma.width }, { input: b, top: 44, left: 36 + ma.width }])
    .png().toFile(join(OUT, `import-${phase}.png`));
  console.log(`できた store-assets/import-${phase}.png`);
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3 });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const el = document.getElementById('root').firstElementChild;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
  let f = el[key];
  while (f && !(f.stateNode && f.stateNode.setState && f.stateNode.state)) f = f.return;
  window.__app = f.stateNode;
});
await page.evaluate((phase) => new Promise((r) => window.__app.setState((s) => ({
  screen: 'import', imp: phase === 'found'
    ? { phase: 'found', type: 'yoji', error: '', found: [
        { key: 'a', title: '映画', on: true, guessed: true, type: 'asobi', m: 8, day: 4, start: '19:00', end: '22:00' },
        { key: 'b', title: 'バイト', on: true, guessed: true, type: 'baito', m: 8, day: 6, start: '10:00', end: '15:00' },
        { key: 'c', title: '歯医者', on: true, guessed: true, type: 'yoji', m: 8, day: 13, start: '18:00', end: '19:00' },
        { key: 'd', title: 'ゼミ', on: true, guessed: false, type: 'yoji', m: 8, day: 15, start: '13:00', end: '16:30' },
        { key: 'e', title: '花火大会', on: true, guessed: true, type: 'asobi', m: 8, day: 26, start: '18:00', end: '22:00' },
        { key: 'f', title: '健康診断', on: false, guessed: false, type: 'yoji', m: 9, day: 2, allDay: true, start: '09:00', end: '11:00' },
        { key: 'g', title: 'バイト', on: true, guessed: true, type: 'baito', m: 9, day: 5, start: '17:00', end: '22:00' },
      ] }
    : { phase: 'idle', found: [], type: 'yoji', error: '' },
  settings: { ...s.settings, dark: false, onboarded: true },
}), () => setTimeout(r, 350))), phase);
const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 375, height: 812 } });
await browser.close();
await sharp(buf).resize(Math.round(375 * 3 * 0.5)).png().toFile(join(OUT, `import-${tag}-${phase}.png`));
console.log(`できた store-assets/import-${tag}-${phase}.png`);
