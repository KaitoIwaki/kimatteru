// まとめの画面を、場合ごとに並べて撮る。出るのは store-assets/report-now.png。
//
// 直したものを目で確かめるための道具。中身は本物のアプリで、絵ではない。
// 状態は React の実体を掴んで setState で入れる（shot-jisseki.mjs と同じ）。
//
// 使い方（2つのターミナルで）
//   npm --prefix app run build && npm --prefix app run preview
//   npm i --no-save playwright && npx playwright install chromium
//   node app/tools/shot-report.mjs [URL]
//
// playwright は package.json に入れない（postinstall がブラウザ本体を落としに行く）。
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'store-assets');
const BASE = (process.argv[2] || 'http://127.0.0.1:4173/').replace(/\/$/, '');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
mkdirSync(OUT, { recursive: true });

let n = 0;
const E = (o) => ({ id: 'e' + (n++), y: 2026, m: 8, remindMin: null, ...o });

// バイトも遊びも用事もある人。掛け持ち
const JOBS = [{ id: 'j1', name: 'マクド', hourly: 1120 }, { id: 'j2', name: 'カフェ', hourly: 1050 }];
const MIXED = [
  E({ day: 1, type: 'baito', title: 'バイト', jobId: 'j1', start: '17:00', end: '22:00', status: 'jisseki', actualEnd: '22:30' }),
  E({ day: 3, type: 'baito', title: 'バイト', jobId: 'j1', start: '17:00', end: '21:00', status: 'jisseki' }),
  E({ day: 6, type: 'baito', title: 'バイト', jobId: 'j2', start: '10:00', end: '15:00', status: 'jisseki', breakMin: 30 }),
  E({ day: 14, type: 'baito', title: 'バイト', jobId: 'j1', start: '17:00', end: '22:00', status: 'jisseki' }),
  E({ day: 20, type: 'baito', title: 'バイト', jobId: 'j2', start: '12:00', end: '17:00', status: 'kakutei' }),
  E({ day: 4, type: 'asobi', title: '映画', start: '19:00', end: '22:00', status: 'kakutei' }),
  E({ day: 11, type: 'asobi', title: 'BBQ', start: '12:00', end: '17:00', status: 'kakutei' }),
  E({ day: 18, type: 'asobi', title: '映画', start: '18:00', end: '21:00', status: 'kakutei' }),
  E({ day: 26, type: 'asobi', title: '花火大会', start: '18:00', end: '22:00', status: 'mikakutei' }),   // 数えない
  E({ day: 13, type: 'yoji', title: '歯医者', start: '18:00', end: '19:00', status: 'kakutei' }),
  E({ day: 27, type: 'yoji', title: '区役所', start: '13:00', end: '14:00', status: 'kakutei' }),
  E({ day: 8, type: 'baito', title: '倉庫バイト', start: '09:00', end: '17:00', status: 'nakunatta' }),   // 数えない
  // 前の月にも少し（棒と年の合計のため）
  E({ m: 7, day: 5, type: 'baito', title: 'バイト', jobId: 'j1', start: '17:00', end: '22:00', status: 'jisseki' }),
  E({ m: 7, day: 12, type: 'asobi', title: '海', start: '09:00', end: '18:00', status: 'kakutei' }),
  E({ m: 6, day: 20, type: 'asobi', title: '映画', start: '19:00', end: '22:00', status: 'kakutei' }),
];

// バイトをしていない人。用事と遊びと、くり返しの予定（ジム・塾）
const NOBAITO = [
  ...[2, 5, 9, 12, 16, 19, 23, 26].map((d) => E({ day: d, type: 'yoji', title: '塾', start: '18:00', end: '21:00', status: 'kakutei' })),
  ...[3, 10, 17, 24].map((d) => E({ day: d, type: 'yoji', title: 'ジム', start: '07:00', end: '08:30', status: 'kakutei' })),
  E({ day: 13, type: 'yoji', title: '歯医者', start: '18:00', end: '19:00', status: 'kakutei' }),
  E({ day: 4, type: 'asobi', title: '映画', start: '19:00', end: '22:00', status: 'kakutei' }),
  E({ day: 11, type: 'asobi', title: 'BBQ', start: '12:00', end: '17:00', status: 'kakutei' }),
  E({ day: 20, type: 'asobi', title: '友達とごはん', start: '18:00', end: '21:00', status: 'kakutei' }),
  E({ day: 27, type: 'asobi', title: 'ライブ', start: '17:00', end: '21:00', status: 'mikakutei' }),   // 数えない
  E({ day: 21, type: 'asobi', title: '旅行', start: '09:00', end: '18:00', status: 'kakutei', allDay: true, days: 2 }),   // 終日は日で
  E({ m: 7, day: 8, type: 'yoji', title: '塾', start: '18:00', end: '21:00', status: 'kakutei' }),
  E({ m: 7, day: 15, type: 'asobi', title: '海', start: '09:00', end: '18:00', status: 'kakutei' }),
];

const CASES = [
  { name: 'バイトあり・月', dark: false, events: MIXED, jobs: JOBS, tab: 'month', tall: true },
  { name: 'バイトあり・年', dark: false, events: MIXED, jobs: JOBS, tab: 'year', tall: true },
  { name: 'バイトなし・月', dark: false, events: NOBAITO, jobs: [], tab: 'month', tall: true },
  { name: 'バイトなし・年', dark: false, events: NOBAITO, jobs: [], tab: 'year', tall: true },
  { name: 'バイトなし・月・暗い方', dark: true, events: NOBAITO, jobs: [], tab: 'month' },
  { name: '何も無い', dark: false, events: [], jobs: [], tab: 'month' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3 });
const grab = async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const el = document.getElementById('root').firstElementChild;
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
    let f = el[key];
    while (f && !(f.stateNode && f.stateNode.setState && f.stateNode.state)) f = f.return;
    window.__app = f.stateNode;
  });
};
await grab();

const shots = [];
for (const c of CASES) {
  await page.evaluate((c) => new Promise((r) => window.__app.setState((s) => ({
    events: c.events, jobs: c.jobs, ym: { y: 2026, m: 8 },
    settings: { ...s.settings, dark: c.dark, onboarded: true, hourly: 1120 },
    screen: 'report', priorOpen: false, repTab: c.tab || 'month',
  }), () => setTimeout(r, 350))), c);
  if (c.tall) {
    // 画面の中身を全部。スクロールする箱を開いて、その高さで撮る
    const h = await page.evaluate(() => {
      const box = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight);
      if (!box) return 812;
      const need = box.scrollHeight + (box.getBoundingClientRect().top | 0) + 20;
      box.style.overflow = 'visible';
      let el = box;
      while (el && el !== document.body) { el.style.height = 'auto'; el.style.minHeight = '0'; el = el.parentElement; }
      return Math.min(2800, need);
    });
    await page.setViewportSize({ width: 375, height: h });
    await page.waitForTimeout(200);
    shots.push({ name: c.name, buf: await page.screenshot({ clip: { x: 0, y: 0, width: 375, height: h } }) });
    await page.setViewportSize({ width: 375, height: 812 });
    await grab();   // 触った style を捨てる
  } else {
    shots.push({ name: c.name, buf: await page.screenshot({ clip: { x: 0, y: 0, width: 375, height: 812 } }) });
  }
  console.log('撮った', c.name);
}
await browser.close();

// 横に並べる。高さはそれぞれ
const SC = 0.5, PAD = 18, GAP = 18, LABEL = 24;
const cw = Math.round(375 * 3 * SC);
const comp = [];
let left = PAD, maxH = 0;
for (const sh of shots) {
  const meta = await sharp(sh.buf).metadata();
  const ch = Math.round(meta.height * (cw / meta.width));
  comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="15" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${sh.name}</text></svg>`), top: PAD, left });
  comp.push({ input: await sharp(sh.buf).resize(cw).png().toBuffer(), top: PAD + LABEL, left });
  left += cw + GAP;
  maxH = Math.max(maxH, ch);
}
await sharp({ create: { width: left - GAP + PAD, height: PAD * 2 + LABEL + maxH, channels: 3, background: '#C9CDD4' } })
  .composite(comp).png().toFile(join(OUT, 'report-now.png'));
console.log('できた store-assets/report-now.png');
