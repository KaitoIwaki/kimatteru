// 正解表（golden）を作る。いまの Web 版のコードをそのまま動かして、入力と答えを JSON に書き出す。
// SwiftUI 版の同じ計算は、この表と 1 つ残らず一致しなければならない（native/LukkoKit/Tests）。
//
// 実行：LUKKO_NODE_MODULES=<app/node_modules> node build-harness.mjs && node gen.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');
fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => {
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(data));
  console.log(name, Array.isArray(data) ? data.length : Object.keys(data).length);
};

// 決まった並びの乱数（毎回同じ表になるように）
let seed = 20261015;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

// ---- 祝日：2000〜2040 年の全部の日 ----
{
  const out = [];
  for (let y = 2000; y <= 2040; y++) {
    for (let m = 0; m < 12; m++) {
      const dim = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= dim; d++) { const n = H.holidays.holidayName(y, m, d); if (n) out.push([y, m, d, n]); }
    }
  }
  write('holidays', out);
}

// ---- 時刻・日またぎ（whenlib）----
const TIMES = ['00:00', '0:00', '00:30', '06:00', '09:00', '9:30', '12:00', '17:00', '21:59', '22:00', '23:30', '23:59', '24:00', '', 'x', '7', ' 8:15', '10:05', '1:00'];
{
  const out = [];
  for (let i = 0; i < 1500; i++) {
    const ev = { y: 2026, m: int(0, 11), day: int(1, 28), start: pick(TIMES), end: pick(TIMES) };
    if (rnd() < 0.3) ev.actualEnd = pick(TIMES);
    if (rnd() < 0.1) ev.allDay = pick([true, 1, false, 0]);
    if (rnd() < 0.05) ev.actualEnd = '';
    const em = H.whenlib.endMoment(ev);
    out.push({ ev, toMinStart: H.whenlib.toMin(ev.start), endsNextDay: H.whenlib.endsNextDay(ev), spillsNextDay: H.whenlib.spillsNextDay(ev),
      busyEndMin: H.whenlib.busyEndMin(ev), endMoment: [em.getFullYear(), em.getMonth(), em.getDate(), em.getHours(), em.getMinutes()] });
  }
  write('whenlib', out);
}

// ---- 週と日の時間の並び（timegrid）----
const STAT = ['kakutei', 'mikakutei', 'jisseki', 'nakunatta'];
const mkEvent = (id, y, m) => {
  const e = { id: 'e' + id, y, m, day: int(1, 28), start: pick(TIMES.slice(0, 13).concat(['08:00', '13:00', '15:45'])), end: pick(TIMES.slice(0, 13).concat(['10:00', '14:00', '18:00'])), status: pick(STAT) };
  if (e.status === 'jisseki' && rnd() < 0.5) e.actualEnd = pick(['22:30', '01:00', '18:15']);
  if (rnd() < 0.15) { e.allDay = true; if (rnd() < 0.5) e.days = int(1, 5); }
  return e;
};
{
  const out = [];
  for (let k = 0; k < 120; k++) {
    const y = 2026, m = int(0, 11);
    const evs = Array.from({ length: int(0, 12) }, (_, i) => mkEvent(i, y, m));
    for (let j = 0; j < 4; j++) {
      const d = int(1, 28);
      const segs = H.timegrid.segmentsForDay(evs, y, m, d);
      const lay = H.timegrid.layoutColumns(segs);
      out.push({ evs, y, m, d,
        segs: segs.map((s) => [s.ev.id, s.a, s.b, s.cont]),
        layout: lay.map((s) => [s.ev.id, s.a, s.b, s.cont, s.col, s.cols]),
        allDay: H.timegrid.allDayFor(evs, y, m, d).map((e) => e.id),
        weekStart0: H.timegrid.weekStartNo(y, m, d, 0), weekStart1: H.timegrid.weekStartNo(y, m, d, 1) });
    }
  }
  write('timegrid', out);
}

// ---- 起動したときの読み込み（App.jsx の constructor：sanitizeEvents・mergeTypes・設定の合成ほか）----
// 保存されていたものに、わざと壊れた・古い形・知らない項目を混ぜて、読み込んだ結果を書き出す
{
  const NOW = 1791000000000; // 決めた「いま」（2026-10 ごろ）。最近消した予定の 30 日はこれで数える
  const realNow = Date.now;
  Date.now = () => NOW;
  const PERSISTED = ['events', 'types', 'overrides', 'settings', 'notices', 'lastSeenVersion', 'jobs', 'supports', 'trash', 'someday', 'gone'];
  const odd = () => pick([undefined, null, 0, 1, '', 'x', true, false, [], {}, [1, 2], { a: 1 }, 3.5, -1]);
  const time = () => pick(['09:00', '9:00', '23:59', '00:00', '24:00', '12:60', '7:5', '', null, 900, '18:30', '05:00']);
  const mkEv = (i) => {
    const e = { id: rnd() < 0.08 ? pick(['', null, 5]) : 'id' + i, y: rnd() < 0.05 ? odd() : 2026, m: rnd() < 0.05 ? pick([12, -1, '3', 2.5]) : int(0, 11),
      day: rnd() < 0.05 ? pick([0, 32, '5', NaN]) : int(1, 31), start: time(), end: time(), title: rnd() < 0.05 ? odd() : '予定' + i, type: pick(['yoji', 'baito', 'asobi', 'other', 'work', 'zzz']),
      status: pick(['kakutei', 'mikakutei', 'jisseki', 'nakunatta']) };
    if (rnd() < 0.3) e.actualEnd = pick(['22:30', 'abc', '', '25:00', '01:15']);
    if (rnd() < 0.2) e.want = pick([['17:00', '22:00'], ['1'], 'x', [1, 2, 3]]);
    if (rnd() < 0.2) e.allDay = odd();
    if (rnd() < 0.2) e.memo = 'メモ' + i;
    if (rnd() < 0.1) e.unknownField = { keep: i };
    if (rnd() < 0.03) return odd();
    return e;
  };
  const BUILTIN = [['yoji', '用事', '#534AB7'], ['baito', 'バイト', '#1D9E75'], ['asobi', '遊び', '#D85A30'], ['other', 'その他', '#5A6570'], ['work', '仕事', '#6E85BE']];
  const mkTypes = () => {
    const r = rnd();
    if (r < 0.15) return odd();
    const list = [];
    for (const [key, name, color] of BUILTIN) if (rnd() < 0.7) list.push({ key, name: rnd() < 0.2 ? name + '★' : name, color: rnd() < 0.5 ? color : '#123456', ...(rnd() < 0.2 ? { hidden: true } : {}) });
    if (rnd() < 0.4) list.push({ key: 'c' + int(1, 9), name: '自分の種類', color: '#ABCDEF' });
    if (rnd() < 0.1) list.push({ key: 1, name: 'x' });
    return list.sort(() => rnd() - 0.5);
  };
  const out = [];
  for (let k = 0; k < 400; k++) {
    const saved = { savedAt: NOW - int(0, 1e9) };
    if (rnd() < 0.95) saved.events = rnd() < 0.05 ? odd() : Array.from({ length: int(0, 25) }, (_, i) => mkEv(k * 100 + i));
    if (rnd() < 0.9) saved.types = mkTypes();
    if (rnd() < 0.8) saved.overrides = rnd() < 0.2 ? odd() : { ['2026-' + int(0, 11) + '-' + int(1, 28)]: pick(['o', 'a', 'x']) };
    if (rnd() < 0.9) saved.settings = rnd() < 0.1 ? odd() : { hourly: int(900, 2000), weekStart: int(0, 1), ...(rnd() < 0.5 ? { profile: pick(['work', 'student', 'shift', 'family', 'freelance', 'zzz']) } : {}), ...(rnd() < 0.3 ? { onboarded: false } : {}), ...(rnd() < 0.3 ? { theme: 'dark' } : {}) };
    if (rnd() < 0.5) saved.notices = rnd() < 0.2 ? odd() : [{ id: 'n1', kind: 'info', at: NOW - 1000 }];
    if (rnd() < 0.5) saved.lastSeenVersion = pick(['0.31.0', '', null, 3]);
    if (rnd() < 0.6) saved.jobs = rnd() < 0.2 ? odd() : [{ id: 'j1', name: 'カフェ', hourly: 1100 }, { id: 'j2', hourly: '1200' }, { id: 3, hourly: 900 }, null];
    if (rnd() < 0.5) saved.supports = rnd() < 0.2 ? odd() : [{ yen: 300, at: NOW - 5 }, { yen: '600', at: NOW }, { yen: 1000 }];
    if (rnd() < 0.6) saved.trash = rnd() < 0.2 ? odd() : [{ ev: { id: 't1' }, at: NOW - 86400000 }, { ev: { id: 't2' }, at: NOW - 31 * 86400000 }, { ev: null, at: NOW }, { ev: [1], at: NOW - 1 }];
    if (rnd() < 0.5) saved.someday = rnd() < 0.2 ? odd() : [{ id: 's1', title: '旅行', when: 'month' }, { id: 's2', title: 'x', when: 'year' }, { id: 's3', when: 'week' }];
    if (rnd() < 0.5) saved.gone = rnd() < 0.2 ? odd() : [['g1', NOW - 1000], ['g2', NOW - 40 * 86400000], [5, NOW], 'x'];
    if (rnd() < 0.2) saved.extraTopLevel = { unknown: true };
    globalThis.__ls.clear();
    globalThis.__ls.set('kimatteru.v2', JSON.stringify(saved));
    const app = new H.App({});
    const st = {};
    for (const key of PERSISTED) st[key] = app.state[key];
    out.push({ saved: JSON.parse(JSON.stringify(saved)), state: JSON.parse(JSON.stringify(st)) });
  }
  // 保存が無いとき（はじめて使う人）
  globalThis.__ls.clear();
  { const app = new H.App({}); const st = {}; for (const key of PERSISTED) st[key] = app.state[key]; out.push({ saved: null, state: JSON.parse(JSON.stringify(st)) }); }
  Date.now = realNow;
  write('load', { now: NOW, cases: out });
}

// ---- 計算（App のメソッド）：時間・給料・まとめの内訳・お知らせの言葉 ----
// 予定は読み込みで直したあとの形（開始・終わりは正しい "H:MM"）だけを使う。画面の外から来る値はすべて読み込みを通るため
{
  const HH = () => { const h = int(0, 23), m = pick([0, 5, 15, 30, 45, 59]); return (rnd() < 0.2 ? String(h) : String(h).padStart(2, '0')) + ':' + String(m).padStart(2, '0'); };
  const TYPES = [
    { key: 'yoji', name: '用事', color: '#8B7AB8' }, { key: 'baito', name: 'バイト', color: '#7FAE85' },
    { key: 'asobi', name: '遊び', color: '#D2916A' }, { key: 'other', name: 'その他', color: '#8A8A8A' }, { key: 'c1', name: '自分', color: '#123456' },
  ];
  const mkJobs = () => (rnd() < 0.2 ? [] : [{ id: 'j1', name: 'カフェ', hourly: 1100 }, { id: 'j2', name: '', hourly: 1250 }, { id: 'j3', hourly: 980.5 }].slice(0, int(1, 3)));
  const mkEv = (i) => {
    const e = { id: 'e' + i, y: 2026, m: int(0, 11), day: int(1, 28), start: HH(), end: HH(), type: pick(['yoji', 'baito', 'baito', 'asobi', 'other', 'c1', 'zzz']), status: pick(['kakutei', 'mikakutei', 'jisseki', 'nakunatta']),
      title: pick(['ジム', 'ジム', ' 塾 ', '', 'バイト', '会議', '映画']) };
    if (rnd() < 0.3) e.actualEnd = HH();
    if (rnd() < 0.3) e.breakMin = pick([0, 30, 45, 60, -5, 900, '30', 15.5]);
    if (rnd() < 0.2) e.hourly = pick([1000, 1500, 1234.5]);
    if (rnd() < 0.4) e.jobId = pick(['j1', 'j2', 'j3', 'jx']);
    if (rnd() < 0.15) e.jobName = '辞めた店';
    if (rnd() < 0.12) { e.allDay = true; e.days = pick([1, 2, 3, undefined]); }
    return e;
  };
  H.App.prototype._jobBreakdownNoColor = function (list) { return this._jobBreakdown(list).map(({ color, ...r }) => r); };
  const cases = [];
  const call = (app, method, args) => {
    try { return { out: app[method](...args) }; } catch (err) { return { error: String(err && err.message || err) }; }
  };
  for (let k = 0; k < 300; k++) {
    const app = new H.App({});
    const jobs = mkJobs();
    const settings = { ...app.state.settings, hourly: pick([1120, 1000, 1500]), priorWage: pick([{}, { 2026: 120000 }, { 2026: -5, 2025: 'x' }, { 2026: 123456789 }, { 2026: 1000.6 }]) };
    const types = rnd() < 0.5 ? TYPES : TYPES.slice(0, 4);
    app.state = { ...app.state, jobs, settings, types };
    const evs = Array.from({ length: int(1, 15) }, (_, i) => mkEv(k * 100 + i));
    const st = { jobs, settings, types };
    const rec = (method, args) => cases.push({ st, method, args, ...call(app, method, args) });
    for (const e of evs) {
      rec('hourlyFor', [e]); rec('breakMin', [e]); rec('paidHours', [e]); rec('wage', [e]); rec('spentHours', [e]);
      if (e.allDay) rec('spanLabel', [e]);
      rec('fmtHours', [app.paidHours(e)]);
    }
    rec('_timeBreakdown', [evs]);
    rec('_jobBreakdownNoColor', [evs.filter((e) => e.type === 'baito')]);
    rec('priorFor', [2026]); rec('priorFor', [2025]);
    rec('mins', [HH()]); rec('addMin', [HH(), int(-2000, 2000)]); rec('hoursBetween', [HH(), HH()]);
    rec('fmtWage', [int(0, 3000000)]); rec('fmtMin', [int(0, 1440)]); rec('fmtHours', [int(0, 4000) / 60]); rec('fmtHours', [rnd() * 50]);
    rec('fmtSpent', [pick([0, 1.5, 0.25, 10, 7.999]), pick([0, 1, 3])]);
    rec('remindLabel', [pick([undefined, null, 0, 5, 10, 30, 59, 60, 90, 120, 180, 1439, 1440, 2880, 10080, '30']), pick([true, false])]);
  }
  write('calc', cases);
}

// ---- 空き状況（dayFree・freeText・freeCells・freeTextBlock）----
{
  const HH = () => { const h = int(0, 23), m = pick([0, 15, 30, 45]); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };
  const TYPES_A = [{ key: 'yoji', name: '用事', color: '#8B7AB8' }, { key: 'baito', name: 'バイト', color: '#7FAE85' }, { key: 'asobi', name: '遊び', color: '#D2916A' }, { key: 'other', name: 'その他', color: '#8A8A8A' }];
  const TYPES_B = [{ key: 'work', name: '仕事', color: '#6E85BE' }, { key: 'off', name: '休み', color: '#5FA8A2', free: true }, { key: 'yoji', name: '用事', color: '#8B7AB8' }, { key: 'baito', name: '勤務', color: '#7FAE85' }];
  const cases = [];
  for (let k = 0; k < 150; k++) {
    const app = new H.App({});
    const Y = 2026, M = int(0, 11);
    const types = rnd() < 0.5 ? TYPES_A : TYPES_B;
    const settings = { ...app.state.settings, weekStart: int(0, 1) };
    if (rnd() < 0.7) settings.freeWd = pick([[540, 1320], [1140, 1380], [600, 1320], [540, 1260], [0, 1440]]);
    if (rnd() < 0.7) settings.freeHd = pick([[540, 1320], [600, 1320], [540, 1260]]);
    if (rnd() < 0.4) settings.workHours = { days: pick([[1, 2, 3, 4, 5], [1, 3, 5], []]), from: pick([540, 600]), to: pick([1080, 1140]) };
    if (rnd() < 0.3) settings.profile = pick(['work', 'student', 'shift', 'free', 'family']);
    const events = [];
    for (let i = 0; i < int(5, 40); i++) {
      const e = { id: 'e' + k + '-' + i, y: Y, m: pick([M, M, M, (M + 11) % 12, (M + 1) % 12]), day: int(1, 28), start: HH(), end: HH(),
        type: pick(['yoji', 'baito', 'asobi', 'work', 'off', 'family', 'other', 'zzz']), status: pick(['kakutei', 'kakutei', 'mikakutei', 'jisseki', 'nakunatta']) };
      if (e.status === 'jisseki' && rnd() < 0.5) e.actualEnd = HH();
      if (rnd() < 0.12) { e.allDay = true; if (rnd() < 0.5) e.days = int(2, 4); }
      events.push(e);
    }
    const overrides = {};
    for (let i = 0; i < int(0, 4); i++) overrides[Y + '-' + M + '-' + int(1, 28)] = pick(['○', '△', '×']);
    const today = { y: Y, m: M, d: int(1, 28) };
    const freeYM = { y: Y, m: pick([M, (M + 1) % 12]) };
    app.state = { ...app.state, types, settings, events, overrides, today, freeYM };
    const st = { types, settings, events, overrides, today, freeYM };
    const days = {};
    const dim = new Date(Y, M + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) days[d] = { free: app.dayFree(Y, M, d), text: app.freeText(Y, M, d, false), polite: app.freeText(Y, M, d, true) };
    const blocks = [];
    for (const range of ['2w', 'week', 'next', 'month']) for (const only of ['all', 'wd', 'hd']) for (const polite of [false, true]) {
      const so = { range, only, polite, name: rnd() < 0.3 ? 'Aさん' : '', sign: false };
      blocks.push({ so, out: app.freeTextBlock(so) });
    }
    cases.push({ st, Y, M, days: JSON.parse(JSON.stringify(days)), cells: JSON.parse(JSON.stringify(app.freeCells(Y, M))), blocks });
  }
  write('free', cases);
}
