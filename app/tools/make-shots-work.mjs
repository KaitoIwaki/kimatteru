// 社会人の1か月（?demo=work）で、App Store の紹介画像に貼る画面を撮る。
//
//   node app/tools/make-shots-work.mjs [URL]      （既定 http://localhost:5173/）
//
// 出力：store-assets/sukuji/work/ に 1-calendar / 2-dialog / 3-free / 5-report / 7-week / 8-share
// スマホの枠に入れても壊れないよう、上 59pt・下 34pt をアプリの地の色で空ける（make-shots.mjs の SAFE=1 と同じ）
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TOP = 59, BOTTOM = 34;
const OUT = join(here, '..', '..', 'store-assets', 'sukuji', 'work');
const BASE = (process.argv[2] || 'http://localhost:5173/').replace(/\/$/, '');
const URL = `${BASE}/?demo=work`;
mkdirSync(OUT, { recursive: true });

const SEED = { events: [], jobs: [], overrides: {}, settings: { onboarded: true }, notices: [], lastSeenVersion: '9.9.9' };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 - TOP - BOTTOM }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
const log = [];
page.on('pageerror', (e) => log.push('!! ページで例外: ' + e.message));

const boot = async () => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('kimatteru.v2', JSON.stringify(s)); }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1100);
};
const shot = async (name) => {
  await page.waitForTimeout(500);
  const buf = await page.screenshot();
  const meta = await sharp(buf).metadata();
  const band = async (row, h) => { const { data, info } = await sharp(buf).extract({ left: 0, top: row, width: meta.width, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    const c = [0, 1, 2].map((i) => { let t = 0; for (let x = 0; x < info.width; x++) t += data[x * info.channels + i]; return Math.round(t / info.width); });
    return sharp({ create: { width: meta.width, height: h, channels: 3, background: { r: c[0], g: c[1], b: c[2] } } }).png().toBuffer(); };
  const top = await band(0, TOP * 3), bottom = await band(meta.height - 1, BOTTOM * 3);
  await sharp({ create: { width: meta.width, height: 932 * 3, channels: 3, background: '#F6F7F9' } })
    .composite([{ input: top, top: 0, left: 0 }, { input: buf, top: TOP * 3, left: 0 }, { input: bottom, top: (932 - BOTTOM) * 3, left: 0 }])
    .png().toFile(join(OUT, `${name}.png`));
  log.push(`撮影 ${name}`);
};
const nav = async (label) => { await page.getByText(label, { exact: true }).last().click(); await page.waitForTimeout(700); };

// 1. 月表示
await boot();
await shot('1-calendar');

// 2. 「この仮押さえ、どうなった？」— 今日（28日）の点線の「訪問」を押す
{
  // 28日のマス。帯は押せないので、数字の少し下を押す。3か月ぶん横に並んでいるので、画面の中の「28」を選ぶ
  const r = await page.evaluate(() => { for (const s of document.querySelectorAll('span')) { if (s.textContent.trim() !== '28') continue; const b = s.getBoundingClientRect(); if (b.x > 0 && b.x < 430 && b.width > 0) return { x: b.x, y: b.y }; } return null; });
  await page.mouse.click(r.x + 18, r.y + 70);
  await page.waitForTimeout(800);
  await page.getByText('？訪問').first().click();
  await page.waitForTimeout(900);
  const body = await page.locator('body').innerText();
  log.push(body.includes('この仮押さえ、どうなった？') ? 'ダイアログ（仮押さえ）が開いた' : '!! ダイアログが開いていない');
  await shot('2-dialog');
}

// 3. 空き状況（平日は 19:00 以降で判定）
await boot();
await nav('空き状況');
await shot('3-free');
// 3b. 空いてる日を送る
await page.getByText('シェア', { exact: true }).first().click();
await page.waitForTimeout(900);
await shot('8-share');

// 5. まとめ
await boot();
await nav('まとめ');
await shot('5-report');

// 7. 週表示
await boot();
await page.getByText('週', { exact: true }).first().click();
await page.waitForTimeout(900);
await shot('7-week');

await browser.close();
console.log(log.join('\n'));
console.log(`\n書き出し先: ${OUT}`);
console.log(log.some((l) => l.startsWith('!!')) ? '=== 落ちたものがある ===' : '=== 全部撮れた ===');
