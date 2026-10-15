// 正解表（golden）：月のまわり（sw-month）。
// 週表示（WeekStrip の中身）・年月えらび・シフト入力のパレット・給料バー・はじめての案内・確定したときの帯（morph）・
// 日の画面の iPhone の予定の行、と、それらを押したあとの state。
//
// 実行：node gen-month-more.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 20261015;
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

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
const pickKeys = (o, ks) => { const r = {}; for (const k of ks) if (o && o[k] !== undefined) r[k] = o[k]; return r; };
const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '30', '15']);
const { dayNo, fromDayNo } = H.AppMod;

/** 見本の予定（今日のまわり ±40 日） */
function makeEvents(t, keys, n) {
  const events = [];
  const tN = dayNo(t.y, t.m, t.d);
  for (let i = 0; i < n; i++) {
    const o = fromDayNo(tN + int(-40, 40));
    const e = { id: 'e' + String(i).padStart(3, '0'), type: pick(keys), title: pick(['定例', '歯医者', 'とても長い名前の予定です', '飲み会', 'カフェ', '']), y: o.y, m: o.m, day: o.d,
      start: HH(), end: HH(), status: pick(['kakutei', 'kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: i };
    if (rnd() < 0.2) { e.allDay = true; e.start = '00:00'; e.end = '23:59'; if (rnd() < 0.5) e.days = int(2, 6); }
    if (e.status === 'jisseki' && rnd() < 0.5) e.actualEnd = HH();
    if (rnd() < 0.1) e.sym = pick(['早', '遅', '休']);
    if (e.type === 'baito' && rnd() < 0.6) e.jobId = 'j1';
    if (rnd() < 0.15) e.place = pick(['渋谷', '本社 5F']);
    events.push(e);
  }
  return events;
}
function makeOverlay(t) {
  const out = [];
  const tN = dayNo(t.y, t.m, t.d);
  for (let i = 0; i < int(0, 6); i++) {
    const o = fromDayNo(tN + int(-20, 20));
    const allDay = rnd() < 0.25;
    out.push({ y: o.y, m: o.m, day: o.d, start: allDay ? '00:00' : HH(), end: allDay ? '23:59' : HH(), allDay, ...(allDay && rnd() < 0.5 ? { days: int(2, 3) } : {}),
      id: 'ov-' + i, title: pick(['会議', '予定']), overlay: true, status: 'kakutei', type: '__overlay', place: pick(['', '会議室'] ) });
  }
  return out;
}
const baseTypes = () => {
  const types = J(mkApp({}).state.types);
  if (rnd() < 0.3) types.push({ key: 'off', name: '休み', color: '#5FA8A2', paper: 'rgba(192,224,221,.72)', dark: 'rgb(48,84,81)', free: true, gone: '通らなかった', uWord: '希望休', cWord: '休み' });
  return types;
};
const TPLS = [
  [{ name: '早番', from: 540, to: 1020, sym: '早' }, { name: '遅番', from: 1020, to: 1380, sym: '遅', brk: 30 }, { name: '', from: 0, to: 1439, sym: '休', allDay: true }],
  [{ id: 't1', name: '夜勤', from: 1320, to: 1860, sym: '夜' }],
  [{ name: '日勤', from: 600, to: 960 }],
];

// ---- 週表示 ----
const weekCases = [];
for (let k = 0; k < 90; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const t = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const types = baseTypes();
  const keys = types.map((x) => x.key).concat(['zzz']);
  const events = makeEvents(t, keys, pick([0, 5, 20, 60]));
  const settings = { ...mkApp({}).state.settings, onboarded: true, calView: 'week', weekStart: pick([0, 1]), hideCanceled: rnd() < 0.3,
    theme: pick([undefined, 'light', 'dark']), fontScale: pick([undefined, 1, 1.2, 1.4]), overlayOn: rnd() < 0.4 };
  const ym = pick([{ y: t.y, m: t.m }, { y: t.y, m: t.m }, (() => { const o = fromDayNo(dayNo(t.y, t.m, 1) + pick([-20, 40])); return { y: o.y, m: o.m }; })()]);
  const weekAnchor = rnd() < 0.35 ? dayNo(t.y, t.m, t.d) + int(-30, 30) : null;
  const overlay = makeOverlay(t);
  const app = mkApp({ events, types, settings, ym, today: t, weekAnchor, screen: 'month', jobs: [{ id: 'j1', name: 'カフェ', hourly: 1200 }] });
  app._overlay = overlay;
  const { v } = app.renderVals();
  const cols = v.weekCols.map((c) => ({
    key: c.key, dow: c.dow, date: c.date, isToday: c.isToday, hol: c.hol,
    dowColor: c.dowStyle.color, numColor: c.numStyle.color, numBg: c.numStyle.background || null,
    allDay: { more: c.allDay.more, pills: c.allDay.pills.map((p) => ({ key: p.key, title: p.title, style: pickKeys(p.style, ['background', 'color', 'border', 'lineHeight', 'height', 'fontSize']) })) },
    boxes: c.boxes.map((b) => ({ key: b.key, a: b.a, b: b.b, title: b.title, time: b.time,
      style: pickKeys(b.style, ['top', 'height', 'left', 'width', 'background', 'color', 'border', 'borderLeft', 'textDecoration', 'fontSize', 'lineHeight']) })),
  }));
  weekCases.push({ now: NOW, overlay, state: J({ events, types, settings, ym, today: t, weekAnchor, screen: 'month', jobs: app.state.jobs }),
    week: { base: v.weekBase, first: v.weekFirst, monthLabel: v.monthLabel, year: v.year, todayBtnShown: v.todayBtnShown, startTop: v.weekStartTop, cols } });
}
fs.writeFileSync(path.join(OUT, 'view-week.json'), JSON.stringify(weekCases));
console.log('view-week', weekCases.length, weekCases.reduce((a, c) => a + c.week.cols.reduce((b, x) => b + x.boxes.length, 0), 0), 'boxes');

// ---- 年月えらび・シフト入力・給料バー・はじめての案内・帯の morph・日の画面の iPhone の予定 ----
const moreCases = [];
for (let k = 0; k < 120; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const t = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const types = baseTypes();
  const keys = types.map((x) => x.key).concat(['zzz']);
  const events = makeEvents(t, keys, pick([0, 0, 8, 30]));
  const ym = pick([{ y: t.y, m: t.m }, { y: t.y + pick([-1, 1]), m: int(0, 11) }]);
  const settings = { ...mkApp({}).state.settings, onboarded: true, weekStart: pick([0, 1]), theme: pick([undefined, 'dark']), hintClosed: rnd() < 0.3, hourly: 1100, overlayOn: rnd() < 0.5,
    fontScale: pick([undefined, 1.2]), wageFeature: pick([undefined, 'on', 'off']) };
  const jobs = rnd() < 0.7 ? [{ id: 'j1', name: pick(['カフェ', '']), hourly: 1200, templates: pick(TPLS) }, ...(rnd() < 0.3 ? [{ id: 'j2', name: '塾', hourly: 1500, retired: rnd() < 0.5, templates: [{ name: '授業', from: 1080, to: 1260, sym: '授' }] }] : [])] : [];
  const st0 = { events, types, settings, jobs, ym, today: t, screen: 'month', wageOn: rnd() < 0.5, stamp: null };
  if (rnd() < 0.4) st0.ymSheet = { y: ym.y + pick([0, 0, 1, -2]), ...(rnd() < 0.5 ? { dir: pick([1, -1]) } : {}) };
  const tpls0 = mkApp(J(st0)).stampTemplates();
  if (tpls0.length && rnd() < 0.6) st0.stamp = { key: pick(tpls0).key, status: pick(['kakutei', 'mikakutei']) };
  const morphable = events.filter((e) => e.y === ym.y && e.m === ym.m && e.status !== 'nakunatta');
  if (morphable.length && rnd() < 0.5) st0.morph = { id: pick(morphable).id, phase: pick(['dash', 'fill', 'settle']) };
  const overlay = makeOverlay(t);
  const app = mkApp(J(st0));
  app._overlay = overlay;
  const { v } = app.renderVals();
  const out = { now: NOW, overlay, state: J(st0) };
  out.ymSheet = v.ymSheetShown ? { year: v.ymSheetYear, todayLabel: v.ymSheetTodayLabel,
    months: v.ymSheetMonths.map((m) => ({ label: m.label, sel: m.style.fontWeight === 700, isThis: m.style.border === '1px solid var(--ink-faint)' })),
    slide: v.ymSheetGridStyle.animation } : null;
  out.stamp = { chipShown: v.stampChipShown, on: v.stampOn,
    tpls: (v.stampTpls || []).map((x) => ({ key: x.key, label: x.label, sub: x.sub, sel: x.style.background === 'var(--ink)' })),
    seg: (v.stampSeg || []).map((x) => ({ label: x.label, sel: x.style.fontWeight === 700 })), monthLabel: v.stampMonthLabel || null };
  out.wage = { on: v.wageOn, total: v.monthTotal, unit: v.monthTotalParts.unit, num: v.monthTotalParts.num, label: v.monthLabel + '月の実績合計' };
  out.hint = v.showFirstRunHint;
  // 確定したときの帯（その月の週のうち、morph の帯だけ）
  out.morph = [];
  for (const wk of v.monthPages[1].weeks) for (const b of wk.bars) if (b.morphing) {
    out.morph.push({ key: b.key, text: b.text, mark: b.mark, background: b.style.background, border: b.style.border, fill: b.fillStyle.background,
      fillOn: b.fillStyle.transform === 'scaleX(1)', ink: b.textStyle.color, settle: b.style.animation !== 'none',
      borderLeft: b.style.borderLeft === undefined ? null : b.style.borderLeft, borderRight: b.style.borderRight === undefined ? null : b.style.borderRight });
  }
  // 日の画面：iPhone のカレンダーの予定の行
  const day = int(1, 28);
  const app2 = mkApp(J({ ...st0, screen: 'day', dayNum: day, ym: { y: t.y, m: t.m } }));
  app2._overlay = overlay;
  const v2 = app2.renderVals().v;
  out.day = day;
  out.dayOverlay = v2.dayOverlay.map((r) => pickKeys(r, ['key', 'title', 'place', 'time']));
  moreCases.push(out);
}
fs.writeFileSync(path.join(OUT, 'view-month-more.json'), JSON.stringify(moreCases));
console.log('view-month-more', moreCases.length, moreCases.filter((c) => c.ymSheet).length, 'ymSheet', moreCases.filter((c) => c.stamp.on).length, 'stamp', moreCases.reduce((a, c) => a + c.morph.length, 0), 'morph');

// ---- 押したあとの state ----
const SK = ['ym', 'weekAnchor', 'flashToday', 'ymSheet', 'stamp', 'dayNum', 'screen', 'calView', 'hintClosed', 'returnTo', 'dayFrom', 'wageOn', 'cardKind', 'cardFrom', 'shareToast'];
const snap = (app) => { const o = {}; for (const k of SK) o[k] = (k === 'calView' || k === 'hintClosed') ? app.state.settings[k] : app.state[k]; return J(o); };
const actCases = [];
for (let k = 0; k < 120; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const t = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const types = baseTypes();
  const keys = types.map((x) => x.key);
  const events = makeEvents(t, keys, pick([0, 6]));
  const settings = { ...mkApp({}).state.settings, onboarded: true, weekStart: pick([0, 1]), calView: pick(['month', 'week', undefined]), hintClosed: rnd() < 0.2 };
  const jobs = rnd() < 0.7 ? [{ id: 'j1', name: 'カフェ', hourly: 1200, templates: pick(TPLS) }] : [];
  const st0 = { events, types, settings, jobs, ym: { y: t.y, m: (t.m + pick([0, 0, 1, -1]) + 12) % 12 }, today: t, screen: 'month', weekAnchor: rnd() < 0.3 ? dayNo(t.y, t.m, t.d) + int(-20, 20) : null, wageOn: rnd() < 0.5, stamp: null };
  const app = mkApp(J(st0));
  const ops = [];
  const steps = [];
  for (let s = 0; s < int(3, 8); s++) {
    const { v } = app.renderVals();
    const choices = ['head', 'today', 'prev', 'next', 'seg', 'closeHint', 'stamp', 'wageBar'];
    if (v.calView === 'week') choices.push('settle', 'settle');
    if (v.ymSheetShown) choices.push('ymPrev', 'ymNext', 'ymPick', 'ymToday', 'ymSwipe', 'ymClose');
    if (v.stampOn) choices.push('stampPick', 'stampStatus', 'stampOff');
    const op = pick(choices);
    const o = { op };
    switch (op) {
      case 'head': v.onTapMonthHead(); break;
      case 'today': v.onGoToday(); break;
      case 'prev': v.onPrevMonth(); break;
      case 'next': v.onNextMonth(); break;
      case 'seg': { const i = int(0, 1); o.i = i; v.viewSeg[i].onClick(); break; }
      case 'closeHint': v.onCloseFirstRunHint(); break;
      case 'stamp': v.onToggleStamp(); break;
      case 'stampOff': v.onToggleStamp(); break;
      case 'wageBar': v.onOpenSummary(); break;
      case 'settle': { const n = v.weekFirst + int(-10, 10); o.n = n; v.onWeekSettle(n); break; }
      case 'ymPrev': v.onYmSheetPrevYear(); break;
      case 'ymNext': v.onYmSheetNextYear(); break;
      case 'ymPick': { const i = int(0, 11); o.i = i; v.ymSheetMonths[i].onClick(); break; }
      case 'ymToday': v.onYmSheetToday(); break;
      case 'ymSwipe': {
        const dx = pick([-120, -61, -59, 30, 59, 61, 140]), dy = pick([0, 10, 80]);
        o.dx = dx; o.dy = dy;
        v.onYmSheetTouchStart({ touches: [{ clientX: 200, clientY: 300 }] });
        v.onYmSheetTouchMove({ touches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
        v.onYmSheetTouchEnd({ changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
        break;
      }
      case 'ymClose': v.onYmSheetClose(); break;
      case 'stampPick': { const i = int(0, v.stampTpls.length - 1); o.i = i; v.stampTpls[i].onClick(); break; }
      case 'stampStatus': { const i = int(0, 1); o.i = i; v.stampSeg[i].onClick(); break; }
    }
    ops.push(o);
    steps.push(snap(app));
  }
  actCases.push({ now: NOW, state: J(st0), ops, steps });
}
fs.writeFileSync(path.join(OUT, 'actions-month.json'), JSON.stringify(actCases));
console.log('actions-month', actCases.length, actCases.reduce((a, c) => a + c.ops.length, 0), 'ops');
