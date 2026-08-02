// App Store 用のスクリーンショットを撮る（6.9インチ ＝ 1290×2796）。
//
// 実機で撮らずに済ませるための道具。430×932 の CSS ピクセルを
// deviceScaleFactor 3 で撮ると、ちょうど 1290×2796 になる。
//
// 使い方（2つのターミナルで）
//   npm --prefix app run build && npm --prefix app run preview
//   npm i -D playwright && npx playwright install chromium
//   node app/tools/make-shots.mjs
//
// playwright は package.json に入れていない。postinstall がブラウザ本体
// （150MB ほど）を落としに行くので、常設すると Codemagic のビルドが重くなる。
// 撮るときだけ入れて、済んだら消してよい。
//
// 別のポートで動かしているときは URL を渡す：
//   node app/tools/make-shots.mjs http://127.0.0.1:4180/
//
// 予定は `?demo=1` のサンプル（src/demo.js）を表示中の月に流し込んで撮る。
// 以前ここは html2canvas で作っていて、**重なりとぼかしを描けなかった**ため
// 確認ダイアログの1枚だけ撮れていなかった。本物のブラウザで撮れば出る。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'store-assets', 'screenshots-6.9');
const BASE = (process.argv[2] || 'http://127.0.0.1:4173/').replace(/\/$/, '');
const URL = `${BASE}/?demo=1`;

mkdirSync(OUT, { recursive: true });

// 案内を出さないための下ごしらえ。予定は空にしておき、?demo=1 に入れさせる。
const SEED = { events: [], jobs: [], overrides: {},
  settings: { onboarded: true }, notices: [], lastSeenVersion: '9.9.9' };

// ブラウザの場所を決め打ちしている環境（CI やコンテナ）では
// CHROMIUM_PATH で差し替えられるようにしておく。ふだんは空でよい。
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
const log = [];
page.on('pageerror', (e) => log.push('!! ページで例外: ' + e.message));

const boot = async () => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate((s) => localStorage.setItem('kimatteru.v2', JSON.stringify(s)), SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);   // 入場アニメーションが収まるまで待つ
};

const shot = async (name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  log.push(`撮影 ${name}`);
};

// 帯は pointer-events:none なので、帯そのものではなく「その下のマス」を押す
const tapCellUnder = async (rect) => {
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h + 24);
  await page.waitForTimeout(800);
};
const rectOf = async (locator) => {
  const b = await locator.boundingBox();
  return b && { x: b.x, y: b.y, w: b.width, h: b.height };
};

// ---------- 1. 月表示（看板） ----------
await boot();
await shot('ss-1-month');

// ---------- 2. 給料オン ----------
await page.getByText('給料', { exact: true }).click();
await page.waitForTimeout(700);
await shot('ss-2-wage');

// ---------- 3. 空き状況 ----------
await boot();
await page.getByText('空き状況', { exact: true }).click();
await page.waitForTimeout(700);
await shot('ss-3-free');

// ---------- 4. 空いてる日シェア（空き状況の右上「シェア」から） ----------
await page.getByText('シェア', { exact: true }).first().click();
await page.waitForTimeout(1000);
await shot('ss-4-share');

// ---------- 5. まとめ ----------
await boot();
await page.getByText('まとめ', { exact: true }).last().click();
await page.waitForTimeout(700);
await shot('ss-5-report');                                   // 一覧。密度がある
await page.getByText('今月のまとめカード', { exact: true }).click();
await page.waitForTimeout(900);
await shot('ss-5b-summary-card');                            // シェア用カード

// ---------- 6. 確認ダイアログ ----------
// このアプリ一番の見せ場。見出しは種類で変わる：
//   バイト → このシフト、どうなりました？ ／ 遊び → 約束、決まった？
// 説明文が「どうなりました？」と書いているので、バイト版を本命にする。
await boot();
// 「カフェ」の帯は月内に複数ある。未確定は破線なので、枠線の種類で選び分ける
// （文字は span、破線は親の帯に付いている）。
const dashed = await page.evaluate(() => {
  for (const sp of document.querySelectorAll('span')) {
    if (sp.textContent.trim() !== 'カフェ' || sp.children.length) continue;
    let p = sp.parentElement;
    for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
      if (getComputedStyle(p).borderStyle.includes('dashed')) {
        const r = p.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }
    }
  }
  return null;
});
if (!dashed) throw new Error('未確定（破線）のカフェが月表示に見つからない');
await tapCellUnder(dashed);
const shiftRow = await rectOf(page.getByText(/カフェ/).last());
if (!shiftRow) throw new Error('その日の一覧にカフェの行が無い');
await page.mouse.click(shiftRow.x + shiftRow.w / 2, shiftRow.y + shiftRow.h / 2);
await page.waitForTimeout(900);
let body = await page.locator('body').innerText();
log.push(body.includes('どうなりました') ? 'ダイアログ（バイト）が開いた' : '!! バイト版が開いていない');
await shot('ss-6-dialog');

// 遊び版も控えとして撮っておく（「約束、決まった？」）
await boot();
const fw = await rectOf(page.getByText('花火大会', { exact: true }).first());
if (fw) {
  await tapCellUnder(fw);
  await page.mouse.click(...(await (async () => {
    const r = await rectOf(page.getByText(/花火大会/).last());
    return [r.x + r.w / 2, r.y + r.h / 2];
  })()));
  await page.waitForTimeout(900);
  body = await page.locator('body').innerText();
  log.push(body.includes('決まった？') ? 'ダイアログ（遊び）が開いた' : '!! 遊び版が開いていない');
  await shot('ss-6b-dialog-asobi');
}

await browser.close();
console.log(log.join('\n'));
console.log(`\n書き出し先: ${OUT}`);
console.log(log.some((l) => l.startsWith('!!')) ? '=== 落ちたものがある ===' : '=== 全部撮れた ===');
