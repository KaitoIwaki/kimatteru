// 実績の画面を、場合ごとに並べて撮る。出るのは store-assets/jisseki-now.png。
//
// 直したものを目で確かめるための道具。中身は本物のアプリで、絵ではない。
// 状態は React の実体を掴んで setState で入れる（このアプリは window に
// 自分を出していないので、DOM の fiber から辿る）。
//
// 使い方（2つのターミナルで）
//   npm --prefix app run build && npm --prefix app run preview
//   npm i --no-save playwright && npx playwright install chromium
//   node app/tools/shot-jisseki.mjs [URL]
//
// playwright は package.json に入れない。postinstall がブラウザ本体（150MB ほど）を
// 落としに行くので、常設すると Codemagic のビルドが重くなる。撮るときだけ入れる。
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

const E = (o) => ({ y: 2026, m: 8, remindMin: null, ...o });
// 2行目の出方が変わる4通り。どれも本物の計算を通す
const CASES = [
  { name: '休憩あり・希望より長い', dark: false,
    ev: E({ id: 'a', day: 5, title: 'マクド', type: 'baito', status: 'jisseki', start: '17:00', end: '00:00', actualEnd: '00:35', want: ['17:00', '00:00'], breakMin: 60, place: 'マクドナルド 駅前店' }) },
  { name: '休憩だけ', dark: false,
    ev: E({ id: 'b', day: 8, title: 'マクド', type: 'baito', status: 'jisseki', start: '17:00', end: '22:00', breakMin: 45 }) },
  { name: '差だけ（みじかい）', dark: false,
    ev: E({ id: 'c', day: 11, title: 'マクド', type: 'baito', status: 'jisseki', start: '17:00', end: '22:00', actualEnd: '21:20' }) },
  { name: 'どちらも無い', dark: false,
    ev: E({ id: 'd', day: 14, title: 'マクド', type: 'baito', status: 'jisseki', start: '17:00', end: '22:00' }) },
  { name: '暗い方', dark: true,
    ev: E({ id: 'e', day: 5, title: 'マクド', type: 'baito', status: 'jisseki', start: '17:00', end: '00:00', actualEnd: '00:35', want: ['17:00', '00:00'], breakMin: 60, place: 'マクドナルド 駅前店' }) },
  { name: '「···」を開く', dark: false, menu: true,
    ev: E({ id: 'f', day: 5, title: 'マクド', type: 'baito', status: 'jisseki', start: '17:00', end: '00:00', actualEnd: '00:35', want: ['17:00', '00:00'], breakMin: 60 }) },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3 });
await page.goto(BASE, { waitUntil: 'networkidle' });

// React の実体を掴む。このアプリは自分を window に出していない
await page.evaluate(() => {
  const el = document.getElementById('root').firstElementChild;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
  let f = el[key];
  while (f && !(f.stateNode && f.stateNode.setState && f.stateNode.state)) f = f.return;
  window.__app = f.stateNode;
});

const shots = [];
for (const c of CASES) {
  await page.evaluate((c) => new Promise((r) => window.__app.setState((s) => ({
    events: [c.ev], settings: { ...s.settings, dark: c.dark, onboarded: true, hourly: 1120 },
    screen: 'detail', detailId: c.ev.id, detailMenu: !!c.menu, returnTo: 'month',
  }), () => setTimeout(r, 320))), c);
  shots.push({ name: c.name, buf: await page.screenshot({ clip: { x: 0, y: 0, width: 375, height: 560 } }) });
  console.log('撮った', c.name);
}
await browser.close();

// 並べる
const SC = 0.62, PAD = 18, GAP = 18, LABEL = 24, COLN = 3;
const cw = Math.round(375 * 3 * SC), ch = Math.round(560 * 3 * SC);
const rowH = LABEL + ch + 14;
const comp = [];
for (let i = 0; i < shots.length; i++) {
  const left = PAD + (i % COLN) * (cw + GAP), top = PAD + Math.floor(i / COLN) * rowH;
  comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="15" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${shots[i].name}</text></svg>`), top, left });
  comp.push({ input: await sharp(shots[i].buf).resize(cw).png().toBuffer(), top: top + LABEL, left });
}
const rows = Math.ceil(shots.length / COLN);
await sharp({ create: { width: PAD * 2 + COLN * cw + (COLN - 1) * GAP, height: PAD * 2 + rows * rowH, channels: 3, background: '#C9CDD4' } })
  .composite(comp).png().toFile(join(OUT, 'jisseki-now.png'));
console.log('できた store-assets/jisseki-now.png');
