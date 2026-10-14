// 正解表（golden）その5：iPhone のカレンダーとのやりとり（取り込み・重ね表示・書き出し）と、ベルのお知らせ。
// iPhone のカレンダーの代わり（__cal）を置いて、Web 版がどう読み・どう書くかを、呼んだ順番まで記録する。
//
// 実行：node gen-phone.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 31337;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const J = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));

const RealDate = Date;
let NOW = new RealDate(2026, 9, 15, 10, 7, 0).getTime();
class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = FakeDate;
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};

const T = (y, m, d, h = 0, mi = 0) => new RealDate(y, m, d, h, mi).getTime();
// iPhone の予定（プラグインが返す形）
const mkPhoneEvent = (i) => {
  const y = 2026, m = int(6, 11), d = int(1, 28), h = int(0, 23), mi = pick([0, 15, 30, 45]);
  const s = T(y, m, d, h, mi);
  const kind = rnd();
  let e;
  if (kind < 0.2) {
    const days = int(1, 4);
    e = { startDate: T(y, m, d), endDate: pick([T(y, m, d + days), T(y, m, d + days - 1, 23, 59)]), allDay: true };
  } else if (kind < 0.3) {
    e = { startDate: s, endDate: s + int(1, 60) * 3600000, allDay: false };
  } else if (kind < 0.35) {
    e = { startDate: s, endDate: null, allDay: false };
  } else {
    e = { startDate: s, endDate: s + int(1, 16) * 1800000, allDay: false };
  }
  if (rnd() < 0.1) { e.isAllDay = e.allDay; delete e.allDay; }
  if (rnd() < 0.05) e.allDay = null;
  if (rnd() < 0.03) e.startDate = 'x';
  e.id = 'P' + i + (rnd() < 0.2 ? '' : ':' + int(1, 9));
  e.calendarId = pick(['c1', 'c2', 'c3', 'sub', 'bday', null]);
  e.title = pick(['会議', '歯医者 ', '山の日', '海 の 日', '（仮）飲み会', '候補：旅行', 'ランチ?', '早番', 'TBD sync', '', null, '誕生日', 'ＭＴＧ']);
  if (m === 7 && d === 11 && rnd() < 0.5) e.title = '山の日';
  e.status = pick(['none', 'confirmed', 'tentative', 'canceled', 'none', 'none']);
  e.location = pick([null, '', '渋谷', ' 本社 5F ', 'x'.repeat(250)]);
  e.description = pick([null, '', '  メモ  ', 'LUKKO から', 'm'.repeat(2100)]);
  e.url = pick([null, null, 'https://zoom.us/j/1']);
  e.lastModifiedDate = pick([null, 1700000000000 + i]);
  return e;
};
const CALS = [
  { id: 'c1', title: '仕事', color: '#FF0000', type: 1, isSubscribed: false },
  { id: 'c2', title: '', color: null, type: 0, isSubscribed: false },
  { id: 'c3', title: 'LUKKO', color: '#6E85BE', type: 1, isSubscribed: false },
  { id: 'sub', title: '日本の祝日', color: '#00FF00', type: 3, isSubscribed: true },
  { id: 'bday', title: '誕生日', color: '#0000FF', type: 4, isSubscribed: false },
  { id: 'c4', title: '共有', color: '#123456', type: 1, isSubscribed: true },
];

// 呼ばれた順番を記録する、iPhone のカレンダーの代わり
const mkCal = (opt) => {
  const log = [];
  let n = 0;
  const cal = {
    listCalendars: async () => { log.push(['listCalendars']); if (opt.calsThrow) throw new Error('x'); return { result: opt.cals }; },
    listEventsInRange: async (a) => { log.push(['listEventsInRange', a.from, a.to]); if (opt.evThrow) throw new Error('x'); return { result: opt.events }; },
    checkPermission: async () => { log.push(['checkPermission']); return { result: opt.perm }; },
    requestFullCalendarAccess: async () => { log.push(['requestFullCalendarAccess']); return { result: opt.ask }; },
    deleteEvent: async (a) => { log.push(['deleteEvent', a.id]); if ((opt.deleteFails || []).includes(a.id)) throw new Error('x'); },
    modifyEvent: async (a) => { log.push(['modifyEvent', a]); if ((opt.modifyFails || []).includes(a.id)) throw new Error('x'); },
    createEvent: async (a) => { log.push(['createEvent', a]); n++; if ((opt.createFails || []).includes(n)) throw new Error('x'); return opt.noId ? {} : { id: 'N' + n }; },
    fetchAllCalendarSources: async () => { log.push(['fetchAllCalendarSources']); if (opt.srcThrow) throw new Error('x'); return { result: opt.sources || [] }; },
    createCalendar: async (a) => { log.push(['createCalendar', a]); return opt.madeId ? { id: opt.madeId } : {}; },
  };
  return { cal, log };
};

const out = { toAppShape: [], read: [], overlay: [], ensure: [], exportSync: [], runRead: [], runIcs: [], notices: {} };

// ---- A. iPhone の予定 → このアプリの形 ----
for (let i = 0; i < 400; i++) { const e = mkPhoneEvent(i); out.toAppShape.push({ e, shape: J(H.iphonecal.toAppShape(e)) }); }

globalThis.__native = true;
// ---- B. 取り込みで読む ----
for (let k = 0; k < 60; k++) {
  NOW = T(2026, int(6, 10), int(1, 28), int(0, 23), int(0, 59));
  const events = Array.from({ length: int(0, 25) }, (_, i) => mkPhoneEvent(k * 100 + i));
  const calsThrow = rnd() < 0.1;
  const { cal, log } = mkCal({ cals: CALS, events, calsThrow });
  globalThis.__cal = cal;
  const opts = pick([{}, { monthsAhead: 12 }, { calIds: ['c1'] }, { calIds: [] }, { fromDate: new RealDate(2026, 0, 1) }, { monthsBack: 2, monthsAhead: 3, calIds: ['c1', 'c2', 'sub'] }]);
  const r = await H.calendarimport.readCalendarEvents(opts);
  out.read.push({ now: NOW, events, opts: J({ ...opts, fromDate: opts.fromDate ? opts.fromDate.getTime() : undefined }), calsThrow, log, result: J(r) });
}

// ---- C. 重ね表示で読む ----
for (let k = 0; k < 40; k++) {
  const events = Array.from({ length: int(0, 15) }, (_, i) => mkPhoneEvent(5000 + k * 100 + i));
  const evThrow = rnd() < 0.1;
  const { cal, log } = mkCal({ cals: CALS, events, evThrow });
  globalThis.__cal = cal;
  const ids = pick([['c1'], ['c1', 'c2'], [], null, ['sub']]);
  const from = new RealDate(2026, int(5, 9), 1), to = new RealDate(2026, int(10, 11), 0, 23, 59);
  const r = await H.iphonecal.readOverlay(ids, from, to);
  out.overlay.push({ events, ids, from: from.getTime(), to: to.getTime(), evThrow, log, result: J(r) });
}

// ---- D. 書き出しのカレンダーを探す・作る ----
for (let k = 0; k < 30; k++) {
  const cals = pick([CALS, CALS.filter((c) => c.title !== 'LUKKO'), []]);
  const sources = pick([[{ id: 's1', title: 'iCloud', type: 2 }, { id: 's2', title: 'この iPhone', type: 0 }], [{ id: 's2', title: 'Default', type: 0 }], [{ id: 's3', title: 'Gmail', type: 1 }], [{ id: 's4', title: 'x', type: 'local' }], []]);
  const opt = { cals, sources, madeId: pick(['NEWCAL', null]), srcThrow: rnd() < 0.1, calsThrow: rnd() < 0.05 };
  const { cal, log } = mkCal(opt);
  globalThis.__cal = cal;
  const known = pick([undefined, 'c3', 'c1', 'gone']);
  const r = await H.iphonecal.ensureExportCalendar(known);
  out.ensure.push({ opt, known, log, result: r === undefined ? null : r });
}

// ---- E. 決まった予定を「LUKKO」にそろえる（同じ予定で何回か続けて呼ぶ）----
const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '30']);
for (let k = 0; k < 60; k++) {
  let events = [];
  for (let i = 0; i < int(0, 12); i++) {
    const e = { id: 'e' + i, title: pick(['定例', '', '歯医者']), y: 2026, m: int(8, 10), day: int(1, 30), start: HH(), end: HH(), status: pick(['kakutei', 'mikakutei', 'jisseki', 'nakunatta']), type: 'yoji' };
    if (rnd() < 0.2) { e.allDay = true; e.days = pick([1, 2, 3, undefined, 0, 99]); }
    if (rnd() < 0.2) e.place = pick(['渋谷', '']);
    if (rnd() < 0.2) e.link = pick(['https://x.test', '']);
    if (rnd() < 0.15) e.secret = true;
    if (e.status === 'jisseki' && rnd() < 0.5) e.actualEnd = HH();
    if (rnd() < 0.05) e.overlay = true;
    events.push(e);
  }
  if (rnd() < 0.2 && events.length) events.push({ ...events[0], title: '同じ番号' });
  if (rnd() < 0.1) events.push(null);
  let map = pick([{}, { old1: 'X1', '#old1': '{}' }, { '#lonely': 'x' }, { e0: 'X0', '#e0': 'not json' }]);
  const rounds = [];
  for (let r = 0; r < 3; r++) {
    const opt = { modifyFails: rnd() < 0.2 ? Object.values(map).filter((v) => typeof v === 'string' && v.startsWith('N')).slice(0, 1) : [],
      deleteFails: rnd() < 0.2 ? ['X1'] : [], createFails: rnd() < 0.1 ? [1] : [], noId: rnd() < 0.05 };
    const { cal, log } = mkCal(opt);
    globalThis.__cal = cal;
    const hideAll = rnd() < 0.2;
    const calId = pick(['LK', 'LK', 'LK', null]);
    const before = J(map);
    map = await H.iphonecal.syncExport(J(events), calId, map, hideAll);
    rounds.push({ events: J(events), calId, hideAll, opt, map: before, log: J(log), result: J(map) });
    // 次の回までに、予定を少し変える
    events = events.filter(Boolean).map((e) => (rnd() < 0.3 ? { ...e, title: e.title + '!', link: rnd() < 0.5 ? undefined : e.link, status: pick(['kakutei', 'mikakutei']) } : e)).filter(() => rnd() < 0.9);
  }
  out.exportSync.push(rounds);
}

// ---- F. 取り込みの流れ（App の runScan・runRead）----
const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
const KEYS = ['events', 'types', 'settings', 'screen', 'imp', 'today'];
const snap = (app) => { const o = {}; for (const k of KEYS) o[k] = app.state[k]; return J(o); };
for (let k = 0; k < 80; k++) {
  NOW = T(2026, int(6, 10), int(1, 28), int(7, 22), int(0, 59));
  const phone = Array.from({ length: int(0, 20) }, (_, i) => mkPhoneEvent(9000 + k * 100 + i));
  // 前に取り込んだ予定（srcId つき）を持っている人も
  const events = [];
  for (let i = 0; i < int(0, 6); i++) {
    const p = pick(phone.length ? phone : [mkPhoneEvent(1)]);
    const sh = H.iphonecal.toAppShape(p);
    if (!sh) continue;
    events.push({ id: 'i' + i + '-0', type: pick(['yoji', 'baito']), title: rnd() < 0.5 ? (p.title || '無題') : '前の名前', ...sh, status: pick(['kakutei', 'nakunatta']), srcId: String(p.id), srcCal: p.calendarId == null ? undefined : String(p.calendarId), updatedAt: 1 });
  }
  const app = mkApp({ events, today: { y: 2026, m: new RealDate(NOW).getMonth(), d: new RealDate(NOW).getDate() }, screen: 'import' });
  if (rnd() < 0.3) app.state.types = app.state.types.map((t) => (t.key === 'baito' ? { ...t, hidden: true } : t));
  const perm = pick(['granted', 'prompt', 'denied']), ask = pick(['granted', 'denied']);
  const calsThrow = rnd() < 0.1;
  const { cal, log } = mkCal({ cals: CALS, events: phone, perm, ask, calsThrow });
  globalThis.__cal = cal;
  const mem = rnd() < 0.4 ? { c1: { on: false, type: 'baito' }, c2: { on: true, type: '' } } : undefined;
  app.state.settings = { ...app.state.settings, importCals: mem };
  app.state.imp = { phase: 'idle', found: [], type: 'yoji', error: '', range: pick([undefined, 'month', 'year', 'back']) };
  const init = snap(app);
  const steps = [];
  await app.runScan();
  steps.push({ call: 'runScan', state: snap(app) });
  if (app.state.imp.phase === 'cals') {
    // カレンダーを選び直して読む
    const cals = app.state.imp.cals.map((c) => ({ ...c, on: rnd() < 0.7, type: pick([c.type, '', 'asobi']) }));
    app.setState((s) => ({ imp: { ...s.imp, cals, range: pick(['month', 'year', 'back']) } }));
    steps.push({ call: 'set', imp: J(app.state.imp), state: snap(app) });
    await app.runRead(null);
    steps.push({ call: 'runRead', state: snap(app) });
  }
  out.runRead.push({ now: NOW, phone, perm, ask, calsThrow, init, steps, log: J(log) });
}

// ---- G. .ics の取り込み（App の runIcs）----
const icsSamples = JSON.parse(fs.readFileSync(path.join(OUT, 'ics.json'), 'utf8'));
const icsTexts = [...icsSamples.parseCases.map((c) => c.text), ...icsSamples.exportCases.slice(0, 20).map((c) => c.text)];
for (let k = 0; k < icsTexts.length; k++) {
  NOW = new RealDate(2026, 9, 15, 10, 30, 5).getTime();
  const app = mkApp({ today: { y: 2026, m: 9, d: 15 }, events: k % 3 ? [] : [{ id: 'a', type: 'yoji', title: '定例', y: 2026, m: 9, day: 16, start: '10:00', end: '11:00', status: 'kakutei' }] });
  const init = snap(app);
  app.runIcs(icsTexts[k]);
  out.runIcs.push({ now: NOW, text: icsTexts[k], init, state: snap(app) });
}
globalThis.__native = false;
globalThis.__cal = undefined;

// ---- H. ベルのお知らせ ----
const N = H.notices;
const nt = out.notices;
nt.cmp = [];
for (const a of ['0.9.0', '0.10.0', '1.3.3', '1.3', '1', '', 'x.y', '0.32.2', '2.0.0-beta', '01.2.3']) for (const b of ['0.9.0', '0.32.2', '1.3.3', '', '1.3.3.1']) nt.cmp.push([a, b, N.cmpVersion(a, b)]);
nt.shift = [];
for (let k = 0; k < 150; k++) {
  NOW = T(2026, 9, int(1, 28), int(0, 23), int(0, 59));
  const events = [];
  for (let i = 0; i < int(0, 8); i++) {
    const e = { id: 'e' + i, type: pick(['baito', 'baito', 'yoji']), status: pick(['kakutei', 'kakutei', 'jisseki', 'mikakutei']), title: pick(['カフェ', '塾']),
      y: 2026, m: 9, day: int(1, 28), start: HH(), end: HH() };
    if (rnd() < 0.1) e.allDay = true;
    events.push(e);
  }
  const notices = [];
  if (rnd() < 0.5) notices.push({ id: 'shift-e1', kind: 'shift', eventId: 'e1', title: 't', body: 'b', at: 5, read: rnd() < 0.5 });
  if (rnd() < 0.3) notices.push({ id: 'info-0.32.2', kind: 'info', title: '古い題', body: '古い文', at: 3, read: false });
  if (rnd() < 0.3) notices.push({ id: 'shift-zz', kind: 'shift', eventId: 'zz', title: 't', body: 'b', at: 4, read: false });
  nt.shift.push({ now: NOW, events, notices, out: J(N.syncShiftNotices(notices, events, new Date(NOW))) });
}
nt.info = [];
for (const cur of ['0.32.2', '0.32.1', '0.40.0', '1.3.3']) for (const last of [null, '', '0.32.2', '0.31.0', '0.9.0', '1.3.3']) {
  NOW = T(2026, 9, 15, 10, 0);
  const notices = rnd() < 0.3 ? [{ id: 'info-0.32.2', kind: 'info', title: 'a', body: 'b', at: 1, read: true }] : [];
  nt.info.push({ now: NOW, cur, last, notices, out: J(N.syncInfoNotices(notices, cur, last)) });
}
nt.current = [null, { id: 'info-0.32.2', kind: 'info', title: '古い', body: '古い' }, { id: 'info-9', kind: 'info', title: 'x' }, { id: 'shift-1', kind: 'shift', title: 'y' }].map((n) => ({ n, out: J(N.currentNoteText(n)) }));
nt.relative = [];
for (let k = 0; k < 60; k++) {
  const now = T(2026, 9, 15, 10, 0), ms = now - pick([0, 30000, 60000, 59 * 60000, 3600000, 23 * 3600000, 86400000, 6 * 86400000, 7 * 86400000, 40 * 86400000, -5000, int(0, 90) * 3600000]);
  nt.relative.push([ms, now, N.relativeTime(ms, now)]);
}
nt.releaseNotes = N.RELEASE_NOTES;

fs.writeFileSync(path.join(OUT, 'phone.json'), JSON.stringify(out));
console.log('phone', Object.entries(out).map(([k, v]) => k + ':' + (Array.isArray(v) ? v.length : Object.keys(v).length)).join(' '));
