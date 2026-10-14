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
