// 正解表（golden）その2：予定を変える操作。
// いまの Web 版の App をそのまま動かし、「はじめの状態 → 操作を順に → そのたびの状態」を書き出す。
// SwiftUI 版の同じ操作は、毎回の状態が 1 つ残らず一致しなければならない（native/LukkoKit/Tests）。
//
// 実行：node gen-actions.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 77001;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

// ---- 時計と待ち時間を、こちらで進める ----
const RealDate = Date;
let NOW = new RealDate(2026, 9, 15, 10, 7, 0).getTime();
class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = FakeDate;
let timers = [];
let tid = 1;
globalThis.setTimeout = (fn, ms) => { const id = tid++; timers.push({ id, fn, at: NOW + (ms || 0) }); return id; };
globalThis.clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
// 時計を ms だけ進める。そのあいだに来る待ちを、時刻の順に動かす（動かした先で足された待ちも、時刻が来ていれば）
const advance = (ms) => {
  const end = NOW + ms;
  for (let guard = 0; guard < 200; guard++) {
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    if (!timers.length || timers[0].at > end) break;
    const t = timers.shift();
    if (t.at > NOW) NOW = t.at;
    t.fn();
  }
  NOW = end;
};

// ---- App を作る（描かないので、setState はその場で中身を差し替える）----
const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
// 比べる中身：保存するものと、画面の流れに関わるもの
const KEYS = ['events', 'types', 'overrides', 'settings', 'notices', 'jobs', 'supports', 'trash', 'someday', 'gone',
  'screen', 'returnTo', 'detailId', 'dayNum', 'ym', 'today', 'dialog', 'confirmDelete', 'deleteRest', 'candAsk', 'undo', 'repEditAsk', 'shareMsg', 'shareToast', 'draft'];
const snap = (app) => { const o = {}; for (const k of KEYS) o[k] = app.state[k]; return JSON.parse(JSON.stringify(o)); };

const HH = () => String(int(6, 22)).padStart(2, '0') + ':' + pick(['00', '30']);
const TYPES = [
  { key: 'yoji', name: '用事', color: '#8B7AB8', paper: 'p', dark: 'd', uWord: 'まだ分からない用事', cWord: '確定した用事' },
  { key: 'baito', name: 'バイト', color: '#7FAE85', paper: 'p', dark: 'd', uWord: '希望シフト', cWord: '確定シフト', defStart: '17:00', defEnd: '22:00' },
  { key: 'asobi', name: '遊び', color: '#D2916A', paper: 'p', dark: 'd' },
  { key: 'off', name: '休み', color: '#5FA8A2', free: true, allDayDefault: true },
];

const scenarios = [];
for (let k = 0; k < 160; k++) {
  NOW = new RealDate(2026, 9, int(1, 28), int(7, 22), int(0, 59), 0).getTime();
  const now0 = NOW;
  timers = [];
  const today = { y: 2026, m: 9, d: new RealDate(NOW).getDate() };
  // はじめの予定：ふつう・くり返しの群れ・候補日の群れ・実績
  const events = [];
  const repId = 'rG' + k, candId = 'kG' + k;
  for (let i = 0; i < int(2, 10); i++) {
    const e = { id: 'e' + i, type: pick(['yoji', 'baito', 'asobi']), title: pick(['定例', 'バイト', '飲み会', '歯医者']), y: 2026, m: pick([8, 9, 10]), day: int(1, 28),
      start: HH(), end: HH(), status: pick(['kakutei', 'mikakutei', 'jisseki']), updatedAt: 1000 + i };
    if (e.status === 'mikakutei' && rnd() < 0.5) e.want = [e.start, e.end];
    if (rnd() < 0.2) e.jobId = 'j1';
    events.push(e);
  }
  for (let i = 0; i < int(0, 4); i++) events.push({ id: 'r' + i, type: 'yoji', title: 'ジム', y: 2026, m: 9, day: 3 + i * 7, start: '19:00', end: '20:30', status: 'kakutei', repId, updatedAt: 2000 + i });
  for (let i = 0; i < int(0, 3); i++) events.push({ id: 'c' + i, type: 'asobi', title: '飲み会', y: 2026, m: 9, day: 10 + i, start: '19:00', end: '21:00', status: 'mikakutei', candId, want: ['19:00', '21:00'], updatedAt: 3000 + i });
  const init = { events, types: TYPES, jobs: [{ id: 'j1', name: 'カフェ', hourly: 1100 }], settings: { hourly: 1120, weekStart: 0, remind: true, onboarded: true, lastType: pick(['yoji', 'baito', undefined]), remindTimed: pick([10, undefined]), remindAllDay: pick([0, undefined]) },
    trash: [], someday: [], gone: [], today, ym: { y: 2026, m: 9 }, screen: 'month', returnTo: 'month', overrides: {}, notices: [], supports: [] };
  const app = mkApp(JSON.parse(JSON.stringify(init)));
  const init0 = snap(app);
  const steps = [];
  let gap = 0;
  const record = (op) => { steps.push({ op, gap, state: snap(app) }); };
  const anyEv = () => app.state.events.length ? pick(app.state.events) : null;

  for (let s = 0; s < int(2, 7); s++) {
    gap = int(1, 600) * 1000;
    advance(gap);
    const r = rnd();
    if (r < 0.22) {
      // 新しい予定
      const day = int(1, 28), opts = pick([undefined, { start: int(0, 1430) }, { allDay: true }, { y: 2026, m: 10 }]);
      const nret = pick(['month', 'day', 'list']);
      app.openNew(day, nret, opts);
      const draft0 = JSON.parse(JSON.stringify(app.state.draft));
      const dr = { ...app.state.draft, title: pick(['', '定例', '新しい予定']), type: pick(['yoji', 'baito', 'asobi', 'off']), status: pick(['kakutei', 'mikakutei']) };
      if (rnd() < 0.3) dr.allDay = !dr.allDay;
      if (rnd() < 0.3) dr.days = int(1, 4);
      if (rnd() < 0.3) dr.extraDays = ['2026-9-' + int(1, 28), '2026-10-' + int(1, 28)];
      if (rnd() < 0.3) { dr.repEvery = pick(['day', 'weekday', 'week', 'biweek', 'month', 'nth', 'monthEnd', 'year', 'zzz']); dr.repSpan = pick([1, 3, 6, 12]); dr.repDows = pick([[], [1, 3], [5]]); dr.repNth = pick([undefined, [2, 4], [5]]); }
      if (rnd() < 0.2) dr.cand = true;
      if (rnd() < 0.15) dr.someday = pick(['week', 'month', 'next', 'someday']);
      if (rnd() < 0.3) { dr.place = pick([' 渋谷 ', '']); dr.memo = pick(['持ち物', '  ']); dr.link = pick(['zoom.us/j/1', '']); }
      if (rnd() < 0.2) dr.secret = true;
      if (rnd() < 0.3) dr.remindMin = pick([null, 10, 60]);
      app.setState({ draft: dr });
      const step = { call: 'new', day, ret: nret, opts, draft0, draft: dr };
      app.save();
      record(step);
    } else if (r < 0.38 && anyEv()) {
      // 直す（くり返しなら「この予定だけ／これ以降すべて」）
      const ev = anyEv();
      const eret = pick(['day', 'detail', undefined]);
      app.openEdit(ev, eret);
      const draft0 = JSON.parse(JSON.stringify(app.state.draft));
      const dr = { ...app.state.draft };
      if (rnd() < 0.5) dr.title = '直した' + s;
      if (rnd() < 0.4) dr.start = HH();
      if (rnd() < 0.4) dr.end = HH();
      if (rnd() < 0.3) { dr.day = int(1, 28); }
      if (rnd() < 0.2) dr.status = pick(['kakutei', 'mikakutei', 'jisseki']);
      if (rnd() < 0.2) dr.place = '会議室';
      app.setState({ draft: dr });
      app.save();
      const ask = app.state.repEditAsk;
      const scope = ask ? pick(['one', 'rest']) : null;
      if (scope) app.save(scope);
      record({ call: 'edit', id: ev.id, ret: eret, draft0, draft: dr, scope });
    } else if (r < 0.52 && anyEv()) {
      const ev = anyEv(), rest = rnd() < 0.5;
      app.askDelete(ev.id);
      if (rest) app.setState({ deleteRest: true });
      app.doDelete();
      const undo = rnd() < 0.3;
      if (undo) app.undoLast();
      record({ call: 'delete', id: ev.id, rest, undo });
    } else if (r < 0.62 && (app.state.trash || []).length) {
      const ids = app.state.trash.filter(() => rnd() < 0.6).map((x) => x.ev.id);
      const quiet = rnd() < 0.5;
      app.restoreTrash(ids, quiet);
      record({ call: 'restoreTrash', ids, quiet });
    } else if (r < 0.74 && anyEv()) {
      const ev = anyEv();
      const mode = pick(['confirm', 'confirm', 'worked']);
      const ret = pick(['day', 'month']);
      app.openDialog(ev, mode, ret);
      const dlgPatch = rnd() < 0.4 ? [pick(['start', 'end']), pick([30, -30, 60])] : null;
      if (dlgPatch) app.patchDlg(dlgPatch[0], dlgPatch[1]);
      const brk = mode === 'worked' && rnd() < 0.5 ? pick([0, 30, 45]) : null;
      if (brk !== null) app.setState((s0) => ({ dialog: { ...s0.dialog, breakMin: brk } }));
      const nak = mode === 'confirm' && rnd() < 0.25;
      if (nak) app.dlgNakunatta(); else app.dlgPrimary();
      advance(1000);
      const settle = app.state.candAsk ? pick([true, false]) : null;
      if (settle !== null) app.settleCandidates(settle);
      const undo = rnd() < 0.3;
      if (undo) app.undoLast();
      record({ call: 'dialog', id: ev.id, mode, ret, nak, settle, undo, patch: dlgPatch, brk });
    } else if (r < 0.82 && anyEv()) {
      const ev = anyEv(), to = { y: 2026, m: pick([9, 10]), d: int(1, 28) }, status = pick(['kakutei', 'mikakutei']);
      app.moveEvent(ev.id, to, status);
      const undo = rnd() < 0.3;
      if (undo) app.undoLast();
      record({ call: 'move', id: ev.id, to, status, undo });
    } else if (r < 0.9 && anyEv()) {
      const ev = anyEv(), when = pick(['week', 'month', 'next', 'someday']);
      app.toSomeday(ev.id, when);
      record({ call: 'toSomeday', id: ev.id, when });
    } else if ((app.state.someday || []).length) {
      const it = pick(app.state.someday);
      if (rnd() < 0.6) { const d = int(1, 28); app.placeSomeday(it.id, 2026, 9, d); record({ call: 'placeSomeday', sid: it.id, y: 2026, m: 9, d }); }
      else { app.dropSomeday(it.id); record({ call: 'dropSomeday', sid: it.id }); }
    } else if (anyEv()) {
      const ev = anyEv(), patch = pick([{ title: '名前だけ' }, { memo: 'メモ' }, { status: 'nakunatta' }]);
      app.updateEvent(ev.id, patch);
      record({ call: 'update', id: ev.id, patch });
    }
  }
  scenarios.push({ init: init0, now0, steps });
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'actions-events.json'), JSON.stringify(scenarios));
console.log('actions-events', scenarios.length, scenarios.reduce((a, s) => a + s.steps.length, 0), 'steps');
