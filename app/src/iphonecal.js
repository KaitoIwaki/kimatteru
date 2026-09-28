// iPhone のカレンダーとのつなぎ（取り込みとは別の2つ）。
//
//  1. 重ねて表示 … 選んだカレンダー（会社の Outlook、家族の共有カレンダーなど）の予定を、
//     開くたびに読み直して灰色の帯で並べる。LUKKO には保存しない。直すのは元のアプリで。
//  2. 書き出し   … 決まった予定を、iPhone のカレンダーの「LUKKO」という1つのカレンダーにも入れる。
//     Apple Watch・Mac・会社の PC から見られるようにするため。まだの予定は入れない。
//
// どちらも最初はオフ。オンにしない限り、iPhone のカレンダーには何も書かない
// （これまで「読むだけ・書き込まない」と約束してきたので、黙って変えない）。
// 端末の中だけのやりとりで、外には何も送らない。
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import { Capacitor } from '@capacitor/core';

const native = () => {
  try { return Capacitor.isNativePlatform(); } catch (e) { return false; }
};
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
const dayNo = (y, m, d) => Math.floor(Date.UTC(y, m, d) / 86400000);

export const EXPORT_TITLE = 'LUKKO';

/** 選べるカレンダーの一覧（誕生日・LUKKO 自身は除く） */
export async function listPhoneCalendars() {
  if (!native()) return [];
  try {
    const r = await CapacitorCalendar.listCalendars();
    return ((r && r.result) || [])
      .filter((c) => c && c.type !== 4 && c.title !== EXPORT_TITLE)
      .map((c) => ({ id: String(c.id), title: c.title || '（名前なし）', color: c.color || '#999', sub: !!(c.type === 3 || c.isSubscribed) }));
  } catch (e) {
    return [];
  }
}

/**
 * iPhone の予定を、このアプリの形にする（取り込みと重ね表示で共用）。
 * 日をまたぐ時刻の予定：24時間以内なら「22:00–翌6:00」のまま（アプリは終わりが始まりより前なら翌日と読む）。
 * それより長いものは終日の何日間にする（出張など）。前は 23:59 で切っていて、夜勤が途中で消えていた。
 */
export function toAppShape(e) {
  const sd = new Date(e.startDate);
  const ed = new Date(e.endDate || e.startDate);
  if (isNaN(sd.getTime())) return null;
  const base = { y: sd.getFullYear(), m: sd.getMonth(), day: sd.getDate() };
  const spanDays = dayNo(ed.getFullYear(), ed.getMonth(), ed.getDate()) - dayNo(base.y, base.m, base.day);
  // 読み出しでは allDay という名前で来る（書き込みは isAllDay）。前は isAllDay だけを見ていて、1日の終日の予定が 0:00–23:59 の時刻の予定になっていた
  const allDay = e.allDay != null ? e.allDay : e.isAllDay;
  if (allDay) {
    // 終日の終わりは「次の日の0時」で来ることが多い。その日は含めない
    const endIncl = (ed.getHours() === 0 && ed.getMinutes() === 0 && spanDays > 0) ? spanDays : spanDays + 1;
    return { ...base, start: '00:00', end: '23:59', allDay: true, days: Math.max(1, Math.min(60, endIncl)) };
  }
  const dur = ed.getTime() - sd.getTime();
  if (spanDays === 0) return { ...base, start: hhmm(sd), end: hhmm(ed), allDay: false };
  if (spanDays === 1 && dur <= 24 * 3600000) return { ...base, start: hhmm(sd), end: hhmm(ed), allDay: false };
  return { ...base, start: '00:00', end: '23:59', allDay: true, days: Math.max(1, Math.min(60, spanDays + 1)) };
}

/** 重ねて表示する予定を読む。from/to は Date */
export async function readOverlay(ids, from, to) {
  if (!native() || !ids || !ids.length) return [];
  try {
    const want = new Set(ids.map(String));
    const r = await CapacitorCalendar.listEventsInRange({ from: from.getTime(), to: to.getTime() });
    const out = [];
    for (const e of (r && r.result) || []) {
      if (!e || !want.has(String(e.calendarId))) continue;
      if (e.status === 'canceled') continue;
      const sh = toAppShape(e);
      if (!sh) continue;
      out.push({ ...sh, id: 'ov-' + e.id + '-' + sh.y + sh.m + sh.day, title: (e.title || '予定').trim(), overlay: true,
        status: 'kakutei', type: '__overlay', place: e.location || '' });
    }
    return out;
  } catch (e) {
    return [];
  }
}

/** 「LUKKO」カレンダーを探す。無ければ作る（iCloud か、この iPhone の中に） */
export async function ensureExportCalendar(knownId) {
  if (!native()) return null;
  try {
    const r = await CapacitorCalendar.listCalendars();
    const all = (r && r.result) || [];
    if (knownId && all.some((c) => String(c.id) === String(knownId))) return String(knownId);
    const found = all.find((c) => c.title === EXPORT_TITLE);
    if (found) return String(found.id);
    let sourceId;
    try {
      const src = (await CapacitorCalendar.fetchAllCalendarSources()).result || [];
      const pick = src.find((s) => /icloud/i.test(s.title || '')) || src.find((s) => s.type === 0 || s.type === 'local');
      if (pick) sourceId = String(pick.id);
    } catch (e) { /* 既定の置き場に作る */ }
    const made = await CapacitorCalendar.createCalendar({ title: EXPORT_TITLE, color: '#6E85BE', ...(sourceId ? { sourceId } : {}) });
    return made && made.id ? String(made.id) : null;
  } catch (e) {
    return null;
  }
}

const toTimes = (ev) => {
  const [sh, sm] = String(ev.start || '0:0').split(':').map(Number);
  const [eh, em] = String((ev.status === 'jisseki' ? (ev.actualEnd || ev.end) : ev.end) || '0:0').split(':').map(Number);
  if (ev.allDay) {
    const days = Math.max(1, Math.min(60, ev.days | 0 || 1));
    return { startDate: new Date(ev.y, ev.m, ev.day, 0, 0).getTime(), endDate: new Date(ev.y, ev.m, ev.day + days - 1, 23, 59).getTime(), isAllDay: true };
  }
  const s = new Date(ev.y, ev.m, ev.day, sh || 0, sm || 0);
  let e = new Date(ev.y, ev.m, ev.day, eh || 0, em || 0);
  if (e <= s) e = new Date(ev.y, ev.m, ev.day + 1, eh || 0, em || 0);
  return { startDate: s.getTime(), endDate: e.getTime(), isAllDay: false };
};

/**
 * 決まった予定を「LUKKO」カレンダーにそろえる。
 * map は { 予定の id: iPhone 側の id, … }。直った予定は直し、消えた・まだに戻った予定は消す。
 * 名前を隠す予定は「予定」として書く。返すのは新しい map
 */
export async function syncExport(events, calId, map, hideAll) {
  if (!native() || !calId) return map || {};
  const out = { ...(map || {}) };
  const want = new Map();
  for (const ev of events || []) {
    if (!ev || ev.overlay) continue;
    if (ev.status !== 'kakutei' && ev.status !== 'jisseki') continue;
    want.set(ev.id, ev);
  }
  // 消す：もう決まっていない・消えた予定
  for (const id of Object.keys(out)) {
    // '#id' は書いた中身の控え（署名）。予定の番号ではないので、ここでは消さない
    if (id.startsWith('#') || want.has(id)) continue;
    try { await CapacitorCalendar.deleteEvent({ id: out[id] }); } catch (e) { /* もう無い */ }
    delete out[id];
    delete out['#' + id];
  }
  // 作る・直す
  for (const [id, ev] of want) {
    const hidden = !!(ev.secret || hideAll);
    const body = {
      title: hidden ? '予定' : (ev.title || '予定'),
      // 空の文字は「場所を消す」として届く。undefined だと送られず、隠したあとも前の場所が残っていた
      calendarId: calId, location: hidden ? '' : (ev.place || ''),
      description: 'LUKKO から', url: (!hidden && ev.link) || undefined, ...toTimes(ev),
    };
    const sig = JSON.stringify(body);
    if (out[id] && out['#' + id] === sig) continue;
    // リンクは直す（modifyEvent）では消せない。前はリンクがあって今は無いときは、消して作り直す
    let prevUrl = false;
    try { prevUrl = !!(out['#' + id] && JSON.parse(out['#' + id]).url); } catch (e) { prevUrl = true; }
    if (out[id] && prevUrl && !body.url) {
      try { await CapacitorCalendar.deleteEvent({ id: out[id] }); } catch (e) { /* もう無い */ }
      delete out[id];
    }
    try {
      if (out[id]) await CapacitorCalendar.modifyEvent({ id: out[id], ...body });
      else { const r = await CapacitorCalendar.createEvent({ ...body, commit: true }); if (r && r.id) out[id] = String(r.id); }
      out['#' + id] = sig;
    } catch (e) {
      // 向こうで消されていた：作り直す
      try { const r = await CapacitorCalendar.createEvent({ ...body, commit: true }); if (r && r.id) { out[id] = String(r.id); out['#' + id] = sig; } } catch (e2) { /* あきらめる */ }
    }
  }
  // 署名（#id）だけ残ったものを片づける
  for (const k of Object.keys(out)) if (k.startsWith('#') && !out[k.slice(1)]) delete out[k];
  return out;
}

/** 書き出しをやめたとき、「LUKKO」カレンダーに書いた予定を消す */
export async function clearExport(map) {
  if (!native()) return;
  for (const [k, id] of Object.entries(map || {})) {
    if (k.startsWith('#')) continue;
    try { await CapacitorCalendar.deleteEvent({ id }); } catch (e) { /* もう無い */ }
  }
}
