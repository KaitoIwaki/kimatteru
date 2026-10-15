// 正解表（golden）：空いてる日をシェア（share 画面）と、まとめカード（月／年）。
// 画面に出す中身・押したときの動き・文字でコピー・画像のファイル名に加えて、
// sharecard.js がキャンバスに描く手順（字・位置・色・線）を、記録するだけのキャンバスで取る。
// 字の幅は本物のフォントでは測れないので、両方で同じ決まった式（UTF-16 の長さ × 字の大きさ × 0.55）で測る。
//
// 実行：node gen-share.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 24680;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const J = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

const RealDate = Date;
let NOW = 0;
class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = FakeDate;
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};

// ---- 記録するだけのキャンバス ----
let canvases = [];
let anchors = [];
const fakeWidth = (t, font) => {
  const m = /([\d.]+)px/.exec(font);
  return String(t).length * (m ? parseFloat(m[1]) : 10) * 0.55;
};
function mockCanvas() {
  const ops = [];
  let path = [];
  const st = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, font: '400 10px x', textAlign: 'left', textBaseline: 'alphabetic', dash: [] };
  const fontKey = () => st.font.replace(/ "Hiragino.*$/, '');
  const fill = () => (typeof st.fillStyle === 'string' ? st.fillStyle : st.fillStyle.id);
  const ctx = {
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get font() { return st.font; }, set font(v) { st.font = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v === 'start' ? 'left' : v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    measureText: (t) => ({ width: fakeWidth(t, st.font) }),
    fillText: (t, x, y) => ops.push(['text', String(t), x, y, fontKey(), fill(), st.textAlign, st.textBaseline]),
    fillRect: (x, y, w, h) => ops.push(['rect', x, y, w, h, fill()]),
    beginPath: () => { path = []; },
    moveTo: (x, y) => path.push(['M', x, y]),
    arcTo: (x1, y1, x2, y2, r) => path.push(['A', x1, y1, x2, y2, r]),
    arc: (x, y, r, a0, a1) => path.push(['C', x, y, r, a0, a1]),
    closePath: () => path.push(['Z']),
    fill: () => ops.push(['fill', path.slice(), fill()]),
    stroke: () => ops.push(['stroke', path.slice(), st.strokeStyle, st.lineWidth, st.dash.slice()]),
    setLineDash: (d) => { st.dash = d.slice(); },
    createLinearGradient: (x0, y0, x1, y1) => {
      const g = { stops: [], id: '' };
      g.addColorStop = (o, c) => { g.stops.push(o + ' ' + c); g.id = `linear(${x0},${y0},${x1},${y1}|${g.stops.join('|')})`; };
      return g;
    },
  };
  const c = { width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,', ops };
  canvases.push(c);
  return c;
}
const origCreate = document.createElement;
document.createElement = (tag) => {
  if (tag === 'canvas') return mockCanvas();
  if (tag === 'a') { const a = { click() {}, remove() {}, style: {} }; anchors.push(a); return a; }
  return origCreate(tag);
};
let copied = null;
try { Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: async (t) => { copied = t; } }, configurable: true }); }
catch (e) { globalThis.navigator = { userAgent: 'node', clipboard: { writeText: async (t) => { copied = t; } } }; }

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '30', '15']);
const cardOf = (c) => ({ w: c.width, h: c.height, ops: c.ops });
const NAMES = ['', '山田', '  佐藤  ', 'とても長い名前の人ですよ十六字を超える名前', '😀絵文字の名前さん123456789', 'Tanaka'];

// ---- 空いてる日をシェア ----
const shareCases = [];
for (let k = 0; k < 110; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const types = J(mkApp({}).state.types);
  if (rnd() < 0.4) types.push({ key: 'off', name: '休み', color: '#5FA8A2', paper: 'rgba(192,224,221,.72)', dark: 'rgb(48,84,81)', free: true });
  const fY = today.y, fm = (today.m + pick([0, 0, 1, -1]) + 12) % 12;
  const fYY = today.m === 11 && fm === 0 ? fY + 1 : today.m === 0 && fm === 11 ? fY - 1 : fY;
  const events = [];
  for (let i = 0; i < pick([0, 5, 15, 30]); i++) {
    const base = H.AppMod.dayNo(today.y, today.m, today.d) + int(-10, 40);
    const o = H.AppMod.fromDayNo(base);
    const e = { id: 'e' + i, type: pick(['yoji', 'baito', 'asobi', 'off']), title: pick(['定例', 'カフェ', '飲み会']), y: o.y, m: o.m, day: o.d,
      start: HH(), end: HH(), status: pick(['kakutei', 'kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: i };
    if (rnd() < 0.2) { e.allDay = true; if (rnd() < 0.4) e.days = int(2, 3); }
    events.push(e);
  }
  const overrides = {};
  for (let i = 0; i < pick([0, 3, 6]); i++) {
    const o = H.AppMod.fromDayNo(H.AppMod.dayNo(today.y, today.m, today.d) + int(-5, 30));
    overrides[`${o.y}-${o.m}-${o.d}`] = pick(['○', '△', '×']);
  }
  const settings = { ...mkApp({}).state.settings, onboarded: true, weekStart: pick([0, 1]), profile: pick(['student', 'work', 'shift', undefined]),
    freeWd: pick([undefined, [1140, 1380], [540, 1320], [600, 1260]]), freeHd: pick([undefined, [600, 1320], [570, 1290]]), workHours: pick([null, { days: [1, 2, 3, 4, 5], from: 540, to: 1080 }]),
    firstUseAt: pick([undefined, NOW - 30 * 86400000, NOW - 86400000]), lastReviewAsk: pick([undefined, NOW - 90 * 86400000, NOW - 86400000]) };
  const shareOpt = rnd() < 0.3 ? undefined : J({ range: pick([undefined, 'week', 'next', '2w', 'month']), only: pick([undefined, 'all', 'wd', 'hd']),
    polite: pick([undefined, true, false]), name: pick([undefined, ...NAMES]), sign: pick([undefined, true, false]) });
  const st0 = { events, types, overrides, settings, freeYM: { y: fYY, m: fm }, ym: { y: today.y, m: today.m }, today, screen: 'share', cardFrom: 'free', shareOpt, shareToast: rnd() < 0.2, shareMsg: pick(['', 'コピーしました']) };
  const app = mkApp(J(st0));
  const { v } = app.renderVals();
  const sel = (c) => c.style.background === '#fff';
  const out = {
    weekdays: v.shareWeekdays.map((w) => w.label), monthLabel: v.shareMonthLabel, lead: v.shareLead, title: v.shareTitle, legend: v.shareLegend,
    cells: v.shareCells.map((c, i) => ({ label: c.label, note: c.note || '', level: app.freeCells(fYY, fm)[i].level })),
    range: v.shareRangeChips.map((c) => [c.label, sel(c)]), only: v.shareOnlyChips.map((c) => [c.label, sel(c)]), tone: v.shareToneChips.map((c) => [c.label, sel(c)]),
    name: v.shareName, text: v.shareText, sign: v.shareSign, toast: v.shareToast, toastMsg: v.shareToastMsg,
  };
  // 押す：範囲・平日休日・言い回し・署名・名前
  const ops = [];
  for (let n = 0; n < 3; n++) {
    const vv = app.renderVals().v;
    const r = rnd();
    if (r < 0.2) { const i = int(0, 3); vv.shareRangeChips[i].onClick(); ops.push(['range', i]); }
    else if (r < 0.4) { const i = int(0, 2); vv.shareOnlyChips[i].onClick(); ops.push(['only', i]); }
    else if (r < 0.6) { const i = int(0, 1); vv.shareToneChips[i].onClick(); ops.push(['tone', i]); }
    else if (r < 0.75) { vv.onToggleShareSign(); ops.push(['sign']); }
    else { const s = pick(NAMES); vv.onShareName({ target: { value: s } }); ops.push(['name', s]); }
  }
  const afterOpt = J(app.state.shareOpt);
  const afterText = app.renderVals().v.shareText;
  // 画像で送る（記録するだけのキャンバスに描かせる）
  canvases = []; anchors = [];
  const before0 = app.state.settings.lastReviewAsk;
  await app._shareCard('free');
  const askedCard = app.state.settings.lastReviewAsk !== before0;
  const card = cardOf(canvases[canvases.length - 1]);
  const file = anchors.length ? anchors[anchors.length - 1].download : null;
  // 文字でコピー
  copied = null;
  app.state = { ...app.state, settings: { ...app.state.settings, lastReviewAsk: before0 } };
  const before = app.state.settings.lastReviewAsk;
  await app.renderVals().v.onCopyFreeText();
  const copy = { text: copied, msg: app.state.shareMsg, toast: app.state.shareToast, asked: app.state.settings.lastReviewAsk !== before };
  shareCases.push({ now: NOW, state: J(st0), out, ops, afterOpt, afterText, card, file, askedCard, copy });
}
fs.writeFileSync(path.join(OUT, 'share.json'), JSON.stringify(shareCases));
console.log('share', shareCases.length, shareCases.reduce((a, c) => a + c.card.ops.length, 0), 'draw ops');

// ---- まとめカード（月／年） ----
const LONG = 'とても長い名前のバイト先でカードの幅に収まりきらないはずの名前です本当に長いですね';
const cardCases = [];
for (let k = 0; k < 90; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const types = J(mkApp({}).state.types);
  if (rnd() < 0.3) types[pick([0, 1, 2, 3])].color = pick(['#7FAE85', '#C77D8E', '#123456']);
  const jobs = [];
  const nj = pick([0, 1, 2, 3, 4]);
  for (let i = 0; i < nj; i++) jobs.push({ id: 'j' + i, name: pick(['カフェ', '塾', '', LONG, 'コンビニ']), hourly: pick([1100, 1250, 0, 1500.5]) });
  const events = [];
  for (let i = 0; i < pick([0, 3, 15, 40]); i++) {
    const e = { id: 'e' + i, type: pick(['baito', 'baito', 'yoji', 'work']), title: pick(['カフェ', 'シフト', '']), y: today.y + pick([0, 0, 0, -1]), m: int(0, 11), day: int(1, 28),
      start: HH(), end: HH(), status: pick(['jisseki', 'jisseki', 'kakutei', 'mikakutei']), updatedAt: i };
    if (e.type === 'baito') e.jobId = pick([...jobs.map((j) => j.id), undefined, 'gone']);
    if (rnd() < 0.4) { e.actualEnd = HH(); e.breakMin = pick([0, 30, 60]); }
    if (rnd() < 0.3) e.hourly = pick([1000, 1300]);
    if (rnd() < 0.1) e.noReport = true;
    if (rnd() < 0.1) e.jobName = pick(['前の店', LONG]);
    if (rnd() < 0.05) e.allDay = true;
    events.push(e);
  }
  const settings = { ...mkApp({}).state.settings, onboarded: true, hourly: pick([1120, 1000]), priorWage: rnd() < 0.4 ? { [today.y]: pick([50000, 1234567, 99999999]) } : {}, profile: pick(['student', 'work']) };
  const kind = pick(['month', 'year']);
  const st0 = { events, types, jobs, settings, today, ym: { y: today.y, m: int(0, 11) }, screen: 'summary', cardKind: kind, cardFrom: 'report', shareToast: false };
  const app = mkApp(J(st0));
  const { v } = app.renderVals();
  canvases = []; anchors = [];
  await app._shareCard(kind === 'year' ? 'year' : 'summary');
  const card = cardOf(canvases[canvases.length - 1]);
  const file = anchors.length ? anchors[anchors.length - 1].download : null;
  cardCases.push({ now: NOW, state: J(st0), title: v.cardTitle, card, file, toast: app.state.shareToast, msg: app.state.shareMsg });
}
fs.writeFileSync(path.join(OUT, 'share-cards.json'), JSON.stringify(cardCases));
console.log('share-cards', cardCases.length, cardCases.reduce((a, c) => a + c.card.ops.length, 0), 'draw ops');
