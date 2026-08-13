// ウィジェットに渡す中身を作る。
//
// ウィジェットは Swift で書かれた別のプログラムで、このアプリの予定を直接は
// 読めない。共有の置き場（App Group）に、こちらが書き出したものだけが見える。
// つまり「ここで書き出したもの」＝「ウィジェットに出せるもの」。
//
// 大事な決めごとがひとつある。**「今日のぶん」を書き出さない。**
// 書き出すのは日付ごとの窓（前日から3週間ぶん）で、どれが今日かは
// ウィジェット側が自分で決める。アプリを2日開かなかったときに、
// 「今日」として書いたものが古い日を指してしまうのを避けるため。
//
// ここは純粋な計算だけにしてある（保存も通信もしない）ので、Node で試せる。

export const WIDGET_VERSION = 1;

// 何日ぶん書き出すか。前日 ＋ 今日 ＋ 先20日。
// それに加えて「今月まるごと」も必ず入れる（月のカレンダーを出すため）。
// アプリをしばらく開かなくても、ウィジェットが空にならない長さ。
// 前日も入れるのは、日付が変わった直後に「今日」を跨いでも困らないようにするため。
const BACK_DAYS = 1;
const AHEAD_DAYS = 20;

// 1日に載せる予定の数と、持ち物の数・長さの上限。
// 置き場は小さな設定領域なので、際限なく太らせない。
const MAX_PER_DAY = 8;
const MAX_MEMO = 6;
const MEMO_LEN = 20;
const TITLE_LEN = 24;

const pad2 = (n) => String(n).padStart(2, '0');
const dayNo = (y, m, d) => Math.floor(Date.UTC(y, m, d) / 86400000);
const fromDayNo = (n) => new Date(n * 86400000);
const key = (n) => {
  const d = fromDayNo(n);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

const evSpan = (e) => Math.max(1, Math.min(60, (e && e.days) | 0 || 1));
const evFrom = (e) => dayNo(e.y, e.m, e.day);
const evTo = (e) => evFrom(e) + evSpan(e) - 1;

const cut = (s, n) => {
  const t = String(s || '').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

/**
 * メモを持ち物の並びにする。
 * 行で分ける。読点で切ると「名札、と黒い靴下」のような文まで刻んでしまうので、
 * 書いた人が行を分けたときだけ、こちらも分ける。
 */
export function memoLines(memo) {
  const raw = String(memo || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!raw.length) return [];
  return raw.slice(0, MAX_MEMO).map((s) => cut(s, MEMO_LEN));
}

/** 塗りで出すか（決まっている）、点線で出すか（まだ） */
const isSolid = (e) => e.status === 'kakutei' || e.status === 'jisseki';

/**
 * ウィジェットに渡すひとかたまりを作る。
 *
 * @param state  events / types / settings を持つもの（アプリの状態）
 * @param today  今日（Date）。呼ぶ側から渡す＝テストできる
 */
export function buildWidgetPayload(state, today) {
  const events = (state && state.events) || [];
  const types = (state && state.types) || [];
  const settings = (state && state.settings) || {};
  const colorOf = (t) => {
    const x = types.find((y) => y.key === t);
    return (x && x.color) || '#8A8A8A';
  };

  // 窓の広さ。ウィジェットには月のカレンダーが出るので、
  // 「その月まるごと」が入っていないと、月末に見たとき月初が全部
  // 「予定なし」に見えてしまう。今月の1日から月末までは必ず含める。
  const y = today.getFullYear(), mo = today.getMonth(), d = today.getDate();
  const from = Math.min(dayNo(y, mo, d) - BACK_DAYS, dayNo(y, mo, 1));
  const to = Math.max(dayNo(y, mo, d) + AHEAD_DAYS, dayNo(y, mo + 1, 0));

  const days = {};
  for (const e of events) {
    // 「無くなった」予定は出さない。ホーム画面に流れた予定を残す意味がない
    if (!e || e.status === 'nakunatta') continue;
    const a = Math.max(from, evFrom(e));
    const b = Math.min(to, evTo(e));
    if (a > b) continue;
    const item = {
      t: e.allDay ? null : e.start || null,
      n: cut(e.title, TITLE_LEN) || '予定',
      c: colorOf(e.type),
      s: isSolid(e) ? 1 : 0,
    };
    const m = memoLines(e.memo);
    if (m.length) item.m = m;
    for (let n = a; n <= b; n++) {
      const k = key(n);
      (days[k] || (days[k] = [])).push(item);
    }
  }

  // 並べ方：終日を先に、そのあと時刻の早い順。同じ時刻なら名前で。
  for (const k of Object.keys(days)) {
    days[k].sort((x, y) => {
      if (!x.t && y.t) return -1;
      if (x.t && !y.t) return 1;
      if (x.t && y.t && x.t !== y.t) return x.t < y.t ? -1 : 1;
      return x.n < y.n ? -1 : x.n > y.n ? 1 : 0;
    });
    if (days[k].length > MAX_PER_DAY) days[k] = days[k].slice(0, MAX_PER_DAY);
  }

  return {
    v: WIDGET_VERSION,
    at: today.getTime(),
    weekStart: settings.weekStart === 1 ? 1 : 0,
    from: key(from),
    to: key(to),
    days,
  };
}
