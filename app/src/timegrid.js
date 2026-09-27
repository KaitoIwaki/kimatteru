// 週表示と、日の「時間」表示の並べ方。
//
// 月表示は「その日に何があるか」には答えるが、「何時から何時まで、どこが空いているか」には
// 答えない。会議の多い人には、それが毎日の問い。ここでは予定を時刻の目盛りの上に箱で置く。
// 決まった予定は塗りの箱、まだの予定は点線の箱——月表示と同じ決まりのまま。
//
// ここは計算だけ（画面も保存も持たない）なので、Node でそのまま試せる。

export const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const dayNo = (y, m, d) => Math.floor(Date.UTC(y, m, d) / 86400000);
const span = (e) => Math.max(1, Math.min(60, (e && e.days) | 0 || 1));

/**
 * 1日ぶんの、時刻のある予定の区間を作る。
 * 日をまたぐ予定（22:00–翌6:00 の夜勤）は、始まった日に 22:00–24:00、
 * 次の日に 0:00–6:00 として出す。前は次の日に何も出ず、夜勤明けの朝が
 * 「まるごと空いている」ように見えた。
 *
 * @returns [{ ev, a, b, cont }]  a/b はその日の 0 時からの分。cont は前の日からの続き
 */
export function segmentsForDay(events, y, m, d) {
  const n = dayNo(y, m, d);
  const out = [];
  for (const e of events || []) {
    if (!e || e.allDay) continue;
    const start = toMin(e.start);
    const end = toMin(e.status === 'jisseki' ? (e.actualEnd || e.end) : e.end);
    const f = dayNo(e.y, e.m, e.day);
    const wraps = end <= start && end !== start;
    const same = end === start; // 同じ時刻は24時間（当直）とみなす
    if (f === n) out.push({ ev: e, a: start, b: wraps || same ? 1440 : end, cont: false });
    else if ((wraps || same) && f === n - 1 && (same ? start : end) > 0) out.push({ ev: e, a: 0, b: same ? start : end, cont: true });
  }
  return out;
}

/**
 * 重なった箱を横に並べる。重なりのかたまりごとに列の数を決め、
 * かたまりの中では空いている左の列から詰める（カレンダーでよくある並べ方）。
 * @returns 同じ並びの配列に col（何列目）と cols（そのかたまりの列の数）を足したもの
 */
export function layoutColumns(segs) {
  const list = segs.map((s) => ({ ...s, b: Math.max(s.b, s.a + 15) }))
    .sort((x, y) => (x.a - y.a) || (y.b - x.b));
  const out = [];
  let group = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = [];
    for (const s of group) {
      let c = 0;
      while (cols[c] !== undefined && cols[c] > s.a) c++;
      cols[c] = s.b;
      s.col = c;
    }
    for (const s of group) s.cols = cols.length;
    out.push(...group);
    group = [];
  };
  for (const s of list) {
    if (group.length && s.a >= groupEnd) { flush(); groupEnd = -1; }
    group.push(s);
    groupEnd = Math.max(groupEnd, s.b);
  }
  if (group.length) flush();
  return out;
}

/** その日にかかる終日の予定（何日も続くものも） */
export function allDayFor(events, y, m, d) {
  const n = dayNo(y, m, d);
  return (events || []).filter((e) => e && e.allDay && dayNo(e.y, e.m, e.day) <= n && dayNo(e.y, e.m, e.day) + span(e) - 1 >= n);
}

/** 週のはじまりの日番号。weekStart は 0=日曜 1=月曜 */
export function weekStartNo(y, m, d, weekStart) {
  const dow = new Date(y, m, d).getDay();
  return dayNo(y, m, d) - ((dow - weekStart + 7) % 7);
}
