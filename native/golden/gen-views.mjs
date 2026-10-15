// 正解表（golden）その7：画面に出す中身（renderVals の結果のうち、見た目を決める値）。
// 月表示：週ごとの帯（何列目から何列・何段目・字・印・色）、「+N件」、日付の色、見出しの数。
//
// 実行：node gen-views.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 8675309;
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
const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '30', '15']);
const BAR_KEYS = ['background', 'color', 'border', 'borderLeft', 'borderRight', 'borderBottom', 'textDecoration', 'opacity', 'borderRadius', 'marginLeft', 'marginRight', 'height', 'lineHeight'];

const cases = [];
for (let k = 0; k < 120; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const types = J(mkApp({}).state.types);
  if (rnd() < 0.3) types.push({ key: 'off', name: '休み', color: '#5FA8A2', paper: 'rgba(192,224,221,.72)', dark: 'rgb(48,84,81)', free: true });
  if (rnd() < 0.3) types.push({ key: 'c1', name: 'ジム', color: pick(['#C77D8E', '#55555F', '#6FA8B8']), paper: 'p', dark: 'd' });
  const keys = types.map((t) => t.key).concat(['zzz']);
  const ym = { y: now.getFullYear(), m: (now.getMonth() + pick([0, 0, 0, 1, -1]) + 12) % 12 };
  const events = [];
  const n = pick([0, 3, 10, 25, 50]);
  for (let i = 0; i < n; i++) {
    const e = { id: 'e' + String(i).padStart(2, '0'), type: pick(keys), title: pick(['定例', '歯医者', 'とても長い名前の予定です', '飲み会', 'カフェ', '']), y: ym.y, m: (ym.m + pick([0, 0, 0, 0, 1, -1]) + 12) % 12, day: int(1, 31),
      start: HH(), end: HH(), status: pick(['kakutei', 'kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: i };
    if (e.m === 11 && ym.m === 0) e.y = ym.y - 1;
    if (e.m === 0 && ym.m === 11) e.y = ym.y + 1;
    if (rnd() < 0.2) { e.allDay = true; e.start = '00:00'; e.end = '23:59'; if (rnd() < 0.6) e.days = int(2, 9); }
    if (rnd() < 0.1) e.sym = pick(['早', '遅', '休']);
    if (e.type === 'baito' && rnd() < 0.5) e.jobId = 'j1';
    events.push(e);
  }
  const someday = [];
  for (let i = 0; i < pick([0, 0, 1, 3]); i++) someday.push({ id: 's' + i, title: pick(['旅行', '髪を切る']), when: pick(['week', 'month', 'next', 'someday']), y: ym.y, m: (ym.m + pick([0, -1])) % 12, day: 1 });
  const notices = [];
  for (let i = 0; i < pick([0, 1, 12]); i++) notices.push({ id: 'n' + i, kind: 'info', title: 't', body: 'b', at: i, read: rnd() < 0.3 });
  const settings = { ...mkApp({}).state.settings, onboarded: true, weekStart: pick([0, 1]), hideCanceled: rnd() < 0.3, barTime: rnd() < 0.4, kariMark: rnd() < 0.4,
    theme: pick([undefined, 'light', 'dark']), dark: rnd() < 0.2, hourly: 1100 };
  const jobs = rnd() < 0.5 ? [{ id: 'j1', name: 'カフェ', hourly: 1200, templates: rnd() < 0.5 ? [{ name: '早番', from: 540, to: 1020, sym: '早' }] : undefined }] : [];
  const app = mkApp({ events, types, someday, notices, settings, jobs, ym, today: { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }, wageOn: rnd() < 0.3, screen: 'month', stamp: null });
  const { v } = app.renderVals();
  const page = v.monthPages[1];
  const weeks = page.weeks.map((wk) => ({
    slots: wk.slots.map((s) => ({ day: s.day, blank: !!s.blank, color: s.numStyle.color, today: !!s.numStyle.background, todayBg: s.numStyle.background || null, bg: s.bgStyle.background, weight: s.numStyle.fontWeight })),
    bars: wk.bars.map((b) => { const o = { key: b.key, text: b.text, mark: b.mark, col: b.style.gridColumn, row: b.style.gridRow }; for (const kk of BAR_KEYS) if (b.style[kk] !== undefined) o[kk] = b.style[kk]; return o; }),
    more: wk.more.map((m) => ({ text: m.text, col: m.style.gridColumn, row: m.style.gridRow })),
  }));
  const head = { monthLabel: v.monthLabel, year: v.year, todayBtnShown: v.todayBtnShown, undecidedCount: v.undecidedCount, shelfCount: v.shelfCount, shelfLabel: v.shelfLabel,
    bellCount: v.bellCount, bellBadge: v.bellBadge, weekdays: v.weekdays.map((w) => [w.label, w.style.color]), stampChipShown: v.stampChipShown, wageToggleShown: v.wageToggleShown, calView: v.calView };
  cases.push({ now: NOW, state: J({ events, types, someday, notices, settings, jobs, ym, today: app.state.today, wageOn: app.state.wageOn, screen: 'month' }), weeks, head });
}
fs.writeFileSync(path.join(OUT, 'view-month.json'), JSON.stringify(cases));
console.log('view-month', cases.length, cases.reduce((a, c) => a + c.weeks.reduce((b, w) => b + w.bars.length, 0), 0), 'bars');

// ---- 日の画面：見出し・一覧の行・空き時間・日付の帯・時間の目盛りの箱 ----
const pickKeys = (o, ks) => { const r = {}; for (const k of ks) if (o && o[k] !== undefined) r[k] = o[k]; return r; };
const dayCases = [];
for (let k = 0; k < 150; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const types = J(mkApp({}).state.types);
  if (rnd() < 0.3) types.push({ key: 'off', name: '休み', color: '#5FA8A2', paper: 'rgba(192,224,221,.72)', dark: 'rgb(48,84,81)', free: true, gone: '通らなかった', uWord: '希望休', cWord: '休み' });
  const keys = types.map((t) => t.key).concat(['zzz']);
  const ym = { y: now.getFullYear(), m: now.getMonth() };
  const day = int(1, 28);
  const events = [];
  for (let i = 0; i < pick([0, 2, 6, 12]); i++) {
    const e = { id: 'e' + String(i).padStart(2, '0'), type: pick(keys), title: pick(['定例', '歯医者', 'とても長い名前の予定です', '飲み会', 'カフェ']), y: ym.y, m: ym.m, day: day + pick([0, 0, 0, -1, 1]),
      start: HH(), end: HH(), status: pick(['kakutei', 'kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: i };
    if (e.day < 1) e.day = 1;
    if (rnd() < 0.2) { e.allDay = true; e.start = '00:00'; e.end = '23:59'; if (rnd() < 0.5) e.days = int(2, 4); }
    if (e.status === 'jisseki' && rnd() < 0.5) e.actualEnd = HH();
    if (rnd() < 0.3) e.place = pick(['渋谷', '本社 5F']);
    if (rnd() < 0.2) e.link = 'https://zoom.us/j/1';
    events.push(e);
  }
  const settings = { ...mkApp({}).state.settings, onboarded: true, weekStart: pick([0, 1]), hideCanceled: rnd() < 0.3, theme: pick([undefined, 'dark']), dayView: pick(['list', 'time', undefined]), fontScale: pick([undefined, 1, 1.2]) };
  const app = mkApp({ events, types, settings, ym, today: { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }, screen: 'day', dayNum: day, swipeRow: null });
  const { v } = app.renderVals();
  const head = pickKeys(v, ['dayTitle', 'dayHoliday', 'dayBigDate', 'dayDowFull', 'dayDateColor', 'daySummary', 'dayEmpty', 'dayView']);
  head.dayTitleColor = v.dayTitleStyle.color;
  const rows = v.dayEvents.map((r) => ({ ...pickKeys(r, ['key', 'startText', 'endText', 'timeText', 'accent', 'dashed', 'titleText', 'titlePlain', 'place', 'statusWord', 'durText', 'gapBefore']),
    chip: pickKeys(r.chipStyle2, ['border', 'color', 'background']), cardBorder: r.cardStyle.border, titleColor: r.titleStyle.color, titleDeco: r.titleStyle.textDecoration,
    titleSize: r.titleStyle.fontSize, bar: r.dashed ? null : r.barStyle.background }));
  const dn = H.AppMod.dayNo(ym.y, ym.m, day);
  const strip = [];
  for (let n = dn - 9; n <= dn + 9; n++) strip.push(pickKeys(v.dayStripCell(n), ['key', 'dow', 'date', 'sel', 'today', 'has', 'monthHead', 'monthFull', 'dowColor', 'numColor']));
  let time = null;
  if (v.dayView === 'time') {
    const c = v.dayCols[0];
    time = { isToday: c.isToday, more: c.allDay.more,
      pills: c.allDay.pills.map((p) => ({ key: p.key, title: p.title, style: pickKeys(p.style, ['background', 'color', 'border', 'lineHeight', 'height', 'fontSize']) })),
      boxes: c.boxes.map((b) => ({ key: b.key, a: b.a, b: b.b, title: b.title, time: b.time,
        style: pickKeys(b.style, ['top', 'height', 'left', 'width', 'background', 'color', 'border', 'borderLeft', 'textDecoration', 'fontSize', 'lineHeight']) })) };
  }
  dayCases.push({ now: NOW, state: J({ events, types, settings, ym, today: app.state.today, screen: 'day', dayNum: day }), head, rows, strip, time });
}
fs.writeFileSync(path.join(OUT, 'view-day.json'), JSON.stringify(dayCases));
console.log('view-day', dayCases.length, dayCases.reduce((a, c) => a + c.rows.length, 0), 'rows', dayCases.filter((c) => c.time).length, 'time');

// ---- iPhone 標準の確認（_nativeAlertSpec）と、ボタンを押したあと ----
const alertCases = [];
const AK = ['events', 'trash', 'confirmDelete', 'deleteRest', 'confirmRestore', 'candAsk', 'confirmJob', 'jobs', 'discardAsk', 'repEditAsk', 'screen', 'undo', 'shareMsg', 'shareToast', 'gone', 'detailId', 'returnTo', 'dialog'];
const asnap = (app) => { const o = {}; for (const k of AK) o[k] = app.state[k]; return J(o); };
for (let k = 0; k < 160; k++) {
  NOW = new RealDate(2026, 9, int(1, 28), int(7, 22), int(0, 59)).getTime();
  const events = [];
  for (let i = 0; i < int(0, 6); i++) events.push({ id: 'e' + i, type: pick(['yoji', 'baito']), title: pick(['定例', '歯医者', '']), y: 2026, m: 9, day: int(1, 28), start: '10:00', end: '11:00', status: pick(['kakutei', 'mikakutei', 'jisseki']), jobId: pick([undefined, 'j1']), updatedAt: 1 });
  const rep = rnd() < 0.4;
  if (rep) for (let i = 0; i < int(1, 4); i++) events.push({ id: 'r' + i, type: 'yoji', title: 'ジム', y: 2026, m: 9, day: 3 + i * 7, start: '19:00', end: '20:00', status: 'kakutei', repId: 'R1', updatedAt: 1 });
  const jobs = rnd() < 0.6 ? [{ id: 'j1', name: pick(['カフェ', '']), hourly: 1100 }] : [];
  const st = { events, jobs, screen: pick(['month', 'new', 'detail']), returnTo: pick(['month', 'day', undefined]), settings: { ...mkApp({}).state.settings, onboarded: true, profile: pick(['student', 'work']) } };
  const kind = pick(['del', 'del', 'restore', 'cand', 'job', 'discard', 'rep']);
  if (kind === 'del') st.confirmDelete = events.length && rnd() < 0.9 ? pick(events).id : 'none';
  if (kind === 'restore') st.confirmRestore = { data: { events: [{ id: 'z', y: 2026, m: 0, day: 1, start: '10:00', end: '11:00', title: 'z', type: 'yoji', status: 'kakutei' }] }, count: int(1, 9), dropped: pick([0, 2]), at: pick([undefined, '2026-01-02T03:04:05.000Z', '2026-12-31T16:30:00.000Z']), merge: rnd() < 0.3 };
  if (kind === 'cand') st.candAsk = { title: '飲み会', ids: events.slice(0, int(1, 3)).map((e) => e.id) };
  if (kind === 'job') st.confirmJob = pick(['j1', 'jx']);
  if (kind === 'discard') { st.discardAsk = true; }
  if (kind === 'rep') { st.repEditAsk = { rest: int(1, 5) }; st.draft = { ...(events[0] || {}), editingId: events[0] ? events[0].id : null, title: '直した' }; }
  const app = mkApp(J(st));
  const { v } = app.renderVals();
  const spec = app._nativeAlertSpec(v);
  const out = { now: NOW, state: J(st), spec: spec ? J({ key: spec.key, title: spec.title, message: spec.message, sheet: !!spec.sheet, buttons: spec.buttons.map((b) => ({ label: b.label, style: b.style, preferred: !!b.preferred })) }) : null };
  if (spec && kind !== 'rep') { const bi = int(0, spec.buttons.length - 1); if (typeof spec.buttons[bi].run === 'function') { spec.buttons[bi].run(); out.pressed = bi; out.after = asnap(app); } else out.noRun = bi; }
  alertCases.push(out);
}
fs.writeFileSync(path.join(OUT, 'view-alert.json'), JSON.stringify(alertCases));
console.log('view-alert', alertCases.length, alertCases.filter((c) => c.spec).length, 'specs');

// ---- いつ空いてる？（空き状況）----
const freeCases = [];
for (let k = 0; k < 120; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const types = J(mkApp({}).state.types);
  if (rnd() < 0.4) types.push({ key: 'off', name: '休み', color: '#5FA8A2', paper: 'rgba(192,224,221,.72)', dark: 'rgb(48,84,81)', free: true });
  const fY = now.getFullYear(), fm = (now.getMonth() + pick([0, 1, -1]) + 12) % 12;
  const events = [];
  for (let i = 0; i < pick([0, 5, 15, 30]); i++) {
    const e = { id: 'e' + i, type: pick(['yoji', 'baito', 'asobi', 'off']), title: pick(['定例', 'カフェ', '飲み会']), y: fY, m: fm, day: int(1, 28),
      start: HH(), end: HH(), status: pick(['kakutei', 'kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: i };
    if (rnd() < 0.2) { e.allDay = true; if (rnd() < 0.4) e.days = int(2, 3); }
    events.push(e);
  }
  const overrides = {};
  for (let i = 0; i < pick([0, 3]); i++) overrides[`${fY}-${fm}-${int(1, 28)}`] = pick(['○', '△', '×']);
  const settings = { ...mkApp({}).state.settings, onboarded: true, weekStart: pick([0, 1]), theme: pick([undefined, 'dark']),
    freeWd: pick([undefined, [1140, 1380], [540, 1320]]), freeHd: pick([undefined, [600, 1320]]), workHours: pick([null, { days: [1, 2, 3, 4, 5], from: 540, to: 1080 }]) };
  const app = mkApp({ events, types, overrides, settings, freeYM: { y: fY, m: fm }, today: { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }, screen: 'free' });
  const { v } = app.renderVals();
  const rows = v.freeRows.map((r) => ({ day: r.day, dow: r.dow, dowColor: r.dowStyle.color, hol: r.hol, dayColor: r.dayStyle.color,
    tags: r.tags.map((t) => ({ text: t.text, time: t.time, style: pickKeys(t.style, ['background', 'color', 'border', 'textDecoration', 'opacity']) })),
    note: r.note, noteColor: r.noteStyle.color, mark: r.mark, markColor: r.markStyle.color, markBorder: r.markStyle.border || '', markBg: r.markStyle.background || '',
    manual: !!r.markStyle.boxShadow, dim: r.rowStyle.opacity === 0.5 }));
  freeCases.push({ now: NOW, state: J({ events, types, overrides, settings, freeYM: { y: fY, m: fm }, today: app.state.today }), monthLabel: v.freeMonthLabel, cO: v.cO, cA: v.cA, cX: v.cX, rows });
}
fs.writeFileSync(path.join(OUT, 'view-free.json'), JSON.stringify(freeCases));
console.log('view-free', freeCases.length);
