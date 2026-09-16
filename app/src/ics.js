// .ics（iCalendar）の書き出しと読み込み。
//
// ここが「予定の出し入れ」の配管になる。ほかのカレンダーからの取り込み、
// 旅行の予定をまとめて渡す、PC との橋渡し——全部この形式に乗る。
// ユーザーが「.ics」と意識して押すことはほぼ無いが、下では全部これ。
//
// 書き出すときは「まだ」を STATUS:TENTATIVE で運ぶ。.ics に「まだ」という
// 状態は無いが、TENTATIVE（仮）が一番近い。種類と実績は X-LUKKO-* で添える。
// 他のアプリはそれを無視するだけで、LUKKO 同士なら丸ごと戻る。
//
// 時刻はタイムゾーン無しの「その土地の時刻」で書く（20260904T190000）。
// このアプリは時差を扱わないので、Z や TZID を付けると逆に狂う。
// 読むときは Z（UTC）だけ端末の時刻に直し、TZID は壁の時計の時刻として読む。

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}${pad(m + 1)}${pad(d)}`;
// 「\」「;」「,」「改行」は .ics の中では別の書き方になる（RFC 5545 の TEXT）
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const unesc = (s) => String(s || '').replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
const enc = new TextEncoder();

// 1行は75オクテットまで。超えたら次の行の頭に空白を置いて続ける（折り返し）。
// 日本語は1文字3バイトなので、文字数ではなくバイトで数える
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 74) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

const addDays = (y, m, d, n) => { const t = new Date(y, m, d + n); return [t.getFullYear(), t.getMonth(), t.getDate()]; };
const mins = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };

/**
 * 予定の一覧を .ics の文字列にする。無くなった予定は書かない。
 */
export function toIcs(events, { name = 'LUKKO' } = {}) {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LUKKO//LUKKO//JA', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`];
  for (const e of events) {
    if (!e || e.status === 'nakunatta') continue;
    const y = e.y, m = e.m, d = e.day;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${esc(e.id || 'x')}@lukko`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`SUMMARY:${esc(e.title || '無題')}`);
    if (e.allDay) {
      const span = Math.max(1, Math.min(60, (e.days | 0) || 1));
      const [ey, em, ed] = addDays(y, m, d, span);
      lines.push(`DTSTART;VALUE=DATE:${ymd(y, m, d)}`);
      lines.push(`DTEND;VALUE=DATE:${ymd(ey, em, ed)}`);
    } else {
      const [sh, sm] = String(e.start || '00:00').split(':');
      const end = e.actualEnd && e.status === 'jisseki' ? e.actualEnd : (e.end || e.start || '00:00');
      const [eh, emn] = String(end).split(':');
      // 終わりが始まりより前なら、日をまたいでいる（17:00–00:35）
      const [ey, em, ed] = mins(end) < mins(e.start) ? addDays(y, m, d, 1) : [y, m, d];
      lines.push(`DTSTART:${ymd(y, m, d)}T${pad(sh)}${pad(sm)}00`);
      lines.push(`DTEND:${ymd(ey, em, ed)}T${pad(eh)}${pad(emn)}00`);
    }
    lines.push(`STATUS:${e.status === 'mikakutei' ? 'TENTATIVE' : 'CONFIRMED'}`);
    if (e.type) lines.push(`X-LUKKO-TYPE:${esc(e.type)}`);
    if (e.status) lines.push(`X-LUKKO-STATUS:${esc(e.status)}`);
    if (e.place) lines.push(`LOCATION:${esc(e.place)}`);
    if (e.memo) lines.push(`DESCRIPTION:${esc(e.memo)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// ---- 読む ----

// 折り返しを戻して、VEVENT ごとの [{ name, params, value }] にする
function blocks(text) {
  const raw = String(text || '').replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = [];
  let cur = null;
  for (const line of raw) {
    if (line === 'BEGIN:VEVENT') { cur = []; continue; }
    if (line === 'END:VEVENT') { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    // 名前;引数:値。引数の中の「"」で囲まれた「:」は区切りではない
    let i = 0, q = false;
    while (i < line.length) { const c = line[i]; if (c === '"') q = !q; else if (c === ':' && !q) break; i += 1; }
    if (i >= line.length) continue;
    const head = line.slice(0, i).split(';');
    const params = {};
    for (const p of head.slice(1)) { const k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); }
    cur.push({ name: head[0].toUpperCase(), params, value: line.slice(i + 1) });
  }
  return out;
}

// 20260904T190000 / 20260904T190000Z / 20260904 → { y, m, d, hh, mm, allDay }
function parseDt(value, params) {
  const s = String(value || '').trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const allDay = (params && params.VALUE === 'DATE') || !m[4];
  if (allDay) return { y: +m[1], m: +m[2] - 1, d: +m[3], hh: 0, mm: 0, allDay: true };
  if (m[7]) { // UTC。端末の時刻に直す
    const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate(), hh: t.getHours(), mm: t.getMinutes(), allDay: false };
  }
  return { y: +m[1], m: +m[2] - 1, d: +m[3], hh: +m[4], mm: +m[5], allDay: false };
}

// PT1H30M / P1D → 分
function parseDuration(s) {
  const m = String(s || '').match(/^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 7 * 1440 + (+(m[2] || 0)) * 1440 + (+(m[3] || 0)) * 60 + (+(m[4] || 0));
}

const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const dayKey = (y, m, d) => `${y}-${m}-${d}`;

/**
 * くり返し（RRULE）を、実際の日に広げる。
 * 対応するのは DAILY / WEEKLY（BYDAY あり）/ MONTHLY（同じ日）/ YEARLY。
 * COUNT と UNTIL を見る。終わりが無ければ 1 年先まで。多くても 120 回。
 * 塾・ジム・バイトのシフトのような「毎週」を落とさないための、最小の対応。
 */
function expand(start, rrule, exdates, limitTo) {
  const r = {};
  for (const p of String(rrule).split(';')) { const k = p.indexOf('='); if (k > 0) r[p.slice(0, k).toUpperCase()] = p.slice(k + 1).toUpperCase(); }
  const freq = r.FREQ, interval = Math.max(1, +(r.INTERVAL || 1));
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return [[start.y, start.m, start.d]];
  const count = r.COUNT ? +r.COUNT : Infinity;
  const until = r.UNTIL ? parseDt(r.UNTIL, {}) : null;
  const untilT = until ? new Date(until.y, until.m, until.d, 23, 59, 59).getTime() : limitTo;
  const byday = freq === 'WEEKLY' && r.BYDAY ? r.BYDAY.split(',').map((x) => DOW[x.slice(-2)]).filter((x) => x != null) : null;
  const out = [];
  const first = new Date(start.y, start.m, start.d);
  // COUNT は EXDATE で除く前の回数（RFC 5545）。除いた分は数に入れる
  let guard = 0, done = false, seen = 0;
  for (let i = 0; !done && guard < 2000; i += 1, guard += 1) {
    const cands = [];
    if (freq === 'WEEKLY') {
      const base = new Date(first); base.setDate(first.getDate() - first.getDay() + i * 7 * interval);
      for (const dow of (byday || [first.getDay()])) { const t = new Date(base); t.setDate(base.getDate() + dow); if (t >= first) cands.push(t); }
    } else if (freq === 'DAILY') { const t = new Date(first); t.setDate(first.getDate() + i * interval); cands.push(t); }
    else if (freq === 'MONTHLY') { const t = new Date(first.getFullYear(), first.getMonth() + i * interval, first.getDate()); if (t.getDate() === first.getDate()) cands.push(t); }
    else { const t = new Date(first.getFullYear() + i * interval, first.getMonth(), first.getDate()); cands.push(t); }
    for (const t of cands.sort((a, b) => a - b)) {
      if (t.getTime() > untilT) { done = true; break; }
      seen += 1;
      if (!exdates.has(dayKey(t.getFullYear(), t.getMonth(), t.getDate()))) out.push([t.getFullYear(), t.getMonth(), t.getDate()]);
      if (seen >= count || out.length >= 120) { done = true; break; }
    }
    if (!cands.length && freq !== 'MONTHLY') break;
  }
  return out.length ? out : [[start.y, start.m, start.d]];
}

/**
 * .ics の文字列を、取り込みの一覧に渡せる形にする。
 * 戻り値の1件: { srcId, title, y, m, day, start, end, allDay, days, tentative, ltype, lstatus, place, memo }
 * 日をまたぐ時間つきの予定は、その日の終わり（23:59）までとして置く（カレンダーの取り込みと同じ）。
 */
export function parseIcs(text) {
  const out = [];
  const now = new Date();
  const limitTo = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).getTime();
  const evs = blocks(text);
  // RECURRENCE-ID を持つものは、くり返しの中の1回を差し替えたもの。元の日は除く
  const overridden = new Map();
  for (const ev of evs) {
    const rid = ev.find((p) => p.name === 'RECURRENCE-ID'), uid = ev.find((p) => p.name === 'UID');
    if (!rid || !uid) continue;
    const d = parseDt(rid.value, rid.params);
    if (!d) continue;
    if (!overridden.has(uid.value)) overridden.set(uid.value, new Set());
    overridden.get(uid.value).add(dayKey(d.y, d.m, d.d));
  }
  let k = 0;
  for (const ev of evs) {
    const get = (n) => ev.find((p) => p.name === n);
    const val = (n) => (get(n) ? get(n).value : '');
    const ds = get('DTSTART'); if (!ds) continue;
    const start = parseDt(ds.value, ds.params); if (!start) continue;
    const st = val('STATUS').toUpperCase();
    if (st === 'CANCELLED') continue;
    let end = get('DTEND') ? parseDt(get('DTEND').value, get('DTEND').params) : null;
    if (!end && get('DURATION')) {
      const t = new Date(start.y, start.m, start.d, start.hh, start.mm + parseDuration(val('DURATION')));
      end = { y: t.getFullYear(), m: t.getMonth(), d: t.getDate(), hh: t.getHours(), mm: t.getMinutes(), allDay: start.allDay };
    }
    const title = unesc(val('SUMMARY')).trim() || '無題';
    const uid = val('UID') || ('u' + k);
    const exdates = new Set(overridden.get(uid) || []);
    for (const ex of ev.filter((p) => p.name === 'EXDATE')) {
      for (const v of ex.value.split(',')) { const d = parseDt(v, ex.params); if (d) exdates.add(dayKey(d.y, d.m, d.d)); }
    }
    const days = get('RRULE') && !get('RECURRENCE-ID') ? expand(start, val('RRULE'), exdates, limitTo) : [[start.y, start.m, start.d]];
    // 終日の長さ（DTEND は次の日を指すので、差がそのまま日数）
    let span = 1;
    if (start.allDay && end) span = Math.max(1, Math.min(60, Math.round((new Date(end.y, end.m, end.d) - new Date(start.y, start.m, start.d)) / 86400000)));
    const sameDay = end && end.y === start.y && end.m === start.m && end.d === start.d;
    const endHm = !start.allDay && end && sameDay ? `${pad(end.hh)}:${pad(end.mm)}` : '23:59';
    for (const [y, m, d] of days) {
      out.push({
        srcId: `${uid}#${y}-${m}-${d}`, title, y, m, day: d,
        start: start.allDay ? '00:00' : `${pad(start.hh)}:${pad(start.mm)}`,
        end: start.allDay ? '23:59' : endHm,
        allDay: start.allDay, days: span,
        tentative: st === 'TENTATIVE',
        ltype: val('X-LUKKO-TYPE'), lstatus: val('X-LUKKO-STATUS'),
        place: unesc(val('LOCATION')), memo: unesc(val('DESCRIPTION')),
      });
      k += 1;
    }
  }
  return out.sort((a, b) => (a.y - b.y) || (a.m - b.m) || (a.day - b.day) || a.start.localeCompare(b.start));
}
