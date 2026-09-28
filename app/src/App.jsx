import React from 'react';
import { renderApp } from './view.jsx';
import { tapLight, penTick, settleSuccess, stampHeavy } from './haptics';
import { demoEvents, wantsDemo, demoKind } from './demo';
import { readLocal, readFile, saveLocal, saveFile, PERSISTED, isNative } from './store';
import { writeBackup, listBackups, readBackup, pruneBackups, hasTodayBackup } from './backup';
import { pushWidget, widgetAvailable } from './widgetbridge';
import { endsNextDay, spillsNextDay, busyEndMin } from './whenlib';
import { loadTips, buyTip, probeTips, TIPS } from './tipjar';
import { syncReminders, onNotificationTap, canNotify } from './notify';
import { drawMonthCard, drawYearCard, drawFreeCard, drawSupporterCard } from './sharecard';
import { DOCS, EFFECTIVE, CONTACT, APP_NAME, APP_STORE_ID } from './docs';
import { applyStatusBarTheme } from './statusbar';
import { canImport, askCalendarAccess, checkCalendarAccess, readCalendarEvents, dedupe, diffImport, listImportCalendars, guessTypes, openAppSettings } from './calendarimport';
import { listPhoneCalendars, readOverlay, ensureExportCalendar, syncExport, clearExport } from './iphonecal';
import { lockInfo, authenticate, setShield, requestReview } from './native';
import { syncInfo, readRemote, writeRemote, packForSync, mergeSync, onRemoteChange } from './sync';
import { holidayName } from './holidays';
import { syncShiftNotices, syncInfoNotices, unreadCount, sortNotices, relativeTime, KIND_SHIFT, currentNoteText } from './notices';
import { norm, showsFront, dragToDeg, settle, settleTime, ease, cardShadow, tiltFor } from './cardflip';
import { historyFor, othersOnDay, agoText } from './eventctx.js';
import { textureCss } from './cardtexture.js';

// 曜日と祝日の色。紙の上で浮きすぎないよう、どちらも少し落ち着かせた色にする。
// 祝日と日曜／土曜。地の明暗で色が変わるので、値は styles.css に置いてある。
// 定数のままだと暗い地で日曜の赤が 2.82 しかなく、読めていなかった。
const HOLIDAY_RED = 'var(--sun)';
const SATURDAY_BLUE = 'var(--sat)';

// 予定の塗りをどれだけ白に寄せるか。0 = 原色のまま、0.45 くらいでかなり淡い。
const FILL_SOFT = 0.32;
// 暗いときの、マスの地。ここに色を混ぜて塗りの面を作る（styles.css の --card と同じ）
const DARK_CELL = '#12151A';

// 色を混ぜる（クラスの _mix と同じ式）。組み込みの種類の paper / dark を作るのに使う
const hexRgb = (hex) => { const h = String(hex).replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const mixHex = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return A.map((v, i) => Math.round(v + (B[i] - v) * t)); };
const paperOf = (hex) => { const l = mixHex(hex, '#ffffff', 0.62); return `rgba(${l[0]},${l[1]},${l[2]},.72)`; };
const darkOf = (hex) => { const d = mixHex(hex, '#000000', 0.5); return `rgb(${d[0]},${d[1]},${d[2]})`; };

/**
 * 種類。最初から入っている4つ（用事・バイト・遊び・その他）に加えて、
 * 社会人向けの3つを持っておく。使い方の1問（はじめての案内）で選んだ答えに合わせて、
 * どれを出すか・何と呼ぶかを決める。
 *
 * uWord / cWord … 詳細や一覧で出す状態の名前（まだ／決まった）
 * uLabel / cLabel … 作成画面の切り替えの言葉。無ければ「まだ不確定／決まってる」
 * ask … 点線を押したときの問い。gone … 「無くなった」の言い方
 * free … 空き状況で「空いている」と数える（休み）
 * celeb … 確定したときに出る一言
 *
 * 仕事の点線は「仮押さえ」。会社員が毎日している仮押さえと、このアプリの点線は同じもの。
 */
const EXTRA_TYPES = {
  work: { key: 'work', name: '仕事', color: '#6E85BE', uWord: '仮押さえ', cWord: '確定', uLabel: '仮押さえ', cLabel: '確定',
    ask: 'この仮押さえ、どうなった？', gone: '流れた', celeb: '確定しました' },
  off: { key: 'off', name: '休み', color: '#5FA8A2', uWord: '希望休', cWord: '休み', uLabel: '希望休', cLabel: '休み',
    ask: 'この休み、通りましたか？', gone: '通らなかった', celeb: '休み、通りました', free: true, allDayDefault: true },
  family: { key: 'family', name: '家族', color: '#D0A0BC', uWord: 'まだの家族の予定', cWord: '家族の予定',
    ask: 'この予定、どうなりました？' },
};
const extraType = (key) => { const t = EXTRA_TYPES[key]; return t ? { ...t, paper: paperOf(t.color), dark: darkOf(t.color) } : null; };

/**
 * 使い方の1問の答え。答えで、種類の並びと呼び名・給料の出し方・空き状況で見る時間帯・
 * 週のはじまりを決める。あとから設定の「使い方」で変えられる。
 *
 * 学生を置いていかない：学校とバイトを選んだ人は、これまでとまったく同じ画面になる。
 *
 * types … [key, 名前（無ければそのまま）] の並び。ここに無い種類は隠す（消さない）
 * free … 空き状況で見る時間（平日・休日）。work … いつもの勤務時間（ふさがっている扱い）
 */
const PROFILES = {
  student: { label: '学校とバイト', note: '授業・サークル・バイト',
    types: [['yoji'], ['baito'], ['asobi'], ['other']], weekStart: 0,
    free: { wd: [540, 1320], hd: [540, 1320] }, work: null },
  work: { label: '会社の仕事', note: '会議・打ち合わせ・出張',
    types: [['work'], ['yoji'], ['asobi', 'プライベート'], ['family'], ['other']], weekStart: 1,
    free: { wd: [1140, 1380], hd: [600, 1320] }, work: { days: [1, 2, 3, 4, 5], from: 540, to: 1080 } },
  shift: { label: 'シフト勤務', note: '看護・介護・販売・飲食など',
    types: [['baito', '勤務'], ['off'], ['yoji'], ['asobi', 'プライベート'], ['other']], weekStart: 0,
    free: { wd: [540, 1320], hd: [540, 1320] }, work: null },
  free: { label: 'フリーランス・副業', note: '案件・打ち合わせ・納期',
    types: [['work'], ['baito', '副業']
      , ['yoji'], ['asobi', 'プライベート'], ['other']], weekStart: 1,
    free: { wd: [600, 1320], hd: [600, 1320] }, work: null },
  family: { label: '子育て・家族', note: '保育園・学校行事・通院',
    types: [['family', '子ども・家族'], ['work'], ['yoji'], ['asobi', '自分'], ['other']], weekStart: 0,
    free: { wd: [540, 1260], hd: [540, 1260] }, work: null },
};
const PROFILE_KEYS = ['student', 'work', 'shift', 'free', 'family'];
// App Store に出ている版の番号。設定では「1.3（0.31.0）」のようにストアと同じ番号を先に出す
// （前は中の番号 0.30.0 だけで、ストアの 1.2 と食い違っていた）
const APP_MARKETING = typeof __APP_MARKETING__ === 'string' ? __APP_MARKETING__ : '1.3';

// スイッチの見た目（設定のものと同じ）
const tgTrackOb = (on) => ({ width: 44, height: 26, borderRadius: 13, background: on ? 'var(--ink)' : 'var(--line)', padding: 2, transition: 'background .28s cubic-bezier(.2,.9,.2,1)', cursor: 'pointer', display: 'flex', flexShrink: 0 });
const tgKnobOb = (on) => ({ width: 22, height: 22, borderRadius: 11, background: 'var(--card)', boxShadow: '0 1px 2px rgba(0,0,0,.25)', transition: 'transform .28s cubic-bezier(.2,.9,.2,1)', transform: on ? 'translateX(18px)' : 'translateX(0)' });
import { shareCanvas, shareText, copyText, shareTextAndFile } from './shareimg';
import { toIcs, parseIcs } from './ics';
import { segmentsForDay, layoutColumns, allDayFor, weekStartNo } from './timegrid';
import { resetSettingsScroll } from './settingsview.jsx';

// v2 から予定に y/m（実日付）を持たせた。旧形式は読み込まない。
// 保存は store.js に閉じている（localStorage とファイルの二重書き）

// 予定は y（西暦）・m（0始まりの月）・day で持つ。表示中の月も同じ形。
// days は「その日から何日続くか」。無いか 1 なら1日だけの予定。
// 日またぎは終日の予定にだけ許す（時間指定はバイトの実働・給料が1日単位のため）。

// 日付を通し番号にする。UTC で数えるので夏時間や時差の影響を受けない。
const dayNo = (y, m, d) => Math.floor(Date.UTC(y, m, d) / 86400000);
const fromDayNo = (n) => {
  const t = new Date(n * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
};
// 60日を上限にしておく。壊れたデータでカレンダーが埋まらないように。
const evSpan = (e) => Math.max(1, Math.min(60, (e && e.days) | 0 || 1));
const evFrom = (e) => dayNo(e.y, e.m, e.day);
const evTo = (e) => evFrom(e) + evSpan(e) - 1;
// その日を覆っているか
const evCovers = (e, n) => n >= evFrom(e) && n <= evTo(e);

/**
 * 文の中の URL と電話番号を、押せるかたまりに分ける。[{ t:'文字' } | { t:'…', href:'https://…' }]
 * 予定のメモに貼った会議のリンクや、お店の電話番号をそのまま押せるように
 */
export const linkify = (text) => {
  const out = [];
  const re = /(https?:\/\/[^\s　]+)|((?:0\d{1,4}-\d{1,4}-\d{3,4})|(?:0[5789]0\d{8})|(?:0\d{9}))/g;
  let last = 0, m;
  const s = String(text || '');
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index) });
    if (m[1]) out.push({ t: m[1], href: m[1] });
    else out.push({ t: m[2], href: 'tel:' + m[2].replace(/-/g, '') });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last) });
  return out;
};

// 月表示のマスに積める帯の段数。これを超えたぶんは「+N件」に回す。
// 段が空のときは何も描かないので、増やしても普段の見た目は変わらない。
// 3 だとマスの下 3分の1 が構造的に余っていたので、そこまで使い切る。
// （6週の月でも 22 + 17×4 + 13 = 103px で収まる）
const MAX_LANES = 4;

// 月表示の帯の高さと文字の大きさ。ここを変えると段の高さも一緒に付いてくる。
const MONTH_BAR_H = 15;
const MONTH_BAR_FS = 10;
const MONTH_LANE_H = MONTH_BAR_H + 2; // 帯と帯のあいだの隙間ぶん

// 時計の分の刻み。ホイールで選ぶので粗くする意味がなく、5分で固定する。
// （以前は設定の「時間の刻み幅」で変えられたが、既定の30分だと 17:20 が選べなかった）
const MIN_STEP = 5;

// くり返しは「規則」ではなく、その場で予定の実体を並べて作る。
// 1回ごとに確定／未確定が違うのがこのアプリの要なので、
// あとから1件だけ直せない形（規則で持つ形）にはできない。
// 平日・2週ごと・毎月の第◯曜日・月末 を足した（定例会議・ゴミの日・家賃の引き落とし）
const REPEAT_UNITS = [
  { key: 'day', label: '毎日' },
  { key: 'weekday', label: '平日' },
  { key: 'week', label: '毎週' },
  { key: 'biweek', label: '2週ごと' },
  { key: 'month', label: '毎月◯日' },
  { key: 'nth', label: '毎月 第◯曜日' },
  { key: 'monthEnd', label: '月末' },
  { key: 'year', label: '毎年' },
];
// いつまで続けるかは「月数」で持つ。単位ごとに現実的な長さだけ出す——
// 毎日で2年を選べてしまうと 730 件になり、上限で黙って切られる。
const REPEAT_SPANS = {
  day: [{ m: 1, label: '1か月' }, { m: 3, label: '3か月' }, { m: 6, label: '半年' }],
  weekday: [{ m: 1, label: '1か月' }, { m: 3, label: '3か月' }, { m: 6, label: '半年' }],
  week: [{ m: 1, label: '1か月' }, { m: 3, label: '3か月' }, { m: 6, label: '半年' }, { m: 12, label: '1年' }],
  biweek: [{ m: 3, label: '3か月' }, { m: 6, label: '半年' }, { m: 12, label: '1年' }],
  month: [{ m: 6, label: '半年' }, { m: 12, label: '1年' }, { m: 24, label: '2年' }],
  nth: [{ m: 6, label: '半年' }, { m: 12, label: '1年' }, { m: 24, label: '2年' }],
  monthEnd: [{ m: 6, label: '半年' }, { m: 12, label: '1年' }, { m: 24, label: '2年' }],
  // 誕生日や記念日は長く続く。10年まで選べるようにした
  year: [{ m: 36, label: '3年' }, { m: 60, label: '5年' }, { m: 120, label: '10年' }],
};
const NTH_LABEL = { 1: '第1', 2: '第2', 3: '第3', 4: '第4', 5: '最終' };
const spansFor = (every) => REPEAT_SPANS[every] || REPEAT_SPANS.week;
const MAX_REPEAT = 200;

// 本体の日のあとに続く日を、日番号の配列で返す（本体そのものは含まない）。
// 月と年は日数で刻めないので、暦の上で進める。
// 「毎月31日」の2月のように、その月に無い日は飛ばす。
// 近い日に寄せると、頼んでいない日付に予定が置かれることになる。
const repeatAfter = (y, m, d, every, spanMonths, dows, nth) => {
  if (!REPEAT_UNITS.some((u) => u.key === every)) return [];
  const fromN = dayNo(y, m, d);
  const limitN = dayNo(y, m + (spanMonths | 0), d);
  const out = [];
  const push = (n) => { if (n > fromN && n <= limitN && out.length < MAX_REPEAT) out.push(n); };
  const dowOf = (n) => { const o = fromDayNo(n); return new Date(o.y, o.m, o.d).getDay(); };
  const myDow = new Date(y, m, d).getDay();
  const want = (dows && dows.length) ? dows : [myDow];

  if (every === 'day') {
    for (let n = fromN + 1; n <= limitN && out.length < MAX_REPEAT; n++) out.push(n);
    return out;
  }
  if (every === 'weekday') {
    for (let n = fromN + 1; n <= limitN && out.length < MAX_REPEAT; n++) { const w = dowOf(n); if (w >= 1 && w <= 5) out.push(n); }
    return out;
  }
  if (every === 'week' || every === 'biweek') {
    // 曜日を選んでいれば、その曜日を毎週。選んでいなければ本体と同じ曜日。
    // 2週ごとは、本体の週を0として偶数の週だけ
    const week0 = fromN - myDow;
    for (let n = fromN + 1; n <= limitN && out.length < MAX_REPEAT; n++) {
      if (!want.includes(dowOf(n))) continue;
      if (every === 'biweek' && Math.floor((n - week0) / 7) % 2 !== 0) continue;
      out.push(n);
    }
    return out;
  }
  if (every === 'nth' || every === 'monthEnd') {
    // 毎月の第◯曜日（第2・第4 火曜 のように複数えらべる。5 は最終）と、月末
    const ks = (nth && nth.length) ? nth : [Math.min(5, Math.floor((d - 1) / 7) + 1)];
    for (let i = 0; out.length < MAX_REPEAT && i < 1 + (spanMonths | 0) + 1; i++) {
      const Y = new Date(y, m + i, 1).getFullYear(), M = new Date(y, m + i, 1).getMonth();
      const dim = new Date(Y, M + 1, 0).getDate();
      const days = [];
      if (every === 'monthEnd') days.push(dim);
      else {
        for (const w of want) {
          const first = 1 + ((w - new Date(Y, M, 1).getDay() + 7) % 7);
          for (const k of ks) {
            let dd = k === 5 ? first + 7 * Math.floor((dim - first) / 7) : first + 7 * (k - 1);
            if (dd <= dim) days.push(dd);
          }
        }
      }
      for (const dd of [...new Set(days)].sort((a, b) => a - b)) push(dayNo(Y, M, dd));
    }
    return out.sort((a, b) => a - b);
  }
  const step = every === 'month' ? 1 : 12;
  for (let i = step; out.length < MAX_REPEAT; i += step) {
    const t = new Date(y, m + i, 1);
    const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    if (dayNo(t.getFullYear(), t.getMonth(), 1) > limitN) break;
    if (d > dim) continue; // その月に無い日（2月31日など）は置かない
    push(dayNo(t.getFullYear(), t.getMonth(), d));
    if (dayNo(t.getFullYear(), t.getMonth(), Math.min(d, dim)) > limitN) break;
  }
  return out;
};

// 予定につける名前（id）。時刻だけで作ると、端末の時計を戻したときや、
// いつか誰かとカレンダーを混ぜるときに、別々の予定が同じ名前になりうる。
// 混ぜる側は名前で見分けるしかないので、ぶつかると黙って片方が消える。
// 5文字の乱数を足しておけば、あとから何をしても困らない。
// サポーターカードの段。金ぴかのプラスチックにはしない——
// 紙と箔の組み合わせで段を作る。黒い紙に金の箔押しは実在する上等な印刷で、
// 「静かな文房具」の中にちゃんと居場所がある。
// 色は測って決めた。どの紙の上でも箔の文字が 4.5 を下回らないこと。
//
// paper は斜めに並べる色の並び。等間隔に置く。
// ノーマルと黒は3つ（明→暗→明）で、紙を平らな一色に見せないための濃淡。
// ゴールドだけ5つにしてある。濃淡を一度きりにすると、彩度を上げても
// 「黄色い紙」にしかならなかった。金属に見えるのは色ではなく、
// 明と暗が何度か折り返すところなので、明→暗→明→暗→明 と振っている。
// 暗い帯は斜めに走って字のある四隅を外れる（実際に描いて拾った地の色は
// 名前のうしろ rgb(249,238,196)、金額のうしろ rgb(220,192,110)）。
// glint は「カードの向きに連れて動く光」の帯。sheen（ひとりでに流れる帯）とは別。
// 2本を強いまま重ねると、真ん中が白く飛んで金に見えなくなったので、
// 流れるほうを弱めてある（.9 → .45）。
// ゴールドの glint だけ真ん中がわずかに緑へ振れる。本物の金箔は浅い角度で
// 緑に転ぶので、虹色を全部出すより、そこだけ拾ったほうが金に見える。
// fleck は箔の粒。生成りの紙には撒かない（紙に金粉は嘘になる）。
const CARD_TIERS = [
  { key: 'normal', min: 0, name: 'ノーマル',
    paper: ['#F3EEE2', '#E7DFCE', '#F3EEE2'], foil: '#6B582F', mark: '#C8BFA6',
    sheen: 'rgba(255,252,240,.5)', edge: 'rgba(107,88,47,.3)', fleck: null,
    glint: 'rgba(255,255,255,0) 32%, rgba(255,252,238,.42) 50%, rgba(255,255,255,0) 68%' },
  { key: 'gold', min: 1000, name: 'ゴールド',
    paper: ['#FDF6D6', '#D9B85F', '#F7E8AC', '#C9A544', '#F2DE9B'], foil: '#513706', mark: '#A9862C',
    sheen: 'rgba(255,250,214,.45)', edge: 'rgba(81,55,6,.44)', fleck: '#FFFDF0',
    glint: 'rgba(255,255,255,0) 30%, rgba(255,246,200,.5) 44%, rgba(237,251,217,.6) 50%, rgba(255,239,192,.5) 56%, rgba(255,255,255,0) 70%' },
  { key: 'black', min: 3000, name: 'ブラック',
    paper: ['#2B2823', '#1B1915', '#2B2823'], foil: '#D8BC72', mark: '#7C6E4C',
    sheen: 'rgba(255,240,196,.24)', edge: 'rgba(216,188,114,.38)', fleck: '#F0DFA8',
    glint: 'rgba(255,255,255,0) 32%, rgba(255,240,196,.22) 50%, rgba(255,255,255,0) 68%' },
];
// 箔の粒の居場所（％）と、光りはじめるまでの間（秒）。
// 毎回ばらばらに置くと、指で回すたびに粒が飛び移ってしまうので、決め打ちにする。
const FLECKS = [
  [12,72,0], [26,34,1.4], [38,82,2.9], [47,18,0.6], [58,62,3.7], [66,28,1.9],
  [74,90,4.6], [83,46,2.3], [91,66,5.4], [19,50,3.1], [53,40,6.2], [88,20,4.1],
];
// 色の並びを、等間隔に置いたグラデーションにする
const paperStops = (paper) =>
  paper.map((c, i) => `${c} ${Math.round((i * 100) / (paper.length - 1))}%`).join(', ');
// 合計金額から段を決める。境目はその額に「達したら」上がる。
const tierFor = (total) => {
  let out = CARD_TIERS[0];
  for (const t of CARD_TIERS) if (total >= t.min) out = t;
  return out;
};
// 次の段まであといくらか。いちばん上なら null。
const nextTier = (total) => CARD_TIERS.find((t) => total < t.min) || null;

const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// 保存されている予定に壊れたものが1件でも混じると、描いている途中で落ちる。
// しかも壊れたまま保存されているので、開き直しても同じところで落ちる——
// アプリを消すまで戻れなくなる。読むときに必ずここを通す。
//
// 捨てるのは「日付が読めないもの」だけにする。それ以外は直して残す。
// 利用者の予定を黙って消すほうが、表示が少し変になるより悪い。
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const fixTime = (t, fallback) => (typeof t === 'string' && HHMM.test(t) ? t : fallback);
const sanitizeEvents = (list) => {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    if (!isNum(e.y) || !isNum(e.m) || !isNum(e.day)) continue;
    if (e.m < 0 || e.m > 11 || e.day < 1 || e.day > 31) continue;
    const start = fixTime(e.start, '09:00');
    const end = fixTime(e.end, start);
    // 0:00〜23:59 の予定は、終日として置いたもの。iPhone のカレンダーから来た誕生日や
    // 行事がこの形で入っていて、まとめで「23時間59分」と数えられていた。
    // 終日なら時間にせず、日数で数える（まとめの決まり）
    const allDay = !!e.allDay || (start === '00:00' && end === '23:59');
    out.push({
      ...e,
      allDay,
      id: typeof e.id === 'string' && e.id ? e.id : uid('x'),
      title: typeof e.title === 'string' ? e.title : '無題',
      start,
      end,
      actualEnd: typeof e.actualEnd === 'string' && HHMM.test(e.actualEnd) ? e.actualEnd : undefined,
      want: Array.isArray(e.want) && e.want.length === 2 ? e.want : undefined,
    });
  }
  return out;
};
// 種類は色を引くのに使う。1つでも形が違うと月表示が丸ごと落ちるので、
// 揃っていなければ既定に戻す（数が少なく、作り直すのも簡単なため）
const typesOk = (list) => Array.isArray(list) && list.length > 0 && list.every(
  (t) => t && typeof t.key === 'string' && typeof t.name === 'string' && typeof t.color === 'string'
);
// 応援の記録。壊れていても起動を止めない（ここで落ちたら本末転倒）
const sanitizeSupports = (list) => (Array.isArray(list) ? list.filter(
  (x) => x && typeof x === 'object' && isNum(x.yen) && isNum(x.at)
) : []);

const sanitizeJobs = (list) => (Array.isArray(list) ? list.filter(
  (j) => j && typeof j.id === 'string' && isNum(j.hourly)
) : []);

// 最近消した予定。30日たったものは捨てる。中身の予定は、戻すときにもう一度ふるいにかける
const TRASH_DAYS = 30;
const sanitizeTrash = (list, now = Date.now()) => (Array.isArray(list) ? list.filter(
  (x) => x && typeof x === 'object' && x.ev && typeof x.ev === 'object' && isNum(x.at) && now - x.at < TRASH_DAYS * 86400000
).slice(0, 400) : []);

// 消した印（iCloud 同期のため）。予定以外（棚・勤務先・種類）と、棚へ移した予定は「最近消した予定」に入らない。
// 印が無いと、もう1台がまだ持っているものを送り返してきて、消したはずのものが戻っていた。[[id, 消した時刻], …]
const sanitizeGone = (list, now = Date.now()) => (Array.isArray(list) ? list.filter(
  (x) => Array.isArray(x) && typeof x[0] === 'string' && isNum(x[1]) && now - x[1] < TRASH_DAYS * 86400000
).slice(0, 800) : []);
const goneAdd = (s, ids) => [...ids.filter(Boolean).map((id) => [id, Date.now()]), ...(s.gone || [])].slice(0, 800);

// 日にちをまだ決めていない予定。「今週のどこか」「今月のどこか」「来月あたり」「いつか」
const SOMEDAY_WHEN = ['week', 'month', 'next', 'someday'];
const SOMEDAY_LABEL = { week: '今週のどこか', month: '今月のどこか', next: '来月あたり', someday: 'いつか' };
const sanitizeSomeday = (list) => (Array.isArray(list) ? list.filter(
  (x) => x && typeof x.id === 'string' && typeof x.title === 'string' && SOMEDAY_WHEN.includes(x.when)
) : []);

// 保存済みの種類に、組み込みの種類の項目を埋め戻す。
// 種類に新しい項目（既定の時間帯など）を足しても、すでに使っている人の
// 保存データには入っていない。合成しないと、新しい項目が誰にも届かない。
// 名前と色は本人が変えている可能性があるので、保存側を優先する。
// 前の既定色。これのままなら、新しい既定色に入れ替える。
// 自分で色を選んだ人はそのまま——選んだことのほうが、こちらの好みより重い。
const OLD_DEFAULT_COLORS = {
  yoji: '#534AB7', baito: '#1D9E75', asobi: '#D85A30', other: '#5A6570',
};

const mergeTypes = (saved, builtin) => {
  const filled = saved.map((t) => {
    const base = builtin.find((b) => b.key === t.key);
    if (!base) return t;
    // 既定のままなら、色まわり（color / paper / dark）を組み込みの新しいものにする。
    // { ...base, ...t } だと保存されている古い色が勝ってしまい、新しい色が誰にも届かない。
    const untouched = OLD_DEFAULT_COLORS[t.key] && t.color === OLD_DEFAULT_COLORS[t.key];
    return untouched
      ? { ...base, ...t, color: base.color, paper: base.paper, dark: base.dark }
      : { ...base, ...t };
  });
  // 並び順も組み込みに合わせる。並びは画面のチップの順そのものなので、
  // 先頭を入れ替えたら、すでに使っている人にも届かないと意味がない。
  // 自分で足した種類は、足した順のまま後ろに置く。
  const order = (k) => { const i = builtin.findIndex((b) => b.key === k); return i < 0 ? 999 : i; };
  return filled
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (order(a.t.key) - order(b.t.key)) || (a.i - b.i))
    .map((x) => x.t);
};

const todayParts = () => {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
};
const thisMonth = () => {
  const t = todayParts();
  return { y: t.y, m: t.m };
};
// 「いつ空いてる？」の手動○△✕は月をまたいでも衝突しないようにキーを作る
const dayKey = (y, m, d) => y + '-' + m + '-' + d;
// 月を n ヶ月ずらす
const shiftMonth = (ym, n) => {
  const d = new Date(ym.y, ym.m + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};

// 表示ロジック（renderVals ほか）は Claude design で作った実装をそのまま使っている。
// このクラスに足しているのは「保存」と「テーマ反映」と render() だけ。
export default class App extends React.Component {
  constructor(props) {
    super(props);
    // クラスフィールド（state など）は super() 直後に初期化済みなので、ここで上書きできる
    try {
      const saved = readLocal();
      if (saved) {
        this._hadLocal = true;
        // 起動したとき、ファイルのほうが新しくないかを確かめるのに使う（_checkFile）
        this._localSaved = saved;
        this.state = {
          ...this.state,
          events: sanitizeEvents(saved.events),
          types: typesOk(saved.types) ? mergeTypes(saved.types, this.state.types) : this.state.types,
          overrides: saved.overrides || this.state.overrides,
          // すでに使っている人には案内を出さない
          settings: { ...this.state.settings, onboarded: true, ...(saved.settings || {}) },
          notices: saved.notices || this.state.notices,
          lastSeenVersion: saved.lastSeenVersion || null,
          jobs: sanitizeJobs(saved.jobs),
          supports: sanitizeSupports(saved.supports),
          trash: sanitizeTrash(saved.trash),
          someday: sanitizeSomeday(saved.someday),
          gone: sanitizeGone(saved.gone),
        };
      }
    } catch (e) {
      // 保存データが壊れていても起動は止めない
    }
  }

  PAL = ['#8B7AB8','#7FAE85','#D2916A','#A85C6B','#C7A24A','#6FA8B8','#6E85BE','#D0A0BC','#9C7F6E','#5FA8A2','#8A8A8A','#55555F'];
  ITEM = 34;
  // stable wheel ref + scroll callbacks (identity fixed so scroll position survives re-renders)
  refStartH=(n)=>this._attach(n,'start','h'); refStartM=(n)=>this._attach(n,'start','m');
  refEndH=(n)=>this._attach(n,'end','h');     refEndM=(n)=>this._attach(n,'end','m');
  scStartH=(e)=>this._onWheel(e,'start','h'); scStartM=(e)=>this._onWheel(e,'start','m');
  scEndH=(e)=>this._onWheel(e,'end','h');     scEndM=(e)=>this._onWheel(e,'end','m');
  _attach(node,field,unit){ if(!node || node.dataset.pos==='1') return; const [h,m]=this.state.draft[field].split(':').map(Number); const step=MIN_STEP; node.scrollTop=(unit==='h'?h:Math.round(m/step))*this.ITEM; node.dataset.pos='1'; }
  // 開始を動かしたら、終わりも同じだけ動かす（長さを保つ）。
  // 前は終わりが残り、10:00–11:00 の開始を 14:00 にすると「14:00〜翌11:00」の 21 時間の予定ができていた。
  // 日をまたぐのは、終わりの側をわざと開始より前にしたときだけ
  _onWheel(e,field,unit){ if(this['_t'+field+unit]) return; this['_t'+field+unit]=requestAnimationFrame(()=>{ this['_t'+field+unit]=0; const step=MIN_STEP; const idx=Math.round(e.target.scrollTop/this.ITEM); let [h,m]=this.state.draft[field].split(':').map(Number); if(unit==='h') h=Math.min(23,Math.max(0,idx)); else m=Math.min(60-step,Math.max(0,idx*step)); const nv=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); if(nv!==this.state.draft[field]) this.setState(s=>{ const dr=s.draft; if(field!=='start') return {draft:{...dr,[field]:nv}}; const d=this.mins(nv)-this.mins(dr.start); return {draft:{...dr,start:nv,end:this.addMin(dr.end,d)}}; }); }); }
  // dialog wheels (operate on state.dialog)
  dRefStartH=(n)=>this._dAttach(n,'start','h'); dRefStartM=(n)=>this._dAttach(n,'start','m');
  dRefEndH=(n)=>this._dAttach(n,'end','h');     dRefEndM=(n)=>this._dAttach(n,'end','m');
  dScStartH=(e)=>this._dWheel(e,'start','h'); dScStartM=(e)=>this._dWheel(e,'start','m');
  dScEndH=(e)=>this._dWheel(e,'end','h');     dScEndM=(e)=>this._dWheel(e,'end','m');
  _dAttach(node,field,unit){ if(!node || node.dataset.pos==='1' || !this.state.dialog) return; const step=MIN_STEP; const set=()=>{ if(!this.state.dialog) return; const [h,m]=this.state.dialog[field].split(':').map(Number); node.scrollTop=(unit==='h'?h:Math.round(m/step))*this.ITEM; }; node.dataset.pos='1'; set(); requestAnimationFrame(set); }
  // 「確定した」の小窓でも、開始を動かしたら終わりを付いてこさせる。
  // 働いた記録（worked）は別——始まりは同じで終わりだけ延びる、が普通なので、終わりは動かさない
  _dWheel(e,field,unit){ if(this['_d'+field+unit]) return; this['_d'+field+unit]=requestAnimationFrame(()=>{ this['_d'+field+unit]=0; if(!this.state.dialog) return; const step=MIN_STEP; const idx=Math.round(e.target.scrollTop/this.ITEM); let [h,m]=this.state.dialog[field].split(':').map(Number); if(unit==='h') h=Math.min(23,Math.max(0,idx)); else m=Math.min(60-step,Math.max(0,idx*step)); const nv=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); if(nv!==this.state.dialog[field]) this.setState(s=>{ const dl=s.dialog; if(field!=='start'||dl.mode==='worked') return {dialog:{...dl,[field]:nv}}; const d=this.mins(nv)-this.mins(dl.start); return {dialog:{...dl,start:nv,end:this.addMin(dl.end,d)}}; }); }); }

  state = {
    screen:'month', wageOn:false, dialog:null, detailId:null, dayNum:null, returnTo:'month',
    newType:null, overrides:{}, notif:null, editTypeKey:null, docKey:null, confirmDelete:null,
    imp:{ phase:'idle', found:[], type:'yoji', error:'' },
    swipe:{ dx:0, animating:false },
    swipeRow:null, // 一覧で左へ開いている行 {id,dx,animating}
    notices:[], lastSeenVersion:null, noticeOpen:null,
    trash:[], someday:[], gone:[],
    // バイト先。名前と時給を持つ。予定に紐づけると、その時給で計算する。
    jobs:[], editJobId:null, newJob:null, supports:[],
    ym: thisMonth(),      // カレンダーで表示している月
    freeYM: thisMonth(),  // 「いつ空いてる？」で見ている月
    freeDir: 0,           // 直前に月を送った向き（滑り込む向きに使う）
    today: todayParts(),
    shareChoices:{ o1:null, o2:null, o3:null }, shareSubmitted:false, shareToast:false, shareMsg:'', morph:null,
    settings:{ hourly:1120, weekStart:0, remind:true, hideCanceled:false, dark:false, onboarded:false,
      // 使い始める前の額。年をまたいで持つので、年ごとの入れ物にする（{'2026':120000}）
      priorWage:{} },
    // はじめての案内。step は 0=しくみ 1=時給 2=取り込み
    onboard:{ step:0, demo:'dash' },
    draft:{ title:'', type:'yoji', status:'kakutei', start:'10:00', end:'11:00', y:todayParts().y, m:todayParts().m, day:todayParts().d, allDay:false, picking:null },
    // 並び順がそのまま画面のチップの並びになる。既定が用事なので、用事を先頭に置く。
    types:[
      // paper は paperFrom(color) と同じ値。手で書くと式とずれる（実際に一度ずれた）ので、
      // 変えるときは必ず paperFrom の寄せ量で計算し直すこと。
      {key:'yoji',  name:'用事',   color:'#8B7AB8', paper:'rgba(211,204,228,.72)', dark:'#463D5C', uWord:'まだ分からない用事', cWord:'確定した用事'},
      {key:'baito', name:'バイト', color:'#7FAE85', paper:'rgba(206,224,209,.72)', dark:'#405743', uWord:'希望シフト', cWord:'確定シフト', defStart:'17:00', defEnd:'22:00'},
      {key:'asobi', name:'遊び',   color:'#D2916A', paper:'rgba(238,213,198,.72)', dark:'#694935', uWord:'候補日', cWord:'約束'},
      {key:'other', name:'その他', color:'#8A8A8A', paper:'rgba(211,211,211,.72)', dark:'#454545', uWord:'未確定の予定', cWord:'予定'},
    ],
    events: [],
  };

  // ---- lookups & color ----
  T(key){ return this.state.types.find(t=>t.key===key) || extraType(key) || this.state.types[0]; }
  /** 選ぶ所に出す種類。隠した種類は出さない（予定は残っていて、カレンダーには出る） */
  visibleTypes(){ const v=(this.state.types||[]).filter(t=>!t.hidden); return v.length ? v : this.state.types; }
  profile(){ const p=this.state.settings && this.state.settings.profile; return PROFILES[p] ? p : 'student'; }
  /**
   * 使い方で変わる言葉。学校とバイトを選んだ人（と、選ぶ前から使っている人）には、これまでと同じ言葉。
   * 社会人には「バイト先」ではなく「勤務先」と言う。
   */
  words(){
    const p=this.profile(), stu=p==='student';
    const wt=this.state.types.find(t=>t.key==='baito');
    const wname = wt && wt.name && wt.name!=='バイト' ? wt.name : (stu ? 'バイト' : '勤務');
    return {
      job: stu ? 'バイト先' : '勤務先',
      jobNone: stu ? 'バイト先なし' : '勤務先なし',
      jobAdd: stu ? 'バイト先を追加' : '勤務先を追加',
      jobThis: stu ? 'このバイト先を追加' : 'この勤務先を追加',
      jobEg: stu ? 'バイト先の名前（例：マクド、塾）' : '勤務先の名前（例：〇〇病院、駅前店）',
      wageHead: stu ? 'バイトと給料' : '働いた時間と給料',
      shift: wname,
      titleEg: p==='work' ? 'タイトル（例：定例、〇〇社 打ち合わせ）'
        : p==='family' ? 'タイトル（例：保育園の面談、通院）'
        : p==='shift' ? 'タイトル（例：日勤、通院）'
        : p==='free' ? 'タイトル（例：〇〇社 納品、打ち合わせ）' : 'タイトル',
      placeEg: stu ? '店名や住所（例：渋谷駅、○○カフェ）' : '住所や会議室（例：本社 5F 会議室A、〇〇クリニック）',
      typeEg: stu ? '種類の名前（例：ジム、勉強）' : '種類の名前（例：通院、習い事）',
      remindTitle: stu ? 'おつかれさま' : 'お疲れさまでした',
    };
  }
  /**
   * 使い方の答えを反映する。種類の並びと名前、空き状況の時間帯、週のはじまり。
   * 名前は、その人が自分で変えていなければだけ付け替える（変えたことのほうが重い）。
   * 並びに無い種類は隠す。消しはしない——予定はそのまま残る。
   */
  applyProfile(key, s0){
    const p=PROFILES[key]; if(!p) return null;
    const s=s0||this.state;
    const DEFAULT_NAMES={yoji:'用事',baito:'バイト',asobi:'遊び',other:'その他',work:'仕事',off:'休み',family:'家族'};
    const cur=s.types.map(t=>({...t}));
    const listed=[];
    // 名前がこちらの付けたもの（既定の名前か、どれかの使い方で付けた名前）なら、付け替えてよい
    const untouched=(t,k)=>!t.name || t.name===DEFAULT_NAMES[k] || Object.values(PROFILES).some(pp=>pp.types.some(([kk,nn])=>kk===k && nn===t.name));
    for(const [k,name] of p.types){
      let t=cur.find(x=>x.key===k);
      if(!t){ t=extraType(k); if(!t) continue; cur.push(t); }
      t.name = untouched(t,k) ? (name || DEFAULT_NAMES[k] || t.name) : t.name;
      if(t.hidden) delete t.hidden;
      listed.push(t);
    }
    const rest=cur.filter(t=>!listed.includes(t)).map(t=>String(t.key).startsWith('c') ? t
      : {...t, hidden:true, name: untouched(t,t.key) ? (DEFAULT_NAMES[t.key]||t.name) : t.name});
    const types=[...listed, ...rest];
    const settings={...s.settings, profile:key, weekStart:p.weekStart,
      freeWd:p.free.wd, freeHd:p.free.hd, workHours:p.work || null,
      kariMark: key==='work' || key==='free'};
    return { types, settings };
  }
  _h(hex){ hex=hex.replace('#',''); return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)); }
  _mix(a,b,t){ const A=this._h(a),B=this._h(b); return A.map((v,i)=>Math.round(v+(B[i]-v)*t)); }
  // 点線ピルの地。色を白に寄せたうえで、さらに .72 の透けで白い紙に載る。
  // 目に入るのは「2回白へ寄ったあと」の色なので、寄せる量はそこから逆算する。
  // 寄せ .84（前）＝実効で ΔE 5.8、いちばん近いのは 用事とその他。
  // 色そのものをやさしくした（彩度 66 → 36 前後）ので、同じ .84 だと 3.7 まで落ちる。
  // .62 まで下げると 7.7 になり、濃い色だったころより見分けやすい。
  // 色＝種類は、点線のときにも効いていないと意味がない。
  paperFrom(hex){ const l=this._mix(hex,'#ffffff',.62); return `rgba(${l[0]},${l[1]},${l[2]},.72)`; }
  darkFrom(hex){ const d=this._mix(hex,'#000000',.5); return `rgb(${d[0]},${d[1]},${d[2]})`; }
  // 塗りの濃さ。白に寄せるほど紙になじむ。FILL_SOFT の一箇所で全体が変わる。
  /**
   * 暗い画面かどうか。色の作り方はここで分かれる。
   *
   * これを見ずに作っていたのが、ダークモードが壊れていた原因。
   * 明るい紙のために作った式（白へ寄せる／薄い紙を敷く）を暗い地でも
   * そのまま使っていたので、塗りもまだも「明るい塊」になり、
   * 決まってる／まだ の差が 1.22 まで落ちていた（明るい方は 1.40）。
   */
  dark(){
    // 表示は「iPhone に合わせる／明るい／暗い」。前は設定のスイッチでしか切り替わらず、最初はオフだった。
    // theme が無いのは前の版から使っている人。そのときは前のスイッチ（dark）のまま
    const cfg=this.state.settings||{};
    const th = cfg.theme || (cfg.dark ? 'dark' : 'light');
    if(th==='auto') return !!this._sysDark;
    return th==='dark';
  }

  softFill(hex){
    // 暗いときは白ではなく地に混ぜる。色は24%だけ残す
    const l = this.dark() ? this._mix(hex, DARK_CELL, 0.76) : this._mix(hex,'#ffffff',FILL_SOFT);
    return `rgb(${l[0]},${l[1]},${l[2]})`;
  }
  softLine(hex){
    // 暗いときは色そのものを縁に使う。面に24%しか色が残らないので、
    // 縁が種類を運ぶ。薄めると 用事 と その他 が見分けられなくなる
    const l = this.dark() ? this._mix(hex,'#ffffff',0) : this._mix(hex,'#ffffff',FILL_SOFT*0.5);
    return `rgb(${l[0]},${l[1]},${l[2]})`;
  }
  /**
   * まだ（点線）の地。暗いときは敷かない。
   * **面の有無**で確定と差をつけるのがこの直しの要。薄い紙を暗い地に
   * 重ねると中間の明るさになって、塗りの面に寄ってしまう。
   */
  paperShow(paper){ return this.dark() ? 'transparent' : paper; }
  // 種類の色で書く小さな字（地の上に直に置くもの）。
  // t.dark は色を黒へ 50% 寄せた値で、白い紙の上でしか読めない。暗い地では
  // カードとの差が 2.32 まで落ちる。暗いときは白の側へ寄せる —— ただし
  // 寄せすぎる（inkOn の 78%）と白になって「色＝種類」が消えるので 45% で止める。
  typeInk(t){
    if(!this.dark()) return t.dark;
    const l = this._mix(t.color, '#ffffff', 0.45);
    return `rgb(${l[0]},${l[1]},${l[2]})`;
  }
  /** まだ（点線）の字。暗いときは面が無いので、地の上で読める明るさにする */
  inkDash(hex){
    const l = this.dark() ? this._mix(hex,'#ffffff',0.88) : this._mix(hex,'#000000',.66);
    return `rgb(${l[0]},${l[1]},${l[2]})`;
  }
  // 薄い塗りの上に置く文字。読みやすさを保つために濃いめにする。
  // 色のついた地に乗る文字。
  // .58 だったが、やさしい色にしたぶん地が明るくなり、ダークモードの点線ピルで
  // 4.4 まで落ちた（点線の地は白に寄せて作るので、暗い画面では中間の明るさになる）。
  // .66 にすると、明るい画面でも暗い画面でも、濃い色だったころ以上になる。
  inkOn(hex){
    // 暗いときは面が暗いので、字は白へ寄せる（色は22%だけ残す）
    const d = this.dark() ? this._mix(hex,'#ffffff',0.78) : this._mix(hex,'#000000',.66);
    return `rgb(${d[0]},${d[1]},${d[2]})`;
  }

  // ---- time ----
  mins(s){ const [h,m]=s.split(':').map(Number); return h*60+m; }
  addMin(s,d){ let x=(this.mins(s)+d+1440)%1440; return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0'); }
  hoursBetween(a,b){ let d=this.mins(b)-this.mins(a); if(d<0)d+=1440; return d/60; }
  fmtWage(n){ return '¥'+n.toLocaleString('ja-JP'); }
  // 主役の数字を出すところでは、記号と数字を分けて渡す。
  // ひとかたまりの '¥86,400' のままだと、記号まで同じ大きさで出てしまう。
  // 数字を大きく細く、記号は小さく薄く——そうすると数字が主役として立つ。
  splitWage(n){ return { unit:'¥', num:n.toLocaleString('ja-JP') }; }

  /**
   * 時間の内訳。種類で束ねて、その中で同じ名前の予定をまとめる。
   *
   * まとめは長いあいだ「働いた記録」だけを数えていて、バイトの実績が無い人には
   * 画面がまるごと空だった。用事と遊びしか置いていない人にとって、まとめは
   * 存在しなかった。ここは種類を問わず、その月に何へどれだけ時間を使ったかを出す。
   *
   * 同じ名前をまとめるので、くり返しの予定（ジム、塾、部活）がそのまま
   * 「多かったこと」として浮く。バイトはバイト先でまとめる —— 名前は毎回「バイト」なので、
   * 名前でまとめても何も分からない。
   *
   * **終日の予定は時間にしない。** 24時間と数えたら嘘になる。日数で別に数える。
   * 時間と日は足せないので、出すときは「6時間・2日」と並べる。
   */
  spentHours(ev){
    if(ev.allDay) return 0;
    // バイトは休憩を引いた実働。給料の計算と同じ道を通す（ここだけ違うと数字が合わなくなる）
    return ev.type==='baito' ? this.paidHours(ev) : this.hoursBetween(ev.start, ev.end);
  }
  _timeBreakdown(list){
    const jobs = this.state.jobs || [];
    const out = [];
    for(const t of this.state.types){
      const evs = list.filter(e=>e.type===t.key);
      if(!evs.length) continue;
      const by = new Map();
      let hours=0, days=0;
      for(const e of evs){
        const job = t.key==='baito' && e.jobId ? jobs.find(j=>j.id===e.jobId) : null;
        const name = job ? (job.name||'（名前なし）') : (t.key==='baito' && e.jobName) ? e.jobName : ((e.title||'').trim() || '（名前なし）');
        const cur = by.get(name) || { name, hours:0, days:0, times:0 };
        const h = this.spentHours(e), d = e.allDay ? evSpan(e) : 0;
        cur.hours += h; cur.days += d; cur.times += 1;
        hours += h; days += d;
        by.set(name, cur);
      }
      const tops = [...by.values()]
        .sort((a,b)=>(b.hours-a.hours) || (b.days-a.days) || (b.times-a.times))
        .slice(0,3)
        .map(r=>({ name:r.name, amount:this.fmtSpent(r.hours, r.days), times:r.times }));
      out.push({ key:t.key, name:t.name, color:t.color, hours, days, times:evs.length,
        amount:this.fmtSpent(hours, days),
        // 名前が1つしか無いなら内訳は出さない。上の行と同じことを二度言うだけになる
        tops: by.size>=2 ? tops : [] });
    }
    // 多かった順。種類の決まった並びではなく、その月に多かったものが上
    return out.sort((a,b)=>(b.hours-a.hours)||(b.days-a.days));
  }
  // 「6時間30分」「2日」「6時間・2日」。時間と日は足せないので並べる
  fmtSpent(h, d){
    const parts=[];
    if(h>0) parts.push(this.fmtHours(h));
    if(d>0) parts.push(d+'日');
    return parts.length ? parts.join('・') : '0時間';
  }
  // 大きく出す数字。時間があれば時間、無ければ日。分は小さく添える
  _spentHead(h, d){
    if(h>0){
      const H=Math.floor(h), Mi=Math.round((h-H)*60);
      if(H>0) return { num:String(H), unit:'時間', rest: Mi ? Mi+'分' : '' };
      return { num:String(Mi), unit:'分', rest:'' };
    }
    if(d>0) return { num:String(d), unit:'日', rest:'' };
    return { num:'0', unit:'時間', rest:'' };
  }
  /**
   * バイト先ごとの内訳。まとめ画面にも、書き出すカードにも同じものを使う。
   *
   * 色はバイト先ごとに変えるが、種類の色（バイトの緑）から濃淡をずらして作る。
   * まったく別の色にすると「色＝種類」の決めが崩れる——カレンダーの上では
   * バイトはどこも同じ緑なのに、内訳だけ別の色だと読み替えが要る。
   * 濃淡なら「どれもバイト」と分かったまま、内訳の中では見分けられる。
   */
  _jobBreakdown(list){
    const base = (this.T('baito')||{}).color || '#7FAE85';
    const by = new Map();
    for(const e of list){
      const key = e.jobId || '__none__';
      // 消したバイト先の記録は、書き込んである名前で出す
      const cur = by.get(key) || { key, hours:0, wage:0, times:0, jobName:e.jobName };
      cur.hours += this.paidHours(e);
      cur.wage += this.wage(e);
      cur.times += 1;
      by.set(key, cur);
    }
    const jobs = this.state.jobs || [];
    const order = (k)=>{ const i=jobs.findIndex(j=>j.id===k); return i<0 ? 999 : i; };
    return [...by.values()]
      .sort((a,b)=>(order(a.key)-order(b.key)) || (b.wage-a.wage))
      .map((r,i)=>{
        const job = jobs.find(j=>j.id===r.key);
        const l = this._mix(base, '#ffffff', i===0 ? 0 : Math.min(0.62, 0.22+(i-1)*0.2));
        return {
          name: job ? (job.name || '（名前なし）') : (r.jobName || this.words().jobNone),
          hourly: job ? (job.hourly|0) : null,
          times: r.times,
          hours: this.fmtHours(r.hours),
          wage: this.fmtWage(Math.round(r.wage)),
          color: `rgb(${l[0]},${l[1]},${l[2]})`,
        };
      });
  }
  // その予定に使う時給。
  // 働いた記録には、記録した時点の時給を書き込んでおく（ev.hourly）。あればそれを使う。
  // 前は表示するたびに「今の時給」を掛けていたので、時給を上げると過去の給料まで上がって出た。
  // 書き込みの無い予定（これからの予定・古い記録）は、バイト先の今の時給か、設定の時給。
  hourlyFor(ev){
    if(ev && typeof ev.hourly==='number' && isFinite(ev.hourly)) return ev.hourly;
    const j = ev && ev.jobId ? (this.state.jobs||[]).find(x=>x.id===ev.jobId) : null;
    return j ? j.hourly : this.state.settings.hourly;
  }
  // 休憩は何分か。持っていなければ 0。
  breakMin(ev){ const n=ev&&ev.breakMin; return typeof n==='number'&&n>0 ? Math.min(600,n) : 0; }
  /**
   * 給料の対象になる時間。
   * 「開始〜終わり」から休憩を引く。時間や金額を出すところは必ずここを通す
   * （引き忘れると、休憩が時給に入らない勤務先で金額が多めに出る）。
   */
  paidHours(ev){
    const end = ev.actualEnd || ev.end;
    return Math.max(0, this.hoursBetween(ev.start, end) - this.breakMin(ev)/60);
  }
  wage(ev){ if(ev.type!=='baito')return 0; return Math.round(this.paidHours(ev)*this.hourlyFor(ev)); }
  /**
   * 使い始める前の額。年ごとに、手で入れてもらう。
   * 年の途中から使い始めた人は、それまでの給料がこのアプリに無い。合計が実際と合わない。
   * 記録が無いものを推測で埋めるわけにはいかないので、本人に入れてもらう。
   *
   * **足すのは金額だけ。** 働いた時間と日数には足さない —— 何時間だったかは
   * 誰も知らないので、入れたら嘘になる。画面にもそう書く。
   * 一つの数字で持つと、年を移動したときに全部の年が同じだけ増えてしまう。
   */
  priorFor(y){
    const p = this.state.settings && this.state.settings.priorWage;
    const n = p && p[String(y)];
    return typeof n==='number' && isFinite(n) && n>0 ? Math.min(99999999, Math.round(n)) : 0;
  }
  setPrior(y, n){
    const v = Math.max(0, Math.min(99999999, Math.round(Number(n)||0)));
    this.setState(s=>{
      // 控えから戻したものが壊れていても、ここで巻き添えにしない
      const cur = s.settings.priorWage;
      const p = (cur && typeof cur==='object' && !Array.isArray(cur)) ? {...cur} : {};
      if(v) p[String(y)] = v; else delete p[String(y)];
      return { settings:{...s.settings, priorWage:p} };
    });
  }
  // 「0時間30分」とは言わない。1時間に満たなければ「30分」
  fmtHours(h){ const H=Math.floor(h); const M=Math.round((h-H)*60); if(!H && M) return M+'分'; return M? H+'時間'+M+'分' : H+'時間'; }
  fmtMin(m){ return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
  // お知らせの「いつ」を短い言葉にする。行にたたんだときの値にも、詳細画面にも使う。
  remindLabel(min, allDay){
    if(typeof min!=='number') return 'なし';
    if(allDay) return min===0 ? '当日の朝' : (min/1440)+'日前';
    if(min>=1440) return (min/1440)+'日前';
    if(min>=60) return Math.round(min/60)+'時間前';
    return min+'分前';
  }
  // 日またぎの範囲を「8/25〜8/27」の形にする。年をまたぐときだけ年を添える。
  spanLabel(ev){
    const a=fromDayNo(evFrom(ev)), b=fromDayNo(evTo(ev));
    return (a.m+1)+'/'+a.d+'〜'+(b.y!==a.y?b.y+'/':'')+(b.m+1)+'/'+b.d;
  }
  /**
   * その日が空いているか（空き状況・空いてる日の画像・文字でコピー、の3つが同じ判定を使う）。
   *
   * 前は 9〜22 時の固定で見ていた。会社員の平日は、勤務を予定に入れていなければ全部○、
   * 入れていれば全部△で、空き状況が役に立たなかった。いまは
   *  ・見る時間を平日と休日で分ける（設定。会社員を選んだ人は 平日19〜23時・休日10〜22時）
   *  ・「いつもの勤務時間」はふさがっている扱い（勤務を毎日入れなくていい）
   *  ・「休み」の種類は空いている扱い（有休の日は勤務時間も外す）
   *  ・前の日から続く夜勤は、明けの日の朝をふさぐ
   *  ・重ねて表示している iPhone のカレンダーの予定も数える（設定でオンのとき）
   * 祝日は休日として数える。
   *
   * @returns {mark, variant, note, ranges（空いている時間の並び）, win（見た時間）, full（見た時間がまるごと空き）}
   */
  dayFree(y,m,d){
    const st=this.state, cfg=st.settings;
    const n=dayNo(y,m,d), dw=new Date(y,m,d).getDay();
    const hol=!!holidayName(y,m,d), offDay = hol || dw===0 || dw===6;
    const win = (offDay ? cfg.freeHd : cfg.freeWd) || [540,1320];
    const [WS,WE]=win;
    const isFreeType=(e)=>{ const t=this.T(e.type); return !!(t && t.free); };
    const today = st.events.filter(e=>e.status!=='nakunatta' && (evCovers(e,n) || (!e.allDay && evFrom(e)===n-1 && spillsNextDay(e))));
    const over = (cfg.overlayFree && this._overlayFor) ? this._overlayFor(n, n+1) : [];
    const offToday = today.some(e=>isFreeType(e) && (e.status==='kakutei'||e.status==='jisseki'));
    const conf=today.filter(e=>(e.status==='kakutei'||e.status==='jisseki') && !isFreeType(e));
    const unc=today.filter(e=>e.status==='mikakutei' && !isFreeType(e));
    if(conf.some(e=>e.allDay && evCovers(e,n)) || over.some(e=>e.allDay)) return {mark:'×', ranges:[], win};
    // ふさがっている時間
    const iv=[];
    for(const sg of segmentsForDay(conf,y,m,d)) iv.push([sg.a,sg.b]);
    for(const sg of segmentsForDay(over,y,m,d)) iv.push([sg.a,sg.b]);
    const wh=cfg.workHours;
    if(wh && !offDay && !offToday && (wh.days||[]).includes(dw)) iv.push([wh.from, wh.to]);
    const clip=iv.map(([a,b])=>[Math.max(a,WS),Math.min(b,WE)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
    const merged=[]; clip.forEach(x=>{ const last=merged[merged.length-1]; if(last&&x[0]<=last[1]) last[1]=Math.max(last[1],x[1]); else merged.push([x[0],x[1]]); });
    // 空いている時間（見る時間の中で、1時間以上。30分では誘われても行けない）
    const ranges=[]; let cur=WS;
    for(const [a,b] of merged){ if(a-cur>=60) ranges.push([cur,a]); cur=Math.max(cur,b); }
    if(WE-cur>=60) ranges.push([cur,WE]);
    if(!ranges.length) return {mark:'×', ranges, win};
    const uncIn=segmentsForDay(unc,y,m,d).some(sg=>sg.a<WE && sg.b>WS) || unc.some(e=>e.allDay);
    if(!merged.length){
      if(uncIn){ const u=unc[0]; return {mark:'△',variant:'adjust',note:u.type==='baito'?'まだ希望を出しただけです':'まだ候補なので調整できます', ranges, win, full:true}; }
      return {mark:'○', ranges, win, full:true};
    }
    const fm=(x)=>this.fmtMin(x);
    const note = ranges.length===1
      ? (ranges[0][1]>=WE ? fm(ranges[0][0])+'以降なら空いてます' : ranges[0][0]<=WS ? fm(ranges[0][1])+'までなら空いてます' : fm(ranges[0][0])+'〜'+fm(ranges[0][1])+' なら空いてます')
      : ranges.map(([a,b])=>b>=WE ? fm(a)+'以降' : a<=WS ? fm(b)+'まで' : fm(a)+'〜'+fm(b)).join('・')+' なら空いてます';
    return {mark:'△',variant:'partial',note, ranges, win};
  }
  // 「10/3（金）19時以降」「10/4（土）終日」のような、文字で送る形の1日ぶん
  freeText(y,m,d, polite){
    const DW=['日','月','火','水','木','金','土'];
    const j=this.dayFree(y,m,d);
    const ov=this.state.overrides[dayKey(y,m,d)];
    const mark=ov||j.mark;
    if(mark==='×') return null;
    const h=(x)=>{ const H=Math.floor(x/60), M=x%60; return M ? `${H}:${String(M).padStart(2,'0')}` : `${H}時`; };
    let when;
    if(ov==='○' || (mark==='○' && j.full)){
      const [a,b]=j.win||[540,1320];
      when = (a<=600 && b>=1260) ? '終日' : (b>=1320 ? `${h(a)}以降` : `${h(a)}〜${h(b)}`);
    } else if(ov==='△' && !j.ranges.length) when = polite ? '時間によっては可' : '時間しだい';
    else {
      const WE=(j.win||[0,1320])[1];
      when = j.ranges.map(([a,b])=>b>=WE ? `${h(a)}以降` : `${h(a)}〜${h(b)}`).join('、');
    }
    return `${m+1}/${d}（${DW[new Date(y,m,d).getDay()]}）${when}`;
  }
  // 空いてる日を送るときの選び方（範囲・平日休日・言い回し・名前・署名）
  shareOpt(s0){ const s=s0||this.state; return { range:'2w', only:'all', polite: this.profile()!=='student', name:'', sign:false, ...(s.shareOpt||{}) }; }
  // ふつう版と、仕事の相手に送る ていねい版
  freeWords(so){
    const nm=(so.name||'').trim();
    return so.polite
      ? { lead: nm ? `${nm}の空き状況` : '空き状況', title:(m)=>`${m}月の空き状況`, legend:['終日可','時間によって可','予定あり'] }
      : { lead: nm ? `${nm}の空いてる日` : 'わたしの空いてる日', title:(m)=>`${m}月のあいてる日`, legend:['空いてる','時間による','予定あり'] };
  }
  /**
   * 空いてる日の画像のマス。空き状況と同じ判定。
   * level … free（○）/ part（△。時刻を小さく添える）/ busy（×）/ past（過ぎた日。薄く）
   */
  freeCells(Y,M){
    const st=this.state, ws=st.settings.weekStart;
    const first=(new Date(Y,M,1).getDay()-ws+7)%7, dim=new Date(Y,M+1,0).getDate();
    const todayN=dayNo(st.today.y,st.today.m,st.today.d);
    const cells=[]; for(let i=0;i<first;i++) cells.push({label:'', level:'none'});
    const h=(x)=>{ const H=Math.floor(x/60), Mi=x%60; return Mi ? `${H}:${String(Mi).padStart(2,'0')}` : `${H}時`; };
    for(let d=1;d<=dim;d++){
      if(dayNo(Y,M,d)<todayN){ cells.push({label:d, level:'past'}); continue; }
      const j=this.dayFree(Y,M,d), ov=st.overrides[dayKey(Y,M,d)], mark=ov||j.mark;
      let level = mark==='○' ? 'free' : mark==='△' ? 'part' : 'busy';
      let note='';
      if(level==='free' && !ov && j.win && !(j.win[0]<=600 && j.win[1]>=1260)){ level='part'; note=h(j.win[0])+'〜'; }
      else if(level==='part' && j.ranges && j.ranges.length) note = h(j.ranges[0][0])+'〜';
      cells.push({label:d, level, note});
    }
    return cells;
  }
  /** 文字で送る空いてる日。範囲・平日休日で絞り、ていねい版は前後に一言を添える */
  freeTextBlock(so){
    const st=this.state, t=st.today, ws=st.settings.weekStart;
    const todayN=dayNo(t.y,t.m,t.d);
    let a=todayN, b=todayN+13;
    const wk0=weekStartNo(t.y,t.m,t.d,ws);
    if(so.range==='week'){ a=todayN; b=wk0+6; }
    else if(so.range==='next'){ a=wk0+7; b=wk0+13; }
    else if(so.range==='month'){ const Y=st.freeYM.y, M=st.freeYM.m; a=Math.max(todayN, dayNo(Y,M,1)); b=dayNo(Y,M+1,0); }
    const lines=[];
    for(let n=a;n<=b;n++){
      const o=fromDayNo(n), dw=new Date(o.y,o.m,o.d).getDay(), off=dw===0||dw===6||!!holidayName(o.y,o.m,o.d);
      if(so.only==='wd' && off) continue;
      if(so.only==='hd' && !off) continue;
      const line=this.freeText(o.y,o.m,o.d, so.polite);
      if(line) lines.push((so.polite?'・':'')+line);
    }
    const nm=(so.name||'').trim();
    if(!lines.length) return so.polite ? 'この期間は、あいにく空いている日がありません。' : 'この期間は空いてる日がありません';
    return so.polite
      ? `${nm?nm+'の':''}空いている日程です。\n${lines.join('\n')}\nご都合のよい日をお知らせください。`
      : `空いてる日\n${lines.join('\n')}`;
  }
  freeJudge(evs){
    if(!evs.length) return {mark:'○'};
    const conf=evs.filter(e=>e.status==='kakutei'||e.status==='jisseki');
    const unc=evs.filter(e=>e.status==='mikakutei');
    if(!conf.length){ const u=unc[0]; return {mark:'△',variant:'adjust',note:u.type==='baito'?'まだ希望を出しただけです':'まだ候補なので調整できます'}; }
    if(conf.some(e=>e.allDay)) return {mark:'×'};
    const WS=540, WE=1320;
    // 日をまたぐ勤務は、その日は24時までふさがっている。
    // そのまま [22:00, 1:00] と置くと前後が逆になり、重なりの計算が崩れる。
    const iv=conf.map(e=>[this.mins(e.start), busyEndMin(e)]).sort((a,b)=>a[0]-b[0]);
    const merged=[]; iv.forEach(x=>{ const last=merged[merged.length-1]; if(last&&x[0]<=last[1]) last[1]=Math.max(last[1],x[1]); else merged.push([x[0],x[1]]); });
    const full = merged.length===1 && merged[0][0]<=WS && merged[0][1]>=WE;
    if(full) return {mark:'×'};
    let note;
    if(merged.length===1){ const s=merged[0][0], e=merged[0][1];
      if(s<=WS+60) note=this.fmtMin(e)+'以降なら空いてます';
      else if(e>=WE-120) note=this.fmtMin(s)+'までなら空いてます';
      else note=this.fmtMin(s)+'〜'+this.fmtMin(e)+' 以外なら空いてます';
    } else note='一部の時間なら空いてます';
    return {mark:'△',variant:'partial',note};
  }
  cycleMark(day,auto){ const order=['○','△','×']; const cur=this.state.overrides[day]||auto; const next=order[(order.indexOf(cur)+1)%3]; this.setState(s=>{ const o={...s.overrides}; if(next===auto) delete o[day]; else o[day]=next; return {overrides:o}; }); }

  // ---- pills ----
  pillStyle(ev){
    // 重ねて表示している iPhone のカレンダーの予定は、灰色の細い帯（種類の色を持たない）
    if(ev.overlay) return {height:16,boxSizing:'border-box',borderRadius:4,padding:'0 2px',marginBottom:3,fontSize:11,fontWeight:500,letterSpacing:'-.04em',lineHeight:'16px',whiteSpace:'nowrap',overflow:'hidden',display:'flex',alignItems:'center',background:'var(--bg2)',color:'var(--ink-mut)',borderLeft:'2px solid var(--ink-faint)'};
    // 夜勤の明け。前の日から続く分を、薄い帯で出す
    if(ev.ake){ const t0=this.T(ev.type); return {height:16,boxSizing:'border-box',borderRadius:4,padding:'0 2px',marginBottom:3,fontSize:11,fontWeight:500,letterSpacing:'-.04em',lineHeight:'16px',whiteSpace:'nowrap',overflow:'hidden',display:'flex',alignItems:'center',background:'transparent',color:this.inkDash(t0.color),borderBottom:'2px solid '+this.softLine(t0.color),opacity:.8}; }
    const t=this.T(ev.type);
    // 狭いマスで名前を1文字でも多く見せるため、余白と字間を詰める。
    // letterSpacing を少し詰めるだけで、日本語は1文字ぶん稼げる。
    const base={height:16,boxSizing:'border-box',borderRadius:4,padding:'0 2px',marginBottom:3,fontSize:11,fontWeight:500,letterSpacing:'-.04em',lineHeight:'16px',whiteSpace:'nowrap',overflow:'hidden',cursor:'pointer',display:'flex',alignItems:'center',transition:'background .28s cubic-bezier(.2,.9,.2,1),border-color .28s,color .28s'};
    if(ev.status==='kakutei') return {...base,background:this.softFill(t.color),color:this.inkOn(t.color)};
    if(ev.status==='mikakutei') return {...base,height:17,background:this.paperShow(t.paper),color:this.inkDash(t.color),border:'1.5px dashed '+this.softLine(t.color),lineHeight:'13px'};
    if(ev.status==='jisseki') return {...base,background:this.softFill(t.color),color:this.inkOn(t.color),opacity:.92};
    return {...base,background:'transparent',color:'#9AA0A6',textDecoration:'line-through',opacity:.5};
  }
  pillText(ev, wageOn){
    if(ev.status==='mikakutei') return '？'+ev.title;
    if(ev.status==='jisseki') return wageOn && ev.type==='baito' ? this.fmtWage(this.wage(ev)) : '✓'+ev.title;
    return ev.title;
  }
  // マスが狭いので、印（？ ✓）と予定の名前を分けて描く。
  // compact（月表示のマス）では「？」を出さない。点線の枠そのものが
  // 未確定を示しているので、印は重複であり、名前を削ってまで置く価値がない。
  // 「✓」は塗り同士（確定と実績）を見分ける唯一の手がかりなので残す。
  pillParts(ev, wageOn, compact){
    const cfg=this.state.settings||{};
    // 帯に開始時刻を出す設定のとき、「10 定例」のように時の数字だけを小さく添える（00分でなければ 10:30）
    const hh = (compact && cfg.barTime && !ev.allDay && ev.start && !ev.ake) ? (ev.start.endsWith(':00') ? String(parseInt(ev.start,10)) : ev.start.replace(/^0/,''))+' ' : '';
    if(ev.ake) return { mark:'', body:ev.title };
    // シフトの型で置いた予定は、記号（日・夜・休）を頭に出す
    if(ev.sym && compact) return { mark:ev.sym, body:ev.title };
    if(ev.overlay) return { mark:'', body:hh+ev.title };
    // 点線の頭の「仮」は設定で出す（月表示の帯では、点線の枠そのものが「まだ」を言っているので、ふだんは付けない）
    if(ev.status==='mikakutei') return { mark: compact ? (cfg.kariMark ? '仮' : '') : '？', body:hh+ev.title };
    if(ev.status==='jisseki') return wageOn && ev.type==='baito' ? { mark:'', body:this.fmtWage(this.wage(ev)) } : { mark:'✓', body:hh+ev.title };
    return { mark:'', body:hh+ev.title };
  }
  markStyleFor(ev){
    return { fontSize:+(9*this.evScale()).toFixed(1), fontWeight:800, opacity:.75, marginRight:2, flexShrink:0, letterSpacing:'-.02em' };
  }
  // 月表示の帯のかたち。端だけ丸めて、続きがある側は切り落とす。
  // 切り落とした辺は隣の週（や隣の月）へ地続きに見えるので、
  // 「ここで終わっていない」が言葉なしで伝わる。
  segShape(seg){
    const L=!seg || seg.startsHere!==false, R=!seg || seg.endsHere!==false;
    // グリッドの角を直角にしたので、帯の角も詰める（4px だと1つだけ丸くて浮く）
    const r=3;
    return {
      marginBottom:0,
      // マスの幅いっぱいに置く。端だけ 1px 空けて、隣の日の別の予定とくっつかないようにする。
      padding:'0 3px', marginLeft:L?1:0, marginRight:R?1:0,
      borderRadius:`${L?r:0}px ${R?r:0}px ${R?r:0}px ${L?r:0}px`,
      _L:L, _R:R,
    };
  }
  // 帯の左右どちらかが切り落とされているとき、その辺の線も消す
  trimBorder(style, sh){
    if(!style.border) return style;
    const out={...style};
    if(!sh._L) out.borderLeft='none';
    if(!sh._R) out.borderRight='none';
    return out;
  }
  pillView(ev, wageOn, seg){
    const sh=this.segShape(seg);
    const { _L, _R, ...shape }=sh;
    const m=this.state.morph;
    // 段の高さをそろえないと、日をまたぐ帯が隣のマスでずれて見える
    // 月表示の帯は、日一覧などで使うピルより一段細くする。
    // 未確定は上下に 1.5px の点線枠があるぶん、中の行の高さを引く。
    const es=this.evScale(), H=Math.round(MONTH_BAR_H*es), FS=+(MONTH_BAR_FS*es).toFixed(1);
    const evenOut=(st)=>({...st, height:H, fontSize:FS,
      lineHeight: (ev.status==='mikakutei' ? H-3 : H)+'px'});
    if(!m || m.id!==ev.id){
      const p=this.pillParts(ev,wageOn,true);
      return { text:p.body, mark:p.mark, markStyle:this.markStyleFor(ev),
        style:this.trimBorder(evenOut({...this.pillStyle(ev), ...shape}), sh),
        textStyle:{minWidth:0,overflow:'hidden',textOverflow:'ellipsis'}, morphing:false, fillStyle:{} };
    }
    const t=this.T(ev.type);
    const dash=m.phase==='dash', filling=m.phase==='fill'||m.phase==='settle';
    const style={height:H,boxSizing:'border-box',fontSize:FS,fontWeight:500,letterSpacing:'-.04em',lineHeight:(H-3)+'px',whiteSpace:'nowrap',overflow:'hidden',display:'flex',alignItems:'center',position:'relative',cursor:'pointer',
      background:this.paperShow(t.paper), border:'1.5px '+(dash?'dashed':'solid')+' '+this.softLine(t.color), transition:'border-color .14s linear', animation:m.phase==='settle'?'pillSettle .2s ease-out':'none', ...shape};
    const fillStyle={position:'absolute',left:0,top:0,right:0,bottom:0,background:this.softFill(t.color),transformOrigin:'left center',transform:filling?'scaleX(1)':'scaleX(0)',animation:m.phase==='fill'?'sweepFill .3s cubic-bezier(.2,.9,.2,1) forwards':'none',zIndex:0,borderRadius:2};
    const textStyle={position:'relative',zIndex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',color:this.inkOn(t.color),transition:'color .16s .12s linear'};
    return { text: ev.title, mark: dash?'?':'', markStyle:this.markStyleFor(ev), style:this.trimBorder(style,sh), textStyle, morphing:true, fillStyle };
  }
  // ---- 時刻の目盛りの上の箱（週表示と、日の「時間」表示） ----
  HOUR_H = 44;
  _timeGridBoxes(pool, over, o){
    const H=this.HOUR_H, es=this.evScale();
    const segs=[...segmentsForDay(pool, o.y, o.m, o.d), ...segmentsForDay(over||[], o.y, o.m, o.d)];
    return layoutColumns(segs).map((sg,i)=>{
      const e=sg.ev, ov=!!e.overlay, t=ov ? null : this.T(e.type);
      const h=Math.max(16,(sg.b-sg.a)/60*H-2);
      const base={position:'absolute', top:sg.a/60*H+1, height:h,
        left:`calc(${(sg.col/sg.cols*100).toFixed(3)}% + 1px)`, width:`calc(${(100/sg.cols).toFixed(3)}% - 2px)`,
        borderRadius:5, padding:'2px 4px', boxSizing:'border-box', overflow:'hidden', fontSize:+(10.5*es).toFixed(1), lineHeight:Math.round(13*es)+'px',
        cursor:'pointer', zIndex:1};
      let st;
      if(ov) st={...base, background:'var(--bg2)', color:'var(--ink-mut)', borderLeft:'2.5px solid var(--ink-faint)'};
      else if(e.status==='mikakutei') st={...base, background:this.paperShow(t.paper), color:this.inkDash(t.color), border:'1.5px dashed '+this.softLine(t.color)};
      else if(e.status==='nakunatta') st={...base, background:'transparent', color:'var(--ink-faint)', textDecoration:'line-through', border:'1px solid var(--line)'};
      else st={...base, background:this.softFill(t.color), color:this.inkOn(t.color)};
      const end = e.status==='jisseki' ? (e.actualEnd||e.end) : e.end;
      return { key:(e.id||'o'+i)+(sg.cont?'-c':''), a:sg.a, b:sg.b, style:st,
        title:(sg.cont?'↳ ':'')+(e.title||''), time: h>=28*es ? (e.start+'–'+end) : '',
        onClick:(ev)=>{ if(ev) ev.stopPropagation(); if(ov) return; this.openFor(e, this.state.screen==='day' ? 'day' : 'month'); } };
    });
  }
  _timeGridAllDay(pool, o){
    const list=allDayFor(pool, o.y, o.m, o.d);
    return { more: Math.max(0, list.length-2), pills: list.slice(0,2).map(e=>{ const t=this.T(e.type);
      const es=this.evScale();
      const st={fontSize:+(10*es).toFixed(1),lineHeight:Math.round(15*es)+'px',height:Math.round(17*es),borderRadius:4,padding:'0 4px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',boxSizing:'border-box',marginBottom:2,cursor:'pointer'};
      return { key:e.id, title:e.title, onClick:()=>this.openFor(e, this.state.screen==='day' ? 'day' : 'month'),
        style: e.status==='mikakutei' ? {...st, background:this.paperShow(t.paper), color:this.inkDash(t.color), border:'1.3px dashed '+this.softLine(t.color), lineHeight:(Math.round(15*es)-2)+'px'}
          : {...st, background:this.softFill(t.color), color:this.inkOn(t.color)} }; }) };
  }
  statusWord(ev){
    const t=this.T(ev.type);
    if(ev.status==='mikakutei') return t.uWord;
    if(ev.status==='jisseki') return '実績';
    if(ev.status==='nakunatta') return t.gone || '無くなった';
    return t.cWord;
  }

  // ---- nav / actions ----
  openFor(ev, from){
    const ret = from || this.state.returnTo;
    // まだの予定を押したとき、前はいつも中身より先に「どうなりました？」が出た。
    // 場所もメモも見られず、見るには編集画面まで行くしかなかった。
    // 先の日付の予定は、まず中身（詳細）を開く。「どうなった？」は詳細の主ボタンから聞く。
    // 今日と過ぎた日の予定は、決まったかどうかを聞く時期なので、これまでどおり小窓を出す
    const t=this.state.today;
    const future = dayNo(ev.y,ev.m,ev.day) > dayNo(t.y,t.m,t.d);
    if(ev.status==='mikakutei' && !future){ this.openDialog(ev,'confirm',ret); return; }
    // 無くなった予定も開ける。直したり、戻したり、消したりできるように
    this.setState({screen:'detail',detailId:ev.id,returnTo:ret});
  }
  openDay(d){ this.setState({screen:'day',dayNum:d,returnTo:'month',swipeRow:null,dayFrom:'month',dayDir:0}); }
  // 今日の月へ戻って、今日のマスを一瞬光らせる
  goToday(){
    tapLight();
    const t=this.state.today;
    this.setState({ym:{y:t.y,m:t.m}, dayNum:null, weekAnchor:null, flashToday:Date.now()});
  }

  // 空き状況の月送り。送った向きを持っておき、一覧をその向きから滑り込ませる。
  shiftFree(dir){
    tapLight();
    this.setState(s=>({ freeYM:shiftMonth(s.freeYM,dir), freeDir:dir }));
  }

  // 月の帯（3 か月分を横に並べたもの）を、描き直さずに直接ずらす。払っている間はこれだけ
  _moveTrack(dx, animate){
    const el=this._trackEl; if(!el) return;
    el.style.transition = animate ? 'transform .3s cubic-bezier(.22,.86,.3,1)' : 'none';
    el.style.transform = `translateX(calc(-33.3333% + ${dx}px))`;
  }

  // 滑り終わったスワイプ1回ぶんを、月の差し替えとして確定させる。
  // 次のスワイプが始まったときにも呼ぶので、素早く続けて払っても
  // 払った回数ぶん動く（以前はタイマーを消すだけで、1回ぶんが消えていた）。
  _commitSwipe(){
    if(!this._settle && !this._pendingDir) return; // 滑っている最中でなければ何もしない
    if(this._settle){ clearTimeout(this._settle); this._settle=null; }
    const dir=this._pendingDir||0;
    this._pendingDir=0;
    if(dir) this.setState(s=>({ym:shiftMonth(s.ym,dir), dayNum:null, swipe:{dx:0,animating:false}}));
    else this.setState({swipe:{dx:0,animating:false}});
  }
  // 既定の種類は「用事」。バイトをしない人のほうが多いのに、
  // 何もしなければシフトになる作りだった。
  // 時間もその種類のものから始める（用事が 17:00–22:00 で始まると面食らう）。
  defTimes(key){ const t=(this.state.types||[]).find(x=>x.key===key)||{};
    return { start: t.defStart || '10:00', end: t.defEnd || '11:00' }; }
  /**
   * 新しい予定の画面を開く。
   * 最初の値は、いつも「用事・10:00–11:00」だった。今の時刻にも、前回使った種類にも関係なく。
   *  ・種類は前回使ったもの（隠した種類なら、出している先頭の種類）
   *  ・今日の予定なら、次の区切り（30分刻み）の時刻から始める
   *  ・週表示や日の「時間」表示で空いた所を押したときは、その時刻から
   *  ・お知らせは設定の「いつものお知らせ」
   */
  openNew(day,ret,opts){ const o=opts||{}; const ym={y:o.y!=null?o.y:this.state.ym.y, m:o.m!=null?o.m:this.state.ym.m};
    const vis=this.visibleTypes();
    const last=this.state.settings.lastType;
    const type = vis.some(t=>t.key===last) ? last : (vis[0]||{key:'yoji'}).key;
    const tt=this.T(type);
    let dt=this.defTimes(type);
    const t=this.state.today, now=new Date();
    if(typeof o.start==='number'){ const a=Math.max(0,Math.min(1410,o.start)); dt={start:this.fmtMin(a), end:this.fmtMin(Math.min(1439,a+60))}; }
    else if(ym.y===t.y && ym.m===t.m && day===t.d && !tt.defStart){
      const next=Math.ceil((now.getHours()*60+now.getMinutes()+1)/30)*30;
      if(next<=22*60) dt={start:this.fmtMin(next), end:this.fmtMin(next+60)};
    }
    const cfg=this.state.settings;
    const allDay = !!tt.allDayDefault && typeof o.start!=='number';
    const remindMin = allDay ? (typeof cfg.remindAllDay==='number' ? cfg.remindAllDay : null) : (typeof cfg.remindTimed==='number' ? cfg.remindTimed : null);
    const job=(this.state.jobs||[]).find(j=>!j.retired);
    this.setState({screen:'new',returnTo:ret,newType:null,draft:{editingId:null,title:'',type,status:'kakutei',start:dt.start,end:dt.end,y:ym.y,m:ym.m,day,pickY:ym.y,pickM:ym.m,extraDays:[],jobId:(job||{}).id,allDay,days:1,remindMin,place:'',memo:'',link:'',repEvery:null,repSpan:3,repDows:[],added:[],picking:null,someday:null,cand:false,secret:false}});
    this._draft0=null;
  }
  // 既存の予定を同じ画面で直す。実績は「実際に働いた終わり」を編集対象にする。
  openEdit(ev,ret){
    this.setState({screen:'new',returnTo:ret||'month',newType:null,detailId:null,draft:{
      editingId:ev.id, title:ev.title, type:ev.type, status:ev.status,
      start:ev.start, end: ev.status==='jisseki' ? (ev.actualEnd||ev.end) : ev.end,
      y:ev.y, m:ev.m, day:ev.day, pickY:ev.y, pickM:ev.m, extraDays:[], jobId:ev.jobId, allDay:!!ev.allDay, days:evSpan(ev),
      remindMin: typeof ev.remindMin==='number' ? ev.remindMin : null,
      place:ev.place||'', memo:ev.memo||'', link:ev.link||'', secret:!!ev.secret, repEvery:null, repSpan:3, repDows:[],
      // 入っている項目だけ行を出す。空のものまで並べない
      added:[...(ev.place?['place']:[]), ...(ev.link?['link']:[]), ...(ev.memo?['memo']:[])], picking:null }});
  }
  /**
   * この予定をもとに、新しい予定を作る。編集と同じ画面を、中身入りで開く。
   *
   * 持っていかないものが3つある。
   *  ・状態のうち「終わったこと」——実績と無くなった予定。実績は
   *    「実際にあったこと」の記録なので、別の日に写すと嘘になる。
   *    だからコピーの行そのものを、その2つには出さない（下の menuRows）。
   *  ・働いた記録（actualEnd）。上と同じ理由。
   *  ・くり返しの結びつき（repId）。コピーは1件だけの話で、群れには入れない。
   *
   * 日付えらびを最初から開けておく。中身が同じで日だけ違うのがコピーなので、
   * 開いた人が最初にやることが決まっている。そのまま保存すれば同じ日に2つ置ける。
   * 何日ぶんかまとめたいときは、この画面の「複数日」がそのまま使える。
   */
  openCopy(ev,ret){
    tapLight();
    this.setState({screen:'new',returnTo:ret||'month',newType:null,detailId:null,draft:{
      editingId:null, title:ev.title, type:ev.type,
      status: ev.status==='mikakutei' ? 'mikakutei' : 'kakutei',
      start:ev.start, end:ev.end,
      y:ev.y, m:ev.m, day:ev.day, pickY:ev.y, pickM:ev.m, pickedOnce:false, pickYM:false,
      extraDays:[], jobId:ev.jobId, allDay:!!ev.allDay, days:evSpan(ev),
      remindMin: typeof ev.remindMin==='number' ? ev.remindMin : null,
      place:ev.place||'', memo:ev.memo||'', link:ev.link||'', secret:!!ev.secret, repEvery:null, repSpan:3, repDows:[],
      added:[...(ev.place?['place']:[]), ...(ev.link?['link']:[]), ...(ev.memo?['memo']:[])], picking:'date' }});
  }
  askDelete(id){ this.setState({confirmDelete:id, deleteRest:false}); }
  /**
   * この予定を人に送る。「10/3（金）19:00〜21:00 歓迎会 @渋谷」の文と、その1件だけの .ics を共有シートへ。
   * 点線の予定には「（まだ仮）」を付ける。前は全部の予定をまとめて書き出す形しかなかった
   */
  async sendEvent(ev){
    tapLight();
    const DW=['日','月','火','水','木','金','土'];
    const when = `${ev.m+1}/${ev.day}（${DW[new Date(ev.y,ev.m,ev.day).getDay()]}）` + (ev.allDay ? (evSpan(ev)>1 ? `から${evSpan(ev)}日間` : ' 終日') : ` ${ev.start}〜${ev.end}`);
    const lines=[`${when} ${ev.title}${ev.place && !/^https?:/.test(ev.place) ? ' @'+ev.place : ''}${ev.status==='mikakutei' ? '（まだ仮）' : ''}`];
    if(ev.link) lines.push(ev.link);
    if(ev.place && !/^https?:/.test(ev.place)) lines.push('地図：https://maps.apple.com/?q='+encodeURIComponent(ev.place));
    const msg = await shareTextAndFile(lines.join('\n'), `LUKKO-${ev.m+1}月${ev.day}日.ics`, toIcs([ev]));
    if(msg) this.toast(msg);
  }
  // 書きかけの予定があるか。キャンセルを押したとき、確かめずに捨てていた
  draftDirty(){
    const dr=this.state.draft; if(this.state.screen!=='new') return false;
    const t=(x)=>(x||'').trim();
    if(!dr.editingId) return !!(t(dr.title) || t(dr.place) || t(dr.memo) || t(dr.link));
    const e=this.state.events.find(x=>x.id===dr.editingId); if(!e) return false;
    const end = e.status==='jisseki' ? (e.actualEnd||e.end) : e.end;
    return t(dr.title)!==t(e.title) || dr.type!==e.type || dr.start!==e.start || dr.end!==end
      || dr.y!==e.y || dr.m!==e.m || dr.day!==e.day || dr.status!==e.status || !!dr.allDay!==!!e.allDay
      || t(dr.place)!==t(e.place) || t(dr.memo)!==t(e.memo) || t(dr.link)!==t(e.link);
  }

  // ---- 開発応援 ----
  // 値段は起動時ではなく、設定画面を開いたときに取りにいく。
  // 使い始めの人に、いきなり買えるものを見せたくない。
  async _loadTips(){
    if(this._tipsTried) return;
    this._tipsTried = true;
    try{
      const list = await loadTips();
      if(list && list.length) this.setState({tips:list});
    }catch(e){
      // 黙って諦める（利用者に見せるものではない）。診断からは見える。
      this._tipsTried = false;
    }
  }
  // バージョンを5回叩くと出る診断。ふつうに使う人には見えない。
  // 課金がうまくいかないとき、画面には何も出ない作りにしてあるので、
  // そのままだと原因が誰にも見えない。ここだけは全部見せる。
  tapVersion(){
    const n = (this._verTaps||0) + 1;
    this._verTaps = n;
    clearTimeout(this._verTimer);
    this._verTimer = setTimeout(()=>{ this._verTaps = 0; }, 1500);
    if(n >= 5){ this._verTaps = 0; this.runProbe(); }
  }
  async runProbe(){
    tapLight();
    this.setState({probe:{running:true}});
    try{
      const r = await probeTips();
      // ウィジェットの受け渡しも、ここで一緒に見えるようにする。
      // 端末でしか分からないことなので、画面に出さないと原因が追えない。
      r.widget = { there: widgetAvailable(), last: this._widgetLast || null };
      this.setState({probe:r});
      if(r.tips && r.tips.length) this.setState({tips:r.tips});
    }catch(e){
      // ここで落ちると「読み込み中…」のまま固まる。必ず何か出す。
      this.setState({probe:{ native:true, billing:null, asked:[], got:[],
        error:'診断そのものが落ちた: '+((e&&e.message)||String(e)), tips:null }});
    }
  }
  /** 診断から手で送る。自動で送るのを待たずに確かめられるように */
  async sendWidgetNow(){
    tapLight();
    this._widgetStamp = null;               // 前と同じ中身でも送り直す
    const r = await pushWidget(this.state);
    this._widgetLast = r;
    this.setState(s=>({probe:{...(s.probe||{}), widget:{ there: widgetAvailable(), last: r }}}));
  }

  /**
   * 押している最中の見た目。key を渡すと沈み、null で戻る。
   * key は画面ごとに好きな文字列でいい（'tip:a'、'act:copy' など）。
   * styles.css で tap-highlight を切ってあるうえ、直書きの style では
   * :active が書けないので、押した感はここで作るしかない。
   */
  setPressed(key){
    if(this.state.pressed !== key) this.setState({pressed:key});
  }
  /** 画面の下に一言だけ出す。同じ間合いで消す（呼ぶたびに消える時刻を延ばす） */
  toast(msg, ms=2400){
    this.setState({shareToast:true, shareMsg:msg});
    clearTimeout(this._toastT);
    this._toastT=setTimeout(()=>this.setState({shareToast:false}), ms);
  }

  async buyTip(id){
    // 返事を待っているあいだの二度押しを止める。
    // App Store の画面が出るまで1〜2秒あるので、その間にもう一度押せてしまう。
    // 手ごたえもここより先には出さない（押せていないのに鳴ると嘘になる）。
    if(this.state.tipBusy) return;
    tapLight();
    this.setState({tipBusy:id});
    let r;
    try{ r = await buyTip(id); }
    finally{ this.setState({tipBusy:null, pressed:null}); }
    if(r.ok){
      // 消耗型は Apple 側で復元できない。自前で持たないと機種変更で消えるので、
      // 予定と同じ入れ物に入れる（控えにも入る）。
      const t=TIPS.find(x=>x.id===id);
      this.setState(s=>({supports:[...(s.supports||[]), {id, yen:(t&&t.yen)||0, at:Date.now()}]}));
    }
    if(r.msg) this.setState({shareToast:true, shareMsg:r.msg},
      ()=>setTimeout(()=>this.setState({shareToast:false}), 2400));
  }

  // ---- 一覧の行を左へスワイプして削除 ----
  // 開くのは一度に1行だけ。開いている行があるときは、本文をタップしても
  // 予定を開かず、まず閉じる（指の下にあるものが変わらないようにする）。
  SWIPE_W = 84; // 削除ボタンの幅
  rowSwipeStart(id,e){
    const t=e.touches&&e.touches[0]; if(!t) return;
    this._rsx=t.clientX; this._rsy=t.clientY; this._rAxis=null; this._rId=id;
    this._rBase=(this.state.swipeRow&&this.state.swipeRow.id===id)?this.state.swipeRow.dx:0;
  }
  rowSwipeMove(id,e){
    const t=e.touches&&e.touches[0]; if(!t||this._rsx==null||this._rId!==id) return;
    const dx=t.clientX-this._rsx, dy=t.clientY-this._rsy;
    // 最初の数pxで、横に払っているのか縦に送っているのかを決める
    if(!this._rAxis){
      if(Math.abs(dx)<6 && Math.abs(dy)<6) return;
      this._rAxis = Math.abs(dx)>Math.abs(dy)*1.2 ? 'x' : 'y';
    }
    if(this._rAxis!=='x') return;
    // 縦スクロールに持っていかれないようにするのは touch-action:pan-y の役目。
    // React の touchmove は passive なので preventDefault は効かない。
    let d=this._rBase+dx;
    if(d>0) d=0;                                   // 右には開かない
    if(d<-this.SWIPE_W) d=-this.SWIPE_W-(-this.SWIPE_W-d)*0.25; // 行き過ぎは重くする
    this.setState({swipeRow:{id, dx:d, animating:false}});
  }
  rowSwipeEnd(id){
    const wasX=this._rAxis==='x'; this._rsx=null; this._rAxis=null;
    if(!wasX) return;
    const sr=this.state.swipeRow;
    const dx=(sr&&sr.id===id)?sr.dx:0;
    const open = dx < -this.SWIPE_W/2;
    this.setState({swipeRow:{id, dx: open?-this.SWIPE_W:0, animating:true}});
  }
  closeSwipeRow(){ const sr=this.state.swipeRow; if(sr&&sr.dx) this.setState({swipeRow:{id:sr.id,dx:0,animating:true}}); }

  // ---- サポーターカードを指で回す ----
  // 押して裏返すだけでなく、指でなぞった分だけその場で回る。
  // 角度は CSS の transition ではなく、こちらで1コマずつ進める。
  // そうしておくと、表と裏の入れ替えを角度そのものから出せる——
  // 別々に持って時間を合わせようとすると、途中で消えるようなずれが出る。
  cardTouchStart(e){
    const t=e.touches&&e.touches[0]; if(!t) return;
    if(this._cRaf){ cancelAnimationFrame(this._cRaf); this._cRaf=null; }
    this._cx=t.clientX; this._cy=t.clientY; this._cAxis=null; this._cMoved=false;
    this._cBase=this.state.cardAngle||0;
    const box=e.currentTarget&&e.currentTarget.getBoundingClientRect();
    this._cW=(box&&box.width)||320;
    this._cLast={deg:this._cBase, at:Date.now()};
    this._cVel=0;
  }
  cardTouchMove(e){
    const t=e.touches&&e.touches[0]; if(!t||this._cx==null) return;
    const dx=t.clientX-this._cx, dy=t.clientY-this._cy;
    // 行と同じ決め方。最初の数pxで、回しているのか画面を送っているのかを決める
    if(!this._cAxis){
      if(Math.abs(dx)<6 && Math.abs(dy)<6) return;
      this._cAxis = Math.abs(dx)>Math.abs(dy)*1.2 ? 'x' : 'y';
    }
    // 上下は裏返しに使わない（その向きは画面送り）。
    // ただし黙って動かないのではなく、指について少しだけ寝かせる。
    // 手に持った紙は、押した側がわずかに下がるので。
    const tilt=tiltFor(dy);
    if(this._cAxis!=='x'){ this.setState({cardTilt:tilt}); return; }
    this._cMoved=true;
    const deg=this._cBase+dragToDeg(dx,this._cW);
    const at=Date.now(), dt=Math.max(1, at-this._cLast.at);
    this._cVel=(deg-this._cLast.deg)/(dt/1000);
    this._cLast={deg,at};
    this.setState({cardAngle:deg, cardTilt:tilt});
  }
  cardTouchEnd(){
    const moved=this._cAxis==='x'&&this._cMoved;
    this._cx=null; this._cAxis=null; this._cMoved=false;
    const from=this.state.cardAngle||0;
    // 上下だけなぞったときも、傾きは元に戻してやる必要がある
    if(!moved){ if(this.state.cardTilt) this._settleCard(from); return; }
    this._cTapOff=Date.now()+400;      // なぞったあとに来る click は無視する
    const to=settle(from, this._cVel);
    if(showsFront(from)!==showsFront(to)) tapLight();
    this._settleCard(to);
  }
  /** 指を離したあと、落ち着く先まで自分で回す。傾きも一緒に戻す */
  _settleCard(to){
    if(this._cRaf){ cancelAnimationFrame(this._cRaf); this._cRaf=null; }
    const from=this.state.cardAngle||0, tilt0=this.state.cardTilt||0;
    if(from===to && !tilt0){ this.setState({cardAngle:norm(to), cardTilt:0}); return; }
    // 傾きだけを戻すときは、回転ぶんの時間を待たせない
    const dur=(from===to ? 0.3 : settleTime(from,to))*1000, t0=Date.now();
    const step=()=>{
      const p=Math.min(1,(Date.now()-t0)/dur);
      if(p>=1){ this._cRaf=null; this.setState({cardAngle:norm(to), cardTilt:0}); return; }
      const e=ease(p);
      this.setState({cardAngle: from+(to-from)*e, cardTilt: tilt0*(1-e)});
      this._cRaf=requestAnimationFrame(step);
    };
    this._cRaf=requestAnimationFrame(step);
  }
  stopCardFlip(){ if(this._cRaf){ cancelAnimationFrame(this._cRaf); this._cRaf=null; } }

  // ---- はじめての案内 ----
  // 点線が塗りに変わる瞬間を、その場で一度さわってもらう
  // 本物と同じ形にしてある。点線を押すと「どうなりました？」と聞かれ、
  // 「確定した」を押して初めて塗りになる。案内で1回で変わるようにしていると、
  // 実際に触ったときに一手多く感じる。しかもその一手は省けない——
  // 確定するときは時刻が変わることが多く、そこで直させたいので。
  onboardDemoTap(){
    if(this.state.onboard.demo!=='dash') return;
    tapLight();
    this.setState(s=>({onboard:{...s.onboard, demo:'asking'}}));
  }
  onboardDemoConfirm(){
    if(this.state.onboard.demo!=='asking') return;
    tapLight();
    this.setState(s=>({onboard:{...s.onboard, demo:'fill'}}));
    setTimeout(()=>{ penTick(); }, 120);
    setTimeout(()=>{ settleSuccess(); this.setState(s=>({onboard:{...s.onboard, demo:'done'}})); }, 430);
  }
  onboardResetDemo(){ this.setState(s=>({onboard:{...s.onboard, demo:'dash'}})); }
  // ページを進める押し下げは、外側の「押すと速くなる」まで届く（子→親の順）。
  // 同じ押し下げで fast:true が後から入り、次のページが速送りで始まっていた。印を立てて、外側で見送る
  _obStepTap(){ this._obStepping=true; setTimeout(()=>{ this._obStepping=false; }, 0); }
  onboardNext(){ tapLight(); this._obStepTap(); this.setState(s=>({onboard:{...s.onboard, step:s.onboard.step+1, fast:false}})); }
  onboardBack(){ this._obStepTap(); this.setState(s=>({onboard:{...s.onboard, step:Math.max(0,s.onboard.step-1), fast:false}})); }
  /**
   * 最初に1問だけ聞く：ふだんの予定に近いのは？
   * 開いてすぐ「用事・バイト・遊び」と「カフェバイト」が並ぶと、社会人はそこで閉じてしまう。
   * 答えで、種類・呼び名・見本・給料の出し方・空き状況の時間帯・週のはじまりを決める。
   */
  onboardPick(key){
    tapLight(); this._obStepTap();
    this.setState(s=>{
      const next={...s.onboard, step:1, picked:key, demo:'dash', fast:false};
      // 設定から「使い方をもう一度見る」ときは、見直したいだけ。同じ答えなら何も変えずに進む。
      // 違う答えでも、自分で直した週のはじまり・勤務時間・空き状況の時間帯・仮の印は残す
      if(s.onboard.replay && key===s.settings.profile) return { onboard:next };
      const r=this.applyProfile(key, s); if(!r) return null;
      if(s.onboard.replay) return { ...r, onboard:next, settings:{...r.settings, weekStart:s.settings.weekStart, workHours:s.settings.workHours,
        freeWd:s.settings.freeWd, freeHd:s.settings.freeHd, kariMark:s.settings.kariMark} };
      return { ...r, onboard:next }; });
  }
  finishOnboard(goImport){
    stampHeavy();
    const morning = !!this.state.onboard.morning;
    this.setState(s=>({ settings:{...s.settings, onboarded:true, ...(morning ? {morning:true, morningAt:s.settings.morningAt||450} : {})},
      screen: goImport ? 'import' : 'month' }));
    if(goImport) this.setState({imp:{phase:'idle', found:[], type:'yoji', error:''}});
  }

  // ---- バイト先 ----
  addJob(){
    tapLight();
    const id=uid('j');
    this.setState(s=>({ jobs:[...s.jobs,{id,name:'',hourly:s.settings.hourly}], editJobId:id }));
  }
  // 時給を変えるときは、それまでの働いた記録に「前の時給」を書き込んでから変える。
  // こうしておけば、時給を上げても過去の給料は変わらない。書き込むのは最初の1回だけ
  // （すでに時給を持っている記録は触らない）ので、打ちかけの数字で上書きされることもない。
  patchJob(id,patch){ this.setState(s=>{
    const old=s.jobs.find(j=>j.id===id);
    const rateChanged = old && typeof patch.hourly==='number' && patch.hourly!==old.hourly;
    const events = rateChanged
      ? s.events.map(e=>(e.jobId===id && e.status==='jisseki' && typeof e.hourly!=='number') ? {...e, hourly:old.hourly} : e)
      : s.events;
    return { jobs:s.jobs.map(j=>j.id===id?{...j,...patch}:j), events, rateNote: rateChanged ? id : s.rateNote };
  }); }
  // これまでの記録も、いまの時給で数え直す（書き込んだ時給を外す）。本人が選んだときだけ
  recountJob(id){
    tapLight();
    this.setState(s=>({ events:s.events.map(e=>(e.jobId===id && e.status==='jisseki' && typeof e.hourly==='number') ? {...e, hourly:undefined, updatedAt:Date.now()} : e), rateNote:null }));
    this.toast('これまでの記録を、いまの時給で数え直しました');
  }
  // 辞めたバイト先。一覧と選ぶ所からは消えるが、過去の記録と時給はそのまま残る
  retireJob(id, on){
    tapLight();
    this.setState(s=>({ jobs:s.jobs.map(j=>j.id===id?{...j, retired: on ? true : undefined}:j), editJobId:null }));
  }
  removeJob(id){
    // 消したバイト先の記録は、名前と時給を予定に書き込んで残す。
    // 前は設定の時給（1,120円）で数え直されて、過去の給料が変わっていた
    const job=this.state.jobs.find(j=>j.id===id);
    this.setState(s=>({ jobs:s.jobs.filter(j=>j.id!==id), editJobId:null, confirmJob:null, gone:goneAdd(s,['job:'+id]),
      events:s.events.map(e=>{
        if(e.jobId!==id) return e;
        const keep = e.status==='jisseki'
          ? { hourly: typeof e.hourly==='number' ? e.hourly : (job ? job.hourly : undefined), jobName: job ? job.name : undefined }
          : {};
        return {...e, ...keep, jobId: e.status==='jisseki' ? e.jobId : undefined, updatedAt:Date.now()};
      }) }));
  }
  // バイト先を選ぶと、名前もそのまま予定の名前に使う（テンプレのように）
  pickJob(id){
    tapLight();
    this.setState(s=>{
      const job=s.jobs.find(j=>j.id===id);
      const prev=s.jobs.find(j=>j.id===s.draft.jobId);
      const keepTitle = s.draft.title && s.draft.title!==(prev&&prev.name);
      return { draft:{...s.draft, jobId:id, title: keepTitle ? s.draft.title : (job?job.name:s.draft.title)} };
    });
  }
  clearJob(){ this.setState(s=>({draft:{...s.draft, jobId:undefined}})); }
  // 予定を作りかけのまま、その場でバイト先を足せるようにする
  // （設定画面に飛ばすと、入力していた内容が消えてしまうため）
  startNewJob(){ tapLight(); this.setState(s=>({newJob:{name:'',hourly:s.settings.hourly}})); }
  cancelNewJob(){ this.setState({newJob:null}); }
  commitNewJob(){
    const nj=this.state.newJob; if(!nj) return;
    tapLight();
    const id=uid('j');
    const name=(nj.name||'').trim()||this.words().job;
    this.setState(s=>{
      const prev=s.jobs.find(j=>j.id===s.draft.jobId);
      const keepTitle = s.draft.title && s.draft.title!==(prev&&prev.name);
      return { jobs:[...s.jobs,{id,name,hourly:nj.hourly}], newJob:null,
        draft:{...s.draft, jobId:id, title: keepTitle ? s.draft.title : name} };
    });
  }

  // ---- 複数日えらび ----
  toggleExtraDay(y,m,d){
    const key=y+'-'+m+'-'+d;
    this.setState(s=>{
      // 本体の日付そのものは外せない
      if(s.draft.y===y && s.draft.m===m && s.draft.day===d) return null;
      const cur=s.draft.extraDays||[];
      const has=cur.includes(key);
      return { draft:{...s.draft, extraDays: has ? cur.filter(k=>k!==key) : [...cur,key]} };
    });
  }

  // ---- iPhone のカレンダーから取り込む ----
  openImport(){ this.setState({screen:'import', imp:{phase:'idle', found:[], type:'yoji', error:''}}); }
  async runScan(){
    tapLight();
    this.setState(s=>({imp:{...s.imp, phase:'scanning', error:''}}));
    const perm = await askCalendarAccess();
    if(perm!=='granted'){
      this.setState(s=>({imp:{...s.imp, phase:'idle',
        denied: perm!=='unavailable',
        error: perm==='unavailable'
          ? 'この端末では取り込みを使えません。'
          : 'カレンダーを読む許可が下りませんでした。設定アプリで「カレンダー」を許可すると取り込めます。'}}));
      return;
    }
    // どのカレンダーを読むかを先に選んでもらう（前は購読と誕生日以外を全部読んでいた）。
    // 選んだ内容とカレンダーごとの種類は覚えておき、次からはそのまま使う
    try{
      const cals = await listImportCalendars();
      const mem = this.state.settings.importCals || {};
      const rows = cals.map(c=>({ ...c, on: mem[c.id] ? mem[c.id].on !== false : true, type: mem[c.id] ? mem[c.id].type || '' : '' }));
      if(!rows.length){ await this.runRead([]); return; }
      this.setState(s=>({imp:{...s.imp, phase:'cals', cals:rows, range:s.imp.range||'month'}}));
    }catch(e){
      await this.runRead(null);
    }
  }
  // 選んだカレンダーを読む。2回目からは、前に取り込んだ予定と突き合わせて「直った」「元で消えた」を分ける
  async runRead(calIds){
    tapLight();
    const im=this.state.imp||{};
    this.setState(s=>({imp:{...s.imp, phase:'scanning', error:''}}));
    try{
      const now=new Date();
      const fromDate = im.range==='year' ? new Date(now.getFullYear(),0,1) : im.range==='back' ? new Date(now.getFullYear()-1,now.getMonth(),1) : new Date(now.getFullYear(),now.getMonth()-1,1);
      const ids = calIds || (im.cals||[]).filter(c=>c.on).map(c=>c.id);
      // 覚えておく（次は同じ選び方から始める）
      if(im.cals && im.cals.length){
        const mem={}; for(const c of im.cals) mem[c.id]={on:c.on, type:c.type||''};
        this.setState(s=>({settings:{...s.settings, importCals:mem}}));
      }
      const all = await readCalendarEvents({monthsAhead:12, calIds: ids.length ? ids : null, fromDate});
      const fromN=dayNo(fromDate.getFullYear(),fromDate.getMonth(),fromDate.getDate());
      const toN=dayNo(now.getFullYear(),now.getMonth()+13,0);
      const { fresh, changed, gone } = diffImport(all, this.state.events, {from:fromN, to:toN, cals: ids.length ? ids : null});
      // 種類：カレンダーごとに決めてあればそれ、無ければ名前から当てる。当たらなければ用事
      const calType = {}; for(const c of im.cals||[]) if(c.type) calType[c.id]=c.type;
      const guesses = guessTypes(fresh, this.state.types);
      const picked = [
        ...fresh.map((e,i)=>({...e, key:'k'+i, on:true, kind:'new',
          type: calType[e.srcCal] || guesses[i].key, guessed: !calType[e.srcCal] && !!guesses[i].why })),
        ...changed.map((c,i)=>({...c.incoming, key:'c'+i, on:true, kind:'changed', existingId:c.existing.id, type:c.existing.type,
          was:`${c.existing.m+1}/${c.existing.day} ${c.existing.allDay?'終日':c.existing.start}` })),
        ...gone.map((e,i)=>({...e, key:'g'+i, on:false, kind:'gone', existingId:e.id })),
      ];
      // 1件も無いときは、たいてい「別のカレンダーアプリを使っている」ことが理由。
      // そのときだけ、ほかのカレンダーの案内を開いた状態で出す。
      this.setState(s=>({imp:{...s.imp, phase:'found', found:picked, source:'cal',
        otherOpen: picked.length===0 ? true : s.imp.otherOpen}}));
    }catch(e){
      this.setState(s=>({imp:{...s.imp, phase:'idle', error:'予定を読めませんでした。時間をおいて試してください。'}}));
    }
  }
  doImport(){
    const on = (this.state.imp.found||[]).filter(e=>e.on);
    if(!on.length) return;
    stampHeavy();
    const now=Date.now();
    // 取り込む前の状態を控えに残す（取り込みは、まとめて入れ替わるので）
    if(this.state.events.length) writeBackup('before', this._backupText());
    const tag = uid('i');
    const fresh=on.filter(e=>!e.kind || e.kind==='new');
    const add = fresh.map((e,i)=>({ id:tag+'-'+i, type:e.type, title:e.title, y:e.y, m:e.m, day:e.day,
      start:e.start, end:e.end, status:e.status||'kakutei', allDay:e.allDay, updatedAt:now,
      ...(e.allDay && e.days>1 ? {days:e.days} : {}), ...(e.memo ? {memo:e.memo} : {}), ...(e.place ? {place:e.place} : {}),
      ...(e.link ? {link:e.link} : {}), ...(e.srcId ? {srcId:e.srcId} : {}), ...(e.srcCal ? {srcCal:e.srcCal} : {}) }));
    // 直った予定：日付・時刻・題名・場所を元に合わせる。種類と「決まった／まだ」はこちらのまま
    const upd = new Map(on.filter(e=>e.kind==='changed').map(e=>[e.existingId, e]));
    const del = new Set(on.filter(e=>e.kind==='gone').map(e=>e.existingId));
    const removed = this.state.events.filter(e=>del.has(e.id));
    this.setState(s=>({ events:[...s.events.filter(e=>!del.has(e.id)).map(e=>{ const u=upd.get(e.id); if(!u) return e;
        return {...e, title:u.title, y:u.y, m:u.m, day:u.day, start:u.start, end:u.end, allDay:u.allDay, days:u.allDay&&u.days>1?u.days:undefined,
          place:u.place||e.place, memo:u.memo||e.memo, link:u.link||e.link, updatedAt:now}; }), ...add],
      trash:[...removed.map(ev=>({ev, at:now})), ...(s.trash||[])].slice(0,400),
      settings:{...s.settings, lastImport: add.length ? {tag, at:now} : s.settings.lastImport},
      imp:{...s.imp, phase:'done', added:add.length, updated:upd.size, removed:del.size,
        withPlace:add.filter(e=>e.place).length, multi:add.filter(e=>e.days>1).length, dashed:add.filter(e=>e.status==='mikakutei').length} }));
  }
  toggleImportRow(key){ this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>e.key===key?{...e,on:!e.on}:e)}})); }
  setImportRowType(key,type){ this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>e.key===key?{...e,type}:e)}})); }
  setAllImport(on){ tapLight(); this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>({...e,on}))}})); }
  setAllImportType(type){ tapLight(); this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>e.on?{...e,type}:e)}})); }
  doDelete(){
    const id=this.state.confirmDelete;
    const all=this.state.deleteRest;
    const ev=this.state.events.find(e=>e.id===id);
    // 「これ以降ぜんぶ」のとき、同じくり返しで作った、その日以降のものを消す。
    // 前の分を残すのは、もう済んだ予定まで消えると困るため。
    const gone = (e)=>{
      if(e.id===id) return true;
      if(!all || !ev || !ev.repId) return false;
      return e.repId===ev.repId && evFrom(e)>=evFrom(ev);
    };
    // 消した予定は30日だけ「最近消した予定」に置く。直後なら画面の下の「元に戻す」でも戻せる
    const now=Date.now();
    const removed=this.state.events.filter(gone);
    this.setState(s=>({ events:s.events.filter(e=>!gone(e)), confirmDelete:null, deleteRest:false, dialog:null, swipeRow:null,
      trash:[...removed.map(ev=>({ev, at:now})), ...(s.trash||[])].slice(0,400),
      screen: s.detailId===id ? (s.returnTo==='detail' ? 'month' : (s.returnTo||'month')) : s.screen, detailId: s.detailId===id ? null : s.detailId }));
    if(removed.length) this.showUndo(removed.length>1 ? `${removed.length}件を削除しました` : `「${removed[0].title}」を削除しました`,
      {kind:'del', ids:removed.map(e=>e.id)});
  }
  /**
   * 取り消しの帯。5秒だけ画面の下に出す。
   * 削除・「無くなった」・「確定した」は、どれも押し間違えると取り返しがつかなかった。
   * 確かめの小窓を増やすより、やったあとに戻せるほうが手が止まらない。
   */
  showUndo(text, data){
    clearTimeout(this._undoT);
    this.setState({undo:{text, data, key:Date.now()}});
    this._undoT=setTimeout(()=>this.setState({undo:null}), 5000);
  }
  undoLast(){
    const u=this.state.undo; if(!u) return;
    tapLight();
    clearTimeout(this._undoT);
    const d=u.data;
    if(d.kind==='del') this.restoreTrash(d.ids, true);
    else if(d.kind==='status') this.setState(s=>({ events:s.events.map(e=>e.id===d.id?{...e,...d.prev,updatedAt:Date.now()}:e), morph:null }));
    else if(d.kind==='many') this.setState(s=>({ events:s.events.map(e=>d.prev[e.id]?{...e,...d.prev[e.id],updatedAt:Date.now()}:e) }));
    this.setState({undo:null});
  }
  // 最近消した予定から戻す
  restoreTrash(ids, quiet){
    const want=new Set(ids);
    const hit=(this.state.trash||[]).filter(x=>want.has(x.ev.id));
    // 棚（日にち未定）から消したものは、日付を持たない。棚へ戻す
    const shelf=hit.filter(x=>x.someday).map(x=>({...x.someday, at:Date.now()}));
    // 戻した時刻を付け直す。古い時刻のままだと、iCloud に残っている「消した」印に負けて、また消える
    const now=Date.now();
    const evs=sanitizeEvents(hit.filter(x=>!x.someday).map(x=>x.ev)).map(e=>({...e, updatedAt:now}));
    const kept=new Set([...evs.map(e=>e.id), ...shelf.map(x=>x.ev && x.ev.id)]);
    this.setState(s=>({ events:[...s.events.filter(e=>!kept.has(e.id)), ...evs],
      someday: shelf.length ? [...shelf, ...(s.someday||[]).filter(x=>!shelf.some(y=>y.id===x.id))] : s.someday,
      trash:(s.trash||[]).filter(x=>!kept.has(x.ev.id)) }));
    if(!quiet) this.toast(`${evs.length+shelf.length}件を戻しました`);
  }
  openDialog(ev,mode,ret){
    // 実績を記録し直すときは、記録済みの終了時刻から始める
    const again = mode==='worked' && ev.status==='jisseki';
    const origS = (mode==='confirm' && ev.want) ? ev.want[0] : ev.start;
    const origE = again ? (ev.actualEnd||ev.end) : ((mode==='confirm' && ev.want) ? ev.want[1] : ev.end);
    this.setState({ returnTo:ret||this.state.returnTo, dialog:{ id:ev.id, mode, type:ev.type, title:ev.title, y:ev.y, m:ev.m, day:ev.day, start:origS, end:origE, origS, origE,
      breakMin:this.breakMin(ev), picking:null } });
  }
  patchDlg(k,d){ this.setState(s=>({ dialog:{...s.dialog,[k]:this.addMin(s.dialog[k],d)} })); }
  setSetting(k,val){ this.setState(s=>({ settings:{...s.settings,[k]:val} })); }
  recolorKey(key,hex){ this.setState(s=>({ types:s.types.map(t=>t.key===key?{...t,color:hex,paper:this.paperFrom(hex),dark:this.darkFrom(hex)}:t) })); }
  // 種類の名前を変える。自分で足した種類は「未確定の◯◯」「◯◯」という
  // 言い回しも名前から作っているので、あわせて作り直す。
  // 最初から入っている4つ（バイト・用事・遊び・その他）は、
  // 「希望シフト／確定シフト」のような言い回しを人が選んでいるので触らない。
  renameType(key,name){
    this.setState(s=>({ types:s.types.map(t=>{
      if(t.key!==key) return t;
      return String(t.key).startsWith('c') ? {...t, name, uWord:'未確定の'+name, cWord:name} : {...t, name};
    })}));
  }
  // 予定を書き換えるところは全部ここを通る。更新時刻もここで押す。
  // （将来クラウド同期を作るとき「どちらが新しいか」の判定に要る）
  updateEvent(id,patch){ this.setState(s=>({ events:s.events.map(e=>e.id===id?{...e,...patch,updatedAt:Date.now()}:e) })); }

  dlgPrimary(){
    const d=this.state.dialog;
    tapLight();
    // 実績の確定は「✓を判子で押す」— 重めのひと突き（§6）
    if(d.mode==='worked'){ stampHeavy();
      const ev0=this.state.events.find(e=>e.id===d.id);
      // 記録した時点の時給を書き込む。あとで時給を変えても、この記録の金額は変わらない。
      // 記録し直すときは、前に書き込んだ時給をそのまま使う（hourlyFor が ev.hourly を先に見る）
      const hourly = ev0 && ev0.type==='baito' ? this.hourlyFor(ev0) : undefined;
      this.updateEvent(d.id,{status:'jisseki',start:d.start,actualEnd:d.end,
        breakMin: d.breakMin>0 ? d.breakMin : undefined, hourly});
      this.setState({dialog:null}); return; }
    // 依頼A: ダイアログを閉じ→カレンダー上のピルが点線から左→右へ塗り満ちる (§6)
    const ev0=this.state.events.find(e=>e.id===d.id);
    const prev = ev0 ? {status:ev0.status, start:ev0.start, end:ev0.end, want:ev0.want} : null;
    this.updateEvent(d.id,{start:d.start,end:d.end,want:[d.origS,d.origE]});
    // 確定した日の月を開く。前はいつも「いま見ている月」に戻っていて、別の月の予定だと塗りが見えなかった
    this.setState(s=>({dialog:null, screen:'month', dayNum:null, detailId:null, morph:{id:d.id, phase:'dash'},
      ym: ev0 ? {y:ev0.y, m:ev0.m} : s.ym}));
    setTimeout(()=>{ if(this.state.morph&&this.state.morph.id===d.id){ this.setState({morph:{id:d.id, phase:'fill'}}); penTick(); } }, 150);
    setTimeout(()=>{ if(this.state.morph&&this.state.morph.id===d.id){ this.setState({morph:{id:d.id, phase:'settle'}}); settleSuccess(); } }, 470);
    setTimeout(()=>{
      if(!this.state.morph||this.state.morph.id!==d.id) return;
      this.updateEvent(d.id,{status:'kakutei'}); this.setState(s=>({morph:null, settings:{...s.settings, confirmCount:(s.settings.confirmCount||0)+1}}));
      setTimeout(()=>this.maybeAskReview('confirm'), 600);
      // 候補日の1つだった：ほかの候補を片づけるか聞く（勝手には消さない）
      const others = ev0 && ev0.candId
        ? this.state.events.filter(e=>e.candId===ev0.candId && e.id!==d.id && e.status==='mikakutei') : [];
      if(others.length) this.setState({candAsk:{id:d.id, title:ev0.title, ids:others.map(e=>e.id)}});
      else if(prev) this.showUndo(`「${ev0.title}」を確定しました`, {kind:'status', id:d.id, prev});
    }, 760);
  }
  /**
   * 予定を別の日へ動かす（延期）。元の日は「◯月◯日から延期」として詳細に残す。
   * 決まった日として置くか、まだ仮のまま置くかは、押したボタンで決める
   */
  moveEvent(id, to, status){
    if(!to) return;
    const ev0=this.state.events.find(e=>e.id===id); if(!ev0) return;
    tapLight();
    const prev={y:ev0.y, m:ev0.m, day:ev0.day, status:ev0.status, movedFrom:ev0.movedFrom};
    const movedFrom = ev0.movedFrom || {y:ev0.y, m:ev0.m, day:ev0.day};
    this.updateEvent(id,{y:to.y, m:to.m, day:to.d, status, movedFrom, candId: status==='kakutei' ? ev0.candId : ev0.candId});
    this.setState({dialog:null, screen: this.state.screen==='detail' ? 'detail' : this.state.screen, ym:{y:to.y,m:to.m}});
    this.showUndo(`「${ev0.title}」を${to.m+1}月${to.d}日に動かしました`, {kind:'status', id, prev});
  }
  /**
   * 日にちをまだ決めない。予定をカレンダーから外して「棚」に置く（今月のどこか、など）。
   * 月表示の上に「今月のどこか ◯件」と出て、日が決まったらそこからマスへ移す
   */
  toSomeday(id, when){
    const ev0=this.state.events.find(e=>e.id===id); if(!ev0) return;
    tapLight();
    const t=this.state.today;
    const item={ id:uid('s'), when, title:ev0.title, type:ev0.type, y:t.y, m:t.m, day:t.d, at:Date.now(),
      ev:{...ev0, status:'mikakutei'} };
    this.setState(s=>({ events:s.events.filter(e=>e.id!==id), someday:[item, ...(s.someday||[])], gone:goneAdd(s,[id]),
      dialog:null, detailId: s.detailId===id ? null : s.detailId, screen: s.detailId===id ? 'month' : s.screen }));
    this.toast(`「${ev0.title}」を「${SOMEDAY_LABEL[when]}」に置きました`);
  }
  // 棚の予定に日を決めて、カレンダーへ移す。まだ決まったわけではないので点線で置く
  placeSomeday(sid, y, m, d){
    const it=(this.state.someday||[]).find(x=>x.id===sid); if(!it) return;
    tapLight();
    const base = it.ev || { id:uid('n'), type:it.type, title:it.title, start:this.defTimes(it.type).start, end:this.defTimes(it.type).end, allDay:false };
    const ev={...base, y, m, day:d, status:'mikakutei', updatedAt:Date.now()};
    if(!ev.id) ev.id=uid('n');
    this.setState(s=>({ someday:(s.someday||[]).filter(x=>x.id!==sid), events:[...s.events, ev], somedayPick:null, ym:{y,m}, gone:goneAdd(s,[sid]) }));
    this.toast(`${m+1}月${d}日に置きました`);
  }
  dropSomeday(sid){
    const it=(this.state.someday||[]).find(x=>x.id===sid); if(!it) return;
    tapLight();
    this.setState(s=>({ someday:(s.someday||[]).filter(x=>x.id!==sid), gone:goneAdd(s,[sid]),
      trash: it.ev ? [{ev:it.ev, someday:it, at:Date.now()}, ...(s.trash||[])].slice(0,400) : s.trash }));
  }
  // 候補日のうち1つが決まったとき、残りの候補を「無くなった」にする
  settleCandidates(yes){
    const a=this.state.candAsk; if(!a) return;
    tapLight();
    if(!yes){ this.setState({candAsk:null}); return; }
    const prev={}; for(const id of a.ids) prev[id]={status:'mikakutei'};
    const ids=new Set(a.ids);
    this.setState(s=>({ candAsk:null, events:s.events.map(e=>ids.has(e.id)?{...e,status:'nakunatta',updatedAt:Date.now()}:e) }));
    this.showUndo(`ほかの候補${a.ids.length}件を片づけました`, {kind:'many', prev});
  }
  dlgNakunatta(){ const d=this.state.dialog; const ev0=this.state.events.find(e=>e.id===d.id);
    this.updateEvent(d.id,{status:'nakunatta'});
    this.setState(s=>({dialog:null, screen: s.detailId===d.id ? s.returnTo : s.screen, detailId: s.detailId===d.id?null:s.detailId}));
    if(ev0) this.showUndo(`「${ev0.title}」を${this.T(ev0.type).gone||'無くなった'}にしました`, {kind:'status', id:d.id, prev:{status:ev0.status}}); }

  /**
   * 有給の残り。「休み」の種類の予定で、名前に 有給・有休 があれば1日、半休・午前休・午後休 なら半日と数える。
   * 決まった休みは「使った」、まだの休み（希望休）は「予定」として別に数える。
   * 年度は設定の「付く月」から1年。
   */
  leaveSummary(){
    const pl=this.state.settings.paidLeave; if(!pl) return null;
    const t=this.state.today;
    const y0 = t.m>=pl.start ? t.y : t.y-1;
    const a=dayNo(y0,pl.start,1), b=dayNo(y0+1,pl.start,1)-1;
    let used=0, planned=0;
    for(const e of this.state.events){
      if(e.status==='nakunatta') continue;
      const ty=this.T(e.type); if(!(ty && (ty.free || e.type==='off'))) continue;
      const title=String(e.title||'');
      const half=/半休|午前休|午後休|半日/.test(title), full=/有給|有休|年休/.test(title);
      if(!half && !full) continue;
      const f=Math.max(a,evFrom(e)), l=Math.min(b,evTo(e)); if(f>l) continue;
      const n=(l-f+1)*(half?0.5:1);
      if(e.status==='mikakutei') planned+=n; else used+=n;
    }
    const rem=Math.max(0,(pl.grant||0)-used);
    const f1=(x)=>Number.isInteger(x)?String(x):x.toFixed(1);
    return { rem, used, planned, text:`有給 あと${f1(rem)}日（${y0}年${pl.start+1}月から：${f1(pl.grant||0)}日のうち ${f1(used)}日使用${planned?`・希望 ${f1(planned)}日`:''}）`,
      short:`有給 あと${f1(rem)}日`+(planned?`（希望をぜんぶ取ると あと${f1(Math.max(0,rem-planned))}日）`:'') };
  }
  // ---- iPhone のカレンダーを重ねて表示 ----
  // 選んだカレンダーの予定を、開くたびに読み直して灰色の帯で並べる。LUKKO には保存しない
  async toggleOverlay(){
    tapLight();
    const on=!this.state.settings.overlayOn;
    if(!on){ this._overlay=[]; this.setState(s=>({settings:{...s.settings, overlayOn:false}})); return; }
    const perm=await askCalendarAccess();
    if(perm!=='granted'){ this.toast(perm==='unavailable' ? 'この端末では使えません' : 'カレンダーを読む許可が必要です（設定アプリで許可できます）', 3200); return; }
    const cals=await listPhoneCalendars();
    this.setState(s=>({overlayCals:cals, settings:{...s.settings, overlayOn:true,
      overlayIds: (s.settings.overlayIds && s.settings.overlayIds.length) ? s.settings.overlayIds : cals.filter(c=>!c.sub).map(c=>c.id)}}));
    setTimeout(()=>this._loadOverlay(), 0);
  }
  async _loadOverlay(){
    const cfg=this.state.settings;
    if(!cfg.overlayOn || !(cfg.overlayIds||[]).length || !isNative()){ if(this._overlay && this._overlay.length){ this._overlay=[]; this.forceUpdate(); } return; }
    if(!this.state.overlayCals){ const cals=await listPhoneCalendars(); this.setState({overlayCals:cals}); }
    const t=this.state.today;
    const list=await readOverlay(cfg.overlayIds, new Date(t.y,t.m-2,1), new Date(t.y,t.m+14,0,23,59));
    this._overlay=list;
    this.forceUpdate();
  }
  // 日番号 a〜b（b は含まない）にかかる、重ねて表示する予定
  _overlayFor(a,b){
    const list=this._overlay||[];
    if(!list.length || !this.state.settings.overlayOn) return [];
    return list.filter(e=>{ const f=evFrom(e), l=evTo(e) + (endsNextDay(e)?1:0); return l>=a && f<b; });
  }
  // ---- 決まった予定を iPhone のカレンダーにも入れる ----
  async toggleExportCal(){
    tapLight();
    const cfg=this.state.settings;
    if(cfg.exportCal){
      const map=this._exportMap();
      this.setState(s=>({settings:{...s.settings, exportCal:false}}));
      await clearExport(map);
      this._saveExportMap({});
      this.toast('iPhone のカレンダーに書いた予定を消しました');
      return;
    }
    const perm=await askCalendarAccess();
    if(perm!=='granted'){ this.toast(perm==='unavailable' ? 'この端末では使えません' : 'カレンダーの許可が必要です（設定アプリで許可できます）', 3200); return; }
    const id=await ensureExportCalendar(cfg.exportCalId);
    if(!id){ this.toast('「LUKKO」カレンダーを作れませんでした', 3200); return; }
    this.setState(s=>({settings:{...s.settings, exportCal:true, exportCalId:id}}));
    setTimeout(()=>this._syncExport(), 0);
    this.toast('決まった予定を、iPhone のカレンダーの「LUKKO」に入れます');
  }
  _exportMap(){ try{ return JSON.parse(localStorage.getItem('lukko.exportMap')||'{}')||{}; }catch(e){ return {}; } }
  _saveExportMap(m){ try{ localStorage.setItem('lukko.exportMap', JSON.stringify(m)); }catch(e){ /* 次にそろえ直す */ } }
  async _syncExport(){
    const cfg=this.state.settings;
    if(!cfg.exportCal || !isNative() || this._exporting) return;
    this._exporting=true;
    try{
      const id=await ensureExportCalendar(cfg.exportCalId);
      if(id){
        if(id!==cfg.exportCalId) this.setState(s=>({settings:{...s.settings, exportCalId:id}}));
        const map=await syncExport(this.state.events, id, this._exportMap(), !!cfg.hideTitles);
        this._saveExportMap(map);
      }
    }catch(e){ /* 次の変更でそろえ直す */ }
    this._exporting=false;
  }
  // ---- iCloud で同期 ----
  async toggleSync(){
    tapLight();
    const on=!this.state.settings.sync;
    if(on){
      const info=await syncInfo();
      if(!info.available){
        this.toast(info.signedIn ? 'この版では、まだ iCloud の同期を使えません' : 'iPhone の設定で iCloud にサインインすると使えます', 3600);
        return;
      }
    }
    this.setState(s=>({settings:{...s.settings, sync:on, deviceId: s.settings.deviceId || uid('d')}}));
    if(on) setTimeout(()=>this._pullSync(true), 0);
  }
  async _pullSync(pushAfter){
    if(!this.state.settings.sync || this._syncing) return;
    this._syncing=true;
    try{
      const remote=await readRemote();
      const merged=mergeSync(this.state, remote);
      if(merged){
        this._fromSync=true;
        this.setState({ events:sanitizeEvents(merged.events), types: typesOk(merged.types) ? merged.types : this.state.types,
          jobs:sanitizeJobs(merged.jobs), someday:sanitizeSomeday(merged.someday) });
      }
      this.setState(s=>({settings:{...s.settings, lastSyncAt:Date.now()}}));
    }catch(e){ /* 次に開いたときにもう一度 */ }
    this._syncing=false;
    if(pushAfter) this._pushSync();
  }
  async _pushSync(){
    if(!this.state.settings.sync) return;
    try{ await writeRemote(packForSync(this.state), this.state.settings.deviceId||''); }catch(e){ /* 次の変更で */ }
  }

  // ---- 開くときのロック ----
  async _initLock(){
    const info=await lockInfo();
    this._lockAvailable = info.available;
    this._lockLabel = info.kind==='faceID' ? 'Face ID' : info.kind==='touchID' ? 'Touch ID' : 'パスコード';
    if(this.state.settings.lock && info.available){ setShield(true); this.setState({locked:true}); this.unlock(); }
    else this.forceUpdate();
  }
  async unlock(){
    if(this._unlocking) return;
    this._unlocking=true;
    const r=await authenticate('LUKKO を開きます');
    this._unlocking=false;
    if(r.ok) this.setState({locked:false});
  }
  /**
   * App Store の評価の小窓。うれしい瞬間にだけ、控えめに。
   *  ・使い始めて7日より前は出さない
   *  ・点線を塗りにしたのが5回目・10回目・25回目、空いてる日を送った直後、使い始めて14日以上で予定が20件以上
   *  ・こちらからは60日に1回まで（そのうえ iPhone が1年に3回までに絞る）
   */
  maybeAskReview(reason){
    const cfg=this.state.settings, now=Date.now();
    if(!cfg.firstUseAt || now-cfg.firstUseAt < 7*86400000) return;
    if(cfg.lastReviewAsk && now-cfg.lastReviewAsk < 60*86400000) return;
    const n=(cfg.confirmCount||0);
    const good = reason==='share' || (reason==='confirm' && [5,10,25].includes(n))
      || (reason==='open' && now-cfg.firstUseAt > 14*86400000 && this.state.events.length>=20);
    if(!good) return;
    this.setState(s=>({settings:{...s.settings, lastReviewAsk:now}}));
    setTimeout(()=>requestReview(), 1200);
  }
  // ---- 開くときに Face ID ----
  async toggleLock(){
    tapLight();
    const on=!this.state.settings.lock;
    // 入れるときも一度確かめる（自分の顔で開けることを確かめてからにする）
    if(on){ const r=await authenticate('LUKKO のロックを入れます'); if(!r.ok){ this.toast('確かめられなかったので、入れませんでした', 3000); return; } }
    this.setState(s=>({settings:{...s.settings, lock:on}}));
    setShield(on);
  }

  // 最後の取り込みを取り消す。取り込んだ予定は「最近消した予定」へ移す（あとで戻せる）
  undoImport(){
    const li=this.state.settings.lastImport; if(!li||!li.tag) return;
    stampHeavy();
    const gone=this.state.events.filter(e=>String(e.id).startsWith(li.tag+'-'));
    const now=Date.now();
    this.setState(s=>({ events:s.events.filter(e=>!String(e.id).startsWith(li.tag+'-')),
      trash:[...gone.map(ev=>({ev, at:now})), ...(s.trash||[])].slice(0,400),
      settings:{...s.settings, lastImport:null}, imp:{...s.imp, phase:'idle'}, screen: s.screen==='import' ? 'settings' : s.screen }));
    this.toast(`取り込んだ${gone.length}件を取り消しました`);
  }

  // ---- シフト入力（型を選んで、マスを押すだけで置く） ----
  // 前は1件ずつ作成画面を開くか、コピーで置くしかなかった。勤務表を写すのに1か月で20回以上かかった
  stampTemplates(){
    const out=[];
    for(const j of (this.state.jobs||[])) if(!j.retired) (j.templates||[]).forEach((t,i)=>out.push({...t, jobId:j.id, idx:i, key:j.id+':'+(t.id!=null ? t.id : i), jobName:j.name}));
    return out;
  }
  toggleStamp(){
    tapLight();
    const tpls=this.stampTemplates();
    this.setState(s=>({ stamp: s.stamp ? null : (tpls.length ? {key:tpls[0].key, status:'kakutei'} : null),
      screen: tpls.length ? s.screen : 'settings', setPage: tpls.length ? s.setPage : 'jobs', typeListOpen:false }));
    if(!tpls.length) this.toast('設定の勤務先から「シフトの型」を足すと使えます', 3200);
  }
  stampDay(Y,M,d){
    const sp=this.state.stamp; if(!sp) return;
    const t=this.stampTemplates().find(x=>x.key===sp.key); if(!t) return;
    tapLight();
    const same=this.state.events.find(e=>e.stampKey===t.key && e.y===Y && e.m===M && e.day===d && e.status!=='nakunatta');
    // 同じ型がもう置いてあれば外す（押し間違いをその場で直せるように）。
    // 働いた記録（給料の元）は押し間違いで消さない。外したものは「最近消した予定」に入れて、取り消しも出す
    if(same){
      if(same.status==='jisseki'){ this.toast('働いた記録は、シフト入力では外せません'); return; }
      this.setState(s=>({events:s.events.filter(e=>e.id!==same.id), trash:[{ev:same, at:Date.now()}, ...(s.trash||[])].slice(0,400)}));
      this.showUndo(`${M+1}/${d}の「${same.title}」を外しました`, {kind:'del', ids:[same.id]});
      return;
    }
    const hasOff = this.state.types.some(x=>x.key==='off');
    const type = t.allDay ? 'off' : 'baito';
    const ev={ id:uid('t'), type, title:t.name || (t.allDay ? '休み' : (t.jobName||'勤務')), y:Y, m:M, day:d,
      start: t.allDay ? '00:00' : this.fmtMin(t.from%1440), end: t.allDay ? '23:59' : this.fmtMin(t.to%1440), allDay:!!t.allDay,
      status: sp.status, jobId: t.allDay ? undefined : t.jobId, breakMin: t.brk || undefined, sym:t.sym, stampKey:t.key,
      want: sp.status==='mikakutei' ? [this.fmtMin(t.from%1440), this.fmtMin(t.to%1440)] : undefined, updatedAt:Date.now() };
    this.setState(s=>({ events:[...s.events, ev], types: (t.allDay && !hasOff) ? [...s.types, extraType('off')] : s.types }));
  }
  // この月の希望（点線の勤務）を、まとめて確定にする。勤務表が出た日に1回で済む
  confirmMonthShifts(){
    const {y,m}=this.state.ym;
    const list=this.state.events.filter(e=>e.y===y && e.m===m && e.status==='mikakutei' && (e.type==='baito'||e.type==='off'));
    if(!list.length){ this.toast('この月の希望は、もう全部決まっています'); return; }
    stampHeavy();
    const prev={}; for(const e of list) prev[e.id]={status:'mikakutei'};
    const ids=new Set(list.map(e=>e.id));
    this.setState(s=>({ events:s.events.map(e=>ids.has(e.id)?{...e,status:'kakutei',updatedAt:Date.now()}:e) }));
    this.showUndo(`${m+1}月の希望${list.length}件を確定にしました`, {kind:'many', prev});
  }

  // ---- 使い方を変える ----
  // 卒業・就職のときの入口も兼ねる。学校とバイト→会社の仕事 のとき、バイト先をまとめて「辞めた」にできる
  setProfile(key, retireJobs){
    tapLight();
    this.setState(s=>{ const r=this.applyProfile(key, s); if(!r) return null;
      const keepWeek = s.settings.weekStart;
      const jobs = retireJobs ? s.jobs.map(j=>({...j, retired:true})) : s.jobs;
      return { types:r.types, settings:{...r.settings, weekStart: s.settings.onboarded ? keepWeek : r.settings.weekStart,
        ...(retireJobs ? {wageFeature:'auto'} : {})}, jobs, profileSheet:null }; });
    this.toast(`「${PROFILES[key].label}」に合わせました。予定はそのままです`);
  }
  // ---- 種類を並べ替える・隠す・消す ----
  moveType(key, dir){
    tapLight();
    this.setState(s=>{ const a=[...s.types]; const i=a.findIndex(t=>t.key===key), j=i+dir;
      if(i<0||j<0||j>=a.length) return null; [a[i],a[j]]=[a[j],a[i]]; return {types:a}; });
  }
  toggleTypeHidden(key){
    tapLight();
    this.setState(s=>{
      const visible=s.types.filter(t=>!t.hidden && t.key!==key);
      const t0=s.types.find(t=>t.key===key);
      if(t0 && !t0.hidden && !visible.length) return null; // 最後の1つは隠せない
      return { types:s.types.map(t=>t.key===key?{...t, hidden: t.hidden ? undefined : true}:t) };
    });
  }
  // 消すときは、その種類の予定を別の種類へ移す（予定は消さない）
  deleteType(key, moveTo){
    const to=this.state.types.find(t=>t.key===moveTo && t.key!==key);
    if(!to) return;
    stampHeavy();
    this.setState(s=>({ types:s.types.filter(t=>t.key!==key), editTypeKey:null, typeDelete:null, gone:goneAdd(s,['type:'+key]),
      events:s.events.map(e=>e.type===key?{...e, type:moveTo, updatedAt:Date.now()}:e) }));
    this.toast(`予定を「${to.name}」へ移して、種類を消しました`);
  }
  // 種類ごとの呼び名（まだのとき／決まったとき）
  setTypeWords(key, which, val){
    const v0=String(val||'').slice(0,12);
    this.setState(s=>({ types:s.types.map(t=>t.key!==key ? t : (which==='u' ? {...t, uWord:v0, uLabel:v0} : {...t, cWord:v0, cLabel:v0})) }));
  }

  // ---- type editor ----
  // 種類を変えたら、時間もその種類の既定に合わせる。
  // ただし本人が時刻をいじっていたら、そのまま残す（勝手に戻さない）。
  selectType(k){
    this.setState(s=>{
      const dr=s.draft;
      const cur=this.defTimes(dr.type), next=this.defTimes(k);
      const untouched = dr.start===cur.start && dr.end===cur.end;
      return { draft:{...dr, type:k, ...(untouched ? {start:next.start, end:next.end} : {})} };
    });
  }
  addType(){
    const nt=this.state.newType; if(!nt) return;
    const name=(nt.name||'').trim()||'新しい種類';
    const key=uid('c'), hex=nt.color;
    const t={key,name,color:hex,paper:this.paperFrom(hex),dark:this.darkFrom(hex),uWord:'未確定の'+name,cWord:name};
    this.setState(s=>({ types:[...s.types,t], draft:{...s.draft,type:key}, newType:null }));
  }

  save(scope){
    const dr=this.state.draft;
    tapLight();
    // 日またぎは終日の予定だけ。時間指定に戻したら1日に畳む。
    const span = dr.allDay ? Math.max(1,Math.min(60,dr.days|0||1)) : 1;
    const spanField = span>1 ? span : undefined;
    const remindField = typeof dr.remindMin==='number' ? dr.remindMin : undefined;
    // 空文字は持たせない（あとで「入っているか」を見るだけで済む）
    const placeField = (dr.place||'').trim() || undefined;
    const memoField = (dr.memo||'').trim() || undefined;
    const linkField = (dr.link||'').trim() || undefined;
    const secretField = dr.secret ? true : undefined;
    // 次に新しい予定を作るとき、同じ種類から始める
    const rememberType = (s)=>({ settings:{...s.settings, lastType:dr.type} });
    // 戻り先。前はどこから開いても保存したら月表示に戻っていた。開く前の画面に戻す
    const back = (s)=> (['day','list','detail','free','month'].includes(s.returnTo) ? (s.returnTo==='detail' ? 'month' : s.returnTo) : 'month');
    if(dr.editingId){
      const orig=this.state.events.find(e=>e.id===dr.editingId);
      // くり返しの1件を直したときは「この予定だけ／これ以降すべて」を聞く
      if(!scope && orig && orig.repId){
        const rest=this.state.events.filter(e=>e.repId===orig.repId && evFrom(e)>evFrom(orig)).length;
        if(rest>0){ this.setState({repEditAsk:{rest}}); return; }
      }
      const patchOf=(e)=>{
        const base={...e,type:dr.type,title:dr.title||'無題',y:dr.y,m:dr.m,day:dr.day,start:dr.start,status:dr.status,allDay:dr.allDay,days:spanField,
          remindMin:remindField, place:placeField, memo:memoField, link:linkField, secret:secretField,
          jobId: dr.type==='baito' ? dr.jobId : undefined, updatedAt:Date.now()};
        // 実績のときに直しているのは「実際に働いた終わりの時刻」
        return dr.status==='jisseki' ? {...base, actualEnd:dr.end} : {...base, end:dr.end, actualEnd:undefined};
      };
      // これ以降すべて：変えた項目だけを、同じくり返しの後ろの予定にも当てる。日付を動かしたら同じ日数だけずらす
      const restPatch=(e)=>{
        if(!orig) return e;
        const out={...e, updatedAt:Date.now()};
        const shift = dayNo(dr.y,dr.m,dr.day) - evFrom(orig);
        if(shift){ const o=fromDayNo(evFrom(e)+shift); out.y=o.y; out.m=o.m; out.day=o.d; }
        const same=(k,v)=>JSON.stringify(orig[k]??null)===JSON.stringify(v??null);
        const fields={type:dr.type, title:dr.title||'無題', start:dr.start, end:dr.end, allDay:dr.allDay, days:spanField,
          remindMin:remindField, place:placeField, memo:memoField, link:linkField, secret:secretField, status:dr.status};
        for(const [k,v] of Object.entries(fields)) if(!same(k,v) && !(k==='end' && dr.status==='jisseki')) out[k]=v;
        return out;
      };
      this.setState(s=>({ screen:back(s), detailId:null, dayNum: back(s)==='day' ? dr.day : null, ym:{y:dr.y,m:dr.m}, repEditAsk:null, ...rememberType(s),
        events:s.events.map(e=>{
          if(e.id===dr.editingId) return patchOf(e);
          if(scope==='rest' && orig && orig.repId && e.repId===orig.repId && evFrom(e)>evFrom(orig)) return restPatch(e);
          return e;
        }) }));
      return;
    }
    // 日にちをまだ決めない予定は、カレンダーではなく棚に置く
    if(dr.someday){
      const t=this.state.today;
      const item={ id:uid('s'), when:dr.someday, title:dr.title||'無題', type:dr.type, y:t.y, m:t.m, day:t.d, at:Date.now(),
        ev:{ id:uid('n'), type:dr.type, title:dr.title||'無題', start:dr.start, end:dr.end, allDay:dr.allDay, days:spanField,
          remindMin:remindField, place:placeField, memo:memoField, link:linkField, secret:secretField,
          jobId: dr.type==='baito' ? dr.jobId : undefined, status:'mikakutei' } };
      this.setState(s=>({ screen:back(s), someday:[item, ...(s.someday||[])], ...rememberType(s) }));
      this.toast(`「${item.title}」を「${SOMEDAY_LABEL[dr.someday]}」に置きました`);
      return;
    }
    // 本体の日＋えらんだ他の日＋くり返しの日、まとめて置く
    const rep = repeatAfter(dr.y, dr.m, dr.day, dr.repEvery, dr.repSpan|0, dr.repDows, dr.repNth)
      .map(n=>{ const o=fromDayNo(n); return [o.y,o.m,o.d]; });
    const placeOn=[[dr.y,dr.m,dr.day], ...(dr.extraDays||[]).map(k=>k.split('-').map(Number)), ...rep];
    const base=Date.now();
    const tag=uid('n');
    // くり返しで作ったものには同じ印をつけておく。あとでまとめて消せる。
    const repId = rep.length ? uid('r') : undefined;
    // 候補日：まだの予定を何日かに置いて「どれか1日に決まる」を選んだとき。1つ確定したら残りを片づけられる
    const candId = (dr.cand && dr.status==='mikakutei' && (dr.extraDays||[]).length) ? uid('k') : undefined;
    const made=placeOn.map(([y,m,d],i)=>({ id:tag+'-'+i, type:dr.type, title:dr.title||'無題',
      y, m, day:d, start:dr.start, end:dr.end, status:dr.status, allDay:dr.allDay, days:spanField, remindMin:remindField,
      place:placeField, memo:memoField, link:linkField, secret:secretField, repId, candId,
      jobId: dr.type==='baito' ? dr.jobId : undefined,
      want: dr.status==='mikakutei' ? [dr.start,dr.end] : undefined, updatedAt:base }));
    this.setState(s=>({ screen:back(s), ym:{y:dr.y,m:dr.m}, events:[...s.events,...made], ...rememberType(s) }));
  }

  /**
   * 設定の画面に渡す値。群ごとに並べる。
   *  使い方 / カレンダー（種類・週・表示・文字・帯の時刻） / 空き状況 / お知らせ /
   *  働いた時間と給料 / 予定の出し入れ（控え・最近消した予定・iPhone のカレンダー） / 安全 / このアプリについて
   */
  _settingsVals(v){
    const st=this.state, cfg=st.settings, W=this.words();
    const tg=(on)=>({track:tgTrackOb(!!on), knob:tgKnobOb(!!on)});
    const seg=(items, cur, set)=>items.map(([k,label])=>({ label, sel:cur===k, onClick:()=>{ tapLight(); set(k); },
      style:{flex:1,textAlign:'center',padding:'7px 0',borderRadius:7,fontSize:12.5,whiteSpace:'nowrap',fontWeight:cur===k?700:500,cursor:'pointer',
        background:cur===k?'var(--card)':'transparent',color:cur===k?'var(--ink)':'var(--ink-mut)',border:cur===k?'1px solid var(--line)':'1px solid transparent'} }));
    const setS=(k)=>(val)=>this.setSetting(k,val);
    // 時刻えらび（30分きざみ）。iPhone では <select> がホイールで開くので、それを使う
    v.timeOpts = Array.from({length:49},(_,i)=>({ value:i*30, label: i===48 ? '24:00' : this.fmtMin(i*30) }));

    // ---- 設定の中の画面 ----
    // 設定は1枚に全部を並べると 40 行を超えて見にくかった。最初の画面は「名前といまの値」だけにして、
    // 中身の多いもの（種類・勤務先・有給・勤務時間・重ねて表示・控え・ファイル）は押すと開く画面に分けた
    v.setPage = st.setPage || null;
    v.onSetPage = (p)=>()=>{ tapLight(); this.setState({setPage:p, editTypeKey:null, editJobId:null, typeDelete:null}); };
    v.onSetBack = ()=>{ tapLight(); this.setState({setPage:null, editTypeKey:null, editJobId:null, typeDelete:null, newType:null}); };
    v.setPageTitle = ({support:'応援する', types:'予定の種類', work:'勤務時間', jobs:W.job, leave:'有給', overlay:'重ねて表示', backup:'控えと機種変更', files:'ファイルで出し入れ'})[st.setPage] || '';
    const hm=(m)=>this.fmtMin(m===1440?1440:m).replace(/^0(\d):/,'$1:');
    const pickLabel=(items)=>{ const x=(items||[]).find(i=>i.sel); return x ? x.label : ''; };
    // 通知（いちばん上のスイッチで、全部まとめて止められる）
    v.notifyAll = tg(!cfg.notifyOff); v.notifyOn = !cfg.notifyOff;
    v.onNotifyAll = ()=>this.setSetting('notifyOff', !cfg.notifyOff);

    // ---- 使い方 ----
    const pk=this.profile();
    v.profileLabel = PROFILES[pk].label;
    v.onOpenProfile = ()=>{ tapLight(); this.setState({profileSheet:{retire:false}}); };
    v.profileSheetShown = !!st.profileSheet;
    if(st.profileSheet){
      v.profileOpts = PROFILE_KEYS.map(k=>({ key:k, label:PROFILES[k].label, note:PROFILES[k].note, sel:k===pk,
        onClick:()=>this.setProfile(k, !!st.profileSheet.retire && k!=='student') }));
      v.profileRetireShown = pk==='student' && (st.jobs||[]).some(j=>!j.retired);
      v.profileRetireOn = !!st.profileSheet.retire;
      v.onProfileRetire = ()=>{ tapLight(); this.setState(s=>({profileSheet:{...s.profileSheet, retire:!s.profileSheet.retire}})); };
      v.onProfileClose = ()=>this.setState({profileSheet:null});
    }

    // ---- 種類（並べ替え・隠す・消す・呼び名） ----
    v.typeRows = st.types.map((t,i)=>({
      name:t.name, hidden:!!t.hidden, open: st.editTypeKey===t.key, hint: st.editTypeKey===t.key ? '' : (t.hidden ? '隠している' : '名前と色'),
      rowStyle:{borderBottom:'1px solid var(--line)', opacity: t.hidden && st.editTypeKey!==t.key ? .55 : 1},
      dotStyle:{width:18,height:18,borderRadius:12,background:t.color,flexShrink:0,boxShadow:'inset 0 0 0 1px rgba(0,0,0,.06)'},
      onTap:()=>this.setState(s=>({editTypeKey:s.editTypeKey===t.key?null:t.key, typeDelete:null})),
      onName:(e)=>this.renameType(t.key, e.target.value),
      usedCount: st.events.filter(e=>e.type===t.key).length,
      swatches:this.PAL.map(hex=>({ style:{width:26,height:26,borderRadius:13,background:hex,cursor:'pointer',boxShadow: t.color===hex?'0 0 0 2px #fff, 0 0 0 4px '+hex:'inset 0 0 0 1px rgba(0,0,0,.08)'}, onClick:()=>this.recolorKey(t.key,hex) })),
      uWord:t.uWord||'', cWord:t.cWord||'',
      onUWord:(e)=>this.setTypeWords(t.key,'u',e.target.value), onCWord:(e)=>this.setTypeWords(t.key,'c',e.target.value),
      onUp: i>0 ? ()=>this.moveType(t.key,-1) : null, onDown: i<st.types.length-1 ? ()=>this.moveType(t.key,1) : null,
      onHide:()=>this.toggleTypeHidden(t.key), hideLabel: t.hidden ? '出す' : '隠す',
      onAskDelete: st.types.length>1 ? ()=>{ tapLight(); this.setState({typeDelete:t.key}); } : null,
      deleting: st.typeDelete===t.key,
      moveChips: st.typeDelete===t.key ? st.types.filter(x=>x.key!==t.key).map(x=>({ label:x.name, onClick:()=>this.deleteType(t.key, x.key),
        style:{padding:'7px 12px',borderRadius:999,fontSize:12.5,cursor:'pointer',border:'1px solid var(--line)',background:'var(--card)',color:'var(--ink)'} })) : [],
      onCancelDelete:()=>this.setState({typeDelete:null}),
    }));

    // ---- 表示 ----
    const theme = cfg.theme || (cfg.dark ? 'dark' : 'light');
    v.themeSeg = seg([['auto','iPhoneに合わせる'],['light','明るい'],['dark','暗い']], theme, (k)=>this.setState(s=>({settings:{...s.settings, theme:k, dark:k==='dark'}})));
    const fs0 = typeof cfg.fontScale==='number' ? cfg.fontScale : 'auto';
    v.fontSeg = seg([['auto','iPhoneに合わせる'],[1,'標準'],[1.12,'大きめ'],[1.25,'特大']], fs0, (k)=>this.setSetting('fontScale', k==='auto' ? undefined : k));
    v.barTime = tg(cfg.barTime); v.onBarTime = ()=>this.setSetting('barTime', !cfg.barTime);
    v.kariMark = tg(cfg.kariMark); v.onKariMark = ()=>this.setSetting('kariMark', !cfg.kariMark);

    // ---- 空き状況 ----
    const wd=cfg.freeWd||[540,1320], hd=cfg.freeHd||[540,1320];
    v.freeWd = wd; v.freeHd = hd;
    v.onFreeWd = (i)=>(e)=>{ const n=[...wd]; n[i]=Number(e.target.value); if(n[1]>n[0]) this.setSetting('freeWd', n); };
    v.onFreeHd = (i)=>(e)=>{ const n=[...hd]; n[i]=Number(e.target.value); if(n[1]>n[0]) this.setSetting('freeHd', n); };
    const wh=cfg.workHours;
    v.workOn = tg(!!wh); v.workHoursOn = !!wh;
    v.onWorkToggle = ()=>this.setSetting('workHours', wh ? null : {days:[1,2,3,4,5], from:540, to:1080});
    if(wh){
      v.workFrom = wh.from; v.workTo = wh.to;
      v.onWorkFrom = (e)=>{ const n=Number(e.target.value); if(n<wh.to) this.setSetting('workHours', {...wh, from:n}); };
      v.onWorkTo = (e)=>{ const n=Number(e.target.value); if(n>wh.from) this.setSetting('workHours', {...wh, to:n}); };
      v.workDays = ['日','月','火','水','木','金','土'].map((label,i)=>{ const on=(wh.days||[]).includes(i);
        return { label, onClick:()=>{ tapLight(); const d=on ? wh.days.filter(x=>x!==i) : [...wh.days, i]; this.setSetting('workHours', {...wh, days:d}); },
          style:{flex:1,textAlign:'center',padding:'7px 0',borderRadius:9,fontSize:12.5,cursor:'pointer',
            background:on?'var(--ink)':'var(--card)',color:on?'var(--card)':'var(--ink-mut)',border:'1px solid '+(on?'var(--ink)':'var(--line)')} }; });
    }
    v.overlayFree = tg(cfg.overlayFree); v.onOverlayFree = ()=>this.setSetting('overlayFree', !cfg.overlayFree);

    // ---- お知らせ ----
    v.canNotify = canNotify();
    v.morning = tg(cfg.morning); v.onMorning = ()=>this.setSetting('morning', !cfg.morning);
    v.morningAt = typeof cfg.morningAt==='number' ? cfg.morningAt : 450;
    v.onMorningAt = (e)=>this.setSetting('morningAt', Number(e.target.value));
    v.evening = tg(cfg.evening); v.onEvening = ()=>this.setSetting('evening', !cfg.evening);
    v.weeklyReview = tg(cfg.weekly); v.onWeekly = ()=>this.setSetting('weekly', !cfg.weekly);
    v.remindTimedSeg = seg([[null,'なし'],[10,'10分前'],[30,'30分前'],[60,'1時間前']], typeof cfg.remindTimed==='number'?cfg.remindTimed:null, setS('remindTimed'));
    v.remindAllDaySeg = seg([[null,'なし'],[0,'当日の朝'],[1440,'前日の朝']], typeof cfg.remindAllDay==='number'?cfg.remindAllDay:null, setS('remindAllDay'));
    v.hideTitles = tg(cfg.hideTitles); v.onHideTitles = ()=>{ this.setSetting('hideTitles', !cfg.hideTitles); this._widgetStamp=null; };
    v.remindTimedLabel = pickLabel(v.remindTimedSeg); v.remindAllDayLabel = pickLabel(v.remindAllDaySeg);
    v.themeLabel = pickLabel(v.themeSeg); v.fontLabel = pickLabel(v.fontSeg);
    v.freeWdLabel = hm(wd[0])+'〜'+hm(wd[1]); v.freeHdLabel = hm(hd[0])+'〜'+hm(hd[1]);
    { const DN=['日','月','火','水','木','金','土'];
      const ds=wh ? [...(wh.days||[])].sort((a,b)=>a-b) : [];
      const run = ds.length>2 && ds.every((d,i)=>i===0||d===ds[i-1]+1);
      v.workLabel = !wh ? 'なし' : (ds.length ? (run ? DN[ds[0]]+'〜'+DN[ds[ds.length-1]] : ds.map(d=>DN[d]).join('')) + ' ' + hm(wh.from)+'〜'+hm(wh.to) : '曜日なし'); }

    // ---- 働いた時間と給料 ----
    v.jobWord = W.job; v.jobAddLabel = W.jobAdd; v.jobEg = W.jobEg; v.wageHead = W.wageHead;
    v.wageFeatureSeg = seg([['auto','記録があれば'],['on','いつも'],['off','使わない']], cfg.wageFeature||'auto', setS('wageFeature'));
    const days31 = [{value:0,label:'なし（月末まで）'}, ...Array.from({length:28},(_,i)=>({value:i+1,label:(i+1)+'日'})), {value:31,label:'月末'}];
    v.closeOpts = days31; v.payOpts = [{value:0,label:'なし'}, ...Array.from({length:28},(_,i)=>({value:i+1,label:(i+1)+'日'})), {value:31,label:'月末'}];
    v.jobRows = (st.jobs||[]).filter(j=>!j.retired || st.showRetired).map((j,i,arr)=>({
      name:(j.name||'（名前なし）')+(j.retired?'（辞めた）':''), hourly:String(j.hourly), open:st.editJobId===j.id, retired:!!j.retired,
      rowStyle:{borderBottom: i<arr.length-1 ? '1px solid var(--line)':'none'},
      onTap:()=>this.setState(s=>({editJobId:s.editJobId===j.id?null:j.id})),
      onName:(e)=>this.patchJob(j.id,{name:e.target.value}),
      onHourly:(e)=>{ const n=parseInt((e.target.value||'').replace(/[^0-9]/g,''),10); this.patchJob(j.id,{hourly:isNaN(n)?0:Math.min(99999,n)}); },
      onMinus:()=>this.patchJob(j.id,{hourly:Math.max(0,j.hourly-10)}),
      onPlus:()=>this.patchJob(j.id,{hourly:j.hourly+10}),
      onRemove:()=>{ tapLight(); this.setState({confirmJob:j.id}); },
      onRetire:()=>this.retireJob(j.id, !j.retired), retireLabel: j.retired ? '辞めたを取り消す' : '辞めた（しまう）',
      rateNote: st.rateNote===j.id, onRecount:()=>this.recountJob(j.id),
      closeDay: j.closeDay||0, payDay: j.payDay||0,
      onCloseDay:(e)=>this.patchJob(j.id,{closeDay:Number(e.target.value)||undefined}),
      onPayDay:(e)=>this.patchJob(j.id,{payDay:Number(e.target.value)||undefined}),
      templates:(j.templates||[]).map((t,k)=>({ key:k, sym:t.sym, text:`${t.sym}　${t.name||''} ${t.allDay?'（休み）':this.fmtMin(t.from)+'–'+this.fmtMin(t.to)}`,
        onRemove:()=>{ tapLight();
          // 消す前に、残る型へ今の番号を名前として持たせる。番号が詰まると、置いてあるシフトが別の型のものに化ける
          this.patchJob(j.id,{templates:(j.templates||[]).map((t,x)=>t.id!=null ? t : {...t, id:String(x)}).filter((_,x)=>x!==k)}); } })),
      onAddTemplate:()=>{ tapLight(); this.setState({tplNew:{jobId:j.id, sym:'', name:'', from:510, to:1050, brk:60, allDay:false}}); },
      usedCount: st.events.filter(e=>e.jobId===j.id).length,
    }));
    v.retiredCount = (st.jobs||[]).filter(j=>j.retired).length;
    v.onShowRetired = ()=>{ tapLight(); this.setState(s=>({showRetired:!s.showRetired})); };
    v.showRetired = !!st.showRetired;
    v.jobsEmpty = (st.jobs||[]).filter(j=>!j.retired).length===0;
    { const act=(st.jobs||[]).filter(j=>!j.retired); v.jobsLabel = act.length ? (act[0].name||'（名前なし）') + (act.length>1 ? ` ほか${act.length-1}` : '') : 'なし'; }
    v.wageFeatureLabel = pickLabel(v.wageFeatureSeg);
    v.confirmJobShown = !!st.confirmJob;
    if(st.confirmJob){
      const j=(st.jobs||[]).find(x=>x.id===st.confirmJob);
      const n=st.events.filter(e=>e.jobId===st.confirmJob && e.status==='jisseki').length;
      v.confirmJobText = `${j?j.name||'この'+W.job:''}を消しますか？` ;
      v.confirmJobBody = n ? `・働いた記録${n}件と金額は残ります
・やめただけなら「辞めた」にすると、あとで戻せます` : 'この勤務先を使っている予定はありません';
      v.onConfirmJob = ()=>this.removeJob(st.confirmJob);
      v.onCancelJob = ()=>this.setState({confirmJob:null});
    }
    // シフトの型を足す
    v.tplNewShown = !!st.tplNew;
    if(st.tplNew){
      const t=st.tplNew;
      v.tplSym=t.sym; v.tplName=t.name; v.tplFrom=t.from; v.tplTo=t.to; v.tplBrk=t.brk; v.tplAllDay=tg(t.allDay);
      const up=(k,val)=>this.setState(s=>({tplNew:{...s.tplNew,[k]:val}}));
      v.onTplSym=(e)=>up('sym', e.target.value.slice(0,2)); v.onTplName=(e)=>up('name', e.target.value.slice(0,12));
      v.onTplFrom=(e)=>up('from', Number(e.target.value)); v.onTplTo=(e)=>up('to', Number(e.target.value));
      v.onTplBrk=(e)=>up('brk', Number(e.target.value)); v.onTplAllDay=()=>up('allDay', !t.allDay);
      v.brkOpts=[0,15,30,45,60,90,120].map(m=>({value:m,label:m?m+'分':'なし'}));
      v.onTplSave=()=>{ const sym=(t.sym||'').trim(); if(!sym) return; tapLight();
        this.setState(s=>({ tplNew:null, jobs:s.jobs.map(j=>j.id===t.jobId?{...j, templates:[...(j.templates||[]), {id:uid('p'), sym, name:(t.name||'').trim(), from:t.from, to:t.to, brk:t.brk, allDay:!!t.allDay}]}:j) })); };
      v.onTplCancel=()=>this.setState({tplNew:null});
    }
    // 有給
    const pl=cfg.paidLeave||null;
    v.leaveOn = tg(!!pl); v.leaveShown = !!pl;
    v.onLeaveToggle = ()=>this.setSetting('paidLeave', pl ? null : {grant:10, start:3});
    if(pl){
      v.leaveGrant = String(pl.grant);
      v.onLeaveGrant = (e)=>{ const n=parseFloat((e.target.value||'').replace(/[^0-9.]/g,'')); this.setSetting('paidLeave', {...pl, grant:isNaN(n)?0:Math.min(60,n)}); };
      v.leaveStartOpts = Array.from({length:12},(_,i)=>({value:i,label:(i+1)+'月'}));
      v.leaveStart = pl.start; v.onLeaveStart = (e)=>this.setSetting('paidLeave', {...pl, start:Number(e.target.value)});
      v.leaveText = this.leaveSummary() ? this.leaveSummary().text : '';
    }
    { const ls=pl && this.leaveSummary(); v.leaveLabel = ls ? ls.short.replace(/^有給 /,'').replace(/（.*$/,'') : 'オフ'; }

    // ---- 予定の出し入れ ----
    const d0=(ms)=>{ if(!ms) return ''; const d=new Date(ms); return `${d.getMonth()+1}月${d.getDate()}日`; };
    v.lastBackupText = cfg.lastAutoBackup ? `自動の控え：${d0(cfg.lastAutoBackup)}（毎日1回、端末の中に7日分）` : '自動の控え：まだありません（予定を入れると、毎日1回とります）';
    v.lastExportText = cfg.lastExportAt ? `書き出した控え：${d0(cfg.lastExportAt)}` : '書き出した控え：まだ取っていません';
    v.onOpenBackups = ()=>this.openBackups();
    v.backupListShown = !!st.backupListOpen;
    if(st.backupListOpen){
      v.backupRows = (st.backupList||[]).map(b=>({ key:b.name, label: b.kind==='auto' ? `${b.day}（自動）` : `${b.day}（戻す・取り込む前）`,
        onClick:()=>this.pickLocalBackup(b.name) }));
      v.onCloseBackups = ()=>this.setState({backupListOpen:false});
    }
    const tr=st.trash||[];
    v.trashCount = tr.length;
    v.onOpenTrash = ()=>{ tapLight(); this.setState({trashOpen:true}); };
    v.trashShown = !!st.trashOpen;
    if(st.trashOpen){
      v.trashRows = tr.slice(0,100).map(x=>({ key:x.ev.id, title:x.ev.title, when: x.someday ? "日にち未定" : `${x.ev.m+1}/${x.ev.day}`, gone:`${d0(x.at)}に削除`,
        onRestore:()=>{ tapLight(); this.restoreTrash([x.ev.id]); } }));
      v.onCloseTrash = ()=>this.setState({trashOpen:false});
    }
    const li=cfg.lastImport;
    v.undoImportShown = !!(li && li.tag && st.events.some(e=>String(e.id).startsWith(li.tag+'-')));
    if(v.undoImportShown){
      v.undoImportLabel = `最後の取り込みを取り消す（${st.events.filter(e=>String(e.id).startsWith(li.tag+'-')).length}件）`;
      v.onUndoImport = ()=>this.undoImport();
    }
    v.migrateOpen = !!st.migrateOpen;
    v.onToggleMigrate = ()=>{ tapLight(); this.setState(s=>({migrateOpen:!s.migrateOpen})); };
    // iPhone のカレンダー（重ねて表示・書き出し）
    v.overlayOn = tg(cfg.overlayOn); v.onOverlay = ()=>this.toggleOverlay();
    v.overlayCals = (st.overlayCals||[]).map(c=>({ key:c.id, label:c.title, on:(cfg.overlayIds||[]).includes(c.id), dot:c.color||'#999',
      onClick:()=>{ tapLight(); const cur=cfg.overlayIds||[]; this.setSetting('overlayIds', cur.includes(c.id) ? cur.filter(x=>x!==c.id) : [...cur, c.id]); this._overlayCache=null; setTimeout(()=>this._loadOverlay&&this._loadOverlay(),0); } }));
    v.exportCal = tg(cfg.exportCal); v.onExportCal = ()=>this.toggleExportCal();
    v.overlayLabel = cfg.overlayOn ? `${(cfg.overlayIds||[]).length}つ` : 'オフ';
    v.backupLabel = cfg.lastAutoBackup ? d0(cfg.lastAutoBackup) : '';
    // iCloud で同期（2台の iPhone）
    v.syncShown = isNative();
    v.sync = tg(cfg.sync); v.onSync = ()=>this.toggleSync();
    v.syncSub = cfg.sync ? (cfg.lastSyncAt ? `最後に合わせた時刻 ${new Date(cfg.lastSyncAt).getHours()}:${String(new Date(cfg.lastSyncAt).getMinutes()).padStart(2,'0')}` : '合わせています…') : '';
    v.lastExportLabel = cfg.lastExportAt ? d0(cfg.lastExportAt) : '';

    // ---- 安全 ----
    v.lockAvailable = !!this._lockAvailable;
    v.lock = tg(cfg.lock); v.onLock = ()=>this.toggleLock();
    v.lockLabel = this._lockLabel || 'Face ID';

    // ---- このアプリについて ----
    v.onReplayGuide = ()=>{ tapLight(); this.setState(s=>({settings:{...s.settings, onboarded:false}, onboard:{step:0, demo:'dash', picked:this.profile(), replay:true}})); };
    v.supportHref = 'https://kaitoiwaki.github.io/kimatteru/legal/support.html';
    v.appVersionLabel = `${APP_MARKETING}（${v.appVersion}）`;
  }

  /**
   * 月表示の「給料」スイッチを出すか。
   * 毎日開く画面のいちばん目立つ所に、バイト先も記録も無い人にまで出ていた——
   * 「バイト用のアプリ」と言ってしまっていた。バイト先か働いた記録があるときだけ出す。
   * 設定の「給料の機能」で、いつも出す／いつも隠す も選べる。
   */
  wageFeatureOn(){
    const st=this.state, f=st.settings.wageFeature;
    if(f==='off') return false;
    if(f==='on') return true;
    return (st.jobs||[]).some(j=>!j.retired) || st.events.some(e=>e.type==='baito' && e.status==='jisseki');
  }
  renderVals(){
    const st=this.state, wageOn=st.wageOn && this.wageFeatureOn();
    // 月の見出しの詰め方の既定（途中で返す道があっても v.hd が必ずあるように。最後に幅から選び直す）
    const HD0 = { arrowW:38, monthPx:28, yearPx:14, showYear:true, todayPad:'6px 11px', iconW:38, pad:'0 16px 10px 12px', padX:28 };
    const stepBtn={width:30,height:30,borderRadius:15,background:'var(--bg2)',color:'var(--ink)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:500,cursor:'pointer',userSelect:'none'};
    // たたんだ行の「›」と値。開くと右に倒れて、値が色づく。
    const chevron=(open)=>({fontSize:15,color:'var(--ink-faint)',flexShrink:0,display:'inline-block',
      transition:'transform .22s cubic-bezier(.2,.9,.2,1)', transform:open?'rotate(90deg)':'none'});
    const rowVal=(open)=>({fontSize:14.5,fontWeight:open?700:500,color:open?'#1D9E75':'var(--ink-mut)',
      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontVariantNumeric:'tabular-nums'});
    const wl=['日','月','火','水','木','金','土'];
    const v={ hd:HD0,
      fw:402, fh:874,
      monthShown:st.screen==='month', dayShown:st.screen==='day', newShown:st.screen==='new', detailShown:st.screen==='detail', dialogShown:!!st.dialog&&!st.dialog.phase, celebShown:!!st.dialog&&!!st.dialog.phase, freeShown:st.screen==='free',
      monthLabel:String(st.ym.m+1), year:String(st.ym.y), wageOn, stepBtn,
      onPrevMonth:()=>this.setState(s=>({ym:shiftMonth(s.ym,-1), dayNum:null})),
      onNextMonth:()=>this.setState(s=>({ym:shiftMonth(s.ym,1), dayNum:null})),
      onToggleWage:()=>this.setState(s=>({wageOn:!s.wageOn})),
      // 見出しの「8月 2026」を押すと年月をえらべる。
      // ‹ › だけだと、来年の3月に行くのに7回押すことになる。
      onTapMonthHead:()=>{ tapLight(); this.setState(s=>({ymSheet:s.ymSheet?null:{y:s.ym.y}})); },
      // 今月を見ているなら今日、別の月を見ているならその月の1日から始める
      onFab:()=>{ const t=st.today; const same=st.ym.y===t.y&&st.ym.m===t.m; this.openNew(same?t.d:1,'month'); },
      onCancel:()=>this.setState({screen:st.returnTo}),
      onBack:()=>this.setState({screen:st.returnTo, detailId:null, detailMenu:false}),
      onDayBack:()=>this.setState({screen:st.dayFrom==='free'?'free':'month', dayNum:null}),
      onOpenFree:()=>this.setState({screen:'free'}),
      onFreeBack:()=>this.setState({screen:'month'}),
      // 控えを貼りつけている間はナビを隠す。浮かせてあるので、
      // キーボードが上がると入力欄に重なって、貼りつけの邪魔になる。
      // キーボードが出ているあいだも隠す。ナビは浮かせてあるので、キーボードで画面が縮むと
      // 一緒に持ち上がって、入力欄の上に乗る（TestFlight の実機で見た）
      navShown: (st.screen==='month' || st.screen==='free' || st.screen==='report'
        || (st.screen==='settings' && !st.pasteOpen)) && !st.kbOpen,
      onBell:()=>this.openNotices(),
      navCur: st.screen,
      // カレンダーを見ているときにもう一度押すと、今日の月へ戻る（iPhone のカレンダーと同じ）
      onNavCal:()=>{ if(st.screen==='month') { this.goToday(); return; } this.setState({screen:'month', dayNum:null, detailId:null}); },
      onNavFree:()=>this.setState({screen:'free'}),
      onNavReport:()=>this.setState({screen:'report'}),
      onNavSettings:()=>{ resetSettingsScroll(); this.setState({screen:'settings', editTypeKey:null, setPage:null}); this._loadTips(); },
      onOpenSummary:()=>this.setState({screen:'summary', shareToast:false, cardKind:'month', cardFrom:st.screen}),
      onSummaryClose:()=>this.setState(s=>({screen:s.cardFrom||'month'})),
      // カレンダーは指の動きについてくる。離したところで隣の月に収まるか、元に戻る。
      onMonthTouchStart:(e)=>{
        const t=e.touches&&e.touches[0]; if(!t) return;
        // 前のスワイプがまだ収まりきる前に次が始まったら、先にその1回ぶんを確定させる。
        // ここで捨てると、素早く2回払っても1ヶ月しか動かない。
        this._commitSwipe();
        this._sx=t.clientX; this._sy=t.clientY; this._axis=null;
        this._trackW=(e.currentTarget&&e.currentTarget.clientWidth)||320;
        this._dragDx=0; this._dragging=true;
        this.setState({swipe:{dx:0, animating:false}});
      },
      onMonthTouchMove:(e)=>{
        const t=e.touches&&e.touches[0]; if(!t||this._sx==null) return;
        const dx=t.clientX-this._sx, dy=t.clientY-this._sy;
        // 最初の数pxで、横に払っているのか縦に送っているのかを決める
        if(!this._axis){
          if(Math.abs(dx)<6 && Math.abs(dy)<6) return;
          this._axis = Math.abs(dx)>Math.abs(dy)*1.2 ? 'x' : 'y';
        }
        if(this._axis!=='x') return;
        // 端では少し重くして、紙を引っぱっている感じにする
        const w2=this._trackW||320;
        const d = Math.abs(dx)>w2 ? Math.sign(dx)*(w2+(Math.abs(dx)-w2)*0.3) : dx;
        // 指が動くたびに setState すると、アプリ全体（3 か月分のマス目）を描き直すことになる。
        // 900 件の予定でパソコンでも 1 回 30ms 前後かかり、iPhone では指についてこなかった。
        // 払っている間は描き直さず、帯を直接ずらすだけにする。描き直すのは離したときの 1 回
        this._dragDx=d;
        this._moveTrack(d, false);
      },
      onMonthTouchEnd:(e)=>{
        const t=e.changedTouches&&e.changedTouches[0];
        const wasX=this._axis==='x'; this._sx=null; this._axis=null; this._dragging=false;
        if(!t||!wasX) return;
        const dx=this._dragDx||0;
        const w=this._trackW||320;
        const go = Math.abs(dx) > Math.min(72, w*0.22);
        const dir = dx<0 ? 1 : -1;
        // 指を離したら滑らせる。滑り終わってから月を差し替える（_commitSwipe）
        this._pendingDir = go ? dir : 0;
        // React は「前に描いた値」と比べて変わった所だけ書く。戻すとき（0px）は前の描画と同じ値なので
        // 書いてくれず、指で動かした位置のまま残る。だから帯は自分でも動かしておく
        this._moveTrack(go ? dir*-w : 0, true);
        this.setState({swipe:{dx: go ? dir*-w : 0, animating:true}});
        this._settle=setTimeout(()=>this._commitSwipe(), 300);
      },
      // iOS がタッチを途中で取り消すことがある（通知センターを引き出しかけた、ホームバーに触れた、
      // 電話や通知が割り込んだ、など）。そのときは touchend が来ない。
      // 前はこれを受けていなかったので、カレンダーが指を止めた位置でずれたまま止まった
      // （隣の月が半分見えたり、大きく払っていると端に何も無い白い所が出た）。
      // 取り消されたら、月は変えずに元の位置へ滑らせて戻す
      onMonthTouchCancel:()=>{
        const wasX=this._axis==='x'; this._sx=null; this._axis=null; this._dragging=false;
        if(!wasX) return;
        this._pendingDir=0;
        this._moveTrack(0, true);
        this.setState({swipe:{dx:0, animating:true}});
        clearTimeout(this._settle);
        this._settle=setTimeout(()=>this._commitSwipe(), 300);
      },
      onShareCard:()=>{ this._shareCard(st.screen==='summary'?'summary':'free'); },
      onOpenShare:()=>{ tapLight(); this.setState({screen:'share', shareToast:false, cardFrom:st.screen}); },
      onShareClose:()=>this.setState(s=>({screen:s.cardFrom||'settings'})),
      onOpenTerms:()=>this.setState({screen:'doc', docKey:'terms'}),
      onOpenPrivacy:()=>this.setState({screen:'doc', docKey:'privacy'}),
      onDocBack:()=>this.setState({screen:'settings', docKey:null}),
      onFreePrev:()=>this.shiftFree(-1),
      onFreeNext:()=>this.shiftFree(1),
      // 空き状況も横に払って月を送れるようにする。
      // ここは月表示と違って縦に並ぶ一覧なので、指について動かすカルーセルにはせず、
      // 離した時点で月を差し替えて、送った向きに滑り込ませる。
      onFreeTouchStart:(e)=>{
        const t=e.touches&&e.touches[0]; if(!t) return;
        this._fsx=t.clientX; this._fsy=t.clientY; this._fAxis=null;
      },
      onFreeTouchMove:(e)=>{
        const t=e.touches&&e.touches[0]; if(!t||this._fsx==null) return;
        const dx=t.clientX-this._fsx, dy=t.clientY-this._fsy;
        if(!this._fAxis){
          if(Math.abs(dx)<8 && Math.abs(dy)<8) return;
          this._fAxis = Math.abs(dx)>Math.abs(dy)*1.2 ? 'x' : 'y';
        }
      },
      // 取り消されたら、覚えていた指の位置を捨てるだけ（こちらは指について動かしていない）
      onFreeTouchCancel:()=>{ this._fsx=null; this._fAxis=null; },
      onFreeTouchEnd:(e)=>{
        const t=e.changedTouches&&e.changedTouches[0];
        const wasX=this._fAxis==='x'; const sx=this._fsx;
        this._fsx=null; this._fAxis=null;
        if(!t||!wasX||sx==null) return;
        const dx=t.clientX-sx;
        if(Math.abs(dx) < 60) return;   // 浅い払いでは動かさない
        this.shiftFree(dx<0 ? 1 : -1);
      },
      stop:(e)=>e&&e.stopPropagation(),
    };

    // ---------- はじめての案内 ----------
    v.onboardShown = !st.settings.onboarded;
    if(v.onboardShown){
      const ob=st.onboard, teal='#1D9E75';
      v.obStep = ob.step;
      v.obDots = [0,1,2,3,4].map(i=>({ style:{width:i===ob.step?18:6,height:6,borderRadius:3,
        background:i===ob.step?'var(--ink)':'var(--line)',transition:'all .3s cubic-bezier(.2,.9,.2,1)'} }));
      // 1枚目のしくみは、押さなくても「つぎへ」で進める（押すまで進めないのは、忙しい人には重かった）
      v.onObNext = ()=>this.onboardNext();
      v.onObBack = ()=>this.onboardBack();
      v.onObSkip = ()=>this.finishOnboard(false);
      // 画面を押したら、演出を飛ばして全部出す
      v.obFast = !!ob.fast;
      v.onObFast = ()=>{ if(this._obStepping) return; if(!this.state.onboard.fast) this.setState(s=>({onboard:{...s.onboard, fast:true}})); };
      // 0枚目：使い方の1問
      v.obQLine1 = ((t)=>t.split('').map((ch,i)=>({ch, style:{display:'inline-block', animation:`inkRise .5s cubic-bezier(.2,.7,.25,1) ${(0.15+i*0.05).toFixed(2)}s both`}})))('ふだんの予定に');
      v.obQLine2 = ((t)=>t.split('').map((ch,i)=>({ch, style:{display:'inline-block', animation:`inkRise .5s cubic-bezier(.2,.7,.25,1) ${(0.55+i*0.05).toFixed(2)}s both`}})))('近いのは？');
      v.obProfiles = PROFILE_KEYS.map((k,i)=>({ key:k, label:PROFILES[k].label, note:PROFILES[k].note,
        onClick:()=>this.onboardPick(k),
        style:{ display:'flex', flexDirection:'column', gap:3, padding:'15px 16px', borderRadius:15, cursor:'pointer',
          background:'var(--card)', border:'1px solid '+(ob.picked===k?'var(--ink)':'var(--line)'),
          animation:`obLift .45s cubic-bezier(.2,.7,.25,1) ${(1.0+i*0.07).toFixed(2)}s both` } }));
      // 見本は答えた使い方に合わせる。学生はこれまでと同じ「カフェバイト」と「映画」
      const DEMO={ student:['カフェバイト','映画','このシフト、どうなりました？'], work:['打ち合わせ','定例','この仮押さえ、どうなった？'],
        shift:['希望休','日勤','この休み、通りましたか？'], free:['〇〇社 打ち合わせ','納品','この仮押さえ、どうなった？'],
        family:['保育園の面談','歯医者','この予定、どうなりました？'] };
      const demo=DEMO[ob.picked||this.profile()]||DEMO.student;
      { const n=new Date(); v.obDateText=`${n.getMonth()+1}月${n.getDate()}日（${['日','月','火','水','木','金','土'][n.getDay()]}）`; }
      // 最後の1枚：毎朝のお知らせを使うか
      v.obMorningOn = !!ob.morning;
      v.onObMorning = ()=>{ tapLight(); this.setState(s=>({onboard:{...s.onboard, morning:!s.onboard.morning}})); };
      v.obMorningTrack = tgTrackOb(!!ob.morning); v.obMorningKnob = tgKnobOb(!!ob.morning);

      // 1枚目：しくみを、さわって知ってもらう。
      //
      // 一字ずつ、薄い墨から本来の濃さへ沈み込むように現れる。
      // 「ペンで書かれる」のではなく「すでに紙の中にあった字が、見えてくる」。
      // 手書きの書体は iOS に日本語のものが無いので、書体ではなく色と動きで作る。
      //
      // 遅れは全部ここに並べてある。上から順に、約2.9秒で出そろう。
      const EASE='cubic-bezier(.2,.7,.25,1)';
      const chars=(text,start,step)=>text.split('').map((ch,i)=>({ ch,
        style:{ display:'inline-block',
          animation:`inkRise .5s ${EASE} ${(start+i*step).toFixed(2)}s both` } }));
      // 「予定を、少しだけ書いておきました。」と書いていた時期があるが、
      // 実際には1件も書いていない（案内の中の見本を見せているだけ）ので嘘だった。
      // 最初の一文は、このアプリが何なのかを言う。
      v.obLine1 = chars('決まった予定も、', 0.15, 0.06);
      v.obLine2 = chars('まだの予定も。', 0.62, 0.05);
      // 折り返させない。一字ずつ inline-block にすると日本語の行末処理が効かず、
      // 「、」や「。」が行頭に来てしまう（この長さなら1行に収まる）
      v.obLineStyle = { fontFamily:"'Hiragino Mincho ProN','Yu Mincho',serif", fontSize:27,
        lineHeight:1.6, letterSpacing:'.05em', color:'var(--ink)', whiteSpace:'nowrap' };
      const at=(name,dur,delay)=>({ animation:`${name} ${dur}s ${EASE} ${delay}s both` });
      v.obPaperStyle = { marginTop:34, background:'var(--card)', border:'1px solid var(--line)',
        borderRadius:18, padding:18, ...at('obLift',.6,1.7) };
      // 日付は --ink-faint だとコントラスト比 2.06 しかなく、11px では読みにくい。
      // --ink-mut に上げて 3.4／ダーク 4.9（見出しより弱い、という関係は保つ）
      v.obDateStyle = { fontSize:11, fontWeight:600, color:'var(--ink-mut)', marginBottom:10,
        ...at('capRise',.5,1.85) };
      v.obSolidWrap = at('obLift',.55,1.95);
      v.obCaptionDelay = at('capRise',.45,2.4);
      // 点線のまま = dash / asking。塗りになるのは fill から。
      const asking = ob.demo==='asking';
      const filled = ob.demo==='fill' || ob.demo==='done';
      // このアプリで一番覚えてほしい操作なので、押されるまで待つ。
      // 押されるまでは、点線が静かに息をする（出そろってから始める）。
      v.obDashWrap = { animation: `obLift .55s ${EASE} 2.1s both`
        + (ob.demo==='dash' ? `, tapBreath 2.6s ease-in-out 2.9s infinite` : '') };
      // 押したあとに出る「確定した」。本物のダイアログと同じ言葉にしてある。
      v.obAsking = asking;
      v.onObDemoConfirm = ()=>this.onboardDemoConfirm();
      v.obAskHeading = demo[2];
      v.obConfirmStyle = { marginTop:11, padding:'11px 14px', borderRadius:12, textAlign:'center',
        fontSize:14, fontWeight:700, color:'#fff', background:teal, cursor:'pointer',
        animation:`capRise .3s ${EASE} both` };
      v.onObDemoTap = ()=>this.onboardDemoTap();
      v.onObDemoReset = ()=>this.onboardResetDemo();
      v.obDemoPillStyle = {
        position:'relative', overflow:'hidden', display:'block', width:'100%', boxSizing:'border-box',
        height:34, lineHeight:'30px', borderRadius:9, padding:'0 12px', fontSize:15, fontWeight:400,
        cursor: filled ? 'default' : 'pointer',
        // 本物の未確定のピルと同じ地色を使う（paperFrom）。
        // ここだけ薄い色を直に書いていたので、ダークモードで文字が沈んでいた
        background: filled ? this.softFill(teal) : this.paperShow(this.paperFrom(teal)),
        border: '1.6px '+(filled?'solid':'dashed')+' '+this.softLine(teal),
        color: this.inkOn(teal),
        animation: ob.demo==='done' ? 'pillSettle .24s cubic-bezier(.3,1.4,.5,1)' : 'none',
        transition:'background .25s, border-color .25s',
      };
      v.obDemoFillStyle = { position:'absolute',left:0,top:0,bottom:0,right:0,background:this.softFill(teal),
        transformOrigin:'left center', transform: filled?'scaleX(1)':'scaleX(0)',
        animation: ob.demo==='fill' ? 'sweepFill .3s cubic-bezier(.2,.9,.2,1) forwards':'none', zIndex:0 };
      v.obDemoTextStyle = { position:'relative', zIndex:1 };
      v.obDemoLabel = filled ? demo[0] : '？'+demo[0];
      v.obDemoCaption = filled ? '決まった、が形になりました。'
        : asking ? '押すと、この予定が塗りに変わります。'
        : '↑ 点線の予定をタップしてみてください';
      v.obDemoCaptionColor = filled ? '#0F6E56' : 'var(--ink)';
      v.obDemoDone = ob.demo==='done';
      // 押すまで進ませない。ここを飛ばされると、このアプリの一番の要が
      // 伝わらないまま日常に入る。押してあれば普通の黒いボタン。
      // 押さなくても進める。押してあれば黒、まだなら控えめな地で「つぎへ」
      v.obNextLocked = false;
      v.obNextStyle = { padding:16, borderRadius:17, textAlign:'center', fontSize:16, fontWeight:400,
        transition:'all .3s cubic-bezier(.2,.9,.2,1)', cursor:'pointer',
        ...(ob.demo==='done'
          ? { background:'var(--ink)', color:'var(--card)' }
          : { background:'var(--bg2)', color:'var(--ink-soft)' }) };
      v.obNextLabel = 'つぎへ';
      // 上に確定した予定を1本置く。違いは、並べて初めて見える。
      // 点線だけを出しても「点線が普通の形」と思われてしまう。
      {
        const at=(st.types||[]).find(t=>t.key==='asobi') || {color:'#B4453A'};
        v.obSolidPillStyle = { display:'block', width:'100%', boxSizing:'border-box', marginBottom:8,
          height:34, lineHeight:'30px', borderRadius:9, padding:'0 12px', fontSize:15, fontWeight:400,
          background:this.softFill(at.color), border:'1.6px solid '+this.softLine(at.color),
          color:this.inkOn(at.color) };
        v.obSolidLabel = demo[1];
      }

      // 時給の画面はやめた。バイトをしない人には無関係な入力で、
      // そこに1枚使うのは重い。時給はバイト先を作るときに聞く。

      // 2枚目：空き状況。3枚目：シェア。
      // もとは1枚に押し込んでいたが、別の話がふたつ入って読みにくかった。
      // 1枚に1つだけ言う。
      v.obFreeLine1 = chars('空いてる日が、', 0.1, 0.06);
      v.obFreeLine2 = chars('ひと目でわかる。', 0.55, 0.05);
      v.obFreeCardStyle = { marginTop:30, background:'var(--card)', border:'1px solid var(--line)',
        borderRadius:18, padding:'6px 16px 10px', ...at('obLift',.6,1.5) };
      // 記号の説明を並べるより、本物の一覧の形で見せるほうが早い
      v.obFreeRows = [
        { day:'3', dow:'月', mark:'○', color:'#1D9E75', note:'まる1日あいてます', style:at('obLift',.5,1.75) },
        { day:'4', dow:'火', mark:'△', color:'#B9770F', note:'17:00 以降なら空いてます', style:at('obLift',.5,1.9) },
        { day:'5', dow:'水', mark:'×', color:'#C1C5CC', note:'ふさがっています', style:at('obLift',.5,2.05) },
      ];
      v.obFreeNote = at('capRise',.45,2.3);

      // 3枚目：シェア。カレンダーごと送ると見られたくない予定まで写る、
      // という困りごとに対する答えなので、その絵をそのまま見せる。
      v.obShareLine1 = chars('予定は見せずに、', 0.1, 0.06);
      v.obShareLine2 = chars('空きだけ送れる。', 0.55, 0.05);
      v.obShareCardStyle = { marginTop:30, background:'#FFFDF8', border:'1px solid var(--line)',
        borderRadius:18, padding:'16px 16px 18px', ...at('obLift',.6,1.5) };
      // 送られる画像そっくりの見本。
      // 日付は本物の画像にも入っている（隠しているのは予定の名前だけ）。
      // 数字を抜くと、そもそもカレンダーだと分からなかった。
      {
        const box={height:27,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',
          fontVariantNumeric:'tabular-nums'};
        const free={...box,background:'#FAECE7',border:'1.5px solid #D85A30',fontSize:12,fontWeight:700,color:'#712B13'};
        const busy={...box,background:'#EDEEF0',fontSize:12,fontWeight:400,color:'#C1C5CC'};
        const pattern=[1,0,0,1,1,0,1, 1,1,0,1,0,0,1, 0,1,1,1,0,1,1];
        v.obShareCells = pattern.map((f,i)=>({ label:String(i+1), style:{ ...(f?free:busy),
          animation:`obLift .4s ${EASE} ${(1.7+i*0.022).toFixed(2)}s both` } }));
        v.obShareWeekdays = ['日','月','火','水','木','金','土'].map((d,i)=>({ label:d,
          style:{textAlign:'center',fontSize:9,fontWeight:600,paddingBottom:3,
            color: i===0||i===6 ? '#8C887C' : '#B0B4BB'} }));
      }
      v.obShareNote = at('capRise',.45,2.5);

      // 4枚目：取り込み
      v.obImpLine1 = chars('いまの予定を、', 0.1, 0.06);
      v.obImpLine2 = chars('持っていきますか？', 0.55, 0.05);
      v.obImpBodyStyle = at('capRise',.5,1.4);
      v.obImpCardStyle = { marginTop:24, background:'var(--card)', border:'1px solid var(--line)',
        borderRadius:18, padding:'16px 18px', ...at('obLift',.6,1.65) };
      v.obCanImport = canImport();
      v.onObImport = ()=>this.finishOnboard(true);
      v.onObStart = ()=>this.finishOnboard(false);
    }

    // ---------- 保存についての知らせ ----------
    // 保存できていないことを黙っていると、いちばん悪い形で気づく——
    // 画面には出ているのに、閉じて開いたら消えている。必ず出す。
    v.saveFailedShown = !!st.saveFailed;
    v.onSaveFailedTap = ()=>this.setState({screen:'settings', setPage:'backup', pasteOpen:false});
    // ファイルから戻したときは、黙っていると「勝手に戻った」と見える
    v.recoveredShown = !!st.recovered;
    v.recoveredText = `保存されていた${st.recovered}件の予定を戻しました`;
    v.onRecoveredClose = ()=>this.setState({recovered:null});

    // ---------- 何も無いときの案内 ----------
    // 月表示のぶんは showFirstRunHint（前からある）。二重に出さない。
    // 空き状況は、予定が無いと全部「○」で意味を持たない。
    // ここが取り込みを勧めるのに一番いい場所（寂しい画面を見た、その瞬間）。
    v.freeEmptyShown = st.events.length===0 && !v.onboardShown && st.screen==='free';
    v.freeEmptyCanImport = canImport();
    v.onFreeEmptyImport = ()=>this.openImport();

    // ---------- 予定の取り込み ----------
    v.importAvailable = canImport();
    v.onOpenImport = ()=>this.openImport();
    v.importShown = st.screen==='import';
    if(v.importShown){
      const im=st.imp;
      v.impPhase=im.phase;
      v.impError=im.error;
      v.impCount=String((im.found||[]).length);
      v.impOnCount=String((im.found||[]).filter(e=>e.on).length);
      v.impAllOn=(im.found||[]).length>0 && (im.found||[]).every(e=>e.on);
      // どれだけ当たったかを見せる。当たらなかったものは用事に置いてあるので、
      // 「何件を自分で直せばいいか」がこの数から分かる。
      { const g=(im.found||[]).filter(e=>e.guessed).length;
        v.impGuessedCount = g;
        v.impGuessText = g ? `名前から${g}件の種類を当てました。ちがっていたら押して直せます。`
                           : ''; }
      v.onToggleAll=()=>this.setAllImport(!v.impAllOn);
      // 選んでいるものをまとめて種類変更
      v.impBulkChips = this.visibleTypes().map(t=>({ label:t.name, onClick:()=>this.setAllImportType(t.key),
        style:{padding:'6px 12px',borderRadius:999,fontSize:12,cursor:'pointer',
          background:'var(--card)', color:'var(--ink-mut)', border:'1px solid var(--line)'} }));
      // 1件ごと
      v.impRows = (im.found||[]).map(e=>{
        const ty=st.types.find(t=>t.key===e.type)||st.types[0];
        return {
          key:e.key, title:e.title, on:e.on, guessed:!!e.guessed,
          // 2回目の取り込みでは「変わった」「元で消えた」を札で見せる
          kindTag: e.kind==='changed' ? `変わった（前は ${e.was}）` : e.kind==='gone' ? '元で消えた・消すなら選ぶ' : '',
          place: e.place || '',
          when:`${e.m+1}/${e.day}　${e.allDay?(e.days>1?e.days+'日間':'終日'):e.start+'–'+e.end}${e.status==='mikakutei'?'　まだ':''}`,
          onToggle:()=>this.toggleImportRow(e.key),
          rowStyle:{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',borderBottom:'1px solid var(--line)',
            cursor:'pointer', opacity:e.on?1:0.45},
          checkStyle:{width:20,height:20,borderRadius:7,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:12,fontWeight:800,
            background:e.on?'#1D9E75':'transparent', color:'#fff',
            border:'1.5px solid '+(e.on?'#1D9E75':'var(--line)')},
          // 種類の札は1つだけ。押すと次の種類に変わる（前は4つ並べていて、行が忙しかった）
          typeName:ty.name,
          typeStyle:{padding:'5px 11px',borderRadius:999,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
            background:this.softFill(ty.color), color:this.inkOn(ty.color), border:'1px solid '+this.softLine(ty.color)},
          onCycleType:(ev)=>{ if(ev)ev.stopPropagation(); tapLight();
            const keys=this.visibleTypes().map(t=>t.key); const n=keys[(keys.indexOf(e.type)+1)%keys.length];
            this.setImportRowType(e.key,n); },
        };
      });
      v.impAdded=String(im.added||0);
      // 取り込み後の一言。何件が場所つきか、何日も続く予定がいくつか、点線で入ったのはいくつか
      { const parts=[];
        if(im.updated) parts.push(`${im.updated}件を元に合わせて直しました`);
        if(im.removed) parts.push(`元で消えた${im.removed}件を消しました（最近消した予定から戻せます）`);
        if(im.withPlace) parts.push(`場所つき ${im.withPlace}件`);
        if(im.multi) parts.push(`何日も続く予定 ${im.multi}件`);
        v.impDoneDetail = parts.join('・');
        v.impDoneDashed = im.dashed ? `「仮」「候補」などが付いた${im.dashed}件は、点線（まだ）で置きました。` : ''; }
      v.onImportUndo = ()=>this.undoImport();
      v.impUndoShown = im.phase==='done' && !im.tidied && !!(st.settings.lastImport && (im.added||0)>0);
      // カレンダーをえらぶ段
      v.impCals = (im.cals||[]).map(c=>{ const ty=c.type ? st.types.find(t=>t.key===c.type) : null;
        return { key:c.id, label:c.title, color:c.color, on:c.on, typeName: ty ? ty.name : '名前から当てる',
          typeStyle:{padding:'5px 10px',borderRadius:999,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
            ...(ty ? {background:this.softFill(ty.color), color:this.inkOn(ty.color)} : {background:'var(--bg2)', color:'var(--ink-mut)'})},
          onToggle:()=>{ tapLight(); this.setState(s=>({imp:{...s.imp, cals:s.imp.cals.map(x=>x.id===c.id?{...x,on:!x.on}:x)}})); },
          onCycleType:(ev)=>{ if(ev) ev.stopPropagation(); tapLight(); const keys=['', ...this.visibleTypes().map(t=>t.key)];
            const n=keys[(keys.indexOf(c.type||'')+1)%keys.length]; this.setState(s=>({imp:{...s.imp, cals:s.imp.cals.map(x=>x.id===c.id?{...x,type:n}:x)}})); } }; });
      const rchip=(sel)=>({padding:'7px 12px',borderRadius:999,fontSize:12.5,cursor:'pointer',whiteSpace:'nowrap',
        background:sel?'var(--ink)':'var(--card)', color:sel?'var(--card)':'var(--ink-mut)', border:'1px solid '+(sel?'var(--ink)':'var(--line)')});
      v.impRangeChips = [['month','先月から'],['year','今年のはじめから'],['back','1年前から']].map(([k,label])=>({label, style:rchip((im.range||'month')===k),
        onClick:()=>{ tapLight(); this.setState(s=>({imp:{...s.imp, range:k}})); }}));
      v.onReadCals = ()=>this.runRead(null);
      v.impCalsOnCount = (im.cals||[]).filter(c=>c.on).length;
      v.impNone = im.phase==='found' && (im.found||[]).length===0;
      v.impFromIcs = im.source==='ics';
      v.impTidy = im.source==='tidy';
      v.impTidied = im.tidied||'';
      v.onTidySkip = ()=>this.tidySkip();
      v.onTidyDelete = ()=>this.tidyDelete();
      // ほかのカレンダーの案内。開閉できるようにして、ふだんは見出しだけにする。
      // 全員に要るものではないが、要る人にとっては「使えない」と「使える」の差になる。
      v.impOtherOpen = !!im.otherOpen;
      v.impAskOpen = !!im.askOpen;
      v.impBulkOpen = !!im.bulkOpen;
      v.onToggleBulk = ()=>{ tapLight(); this.setState(s=>({imp:{...s.imp, bulkOpen:!s.imp.bulkOpen}})); };
      v.onToggleAsk = ()=>{ tapLight(); this.setState(s=>({imp:{...s.imp, askOpen:!s.imp.askOpen}})); };
      v.onToggleOther = ()=>{ tapLight(); this.setState(s=>({imp:{...s.imp, otherOpen:!s.imp.otherOpen}})); };
      // 設定アプリの中の言い方は iOS の版で変わる。
      // iOS 18 から「設定 → アプリ → カレンダー → カレンダーアカウント」、
      // それ以前は「設定 → カレンダー → アカウント」。両方書いておく。
      v.impOtherSteps = [
        '設定アプリを開く',
        '「アプリ」→「カレンダー」と進む（iOS 17 以前は、そのまま「カレンダー」）',
        '「カレンダーアカウント」（または「アカウント」）→「アカウントを追加」で、使っているサービスを選ぶ',
        'この画面に戻って、もう一度「続ける」を押す',
      ];
      v.onScan=()=>this.runScan();
      v.impDenied=!!im.denied;
      // 設定アプリを開いたら、戻ってきたときに自動でもう一度読みにいく
      v.onOpenSettingsApp=()=>{ tapLight(); this._retryImportOnReturn=true; openAppSettings(); };
      v.onDoImport=()=>this.doImport();
      v.onImportBack=()=>this.setState({screen:'settings'});
      v.onImportDone=()=>this.setState({screen:'month'});
      // 取り込んだ予定をどの種類に入れるか
      v.impTypeChips = st.types.map(t=>{ const sel=t.key===im.type;
        return { label:t.name, onClick:()=>this.setState(s=>({imp:{...s.imp,type:t.key}})),
          style:{padding:'7px 14px',borderRadius:999,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',
            background:sel?t.color:'var(--card)', color:sel?'#fff':'var(--ink-mut)',
            border:'1px solid '+(sel?t.color:'var(--line)')} }; });
      // 何が入るのか見えるように、先頭のいくつかを見せる
      v.impPreview = (im.found||[]).slice(0,6).map(e=>({
        title:e.title,
        when:`${e.m+1}/${e.day}　${e.allDay?'終日':e.start+'–'+e.end}`,
      }));
      v.impMore = Math.max(0,(im.found||[]).length-6);
    }

    // ---------- 規約・プライバシーポリシー ----------
    v.docShown = st.screen==='doc' && !!DOCS[st.docKey];
    if(v.docShown){
      const doc = DOCS[st.docKey];
      v.docTitle = doc.title;
      v.docLead = doc.lead;
      v.docSections = doc.sections;
      v.docEffective = EFFECTIVE;
    }
    v.appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.1.0';

    // ---------- 開発応援（投げ銭） ----------
    // 値段は App Store から取れたときだけ出す。取れないときは行ごと出さない——
    // 押しても買えない行が並ぶより、無いほうがいい。
    // サポーターカード。応援したことがある人にだけ出る。
    // 機能ではなく「自分がやったことの記録」——レシートに近い。
    // 消耗型のまま渡せるのは、何も解放していないから。
    {
      const sup = st.supports || [];
      const tipShown = Array.isArray(st.tips) && st.tips.length > 0;
      v.supporterShown = sup.length > 0;
      if(v.supporterShown){
        const total = sup.reduce((a,x)=>a+(x.yen|0), 0);
        const first = new Date(Math.min(...sup.map(x=>x.at)));
        v.supporterCount = sup.length===1 ? '1回' : sup.length+'回';
        v.supporterTotal = '¥'+total.toLocaleString('ja-JP');
        v.supporterSince = `${first.getFullYear()}年${first.getMonth()+1}月から`;
        v.onOpenCard = ()=>{ tapLight(); this.stopCardFlip(); this.setState({screen:'card', cardAngle:0}); };
        // 下に応援の行が続くときだけ、下線を引く。群の最後なら引かない
        v.supporterRowStyle = {display:'flex',alignItems:'center',gap:10,padding:'14px 16px',
          cursor:'pointer',
          ...(tipShown ? {borderBottom:'1px solid var(--line)'} : {}),
          ...(st.pressed==='sup' ? {background:'var(--press)'} : {})};
        v.onSupDown = ()=>this.setPressed('sup');
        v.onSupUp = ()=>this.setPressed(null);
      }
    }

    // ---------- サポーターカード（1枚の画面） ----------
    // 通し番号と「いま◯人の1人です」は出せない。全員を数える場所が要るが、
    // このアプリはサーバーを持たない（持つと「外部に送らない」という約束が崩れる）。
    // 代わりに「いつから」と金額を主役にする。古株であることは、番号がなくても示せる。
    v.cardShown = st.screen==='card';
    if(v.cardShown){
      const sup = st.supports || [];
      const total = sup.reduce((a,x)=>a+(x.yen|0), 0);
      const first = new Date(Math.min(...sup.map(x=>x.at)));
      const M2 = (n)=>String(n).padStart(2,'0');
      v.onCardBack = ()=>{ this.stopCardFlip(); this.setState({screen:'settings'}); };
      // 押しても裏返る。なぞったあとに来る click は無視する（二重に回ってしまう）
      v.onFlipCard = ()=>{
        if(this._cTapOff && Date.now() < this._cTapOff) return;
        tapLight();
        this._settleCard((this.state.cardAngle||0) + 180);
      };
      v.onCardTouchStart = (e)=>this.cardTouchStart(e);
      v.onCardTouchMove = (e)=>this.cardTouchMove(e);
      v.onCardTouchEnd = ()=>this.cardTouchEnd();
      v.cardOwner = (st.settings.supporterName||'').trim();
      v.cardOwnerShown = v.cardOwner || '名前を入れる';
      v.onCardName = (e)=>{ const val=e.target.value.slice(0,20); this.setSetting('supporterName', val); };
      v.cardSince = `MEMBER SINCE ${first.getFullYear()}.${M2(first.getMonth()+1)}`;
      v.cardTotal = '¥'+total.toLocaleString('ja-JP');
      v.cardTimes = sup.length+'回';
      // 裏面：1回ずつの記録
      v.cardHistory = sup.slice().sort((a,b)=>b.at-a.at).map(x=>{
        const d=new Date(x.at);
        return { when:`${d.getFullYear()}.${M2(d.getMonth()+1)}.${M2(d.getDate())}`,
          yen:'¥'+(x.yen|0).toLocaleString('ja-JP') };
      });
      v.onShareCardImage = ()=>this._shareSupporterCard();

      // 箔の見た目。生成りの紙に真鍮を押した、という見立て。
      // 文字は紙より暗い真鍮色で、下に薄い明かりを1本入れて「沈んでいる」ようにする。
      // 段によって紙と箔が変わる。合計金額で決まる。
      const tier = tierFor(total);
      const foil = tier.foil;
      v.cardTierName = tier.name;
      v.cardMarkColor = tier.mark;
      {
        const nx = nextTier(total);
        v.cardNextText = nx
          ? `あと ¥${(nx.min-total).toLocaleString('ja-JP')} で${nx.name}カードになります`
          : 'いちばん上の段です。ありがとうございます。';
      }
      // 角度は指かこちらの手で1コマずつ動かす。CSS の transition は使わない。
      // 使うと「いまの角度」が state に無い時間ができて、表と裏の入れ替えを
      // 時間で合わせにいくことになる。それで一度、回っている途中に
      // カードが消えた（v0.21.2）。角度ひとつから両方を出せば、ずれようがない。
      const ang = st.cardAngle || 0;
      const tilt = st.cardTilt || 0;
      const front = showsFront(ang);
      // 傾きを先に書く。こう並べると傾きは画面に対しての向きになり、
      // 表を見ていても裏を見ていても、指を下げれば同じ側が下がる。
      v.cardFlipStyle = { position:'relative', width:'100%', aspectRatio:'1.586',
        transformStyle:'preserve-3d', cursor:'pointer', touchAction:'pan-y',
        transform:`rotateX(${tilt}deg) rotateY(${ang}deg)` };
      // backface-visibility は使わない。Safari では 3D変形と overflow:hidden を
      // 組み合わせると無視されることがあり（表の文字が鏡文字で透けた）、
      // 効く端末では逆に、消える側が二重になって一瞬何も無くなる。
      // 向こうを向いた面は opacity:0 にする。それだけで足りる。
      // 紙の上に肌理（刷り目と粒子）を敷く。ここを入れる前は、金が完璧に
      // 滑らかで、本物の金属にその清潔さは無かった。柄ではなく肌理なので、
      // 何が変わったかは意識に上らない——「なんとなく本物っぽい」で足りる。
      const tex = textureCss();
      const face = {
        position:'absolute', inset:0, borderRadius:18, padding:'20px 22px', overflow:'hidden',
        backgroundImage:`${tex.image}, linear-gradient(150deg, ${paperStops(tier.paper)})`,
        backgroundSize:`${tex.size}, 100% 100%`,
        backgroundRepeat:`${tex.repeat}, no-repeat`,
        border:'1px solid '+tier.edge };
      // 影も角度から出す。回っている最中は横にずれて濃くなり、
      // 空中で浮いて裏返っている感じを影の側からも支える。
      v.cardFaceStyle = { ...face, opacity: front ? 1 : 0, boxShadow: cardShadow(ang) };
      v.cardBackStyle = { ...face, transform:'rotateY(180deg)', opacity: front ? 0 : 1,
        boxShadow: cardShadow(ang, true) };
      // 斜めに流れる光。点滅させず、一定の速さで通り過ぎるだけ
      v.foilStyle = { position:'absolute', top:'-60%', left:0, width:'42%', height:'220%',
        background:`linear-gradient(90deg, rgba(255,255,255,0) 0%, ${tier.sheen} 50%, rgba(255,255,255,0) 100%)`,
        animation:'foilSweep 4.6s linear infinite', pointerEvents:'none', zIndex:0 };
      // カードの向きに連れて動く光。端末のジャイロは使わない——指で回すぶんだけで、
      // 「傾けると光が動く」は出せる。正面では真ん中、回すと光が逆へ滑る。
      {
        const gx = Math.sin((ang * Math.PI) / 180);          // 正面 0 → 真横 ±1
        const gy = Math.sin((tilt * Math.PI) / 180) * 3;     // 傾きは浅いので効きを強める
        // background（まとめ書き）と backgroundSize を混ぜると、React が
        // 「片方を更新したときにもう片方が落ちうる」と警告する。ここは角度が
        // 変わるたびに書き換わる場所なので、まとめ書きを使わない。
        v.glintStyle = { position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
          backgroundImage:`linear-gradient(${112 - tilt * 2}deg, ${tier.glint})`,
          backgroundSize:'250% 250%',
          backgroundPosition:`${(50 - gx * 42).toFixed(1)}% ${(50 - gy * 42).toFixed(1)}%` };
      }
      // 箔の粒。下から昇って、ちらついて消える。ゴールドと黒だけ
      v.cardFlecks = tier.fleck ? FLECKS.map(([x,y,d],i)=>({
        key:i,
        style:{ position:'absolute', left:x+'%', top:y+'%',
          width:i%3===0?3:2, height:i%3===0?3:2, borderRadius:'50%',
          background:tier.fleck, opacity:0, pointerEvents:'none', zIndex:0,
          animation:`fleck ${6+(i%4)}s ease-in-out ${d}s infinite` } })) : [];
      // 箔押しは紙に**沈んで**いる。上に影、下に明かりの2本で押し込む。
      // 前は下に明かり1本だけで、それは「浮き出し」の付け方だった。
      const stamped = { color:foil,
        textShadow: tier.key==='black'
          ? '0 -.5px 0 rgba(0,0,0,.65), 0 1px 0 rgba(255,240,196,.3)'
          : '0 -.5px 0 rgba(60,40,4,.45), 0 1px 0 rgba(255,252,232,.75)' };
      v.foilTextStyle = { ...stamped, fontSize:17, fontWeight:400, letterSpacing:'.02em' };
      v.foilSmallStyle = { ...stamped, fontSize:10, fontWeight:700, letterSpacing:'.14em',
        fontVariantNumeric:'tabular-nums' };
      v.cardNameStyle = { ...stamped, fontSize:15, fontWeight:400,
        opacity: v.cardOwner ? 1 : .45,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' };
      v.cardTotalStyle = { ...stamped, fontSize:22, fontWeight:300, letterSpacing:'-.02em',
        fontVariantNumeric:'tabular-nums' };
      v.cardHistYenStyle = { ...stamped, fontSize:12, fontWeight:700, fontVariantNumeric:'tabular-nums' };
    }

    // 診断（バージョンを5回叩くと出る）
    v.onTapVersion = ()=>this.tapVersion();
    v.probeShown = !!st.probe;
    if(st.probe){
      const p = st.probe;
      v.onProbeClose = ()=>this.setState({probe:null});
      v.onProbeRetry = ()=>this.runProbe();
      v.probeRows = p.running ? [{k:'', val:'読み込み中…'}] : [
        {k:'ネイティブか', val: p.native ? 'はい' : 'いいえ（ブラウザ）'},
        {k:'課金が使えるか', val: p.billing===null ? '—' : (p.billing ? 'はい' : 'いいえ')},
        {k:'聞いた製品ID', val: (p.asked||[]).join(String.fromCharCode(10))},
        {k:'返ってきた数', val: String((p.got||[]).length)},
        {k:'返ってきたID', val: (p.got||[]).length ? p.got.join(String.fromCharCode(10)) : '（なし）'},
        {k:'エラー', val: p.error || '（なし）'},
        {k:'ウィジェットの窓口', val: p.widget ? (p.widget.there ? 'ある' : 'ない') : '—'},
        {k:'ウィジェットへ渡した結果', val: !p.widget || !p.widget.last ? '（まだ渡していない）'
          : p.widget.last.ok
            ? `渡せた（${p.widget.last.days}日ぶん・${p.widget.last.size}文字）`
            : `渡せなかった：${p.widget.last.why}`},
      ];
      v.onSendWidget = ()=>this.sendWidgetNow();
    }

    v.tipShown = Array.isArray(st.tips) && st.tips.length > 0;
    // 設定の一番下に立てる「応援」の群。中身が何も無ければ、見出しごと出さない
    v.supportGroupShown = v.tipShown || v.supporterShown;
    // 応援は「このアプリについて」の中に、1行だけ置いて畳んでおく。
    // 探した人だけが見つければいいものなので、金額を並べたまま置かない。
    v.tipOpen = !!st.tipOpen;
    // 押した感。足りなかったのは2つ。
    //  1. 指が触れても何も変わらない。styles.css で tap-highlight を切ってあり、
    //     React の直書きの style では :active が書けないので、押しても無反応だった。
    //  2. 押してから App Store の画面が出るまで1〜2秒かかる。そのあいだ画面が
    //     何も言わないので、押せていないように見える。
    // 1は触れた瞬間に沈める、2は返事が来るまで沈めたままにする、で埋める。
    //
    // 手ごたえ（振動）は押し切ったときのまま動かさない。触れた瞬間に鳴らすと、
    // この行から指を滑らせて画面を送ったときにも鳴ってしまう。
    // 沈む色は消せる（指が離れる前に取り消せる）が、鳴った振動は取り消せない。
    const press = (on)=>on ? {background:'var(--press)'} : null;
    v.tipHeadStyle = {display:'flex',alignItems:'center',gap:12,padding:'14px 16px',cursor:'pointer',
      ...(st.tipOpen ? {borderBottom:'1px solid var(--line)'} : {}),
      ...press(st.pressed==='tip:head')};
    v.onTipHeadDown = ()=>this.setPressed('tip:head');
    v.onTipUp = ()=>this.setPressed(null);
    v.onToggleTip = ()=>{ tapLight(); this.setState(s=>({tipOpen:!s.tipOpen})); };
    v.tipRows = (st.tips||[]).map((t,i)=>({
      id:t.id, label:t.label, pressed: st.pressed==='tip:'+t.id || st.tipBusy===t.id,
      // 返事を待っているあいだは値段のかわりに「…」。押したことが残る
      price: st.tipBusy===t.id ? '…' : t.price,
      rowStyle:{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',cursor:'pointer',
        ...(i < (st.tips.length-1) ? {borderBottom:'1px solid var(--line)'} : {}),
        ...press(st.pressed==='tip:'+t.id || st.tipBusy===t.id)},
      onDown:()=>this.setPressed('tip:'+t.id),
      onUp:()=>this.setPressed(null),
      onClick:()=>this.buyTip(t.id),
    }));
    // 応援の画面の文。お礼だけにして、あとは金額を並べる（約束・これからの話は要らないと言われた）
    v.supportThanksTitle = 'いつも使ってくださって、ありがとうございます';
    v.supportThanks = 'LUKKO は、ひとりで作っています。\n応援は、作りつづける力になります。';
    // 困ったときの連絡先。アプリ内に無いと、メールではなくレビュー欄に書かれる。
    // 版を件名に入れておくと、どの版の話か聞き返さずに済む。
    v.contactEmail = CONTACT;
    v.contactHref = 'mailto:'+CONTACT
      +'?subject='+encodeURIComponent(APP_NAME+' について（v'+v.appVersion+'）');
    // App Store のレビュー欄を直接開く
    v.reviewHref = 'https://apps.apple.com/app/id'+APP_STORE_ID+'?action=write-review';

    // ---------- 控え（バックアップ） ----------
    v.onExportBackup = ()=>this.exportBackup();
    // 戻すのは「ファイルをえらぶ」が本筋。貼り付けは、えらべなかったときの逃げ道。
    v.onPickBackup = ()=>this.pickBackupFile();
    v.onExportIcs = ()=>this.exportIcs();
    v.tidyCount = this.tidyTargets().length;
    v.onOpenTidy = ()=>this.openTidy();
    v.onPickIcs = ()=>this.pickIcsFile();
    v.onIcsFile = (e)=>this.readIcsFile(e);
    v.onBackupFile = (e)=>this.readBackupFile(e);
    v.pasteOpen = !!st.pasteOpen;
    v.onTogglePaste = ()=>{ tapLight(); this.setState(s=>({pasteOpen:!s.pasteOpen, backupText:'', backupError:''})); };
    v.backupText = st.backupText||'';
    v.onBackupText = (e)=>{ const val=e.target.value; this.setState({backupText:val, backupError:''}); };
    v.backupError = st.backupError||'';
    v.onAskRestore = ()=>this.askRestore();
    v.restoreDisabled = !(st.backupText||'').trim();

    v.wageLabelColor = wageOn ? 'var(--ink)' : 'var(--ink-mut)';
    v.theme = st.settings.dark ? 'dark' : 'light';

    // ---------- お知らせ（ベル） ----------
    const nowMs = Date.now();
    const unread = unreadCount(st.notices);
    v.bellCount = unread;
    v.bellBadge = unread > 9 ? '9+' : String(unread);
    v.noticesShown = st.screen==='notices';
    if(v.noticesShown){
      v.noticeEmpty = st.notices.length===0;
      v.noticeHasUnread = unread>0;
      v.onMarkAllRead = ()=>this.markAllRead();
      v.onNoticesBack = ()=>this.setState({screen:'month', noticeOpen:null});
      // 何の知らせなのかを、アイコンだけでなく言葉でも出す
      const kindWord=(n)=> n.kind===KIND_SHIFT ? 'シフトの記録' : 'アップデート';
      const kindTagStyle=(n)=>({ fontSize:10,fontWeight:700,letterSpacing:'.02em',padding:'2px 7px',borderRadius:6,flexShrink:0,
        background: n.kind===KIND_SHIFT ? 'rgba(29,158,117,.13)' : 'var(--bg2)',
        color: n.kind===KIND_SHIFT ? '#0F6E56' : 'var(--ink-mut)' });
      v.noticeRows = sortNotices(st.notices).map(n=>({
        key:n.id, title:currentNoteText(n).title, when:relativeTime(n.at, nowMs), unread:!n.read,
        kindWord:kindWord(n), kindTagStyle:kindTagStyle(n),
        onClick:()=>this.openNotice(n),
        dotStyle:{ width:7,height:7,borderRadius:4,flexShrink:0,
          background: n.read ? 'transparent' : '#1D9E75' },
      }));
      // タップして中央に開く詳細
      const open = st.notices.find(n=>n.id===st.noticeOpen);
      v.noticeSheetShown = !!open;
      if(open){
        const at=new Date(open.at);
        v.nsKindWord = kindWord(open);
        v.nsKindTagStyle = kindTagStyle(open);
        const cur = currentNoteText(open);
        v.nsTitle = cur.title;
        // 本文は行ごとに。「・」で始まる行は箇条書きとして並べる
        v.nsLines = String(cur.body||'').split('\n').filter(Boolean).map((t,i)=>({ key:i, bullet:t.startsWith('・'), text:t.replace(/^・/,'') }));
        v.nsDate = at.getFullYear()+'年'+(at.getMonth()+1)+'月'+at.getDate()+'日';
        v.nsWhen = relativeTime(open.at, nowMs);
        v.nsIsShift = open.kind===KIND_SHIFT;
        // シフトの知らせからは、その場で実働を記録しにいける
        v.nsActionLabel = v.nsIsShift ? '実働を記録する' : '';
        v.onNoticeAction = ()=>{
          const ev=st.events.find(e=>String(e.id)===String(open.eventId));
          this.setState({noticeOpen:null});
          if(ev) this.openDialog(ev,'worked','notices');
        };
        v.onNoticeSheetClose = ()=>this.setState({noticeOpen:null});
      }
    }
    // 5つを等幅で並べる（真ん中が＋）。アイランド型なので幅は固定せず分け合う
    const navItem=(active)=>({display:'flex',flex:1,flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',color:active?'var(--ink)':'var(--ink-faint)',transition:'color .2s'});
    v.navCalStyle = navItem(st.screen==='month');
    v.navFreeStyle = navItem(st.screen==='free');
    v.navReportStyle = navItem(st.screen==='report');
    v.navSettingsStyle = navItem(st.screen==='settings');

    // ---------- SETTINGS ----------
    const cfg=st.settings;
    v.settingsShown = st.screen==='settings';
    // 時給の入力は設定から外した。時給はバイト先ごとに決める。
    // settings.hourly は、バイト先を選んでいない昔の予定のための控えとして残してある。
    const segCell=(sel)=>({flex:1,textAlign:'center',padding:'8px 0',borderRadius:7,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',transition:'all .2s cubic-bezier(.2,.9,.2,1)',background:sel?'var(--card)':'transparent',color:sel?'var(--ink)':'var(--ink-mut)',border:sel?'1px solid var(--line)':'1px solid transparent'});
    v.weekSeg=[[0,'日曜日'],[1,'月曜日']].map(([n,label])=>({ label, sel:cfg.weekStart===n, onClick:()=>this.setSetting('weekStart',n), style:segCell(cfg.weekStart===n) }));
    v.typeRows = st.types.map((t,i)=>({
      name:t.name, open: st.editTypeKey===t.key, hint: st.editTypeKey===t.key?'':'名前と色',
      rowStyle:{borderBottom:'1px solid var(--line)'},
      dotStyle:{width:18,height:18,borderRadius:12,background:t.color,flexShrink:0,boxShadow:'inset 0 0 0 1px rgba(0,0,0,.06)'},
      onTap:()=>this.setState(s=>({editTypeKey:s.editTypeKey===t.key?null:t.key})),
      onName:(e)=>this.renameType(t.key, e.target.value),
      usedCount: st.events.filter(e=>e.type===t.key).length,
      swatches:this.PAL.map(hex=>({ style:{width:26,height:26,borderRadius:13,background:hex,cursor:'pointer',boxShadow: t.color===hex?'0 0 0 2px #fff, 0 0 0 4px '+hex:'inset 0 0 0 1px rgba(0,0,0,.08)'}, onClick:()=>this.recolorKey(t.key,hex) })),
    }));
    // ---------- 月表示の年月えらび ----------
    {
      const sh = st.ymSheet;
      v.ymSheetShown = !!sh;
      if(sh){
        const sy = sh.y;
        v.ymSheetYear = String(sy);
        v.onYmSheetClose = ()=>this.setState({ymSheet:null});
        const shiftYear=(d)=>this.setState(s=>({ymSheet:{y:s.ymSheet.y+d, dir:d}}));
        v.onYmSheetPrevYear = ()=>{ tapLight(); shiftYear(-1); };
        v.onYmSheetNextYear = ()=>{ tapLight(); shiftYear(1); };
        // 月の並びを横に払っても年が変わる。‹ › の的が小さいので、
        // 空き状況の一覧と同じ「離したときに切り替える」やり方に合わせる。
        v.onYmSheetTouchStart = (e)=>{ const t=e.touches&&e.touches[0]; if(!t) return;
          this._ysx=t.clientX; this._ysy=t.clientY; this._yAxis=null; };
        v.onYmSheetTouchMove = (e)=>{ const t=e.touches&&e.touches[0]; if(!t||this._ysx==null) return;
          const dx=t.clientX-this._ysx, dy=t.clientY-this._ysy;
          if(!this._yAxis){
            if(Math.abs(dx)<8 && Math.abs(dy)<8) return;
            this._yAxis = Math.abs(dx)>Math.abs(dy)*1.2 ? 'x' : 'y';
          } };
        v.onYmSheetTouchEnd = (e)=>{ const t=e.changedTouches&&e.changedTouches[0];
          const wasX=this._yAxis==='x', sx=this._ysx;
          this._ysx=null; this._yAxis=null;
          if(!t||!wasX||sx==null) return;
          const dx=t.clientX-sx;
          if(Math.abs(dx)<60) return;   // 浅い払いでは動かさない
          tapLight(); shiftYear(dx<0 ? 1 : -1); };
        // 年が変わるたびに key も変えて、滑り込みをやり直させる
        v.ymSheetGridKey = String(sy);
        v.ymSheetGridStyle = {display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8,
          touchAction:'pan-y',
          animation: sh.dir ? (sh.dir>0?'slideFromRight':'slideFromLeft')+' .24s cubic-bezier(.2,.9,.2,1)' : 'none'};
        const t=st.today;
        v.onYmSheetToday = ()=>{ tapLight(); this.setState({ym:{y:t.y,m:t.m}, dayNum:null, ymSheet:null}); };
        v.ymSheetTodayLabel = `今月（${t.y}年${t.m+1}月）`;
        v.ymSheetMonths = Array.from({length:12},(_,i)=>{
          const sel = sy===st.ym.y && i===st.ym.m;
          const isThis = sy===t.y && i===t.m;
          return { label:(i+1)+'月',
            onClick:()=>{ tapLight(); this.setState({ym:{y:sy,m:i}, dayNum:null, ymSheet:null}); },
            style:{padding:'13px 0',textAlign:'center',borderRadius:12,fontSize:15,cursor:'pointer',
              fontWeight:sel?700:500, transition:'all .18s',
              background: sel?'var(--ink)':'var(--card)',
              color: sel?'var(--card)':'var(--ink-soft)',
              border:'1px solid '+(sel?'var(--ink)':(isThis?'var(--ink-faint)':'var(--line)'))} };
        });
      }
    }

    v.onAddTypeRow = ()=>{ tapLight(); this.setState(s=>({newType: s.newType?null:{name:'',color:'#2F72C4'}, editTypeKey:null})); };
    // 種類は増えていくもの。ぜんぶ並べると、それだけで設定画面が埋まる。
    // ふだんはたたんで、色の点だけ出しておく（何があるかは点で分かる）。
    v.typeListOpen = !!st.typeListOpen;
    v.onToggleTypeList = ()=>{ tapLight(); this.setState(s=>({typeListOpen:!s.typeListOpen,
      editTypeKey:null, newType:null})); };
    v.typeCountLabel = st.types.length+'つ';
    v.typeDots = st.types.slice(0,8).map(t=>({
      style:{width:13,height:13,borderRadius:7,background:t.color,flexShrink:0,
        boxShadow:'inset 0 0 0 1px rgba(0,0,0,.06)'} }));
    v.typeMoreLabel = st.types.length>8 ? '+'+(st.types.length-8) : '';
    const tgTrack=(on,col)=>({width:44,height:26,borderRadius:13,background:on?'var(--ink)':'var(--line)',padding:2,transition:'background .28s cubic-bezier(.2,.9,.2,1)',cursor:'pointer',display:'flex',flexShrink:0});
    const tgKnob=(on)=>({width:22,height:22,borderRadius:11,background:'var(--card)',boxShadow:'0 1px 2px rgba(0,0,0,.25)',transition:'transform .28s cubic-bezier(.2,.9,.2,1)',transform:on?'translateX(18px)':'translateX(0)'});
    v.remindTrack=tgTrack(cfg.remind); v.remindKnob=tgKnob(cfg.remind);
    v.darkTrack=tgTrack(cfg.dark); v.darkKnob=tgKnob(cfg.dark); v.onToggleDark=()=>this.setSetting('dark',!cfg.dark);
    v.onToggleRemind=()=>this.setSetting('remind',!cfg.remind);
    v.hideTrack=tgTrack(cfg.hideCanceled,'#5A6570'); v.hideKnob=tgKnob(cfg.hideCanceled);
    v.onToggleHide=()=>this.setSetting('hideCanceled',!cfg.hideCanceled);

    // ---------- まとめカードのプレビュー ----------
    // 月のぶんと年のぶんの2枚。どちらを開いたかは cardKind で決まる。
    // 画面に出す値は sharecard.js に渡すものと同じ形にしてある——
    // プレビューと書き出した画像がずれると、見て決めた意味がなくなる。
    v.summaryShown = st.screen==='summary';
    v.shareToast = st.shareToast;
    v.shareToastMsg = st.shareMsg || '';
    if(v.summaryShown){
      const Y=st.ym.y, M=st.ym.m;
      const isYear = st.cardKind==='year';
      v.cardIsYear = isYear;
      const done = st.events.filter(e=>e.status==='jisseki' && e.type==='baito' && e.y===Y && (isYear || e.m===M));
      const wageSum = Math.round(done.reduce((a,e)=>a+this.wage(e),0));
      const hourSum = done.reduce((a,e)=>a+this.paidHours(e),0);
      v.cardTitle = isYear ? '今年のまとめ' : '今月のまとめ';
      v.cardWhen = isYear ? Y+'年' : Y+'年 '+(M+1)+'月';
      v.cardWageParts = this.splitWage(wageSum);
      v.cardSub = isYear
        ? 'およそ　'+this.fmtHours(hourSum)
        : 'およそ　'+this.fmtHours(hourSum)+'・'+done.length+'日';
      v.cardJobs = this._jobBreakdown(done);
      v.cardEmpty = done.length===0;
      // カードはバイト先の数だけ背が伸びる（sharecard.js と同じ式）。
      // プレビューだけ寸法が変わらないと、見て決めたものと書き出したものが食い違う。
      {
        const n = v.cardJobs.length;
        v.cardAspect = isYear
          ? '1080/'+(1440 + (this.priorFor(Y)?44:0) + Math.max(0, n-2)*116)
          : '1080/'+(680 + Math.max(0, n-2)*88);
      }
      // 年のカードだけ、月ごとの棒を出す
      if(isYear){
        const per = Array.from({length:12},(_,i)=>done.filter(e=>e.m===i).reduce((a,e)=>a+this.paidHours(e),0));
        const peak = Math.max(1, ...per);
        v.cardBars = per.map((h,i)=>({
          label:i+1,
          top: h>0 ? (h===peak ? (h>=10?Math.round(h):Math.round(h*10)/10)+'h' : '') : '',
          style:{ flex:1, height: h>0 ? Math.max(4, Math.round(h/peak*72))+'px' : '3px',
            borderRadius: h>0 ? '4px' : '2px',
            background: h>0 ? (h===peak ? '#7FAE85' : '#CEE0D1') : '#EDEFF3' },
        }));
      }
      v.cardPng = st.cardPng || '';
      v.onShareCard = ()=>this._shareCard(isYear ? 'year' : 'summary');
    }

    // ---------- まとめ（時間の内訳） ----------
    v.reportShown = st.screen==='report';
    if(v.reportShown){
      const Y=st.ym.y, M=st.ym.m;
      // 数えるのは確定と実績。未確定はまだ起きていない。無くなったものは無かった
      // 「まとめに入れない」と付けたものは、確定でも数えない（誕生日・祝日などの、本人の予定ではないもの）
      const spent = st.events.filter(e=>(e.status==='kakutei'||e.status==='jisseki') && !e.noReport);
      const moK = this._timeBreakdown(spent.filter(e=>e.y===Y && e.m===M));
      const yrK = this._timeBreakdown(spent.filter(e=>e.y===Y));
      const tot = (ks)=>ks.reduce((a,k)=>({hours:a.hours+k.hours, days:a.days+k.days, times:a.times+k.times}),{hours:0,days:0,times:0});
      const tm = tot(moK), ty = tot(yrK);
      v.repMonthLabel = (M+1)+'月';
      v.repYearLabel = Y+'年';
      v.repEmpty = spent.length===0;
      // 月と年でタブを分ける。1枚に全部並べると、バイトの人は 2.5 画面ぶんになる
      v.repTab = st.repTab || 'month';
      const segCell=(sel)=>({flex:1,textAlign:'center',padding:'8px 0',borderRadius:11,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',transition:'all .2s cubic-bezier(.2,.9,.2,1)',background:sel?'var(--card)':'transparent',color:sel?'var(--ink)':'var(--ink-mut)',border:sel?'1px solid var(--line)':'1px solid transparent'});
      v.repSeg = [['month','月'],['year','年']].map(([key,label])=>({ label, style:segCell(v.repTab===key),
        onClick:()=>{ tapLight(); this.setState({repTab:key}); } }));
      const shiftMonth=(d)=>this.setState(s=>{ let m=s.ym.m+d, y=s.ym.y; if(m<0){m=11;y-=1;} if(m>11){m=0;y+=1;} return {ym:{y,m}}; });
      v.onRepPrevMonth = ()=>shiftMonth(-1);
      v.onRepNextMonth = ()=>shiftMonth(1);
      v.repMonthKinds = moK;
      v.repYearKinds = yrK;
      v.repMonthNone = moK.length===0;
      v.repMonthHead = this._spentHead(tm.hours, tm.days);
      v.repMonthSub = tm.times+'件の予定';
      v.repYearHead = this._spentHead(ty.hours, ty.days);
      v.repYearSub = ty.times+'件の予定';
      // 月ごとの棒。今年の12ヶ月ぶん。働いた時間ではなく、全部の時間
      const perMonth = Array.from({length:12},(_,i)=>spent.filter(e=>e.y===Y && e.m===i).reduce((a,e)=>a+this.spentHours(e),0));
      const peak = Math.max(1, ...perMonth);
      v.repBars = perMonth.map((h,i)=>({
        label: (i+1),
        hours: h,
        isCur: i===M,
        barStyle:{ height: Math.max(3, Math.round(h/peak*74))+'px', borderRadius:4, background: i===M?'var(--ink)':(h>0?'var(--ink-faint)':'var(--line)'), transition:'height .3s cubic-bezier(.2,.9,.2,1)' },
        labelStyle:{ fontSize:9, marginTop:5, color: i===M?'var(--ink)':'var(--ink-faint)', fontWeight:i===M?700:500 },
        onClick:()=>this.setState({ym:{y:Y,m:i}, repTab:'month'}),
      }));

      // ---- 給料。バイトの実績がその年に1件でもあるときだけ。無い人には金の話は要らない ----
      const doneAll = st.events.filter(e=>e.status==='jisseki' && e.type==='baito' && !e.noReport);
      v.repWageShown = doneAll.some(e=>e.y===Y && e.type==='baito');
      const sum=(list)=>{
        const hours=list.reduce((a,e)=>a+this.paidHours(e),0);
        const wage=list.reduce((a,e)=>a+this.wage(e),0);
        return { hours, wage, days:list.length };
      };
      const mo = sum(doneAll.filter(e=>e.y===Y && e.m===M));
      const yr = sum(doneAll.filter(e=>e.y===Y));
      v.repMonthHours = this.fmtHours(mo.hours);
      v.repMonthWage = this.fmtWage(mo.wage);
      v.repMonthWageParts = this.splitWage(mo.wage);
      v.repMonthDays = String(mo.days);
      v.repYearHours = this.fmtHours(yr.hours);
      const prior = this.priorFor(Y);
      v.repYearWage = this.fmtWage(yr.wage + prior);
      v.repYearWageParts = this.splitWage(yr.wage + prior);
      // 足したことは必ず書く。書かないと、時間と金額が合わない理由が誰にも分からない
      v.repPriorText = prior
        ? 'うち '+this.fmtWage(prior)+' は使い始める前の分として手で入れた額で、時間と日数には入っていません。'
        : '';
      v.repPriorLabel = prior ? this.fmtWage(prior) : '未設定';
      v.repPriorHint = Y+'年の、記録を始める前に稼いだぶん';
      v.repPriorValue = prior ? String(prior) : '';
      v.repPriorOpen = !!st.priorOpen;
      v.onTogglePrior = ()=>{ tapLight(); this.setState(s=>({priorOpen:!s.priorOpen})); };
      v.onPriorChange = (e)=>{ const n=parseInt((e.target.value||'').replace(/[^0-9]/g,'').slice(0,8),10);
        this.setPrior(Y, isNaN(n)?0:n); };
      v.repYearDays = String(yr.days);
      // バイト先ごとの内訳。今月と今年、どちらも出す
      v.repMonthJobs = this._jobBreakdown(doneAll.filter(e=>e.y===Y && e.m===M));
      v.repYearJobs = this._jobBreakdown(doneAll.filter(e=>e.y===Y));
      // ---- 予定より延びた時間（残業） ----
      // 働いた記録には、予定の終わりと実際の終わりが両方ある。延びたぶんを足して見せる
      { const over=(list)=>{ let m=0, n=0; for(const e of list){ if(!e.actualEnd || e.allDay) continue;
          const plan=((this.mins(e.end)-this.mins(e.start))+1440)%1440, act=((this.mins(e.actualEnd)-this.mins(e.start))+1440)%1440;
          if(act>plan){ m+=act-plan; n++; } } return {m,n}; };
        const done=st.events.filter(e=>e.status==='jisseki' && (e.type==='baito'||e.type==='work'));
        const om=over(done.filter(e=>e.y===Y && e.m===M)), oy=over(done.filter(e=>e.y===Y));
        v.repOverMonth = om.n ? `予定より延びた時間 ${this.fmtHours(om.m/60)}（${om.n}回）` : '';
        v.repOverYear = oy.n ? `予定より延びた時間 ${this.fmtHours(oy.m/60)}（${oy.n}回）` : ''; }
      // ---- 有給の残り ----
      { const ls=this.leaveSummary(); v.repLeave = ls ? ls.short : ''; }
      // ---- 締め日と給料日で数えた給料 ----
      // 勤務先に締め日があれば「10月25日に入る分（9/16〜10/15）」のように、給料日ごとに数える
      v.repPayRows = (st.jobs||[]).filter(j=>j.closeDay).map(j=>{
        const c=j.closeDay, p=j.payDay||0;
        const endD = c>=31 ? new Date(Y,M+1,0) : new Date(Y,M,c);
        const startD = c>=31 ? new Date(Y,M,1) : new Date(Y,M-1,c+1);
        const a=dayNo(startD.getFullYear(),startD.getMonth(),startD.getDate()), b=dayNo(endD.getFullYear(),endD.getMonth(),endD.getDate());
        const list=st.events.filter(e=>e.jobId===j.id && e.status==='jisseki' && evFrom(e)>=a && evFrom(e)<=b);
        const wage=Math.round(list.reduce((x,e)=>x+this.wage(e),0));
        let head=`${endD.getMonth()+1}/${endD.getDate()}締め`;
        if(p){ const payM = (p>c && c<31) ? endD.getMonth() : endD.getMonth()+1; // 月末払い（31）は payM の月の末日。day 0 は前の月の末日になるので、1つ先の月の 0 日で取る
          const pd = p>=31 ? new Date(endD.getFullYear(), payM+1, 0) : new Date(endD.getFullYear(), payM, p);
          head=`${pd.getMonth()+1}月${pd.getDate()}日に入る分`; }
        return { name:j.name||'（名前なし）', head, range:`${startD.getMonth()+1}/${startD.getDate()}〜${endD.getMonth()+1}/${endD.getDate()}`, wage:this.fmtWage(wage), times:list.length };
      });
      v.onRepPrevYear = ()=>this.setState(s=>({ym:{y:s.ym.y-1,m:s.ym.m}}));
      v.onRepNextYear = ()=>this.setState(s=>({ym:{y:s.ym.y+1,m:s.ym.m}}));
      // カードは月のぶんと年のぶん。開くところが違うだけで、画面は同じ
      // cardFrom を渡さないと、前に開いた画面（空き状況など）の値が残っていて、
      // 閉じたときに違う画面へ戻る。
      v.onOpenMonthCard = ()=>{ tapLight(); this.setState({screen:'summary', shareToast:false, cardKind:'month', cardFrom:'report'}); };
      v.onOpenYearCard = ()=>{ tapLight(); this.setState({screen:'summary', shareToast:false, cardKind:'year', cardFrom:'report'}); };
    }

    // ---------- これから・まだ・探す ----------
    // 月表示は「その日に何があるか」には答えるが、「この先に何があるか」を並べて見る所が無かった。
    // 先の予定を見るには1日ずつ開くしかなかった。ここで並べる
    v.listShown = st.screen==='list';
    {
      const todayN = dayNo(st.today.y, st.today.m, st.today.d);
      const alive = st.events.filter(e=>e.status!=='nakunatta');
      const und = alive.filter(e=>e.status==='mikakutei');
      v.undecidedCount = und.filter(e=>evTo(e)>=todayN).length + (st.someday||[]).length;
      v.onOpenAgenda = ()=>{ tapLight(); this.setState({screen:'list', listTab:'upcoming', returnTo:'month'}); };
      v.onOpenUndecided = ()=>{ tapLight(); this.setState({screen:'list', listTab:'undecided', returnTo:'month'}); };
      v.onOpenSearch = ()=>{ tapLight(); this.setState({screen:'list', listTab:'search', returnTo:'month'}); };
      if(v.listShown){
        const tab = st.listTab || 'upcoming';
        v.listTab = tab;
        const segCell=(sel)=>({flex:1,textAlign:'center',padding:'8px 0',borderRadius:11,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',background:sel?'var(--card)':'transparent',color:sel?'var(--ink)':'var(--ink-mut)',border:sel?'1px solid var(--line)':'1px solid transparent'});
        v.listSeg = [['upcoming','これから'],['undecided','まだ'],['search','探す']].map(([k,label])=>({ label: k==='undecided' && v.undecidedCount ? `まだ ${v.undecidedCount}` : label,
          style:segCell(tab===k), onClick:()=>{ tapLight(); this.setState({listTab:k}); } }));
        v.onListBack = ()=>this.setState({screen:'month'});
        const DW=['日','月','火','水','木','金','土'];
        const rowOf=(e)=>{
          const t=this.T(e.type);
          const pill = e.status==='mikakutei'
            ? {background:this.paperShow(t.paper), color:this.inkDash(t.color), border:'1.5px dashed '+this.softLine(t.color)}
            : {background:this.softFill(t.color), color:this.inkOn(t.color), border:'1.5px solid transparent'};
          const end = e.status==='jisseki' ? (e.actualEnd||e.end) : e.end;
          return { key:e.id, title:e.title, place:e.place||'',
            date:`${e.m+1}/${e.day}`, dow:DW[new Date(e.y,e.m,e.day).getDay()],
            time: e.allDay ? (evSpan(e)>1 ? this.spanLabel(e) : '終日') : e.start+'–'+end,
            dashed: e.status==='mikakutei', word:this.statusWord(e),
            pillStyle:{...pill, borderRadius:6, padding:'2px 8px', fontSize:14, lineHeight:'20px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%', display:'inline-block'},
            onClick:()=>this.openFor(e,'list'),
            onYes: e.status==='mikakutei' ? ()=>this.openDialog(e,'confirm','list') : null,
            onGone: e.status==='mikakutei' ? ()=>{ tapLight(); const prev={status:e.status}; this.updateEvent(e.id,{status:'nakunatta'}); this.showUndo(`「${e.title}」を${t.gone||'無くなった'}にしました`, {kind:'status', id:e.id, prev}); } : null,
            goneLabel: t.gone || '無くなった' };
        };
        const sortD=(a,b)=>(evFrom(a)-evFrom(b)) || ((a.allDay?0:1)-(b.allDay?0:1)) || (this.mins(a.start)-this.mins(b.start));
        // 見出し：今日・明日・今週・来週・それより先は月ごと
        const ws=st.settings.weekStart;
        const wk0 = todayN - ((new Date(st.today.y,st.today.m,st.today.d).getDay()-ws+7)%7);
        const headOf=(n)=>{ if(n<todayN) return '過ぎた日'; if(n===todayN) return '今日'; if(n===todayN+1) return '明日';
          if(n<wk0+7) return '今週'; if(n<wk0+14) return '来週'; const o=fromDayNo(n); return (o.y!==st.today.y?o.y+'年':'')+(o.m+1)+'月'; };
        const group=(list)=>{ const out=[]; for(const e of list){ const h=headOf(Math.max(evFrom(e), evFrom(e)<todayN && evTo(e)>=todayN ? todayN : evFrom(e)));
            const last=out[out.length-1]; if(last && last.head===h) last.rows.push(rowOf(e)); else out.push({head:h, rows:[rowOf(e)]}); } return out; };
        if(tab==='upcoming'){
          const onlyDash=!!st.listDashOnly;
          const list=alive.filter(e=>evTo(e)>=todayN && (!onlyDash || e.status==='mikakutei')).sort(sortD).slice(0,150);
          v.listGroups = group(list);
          v.listEmpty = list.length===0 ? 'この先の予定はまだありません' : '';
          v.listDashOnly = onlyDash;
          v.onToggleDashOnly = ()=>{ tapLight(); this.setState(s=>({listDashOnly:!s.listDashOnly})); };
        } else if(tab==='undecided'){
          // 過ぎた日で点線のままのもの（どうなったか分からないまま）も、上にまとめて出す
          const past=und.filter(e=>evTo(e)<todayN).sort(sortD).reverse().slice(0,30);
          const next=und.filter(e=>evTo(e)>=todayN).sort(sortD);
          v.listGroups = [...(past.length?[{head:'日が過ぎて、まだ点線のまま', rows:past.map(rowOf)}]:[]), ...group(next)];
          v.listEmpty = (past.length+next.length+(st.someday||[]).length)===0 ? 'まだ決まっていない予定はありません' : '';
          v.listShelf = (st.someday||[]).map(it=>({ key:it.id, title:it.title, when:SOMEDAY_LABEL[it.when],
            onPick:()=>{ tapLight(); this.setState({somedayPick:{id:it.id, y:st.today.y, m:st.today.m}}); },
            onDrop:()=>this.dropSomeday(it.id), dot:this.T(it.type).color }));
        } else {
          const q=(st.searchQ||'').trim().toLowerCase();
          v.searchQ = st.searchQ||'';
          v.onSearchQ = (e)=>this.setState({searchQ:e.target.value});
          if(q){
            const hit=st.events.filter(e=>[e.title,e.place,e.memo].some(x=>String(x||'').toLowerCase().includes(q)));
            const fut=hit.filter(e=>evTo(e)>=todayN).sort(sortD);
            const past=hit.filter(e=>evTo(e)<todayN).sort(sortD).reverse();
            v.listGroups=[...(fut.length?[{head:`これから ${fut.length}件`, rows:fut.slice(0,100).map(rowOf)}]:[]),
              ...(past.length?[{head:`過去 ${past.length}件`, rows:past.slice(0,100).map(rowOf)}]:[])];
            v.listEmpty = hit.length ? '' : '見つかりませんでした';
          } else { v.listGroups=[]; v.listEmpty='題名・場所・メモから探せます'; }
        }
      }
      // 日にち未定の棚：日を決める小さなカレンダー
      const sp=st.somedayPick;
      v.somedayPickShown = !!sp;
      if(sp){
        const it=(st.someday||[]).find(x=>x.id===sp.id);
        v.somedayPickTitle = it ? `「${it.title}」の日を決める` : '';
        v.onSomedayPickClose = ()=>this.setState({somedayPick:null});
        v.onSomedayPickPrev = ()=>this.setState(s=>{ const n=shiftMonth({y:sp.y,m:sp.m},-1); return {somedayPick:{...s.somedayPick,...n}}; });
        v.onSomedayPickNext = ()=>this.setState(s=>{ const n=shiftMonth({y:sp.y,m:sp.m},1); return {somedayPick:{...s.somedayPick,...n}}; });
        v.somedayPickLabel = `${sp.y}年${sp.m+1}月`;
        const mws=st.settings.weekStart, DW=['日','月','火','水','木','金','土'];
        v.somedayPickWeekdays = Array.from({length:7},(_,i)=>{ const dw=(i+mws)%7; return {label:DW[dw], style:{textAlign:'center',fontSize:10,fontWeight:600,padding:'4px 0',color:dw===0?HOLIDAY_RED:dw===6?SATURDAY_BLUE:'var(--ink-faint)'}}; });
        const first=(new Date(sp.y,sp.m,1).getDay()-mws+7)%7, dim=new Date(sp.y,sp.m+1,0).getDate();
        const cells=[]; for(let i=0;i<first;i++) cells.push({label:'',style:{height:34}});
        for(let d2=1;d2<=dim;d2++){ const dw2=new Date(sp.y,sp.m,d2).getDay(); const busy=st.events.some(e=>e.status!=='nakunatta' && evCovers(e,dayNo(sp.y,sp.m,d2)));
          cells.push({label:d2, onClick:()=>this.placeSomeday(sp.id, sp.y, sp.m, d2),
            style:{height:34,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderRadius:11,cursor:'pointer',fontSize:14,fontVariantNumeric:'tabular-nums',
              color:(holidayName(sp.y,sp.m,d2)||dw2===0)?HOLIDAY_RED:dw2===6?SATURDAY_BLUE:'var(--ink-soft)', background: busy?'var(--bg2)':'transparent'}}); }
        v.somedayPickCells = cells;
      }
      // 月表示の上の棚：いま見ている月にかかる「日にち未定」の予定
      const ym=st.ym;
      const shelf=(st.someday||[]).filter(it=>{
        if(it.when==='someday') return ym.y===st.today.y && ym.m===st.today.m;
        const base = it.when==='next' ? shiftMonth({y:it.y,m:it.m},1) : {y:it.y,m:it.m};
        return base.y===ym.y && base.m===ym.m;
      });
      v.shelfCount = shelf.length;
      v.shelfLabel = shelf.length ? (shelf.length===1 ? `${SOMEDAY_LABEL[shelf[0].when]}：${shelf[0].title}` : `日にち未定 ${shelf.length}件`) : '';
      v.onOpenShelf = ()=>{ tapLight(); this.setState({screen:'list', listTab:'undecided', returnTo:'month'}); };
    }

    // ---------- 空いてる日シェア (C) ----------
    v.shareShown = st.screen==='share';

    // ---------- 知らせのひとこと ----------
    // これまで、まとめ／空きシェアの画面の中にしか置いていなかった。
    // 控えから戻すと月表示に移るので、予定が丸ごと置き換わったのに何も出ていなかった。
    // 取り返しのつかない操作こそ、済んだことを言う。
    v.toastShown = !!st.shareToast && !v.summaryShown && !v.shareShown;
    v.toastMsg = st.shareMsg || '';
    // ナビの島に隠れない高さに置く
    v.toastBottom = v.navShown ? 96 : 30;
    // 開くときのロック。確かめ終わるまで中身を隠す
    v.lockedShown = !!st.locked;
    v.onUnlock = ()=>this.unlock();
    v.lockLabel = this._lockLabel || 'Face ID';
    // 取り消しの帯
    v.undoShown = !!st.undo;
    if(st.undo){ v.undoText=st.undo.text; v.undoKey=st.undo.key; v.onUndo=()=>this.undoLast(); v.undoBottom = v.navShown ? 96 : 24; }
    // 候補日の片づけ
    v.candAskShown = !!st.candAsk;
    if(st.candAsk){
      const n=st.candAsk.ids.length;
      v.candAskTitle = `「${st.candAsk.title}」が決まりました`;
      v.candAskBody = `同じ予定の、ほかの候補が${n}件あります。片づけると「無くなった」になります（あとから戻せます）。`;
      v.candAskYes = `ほかの候補${n}件を片づける`;
      v.onCandYes = ()=>this.settleCandidates(true);
      v.onCandNo = ()=>this.settleCandidates(false);
    }
    // ---------- 空いてる日を送る（画像と文字） ----------
    // 画像も文字も、空き状況と同じ判定（手で直した ○△× も入る）。月は「空き状況で見ている月」。
    // 前は、画像だけ別の判定（確定の予定が1件でもあれば灰色）で、見ている月もカレンダーの月だった
    if(v.shareShown){
      const swl=['日','月','火','水','木','金','土'];
      const sws=cfg.weekStart;
      const so=this.shareOpt();
      const shY=st.freeYM.y, shM=st.freeYM.m;
      v.shareWeekdays = Array.from({length:7},(_,i)=>{ const dw=(i+sws)%7; return { label:swl[dw], style:{textAlign:'center',fontSize:10,fontWeight:600,color:'#B0B4BB'} }; });
      v.shareMonthLabel = String(shM+1);
      const W=this.freeWords(so);
      v.shareLead = W.lead; v.shareTitle = W.title(shM+1); v.shareLegend = W.legend;
      v.shareCells = this.freeCells(shY, shM).map(c=>({ label:c.label, note:c.note,
        style: !c.label ? {} : c.level==='busy' ? { height:38,borderRadius:7,background:'#EDEEF0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:12,color:'#C1C5CC' }
          : c.level==='past' ? { height:38,borderRadius:7,background:'#F6F6F4',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:12,color:'#D9DBDF' }
          : c.level==='part' ? { height:38,borderRadius:7,background:'#FFFDF8',border:'1.5px dashed #D85A30',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#712B13',lineHeight:1.1 }
          : { height:38,borderRadius:7,background:'#FAECE7',border:'1.5px solid #D85A30',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#712B13' } }));
      // 送り方えらび
      const chip=(sel)=>({padding:'7px 12px',borderRadius:999,fontSize:12.5,cursor:'pointer',whiteSpace:'nowrap',
        background: sel?'#fff':'rgba(255,255,255,.08)', color: sel?'#1A1A1A':'rgba(255,255,255,.75)', border:'1px solid '+(sel?'#fff':'rgba(255,255,255,.18)')});
      const set=(k,val)=>()=>{ tapLight(); this.setState(s=>({shareOpt:{...this.shareOpt(s), [k]:val}})); };
      v.shareRangeChips=[['week','今週'],['next','来週'],['2w','2週間'],['month',`${shM+1}月`]].map(([k,label])=>({label, style:chip(so.range===k), onClick:set('range',k)}));
      v.shareOnlyChips=[['all','すべて'],['wd','平日だけ'],['hd','休日だけ']].map(([k,label])=>({label, style:chip(so.only===k), onClick:set('only',k)}));
      v.shareToneChips=[[false,'ふつう'],[true,'ていねい']].map(([k,label])=>({label, style:chip(so.polite===k), onClick:set('polite',k)}));
      v.shareName = so.name||'';
      v.onShareName = (e)=>{ const val=e.target.value.slice(0,16); this.setState(s=>({shareOpt:{...this.shareOpt(s), name:val}})); };
      v.shareText = this.freeTextBlock(so);
      v.onCopyFreeText = async ()=>{ tapLight(); const msg=await copyText(this.freeTextBlock(this.shareOpt())); if(msg) this.toast(msg); this.maybeAskReview('share'); };
      v.shareSign = !!so.sign;
      v.onToggleShareSign = set('sign', !so.sign);
    }

    v.wageToggleShown = this.wageFeatureOn();
    // ---- シフト入力 ----
    { const tpls=this.stampTemplates();
      v.stampChipShown = tpls.length>0 && st.screen==='month';
      v.stampOn = !!st.stamp;
      v.onToggleStamp = ()=>this.toggleStamp();
      if(st.stamp){
        v.stampTpls = tpls.map(t=>{ const sel=st.stamp.key===t.key;
          return { key:t.key, label:`${t.sym} ${t.name||''}`.trim(), sub: t.allDay ? '休み' : this.fmtMin(t.from%1440)+'–'+this.fmtMin(t.to%1440),
            onClick:()=>{ tapLight(); this.setState(s=>({stamp:{...s.stamp, key:t.key}})); },
            style:{padding:'8px 12px',borderRadius:12,cursor:'pointer',flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:1,
              background:sel?'var(--ink)':'var(--card)', color:sel?'var(--card)':'var(--ink)', border:'1px solid '+(sel?'var(--ink)':'var(--line)')} }; });
        const segs=(sel)=>({flex:1,textAlign:'center',padding:'6px 0',borderRadius:8,fontSize:12.5,fontWeight:sel?700:500,cursor:'pointer',whiteSpace:'nowrap',
          background:sel?'var(--card)':'transparent',color:sel?'var(--ink)':'var(--ink-mut)',border:sel?'1px solid var(--line)':'1px solid transparent'});
        v.stampSeg=[['kakutei','決まってる'],['mikakutei','希望（点線）']].map(([k,label])=>({label, style:segs(st.stamp.status===k), onClick:()=>{ tapLight(); this.setState(s=>({stamp:{...s.stamp,status:k}})); }}));
        v.onConfirmMonthShifts = ()=>this.confirmMonthShifts();
        v.stampMonthLabel = `${st.ym.m+1}月の希望をまとめて確定`;
      } }
    // 今月以外を見ているときだけ出す「今日」
    v.todayBtnShown = !(st.ym.y===st.today.y && st.ym.m===st.today.m);
    v.onGoToday = ()=>this.goToday();
    v.wageTrackStyle = { width:44,height:26,borderRadius:13,background:wageOn?'var(--ink)':'var(--line)',padding:2,transition:'background .28s cubic-bezier(.2,.9,.2,1)',cursor:'pointer',display:'flex' };
    v.wageKnobStyle = { width:22,height:22,borderRadius:11,background:'var(--card)',boxShadow:'0 1px 2px rgba(0,0,0,.25)',transition:'transform .28s cubic-bezier(.2,.9,.2,1)',transform:wageOn?'translateX(18px)':'translateX(0)' };

    const ws=st.settings.weekStart;
    const wlRot=Array.from({length:7},(_,i)=>{ const dw=(i+ws)%7; return {label:wl[dw], dw}; });
    v.weekdays = wlRot.map(({label,dw})=>({ label, style:{textAlign:'center',fontSize:11,fontWeight:600,padding:'6px 0',
      color: dw===0 ? HOLIDAY_RED : dw===6 ? SATURDAY_BLUE : '#9AA0A6'} }));

    // month — 前後の月も一緒に作る（スワイプで指についてくるように並べるため）
    const Y=st.ym.y, M=st.ym.m;
    const rawFirst=new Date(Y,M,1).getDay();
    // 週ごとに組む。日をまたぐ予定を1本の帯にするには、
    // マスの中にピルを積むのではなく、週の中で列をまたがせる必要がある。
    const buildWeeks=(Y,M)=>{
      const wFirst=new Date(Y,M,1).getDay(), dim=new Date(Y,M+1,0).getDate();
      const today=(st.today.y===Y && st.today.m===M) ? st.today.d : 0;
      const first=(wFirst-ws+7)%7;
      const weekCount=Math.ceil((first+dim)/7);
      const monthA=dayNo(Y,M,1), monthB=dayNo(Y,M,dim);
      // 1週に積める段。前は4段で決め打ちで、大きい画面ではマスの下半分が白いまま「+N件」になっていた。
      // 画面の高さから入る段数を計算する（4〜7段）
      const padB = parseInt(this.state.wageOn ? 168 : 104, 10);
      const rowH = this._monthH ? (this._monthH - padB) / weekCount : 0;
      const laneH = Math.round(MONTH_BAR_H*this.evScale()) + 2;
      // 入るぶんだけ積む（2〜7段）。前は最低4段で、予定の字を大きくした6週の月（11月など）は
      // マスが画面より高くなり、いちばん下の週がナビの下に隠れていた。入らない予定は「+N件」
      const lanesN = rowH ? Math.max(2, Math.min(7, Math.floor((rowH - 22 - 14) / laneH))) : MAX_LANES;
      // この月にかかる予定だけを相手にする。日またぎは前の月から始まっていることもある。
      const pool=st.events.filter(e=>
        !(st.settings.hideCanceled && e.status==='nakunatta') &&
        evTo(e)>=monthA && evFrom(e)<=monthB);
      // 夜勤の「明け〜」は、月のマスには出さない。0:30 まで働いた日の翌日にも「明け〜0:30」が出て、
      // 予定が2つあるように見えて邪魔だった（予定は始まった日のマスに1本だけ）。
      // 明けの朝がふさがっていることは、空き状況（dayFree）と週・日の「時間」表示で分かる
      // 重ねて表示している iPhone のカレンダーの予定（保存はしない）
      for(const e of this._overlayFor(monthA, monthB+1)) pool.push(e);

      const weeks=[];
      for(let w=0; w<weekCount; w++){
        // この週の7マスに入る日。月の外は null
        const slotDays=Array.from({length:7},(_,i)=>{ const d=w*7+i-first+1; return (d>=1&&d<=dim)?d:null; });
        const real=slotDays.filter(d=>d!==null);
        const weekA=dayNo(Y,M,real[0]), weekB=dayNo(Y,M,real[real.length-1]);
        const colOf=(n)=>(n-monthA)+first-w*7; // 通し番号 → この週の何列目か

        // 長い帯から先に段を決める。同じ段に居続けるので、隣のマスと横一列につながる。
        const inWeek=pool.filter(e=>evTo(e)>=weekA && evFrom(e)<=weekB)
          .sort((a,b)=> (evSpan(b)-evSpan(a)) || (evFrom(a)-evFrom(b))
            || (this.mins(a.start)-this.mins(b.start)) || String(a.id).localeCompare(String(b.id)));

        const lanes=[]; const bars=[]; const overflow={};
        for(const ev of inWeek){
          const a=Math.max(evFrom(ev),weekA), b=Math.min(evTo(ev),weekB);
          let li=0;
          while(lanes[li] && lanes[li].some(r=>a<=r[1] && b>=r[0])) li++;
          if(li>=lanesN){ for(let n=a;n<=b;n++) overflow[n]=(overflow[n]||0)+1; continue; }
          (lanes[li]=lanes[li]||[]).push([a,b]);
          const c0=colOf(a), c1=colOf(b);
          const view=this.pillView(ev, wageOn, { startsHere:a===evFrom(ev), endsHere:b===evTo(ev) });
          // 帯はタップを受けない。マスの狙いにくい17pxの帯を正確に突くのではなく、
          // マスのどこを押してもその日の一覧が開き、そこから選んでもらう。
          // 日をまたぐ帯を押したときも、押した位置の下にあるマス＝その日が開く。
          bars.push({ key:ev.id+'-'+w, ...view,
            style:{...view.style, gridColumn:(c0+1)+' / span '+(c1-c0+1), gridRow:li+2, pointerEvents:'none', zIndex:1, cursor:'default'} });
        }

        // 日と日のあいだの細い縦線。地の層に引くので、日をまたぐ帯はこれを覆い隠す。
        // 「隙間から線が見える＝切れている」「線が隠れている＝続いている」を、
        // 文字の幅を一切削らずに成り立たせる。
        // 週の区切り（--line）より一段薄い --line-faint を使う。
        // 1px より細くは描けない（DPR 2/3 でも 0.8px に丸められる）ので、細さは色で作る。
        const colLine=(i)=>i<6?{borderRight:'1px solid var(--line-faint)'}:{};
        const slots=slotDays.map((d,i)=>{
          // 前後の月のマスに面は敷かない（情報がゼロなのに罫線より主張していた）。
          // ただし日付は薄く出す。月の切れ目が分かり、週の並びも読みやすくなる。
          if(d===null){
            const out=fromDayNo(monthA + (w*7 + i - first));
            return { blank:true, day:out.d,
              bgStyle:{background:'var(--card)',...colLine(i)},
              numWrap:{gridColumn:i+1, gridRow:1, lineHeight:'20px', paddingLeft:3, alignSelf:'center'},
              numStyle:{fontSize:11, fontWeight:500, color:'var(--ink-faint)'},
              onDay:()=>{} };
          }
          const dow=(wFirst+d-1)%7, isToday=d===today;
          const hol=holidayName(Y,M,d);
          // 祝日と日曜は赤、土曜は青。日本のカレンダーの見慣れた並びに合わせる。
          const dayColor = (hol || dow===0) ? HOLIDAY_RED : dow===6 ? SATURDAY_BLUE : 'var(--ink)';
          return {
            blank:false, day:d,
            // 今日は、マスの上辺に墨の線。面（マスの塗り）にはしない。
            //
            // 面は「状態」に見える。このアプリは1回のタップでその日の画面へ飛ぶので、
            // 「選ばれている」という状態は存在しない。それなのに面で示すと、
            // 押したマスが分からなくなる、という食い違いが出た。
            //
            // 前は数字の後ろに黒い丸を敷いていたが、あれは日曜や祝日の赤・土曜の青を
            // 白文字で塗りつぶしていた。線なら曜日の色を保てる。
            // 数字の下に小さな点も試したが、予定の帯に紛れて見つけにくかった。
            //
            // 週の区切りと紛れないかを、3週ぶん描いて確かめた。区切りは薄い灰色の
            // 1px、今日は墨の2px なので、濃さでも太さでも違う。
            // 下辺にも引く案（上下ではさむ）は採らなかった——下の線は翌週の日の
            // 上辺でもあるので、翌週にも印が付いて見える。
            // 今日は、数字をその日の色（日曜・祝日は赤、土曜は青、ふだんは墨）の丸で抜く。
            // 前は上辺の細い線1本だけで、見つけにくかった（とくに30代以上）。
            // 丸を曜日の色にすれば、墨の丸で赤や青を塗りつぶしていた昔の問題も起きない。
            // マスの地もごく薄く色を付ける。今日へ戻ったときは一度だけ光る（flashToday）
            bgStyle:{background: isToday ? 'var(--today-bg)' : 'var(--card)', cursor:'pointer', ...colLine(i),
              ...(isToday && st.flashToday && Date.now()-st.flashToday<1500 ? {animation:'todayFlash 1.2s ease-out'} : {})},
            numWrap:{gridColumn:i+1, gridRow:1, lineHeight:'20px', paddingLeft:2, alignSelf:'center'},
            numStyle: isToday
              ? {display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,padding:'0 3px',borderRadius:9,
                 fontSize:11,fontWeight:700,background:dayColor,color:'var(--card)',fontVariantNumeric:'tabular-nums',lineHeight:'18px'}
              : {fontSize:11, fontWeight: ((hol||dow===0||dow===6)?600:500), color:dayColor},
            // シフト入力のあいだは、押した日に型を置く（その日の一覧は開かない）
            onDay:()=>{ if(this.state.stamp) this.stampDay(Y,M,d); else this.openDay(d); },
          };
        });

        const more=Object.keys(overflow).map(n=>({
          text:'+'+overflow[n]+'件',
          style:{gridColumn:(colOf(Number(n))+1)+' / span 1', gridRow:lanesN+2, fontSize:10,fontWeight:500,color:'var(--ink-mut)',paddingLeft:4,lineHeight:'13px',whiteSpace:'nowrap',overflow:'hidden'},
        }));

        weeks.push({
          key:Y+'-'+M+'-w'+w, slots, bars, more,
          // 週の区切りだけ線を引く。マスを囲む枠は引かない（予定を浮き上がらせるため）
          // 「+N件」の行は auto にする。固定で13px取ると、その日に溢れが無くても
          // 高さを食い、6週の月が実機で下にはみ出す（段を4に増やしたときに起きた）。
          rowStyle:{position:'relative', flex:'1 1 0', minHeight:22+laneH*lanesN,
            ...(w>0?{borderTop:'1px solid var(--line)'}:{})},
          gridStyle:{position:'relative', display:'grid', gridTemplateColumns:'repeat(7,1fr)',
            gridTemplateRows:'22px repeat('+lanesN+','+laneH+'px) auto', alignContent:'start', pointerEvents:'none', height:'100%'},
        });
      }
      return weeks;
    };
    const prevYM=shiftMonth(st.ym,-1), nextYM=shiftMonth(st.ym,1);
    v.monthPages=[
      { key:prevYM.y+'-'+prevYM.m, weeks:buildWeeks(prevYM.y,prevYM.m) },
      { key:st.ym.y+'-'+st.ym.m,   weeks:buildWeeks(st.ym.y,st.ym.m) },
      { key:nextYM.y+'-'+nextYM.m, weeks:buildWeeks(nextYM.y,nextYM.m) },
    ];
    // ---------- 月｜週 ----------
    const calView = st.settings.calView==='week' ? 'week' : 'month';
    v.calView = calView;
    {
      const seg=(sel)=>({padding:'4px 12px',borderRadius:7,fontSize:12,whiteSpace:'nowrap',fontWeight:sel?700:500,cursor:'pointer',
        background:sel?'var(--card)':'transparent',color:sel?'var(--ink)':'var(--ink-mut)',border:sel?'1px solid var(--line)':'1px solid transparent'});
      v.viewSeg=[['month','月'],['week','週']].map(([k,label])=>({label, style:seg(calView===k),
        onClick:()=>{ tapLight(); this.setState(s=>({settings:{...s.settings, calView:k}, weekAnchor:null})); }}));
    }
    if(calView==='week'){
      const t=st.today;
      const inThis = st.ym.y===t.y && st.ym.m===t.m;
      const anchor = st.weekAnchor!=null ? st.weekAnchor
        : (inThis ? weekStartNo(t.y,t.m,t.d,ws) : weekStartNo(st.ym.y,st.ym.m,1,ws));
      const days=Array.from({length:7},(_,i)=>fromDayNo(anchor+i));
      // 見出しの月：今日を含む週なら今日の月、そうでなければ週の多いほうの月（前は木曜の月で、9/28〜の週が「10月」になった）
      const tN=dayNo(t.y,t.m,t.d); const lab = (tN>=anchor && tN<anchor+7) ? {y:t.y,m:t.m} : days[3];
      v.monthLabel=String(lab.m+1); v.year=String(lab.y);
      v.todayBtnShown = !(anchor<=dayNo(t.y,t.m,t.d) && dayNo(t.y,t.m,t.d)<anchor+7);
      v.onGoToday = ()=>{ tapLight(); this.setState({weekAnchor:weekStartNo(t.y,t.m,t.d,ws), ym:{y:t.y,m:t.m}, flashToday:Date.now()}); };
      const shiftW=(d)=>{ tapLight(); const n=anchor+d*7; const o=fromDayNo(n+3); this.setState({weekAnchor:n, ym:{y:o.y,m:o.m}, weekDir:d}); };
      v.onPrevMonth = ()=>shiftW(-1);
      v.onNextMonth = ()=>shiftW(1);
      v.onWeekTouchStart=(e)=>{ const p=e.touches&&e.touches[0]; if(!p) return; this._wsx=p.clientX; this._wsy=p.clientY; };
      v.onWeekTouchEnd=(e)=>{ const p=e.changedTouches&&e.changedTouches[0]; const sx=this._wsx, sy=this._wsy; this._wsx=null;
        if(!p||sx==null) return; const dx=p.clientX-sx, dy=p.clientY-sy; if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.5) shiftW(dx<0?1:-1); };
      const pool=st.events.filter(e=>!(st.settings.hideCanceled && e.status==='nakunatta'));
      const over=this._overlayFor ? this._overlayFor(anchor, anchor+7) : [];
      v.weekKey = String(anchor);
      v.weekAnim = st.weekDir ? (st.weekDir>0?'slideFromRight':'slideFromLeft')+' .24s cubic-bezier(.2,.9,.2,1)' : 'none';
      const H=this.HOUR_H;
      v.weekHourH = H;
      v.weekHours = Array.from({length:24},(_,h)=>({ label: h ? String(h) : '', top: h*H }));
      v.weekCols = days.map((o)=>{
        const n=dayNo(o.y,o.m,o.d), dw=new Date(o.y,o.m,o.d).getDay(), hol=holidayName(o.y,o.m,o.d);
        const isToday = n===dayNo(t.y,t.m,t.d);
        const color=(hol||dw===0)?HOLIDAY_RED:dw===6?SATURDAY_BLUE:'var(--ink)';
        return { key:String(n), dow:wl[dw], date:o.d, isToday, hol:hol||'',
          headStyle:{textAlign:'center',padding:'4px 0 6px',cursor:'pointer'},
          dowStyle:{fontSize:10,fontWeight:600,color: dw===0?HOLIDAY_RED:dw===6?SATURDAY_BLUE:'var(--ink-faint)'},
          numStyle: isToday ? {display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:24,height:24,borderRadius:12,background:color,color:'var(--card)',fontSize:13,fontWeight:700}
            : {fontSize:14,color,fontVariantNumeric:'tabular-nums'},
          onHead:()=>{ this.setState({ym:{y:o.y,m:o.m}}); this.openDay(o.d); },
          allDay: this._timeGridAllDay(pool, o),
          boxes: this._timeGridBoxes(pool, over, o),
          nowTop: isToday ? (()=>{ const nw=new Date(); return (nw.getHours()*60+nw.getMinutes())/60*H; })() : null,
          onSlot:(e)=>{ const box=e.currentTarget.getBoundingClientRect(); const min=Math.floor((e.clientY-box.top)/Math.max(1,box.height)*48)*30;
            this.openNew(o.d,'month',{y:o.y,m:o.m,start:min}); },
        };
      });
      v.weekScrollRef=(el)=>{ if(!el || el.dataset.pos===v.weekKey) return; el.dataset.pos=v.weekKey;
        // 最初は朝7時あたりから見せる。その週に早い予定があれば、そこから
        let first=7*60; for(const c of v.weekCols) for(const b of c.boxes) first=Math.min(first, b.a);
        el.scrollTop=Math.max(0, first/60*H - 12); };
    }
    // 指の動きぶんだけ横にずらす。離したときだけ滑らせる。
    // 絶対配置にして、flex の縮みで幅が崩れないようにする
    const sw0=st.swipe||{dx:0,animating:false};
    const sw=this._dragging ? {dx:this._dragDx||0, animating:false} : sw0;
    v.trackRef=(el)=>{ this._trackEl=el; };
    // 月表示の高さを測って、1週に入る段数を決める（buildWeeks の lanesN）
    v.monthAreaRef=(el)=>{ if(!el) return; const h=el.clientHeight; if(h && Math.abs(h-(this._monthH||0))>6){ this._monthH=h; setTimeout(()=>this.forceUpdate(),0); } };
    v.trackStyle={ position:'absolute', top:0, left:0, height:'100%', width:'300%', display:'flex',
      transform:`translateX(calc(-33.3333% + ${sw.dx}px))`,
      transition: sw.animating ? 'transform .3s cubic-bezier(.22,.86,.3,1)' : 'none' };
    // 給料バーが出ているぶん、下に余白を足して最終週が隠れないようにする
    v.monthPadBottom = (st.stamp ? 236 : wageOn ? 168 : 104)+'px';
    // まだ何も置かれていないときだけ、静かに使い方を添える
    // 予定が無いあいだ出る案内。✕ で消したら、もう出さない。
    // 消した人は「分かっている」と言っているので、予定をぜんぶ消して
    // また0件になっても掘り返さない。
    v.showFirstRunHint = st.events.length===0 && !st.settings.hintClosed;
    v.onCloseFirstRunHint = (e)=>{ if(e) e.stopPropagation(); tapLight(); this.setSetting('hintClosed', true); };
    const monthDone = st.events.filter(e=>e.y===Y && e.m===M && e.status==='jisseki').reduce((a,e)=>a+this.wage(e),0);
    v.monthTotal = this.fmtWage(monthDone);
    v.monthTotalParts = this.splitWage(monthDone);

    // ---------- DAY ----------
    if(st.dayNum){
      const d=st.dayNum, dow=(rawFirst+d-1)%7;
      const dayHol = holidayName(Y,M,d);
      v.dayTitle = (M+1)+'月'+d+'日（'+wl[dow]+'）';
      v.dayHoliday = dayHol || '';
      v.dayTitleStyle = {fontSize:15,fontWeight:400,
        color: (dayHol || dow===0) ? HOLIDAY_RED : dow===6 ? SATURDAY_BLUE : 'var(--ink)'};
      // 日をまたぐ予定も、覆っている日すべてに出す。
      // 月表示で隠している「無くなった」予定は、ここでも隠す（画面ごとに違うと混乱する）
      const dn=dayNo(Y,M,d);
      // 前の日から続く夜勤は、翌日の一覧には出さない（月のマスと同じく、予定は始まった日に1つだけ）
      const evs=st.events.filter(e=>evCovers(e,dn) && !(st.settings.hideCanceled && e.status==='nakunatta'))
        .sort((a,b)=> ((b.allDay?1:0)-(a.allDay?1:0)) || (evSpan(b)-evSpan(a)) || ((evFrom(a)===dn?1:0)-(evFrom(b)===dn?1:0)) || (this.mins(a.start)-this.mins(b.start)));
      v.dayEmpty = evs.length===0;
      const sr=st.swipeRow;
      v.dayEvents = evs.map(ev=>{
        const endShown = ev.status==='jisseki' ? (ev.actualEnd||ev.end) : ev.end;
        const dx = (sr && sr.id===ev.id) ? sr.dx : 0;
        const open = dx < -2;
        const t=this.T(ev.type);
        // 左に開始と終了を縦に2段、その右に種類の色の細い縦棒（まだなら点線の棒）、
        // 題名の下に場所。前は色の札の中に題名、時刻は右端で、場所もメモも出ていなかった
        const cont = !ev.allDay && evFrom(ev)!==dn;
        return {
          key: ev.id,
          chipStyle: {...this.pillStyle(ev), height:26, lineHeight:'26px', fontSize:13, padding:'0 12px', marginBottom:0, borderRadius:6, display:'inline-block', flexShrink:0, overflow:'visible', textOverflow:'clip', width:'max-content', maxWidth:220},
          chipText: this.pillText(ev,false),
          timeText: ev.allDay ? (evSpan(ev)>1 ? this.spanLabel(ev)+'（終日）' : '終日') : ev.start+'–'+endShown,
          startText: ev.allDay ? '終日' : (cont ? '〜' : ev.start),
          endText: ev.allDay ? (evSpan(ev)>1 ? this.spanLabel(ev) : '') : endShown,
          barStyle: ev.status==='mikakutei'
            ? {width:0,alignSelf:'stretch',borderLeft:'3px dashed '+t.color,flexShrink:0,borderRadius:2}
            : {width:4,alignSelf:'stretch',background: ev.status==='nakunatta' ? 'var(--line)' : t.color,flexShrink:0,borderRadius:2},
          titleText: (ev.status==='mikakutei' ? '？' : ev.status==='jisseki' ? '✓' : '') + ev.title,
          titleStyle: {fontSize:Math.round(15*this.evScale()),color: ev.status==='nakunatta' ? 'var(--ink-faint)' : 'var(--ink)', textDecoration: ev.status==='nakunatta' ? 'line-through' : 'none',
            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
          place: ev.place || (ev.link ? 'Web会議' : ''),
          statusWord: this.statusWord(ev),
          // 開いているときは、本文をタップしても予定を開かず、まず閉じる
          onClick: ()=>{ if(open){ this.closeSwipeRow(); return; } this.setState({swipeRow:null}); this.openFor(ev,'day'); },
          onTouchStart:(e)=>this.rowSwipeStart(ev.id,e),
          onTouchMove:(e)=>this.rowSwipeMove(ev.id,e),
          onTouchEnd:()=>this.rowSwipeEnd(ev.id),
          // 取り消されたときも、離したときと同じく「開く」か「閉じる」のどちらかに収める
          onTouchCancel:()=>this.rowSwipeEnd(ev.id),
          // 削除ボタンは行の下に敷いておき、本文をずらして見せる
          wrapStyle:{position:'relative',borderRadius:15,overflow:'hidden',marginBottom:9},
          delWrapStyle:{position:'absolute',top:0,right:0,bottom:0,width:this.SWIPE_W,display:'flex',
            alignItems:'center',justifyContent:'center',background:'#B4453A',cursor:'pointer'},
          onDelete:(e)=>{ if(e)e.stopPropagation(); tapLight(); this.askDelete(ev.id); },
          bodyStyle:{display:'flex',alignItems:'center',gap:12,background:'var(--card)',borderRadius:15,padding:14,
            border:'1px solid var(--line)',cursor:'pointer',position:'relative',
            transform:'translateX('+dx+'px)',
            transition: (sr&&sr.id===ev.id&&sr.animating)?'transform .22s cubic-bezier(.2,.9,.2,1)':'none',
            touchAction:'pan-y'},
        };
      });
      v.onDayAdd = ()=>this.openNew(d,'day');
      // 重ねて表示している iPhone のカレンダーの予定（直すのは元のアプリで）
      v.dayOverlay = this._overlayFor(dn, dn+1).map(e=>({ key:e.id, title:e.title, place:e.place||'',
        time: e.allDay ? '終日' : e.start+'–'+e.end,
        onClick:()=>this.toast('iPhone のカレンダーの予定です。直すのは元のアプリで') }));
      // 前の日・次の日。見出しの ‹ › で送る（行の左払い＝削除とぶつからないよう、払いでは送らない）
      const stepDay=(k)=>{ tapLight(); const o=fromDayNo(dn+k); this.setState({ym:{y:o.y,m:o.m}, dayNum:o.d, swipeRow:null, dayDir:k}); };
      v.onDayPrev = ()=>stepDay(-1);
      v.onDayNext = ()=>stepDay(1);
      v.dayAnim = st.dayDir ? (st.dayDir>0?'slideFromRight':'slideFromLeft')+' .22s cubic-bezier(.2,.9,.2,1)' : 'slideIn .28s cubic-bezier(.2,.9,.2,1)';
      v.dayKey = String(dn);
      // 一覧｜時間。時間は目盛りの上に箱で置く。何もない時間を押すと、その時刻から予定を作る
      const dview = st.settings.dayView==='time' ? 'time' : 'list';
      v.dayView = dview;
      const seg=(sel)=>({padding:'4px 12px',borderRadius:7,fontSize:12,whiteSpace:'nowrap',fontWeight:sel?700:500,cursor:'pointer',
        background:sel?'var(--card)':'transparent',color:sel?'var(--ink)':'var(--ink-mut)',border:sel?'1px solid var(--line)':'1px solid transparent'});
      v.daySeg=[['list','一覧'],['time','時間']].map(([k,label])=>({label, style:seg(dview===k),
        onClick:()=>{ tapLight(); this.setState(s=>({settings:{...s.settings, dayView:k}})); }}));
      if(dview==='time'){
        const H=this.HOUR_H, isToday = dn===dayNo(st.today.y,st.today.m,st.today.d);
        const pool=st.events.filter(e=>!(st.settings.hideCanceled && e.status==='nakunatta'));
        const over=this._overlayFor ? this._overlayFor(dn, dn+1) : [];
        const o={y:Y,m:M,d};
        v.dayHours = Array.from({length:24},(_,h)=>({ label: h ? String(h) : '', top: h*H }));
        v.dayHourH = H;
        v.dayCols=[{ key:'d'+dn, isToday, allDay:this._timeGridAllDay(pool,o), boxes:this._timeGridBoxes(pool, over, o),
          nowTop: isToday ? (()=>{ const nw=new Date(); return (nw.getHours()*60+nw.getMinutes())/60*H; })() : null,
          onSlot:(e)=>{ const box=e.currentTarget.getBoundingClientRect(); const min=Math.floor((e.clientY-box.top)/Math.max(1,box.height)*48)*30; this.openNew(d,'day',{y:Y,m:M,start:min}); } }];
        v.dayScrollRef=(el)=>{ if(!el || el.dataset.pos===v.dayKey) return; el.dataset.pos=v.dayKey;
          let first=8*60; for(const b of v.dayCols[0].boxes) first=Math.min(first,b.a); el.scrollTop=Math.max(0, first/60*H-12); };
      }
      // 予定と予定のあいだの空き時間（一覧のとき）。「14:00〜16:00 空き」
      if(dview==='list'){
        const timed=evs.filter(e=>!e.allDay && e.status!=='nakunatta' && evFrom(e)===dn).map(e=>[this.mins(e.start), busyEndMin(e)]).sort((a,b)=>a[0]-b[0]);
        const gaps={}; let cur=null;
        for(const [a,b] of timed){ if(cur!=null && a-cur>=60) gaps[a]=`${this.fmtMin(cur)}〜${this.fmtMin(a)} 空き`; cur=cur==null?b:Math.max(cur,b); }
        v.dayEvents.forEach(r=>{ const e=evs.find(x=>x.id===r.key); if(e && !e.allDay && gaps[this.mins(e.start)] && evFrom(e)===dn) r.gapBefore=gaps[this.mins(e.start)]; });
      }
    }

    // ---------- NEW ----------
    const dr=st.draft, dt=this.T(dr.type);
    v.draftTitle=dr.title; v.draftColor=dt.color; v.draftStart=dr.start; v.draftEnd=dr.end;
    v.onTitle=(e)=>{ const val=e.target.value; this.setState(s=>({draft:{...s.draft,title:val}})); };
    v.onSave=()=>this.save();
    v.titlePlaceholder = this.words().titleEg;
    // 下の保存ボタンの地。白い字が読める濃さまで、種類の色を暗くする（字と地の差 4.5 以上）
    { const d0=this._mix(dt.color,'#000000',0.35); v.draftColorDeep=`rgb(${d0[0]},${d0[1]},${d0[2]})`; }
    // 新しく作るときは、題名欄にすぐ打てるようにする。改行キーで保存（変換中の改行は無視）
    v.titleAutoFocus = st.screen==='new' && !dr.editingId && !dr.title;
    v.onTitleKey = (e)=>{ if(e.key==='Enter' && !(e.nativeEvent && e.nativeEvent.isComposing) && e.keyCode!==229){ e.preventDefault(); if(e.target && e.target.blur) e.target.blur(); this.save(); } };
    // ---- よく入れる予定 ----
    // 題名欄の下に、ここ3か月で多い題名を並べる。押すと種類・時刻・場所・お知らせも前回と同じで入る。
    // 打ち始めたら、その字を含むものに絞る
    if(st.screen==='new' && !dr.editingId){
      const since = dayNo(st.today.y, st.today.m, st.today.d) - 92;
      const q=(dr.title||'').trim();
      const by=new Map();
      for(const e of st.events){
        if(e.status==='nakunatta' || evFrom(e)<since) continue;
        const k=e.type+'|'+(e.title||'').trim();
        if(!(e.title||'').trim() || e.title==='無題') continue;
        const cur=by.get(k)||{n:0,last:null};
        cur.n++; if(!cur.last || evFrom(e)>evFrom(cur.last)) cur.last=e;
        by.set(k,cur);
      }
      let list=[...by.values()].filter(x=>x.n>=2 || q);
      if(q) list=list.filter(x=>x.last.title.includes(q) && x.last.title!==q);
      list.sort((a,b)=>b.n-a.n);
      v.suggests = list.slice(0,6).map(x=>{ const e=x.last, t=this.T(e.type);
        return { label:e.title, onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, title:e.title, type:e.type,
            ...(e.allDay ? {allDay:true} : {allDay:false, start:e.start, end:e.end}),
            place:e.place||'', memo:'', link:e.link||'', jobId:e.jobId||s.draft.jobId,
            remindMin: typeof e.remindMin==='number' ? e.remindMin : s.draft.remindMin,
            added:[...new Set([...(s.draft.added||[]), ...(e.place?['place']:[]), ...(e.link?['link']:[])])] }})); },
          dotStyle:{width:7,height:7,borderRadius:4,background:t.color,flexShrink:0} }; });
    } else v.suggests=[];
    // ---- 長さのボタン ----
    // 開始を決めたら、長さを押すだけで終わりが決まる（ドラムを回さずに済む）
    if(!dr.allDay){
      const len=((this.mins(dr.end)-this.mins(dr.start))+1440)%1440;
      v.durChips=[[30,'30分'],[60,'1時間'],[90,'1時間半'],[120,'2時間'],[180,'3時間']].map(([m,label])=>({ label,
        onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, end:this.addMin(s.draft.start,m), picking:null}})); },
        style:{padding:'6px 11px',borderRadius:999,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',
          background: len===m?'var(--ink)':'var(--card)', color: len===m?'var(--card)':'var(--ink-mut)', border:'1px solid '+(len===m?'var(--ink)':'var(--line)')} }));
    } else v.durChips=[];
    // ---- 時間の重なり ----
    // 止めはしない。知らせるだけ（確定と、まだの予定を分けて書く）
    if(st.screen==='new' && !dr.allDay && !dr.someday){
      const a=this.mins(dr.start), b0=this.mins(dr.end), b=b0<=a ? 1440 : b0;
      const n=dayNo(dr.y,dr.m,dr.day);
      const hit=st.events.filter(e=>e.id!==dr.editingId && e.status!=='nakunatta' && !e.allDay && evFrom(e)===n)
        .filter(e=>{ const x=this.mins(e.start), y0=busyEndMin(e); return x<b && y0>a; });
      v.overlapNote = hit.length
        ? `この時間は「${hit[0].title}」${hit[0].status==='mikakutei'?'（まだの予定）':''}と重なっています` + (hit.length>1 ? `（ほか${hit.length-1}件）` : '')
        : '';
    } else v.overlapNote='';
    // ---- 候補日 ----
    // まだの予定を何日かに置くとき「どれか1日に決まる」を選べる。1つ確定したら残りを片づけられる
    v.candShown = dr.status==='mikakutei' && (dr.extraDays||[]).length>0 && !dr.editingId;
    v.candOn = !!dr.cand;
    v.onToggleCand = ()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, cand:!s.draft.cand}})); };
    v.candTrack = { width:44,height:26,borderRadius:13,background:dr.cand?'var(--ink)':'var(--line)',padding:2,transition:'background .28s',cursor:'pointer',display:'flex',flexShrink:0 };
    v.candKnob = { width:22,height:22,borderRadius:11,background:'var(--card)',boxShadow:'0 1px 2px rgba(0,0,0,.25)',transition:'transform .28s',transform:dr.cand?'translateX(18px)':'none' };
    // ---- 日にちをまだ決めない ----
    v.somedayChips = !dr.editingId ? SOMEDAY_WHEN.map(w=>({ label:SOMEDAY_LABEL[w], onClick:()=>{ tapLight();
        this.setState(s=>({draft:{...s.draft, someday: s.draft.someday===w ? null : w, status:'mikakutei', picking:null, extraDays:[]}})); },
      style:{padding:'7px 11px',borderRadius:999,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',
        background: dr.someday===w?'var(--ink)':'var(--card)', color: dr.someday===w?'var(--card)':'var(--ink-mut)',
        border:'1px '+(dr.someday===w?'solid var(--ink)':'dashed var(--line)')} })) : [];
    v.somedayOn = !!dr.someday;
    v.somedayText = dr.someday ? SOMEDAY_LABEL[dr.someday]+'（日が決まったら、棚からカレンダーへ移せます）' : '';
    // ---- 名前を隠す ----
    v.secretOn = !!dr.secret;
    v.onToggleSecret = ()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, secret:!s.draft.secret}})); };
    v.secretTrack = { width:44,height:26,borderRadius:13,background:dr.secret?'var(--ink)':'var(--line)',padding:2,transition:'background .28s',cursor:'pointer',display:'flex',flexShrink:0 };
    v.secretKnob = { width:22,height:22,borderRadius:11,background:'var(--card)',boxShadow:'0 1px 2px rgba(0,0,0,.25)',transition:'transform .28s',transform:dr.secret?'translateX(18px)':'none' };
    // ---- 書きかけを捨てるか ----
    v.onCancel = ()=>{ if(this.draftDirty()){ tapLight(); this.setState({discardAsk:true}); return; } this.setState({screen:st.returnTo}); };
    v.discardShown = !!st.discardAsk;
    v.onDiscardYes = ()=>this.setState({discardAsk:false, screen:st.returnTo});
    v.onDiscardNo = ()=>this.setState({discardAsk:false});
    // くり返しを直したとき
    v.repEditShown = !!st.repEditAsk;
    if(st.repEditAsk){
      v.repEditRest = `これ以降すべて（ほか${st.repEditAsk.rest}件）`;
      v.onRepEditOne = ()=>this.save('one');
      v.onRepEditRest = ()=>this.save('rest');
      v.onRepEditCancel = ()=>this.setState({repEditAsk:null});
    }

    // 終日 / 時間指定
    // ---------- 日付えらび（小さなカレンダーを開く） ----------
    v.editing = !!dr.editingId;
    v.newTitle = dr.editingId ? '予定を編集' : '新しい予定';
    const DOW=['日','月','火','水','木','金','土'];
    const dDate=new Date(dr.y,dr.m,dr.day);
    v.dateLabel = `${dr.y}年${dr.m+1}月${dr.day}日（${DOW[dDate.getDay()]}）`;
    v.dateOpen = dr.picking==='date';
    v.onTapDate = ()=>this.setState(s=>({draft:{...s.draft, picking:s.draft.picking==='date'?null:'date', pickY:s.draft.y, pickM:s.draft.m, pickedOnce:false, pickYM:false}}));
    // 複数日えらんだときの表示
    const extras=(dr.extraDays||[]).length;
    v.dateExtraCount = extras;
    v.dateSummary = extras ? `ほか${extras}日` : '';
    v.dateHint = v.dateOpen ? '日をえらんでください' : '';
    v.onClearExtraDays = ()=>this.setState(s=>({draft:{...s.draft, extraDays:[]}}));
    const pY = dr.pickY==null?dr.y:dr.pickY, pM = dr.pickM==null?dr.m:dr.pickM;
    v.datePickLabel = `${pY}年${pM+1}月`;
    v.onDatePrev = ()=>this.setState(s=>{ const n=shiftMonth({y:pY,m:pM},-1); return {draft:{...s.draft,pickY:n.y,pickM:n.m}}; });
    v.onDateNext = ()=>this.setState(s=>{ const n=shiftMonth({y:pY,m:pM},1); return {draft:{...s.draft,pickY:n.y,pickM:n.m}}; });
    // 「2026年7月」を押すと、年と月を直接えらべる。
    // 1ヶ月ずつしか動けないと、来年3月に行くのに8回タップすることになる。
    v.ymPickOpen = !!dr.pickYM;
    v.onTapYM = ()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, pickYM:!s.draft.pickYM}})); };
    v.ymYearLabel = String(pY);
    v.onYearPrev = ()=>this.setState(s=>({draft:{...s.draft, pickY:pY-1}}));
    v.onYearNext = ()=>this.setState(s=>({draft:{...s.draft, pickY:pY+1}}));
    v.ymMonths = Array.from({length:12},(_,i)=>{ const sel=i===pM;
      return { label:(i+1)+'月', onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, pickM:i, pickYM:false}})); },
        style:{padding:'11px 0',textAlign:'center',borderRadius:11,fontSize:14,fontWeight:sel?700:500,cursor:'pointer',
          transition:'all .18s', background:sel?'var(--ink)':'var(--card)', color:sel?'var(--card)':'var(--ink-soft)',
          border:'1px solid '+(sel?'var(--ink)':'var(--line)')} }; });
    const dws=st.settings.weekStart;
    v.dateWeekdays = Array.from({length:7},(_,i)=>{ const dw=(i+dws)%7;
      return { label:DOW[dw], style:{textAlign:'center',fontSize:10,fontWeight:600,padding:'4px 0',
        color: dw===0 ? HOLIDAY_RED : dw===6 ? SATURDAY_BLUE : 'var(--ink-faint)'} }; });
    {
      const first=(new Date(pY,pM,1).getDay()-dws+7)%7;
      const dim=new Date(pY,pM+1,0).getDate();
      const cells=[];
      for(let i=0;i<first;i++) cells.push({ label:'', style:{height:36} });
      for(let d2=1;d2<=dim;d2++){
        const isMain = pY===dr.y && pM===dr.m && d2===dr.day;
        const isExtra = (dr.extraDays||[]).includes(pY+'-'+pM+'-'+d2);
        const sel = isMain || isExtra;
        const isToday = st.today.y===pY && st.today.m===pM && st.today.d===d2;
        const dw2 = new Date(pY,pM,d2).getDay();
        const hol2 = holidayName(pY,pM,d2);
        const c2 = (hol2||dw2===0) ? HOLIDAY_RED : dw2===6 ? SATURDAY_BLUE : 'var(--ink-soft)';
        cells.push({ label:d2,
          style:{height:36,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:12,cursor:'pointer',
            fontSize:14,fontVariantNumeric:'tabular-nums',
            fontWeight:sel?700:(isToday?700:500),
            background: isMain?'var(--ink)': isExtra?'var(--bg2)':'transparent',
            color: isMain?'var(--card)':c2,
            border: isExtra ? '1.5px solid var(--ink)' : (!sel&&isToday)?'1px solid var(--line)':'1px solid transparent'},
          // 押した日だけを選ぶ。
          // 以前は2回目以降を「追加の日」として足していたが、
          // 12日を押すつもりで13日を押したとき、押し直すと両方が選ばれてしまい、
          // 間違いを直す手段が無かった。押し間違いは必ず起きるので、
          // 直せないほうを取り除いた。複数日は別の入口で作る。
          onClick:()=>{ if(isMain) return;
            tapLight();
            this.setState(s=>({draft:{...s.draft, y:pY, m:pM, day:d2, extraDays:[], pickedOnce:true}})); } });
      }
      v.dateCells=cells;
    }

    // ---------- バイト先（新規作成画面） ----------
    v.jobPickerShown = dr.type==='baito';
    { const W=this.words(); v.jobWordNew=W.job; v.jobThisNew=W.jobThis; }
    v.jobChips = (st.jobs||[]).map(j=>{ const sel=j.id===dr.jobId;
      return { label:(j.name||'名前なし')+'　¥'+j.hourly, onClick:()=>this.pickJob(j.id),
        style:{padding:'8px 14px',borderRadius:999,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',
          background:sel?'#1D9E75':'var(--card)', color:sel?'#fff':'var(--ink-mut)',
          border:'1px solid '+(sel?'#1D9E75':'var(--line)'), fontVariantNumeric:'tabular-nums'} }; });
    v.jobNoneChip = { label:this.words().jobNone, onClick:()=>this.clearJob(),
      style:{padding:'8px 14px',borderRadius:999,fontSize:13,fontWeight:!dr.jobId?700:500,cursor:'pointer',
        background:!dr.jobId?'#1D9E75':'var(--card)', color:!dr.jobId?'#fff':'var(--ink-mut)',
        border:'1px solid '+(!dr.jobId?'#1D9E75':'var(--line)'), fontVariantNumeric:'tabular-nums'} };
    // その場で足せるようにする。画面を離れないので入力が消えない。
    v.onAddJobFromNew = ()=>this.startNewJob();
    v.newJobShown = !!st.newJob;
    if(st.newJob){
      v.newJobName = st.newJob.name; v.newJobEg = this.words().jobEg;
      v.newJobHourly = String(st.newJob.hourly);
      v.onNewJobName = (e)=>{ const val=e.target.value; this.setState(s=>({newJob:{...s.newJob,name:val}})); };
      v.onNewJobHourly = (e)=>{ const n=parseInt((e.target.value||'').replace(/[^0-9]/g,''),10);
        this.setState(s=>({newJob:{...s.newJob,hourly:isNaN(n)?0:Math.min(99999,n)}})); };
      v.onNewJobMinus = ()=>this.setState(s=>({newJob:{...s.newJob,hourly:Math.max(0,s.newJob.hourly-10)}}));
      v.onNewJobPlus = ()=>this.setState(s=>({newJob:{...s.newJob,hourly:s.newJob.hourly+10}}));
      v.onCancelNewJob = ()=>this.cancelNewJob();
      v.onCommitNewJob = ()=>this.commitNewJob();
    }

    // ---------- バイト先（設定画面） ----------
    v.jobRows = (st.jobs||[]).map((j,i)=>({
      name:j.name||'（名前なし）', hourly:String(j.hourly), open:st.editJobId===j.id,
      rowStyle:{borderBottom: i<st.jobs.length-1 ? '1px solid var(--line)':'none'},
      onTap:()=>this.setState(s=>({editJobId:s.editJobId===j.id?null:j.id})),
      onName:(e)=>this.patchJob(j.id,{name:e.target.value}),
      onHourly:(e)=>{ const n=parseInt((e.target.value||'').replace(/[^0-9]/g,''),10); this.patchJob(j.id,{hourly:isNaN(n)?0:Math.min(99999,n)}); },
      onMinus:()=>this.patchJob(j.id,{hourly:Math.max(0,j.hourly-10)}),
      onPlus:()=>this.patchJob(j.id,{hourly:j.hourly+10}),
      onRemove:()=>this.removeJob(j.id),
      usedCount: st.events.filter(e=>e.jobId===j.id).length,
    }));
    v.onAddJob = ()=>this.addJob();
    v.jobsEmpty = (st.jobs||[]).length===0;
    // リマインドは通知が使える環境だけ。ブラウザでは行ごと出さない（押しても何も起きない設定を見せない）
    v.remindRowShown = !v.jobsEmpty && canNotify();

    v.timed = !dr.allDay; v.allDayShown = dr.allDay;
    // 何日間つづくか。終日のときだけ選べる（時間指定は1日で完結するもの、という決め）
    {
      const n=Math.max(1,Math.min(60,dr.days|0||1));
      v.spanDays = n;
      v.spanCountLabel = n===1 ? '1日' : n+'日間';
      v.spanRangeLabel = n===1 ? '' : this.spanLabel({y:dr.y,m:dr.m,day:dr.day,days:n});
      v.spanHint = n===1 ? '2日以上にすると、カレンダーで1本の帯になります' : '';
      // 続けて押したぶんが取りこぼされないよう、今の値は state から読む
      const bump=(d)=>()=>{ tapLight(); this.setState(s=>{
        const cur=Math.max(1,Math.min(60,s.draft.days|0||1)), next=cur+d;
        return (next<1||next>60) ? null : {draft:{...s.draft,days:next}};
      }); };
      v.onSpanMinus = bump(-1);
      v.onSpanPlus = bump(1);
      v.spanMinusStyle = {...stepBtn, opacity:n<=1?.35:1};
      v.spanPlusStyle = {...stepBtn, opacity:n>=60?.35:1};
    }
    // 終日の切り替え。終日と時間指定では選べるお知らせが違うので、
    // どちらにも当てはまらない値が残っていたら「なし」に戻す（選択が消えた見た目を避ける）
    v.onToggleAllDay = ()=>{ tapLight(); this.setState(s=>{
      const allDay=!s.draft.allDay;
      const ok = allDay ? [0,1440] : [10,30,60,1440];
      const keep = ok.includes(s.draft.remindMin) ? s.draft.remindMin : null;
      return {draft:{...s.draft, allDay, remindMin:keep, picking:null}};
    }); };
    v.allDayTrack = tgTrack(!!dr.allDay); v.allDayKnob = tgKnob(!!dr.allDay);

    // ---------- 行にたたむ ----------
    // 既定はすべて閉じておき、押した行だけが開く。開けるのは一度に一つ。
    // 中身を削ったのではなく、要るまで見せないだけ。
    const openRow=(key)=>()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, picking: s.draft.picking===key ? null : key}})); };

    v.rowTypeOpen = dr.picking==='type';
    v.onTapTypeRow = openRow('type');
    v.typeValue = dt.name;
    v.typeDotStyle = {width:9,height:9,borderRadius:5,background:dt.color,flexShrink:0};
    v.chevType = chevron(v.rowTypeOpen); v.valType = rowVal(v.rowTypeOpen);

    v.rowJobOpen = dr.picking==='job';
    v.onTapJobRow = openRow('job');
    { const j=(st.jobs||[]).find(x=>x.id===dr.jobId);
      v.jobValue = j ? (j.name||'名前なし') : '設定の時給'; }
    v.chevJob = chevron(v.rowJobOpen); v.valJob = rowVal(v.rowJobOpen);

    // ---------- ＋ で足す項目 ----------
    // くり返し・場所・メモは、いつも使うものではない。
    // 最初から行を並べると、ただシフトを1件入れたいだけの人に
    // 6行ぶんスクロールさせることになる。押したぶんだけ生やす。
    {
      const added = dr.added||[];
      const addable = [
        // 直している予定にくり返しは出さない。すでに1件ずつの予定になっていて、
        // ここで触らせると、どれが変わるのか分からなくなる。
        { key:'rep', label:'くり返し', hide:!!dr.editingId },
        // 複数日もくり返しと同じで、作るときだけ。
        // 直している1件を触っているのに、別の日に予定が生えるのはおかしい。
        { key:'multi', label:'複数日', hide:!!dr.editingId },
        { key:'place', label:'場所' },
        // Web 会議のリンク。詳細に大きく「参加する」が出る
        { key:'link', label:'Web会議・リンク' },
        { key:'memo', label:'メモ' },
      ];
      v.addChips = addable.filter(o=>!o.hide && !added.includes(o.key)).map(o=>({
        label:o.label,
        // 押したらその場で開く。もう一度たたませない。
        onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft,
          added:[...(s.draft.added||[]), o.key], picking:o.key}})); },
        style:{padding:'8px 14px',borderRadius:999,fontSize:13,color:'var(--ink-mut)',
          border:'1px dashed var(--line)',cursor:'pointer',whiteSpace:'nowrap'},
      }));
      v.addRowShown = v.addChips.length>0;
      // ✕ で消す。値も一緒に捨てる（行だけ消えて中身が残ると、保存されて驚く）
      const drop=(key,clear)=>()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, ...clear,
        added:(s.draft.added||[]).filter(k=>k!==key),
        picking: s.draft.picking===key ? null : s.draft.picking}})); };
      v.onRemoveRep = drop('rep',{repEvery:null, repDows:[]});
      v.onRemoveMulti = drop('multi',{extraDays:[]});
      v.onRemovePlace = drop('place',{place:''});
      v.onRemoveMemo = drop('memo',{memo:''});
      v.onRemoveLink = drop('link',{link:''});
      v.repRowShown = added.includes('rep') && !dr.editingId;
      v.multiRowShown = added.includes('multi') && !dr.editingId;
      v.placeRowShown = added.includes('place');
      v.memoRowShown = added.includes('memo');
      v.linkRowShown = added.includes('link');
      v.addedAny = v.repRowShown || v.multiRowShown || v.placeRowShown || v.memoRowShown || v.linkRowShown;
      v.rowLinkOpen = dr.picking==='link';
      v.onTapLinkRow = openRow('link');
      v.linkValue = (dr.link||'').trim() ? (dr.link||'').trim().replace(/^https?:\/\//,'').slice(0,22)+((dr.link||'').trim().length>30?'…':'') : 'なし';
      v.linkText = dr.link||'';
      v.onLinkText = (e)=>{ const val=e.target.value; this.setState(s=>({draft:{...s.draft, link:val}})); };
      v.valLink = rowVal(v.rowLinkOpen);
      v.removeStyle = {width:26,height:26,borderRadius:13,flexShrink:0,display:'flex',
        alignItems:'center',justifyContent:'center',fontSize:13,color:'var(--ink-faint)',
        background:'var(--bg2)',cursor:'pointer'};
    }

    // ---------- 場所とメモ ----------
    // どちらも予定の中身そのもの。持ち物はメモに書く。
    v.rowPlaceOpen = dr.picking==='place';
    v.onTapPlaceRow = openRow('place');
    v.placeValue = (dr.place||'').trim() || 'なし';
    v.placeText = dr.place||'';
    v.placePlaceholder = this.words().placeEg;
    v.onPlaceText = (e)=>{ const val=e.target.value; this.setState(s=>({draft:{...s.draft, place:val}})); };
    v.chevPlace = chevron(v.rowPlaceOpen); v.valPlace = rowVal(v.rowPlaceOpen);

    v.rowMemoOpen = dr.picking==='memo';
    v.onTapMemoRow = openRow('memo');
    { const t=(dr.memo||'').trim();
      v.memoValue = t ? (t.split('\n')[0].slice(0,12)+(t.length>12||t.includes('\n')?'…':'')) : 'なし'; }
    v.memoText = dr.memo||'';
    v.onMemoText = (e)=>{ const val=e.target.value; this.setState(s=>({draft:{...s.draft, memo:val}})); };
    v.chevMemo = chevron(v.rowMemoOpen); v.valMemo = rowVal(v.rowMemoOpen);

    // ---------- 複数日 ----------
    // 日にちの画面から外した「まとめて置く」を、専用の入口として作り直したもの。
    // ここなら、選んだ日をもう一度押せば外せる。日にちの画面で足していたころは
    // 押し間違いを直せなかった（12日のつもりで13日を押すと両方入る）。
    v.rowMultiOpen = dr.picking==='multi';
    v.onTapMultiRow = ()=>{ tapLight(); this.setState(s=>({draft:{...s.draft,
      picking: s.draft.picking==='multi' ? null : 'multi',
      pickY:s.draft.y, pickM:s.draft.m, pickYM:false}})); };
    {
      const n=(dr.extraDays||[]).length;
      v.multiValue = n ? `ほか${n}日` : 'なし';
      v.multiClearShown = n>0;
      v.onClearMulti = ()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, extraDays:[]}})); };
      v.multiHint = n
        ? `この予定を、ぜんぶで${n+1}日に置きます`
        : '同じ予定を置きたい日を、タップしてえらんでください';
      const mY = dr.pickY==null?dr.y:dr.pickY, mM = dr.pickM==null?dr.m:dr.pickM;
      v.multiPickLabel = `${mY}年${mM+1}月`;
      v.onMultiPrev = ()=>this.setState(s=>{ const o=shiftMonth({y:mY,m:mM},-1); return {draft:{...s.draft,pickY:o.y,pickM:o.m}}; });
      v.onMultiNext = ()=>this.setState(s=>{ const o=shiftMonth({y:mY,m:mM},1); return {draft:{...s.draft,pickY:o.y,pickM:o.m}}; });
      const mws=st.settings.weekStart;
      v.multiWeekdays = Array.from({length:7},(_,i)=>{ const dw=(i+mws)%7;
        return { label:DOW[dw], style:{textAlign:'center',fontSize:10,fontWeight:600,padding:'4px 0',
          color: dw===0 ? HOLIDAY_RED : dw===6 ? SATURDAY_BLUE : 'var(--ink-faint)'} }; });
      const first=(new Date(mY,mM,1).getDay()-mws+7)%7;
      const dim=new Date(mY,mM+1,0).getDate();
      const cells=[];
      for(let i=0;i<first;i++) cells.push({ label:'', style:{height:36} });
      for(let d2=1;d2<=dim;d2++){
        const isMain = mY===dr.y && mM===dr.m && d2===dr.day;
        const isExtra = (dr.extraDays||[]).includes(mY+'-'+mM+'-'+d2);
        const dw2 = new Date(mY,mM,d2).getDay();
        const hol2 = holidayName(mY,mM,d2);
        const c2 = (hol2||dw2===0) ? HOLIDAY_RED : dw2===6 ? SATURDAY_BLUE : 'var(--ink-soft)';
        cells.push({ label:d2,
          style:{height:36,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:12,
            cursor: isMain?'default':'pointer', fontSize:14, fontVariantNumeric:'tabular-nums',
            fontWeight:(isMain||isExtra)?700:500,
            // 本体の日は「もう選ばれている」ことだけ示して、外させない。
            // ここで外せると、予定の日そのものが消えてしまう。
            background: isMain?'var(--ink)': isExtra?'var(--bg2)':'transparent',
            color: isMain?'var(--card)':c2,
            opacity: isMain?0.55:1,
            border: isExtra ? '1.5px solid var(--ink)' : '1px solid transparent'},
          onClick: isMain ? (()=>{}) : (()=>{ tapLight(); this.toggleExtraDay(mY,mM,d2); }) });
      }
      v.multiCells=cells;
    }

    // ---------- くり返し ----------
    v.rowRepOpen = dr.picking==='rep';
    v.onTapRepRow = openRow('rep');
    {
      const DOWJ=['日','月','火','水','木','金','土'];
      const myDow = new Date(dr.y,dr.m,dr.day).getDay();
      const dows = dr.repDows||[];
      const span = dr.repSpan|0 || 3;
      const nth = dr.repNth||[];
      const made = repeatAfter(dr.y, dr.m, dr.day, dr.repEvery, span, dows, nth);
      const dowText = dows.length ? dows.slice().sort().map(i=>DOWJ[i]).join('・') : DOWJ[myDow];
      const myNth = Math.min(5, Math.floor((dr.day-1)/7)+1);
      // 行にたたんだときの言い方。何がくり返されるのか、開かなくても分かるように。
      v.repValue = !dr.repEvery ? 'なし'
        : dr.repEvery==='day' ? '毎日'
        : dr.repEvery==='weekday' ? '平日（月〜金）'
        : dr.repEvery==='week' ? ('毎週' + dowText)
        : dr.repEvery==='biweek' ? ('2週ごと ' + dowText)
        : dr.repEvery==='month' ? `毎月${dr.day}日`
        : dr.repEvery==='nth' ? `毎月 ${(nth.length?nth:[myNth]).slice().sort().map(k=>NTH_LABEL[k]).join('・')} ${dowText}曜`
        : dr.repEvery==='monthEnd' ? '毎月 月末'
        : `毎年${dr.m+1}月${dr.day}日`;
      v.repNthShown = dr.repEvery==='nth';
      v.repNthChips = [1,2,3,4,5].map(k=>{ const sel = nth.length ? nth.includes(k) : k===myNth;
        return { label:NTH_LABEL[k], onClick:()=>{ tapLight(); this.setState(s=>{
            const cur=s.draft.repNth||[]; const b=cur.length?cur:[myNth];
            const next=b.includes(k)?b.filter(x=>x!==k):[...b,k];
            return {draft:{...s.draft, repNth: next.length?next:b}};
          }); },
          style:{flex:1,textAlign:'center',padding:'9px 0',borderRadius:11,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',
            background:sel?'#1D9E75':'var(--card)', color:sel?'#fff':'var(--ink-mut)', border:'1px solid '+(sel?'#1D9E75':'var(--line)')} }; });
      const chip=(sel,dark)=>({padding:'9px 15px',borderRadius:999,fontSize:13,fontWeight:sel?700:500,
        cursor:'pointer',whiteSpace:'nowrap',
        background: sel ? (dark?'var(--ink)':'#1D9E75') : 'var(--card)',
        color: sel ? (dark?'var(--card)':'#fff') : 'var(--ink-mut)',
        border:'1px solid '+(sel ? (dark?'var(--ink)':'#1D9E75') : 'var(--line)')});
      v.repEveryChips = [{key:null,label:'なし'}, ...REPEAT_UNITS].map(o=>{
        const sel=(dr.repEvery||null)===o.key;
        return { label:o.label, style:chip(sel,false),
          onClick:()=>{ tapLight(); this.setState(s=>{
            // 単位ごとに選べる長さが違うので、いまの値が無ければ真ん中に寄せる
            const list=spansFor(o.key);
            const keep=list.some(x=>x.m===(s.draft.repSpan|0));
            return {draft:{...s.draft, repEvery:o.key,
              repSpan: keep ? s.draft.repSpan : list[Math.min(1,list.length-1)].m}};
          }); } };
      });
      v.repUntilShown = !!dr.repEvery;
      // 曜日えらびは「毎週」「2週ごと」「第◯曜日」のとき。何も選ばなければ本体と同じ曜日。
      v.repDowShown = ['week','biweek','nth'].includes(dr.repEvery);
      v.repDowChips = DOWJ.map((label,i)=>{ const sel = dows.length ? dows.includes(i) : i===myDow;
        return { label, onClick:()=>{ tapLight(); this.setState(s=>{
            const cur=(s.draft.repDows||[]);
            const base=cur.length?cur:[myDow];
            const next=base.includes(i)?base.filter(x=>x!==i):[...base,i];
            // ぜんぶ外すと何も作れないので、最後の1つは残す
            return {draft:{...s.draft, repDows: next.length?next:base}};
          }); },
          style:{flex:1,textAlign:'center',padding:'9px 0',borderRadius:11,fontSize:13,
            fontWeight:sel?700:500,cursor:'pointer',
            background:sel?'#1D9E75':'var(--card)', color:sel?'#fff':'var(--ink-mut)',
            border:'1px solid '+(sel?'#1D9E75':'var(--line)')} }; });
      v.repWeekChips = spansFor(dr.repEvery).map(o=>({ label:o.label, style:chip(span===o.m,true),
        onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, repSpan:o.m}})); } }));
      if(made.length){
        const last=fromDayNo(made[made.length-1]);
        v.repHint = `${last.y!==dr.y?last.y+'年':''}${last.m+1}月${last.d}日まで、ぜんぶで${made.length+1}件つくります`;
      } else v.repHint = dr.repEvery ? 'この長さでは、ほかに置ける日がありません' : '';
    }
    v.chevRep = chevron(v.rowRepOpen); v.valRep = rowVal(v.rowRepOpen);
    v.valMulti = rowVal(v.rowMultiOpen);

    v.rowRemindOpen = dr.picking==='remind';
    v.onTapRemindRow = openRow('remind');
    v.remindValue = st.settings.notifyOff ? '通知はオフ' : (typeof dr.remindMin==='number') ? this.remindLabel(dr.remindMin, dr.allDay) : 'なし';
    v.chevRemind = chevron(v.rowRemindOpen); v.valRemind = rowVal(v.rowRemindOpen);
    v.chevDate = chevron(v.dateOpen);
    v.dateValStyle = rowVal(v.dateOpen);
    // ---------- お知らせ（リマインダー） ----------
    // 終日の予定は時刻を持たないので、朝9時を基準にした言い方に変える。
    {
      const opts = dr.allDay
        ? [[null,'なし'],[0,'当日の朝'],[1440,'前日の朝'],[2880,'2日前'],[4320,'3日前'],[10080,'1週間前']]
        : [[null,'なし'],[10,'10分前'],[30,'30分前'],[60,'1時間前'],[180,'3時間前'],[1440,'前日'],[2880,'2日前'],[4320,'3日前'],[10080,'1週間前']];
      const cur = typeof dr.remindMin==='number' ? dr.remindMin : null;
      // 数が増えたので、横一列ではなく折り返すチップにする
      v.remindSeg = opts.map(([val,label])=>{ const sel=cur===val;
        return { label, onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, remindMin:val}})); },
          style:{padding:'8px 13px',borderRadius:999,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',whiteSpace:'nowrap',
            transition:'all .18s', background:sel?'#1D9E75':'var(--card)', color:sel?'#fff':'var(--ink-mut)',
            border:'1px solid '+(sel?'#1D9E75':'var(--line)')} }; });
      v.remindNote = cur===null ? ''
        : dr.allDay
          ? (cur===0 ? '当日の朝9時にお知らせします' : `${cur/1440}日前の朝9時にお知らせします`)
          : (cur>=1440 ? `${cur/1440}日前の同じ時刻にお知らせします`
            : `始まる${cur>=60?Math.round(cur/60)+'時間':cur+'分'}前にお知らせします`);
    }

    // drum-roll wheels
    v.wheelColStyle = {width:66,height:170,overflowY:'scroll',scrollSnapType:'y mandatory',padding:'68px 0',textAlign:'center',WebkitMaskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)',maskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)'};
    v.wheelItemStyle = {height:34,lineHeight:'34px',fontSize:21,fontWeight:300,color:'var(--ink)',scrollSnapAlign:'center',fontVariantNumeric:'tabular-nums'};
    const hours=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
    const minutes=Array.from({length:60/MIN_STEP},(_,i)=>String(i*MIN_STEP).padStart(2,'0'));
    const mkRow=(field,label,isFirst)=>({
      label, value:dr[field], open:dr.picking===field,
      rowStyle:{borderBottom:'1px solid var(--line)'},
      valStyle:rowVal(dr.picking===field), chev:chevron(dr.picking===field),
      onTap:()=>this.setState(s=>({draft:{...s.draft,picking:s.draft.picking===field?null:field}})),
      hItems:hours, mItems:minutes,
      hRef: field==='start'?this.refStartH:this.refEndH, mRef: field==='start'?this.refStartM:this.refEndM,
      hScroll: field==='start'?this.scStartH:this.scEndH, mScroll: field==='start'?this.scStartM:this.scEndM,
    });
    v.timeRows=[ mkRow('start','開始',true), mkRow('end','終了',false) ];

    // 開始と終了に日付を添える。
    // 終わりの時刻が始まりより前なら、終わるのは翌日——22:00–1:00 の深夜勤務。
    // 給料はもともと日またぎで計算していたのに、画面がそれを言っていなかった。
    // 終了日は選ばせない。自由に選ばせると「3日後の11:00」のような、
    // 予定ではなく期間になってしまい、実働時間の計算が意味を失う。
    {
      const DOWJ=['日','月','火','水','木','金','土'];
      const fmtDay=(o)=>`${o.m+1}月${o.d}日（${DOWJ[new Date(o.y,o.m,o.d).getDay()]}）`;
      const from={y:dr.y,m:dr.m,d:dr.day};
      v.startDateText = fmtDay(from);
      // 終日は「何日間」で終わりが決まる。時間指定は日またぎだけ見る。
      const span = dr.allDay ? Math.max(1,Math.min(60,dr.days|0||1)) : 1;
      const wraps = !dr.allDay && endsNextDay({start:dr.start, end:dr.end});
      const endN = dayNo(dr.y,dr.m,dr.day) + (dr.allDay ? span-1 : (wraps?1:0));
      v.endDateText = fmtDay(fromDayNo(endN));
      v.endNextDay = wraps;
      // 翌日にずれたときだけ、そう言う。ふだんは静かにしておく。
      v.crossNote = wraps ? '日をまたぐので、終わりは翌日です' : '';
      v.onTapStartDate = ()=>this.setState(s=>({draft:{...s.draft,
        picking: s.draft.picking==='date' ? null : 'date',
        pickY:s.draft.y, pickM:s.draft.m, pickedOnce:false, pickYM:false}}));
    }

    // 隠した種類は出さない（直している予定がその種類なら、それだけは出す）
    v.chips = st.types.filter(t=>!t.hidden || t.key===dr.type).map(t=>{ const sel=dr.type===t.key;
      return { label:t.name, onClick:()=>this.selectType(t.key),
        style:{textAlign:'center',whiteSpace:'nowrap',padding:'10px 15px',borderRadius:13,fontSize:14,fontWeight:400,cursor:'pointer',transition:'all .2s',
          background:sel?t.color:'var(--card)', color:sel?'#fff':'var(--ink-mut)', boxShadow:'none', border:sel?'none':'1px solid var(--line)'} }; });
    v.addChipStyle = {textAlign:'center',whiteSpace:'nowrap',padding:'10px 14px',borderRadius:13,fontSize:14,fontWeight:400,cursor:'pointer',color:'var(--ink-soft)',background:'transparent',border:'1.5px dashed #C9CDD4'};
    v.onAddTypeChip = ()=>this.setState(s=>({newType: s.newType?null:{name:'',color:'#2F72C4'}}));

    // 色を変えるのは設定画面の「種類」に一本化した（作成画面では出さない）

    // new type creator
    const nt=st.newType;
    v.newTypeShown=!!nt;
    if(nt){
      v.newTypeName=nt.name; v.newTypeEg=this.words().typeEg;
      v.onNewTypeName=(e)=>{ const val=e.target.value; this.setState(s=>({newType:{...s.newType,name:val}})); };
      v.newTypeSwatches = this.PAL.map(hex=>({ style:{width:26,height:26,borderRadius:13,background:hex,cursor:'pointer',boxShadow: nt.color===hex?'0 0 0 2px #fff, 0 0 0 4px '+hex:'inset 0 0 0 1px rgba(0,0,0,.08)'}, onClick:()=>this.setState(s=>({newType:{...s.newType,color:hex}})) }));
      v.addTypeBtnStyle={flex:1,textAlign:'center',padding:'11px',borderRadius:13,background:nt.color,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'};
      v.onAddType=()=>this.addType();
      v.onCancelNewType=()=>this.setState({newType:null});
    } else { v.newTypeName=''; }

    // 切り替えの言葉は種類ごと。仕事なら「確定／仮押さえ」、休みなら「休み／希望休」
    v.seg=[['kakutei',dt.cLabel||'決まってる'],['mikakutei',dt.uLabel||'まだ不確定']].map(([k,label])=>{ const sel=dr.status===k;
      return { label, onClick:()=>this.setState(s=>({draft:{...s.draft,status:k}})),
        style:{flex:1,textAlign:'center',padding:'9px 0',borderRadius:11,fontSize:14,fontWeight:sel?700:500,cursor:'pointer',transition:'all .25s cubic-bezier(.2,.9,.2,1)',
          background:sel?'var(--card)':'transparent', color:sel?'var(--ink)':'var(--ink-mut)', border:sel?'1px solid var(--line)':'1px solid transparent'} }; });

    // 3マスのプレビューはやめ、説明の1行だけ残した（作成画面を短くするため）
    v.previewExplain = dr.status==='mikakutei' ? dt.uWord+'として、点線で置かれます' : dt.cWord+'として、塗りで置かれます';
    v.previewDotStyle = { width:10,height:10,borderRadius:3,flexShrink:0, ...(dr.status==='mikakutei'?{background:dt.paper,border:'1.5px dashed '+dt.color}:{background:dt.color}) };

    // ---------- DETAIL ----------
    const ev = st.events.find(e=>e.id===st.detailId);
    if(ev){
      const t=this.T(ev.type);
      v.dTitle=ev.title; v.dDay=ev.day; v.dTypeDark=this.typeInk(t);
      // 日付は予定そのものの年・月・日から作る。
      // 前は「いま見ている月」と予定の「日」を組み合わせていたので、8/30〜9/2 の予定を
      // 9月1日から開くと「9月30日」と出た。曜日と、今年でなければ年も添える
      {
        const DW=['日','月','火','水','木','金','土'];
        const one=(y,m,d)=>`${y!==st.today.y?y+'年':''}${m+1}月${d}日（${DW[new Date(y,m,d).getDay()]}）`;
        const b=fromDayNo(evTo(ev));
        v.dDateText = evSpan(ev)>1 ? one(ev.y,ev.m,ev.day)+'〜'+one(b.y,b.m,b.d) : one(ev.y,ev.m,ev.day);
        v.dHolText = holidayName(ev.y,ev.m,ev.day) || '';
        v.dMovedText = ev.movedFrom ? `${ev.movedFrom.m+1}月${ev.movedFrom.day}日から延期` : '';
      }
      v.dStatusLabel = this.statusWord(ev);
      v.badgeChar = (ev.status==='jisseki'||ev.status==='kakutei')?'✓':'？';
      v.badgeStyle = { width:26,height:26,borderRadius:13,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,transition:'all .3s cubic-bezier(.2,.9,.2,1)',
        ...(v.badgeChar==='✓'?{background:t.color,color:'#fff'}:{background:t.paper,color:t.dark,border:'1.5px dashed '+t.color}) };
      const endShown = ev.status==='jisseki'? (ev.actualEnd||ev.end) : ev.end;
      v.dTimeText = ev.allDay ? (evSpan(ev)>1 ? this.spanLabel(ev)+'　終日' : '終日') : ev.start+'–'+endShown;
      v.dSpanText = evSpan(ev)>1 ? evSpan(ev)+'日間' : '';
      const drm = typeof ev.remindMin==='number' ? ev.remindMin : null;
      v.dRemindText = (drm===null || st.settings.notifyOff) ? '' : this.remindLabel(drm, ev.allDay)+'にお知らせ';
      // 場所は地図で開けるようにする。地図アプリを持っていなくても
      // ブラウザの Google マップに落ちるので、リンク1本で済む。
      v.dPlace = (ev.place||'').trim();
      v.dPlaceHref = v.dPlace
        ? 'https://maps.apple.com/?q='+encodeURIComponent(v.dPlace) : '';
      v.dMemo = (ev.memo||'').trim();
      // メモと場所の中の URL と電話番号は押せるようにする（会議のリンク・お店の電話）
      v.dMemoParts = linkify(v.dMemo);
      // Web 会議のリンク。欄に入れたもの、無ければ場所かメモの中の最初の URL
      { const urlIn=(t)=>{ const m=String(t||'').match(/https?:\/\/[^\s　]+/); return m?m[0]:''; };
        const L=(ev.link||'').trim() || urlIn(ev.place) || urlIn(ev.memo);
        v.dLink = L && /^https?:\/\//.test(L) ? L : (L ? 'https://'+L : '');
        v.dLinkLabel = /zoom\./i.test(L) ? 'Zoom に参加する' : /teams\./i.test(L) ? 'Teams に参加する' : /meet\.google/i.test(L) ? 'Meet に参加する' : 'リンクを開く';
        // 場所が URL だけなら、地図ではなくリンクとして扱う
        if(v.dPlace && /^https?:\/\//.test(v.dPlace)) { v.dPlace=''; v.dPlaceHref=''; } }
      // 候補日のうちの何番目か
      if(ev.candId){ const g=st.events.filter(e=>e.candId===ev.candId).sort((a,b)=>evFrom(a)-evFrom(b)); v.dCandText=`候補 ${g.findIndex(e=>e.id===ev.id)+1}/${g.length}`; } else v.dCandText='';
      v.dTimeChanged = ev.status==='jisseki' && ev.actualEnd && ev.actualEnd!==ev.end;
      v.dWantText = ev.want ? '希望 '+ev.want[0]+'–'+ev.want[1] : (v.dTimeChanged?'予定 '+ev.start+'–'+ev.end:'');
      v.dWageShown = ev.status==='jisseki' && ev.type==='baito';
      if(v.dWageShown){ v.dWorkHours=this.fmtHours(this.paidHours(ev)); v.dWage=this.fmtWage(this.wage(ev));
        v.dBreakText = this.breakMin(ev) ? '休憩 '+this.breakMin(ev)+'分を引いています' : ''; }
      const primary=(label,fn)=>{ v.dPrimaryLabel=label; v.dPrimaryAction=fn;
        v.dPrimaryStyle={marginTop:16,padding:15,borderRadius:14,textAlign:'center',fontSize:15,fontWeight:400,color:t.dark,background:t.paper,border:'1px solid '+t.color,cursor:'pointer'}; };
      if(ev.status==='nakunatta') primary('予定として戻す',()=>{ tapLight(); this.updateEvent(ev.id,{status:'kakutei'}); });
      // 働いた記録は、バイトのほか「仕事」にも付けられる（残業＝予定より延びた時間を数えるため）。給料はバイトだけ
      else if(ev.status==='kakutei' && (ev.type==='baito' || ev.type==='work') && !ev.allDay) primary('働いた記録をつける',()=>this.openDialog(ev,'worked',st.returnTo));
      else if(ev.status==='mikakutei') primary(t.ask || 'この予定、どうなった？',()=>this.openDialog(ev,'confirm',st.returnTo));
      else v.dPrimaryLabel=null;
      // 編集・コピー・削除は「…」の中にしまう。並びはタイムツリーに合わせた。
      //
      // 一度はカードの下に行で並べたが（v0.27.0）、実績の画面で詰まった。
      // 実績はカードだけで8行あり、そこに緑のボタンと行が2つ乗ると箱だらけになる。
      // 用事の画面は逆に6割が空いていて、そちらだけ見て決めたのが間違いだった。
      // **混んでいるほうに合わせて組む。**
      //
      // 緑のボタン（上）はそのまま残す。あれは「次へ進む」ための操作で、
      // 直すだけの編集とは役目が違う。
      //
      // コピーは「これからの予定」にだけ出す。実績と無くなった予定には出さない
      // ——終わったことを別の日に写す意味がないうえ、実績として写すと嘘になる。
      // 種類（バイトかどうか）では分けない。バイトこそ同じ中身が何度も来るので、
      // 種類で外すと一番効く場所で使えなくなる。分ける軸は状態のほうが1本で済む。
      const canCopy = ev.status==='kakutei' || ev.status==='mikakutei';
      v.detailMenuShown = !!st.detailMenu;
      v.onOpenDetailMenu = ()=>{ tapLight(); this.setState(s=>({detailMenu:!s.detailMenu, pressed:null})); };
      v.onCloseDetailMenu = ()=>this.setState({detailMenu:false, pressed:null});
      const mRows = [];
      // 「働いた時間を直す」は緑のボタンから、この中へ降ろした。
      // 緑は **その予定が次の状態へ進む** ときの色（まだ→決まった→働いた）。
      // 記録し終えたものを直すのは次へ進む操作ではないので、色を借りてはいけない。
      if(ev.status==='jisseki') mRows.push({key:'fix', label:'働いた時間を直す',
        fn:()=>this.openDialog(ev,'worked',st.returnTo)});
      mRows.push({key:'edit', label:'編集', fn:()=>this.openEdit(ev,st.returnTo)});
      // 日にちだけ変える（延期・前倒し）。編集画面まで行かずに済む
      if(ev.status==='kakutei'||ev.status==='mikakutei') mRows.push({key:'move', label:'日にちを変える', fn:()=>this.openDialog(ev,'move',st.returnTo)});
      // この予定を人に送る（文と、その1件の .ics）
      mRows.push({key:'send', label:'この予定を送る', fn:()=>this.sendEvent(ev)});
      // 誕生日や祝日のように、予定としては置いておきたいが「使った時間」ではないもの
      mRows.push({key:'rep', label: ev.noReport ? 'まとめに入れる' : 'まとめに入れない',
        fn:()=>this.updateEvent(ev.id,{noReport: ev.noReport ? undefined : true})});
      if(canCopy) mRows.push({key:'copy', label:'コピー', fn:()=>this.openCopy(ev,st.returnTo)});
      mRows.push({key:'del', red:true, fn:()=>this.askDelete(ev.id),
        label: ev.status==='jisseki' ? 'この実績を削除' : 'この予定を削除'});
      v.menuRows = mRows.map((r,i)=>({ label:r.label,
        // 押したらまず閉じる。開いたまま次の画面へ行くと、戻ったとき開いている
        onClick:()=>{ this.setState({detailMenu:false, pressed:null}); r.fn(); },
        onDown:()=>this.setPressed('menu:'+r.key), onUp:()=>this.setPressed(null),
        style:{display:'flex',alignItems:'center',padding:'15px 18px',cursor:'pointer',
          fontSize:14.5, color: r.red ? '#A8452B' : 'var(--ink)',
          ...(i ? {borderTop:'1px solid var(--line)'} : {}),
          ...(st.pressed==='menu:'+r.key ? {background:'var(--press)'} : {})} }));
      // 「…」の真下から生える。安全域ぶん下げてから、見出しの高さ（52）を足す
      v.menuStyle = {position:'absolute', right:14, top:'calc(env(safe-area-inset-top) + 52px)',
        minWidth:196, zIndex:90, background:'var(--card)', border:'1px solid var(--line)',
        borderRadius:13, overflow:'hidden', boxShadow:'0 14px 34px rgba(0,0,0,.16)',
        transformOrigin:'top right', animation:'dlgIn .16s cubic-bezier(.2,.9,.2,1)'};
      v.onEdit=()=>this.openEdit(ev,st.returnTo);
      v.onDelete=()=>this.askDelete(ev.id);

      // ---------- カードの下の2つ ----------
      // 操作を「···」にしまったら下が空いた。そこを**書かなくても出るもの**で
      // 埋める。記録を書かせる欄を置く手もあったが、書かない日は空のままで、
      // いま困っていること（空白）がむしろ増える。
      //
      // ② その日の、ほかの予定 — 横の文脈。この予定だけ見ても、その日が
      //    決まっているかは分からない。ピルは月表示と同じ描き方にして、
      //    塗り＝確定・点線＝まだ の決まりを持ち込む（見た目の決まりを増やさない）。
      // ① これまでの「◯◯」 — 縦の文脈。前回いつ行ったか。
      //
      // 2つ置いているのは、**互いの空を埋め合う**から。予定が1件だけの日は
      // ②が1行に縮むが①が伸び、はじめての予定は①が縮むが②が出る。
      const DOWD=['日','月','火','水','木','金','土'];
      const dateWord=(e)=>`${e.m+1}月${e.day}日（${DOWD[new Date(e.y,e.m,e.day).getDay()]}）`;
      const oth = othersOnDay(st.events, ev, 3);
      v.dOthersLabel = `${ev.m+1}月${ev.day}日の、ほかの予定`;
      v.dOthersRest = oth.rest;
      v.dOthers = oth.list.map((o,i)=>{
        const ot=this.T(o.type);
        const base={height:24,boxSizing:'border-box',borderRadius:5,padding:'0 9px',fontSize:12,
          lineHeight:'24px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
          flex:1,minWidth:0};
        // 点線の枠そのものが「まだ」を示すので、月表示のような「？」は付けない
        const pill = o.status==='mikakutei'
          ? {...base, background:this.paperShow(ot.paper), color:this.inkDash(ot.color), lineHeight:'21px',
             border:'1.5px dashed '+this.softLine(ot.color)}
          : {...base, background:this.softFill(ot.color), color:this.inkOn(ot.color)};
        return { title:o.title, when: o.allDay ? '終日' : (o.start||''), pillStyle:pill,
          // 押したときの動きは月表示と同じ（点線なら「どうなった？」が開く）。
          // 戻り先は変えない——予定から予定へ渡り歩いても、戻るで元の一覧に出る
          onClick:()=>this.openFor(o, st.returnTo),
          onDown:()=>this.setPressed('oth:'+o.id), onUp:()=>this.setPressed(null),
          rowStyle:{display:'flex',alignItems:'center',gap:8,padding:'12px 16px',cursor:'pointer',
            ...(i ? {borderTop:'1px solid var(--line-faint)'} : {}),
            ...(st.pressed==='oth:'+o.id ? {background:'var(--press)'} : {})} };
      });

      const hist = historyFor(st.events, ev);
      v.dHistLabel = `これまでの「${ev.title}」`;
      v.dHist = hist ? { year:`今年 ${hist.yearNth}回目`, month:`今月 ${hist.monthNth}回目`,
        prev: dateWord(hist.prev), ago: agoText(hist.daysAgo) } : null;
    } else { v.dTitle=''; v.dPrimaryLabel=null; v.detailMenuShown=false; v.menuRows=[];
      v.dOthers=[]; v.dOthersRest=0; v.dHist=null; }

    // ---------- 取り返しのつかない操作の確認 ----------
    // 削除と、控えからの復元。どちらも同じ覆いを使う。
    v.confirmShown = !!st.confirmDelete || !!st.confirmRestore;
    if(st.confirmRestore){
      const r=st.confirmRestore;
      const at = r.at ? new Date(r.at) : null;
      v.confirmTitle = '控えから戻しますか？';
      v.confirmBody = (r.merge
          ? `控えの${r.count}件のうち、いま入っていない予定だけを足します。同じ予定は新しいほうを残します。`
          : `いま入っている${st.events.length}件は、控えの${r.count}件に置き換わります。`)
        + (at ? `（控えは ${at.getFullYear()}年${at.getMonth()+1}月${at.getDate()}日 のもの）` : '')
        + (r.dropped ? ` 読めない予定が${r.dropped}件あり、それは戻せません。` : '')
        + (st.events.length ? ' 戻す前のいまの状態は、控えとして端末に残します。' : '');
      v.confirmOkLabel = r.merge ? '足す' : '戻す';
      v.onConfirmDelete = ()=>this.doRestore();
      v.onCancelDelete = ()=>this.setState({confirmRestore:null});
      // 置き換えずに、足りない予定だけ足す（2台で使っていた人向け）
      if(st.events.length){
        v.repDeleteShown = true;
        v.repDeleteOn = !!r.merge;
        v.repDeleteLabel = '置き換えずに、足りない予定だけ足す';
        v.onToggleRepDelete = ()=>{ tapLight(); this.setState(s=>({confirmRestore:{...s.confirmRestore, merge:!s.confirmRestore.merge}})); };
        v.repDeleteBox = {width:20,height:20,borderRadius:6,flexShrink:0,
          border:'1.5px solid '+(r.merge?'var(--ink)':'var(--line)'), background:r.merge?'var(--ink)':'transparent',
          color:'var(--card)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700};
      }
    } else if(v.confirmShown){
      const target = st.events.find(e=>e.id===st.confirmDelete);
      v.confirmTitle = target ? `「${target.title}」を削除しますか？` : '削除しますか？';
      // 消しても30日は戻せる（設定の「最近消した予定」）。「元に戻せません」と脅さない
      v.confirmBody = target && target.status==='jisseki'
        ? '働いた記録も一緒に消えます。30日間は、設定の「最近消した予定」から戻せます。'
        : '30日間は、設定の「最近消した予定」から戻せます。';
      v.confirmOkLabel = '削除する';
      v.onConfirmDelete = ()=>this.doDelete();
      v.onCancelDelete = ()=>this.setState({confirmDelete:null, deleteRest:false});
      // くり返しで作ったものなら、「これ以降ぜんぶ」もえらべるようにする。
      // 90件を1件ずつ消させるわけにいかない。
      if(target && target.repId){
        const rest=st.events.filter(e=>e.repId===target.repId && evFrom(e)>=evFrom(target)).length;
        if(rest>1){
          v.repDeleteShown = true;
          v.repDeleteOn = !!st.deleteRest;
          v.repDeleteLabel = `この日から先のくり返しも消す（${rest}件）`;
          v.onToggleRepDelete = ()=>{ tapLight(); this.setState(s=>({deleteRest:!s.deleteRest})); };
          v.repDeleteBox = {width:20,height:20,borderRadius:6,flexShrink:0,
            border:'1.5px solid '+(st.deleteRest?'#C0392B':'var(--line)'),
            background:st.deleteRest?'#C0392B':'transparent',
            color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700};
          if(st.deleteRest) v.confirmOkLabel = `${rest}件を削除する`;
        }
      }
    }

    // ---------- DIALOG ----------
    const d=st.dialog;
    if(d){
      const t=this.T(d.type);
      if(d.phase){
        const on=d.phase==='on'||d.phase==='done';
        v.celebOn=on;
        v.heroPillStyle={ display:'inline-flex',alignItems:'center',gap:8,height:48,padding:'0 22px',borderRadius:13,fontSize:19,fontWeight:400,
          border:'1.5px '+(on?'solid':'dashed')+' '+t.color,
          background:on?t.color:t.paper, color:on?'#fff':t.dark,
          transform:on?'scale(1.06)':'scale(1)',
          transition:'background .6s cubic-bezier(.2,.9,.2,1),border-color .6s cubic-bezier(.2,.9,.2,1),color .6s cubic-bezier(.2,.9,.2,1),transform .6s cubic-bezier(.2,.9,.2,1)',
          boxShadow:on?'0 10px 30px '+t.paper:'0 1px 3px rgba(0,0,0,.08)' };
        v.heroQStyle={ position:'absolute',fontSize:15,fontWeight:400, animation:on?'qFade .42s cubic-bezier(.2,.9,.2,1) forwards':'none', opacity:on?0:1 };
        v.heroCheckStyle={ position:'absolute',fontSize:16,fontWeight:800,color:'#fff', opacity:on?1:0, animation:on?'checkPop .5s .18s cubic-bezier(.2,.9,.2,1) both':'none' };
        v.heroTitle=d.title;
        v.haloStyle={ position:'absolute',left:'50%',top:'50%',width:120,height:52,borderRadius:16,border:'2px solid '+t.color,animation:'haloOut .85s .1s cubic-bezier(.2,.9,.2,1) forwards',pointerEvents:'none' };
        v.celebCaption = t.celeb || (d.type==='asobi' ? '約束、決まった' : d.type==='baito' ? 'シフト確定' : '決まった');
        v.celebSub = (d.m+1)+'月'+d.day+'日 ・ '+d.start+'–'+d.end;
        return { v };
      }
      // 問いは種類ごと（仕事なら「この仮押さえ、どうなった？」）。組み込みの4つは前と同じ言葉
      const ASK={asobi:'約束、決まった？', yoji:'この用事、どうなりました？', baito:'このシフト、どうなりました？'};
      v.dlgHeading = d.mode==='worked' ? '何時まで働いた？'
        : (t.ask || ASK[d.type] || 'この予定、どうなりました？');
      v.dlgGoneLabel = t.gone || '無くなった';
      v.dlgMaybeLabel = t.key==='work' ? 'まだ仮のまま' : 'まだ分からない';
      v.dlgSub = (d.m+1)+'月'+d.day+'日 ・ '+d.title;
      v.dlgStart=d.start; v.dlgEnd=d.end;
      v.dlgChanged = d.start!==d.origS || d.end!==d.origE;
      v.dlgOrigText = (d.mode==='worked'?'確定 ':'希望 ')+d.origS+'–'+d.origE;
      v.dlgPrimaryLabel = d.mode==='worked'?'記録する':'確定した';
      // 白い字を載せるので、地は種類の色を35%暗くした色にする。
      // そのままの色だと、バイトの緑や遊びの橙で字と地の差が 4.5 に届かず、読みにくかった
      { const d0=this._mix(t.color,'#000000',0.35);
        v.dlgPrimaryStyle = {padding:14,borderRadius:12,textAlign:'center',fontSize:15,fontWeight:700,color:'#fff',background:`rgb(${d0[0]},${d0[1]},${d0[2]})`,cursor:'pointer',boxShadow:'0 3px 10px '+t.paper}; }
      v.dlgWheelColStyle = {width:60,height:150,overflowY:'scroll',scrollSnapType:'y mandatory',padding:'58px 0',textAlign:'center',WebkitMaskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)',maskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)'};
      const dHours=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
      const dMinutes=Array.from({length:60/MIN_STEP},(_,i)=>String(i*MIN_STEP).padStart(2,'0'));
      const dMkRow=(field,label,isFirst)=>({ label, value:d[field], open:d.picking===field,
        rowStyle:{borderBottom:isFirst?'1px solid var(--line)':'none'},
        valStyle:{fontSize:15,fontWeight:d.picking===field?700:600,color:d.picking===field?t.color:'var(--ink)',fontVariantNumeric:'tabular-nums'},
        onTap:()=>this.setState(s=>({dialog:{...s.dialog,picking:s.dialog.picking===field?null:field}})),
        hItems:dHours, mItems:dMinutes,
        hRef: field==='start'?this.dRefStartH:this.dRefEndH, mRef: field==='start'?this.dRefStartM:this.dRefEndM,
        hScroll: field==='start'?this.dScStartH:this.dScEndH, mScroll: field==='start'?this.dScStartM:this.dScEndM });
      v.dlgTimeRows=[ dMkRow('start','開始',true), dMkRow('end','終了',false) ];

      // ---------- 休憩（実績を記録するときだけ） ----------
      // 休憩を引かないと、休憩が時給に入らない勤務先では金額が多めに出る。
      // 引いた結果の実働時間をその場に出して、何が起きたか見えるようにする。
      v.dlgBreakShown = d.mode==='worked';
      if(v.dlgBreakShown){
        const cur=d.breakMin||0;
        v.dlgBreakChips=[[0,'なし'],[15,'15分'],[30,'30分'],[45,'45分'],[60,'60分'],[90,'90分']]
          .map(([val,label])=>{ const sel=cur===val;
            return { label, onClick:()=>{ tapLight(); this.setState(s=>({dialog:{...s.dialog, breakMin:val}})); },
              style:{padding:'7px 11px',borderRadius:999,fontSize:12,fontWeight:sel?700:500,cursor:'pointer',whiteSpace:'nowrap',
                transition:'all .18s', background:sel?t.color:'var(--card)', color:sel?'#fff':'var(--ink-mut)',
                border:'1px solid '+(sel?t.color:'var(--line)')} }; });
        const paid=Math.max(0, this.hoursBetween(d.start,d.end) - cur/60);
        v.dlgPaidText = cur ? `実働 ${this.fmtHours(paid)}（休憩 ${cur}分を引いた）` : `実働 ${this.fmtHours(paid)}`;
      }
      // ---- 別の日になった（延期） ----
      // 「どうなった？」の答えに、確定・無くなった・まだ のほかに「別の日になった」を足した。
      // 前は延期を入れるのに、編集画面まで行って日付を直すしかなかった
      v.dlgMoveShown = d.mode==='confirm' && !d.moving;
      v.onDlgMove = ()=>{ tapLight(); this.setState(s=>({dialog:{...s.dialog, moving:true, pickY:s.dialog.y, pickM:s.dialog.m, moveTo:null}})); };
      v.dlgMoving = !!d.moving || d.mode==='move';
      if(v.dlgMoving){
        const pY=d.pickY==null?d.y:d.pickY, pM=d.pickM==null?d.m:d.pickM;
        v.dlgMoveLabel = `${pY}年${pM+1}月`;
        v.onDlgMovePrev = ()=>this.setState(s=>{ const n=shiftMonth({y:pY,m:pM},-1); return {dialog:{...s.dialog,pickY:n.y,pickM:n.m}}; });
        v.onDlgMoveNext = ()=>this.setState(s=>{ const n=shiftMonth({y:pY,m:pM},1); return {dialog:{...s.dialog,pickY:n.y,pickM:n.m}}; });
        const mws=st.settings.weekStart, DW=['日','月','火','水','木','金','土'];
        v.dlgMoveWeekdays = Array.from({length:7},(_,i)=>{ const dw=(i+mws)%7;
          return { label:DW[dw], style:{textAlign:'center',fontSize:10,fontWeight:600,padding:'4px 0',
            color: dw===0 ? HOLIDAY_RED : dw===6 ? SATURDAY_BLUE : 'var(--ink-faint)'} }; });
        const first=(new Date(pY,pM,1).getDay()-mws+7)%7, dim=new Date(pY,pM+1,0).getDate();
        const cells=[]; for(let i=0;i<first;i++) cells.push({label:'',style:{height:34}});
        const to=d.moveTo;
        for(let d2=1;d2<=dim;d2++){
          const orig = pY===d.y && pM===d.m && d2===d.day;
          const sel = to && to.y===pY && to.m===pM && to.d===d2;
          const dw2=new Date(pY,pM,d2).getDay(), hol2=holidayName(pY,pM,d2);
          cells.push({ label:d2, onClick: orig ? ()=>{} : ()=>{ tapLight(); this.setState(s=>({dialog:{...s.dialog, moveTo:{y:pY,m:pM,d:d2}}})); },
            style:{height:34,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:11,cursor:orig?'default':'pointer',
              fontSize:14,fontVariantNumeric:'tabular-nums',fontWeight:sel?700:500,
              background: sel?'var(--ink)':'transparent', color: sel?'var(--card)': orig?'var(--ink-faint)':((hol2||dw2===0)?HOLIDAY_RED:dw2===6?SATURDAY_BLUE:'var(--ink-soft)'),
              textDecoration: orig?'line-through':'none'} });
        }
        v.dlgMoveCells = cells;
        v.dlgMoveChosen = !!to;
        v.dlgMoveChosenText = to ? `${to.m+1}月${to.d}日（${DW[new Date(to.y,to.m,to.d).getDay()]}）へ` : '新しい日をえらんでください';
        v.onDlgMoveFix = ()=>this.moveEvent(d.id, to, 'kakutei');
        v.onDlgMoveKeep = ()=>this.moveEvent(d.id, to, 'mikakutei');
        v.onDlgMoveSomeday = ()=>this.toSomeday(d.id, 'month');
        v.onDlgMoveBack = ()=>this.setState(s=>(s.dialog.mode==='move' ? {dialog:null} : {dialog:{...s.dialog, moving:false}}));
        v.dlgMoveTitle = d.mode==='move' ? '日にちを変える' : '別の日になった';
      }
      v.onDlgPrimary=()=>this.dlgPrimary();
      v.onDlgNakunatta=()=>this.dlgNakunatta();
      v.onDlgStillMaybe=()=>this.setState({dialog:null});
      v.onDlgDismiss=()=>this.setState({dialog:null});
      // 3択のどれでもないとき（名前や日付を直したいとき）の逃げ道
      v.onDlgEdit=()=>{ const ev=st.events.find(e=>e.id===d.id); this.setState({dialog:null}); if(ev) this.openEdit(ev, st.returnTo); };
      v.dlgEditLabel = d.mode==='worked' ? 'この予定を編集' : '予定の内容を直す';
    }
    // ---------- いつ空いてる？ ----------
    if(v.freeShown){
      const fY=st.freeYM.y, fm=st.freeYM.m;
      const dim=new Date(fY,fm+1,0).getDate();
      const fdow=new Date(fY,fm,1).getDay();
      v.freeMonthLabel=fm+1;
      let cO=0,cA=0,cX=0; const rows=[];
      for(let d=1;d<=dim;d++){
        const dow=(fdow+d-1)%7;
        const evs = st.events.filter(e=>evCovers(e,dayNo(fY,fm,d)) && e.status!=='nakunatta');
        // 判定は dayFree（見る時間・いつもの勤務時間・休み・夜勤明けを入れたもの）
        const j=this.dayFree(fY,fm,d);
        const holD=holidayName(fY,fm,d);
        const ok=dayKey(fY,fm,d);
        const applied = st.overrides[ok] || j.mark;
        const overridden = !!st.overrides[ok];
        if(applied==='○')cO++; else if(applied==='△')cA++; else cX++;
        const isX = applied==='×';
        let mk={width:30,height:30,borderRadius:15,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:400,flexShrink:0,boxSizing:'border-box',transition:'all .2s cubic-bezier(.2,.9,.2,1)'};
        if(applied==='○') mk={...mk,color:'#1D9E75'};
        else if(applied==='×') mk={...mk,color:'#C1C5CC'};
        else { const variant=overridden?'manual':j.variant;
          if(variant==='adjust') mk={...mk,color:'#B9770F',border:'1.5px dashed #E0921C'};
          else if(variant==='partial') mk={...mk,color:'#B9770F',background:'rgba(224,146,28,.14)'};
          else mk={...mk,color:'#B9770F'}; }
        if(overridden) mk={...mk, boxShadow:'0 0 0 1.5px rgba(0,0,0,.22)'};
        const showNote = !overridden && applied==='△' && j.note;
        // ○でも、見る時間を絞っている日は「19:00以降」と添える（平日の夜だけ空いている、が分かるように）
        const winNote = !overridden && applied==='○' && j.win && !(j.win[0]<=600 && j.win[1]>=1260) ? this.fmtMin(j.win[0])+'以降' : '';
        // 日曜・祝日は赤、土曜は青。前は少し薄くなるだけで、祝日は分からなかった
        const dayColor = (holD||dow===0) ? HOLIDAY_RED : dow===6 ? SATURDAY_BLUE : (applied==='○'?'var(--ink-faint)':'var(--ink)');
        rows.push({
          day:d, dow:['日','月','火','水','木','金','土'][dow],
          rowStyle:{display:'flex',alignItems:'center',padding:'11px 16px',borderBottom:'1px solid var(--line)',opacity:isX?0.5:1,background:'var(--card)'},
          dateWrap:{width:38,flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center'},
          dowStyle:{fontSize:10,fontWeight:600,color:(holD||dow===0) ? HOLIDAY_RED : dow===6 ? SATURDAY_BLUE : 'var(--ink-mut)'},
          hol: holD||'',
          onOpenDay: ()=>{ tapLight(); this.setState({ym:{y:fY,m:fm}, screen:'day', dayNum:d, swipeRow:null, dayFrom:'free'}); },
          dayStyle:{fontSize:18,fontWeight:400,color:dayColor,fontVariantNumeric:'tabular-nums',lineHeight:'22px'},
          tags: evs.slice(0,2).map(ev=>({ text:this.pillText(ev,false), time: ev.allDay ? '終日' : (ev.start+'–'+(ev.status==='jisseki'?(ev.actualEnd||ev.end):ev.end)), style:{...this.pillStyle(ev),height:15,fontSize:10,lineHeight:'15px',padding:'0 6px',marginBottom:0,borderRadius:4,display:'inline-block',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}, timeStyle:{fontSize:10,fontWeight:600,color:'#9AA0A6',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'} })),
          note: showNote ? j.note : winNote,
          noteStyle:{fontSize:11,color: showNote && j.variant==='adjust' ? '#B9770F' : '#9AA0A6'},
          mark:applied, markStyle:mk, markWrap:{cursor:'pointer',padding:'3px',marginLeft:'6px'}, onCycle:()=>this.cycleMark(ok,j.mark),
        });
      }
      v.freeRows=rows; v.cO=cO; v.cA=cA; v.cX=cX;
      // 月が変わるたびに key も変えて、滑り込みのアニメーションをやり直させる
      v.freeListKey = fY+'-'+fm;
      v.freeListStyle = {flex:1, overflowY:'auto', background:'var(--card)',
        borderTop:'1px solid var(--line)', paddingBottom:96, touchAction:'pan-y',
        animation: st.freeDir ? (st.freeDir>0?'slideFromRight':'slideFromLeft')+' .26s cubic-bezier(.2,.9,.2,1)' : 'none'};
    }

    // 画面の左の端から右へなぞると、前の画面に戻る（iPhone のいつもの戻り方）。
    // 前は左上の「←」を押すしかなく、大きい iPhone では親指が届かなかった
    { const back={ day:v.onDayBack, detail:v.onBack, new:v.onCancel, list:v.onListBack, notices:v.onNoticesBack,
        import:v.onImportBack, doc:v.onDocBack, card:v.onCardBack, summary:v.onSummaryClose, share:v.onShareClose,
        settings: st.setPage ? ()=>this.setState({setPage:null, editTypeKey:null, editJobId:null, typeDelete:null, newType:null}) : undefined }[st.screen];
      const blocked = !!(st.dialog || st.confirmDelete || st.confirmRestore || st.ymSheet || st.discardAsk || st.repEditAsk || st.somedayPick
        || st.confirmJob || st.tplNew || st.backupListOpen || st.trashOpen || st.profileSheet);
      v.onEdgeStart = (e)=>{ const t=e.touches&&e.touches[0]; if(!t || !back || blocked) { this._edge=null; return; }
        const box=e.currentTarget.getBoundingClientRect(); const x=t.clientX-box.left;
        this._edge = x<22 ? {x:t.clientX, y:t.clientY} : null; };
      v.onEdgeEnd = (e)=>{ const t=e.changedTouches&&e.changedTouches[0]; const g=this._edge; this._edge=null;
        if(!g || !t || !back) return; const dx=t.clientX-g.x, dy=Math.abs(t.clientY-g.y);
        if(dx>70 && dy<70){ tapLight(); back(); } }; }
    // 月の見出しの詰め方。1行に「‹ 10月 2026 › 今日 🔍 ≡ 🔔」を置くと、375 の幅でちょうど足りない。
    // 前は折り返し禁止も無く、2桁の月や「今日」が出ると「10／月」「今／日」と縦に折れていた。
    // 文字を大きくすると（画面ごと拡大）使える幅が 375→300 に減るので、どの月でも折れていた。
    // 使える幅から、いちばん広い形 → 詰めた形 → いちばん詰めた形 の順に、入るものを選ぶ
    {
      const W = (typeof window!=='undefined' && window.innerWidth ? window.innerWidth : 375) / this.zoom();
      const digits = String(v.monthLabel||'').length || 1;
      const today = !!v.todayBtnShown, otherYear = String(v.year)!==String(st.today.y);
      const forms = [
        { arrowW:38, monthPx:28, yearPx:14, showYear:true, todayPad:'6px 11px', iconW:38, pad:'0 16px 10px 12px', padX:28 },
        { arrowW:30, monthPx:25, yearPx:12, showYear:otherYear, todayPad:'5px 9px', iconW:34, pad:'0 10px 10px 6px', padX:16 },
        { arrowW:26, monthPx:22, yearPx:11, showYear:otherYear, todayPad:'4px 7px', iconW:31, pad:'0 6px 10px 2px', padX:8 },
      ];
      const need = (f) => f.arrowW*2 + digits*f.monthPx*0.58 + f.monthPx + (f.showYear ? 7 + f.yearPx*2.5 : 0)
        + (today ? 13*2 + parseInt(f.todayPad.split(' ')[1],10)*2 + 8 : 0) + f.iconW*3 + 8 + f.padX;
      v.hd = forms.find((f) => need(f) <= W) || forms[forms.length-1];
    }
    // 設定の画面の値（群が増えたので別の関数に分けた）。ほかの値を上書きするので最後に呼ぶ
    if(v.settingsShown) this._settingsVals(v);
    return { v };
  }

  componentDidMount() {
    this._readSystemLook();
    this._applyTheme();
    // 入力欄に入ったらキーボードが出る。出ているあいだナビを隠す（navShown）。
    // focusout は次の入力欄へ移るときにも来るので、少し待ってから本当に離れたかを見る
    const isField = (el) => !!el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && el.type !== 'file' && el.type !== 'checkbox';
    document.addEventListener('focusin', (e) => { if (isField(e.target)) this.setState({ kbOpen: true }); });
    document.addEventListener('focusout', () => { setTimeout(() => { if (!isField(document.activeElement)) this.setState({ kbOpen: false }); }, 60); });
    // スクリーンショット撮影用。?demo=1 のときだけサンプルを表示中の月に入れる
    if (wantsDemo() && this.state.events.length === 0) {
      const { y, m } = this.state.ym;
      const kind = demoKind();
      // 社会人の見本は、使い方「会社の仕事」の種類と呼び名・空き状況の時間帯で撮る
      if (kind === 'work') {
        const r = this.applyProfile('work', this.state);
        this.setState({ types: r.types, settings: { ...r.settings, onboarded: true, barTime: true }, events: demoEvents(y, m, 'work') });
      } else this.setState({ events: demoEvents(y, m) });
    }
    // 版が上がっていたら、アップデートのお知らせを足す
    const ver = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
    this.setState((s) => ({
      notices: syncInfoNotices(s.notices, ver, s.lastSeenVersion),
      lastSeenVersion: ver,
    }));
    this._refreshNotif();
    this._syncReminders();
    onNotificationTap((eventId, kind, actionId, extra) => {
      // まとめのお知らせ：その日の一覧を開く
      if (kind === 'morning' && extra && extra.day) {
        const [y, m, d] = String(extra.day).split('-').map(Number);
        this.setState({ screen: 'day', dayNum: d, ym: { y, m }, returnTo: 'month', dayFrom: 'month', swipeRow: null });
        return;
      }
      // 日曜の見直し：まだの予定の一覧を開く
      if (kind === 'weekly') { this.setState({ screen: 'list', listTab: 'undecided', returnTo: 'month' }); return; }
      const ev = this.state.events.find((e) => String(e.id) === String(eventId));
      if (!ev) return;
      // 通知の上のボタン。開いたら、その場で反映して一言出す（取り消しもできる）
      if (actionId === 'yes' && ev.status === 'mikakutei') {
        const prev = { status: ev.status };
        this.updateEvent(ev.id, { status: 'kakutei' });
        this.setState({ screen: 'month', ym: { y: ev.y, m: ev.m } });
        this.showUndo(`「${ev.title}」を確定にしました`, { kind: 'status', id: ev.id, prev });
        return;
      }
      if (actionId === 'no' && ev.status === 'mikakutei') {
        const prev = { status: ev.status };
        this.updateEvent(ev.id, { status: 'nakunatta' });
        this.setState({ screen: 'month', ym: { y: ev.y, m: ev.m } });
        this.showUndo(`「${ev.title}」を${this.T(ev.type).gone || '無くなった'}にしました`, { kind: 'status', id: ev.id, prev });
        return;
      }
      if (actionId === 'asplanned' && ev.status === 'kakutei') {
        const prev = { status: ev.status, actualEnd: ev.actualEnd, hourly: ev.hourly };
        this.updateEvent(ev.id, { status: 'jisseki', actualEnd: ev.end, hourly: ev.type === 'baito' ? this.hourlyFor(ev) : undefined });
        this.showUndo(`「${ev.title}」を予定どおりで記録しました`, { kind: 'status', id: ev.id, prev });
        return;
      }
      if (kind === 'remind') {
        // お知らせからは、その予定を開く（前はその日の一覧だった）
        this.setState({ ym: { y: ev.y, m: ev.m } });
        this.openFor(ev, 'month');
        return;
      }
      this.openDialog(ev, 'worked', 'month');
    });
    // 開くときのロック・評価の小窓の下準備
    this._initLock();
    if (!this.state.settings.firstUseAt) this.setState((s) => ({ settings: { ...s.settings, firstUseAt: Date.now() } }));
    if (this.state.settings.overlayOn) setTimeout(() => this._loadOverlay(), 300);
    // iCloud で同期している人：開いたら向こうの変更を取り込み、こちらの変更を書く
    if (this.state.settings.sync) setTimeout(() => this._pullSync(true), 800);
    onRemoteChange(() => this._pullSync(false));
    // 設定アプリで許可してから戻ってきたら、そのまま読み込みを続ける
    this._onResume = async () => {
      if (!this._retryImportOnReturn) return;
      this._retryImportOnReturn = false;
      if (this.state.screen !== 'import') return;
      const perm = await checkCalendarAccess();
      if (perm === 'granted') this.runScan();
    };
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { this._onResume(); this._onReturn(); return; }
      // 背景に回った。このまま終了されることがあるので、待たずに書く
      this._hiddenAt = Date.now();
      this._flushFile();
    });

    // 保存は2か所（localStorage とファイル）。起動したら、どちらが新しいかを確かめる（_checkFile）。
    // localStorage が消えていたら、ファイルの最後の内容から戻す。
    this._checkFile();
    this._pruneTrash();

    // 日付が変わったら「今日」の位置と記録の催促を更新する
    this._tick = setInterval(() => {
      const t = todayParts();
      const cur = this.state.today;
      if (t.y !== cur.y || t.m !== cur.m || t.d !== cur.d) this.setState({ today: t });
      this._refreshNotif();
    }, 60000);
  }

  /**
   * アプリに戻ってきたとき。
   * 前は取り込みの続きと保存しかしておらず、日付が変わったかは1分ごとにしか見ていなかった。
   * 朝ひらくと「今日」が昨日のままのことがあった。戻った瞬間に確かめ直す。
   * 30分以上ほかのアプリにいたら、見ている画面を今月のカレンダーに戻す
   * （書きかけの予定があるときは戻さない）。
   */
  _onReturn() {
    const t = todayParts();
    const cur = this.state.today;
    const away = this._hiddenAt ? Date.now() - this._hiddenAt : 0;
    const patch = {};
    if (t.y !== cur.y || t.m !== cur.m || t.d !== cur.d) patch.today = t;
    if (away > 30 * 60000 && ['month', 'day', 'detail', 'free', 'report'].includes(this.state.screen)) {
      Object.assign(patch, { screen: 'month', ym: { y: t.y, m: t.m }, dayNum: null, detailId: null, detailMenu: false });
    }
    // ロックを入れている人：30秒以上ほかのアプリにいたら、確かめ直す
    if (this.state.settings.lock && this._lockAvailable && away > 30000) { patch.locked = true; setTimeout(() => this.unlock(), 50); }
    if (Object.keys(patch).length) this.setState(patch);
    this.maybeAskReview('open');
    this._refreshNotif();
    this._syncReminders();
    this._autoBackup();
    if (this.state.settings.sync) this._pullSync(true);
    this._widgetStamp = null;
    this._pushWidget();
    if (this._loadOverlay) this._loadOverlay();
  }

  componentWillUnmount() {
    if (this._tick) clearInterval(this._tick);
    if (this._settle) clearTimeout(this._settle);
  }

  componentDidUpdate(prevProps, prevState) {
    this._applyTheme();
    // 保存するのは、保存する中身（store.js の pack と同じ 8 つ）が入れ替わったときだけ。
    // 前は描き直すたびに保存していた。月を指で払うと、指が少し動くたびに描き直すので、
    // そのたびに全予定を文字にして localStorage へ書いていた（900 件で 30 回動かすと 32 回）。
    // 取り込みで予定が多い人ほど、指についてこなくなっていた。
    // 中身はいつも新しい配列・オブジェクトに置き換えている（直に書き換える所は無い）ので、参照で比べてよい
    if (PERSISTED.some((k) => prevState[k] !== this.state[k])) this._persist();
    // 今日の控えがまだなら、予定が変わって少したったらとる。起動と戻ってきたときだけだと、
    // 初めての日（空から入れはじめた日）は次に開くまで控えが1つも無かった
    if (prevState.events !== this.state.events && this._fileOk) {
      const la = this.state.settings.lastAutoBackup, t = this.state.today;
      const done = la && (() => { const d = new Date(la); return d.getFullYear() === t.y && d.getMonth() === t.m && d.getDate() === t.d; })();
      if (!done) { clearTimeout(this._bkT); this._bkT = setTimeout(() => this._autoBackup(), 5000); }
    }
    // 予定か通知設定が変わったときだけ予約を貼り直す
    // 予定か通知の設定（記録のリマインド・朝のまとめ・前の晩・日曜の見直し・名前を隠す）が変わったときだけ予約を貼り直す
    const NK = ['notifyOff', 'remind', 'morning', 'morningAt', 'evening', 'weekly', 'hideTitles'];
    if (prevState.events !== this.state.events || NK.some((k) => prevState.settings[k] !== this.state.settings[k])) {
      clearTimeout(this._remT);
      this._remT = setTimeout(() => this._syncReminders(), 400);
      this._refreshNotif();
    }
    // iCloud で同期している人：予定が変わったら少し待って書く（向こうから来た変更を、そのまま書き戻さない）
    if (this.state.settings.sync && ['events','types','jobs','someday','trash'].some((k) => prevState[k] !== this.state[k])) {
      if (this._fromSync) this._fromSync = false;
      else { clearTimeout(this._syncT); this._syncT = setTimeout(() => this._pushSync(), 4000); }
    }
    // 決まった予定を iPhone のカレンダーにも入れている人：変わったら少し待ってそろえる
    if (this.state.settings.exportCal && (prevState.events !== this.state.events || prevState.settings.hideTitles !== this.state.settings.hideTitles)) {
      clearTimeout(this._expT);
      this._expT = setTimeout(() => this._syncExport(), 3000);
    }
    // まとめカードのプレビュー。
    // 前は同じ見た目を JSX でもう一度組んでいたが、寸法も文字の大きさも
    // 実物と比例しておらず、プレビューでは収まっているのに書き出すと余る、
    // という食い違いが出た。実物を描いて、その画像をそのまま見せる。
    const st = this.state;
    const need = st.screen === 'summary';
    const key = need ? [st.cardKind, st.ym.y, st.ym.m, st.events.length, (st.jobs || []).length].join('/') : '';
    if (need && key !== this._cardKey) {
      this._cardKey = key;
      this.setState({ cardPng: this._buildCard(st.cardKind === 'year' ? 'year' : 'summary').toDataURL('image/png') });
    } else if (!need && this._cardKey) {
      this._cardKey = '';
    }
  }

  _syncReminders() {
    syncReminders(this.state.events, this.state.settings);
  }

  // 終わったのにまだ実績を入れていないバイトを、お知らせに溜める。
  // 必ず setState の中で今の notices を読む。this.state を直に読むと、
  // 同じ tick で足したアップデートのお知らせを、まだ反映されていない古い配列で
  // 上書きして消してしまう（起動時に両方が走るので、実際に消えていた）。
  _refreshNotif() {
    const now = new Date();
    this.setState((s) => {
      const next = syncShiftNotices(s.notices, s.events, now);
      const changed =
        next.length !== s.notices.length || next.some((n, i) => n.id !== s.notices[i]?.id);
      return changed ? { notices: next } : null;
    });
  }

  openNotices() {
    tapLight();
    this.setState({ screen: 'notices' });
  }

  // ---- 控え（バックアップ） ----
  // 規約に「大切な予定は控えを取ってください」と書いてある以上、
  // 取る手段と戻す手段はアプリ側が持っていないと筋が通らない。
  BACKUP_MARK = 'kimatteru';
  // 控えの形。中身の並びを変えたら1つ上げる。古い版は上の版の控えを読まない。
  BACKUP_FORMAT = 2;

  async exportBackup() {
    tapLight();
    const now = new Date();
    const stamp = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    // 中身はそのまま読める。自分だけが見られる場所に置いてもらう（書き出す前に一言出す）
    const text = JSON.stringify(JSON.parse(this._backupText()), null, 2);
    // 名前は LUKKO に。古い名前（kimatteru-backup-…）の控えも、これまでどおり戻せる（中の印で見分ける）
    const msg = await shareText(text, `LUKKO-控え-${stamp}.json`);
    this.setState((s) => ({ settings: { ...s.settings, lastExportAt: Date.now() } }));
    if (msg) this.toast(msg);
  }

  // 控えのファイルをじかにえらんで戻す。
  // 「控えを開いて全文をコピーして貼る」は、書き出した本人でも手が止まる手順だった。
  // input[type=file] は WKWebView からでもファイルアプリを開けるので、
  // これだけのためにプラグインを増やさない（増やすと iOS 側の同期も要る）。
  BACKUP_INPUT_ID = 'backup-file';
  ICS_INPUT_ID = 'ics-file';
  // 控えは予定200件でも数十KBにしかならない。桁違いのものを読みに行かない。
  BACKUP_MAX_BYTES = 5 * 1024 * 1024;

  // ---- .ics（ファイルでの出し入れ）----
  // ここが PC やほかのアプリとの橋。同期が無いあいだは、これで行き来する。
  async exportIcs() {
    tapLight();
    const text = toIcs(this.state.events);
    const now = new Date();
    const stamp = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const msg = await shareText(text, `LUKKO-${stamp}.ics`, 'text/calendar');
    if (msg) { this.setState({ shareToast: true, shareMsg: msg }); setTimeout(() => this.setState({ shareToast: false }), 2400); }
  }
  pickIcsFile() {
    tapLight();
    const el = document.getElementById(this.ICS_INPUT_ID);
    if (el) el.click();
  }
  async readIcsFile(e) {
    const el = e.target;
    const file = el.files && el.files[0];
    el.value = '';
    if (!file) return;
    let text = '';
    try { text = await file.text(); } catch (err) { text = ''; }
    this.runIcs(text);
  }
  // .ics の中身を、カレンダーの取り込みと同じ一覧に流す。画面も同じ
  runIcs(text) {
    const all = parseIcs(text);
    const fresh = dedupe(all, this.state.events);
    const guesses = guessTypes(fresh, this.state.types);
    const known = (k) => this.state.types.some((t) => t.key === k);
    const picked = fresh.map((e, i) => ({
      ...e, key: 'k' + i, on: true,
      // LUKKO が書いた種類ならそのまま。無ければ名前から当てる
      type: e.ltype && known(e.ltype) ? e.ltype : guesses[i].key,
      guessed: !(e.ltype && known(e.ltype)) && !!guesses[i].why,
      // TENTATIVE は「まだ」。LUKKO の実績はそのまま実績で戻す
      status: e.tentative ? 'mikakutei' : (e.lstatus === 'jisseki' ? 'jisseki' : 'kakutei'),
    }));
    this.setState((s) => ({ screen: 'import', imp: { ...s.imp, phase: 'found', found: picked, error: '', source: 'ics', otherOpen: false } }));
  }
  // ---- 取り込んだ予定の整理 ----
  // iPhone のカレンダーから、誕生日や祝日（行事）が本人の予定として入っていたことがある。
  // いまの取り込みはそれらを読まないが、すでに入っているものは残る。
  // ここで一覧にして、「まとめから外す」か「消す」を本人に選んでもらう。勝手には何もしない。
  // 対象は、取り込みで入った（ID が i で始まる）終日の予定。
  TIDY_WORDS = /誕生日|birthday|七夕|七五三|バレンタイン|ホワイトデー|ハロウィン|クリスマス|イブ|母の日|父の日|敬老の日|節分|ひな祭り|ひなまつり|こどもの日|大晦日|正月|元日|成人の日|建国記念|春分|昭和の日|憲法記念|みどりの日|海の日|山の日|秋分|スポーツの日|文化の日|勤労感謝|天皇誕生日|祝日|休日|振替/i;
  tidyTargets(){
    return this.state.events.filter(e => e.allDay && typeof e.id==='string' && e.id.startsWith('i') && !e.noReport);
  }
  openTidy(){
    tapLight();
    const list = this.tidyTargets()
      .sort((a,b)=>(a.y-b.y)||(a.m-b.m)||(a.day-b.day))
      .map(e=>({ key:e.id, id:e.id, title:e.title, y:e.y, m:e.m, day:e.day, start:e.start, end:e.end, allDay:true,
        type:e.type, status:e.status, on: this.TIDY_WORDS.test(e.title||'') }));
    this.setState(s=>({ screen:'import', imp:{ ...s.imp, phase:'found', found:list, error:'', source:'tidy', otherOpen:false } }));
  }
  // まとめから外す。予定はカレンダーに残る
  tidySkip(){
    const ids = new Set((this.state.imp.found||[]).filter(e=>e.on).map(e=>e.id));
    if(!ids.size) return;
    tapLight();
    const now=Date.now();
    this.setState(s=>({ events:s.events.map(e=>ids.has(e.id)?{...e, noReport:true, updatedAt:now}:e),
      imp:{...s.imp, phase:'done', added:ids.size, tidied:'skip'} }));
  }
  // 消す。戻せないので、いまの削除と同じ重さで
  tidyDelete(){
    const ids = new Set((this.state.imp.found||[]).filter(e=>e.on).map(e=>e.id));
    if(!ids.size) return;
    stampHeavy();
    this.setState(s=>({ events:s.events.filter(e=>!ids.has(e.id)),
      imp:{...s.imp, phase:'done', added:ids.size, tidied:'delete'} }));
  }
  pickBackupFile() {
    tapLight();
    const el = document.getElementById(this.BACKUP_INPUT_ID);
    // ファイルをえらべない環境なら、黙って何も起きないのではなく貼り付けを開く
    if (!el) { this.setState({ pasteOpen: true, backupError: 'ファイルをえらべませんでした。貼り付けで戻してください。' }); return; }
    el.click();
  }

  async readBackupFile(e) {
    const el = e.target;
    const file = el.files && el.files[0];
    // 同じファイルをもう一度えらんでも change が起きるように、値を空に戻しておく
    el.value = '';
    if (!file) return;
    if (file.size > this.BACKUP_MAX_BYTES) {
      this.setState({ backupError: 'このファイルは控えにしては大きすぎます。書き出した控えをえらんでください。' });
      return;
    }
    let text;
    try { text = await file.text(); }
    catch (err) { this.setState({ backupError: 'ファイルを読めませんでした。もう一度えらんでください。' }); return; }
    const r = this.parseBackup(text);
    // 読めなかった理由は、貼り付けのときと同じ言い方で出す
    if (r.error) { this.setState({ backupError: r.error }); return; }
    tapLight();
    this.setState({ backupError: '', confirmRestore: r });
  }

  // 貼り付けられた文字列を確かめる。おかしければ理由を返す。
  parseBackup(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { error: '控えの中身を読めませんでした。全文が貼れているか確かめてください。' }; }
    if (!obj || obj.app !== this.BACKUP_MARK) return { error: 'このアプリの控えではないようです。' };
    // 先の版で書かれた控えは読まない。中身の形が変わっているかもしれず、
    // 黙って読むと、戻したつもりで壊れた予定が並ぶ。
    // 「読めない」と言われるほうが、気づけるぶんましだと考える。
    if ((obj.format | 0) > this.BACKUP_FORMAT) {
      return { error: 'この控えは新しい版のアプリで作られています。アプリを最新にしてから戻してください。' };
    }
    const d = obj.data;
    if (!d || !Array.isArray(d.events)) return { error: '控えに予定が入っていません。' };
    // 数える前にふるいにかける。ここで出す件数と、実際に戻る件数を合わせる。
    const events = sanitizeEvents(d.events);
    return { data: { ...d, events }, count: events.length,
      dropped: d.events.length - events.length, at: obj.exportedAt };
  }

  askRestore() {
    const r = this.parseBackup(this.state.backupText || '');
    if (r.error) { this.setState({ backupError: r.error }); return; }
    tapLight();
    this.setState({ backupError: '', confirmRestore: r });
  }

  doRestore() {
    const r = this.state.confirmRestore;
    if (!r) return;
    stampHeavy();
    // 戻すと中身が丸ごと入れ替わる。戻す直前の状態を、控えとして1つ残しておく
    if (this.state.events.length) writeBackup('before', this._backupText());
    const d = r.data;
    // 「足りない予定だけ足す」を選んだときは、置き換えずに混ぜる。同じ予定なら新しいほうを残す
    if (r.merge) {
      const incoming = sanitizeEvents(d.events);
      const byId = new Map(this.state.events.map((e) => [e.id, e]));
      let added = 0;
      for (const e of incoming) {
        const cur = byId.get(e.id);
        if (!cur) { byId.set(e.id, e); added++; }
        else if ((e.updatedAt || 0) > (cur.updatedAt || 0)) byId.set(e.id, e);
      }
      this.setState({ events: [...byId.values()], confirmRestore: null, pasteOpen: false, backupText: '', backupError: '', screen: 'month' });
      this.toast(`${added}件の予定を足しました`);
      return;
    }
    this.setState((s) => ({
      events: sanitizeEvents(d.events),
      types: typesOk(d.types) ? mergeTypes(d.types, s.types) : s.types,
      jobs: sanitizeJobs(d.jobs),
      supports: sanitizeSupports(d.supports),
      trash: sanitizeTrash(d.trash),
      someday: sanitizeSomeday(d.someday),
      overrides: d.overrides || {},
      notices: d.notices || [],
      settings: { ...s.settings, ...(d.settings || {}) },
      lastSeenVersion: d.lastSeenVersion || s.lastSeenVersion,
      confirmRestore: null, pasteOpen: false, backupText: '', backupError: '',
      screen: 'month',
    }));
    this.toast(`${(d.events || []).length}件の予定を戻しました`);
  }
  // 端末の中の控え（自動の控え・戻す前の控え）の一覧を開く
  async openBackups() {
    tapLight();
    const list = await listBackups();
    this.setState({ backupList: list, backupListOpen: true });
  }
  async pickLocalBackup(name) {
    const text = await readBackup(name);
    const r = text ? this.parseBackup(text) : { error: '控えを読めませんでした。' };
    if (r.error) { this.setState({ backupError: r.error, backupListOpen: false }); return; }
    tapLight();
    this.setState({ backupListOpen: false, confirmRestore: r });
  }

  // 一覧では中身を出しきらず、押したら中央に開いて全文を見せる。
  // 開いた時点で既読にする（読まずに消えてしまわないように）。
  openNotice(n) {
    tapLight();
    this.setState((s) => ({
      noticeOpen: n.id,
      notices: s.notices.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
    }));
  }

  markAllRead() {
    tapLight();
    this.setState((s) => ({ notices: s.notices.map((x) => ({ ...x, read: true })) }));
  }

  // ダークモードを html 要素にも反映する（safe area やオーバースクロールの地色のため）
  _applyTheme() {
    const dark = this.dark();
    if (this._lastDark !== dark) {
      this._lastDark = dark;
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      applyStatusBarTheme(dark);
    }
    // 文字の大きさは、予定の字（月の帯・週と日の時間の表示・日の一覧）だけに効かせる（TimeTree と同じ）。
    // 前は画面ごと拡大していて、日付や設定の字まで大きくなり、月の見出しが折れたり窮屈になったりしていた。
    // 前の版で拡大していた分は、ここで元に戻す
    const root = document.getElementById('root');
    if (root && root.style.zoom) root.style.zoom = '';
  }
  /**
   * 文字の大きさ。前は全部 px の決め打ちで、iPhone の文字の大きさの設定に合わなかった
   * （帯10px・日付11px）。WebView は iOS の本文の大きさ（-apple-system-body）を知っているので、
   * それを 17px を基準にした倍率にする。設定で「標準・大きめ・特大」も選べる。
   */
  /** 画面の拡大（もう使わない。並びを計る所のために 1 を返す） */
  zoom() { return 1; }
  /** 予定の字の倍率。設定の「予定の文字の大きさ」か、iPhone の文字の大きさ */
  evScale() {
    const f = (this.state.settings || {}).fontScale;
    if (typeof f === 'number') return Math.max(1, Math.min(1.4, f));
    return this._sysZoom || 1;
  }
  _readSystemLook() {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      this._sysDark = mq.matches;
      const onChange = () => { this._sysDark = mq.matches; this.forceUpdate(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    } catch (e) { this._sysDark = false; }
    try {
      const probe = document.createElement('span');
      probe.style.cssText = 'font:-apple-system-body;position:absolute;visibility:hidden';
      probe.textContent = 'あ';
      document.body.appendChild(probe);
      const px = parseFloat(getComputedStyle(probe).fontSize) || 17;
      document.body.removeChild(probe);
      // 標準（17px）なら 1。大きくしている人ほど上げる。上げすぎると月表示が収まらないので 1.35 まで
      this._sysZoom = Math.max(1, Math.min(1.35, Math.round((px / 17) * 20) / 20));
    } catch (e) { this._sysZoom = 1; }
  }

  // 画面に出ているカードを画像にして共有シートへ渡す
  async _shareSupporterCard() {
    tapLight();
    const sup = this.state.supports || [];
    if (!sup.length) return;
    const total = sup.reduce((a, x) => a + (x.yen | 0), 0);
    const first = new Date(Math.min(...sup.map((x) => x.at)));
    const M2 = (n) => String(n).padStart(2, '0');
    try {
      const tier = tierFor(total);
      const canvas = drawSupporterCard({
        owner: (this.state.settings.supporterName || '').trim(),
        since: `MEMBER SINCE ${first.getFullYear()}.${M2(first.getMonth() + 1)}`,
        total: '¥' + total.toLocaleString('ja-JP'),
        times: sup.length + '回',
        paper: tier.paper, foil: tier.foil, mark: tier.mark,
        sheen: tier.sheen, edge: tier.edge, tier: tier.key, fleck: tier.fleck,
      });
      const msg = await shareCanvas(canvas, 'LUKKO-サポーターカード.png');
      if (msg) {
        this.setState({ shareToast: true, shareMsg: msg });
        setTimeout(() => this.setState({ shareToast: false }), 2400);
      }
    } catch (e) {
      this.setState({ shareToast: true, shareMsg: 'カードを作れませんでした' });
      setTimeout(() => this.setState({ shareToast: false }), 2400);
    }
  }

  /** 書き出すカードを組む。プレビューにも同じものを使う */
  _buildCard(kind) {
    const st = this.state;
    const Y = st.ym.y, M = st.ym.m;
    if (kind === 'year') {
      const yr = st.events.filter((e) => e.y === Y && e.status === 'jisseki' && e.type === 'baito');
      const prior = this.priorFor(Y);
      return drawYearCard({
        year: `${Y}年`,
        wage: this.splitWage(Math.round(yr.reduce((a, e) => a + this.wage(e), 0)) + prior),
        note: prior ? `うち ¥${prior.toLocaleString('ja-JP')} は使い始める前の分` : '',
        hours: this.fmtHours(yr.reduce((a, e) => a + this.paidHours(e), 0)),
        jobs: this._jobBreakdown(yr),
        months: Array.from({ length: 12 }, (_, i) =>
          yr.filter((e) => e.m === i).reduce((a, e) => a + this.paidHours(e), 0)),
      });
    }
    // 今月。稼いだ額・時間と日数・バイト先ごとの内訳だけ。
    // 「果たした約束」と「流れた予定」はやめた——前者は遊びの予定を確定にした
    // 数でしかなく、約束を果たしたかどうかは誰も記録していない。
    const jis = st.events.filter((e) => e.y === Y && e.m === M && e.status === 'jisseki' && e.type === 'baito');
    return drawMonthCard({
      yearMonth: `${Y}年 ${M + 1}月`,
      wage: this.splitWage(Math.round(jis.reduce((a, e) => a + this.wage(e), 0))),
      hours: this.fmtHours(jis.reduce((a, e) => a + this.paidHours(e), 0)),
      days: jis.length,
      jobs: this._jobBreakdown(jis),
    });
  }

  async _shareCard(kind) {
    tapLight();
    const st = this.state;
    const Y = st.ym.y, M = st.ym.m;
    try {
      let canvas, name;
      if (kind === 'summary' || kind === 'year') {
        canvas = this._buildCard(kind);
        name = kind === 'year' ? `LUKKO-まとめ-${Y}.png` : `LUKKO-まとめ-${Y}-${M + 1}.png`;
      } else {
        // 空いてる日の画像。月は空き状況で見ている月、判定は空き状況と同じ
        const ws = st.settings.weekStart;
        const wl = ['日', '月', '火', '水', '木', '金', '土'];
        const FY = st.freeYM.y, FM = st.freeYM.m;
        const so = this.shareOpt();
        const W = this.freeWords(so);
        canvas = drawFreeCard({
          monthLabel: FM + 1,
          weekdays: Array.from({ length: 7 }, (_, i) => wl[(i + ws) % 7]),
          cells: this.freeCells(FY, FM),
          lead: W.lead, title: W.title(FM + 1), legend: W.legend,
          // 署名は「何のアプリで作ったか」だけ。送る人が選んだときだけ一言を足す
          signSub: so.sign ? '空いてる日だけを送れるカレンダー（App Store で「LUKKO」）' : '',
        });
        name = `LUKKO-空いてる日-${FY}-${String(FM + 1).padStart(2, '0')}.png`;
      }
      const msg = await shareCanvas(canvas, name);
      if (msg) {
        this.setState({ shareToast: true, shareMsg: msg });
        setTimeout(() => this.setState({ shareToast: false }), 2400);
      }
      if (kind === 'free') this.maybeAskReview('share');
    } catch (e) {
      this.setState({ shareToast: true, shareMsg: '画像を作れませんでした' });
      setTimeout(() => this.setState({ shareToast: false }), 2400);
    }
  }

  /**
   * 起動したとき、2か所の保存のどちらから始めるかを決める。
   *
   * 前は localStorage に中身があれば、それだけを使っていた。空き容量が足りずに
   * localStorage へ書けない日が続くと、古い中身で始まり、次の保存でファイルの新しいほうまで
   * 古い中身で上書きしてしまう。いちばん悪い形で予定が消える。
   *
   * 決め方：中身が違っていて、ファイルのほうが後に書かれていたら、ファイルから始める。
   * そのとき古いほう（localStorage の中身）は、上書きする前に控えに残す。
   * ファイルを確かめ終わるまでは、ファイルへの保存を止めておく（確かめる前に上書きしないため）。
   */
  async _checkFile() {
    if (!isNative()) { this._fileOk = true; return; }
    let saved = null;
    try { saved = await readFile(); } catch (e) { saved = null; }
    try {
      const ok = saved && Array.isArray(saved.events) && saved.events.length;
      if (ok && !this._hadLocal) {
        // localStorage が消えていた。起動してから何か作っていたら、上書きしない
        if (!this.state.events.length) this._adoptSaved(saved, { recovered: true });
      } else if (ok && this._localSaved) {
        const pick = (o) => JSON.stringify([o.events || [], o.jobs || [], o.types || []]);
        const L = this._localSaved;
        if ((saved.savedAt || 0) > (L.savedAt || 0) && pick(saved) !== pick(L)) {
          await writeBackup('before', this._backupText(L));
          this._adoptSaved(saved, { newer: true });
        }
      }
    } catch (e) { /* 確かめられなくても起動は止めない */ }
    this._fileOk = true;
    this._scheduleFileSave();
    this._autoBackup();
  }
  // 保存されていた中身で、いまの状態を置き換える
  _adoptSaved(saved, why) {
    const events = sanitizeEvents(saved.events);
    if (!events.length) return;
    this.setState((s) => ({
      events,
      types: typesOk(saved.types) ? mergeTypes(saved.types, s.types) : s.types,
      overrides: saved.overrides || s.overrides,
      settings: { ...s.settings, onboarded: true, ...(saved.settings || {}) },
      notices: saved.notices || s.notices,
      jobs: sanitizeJobs(saved.jobs),
      supports: sanitizeSupports(saved.supports),
      trash: sanitizeTrash(saved.trash),
      someday: sanitizeSomeday(saved.someday),
      gone: sanitizeGone(saved.gone),
      recovered: why.recovered ? events.length : s.recovered,
    }));
    if (why.newer) this.toast('新しいほうの保存から開きました（古いほうは控えに残しました）', 4200);
  }
  /** 控えの中身（書き出す控えと同じ形） */
  _backupText(src) {
    const s = src || this.state;
    const ver = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
    const data = {};
    for (const k of PERSISTED) data[k] = s[k];
    return JSON.stringify({ app: this.BACKUP_MARK, format: this.BACKUP_FORMAT, appVersion: ver,
      exportedAt: new Date().toISOString(), data });
  }
  /**
   * 1日に1回、端末の中に控えを書く（backup.js）。予定が1件も無いうちは書かない。
   * 起動したときと、アプリに戻ってきたときに呼ぶ。今日のぶんがあれば何もしない
   */
  async _autoBackup() {
    if (this._backingUp || !this.state.events.length) return;
    this._backingUp = true;
    try {
      if (!(await hasTodayBackup())) {
        const name = await writeBackup('auto', this._backupText());
        if (name) {
          this.setState((s) => ({ settings: { ...s.settings, lastAutoBackup: Date.now() } }));
          await pruneBackups();
        }
      }
    } catch (e) { /* 控えが書けなくても、使うのは止めない */ }
    this._backingUp = false;
  }
  // 30日たった「最近消した予定」を捨てる
  _pruneTrash() {
    const t = this.state.trash || [];
    const kept = sanitizeTrash(t);
    if (kept.length !== t.length) this.setState({ trash: kept });
  }

  // 予定が消えることは、機能がひとつ動かないのとは重さが違う。
  // すぐ書くほう（localStorage）と、消えにくいほう（ファイル）の両方に書く。
  _persist() {
    // ここは保存する中身が変わったときだけ呼ばれる（componentDidUpdate）
    const ok = saveLocal(this.state);
    // 書けなかったことを黙って飲み込まない。画面に出して、控えを促す。
    if (ok === !!this.state.saveFailed) this.setState({ saveFailed: !ok });
    this._scheduleFileSave();
  }

  // ファイルは毎打鍵で書くと重いので、手が止まってから書く。
  // アプリが背景に回るときは待たずに書く（そのまま終了されることがある）。
  _scheduleFileSave() {
    clearTimeout(this._fileTimer);
    this._fileTimer = setTimeout(() => this._flushFile(), 1200);
  }
  _flushFile() {
    clearTimeout(this._fileTimer);
    // 起動時の確かめ（_checkFile）が済むまでは、ファイルに書かない。
    // 先に書くと、新しいほうのファイルを古い中身で上書きしてしまう
    if (this._fileOk) saveFile(this.state);
    this._pushWidget();
  }

  // ウィジェットへの受け渡し。ファイルを書くのと同じ間合いでよい——
  // ホーム画面のウィジェットは、そもそも数分おきにしか描き直されない。
  // 予定に関わるものが変わったときだけ渡す（画面を切り替えただけでは渡さない）。
  _pushWidget() {
    if (!widgetAvailable()) return;
    if (this._widgetStamp === null) { this._widgetStamp = undefined; }
    const sig = [this.state.events.length, this.state.types.length, this.state.settings.weekStart].join('/');
    const stamp = JSON.stringify(this.state.events) + sig;
    if (stamp === this._widgetStamp) return;
    this._widgetStamp = stamp;
    pushWidget(this.state).then((r) => { this._widgetLast = r; });
  }

  render() {
    const { v } = this.renderVals();
    return renderApp(v);
  }
}


