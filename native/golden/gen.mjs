// 正解表（golden）を作る。いまの Web 版のコードをそのまま動かして、入力と答えを JSON に書き出す。
// SwiftUI 版の同じ計算は、この表と 1 つ残らず一致しなければならない（native/LukkoKit/Tests）。
//
// 実行：LUKKO_NODE_MODULES=<app/node_modules> node build-harness.mjs && node gen.mjs
// 地元の時刻は日本（端末と同じ）で作る。どの PC で作っても同じ表になるように
process.env.TZ = 'Asia/Tokyo';
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

// ---- 通知の予約（notify.js の buildSchedule・dayDigest・whenText・numericId）----
// 「いま」を決めて、その時刻から見た予約の並びを書き出す。時刻は地元の年・月・日・時・分で比べる（タイムゾーンに左右されない）
{
  const RealDate = Date;
  const cases = [];
  for (let k = 0; k < 120; k++) {
    const nowParts = [2026, int(0, 11), int(1, 28), int(0, 23), pick([0, 15, 30, 59])];
    const NOW = new RealDate(...nowParts).getTime();
    class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
    globalThis.Date = FakeDate;
    const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '15', '30', '45']);
    const events = [];
    for (let i = 0; i < int(0, 50); i++) {
      const base = new RealDate(nowParts[0], nowParts[1], nowParts[2] + int(-2, 9));
      const e = { id: pick(['e' + k + '-' + i, 'x' + i, '予定' + i, 12345 + i]), y: base.getFullYear(), m: base.getMonth(), day: base.getDate(), start: HH(), end: HH(),
        title: pick(['定例', '歯医者', 'バイト', '飲み会', '']), type: pick(['baito', 'baito', 'yoji', 'work']), status: pick(['kakutei', 'kakutei', 'mikakutei', 'jisseki', 'nakunatta']) };
      if (rnd() < 0.6) e.remindMin = pick([0, 5, 10, 30, 60, 90, 180, 1440, 2880, 10080, -5, '30']);
      if (rnd() < 0.15) { e.allDay = true; if (rnd() < 0.4) e.days = int(2, 3); }
      if (rnd() < 0.15) e.secret = true;
      if (rnd() < 0.3) e.place = pick(['会議室A', '品川', '']);
      if (rnd() < 0.2 && e.status === 'jisseki') e.actualEnd = HH();
      events.push(e);
    }
    const settings = { remind: rnd() < 0.6, morning: rnd() < 0.5, evening: rnd() < 0.5, weekly: rnd() < 0.5, hideTitles: rnd() < 0.2, notifyOff: rnd() < 0.08 };
    if (rnd() < 0.5) settings.morningAt = pick([360, 450, 480, 1439, '450']);
    const list = H.notify.buildSchedule(events, settings).map((n) => {
      const a = n.schedule.at;
      return { ...n, schedule: undefined, at: [a.getFullYear(), a.getMonth(), a.getDate(), a.getHours(), a.getMinutes()] };
    });
    const digests = [];
    for (let i = -1; i < 9; i++) { const d = new RealDate(nowParts[0], nowParts[1], nowParts[2] + i); digests.push([d.getFullYear(), d.getMonth(), d.getDate(), H.notify.dayDigest(events, d.getFullYear(), d.getMonth(), d.getDate(), false), H.notify.dayDigest(events, d.getFullYear(), d.getMonth(), d.getDate(), true)]); }
    cases.push({ now: nowParts, events, settings, schedule: JSON.parse(JSON.stringify(list)), digests: JSON.parse(JSON.stringify(digests)) });
    globalThis.Date = RealDate;
  }
  const ids = ['a', 'w' + 'e1', 'r12345', '予定', 'm' + 'Wed Oct 14 2026', '', 'x'.repeat(200), '😀絵文字'].map((s) => [s, H.notify.numericId(s)]);
  write('notify', { cases, ids });
}

// ---- .ics の書き出しと読み込み（ics.js の toIcs・parseIcs）----
{
  const RealDate = Date;
  const NOWP = [2026, 9, 15, 10, 30, 5];
  const NOW = new RealDate(...NOWP).getTime();
  class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
  globalThis.Date = FakeDate;
  const HH = () => String(int(0, 23)).padStart(rnd() < 0.2 ? 1 : 2, '0') + ':' + pick(['00', '05', '30', '45']);
  const exportCases = [];
  for (let k = 0; k < 60; k++) {
    const evs = [];
    for (let i = 0; i < int(0, 12); i++) {
      const e = { id: pick(['e' + i, '', 'id;with,comma' + i, 'ユーアイディ' + i]), y: 2026, m: int(0, 11), day: int(1, 31), start: HH(), end: HH(),
        title: pick(['定例', '', 'カンマ,セミコロン;改行\nあり', 'バックスラッシュ\\です', '長い長い長い長い長い長い長い長い長い長い長い長い長い長い長い長い長い長い長い長い名前の予定です😀']),
        type: pick(['yoji', 'baito', '', undefined]), status: pick(['kakutei', 'mikakutei', 'jisseki', 'nakunatta', undefined]) };
      if (rnd() < 0.2) { e.allDay = true; e.days = pick([1, 2, 5, 0, 61, undefined]); }
      if (rnd() < 0.3) e.actualEnd = HH();
      if (rnd() < 0.3) e.place = pick(['会議室A', '東京,渋谷']);
      if (rnd() < 0.3) e.memo = pick(['持ち物：筆記用具', '1行目\n2行目']);
      evs.push(e);
    }
    const text = H.ics.toIcs(evs, rnd() < 0.3 ? { name: '私の,予定' } : undefined);
    exportCases.push({ events: evs, text, parsed: H.ics.parseIcs(text) });
  }
  const SAMPLES = [
    // Google カレンダー風（TZID・くり返し・例外・差し替え・中止）
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART;TZID=Asia/Tokyo:20261005T190000\r\nDTEND;TZID=Asia/Tokyo:20261005T210000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=10\r\nEXDATE;TZID=Asia/Tokyo:20261008T190000\r\nUID:abc@google.com\r\nSUMMARY:塾\r\nLOCATION:駅前\\, 2階\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;TZID=Asia/Tokyo:20261012T200000\r\nDTEND;TZID=Asia/Tokyo:20261012T220000\r\nRECURRENCE-ID;TZID=Asia/Tokyo:20261012T190000\r\nUID:abc@google.com\r\nSUMMARY:塾（時間変更）\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261020T010000Z\r\nDTEND:20261020T030000Z\r\nUID:utc1\r\nSUMMARY:UTC の会議\r\nSTATUS:TENTATIVE\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261104\r\nUID:trip\r\nSUMMARY:旅行\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261030T120000\r\nDURATION:PT1H30M\r\nUID:dur\r\nSUMMARY:ランチ\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261031T120000\r\nUID:cx\r\nSTATUS:CANCELLED\r\nSUMMARY:中止\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
    // 毎日・隔週・毎月 31 日・毎年 2/29・UNTIL・日をまたぐ・折り返し
    'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261001T090000\nDTEND:20261001T100000\nRRULE:FREQ=DAILY;INTERVAL=3;UNTIL=20261020T000000Z\nUID:d3\nSUMMARY:3日ごと\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261003T090000\nDTEND:20261003T100000\nRRULE:FREQ=WEEKLY;INTERVAL=2\nUID:w2\nSUMMARY:隔週\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261031T090000\nDTEND:20261031T100000\nRRULE:FREQ=MONTHLY;COUNT=6\nUID:m31\nSUMMARY:月末\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20280229\nRRULE:FREQ=YEARLY;COUNT=3\nUID:y229\nSUMMARY:うるう日\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261010T220000\nDTEND:20261011T060000\nUID:night\nSUMMARY:夜勤\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261012T100000\nDTEND:20261012T110000\nUID:fold\nSUMMARY:とても長い名前の予定を折り返して書いた行がちゃんと読めるかどうかを\n  確かめるための予定\nDESCRIPTION:1行目\\n2行目\\,カンマ\\;セミコロン\\\\\nX-LUKKO-TYPE:baito\nX-LUKKO-STATUS:mikakutei\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART;X-PARAM="a:b";VALUE=DATE:20261015\nUID:q\nSUMMARY:引数に：\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:bad\nUID:bad\nSUMMARY:読めない\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261016T090000\nRRULE:FREQ=HOURLY;COUNT=3\nUID:hr\nSUMMARY:時間ごと（非対応）\nEND:VEVENT\nEND:VCALENDAR\n',
    // 何も無い・壊れている
    '', 'BEGIN:VEVENT\nSUMMARY:閉じていない', 'こんにちは',
    // 終わりの無いくり返し（1 年先まで）、BYDAY の数字つき
    'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261002T180000\nDTEND:20261002T190000\nRRULE:FREQ=WEEKLY;BYDAY=FR\nUID:inf\nSUMMARY:毎週金曜\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261002T180000\nDTEND:20261002T190000\nRRULE:FREQ=WEEKLY;BYDAY=1MO,-1SU\nUID:num\nSUMMARY:番号つき\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261002T180000\nRRULE:FREQ=DAILY\nUID:many\nSUMMARY:毎日（120回まで）\nEND:VEVENT\nEND:VCALENDAR\n',
  ];
  const parseCases = SAMPLES.map((text) => ({ text, parsed: H.ics.parseIcs(text) }));
  globalThis.Date = RealDate;
  write('ics', { now: NOWP, exportCases: JSON.parse(JSON.stringify(exportCases)), parseCases: JSON.parse(JSON.stringify(parseCases)) });
}

// ---- 取り込み（calendarimport.js の diffImport・dedupe・guessTypes）----
{
  const TITLES = ['定例', '会議', 'MTG', 'ｍｔｇ 週次', '1on1', 'バイト', 'カフェ バイト', 'シフト', '早番', '夜勤', '公休', '有給', '歯医者', '塾', 'ジム', '飲み会', 'ランチ', '映画', '誕生日',
    '在宅勤務', '勤務', '研修', '旅行', 'お茶', '', 'ＡＢＣ商事', 'abc商事 打ち合わせ', '病院', 'Ｂｂｑ', 'テスト勉強', '自分の種類の予定'];
  const HH = () => pick(['09:00', '10:00', '13:00', '17:00', '18:00', '22:00', '06:00', '00:00', '23:59']);
  const mkIn = (i) => ({ srcId: rnd() < 0.85 ? 'src' + int(1, 12) : '', title: pick(TITLES), y: 2026, m: int(8, 10), day: int(1, 28), start: HH(), end: HH(),
    allDay: rnd() < 0.1, days: pick([1, 2, undefined]), place: pick(['', '会議室', undefined]), srcCal: pick(['c1', 'c2', undefined]) });
  const TYPESETS = [
    [{ key: 'yoji', name: '用事' }, { key: 'baito', name: 'バイト' }, { key: 'asobi', name: '遊び' }, { key: 'other', name: 'その他' }],
    [{ key: 'work', name: '仕事' }, { key: 'yoji', name: '用事' }, { key: 'asobi', name: 'プライベート' }, { key: 'family', name: '家族' }, { key: 'other', name: 'その他' }, { key: 'baito', name: 'バイト', hidden: true }],
    [{ key: 'baito', name: '勤務' }, { key: 'off', name: '休み' }, { key: 'yoji', name: '用事' }, { key: 'asobi', name: 'プライベート' }, { key: 'c9', name: '自分の種類' }],
    [{ key: 'asobi', name: '遊び' }, { key: 'baito', name: 'バイト' }],
    [],
  ];
  const cases = [];
  for (let k = 0; k < 200; k++) {
    const incoming = Array.from({ length: int(0, 30) }, (_, i) => mkIn(i));
    // くり返しの回を増やす（同じ番号・同じ名前・同じ時間帯）
    if (rnd() < 0.5 && incoming.length) { const b = incoming[0]; for (let j = 1; j <= int(2, 6); j++) incoming.push({ ...b, day: Math.min(28, b.day + j * 7) }); }
    const existing = Array.from({ length: int(0, 20) }, (_, i) => {
      const e = { ...mkIn(i), id: 'x' + i, status: pick(['kakutei', 'mikakutei', 'nakunatta']) };
      if (rnd() < 0.3) e.srcId = '';
      return e;
    });
    // いくつかは incoming と同じ中身にする（直っていない・重なる）
    for (const e of incoming.slice(0, 3)) if (rnd() < 0.5) existing.push({ ...e, id: 'dup' + existing.length, status: 'kakutei' });
    const range = pick([null, { from: H.AppMod.dayNo(2026, 8, 1), to: H.AppMod.dayNo(2026, 10, 30) }, { from: H.AppMod.dayNo(2026, 9, 1), to: H.AppMod.dayNo(2026, 9, 31), cals: ['c1'] }]);
    const types = pick(TYPESETS);
    const diff = H.calendarimport.diffImport(incoming, existing, range);
    cases.push({ incoming, existing, range, types,
      diff: { fresh: diff.fresh.map((e) => incoming.indexOf(e)), changed: diff.changed.map((c) => [incoming.indexOf(c.incoming), existing.indexOf(c.existing)]), gone: diff.gone.map((e) => existing.indexOf(e)) },
      dedupe: H.calendarimport.dedupe(incoming, existing).map((e) => incoming.indexOf(e)),
      guess: H.calendarimport.guessTypes(incoming, types) });
  }
  write('import', JSON.parse(JSON.stringify(cases)));
}

// ---- iCloud で 2 台をそろえる（sync.js の packForSync・mergeSync）----
{
  const cases = [];
  const ev = (id) => ({ id, y: 2026, m: 9, day: int(1, 28), start: '10:00', end: '11:00', title: 't' + id, ...(rnd() < 0.8 ? { updatedAt: int(1, 100) } : {}) });
  for (let k = 0; k < 300; k++) {
    const ids = Array.from({ length: 12 }, (_, i) => pick(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 1, 2, '']) + (rnd() < 0.5 ? '' : i));
    const local = {
      events: ids.slice(0, int(0, 8)).filter(() => rnd() < 0.8).map(ev),
      trash: rnd() < 0.5 ? [{ ev: { id: pick(ids) }, at: int(1, 100) }, { ev: null, at: 5 }, { at: 3 }] : [],
      gone: rnd() < 0.5 ? [[pick(ids), int(1, 100)], ['job:j' + int(1, 3), int(1, 100)], ['type:t' + int(1, 3), int(1, 100)], [pick(['s1', 's2']), int(1, 100)]] : [],
      types: [{ key: 't1' }, { key: 't2' }].filter(() => rnd() < 0.7),
      jobs: [{ id: 'j1' }, { id: 'j2' }].filter(() => rnd() < 0.7),
      someday: [{ id: 's1', at: int(0, 100) }, { id: 's2' }].filter(() => rnd() < 0.7),
    };
    const remote = rnd() < 0.08 ? pick([null, {}, { events: 'x' }]) : {
      v: 1,
      events: [...ids.slice(int(0, 6)).filter(() => rnd() < 0.7).map(ev), ...(rnd() < 0.2 ? [null, { title: 'no id' }] : [])],
      types: [{ key: 't1' }, { key: 't3' }, null].filter(() => rnd() < 0.7),
      jobs: [{ id: 'j2' }, { id: 'j3' }].filter(() => rnd() < 0.7),
      someday: [{ id: 's2', at: int(0, 100) }, { id: 's3' }, null].filter(() => rnd() < 0.7),
      tomb: [[pick(ids), int(1, 100)], [pick(ids), int(1, 100)], ['job:j' + int(1, 3), int(1, 100)], ['type:t' + int(1, 3), 0], ['', 5], [null, 3]].filter(() => rnd() < 0.6),
    };
    cases.push({ local, remote, pack: H.sync.packForSync(local), merged: H.sync.mergeSync(local, remote) });
  }
  write('sync', JSON.parse(JSON.stringify(cases)));
}

// ---- ウィジェットに渡す中身（widgetdata.js の buildWidgetPayload・memoLines）----
{
  const RealDate = Date;
  const cases = [];
  const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '15', '30']);
  for (let k = 0; k < 120; k++) {
    const today = new RealDate(2026, int(0, 11), int(1, 28), int(0, 23), int(0, 59));
    const events = [];
    for (let i = 0; i < int(0, 40); i++) {
      const base = new RealDate(today.getFullYear(), today.getMonth(), today.getDate() + int(-35, 35));
      const e = { id: pick(['w' + i, '', 7 + i]), y: base.getFullYear(), m: base.getMonth(), day: base.getDate(), start: HH(), end: HH(),
        title: pick(['定例', '', '  空白つき  ', 'とても長い名前の予定ですとても長い名前の予定です', 'バイト']), type: pick(['yoji', 'baito', 'zzz']),
        status: pick(['kakutei', 'mikakutei', 'jisseki', 'nakunatta']) };
      if (rnd() < 0.15) { e.allDay = true; if (rnd() < 0.6) e.days = int(2, 9); }
      if (rnd() < 0.2) e.secret = true;
      if (rnd() < 0.3) e.memo = pick(['筆記用具\n名札\r\n上履き', '  \n\n', '一行だけのとても長い持ち物の説明をここに書きます', 'a\nb\nc\nd\ne\nf\ng\nh']);
      if (e.status === 'jisseki' && rnd() < 0.5) e.actualEnd = HH();
      events.push(e);
    }
    const state = { events, types: [{ key: 'yoji', color: '#8B7AB8' }, { key: 'baito', color: '#7FAE85' }, { key: 'x' }], settings: { weekStart: pick([0, 1, '1', undefined]), hideTitles: rnd() < 0.2 } };
    const p = H.widgetdata.buildWidgetPayload(state, today);
    cases.push({ state, today: [today.getFullYear(), today.getMonth(), today.getDate(), today.getHours(), today.getMinutes()], at: today.getTime(), payload: p });
  }
  write('widget', JSON.parse(JSON.stringify(cases)));
}
