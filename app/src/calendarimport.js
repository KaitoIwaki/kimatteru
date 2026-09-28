import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import { Capacitor } from '@capacitor/core';
import { holidayName } from './holidays';
import { toAppShape } from './iphonecal';

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
export async function readCalendarEvents({ monthsBack = 1, monthsAhead = 12, calIds = null, fromDate = null } = {}) {
  if (!native()) return [];
  const now = new Date();
  const from = (fromDate || new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + monthsAhead + 1, 0, 23, 59, 59).getTime();
  const pick = calIds && calIds.length ? new Set(calIds.map(String)) : null;

  // 誕生日のカレンダー（連絡先から作られるもの）と、購読しているカレンダー（祝日・行事など）は
  // 読まない。本人の予定ではないのに用事として入り、まとめで時間に数えられていた
  // （七夕・七五三・○○さんの誕生日、が 23時間59分 ずつ）。
  // 3 = SUBSCRIPTION、4 = BIRTHDAY（@ebarooni/capacitor-calendar の CalendarType）
  const skip = new Set();
  try {
    const cals = await CapacitorCalendar.listCalendars();
    for (const c of (cals && cals.result) || []) if (c && (c.type === 3 || c.type === 4 || c.isSubscribed)) skip.add(String(c.id));
  } catch (e) { /* 一覧が取れなくても、読むこと自体は続ける */ }

  const res = await CapacitorCalendar.listEventsInRange({ from, to });
  const list = ((res && res.result) || []).filter((e) => !(e && e.calendarId != null && skip.has(String(e.calendarId))))
    .filter((e) => !pick || (e && pick.has(String(e.calendarId))))
    // 書き出しで LUKKO が書いた予定は取り込まない（二重になる）
    .filter((e) => !(e && e.description === 'LUKKO から'));

  return list
    .map((e) => {
      const sd = new Date(e.startDate);
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
      if (e.status === 'canceled') return null;
      // 形（日付・時刻・何日間）は重ね表示と同じ作り方にする。
      // 前は日をまたぐ予定を 23:59 で切り、何日も続く終日の予定を1日にしていた
      const sh = toAppShape(e);
      if (!sh) return null;
      // 場所・メモ・URL も写す（前は題名と時刻だけで、会議のリンクが落ちていた）
      const memo = String(e.description || '').trim();
      return {
        srcId: String(e.id),
        srcCal: e.calendarId != null ? String(e.calendarId) : undefined,
        title: title || '無題',
        ...sh,
        ...(e.location ? { place: String(e.location).trim().slice(0, 200) } : {}),
        ...(memo ? { memo: memo.slice(0, 2000) } : {}),
        ...(e.url ? { link: String(e.url) } : {}),
        // iPhone 側で「仮」になっている予定と、題名に 仮・候補・未定・調整中・？ があるものは点線で入れる
        status: (e.status === 'tentative' || TENTATIVE.test(title)) ? 'mikakutei' : 'kakutei',
        updatedFrom: e.lastModifiedDate || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.y - b.y) || (a.m - b.m) || (a.day - b.day) || a.start.localeCompare(b.start));
}

// 題名から「まだ決まっていない」と読める言葉
const TENTATIVE = /[（(]\s*仮\s*[)）]|^仮[ 　:：]|仮押さえ|候補|未定|調整中|[?？]\s*$|\bTBD\b/i;

/** 取り込みに使えるカレンダーの一覧（名前・色）。誕生日と購読は除く */
export async function listImportCalendars() {
  if (!native()) return [];
  try {
    const r = await CapacitorCalendar.listCalendars();
    return ((r && r.result) || [])
      .filter((c) => c && !(c.type === 3 || c.type === 4 || c.isSubscribed) && c.title !== 'LUKKO')
      .map((c) => ({ id: String(c.id), title: c.title || '（名前なし）', color: c.color || '#999' }));
  } catch (e) {
    return [];
  }
}

/**
 * 取り込むものを、新しい予定・直った予定・元で消えた予定に分ける。
 *
 * 前は元の予定の番号を捨てていて、同じかどうかを「日・開始時刻・題名」だけで見ていた。
 * 元で時刻を変えると新旧の2件が残り、元で消えた予定も残りつづけた。
 * いまは番号（srcId）を持っておき、2回目からは「直った」として扱う。
 *
 * @returns { fresh:[…], changed:[{ incoming, existing }], gone:[existing…] }
 *  gone は、読んだ範囲・読んだカレンダーの中で、元にもう無いもの
 */
export function diffImport(incoming, existing, range) {
  const bySrc = new Map();
  for (const e of existing) if (e.srcId) bySrc.set(e.srcId, e);
  const key = (e) => `${e.y}-${e.m}-${e.day}-${e.start}-${e.title}`;
  const seen = new Set(existing.map(key));
  const fresh = [], changed = [];
  const hit = new Set();
  for (const e of incoming) {
    const cur = e.srcId && bySrc.get(e.srcId);
    if (cur) {
      hit.add(cur.id);
      const same = cur.y === e.y && cur.m === e.m && cur.day === e.day && cur.start === e.start && cur.end === e.end
        && cur.title === e.title && (cur.place || '') === (e.place || '') && !!cur.allDay === !!e.allDay;
      if (!same) changed.push({ incoming: e, existing: cur });
      continue;
    }
    const k = key(e);
    if (seen.has(k)) continue;
    seen.add(k);
    fresh.push(e);
  }
  const gone = range ? existing.filter((e) => e.srcId && !hit.has(e.id) && e.status !== 'nakunatta'
    && (!range.cals || !e.srcCal || range.cals.includes(e.srcCal))
    && dayNo0(e) >= range.from && dayNo0(e) <= range.to) : [];
  return { fresh, changed, gone };
}
const dayNo0 = (e) => Math.floor(Date.UTC(e.y, e.m, e.day) / 86400000);

// 同じ日・同じ時刻・同じ名前のものは、すでに入っているとみなす（.ics の取り込みで使う）
export function dedupe(incoming, existing) {
  const key = (e) => `${e.y}-${e.m}-${e.day}-${e.start}-${e.title}`;
  const seen = new Set(existing.map(key));
  const bySrc = new Set(existing.filter((e) => e.srcId).map((e) => e.srcId));
  const out = [];
  for (const e of incoming) {
    const k = key(e);
    if (seen.has(k) || (e.srcId && bySrc.has(e.srcId))) continue;
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
  // 休み（公休・有休・明け）。「休み」の種類がある人だけ。バイトより先に拾う（「公休」は勤務ではない）
  { key: 'off', words: ['有給', '有休', '年休', '公休', '希望休', '半休', '午前休', '午後休', '夜勤明け', '明け休み', '振休', '代休'] },
  // 会社の仕事。「仕事」の種類がある人だけ。前は「勤務」を含む予定がみなバイトになり、
  // 「在宅勤務 9:00–18:00」や毎週の研修までバイト扱いになっていた
  { key: 'work', words: ['会議', '打ち合わせ', '打合せ', 'ミーティング', 'mtg', '1on1', '面談', '商談', '来客', '出張', '定例',
    '研修', '在宅', 'テレワーク', '残業', '業務', '納品', '締切', '締め切り', 'レビュー', '朝会', '夕会', 'セミナー', '勉強会', '勤務', '出勤', '出社'] },
  { key: 'baito', words: ['バイト', 'アルバイト', 'シフト', 'パート', '勤務', '出勤', '早番', '遅番', '中番', '日勤', '夜勤', '準夜', '深夜', '当直', '宿直'] },
  { key: 'yoji', words: ['病院', '歯医者', '歯科', 'クリニック', '医院', '通院', '診察', '健診', '健康診断',
    '予防接種', '銀行', '役所', '郵便局', '美容院', '美容室', '床屋', 'サロン', 'ネイル',
    '提出', '締切', '締め切り', '面接', '面談', '手続き', '車検', '引っ越し', '引越',
    '打ち合わせ', '打合せ', '会議', 'ミーティング', 'mtg', '説明会', '授業', '講義', '試験', 'テスト',
    // 週に何回もあって長い、けれどバイトではないもの。下の「くり返し」の当てより先に拾う
    '塾', '部活', 'ジム', '練習', '習い事', 'レッスン', '稽古', 'サークル', 'ゼミ'] },
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
  // 隠している種類には当てない（予定を作るときに選べない種類に入ると、見つけにくい）
  const has = (k) => (types || []).some((t) => t.key === k && !t.hidden);
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
    //    「仕事」の種類を出している人（会社員）には、この当て方をしない——毎週の長い会議や研修がバイトになる。
    //    日をまたぐ勤務（22:00–6:00）は、長さを翌日まで数える（前はマイナスになって当たらなかった）
    const baitoVisible = (types || []).some((t) => t.key === 'baito' && !t.hidden);
    const workVisible = (types || []).some((t) => t.key === 'work' && !t.hidden);
    if (baitoVisible && !workVisible && !e.allDay) {
      const n = runs.get(norm(e.title) + '@' + e.start + '-' + e.end) || 0;
      let len = mins(e.end) - mins(e.start);
      if (len <= 0) len += 1440;
      if (n >= 3 && len >= 180) return { key: 'baito', why: 'repeat' };
    }

    return { key: fallback, why: '' };
  });
}
