import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import { Capacitor } from '@capacitor/core';

const native = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
};

// 取り込みは実機だけの機能。?import=1 を付けると、PCのブラウザでも画面の確認だけできる
// （実際に読もうとすると「この端末では使えません」と出る）。
const forced = () => {
  try {
    return new URLSearchParams(location.search).get('import') === '1';
  } catch (e) {
    return false;
  }
};

export const canImport = () => native() || forced();

// 許可が下りなかったときに、設定アプリのこのアプリのページを開く。
// App.openUrl('app-settings:') は canOpenURL に弾かれて動かないので、
// 専用プラグインを使う。
export async function openAppSettings() {
  if (!native()) return false;
  try {
    const { NativeSettings, IOSSettings } = await import('capacitor-native-settings');
    await NativeSettings.openIOS({ option: IOSSettings.App });
    return true;
  } catch (e) {
    return false;
  }
}

// すでに許可されているかを、ダイアログを出さずに確かめる
export async function checkCalendarAccess() {
  if (!native()) return 'unavailable';
  try {
    const r = await CapacitorCalendar.checkPermission({ scope: 'readCalendar' });
    return r && r.result === 'granted' ? 'granted' : r && r.result === 'denied' ? 'denied' : 'prompt';
  } catch (e) {
    return 'prompt';
  }
}

/**
 * カレンダーを読む許可をもらう。
 * iOS 17 以降は「読むだけ」の権限が存在せず、読み取りにも Full Access が要る。
 * （requestReadOnlyCalendarAccess は Android 専用で、iOS では何も起きない）
 */
export async function askCalendarAccess() {
  if (!native()) return 'unavailable';
  try {
    const cur = await checkCalendarAccess();
    if (cur === 'granted') return 'granted';
    const r = await CapacitorCalendar.requestFullCalendarAccess();
    return r && r.result === 'granted' ? 'granted' : 'denied';
  } catch (e) {
    return 'denied';
  }
}

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());

/**
 * 前後の期間ぶんの予定を読み、このアプリの形に変換して返す。
 * 読むだけで、端末の外には出さない。
 */
export async function readCalendarEvents({ monthsBack = 1, monthsAhead = 12 } = {}) {
  if (!native()) return [];
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + monthsAhead + 1, 0, 23, 59, 59).getTime();

  const res = await CapacitorCalendar.listEventsInRange({ from, to });
  const list = (res && res.result) || [];

  return list
    .map((e) => {
      const sd = new Date(e.startDate);
      const ed = new Date(e.endDate || e.startDate);
      if (isNaN(sd.getTime())) return null;
      return {
        srcId: String(e.id),
        title: (e.title || '').trim() || '無題',
        y: sd.getFullYear(),
        m: sd.getMonth(),
        day: sd.getDate(),
        start: hhmm(sd),
        // 日をまたぐ予定は、その日の終わりまでとして置く
        end: e.isAllDay ? '23:59' : (ed.toDateString() === sd.toDateString() ? hhmm(ed) : '23:59'),
        allDay: !!e.isAllDay,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.y - b.y) || (a.m - b.m) || (a.day - b.day) || a.start.localeCompare(b.start));
}

// 同じ日・同じ時刻・同じ名前のものは、すでに入っているとみなす
export function dedupe(incoming, existing) {
  const key = (e) => `${e.y}-${e.m}-${e.day}-${e.start}-${e.title}`;
  const seen = new Set(existing.map(key));
  const out = [];
  for (const e of incoming) {
    const k = key(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
