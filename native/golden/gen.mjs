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
