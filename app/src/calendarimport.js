import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import { Capacitor } from '@capacitor/core';
import { holidayName } from './holidays';

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
      // iPhone に入っている「日本の祝日」カレンダーは取り込まない。
      // このアプリは祝日を日付の色で示すので、予定として重ねる意味がない。
      //
      // 以前は isAllDay も条件にしていたが、それだと終日として渡ってこない
      // 祝日を弾けず、日付の色と予定の帯で二重に出てしまっていた（山の日が実例）。
      // その日の祝日名と名前が一致するなら、終日かどうかに関わらず祝日とみなす。
      const title = (e.title || '').trim();
      const hol = holidayName(sd.getFullYear(), sd.getMonth(), sd.getDate());
      const squash = (s) => s.replace(/\s+/g, ''); // 比較のときだけ空白を無視する
      if (hol && squash(title) === squash(hol)) return null;
      return {
        srcId: String(e.id),
        title: title || '無題',
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

// ---- 取り込んだ予定に、種類を当てる ----
//
// 取り込みで手に入るのは「名前」と「時刻」だけ（元のカレンダー名は取っていない）。
// なので名前の言葉と、繰り返し方から当てにいく。外れても、取り込みの画面で
// 1件ずつ直せる。全部を自分で選ばせるより、外れを直すほうが早い。
//
// 名前は人によって書き方が違うので、当たらないほうが多い前提で作る。
// 当たらなかったものは「用事」に置く（これまでと同じ）。
const KEYWORDS = [
  { key: 'baito', words: ['バイト', 'アルバイト', 'シフト', '勤務', '出勤', '早番', '遅番', '日勤', '夜勤'] },
  { key: 'yoji', words: ['病院', '歯医者', '歯科', 'クリニック', '医院', '通院', '診察', '健診', '健康診断',
    '予防接種', '銀行', '役所', '郵便局', '美容院', '美容室', '床屋', 'サロン', 'ネイル',
    '提出', '締切', '締め切り', '面接', '面談', '手続き', '車検', '引っ越し', '引越',
    '打ち合わせ', '打合せ', '会議', 'ミーティング', 'mtg', '説明会', '授業', '講義', '試験', 'テスト'] },
  { key: 'asobi', words: ['飲み', 'のみ会', 'ランチ', 'ディナー', 'ごはん', 'ご飯', '映画', 'ライブ',
    'コンサート', 'フェス', '旅行', '温泉', '誕生日', '誕生会', 'カラオケ', 'bbq', 'バーベキュー',
    '花火', 'デート', '観光', '買い物', 'ショッピング', '遊び', '遊ぶ', 'パーティ'] },
];

// 全角の英数を半角に落として、大文字小文字も無視する（MTG と ｍｔｇ を同じに）
const norm = (s) => String(s || '')
  .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  .toLowerCase();

const mins = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

/**
 * 種類を当てる。types は利用者の種類の一覧。
 * 戻り値は list と同じ長さの配列で、各要素は { key, why }。
 * why は当てた理由（'name' 種類の名前 / 'word' 言葉 / 'repeat' 繰り返し / '' 当たらなかった）。
 */
export function guessTypes(list, types) {
  const has = (k) => (types || []).some((t) => t.key === k);
  const fallback = has('yoji') ? 'yoji' : ((types || [])[0] || {}).key;

  // 同じ名前・同じ時間帯が何回出てくるか。バイトのシフトは、これが多い。
  const runs = new Map();
  for (const e of list) {
    const k = norm(e.title) + '@' + e.start + '-' + e.end;
    runs.set(k, (runs.get(k) || 0) + 1);
  }

  return list.map((e) => {
    const title = norm(e.title);

    // 1. 利用者が作った種類の名前が、そのまま入っている（いちばん確かな手がかり）
    for (const t of types || []) {
      const n = norm(t.name);
      if (n.length >= 2 && title.includes(n)) return { key: t.key, why: 'name' };
    }

    // 2. よくある言葉
    for (const g of KEYWORDS) {
      if (!has(g.key)) continue;
      if (g.words.some((w) => title.includes(norm(w)))) return { key: g.key, why: 'word' };
    }

    // 3. 同じ名前・同じ時間帯が3回以上あって、しかも3時間以上続く。
    //    週1の会議のような短いものを拾わないように、長さで線を引く。
    //    ここを緩めると、給料の集計に関係ない予定がバイトに入ってしまう。
    if (has('baito') && !e.allDay) {
      const n = runs.get(norm(e.title) + '@' + e.start + '-' + e.end) || 0;
      const len = mins(e.end) - mins(e.start);
      if (n >= 3 && len >= 180) return { key: 'baito', why: 'repeat' };
    }

    return { key: fallback, why: '' };
  });
}
