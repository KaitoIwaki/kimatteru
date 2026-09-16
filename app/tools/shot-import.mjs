// 取り込みの最初の画面を撮る。出るのは store-assets/import-<tag>.png。
//   node app/tools/shot-import.mjs before | after | compose
import { chromium } from 'playwright';
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'store-assets');
const tag = process.argv[2] || 'after';
const F = "'Hiragino Sans','Yu Gothic',sans-serif";

if (tag === 'compose') {
  const a = join(OUT, 'import-before.png'), b = join(OUT, 'import-after.png');
  const ma = await sharp(a).metadata(), mb = await sharp(b).metadata();
  const label = (t, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="26"><text x="0" y="17" font-family="${F}" font-size="14" font-weight="700" fill="#1E2024">${t}</text></svg>`);
  await sharp({ create: { width: 18 * 3 + ma.width + mb.width, height: 18 * 2 + 26 + Math.max(ma.height, mb.height), channels: 3, background: '#C9CDD4' } })
    .composite([{ input: label('直す前', ma.width), top: 18, left: 18 }, { input: a, top: 44, left: 18 },
      { input: label('直したあと', mb.width), top: 18, left: 36 + ma.width }, { input: b, top: 44, left: 36 + ma.width }])
    .png().toFile(join(OUT, 'import.png'));
  console.log('できた store-assets/import.png');
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
await page.evaluate(() => new Promise((r) => window.__app.setState((s) => ({
  screen: 'import', imp: { phase: 'idle', found: [], type: 'yoji', error: '' },
  settings: { ...s.settings, dark: false, onboarded: true },
}), () => setTimeout(r, 350))));
const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 375, height: 812 } });
await browser.close();
await sharp(buf).resize(Math.round(375 * 3 * 0.5)).png().toFile(join(OUT, `import-${tag}.png`));
console.log(`できた store-assets/import-${tag}.png`);
