// 正解表（golden）その9：予定の詳細と「どうなった？」の小窓。中身と、押したときの動き。
//
// 実行：node gen-detail.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 13579;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const J = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

const RealDate = Date;
let NOW = 0;
class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = FakeDate;
let timers = [];
globalThis.setTimeout = (fn, ms) => { timers.push(fn); return timers.length; };
globalThis.clearTimeout = () => {};
// 0 を返す（Web 版は「待ち中」の印に返り値を入れる。その場で動かすので、印は残さない）
globalThis.requestAnimationFrame = (f) => { f(); return 0; };

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
const pk = (o, ks) => { const r = {}; for (const k of ks) if (o[k] !== undefined) r[k] = o[k]; return r; };
const detailOf = (v) => v.dTitle === '' && !v.dDateText ? null : {
  title: v.dTitle, typeDark: v.dTypeDark, dateText: v.dDateText, holText: v.dHolText, movedText: v.dMovedText, statusLabel: v.dStatusLabel, badgeChar: v.badgeChar,
  badgeBg: v.badgeStyle.background, badgeColor: v.badgeStyle.color, badgeBorder: v.badgeStyle.border || '',
  timeText: v.dTimeText, spanText: v.dSpanText, remindText: v.dRemindText, place: v.dPlace, placeHref: v.dPlaceHref, memo: v.dMemo,
  memoParts: v.dMemoParts.map((p) => (p.href ? { t: p.t, href: p.href } : { t: p.t })), link: v.dLink, linkLabel: v.dLinkLabel,
  candText: v.dCandText, timeChanged: !!v.dTimeChanged, wantText: v.dWantText, wageShown: v.dWageShown,
  workHours: v.dWageShown ? v.dWorkHours : '', wage: v.dWageShown ? v.dWage : '', breakText: v.dWageShown ? v.dBreakText : '',
  primaryLabel: v.dPrimaryLabel, primaryBg: v.dPrimaryLabel ? v.dPrimaryStyle.background : '', primaryColor: v.dPrimaryLabel ? v.dPrimaryStyle.color : '',
  primaryBorder: v.dPrimaryLabel ? v.dPrimaryStyle.border : '',
  menuRows: v.menuRows.map((r) => ({ label: r.label, red: r.red })), othersLabel: v.dOthersLabel, othersRest: v.dOthersRest,
  others: v.dOthers.map((o) => ({ title: o.title, when: o.when, pill: pk(o.pillStyle, ['background', 'color', 'border', 'lineHeight']) })),
  histLabel: v.dHistLabel, hist: v.dHist,
};
const dialogOf = (v, st) => !st.dialog ? null : {
  heading: v.dlgHeading, goneLabel: v.dlgGoneLabel, maybeLabel: v.dlgMaybeLabel, sub: v.dlgSub, start: v.dlgStart, end: v.dlgEnd,
  changed: v.dlgChanged, origText: v.dlgOrigText, primaryLabel: v.dlgPrimaryLabel, primaryBg: v.dlgPrimaryStyle.background,
  paidText: v.dlgBreakShown ? v.dlgPaidText : '', breakChips: v.dlgBreakShown ? v.dlgBreakChips.map((c) => c.style.color === '#fff') : [],
  moveShown: v.dlgMoveShown, moving: v.dlgMoving, moveLabel: v.dlgMoving ? v.dlgMoveLabel : '', moveTitle: v.dlgMoving ? v.dlgMoveTitle : '',
  moveChosenText: v.dlgMoving ? v.dlgMoveChosenText : '',
  moveCells: v.dlgMoving ? v.dlgMoveCells.map((c) => (c.label === '' ? null : { day: c.label, color: c.style.color, bg: c.style.background, weight: c.style.fontWeight, orig: c.style.textDecoration === 'line-through' })) : [],
  editLabel: v.dlgEditLabel,
};
const KEYS = ['events', 'screen', 'returnTo', 'detailId', 'detailMenu', 'dialog', 'draft', 'confirmDelete', 'undo', 'shareMsg', 'shareToast', 'someday', 'ym', 'candAsk', 'settings', 'trash', 'today'];
const snap = (app) => { const o = {}; for (const k of KEYS) o[k] = app.state[k]; return J(o); };
const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '30']);

const cases = [];
for (let k = 0; k < 160; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const types = J(mkApp({}).state.types);
  if (rnd() < 0.3) types.push({ key: 'work', name: '仕事', color: '#6E85BE', paper: 'p', dark: 'd', uWord: '仮押さえ', cWord: '確定', ask: 'この仮押さえ、どうなった？', gone: '流れた' });
  const events = [];
  for (let i = 0; i < int(1, 14); i++) {
    const e = { id: 'e' + i, type: pick(['yoji', 'baito', 'asobi', 'work', 'zzz']), title: pick(['定例', 'カフェ', '歯医者']), y: today.y + pick([0, 0, -1]), m: int(0, 11), day: int(1, 28),
      start: HH(), end: HH(), status: pick(['kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: i, jobId: pick([undefined, 'j1']) };
    if (rnd() < 0.5) { e.y = today.y; e.m = today.m; e.day = pick([today.d, today.d + 1, today.d - 1, 5]); if (e.day < 1) e.day = 1; }
    if (rnd() < 0.2) { e.allDay = true; if (rnd() < 0.5) e.days = int(2, 4); }
    if (rnd() < 0.3) e.place = pick(['渋谷', 'https://zoom.us/j/1', ' 本社 5F ']);
    if (rnd() < 0.3) e.memo = pick(['電話 03-1234-5678 まで', '資料 https://example.com/a　ほか', '090-1234-5678\n2行目', 'meet: meet.google.com/abc']);
    if (rnd() < 0.2) e.link = pick(['teams.microsoft.com/l/x', 'https://zoom.us/j/9', '']);
    if (rnd() < 0.2) e.remindMin = pick([10, 60, 0, 1440]);
    if (e.status === 'jisseki' && rnd() < 0.5) { e.actualEnd = HH(); e.breakMin = pick([0, 30]); e.hourly = 1200; }
    if (e.status === 'mikakutei' && rnd() < 0.5) e.want = [e.start, e.end];
    if (rnd() < 0.15) e.candId = 'K1';
    if (rnd() < 0.1) e.movedFrom = { y: e.y, m: e.m, day: 1 };
    if (rnd() < 0.1) e.noReport = true;
    events.push(e);
  }
  const settings = { ...mkApp({}).state.settings, onboarded: true, weekStart: pick([0, 1]), notifyOff: rnd() < 0.2, theme: pick([undefined, 'dark']), firstUseAt: NOW - 100 * 86400000, confirmCount: pick([0, 4, 9]) };
  const target = pick(events);
  const app = mkApp(J({ events, types, settings, today, ym: { y: today.y, m: today.m }, screen: 'detail', detailId: target.id, returnTo: pick(['day', 'month', 'list']), jobs: [{ id: 'j1', name: 'カフェ', hourly: 1100 }], dayNum: today.d }));
  if (rnd() < 0.4) { app.openDialog(app.state.events.find((e) => e.id === target.id), pick(['confirm', 'worked', 'move']), app.state.returnTo); }
  const init = snap(app);
  const steps = [];
  for (let s = 0; s < int(2, 7); s++) {
    const { v } = app.renderVals();
    const out = { detail: detailOf(v), dialog: dialogOf(v, app.state) };
    const opts = [];
    const add = (op, fn) => opts.push([op, fn]);
    if (app.state.dialog) {
      const d = app.state.dialog;
      add({ h: 'dlgRow', f: 'start' }, () => v.dlgTimeRows[0].onTap()); add({ h: 'dlgRow', f: 'end' }, () => v.dlgTimeRows[1].onTap());
      for (const f of ['start', 'end']) for (const u of ['h', 'm']) { const idx = u === 'h' ? int(0, 23) : int(0, 11); add({ h: 'dlgWheel', f, u, idx }, () => app._dWheel({ target: { scrollTop: idx * 34 } }, f, u)); }
      if (v.dlgBreakShown) v.dlgBreakChips.forEach((c, i) => add({ h: 'break', val: [0, 15, 30, 45, 60, 90][i] }, () => c.onClick()));
      if (v.dlgMoveShown) add({ h: 'startMove' }, () => v.onDlgMove());
      if (v.dlgMoving) {
        add({ h: 'shiftMove', n: -1 }, () => v.onDlgMovePrev()); add({ h: 'shiftMove', n: 1 }, () => v.onDlgMoveNext());
        const cs = v.dlgMoveCells.filter((c) => c.label !== ''); for (let r = 0; r < 3; r++) { const c = pick(cs); add({ h: 'moveDay', d: c.label }, () => c.onClick()); }
        if (d.moveTo) { add({ h: 'moveTo', st: 'kakutei' }, () => v.onDlgMoveFix()); add({ h: 'moveTo', st: 'mikakutei' }, () => v.onDlgMoveKeep()); }
        add({ h: 'moveSomeday' }, () => v.onDlgMoveSomeday()); add({ h: 'moveBack' }, () => v.onDlgMoveBack());
      } else {
        add({ h: 'primary' }, () => { v.onDlgPrimary(); for (const f of timers.splice(0)) f(); });
        add({ h: 'nakunatta' }, () => v.onDlgNakunatta());
      }
      add({ h: 'dismiss' }, () => v.onDlgDismiss());
      add({ h: 'dlgEdit' }, () => v.onDlgEdit());
    } else if (app.state.screen === 'detail' && v.menuRows.length) {
      const keys = { '働いた時間を直す': 'fix', '編集': 'edit', '日にちを変える': 'move', 'この予定を送る': 'send', 'まとめに入れる': 'rep', 'まとめに入れない': 'rep', 'コピー': 'copy', 'この予定を削除': 'del', 'この実績を削除': 'del' };
      v.menuRows.forEach((r) => { if (keys[r.label] !== 'send') add({ h: 'menu', key: keys[r.label] }, () => r.onClick()); });
      if (v.dPrimaryLabel) add({ h: 'primaryDetail', a: v.dPrimaryLabel === '予定として戻す' ? 'restore' : v.dPrimaryLabel === '働いた記録をつける' ? 'worked' : 'confirm' }, () => v.dPrimaryAction());
      add({ h: 'back' }, () => v.onBack());
      v.dOthers.forEach((o, i) => add({ h: 'other', i }, () => o.onClick()));
    } else break;
    const [op, fn] = pick(opts);
    fn();
    steps.push({ out, op, state: snap(app) });
  }
  cases.push({ now: NOW, init, steps });
}
fs.writeFileSync(path.join(OUT, 'detail.json'), JSON.stringify(cases));
const ops = {};
for (const c of cases) for (const s of c.steps) ops[s.op.h] = (ops[s.op.h] || 0) + 1;
console.log('detail', cases.length, cases.reduce((a, c) => a + c.steps.length, 0), 'steps', JSON.stringify(ops));
