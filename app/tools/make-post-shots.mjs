// 宣伝の素材（make-post.mjs）に使う、今のアプリの画面を撮る。1290×2796（430×932 の3倍）。
//
//   npm --prefix app run build
//   node app/tools/make-post-shots.mjs
//
// サーバーは立てない。dist/ のファイルを Playwright の route でそのまま返す
// （予約済みの開発サーバーが使えない無人の実行でも撮れるように）。
// 予定は ?demo=1 のサンプル（src/demo.js）。
// 書き出し先は store-assets/marketing/shots/。App Store 用（screenshots-6.9）とは分けてある。
// 撮った版は shots/version.txt に書く。package.json の marketing と違えば撮り直しどき。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const APP = join(here, '..');
const DIST = join(APP, 'dist');
const OUT = join(APP, '..', 'store-assets', 'marketing', 'shots');
if (!existsSync(join(DIST, 'index.html'))) { console.error('dist が無い。先に npm --prefix app run build'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const ORIGIN = 'http://lukko.local';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.json': 'application/json' };
const SEED = { events: [], jobs: [], overrides: {}, settings: { onboarded: true }, notices: [], lastSeenVersion: '9.9.9' };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
await ctx.route(`${ORIGIN}/**`, (r) => {
  let p = decodeURIComponent(new URL(r.request().url()).pathname);
  if (p === '/') p = '/index.html';
  const f = join(DIST, p);
  if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
  r.fulfill({ body: readFileSync(f), contentType: TYPES[extname(f)] || 'application/octet-stream' });
});
const page = await ctx.newPage();
const log = [];
page.on('pageerror', (e) => log.push('!! ページで例外: ' + e.message));

const boot = async () => {
  await page.goto(`${ORIGIN}/?demo=1`);
  await page.evaluate((s) => localStorage.setItem('kimatteru.v2', JSON.stringify(s)), SEED);
  await page.goto(`${ORIGIN}/?demo=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);   // 入場アニメーションが収まるまで待つ
};
const shot = async (name, note) => { await page.waitForTimeout(700); await page.screenshot({ path: join(OUT, `${name}.png`) }); log.push(`撮影 ${name}.png … ${note}`); };
// 一つ撮れなくても残りは撮る
const step = async (name, fn) => { try { await fn(); } catch (e) { log.push(`!! ${name}：${e.message.split('\n')[0]}`); } };
const tab = (t) => page.locator('nav, footer, [class*=tab], [class*=Tab], body').getByText(t, { exact: true }).last().click();

await step('month', async () => { await boot(); await shot('month', '月表示（決まった＝塗り・まだ＝点線）'); });
await step('wage', async () => { await page.getByText('給料', { exact: true }).click(); await shot('wage', '月表示＋給料オン（日ごとのバイト代）'); });
await step('week', async () => { await boot(); await page.getByText('週', { exact: true }).first().click(); await shot('week', '週表示'); });
await step('day', async () => {
  // 週表示の日付の見出しを押すと日の画面が開く（App.jsx の onHead）。月のマスは押しても開かなかった
  await boot();
  await page.getByText('週', { exact: true }).first().click();
  await page.waitForTimeout(600);
  const d = new Date().getDate();
  const r = await page.evaluate((d) => { for (const el of document.querySelectorAll('div,span')) { if (el.children.length || el.textContent.trim() !== String(d)) continue;
    const b = el.getBoundingClientRect(); if (b.width && b.top > 60 && b.top < 200) return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; } return null; }, d);
  if (!r) throw new Error('週の見出しに今日が見つからない');
  await page.mouse.click(r.x, r.y);
  await page.waitForTimeout(900);
  if (!(await page.getByLabel('戻る').count())) throw new Error('日の画面が開かない');
  // 上の週の帯で日を替えながら予定の数を数え、いちばん多い日で撮る（予定 1 件だと絵が寂しい）
  // 帯は押した日に合わせて流れるので、押すたびに日付の数字で探し直す
  const cellAt = (n) => page.evaluate((n) => { const el = [...document.querySelectorAll('[data-strip="day"] > div > div')]
    .find((el) => el.children[1] && el.children[1].textContent.trim() === n && el.getBoundingClientRect().left >= 0 && el.getBoundingClientRect().right <= innerWidth + 1);
    if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, n);
  const names = await page.evaluate(() => [...document.querySelectorAll('[data-strip="day"] > div > div')]
    .filter((el) => el.getBoundingClientRect().left >= 0 && el.getBoundingClientRect().right <= innerWidth + 1).map((el) => el.children[1].textContent.trim()));
  let best = null;
  for (const n of names) {
    const p = await cellAt(n); if (!p) continue;
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(600);
    const m = (await page.locator('body').innerText()).match(/予定\s*(\d+)件/);
    const c = m ? Number(m[1]) : 0;
    if (!best || c > best.c) best = { n, c };
  }
  if (best) { const p = await cellAt(best.n); if (p) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(700); } }
  await shot('day', `日の画面（${best ? best.n : d}日・予定 ${best ? best.c : '?'}件）`);
  await page.getByText('時間', { exact: true }).last().click();
  await shot('day-time', '日の画面（時間の並び）');
});
await step('mada', async () => { await boot(); await page.getByText(/^まだ/).first().click(); await shot('mada', '「まだ」の一覧（決まっていない予定）'); });
await step('list', async () => { await boot(); await page.getByLabel('これからの予定の一覧').click(); await shot('list', 'これからの予定の一覧'); });
await step('free', async () => { await boot(); await tab('空き状況'); await shot('free', '空き状況（○△×）'); });
await step('share', async () => { await page.getByText('シェア', { exact: true }).first().click(); await page.waitForTimeout(500); await shot('share', '空いてる日を送る画像'); });
await step('report', async () => { await boot(); await tab('まとめ'); await shot('report', 'まとめ'); });
await step('add', async () => { await boot(); await page.getByText('＋', { exact: true }).last().click(); await shot('add', '予定を足す'); });

writeFileSync(join(OUT, 'version.txt'), JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')).marketing + '\n');
await browser.close();
console.log(log.join('\n'));
console.log(`\n書き出し先: ${OUT}`);
