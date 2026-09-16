// ボトムナビのガラスを、色の濃いピルの上で撮って測る。出るのは store-assets/glass-<tag>.png。
//
//   node app/tools/shot-glass.mjs before   ← 直す前
//   node app/tools/shot-glass.mjs after    ← 直したあと
//   node app/tools/shot-glass.mjs compose  ← 2枚を並べて store-assets/glass.png
//
// 測り方：ナビの字を透明にして撮り、字があった場所の地の色を拾う。
// 字の色との差がいちばん小さい画素を「最悪」として出す。
import { chromium } from 'playwright';
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'store-assets');
const BASE = 'http://127.0.0.1:4173/';
const tag = process.argv[2] || 'after';
const F = "'Hiragino Sans','Yu Gothic',sans-serif";

const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const l1 = lum(...a), l2 = lum(...b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const parseRgb = (t) => t.match(/[\d.]+/g).slice(0, 3).map(Number);

if (tag === 'compose') {
  const a = join(OUT, 'glass-before.png'), b = join(OUT, 'glass-after.png');
  if (!existsSync(a) || !existsSync(b)) { console.log('before と after の両方が要る'); process.exit(1); }
  const ma = await sharp(a).metadata(), mb = await sharp(b).metadata();
  const label = (t, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="26"><text x="0" y="17" font-family="${F}" font-size="14" font-weight="700" fill="#1E2024">${t}</text></svg>`);
  await sharp({ create: { width: 18 * 3 + ma.width + mb.width, height: 18 * 2 + 26 + Math.max(ma.height, mb.height), channels: 3, background: '#C9CDD4' } })
    .composite([
      { input: label('直す前', ma.width), top: 18, left: 18 },
      { input: a, top: 18 + 26, left: 18 },
      { input: label('ガラス', mb.width), top: 18, left: 36 + ma.width },
      { input: b, top: 18 + 26, left: 36 + ma.width },
    ]).png().toFile(join(OUT, 'glass.png'));
  console.log('できた store-assets/glass.png');
  process.exit(0);
}

let n = 0;
const E = (o) => ({ id: 'g' + (n++), y: 2026, m: 8, remindMin: null, ...o });
// 空き状況の一覧は日ごとの行がナビの下まで流れる。8〜24日にピルを敷き詰めて、
// どの行がナビの後ろに来ても色がある状態にする
const EVENTS = [
  ...Array.from({ length: 17 }, (_, i) => 8 + i).map((d) => E({ day: d, type: ['baito', 'asobi', 'yoji'][d % 3], title: ['バイト', '映画', '歯医者'][d % 3], start: '17:00', end: '22:00', status: d % 4 === 0 ? 'mikakutei' : 'kakutei' })),
  E({ day: 27, type: 'baito', title: 'バイト', start: '17:00', end: '22:00', status: 'kakutei' }),
  E({ day: 27, type: 'asobi', title: '花火', start: '18:00', end: '21:00', status: 'kakutei' }),
  E({ day: 28, type: 'yoji', title: '歯医者', start: '10:00', end: '11:00', status: 'kakutei' }),
  E({ day: 28, type: 'asobi', title: 'BBQ', start: '12:00', end: '17:00', status: 'mikakutei' }),
  E({ day: 29, type: 'baito', title: 'バイト', start: '17:00', end: '22:00', status: 'jisseki' }),
  E({ day: 30, type: 'asobi', title: '映画', start: '19:00', end: '22:00', status: 'kakutei' }),
  E({ day: 30, type: 'yoji', title: '研修', start: '09:00', end: '18:00', status: 'kakutei' }),
  E({ day: 20, type: 'baito', title: 'バイト', start: '17:00', end: '22:00', status: 'kakutei' }),
  E({ day: 21, type: 'asobi', title: 'ライブ', start: '18:00', end: '22:00', status: 'mikakutei' }),
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3 });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const el = document.getElementById('root').firstElementChild;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
  let f = el[key];
  while (f && !(f.stateNode && f.stateNode.setState && f.stateNode.state)) f = f.return;
  window.__app = f.stateNode;
});

const CLIP = { x: 0, y: 812 - 150, width: 375, height: 150 };   // 下の 150pt だけ
const shots = [];
const rows = [];
for (const dark of [false, true]) {
  await page.evaluate(({ ev, dark }) => new Promise((r) => window.__app.setState((s) => ({
    events: ev, ym: { y: 2026, m: 8 }, screen: 'free',
    settings: { ...s.settings, dark, onboarded: true },
  }), () => setTimeout(r, 400))), { ev: EVENTS, dark });
  // 一覧を少し送って、ピルのある行をナビの後ろに置く
  await page.evaluate(() => {
    const box = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight);
    if (box) box.scrollTop = 300;
  });
  await page.waitForTimeout(300);
  shots.push(await page.screenshot({ clip: CLIP }));

  // 字の場所と色を控えてから、字を透明にして撮る
  const labels = await page.evaluate(() => {
    const bar = document.querySelector('.tabbar');
    return [...bar.querySelectorAll('span')].filter((sp) => /カレンダー|空き状況|まとめ|設定/.test(sp.textContent) && sp.children.length === 0)
      .map((sp) => { const r = sp.getBoundingClientRect(); const c = getComputedStyle(sp).color; sp.dataset.c = c; sp.style.opacity = '0'; return { t: sp.textContent, x: r.left, y: r.top, w: r.width, h: r.height, color: c }; });
  });
  const bare = await page.screenshot({ clip: CLIP });
  await page.evaluate(() => { document.querySelectorAll('.tabbar span').forEach((sp) => { sp.style.opacity = ''; }); });
  const { data, info } = await sharp(bare).raw().toBuffer({ resolveWithObject: true });
  for (const L of labels) {
    const ink = parseRgb(L.color);
    let worst = 99, worstPx = null, sum = [0, 0, 0], cnt = 0;
    for (let y = Math.floor(L.y - CLIP.y) * 3; y < Math.ceil(L.y - CLIP.y + L.h) * 3; y++) {
      for (let x = Math.floor(L.x) * 3; x < Math.ceil(L.x + L.w) * 3; x++) {
        const o = (y * info.width + x) * info.channels;
        const px = [data[o], data[o + 1], data[o + 2]];
        const r = ratio(ink, px);
        if (r < worst) { worst = r; worstPx = px; }
        sum[0] += px[0]; sum[1] += px[1]; sum[2] += px[2]; cnt++;
      }
    }
    const avg = sum.map((v) => Math.round(v / cnt));
    rows.push({ dark, t: L.t, ink: L.color, avg, worst: worst.toFixed(2), avgRatio: ratio(ink, avg).toFixed(2), worstPx });
  }
}
await browser.close();

console.log(`\n■ ${tag}  ナビの字と、その下の地（字を消して測った）`);
console.log('  ' + ['', '字', '字の色', '地（平均）', '差（平均）', '差（最悪の画素）'].map((s, i) => s.padEnd(i === 0 ? 6 : 14)).join(''));
for (const r of rows) {
  console.log('  ' + [r.dark ? '暗' : '明', r.t, r.ink.replace(/\s/g, ''), `rgb(${r.avg.join(',')})`, r.avgRatio, `${r.worst}  rgb(${r.worstPx.join(',')})`].map((s, i) => String(s).padEnd(i === 0 ? 6 : 14)).join(''));
}

// 明・暗を縦に並べて1枚に
const w = 375 * 3, h = 150 * 3;
await sharp({ create: { width: w, height: h * 2 + 12, channels: 3, background: '#C9CDD4' } })
  .composite([{ input: shots[0], top: 0, left: 0 }, { input: shots[1], top: h + 12, left: 0 }])
  .png().toFile(join(OUT, `glass-${tag}.png`));
console.log(`できた store-assets/glass-${tag}.png`);
