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
// SAFE=1 を付けると、**スマホの枠に入れても壊れない版**を store-assets/sukuji/ に出す。
// 枠には上にノッチ（ダイナミックアイランド）と下にホームバーがある。素のキャプチャは
// 上端から中身が始まるので、枠に入れると 9月の見出しやダイアログの頭がノッチに隠れた
// （sukuji.com で実際そうなった）。上 59pt・下 34pt をアプリの地の色で空けて、
// その内側に画面を置く。iPhone 15 Pro の safe area と同じ寸法。
//   SAFE=1 node app/tools/make-shots.mjs
//
// 予定は `?demo=1` のサンプル（src/demo.js）を表示中の月に流し込んで撮る。
// 以前ここは html2canvas で作っていて、**重なりとぼかしを描けなかった**ため
// 確認ダイアログの1枚だけ撮れていなかった。本物のブラウザで撮れば出る。
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE = process.env.SAFE === '1';
const TOP = 59, BOTTOM = 34;                   // iPhone 15 Pro の safe area（pt）
const OUT = join(here, '..', '..', 'store-assets', SAFE ? 'sukuji' : 'screenshots-6.9');
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
// SAFE のときは safe area のぶん低い画面で撮り、あとで上下に地を足して 932 に戻す
const ctx = await browser.newContext({ viewport: { width: 430, height: SAFE ? 932 - TOP - BOTTOM : 932 }, deviceScaleFactor: 3 });
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
  if (!SAFE) { await page.screenshot({ path: join(OUT, `${name}.png`) }); log.push(`撮影 ${name}`); return; }
  // 上下に地を足す。色は画面の一番上の行と一番下の行から取る（ダイアログの暗い幕もそのまま続く）
  const buf = await page.screenshot();
  const meta = await sharp(buf).metadata();
  // 行をそのまま伸ばすと、一覧の途中で切れた行が縞になる。行の平均の色で塗る
  const band = async (row, h) => { const { data, info } = await sharp(buf).extract({ left: 0, top: row, width: meta.width, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    const c = [0, 1, 2].map((i) => { let t = 0; for (let x = 0; x < info.width; x++) t += data[x * info.channels + i]; return Math.round(t / info.width); });
    return sharp({ create: { width: meta.width, height: h, channels: 3, background: { r: c[0], g: c[1], b: c[2] } } }).png().toBuffer(); };
  const top = await band(0, TOP * 3), bottom = await band(meta.height - 1, BOTTOM * 3);
  await sharp({ create: { width: meta.width, height: 932 * 3, channels: 3, background: '#F6F7F9' } })
    .composite([{ input: top, top: 0, left: 0 }, { input: buf, top: TOP * 3, left: 0 }, { input: bottom, top: (932 - BOTTOM) * 3, left: 0 }])
    .png().toFile(join(OUT, `${name}.png`));
  log.push(`撮影 ${name}（枠用）`);
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
// 行の文言は「9月のまとめカード」のように月が入る。完全一致で待つと、月が変わった
// 瞬間に止まる（実際ここで一度止まった）。末尾だけで拾う。
await page.getByText(/のまとめカード$/).first().click();
await page.waitForTimeout(900);
await shot('ss-5b-summary-card');                            // シェア用カード

// ---------- 6. 確認ダイアログ ----------
// このアプリ一番の見せ場。見出しは種類で変わる：
//   バイト → このシフト、どうなりました？ ／ 遊び → 約束、決まった？
// 説明文が「どうなりました？」と書いているので、バイト版を本命にする。
await boot();
// 「バイト」の帯は月内に複数ある。未確定は破線なので、枠線の種類で選び分ける
// （文字は span、破線は親の帯に付いている）。
const dashed = await page.evaluate(() => {
  for (const sp of document.querySelectorAll('span')) {
    if (sp.textContent.trim() !== 'バイト' || sp.children.length) continue;
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
if (!dashed) throw new Error('未確定（破線）のバイトが月表示に見つからない');
await tapCellUnder(dashed);
const shiftRow = await rectOf(page.getByText(/バイト/).last());
if (!shiftRow) throw new Error('その日の一覧にバイトの行が無い');
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
