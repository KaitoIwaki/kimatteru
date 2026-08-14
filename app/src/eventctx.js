// 予定の画面の下に出す、2つのまとまりの中身を作る。
//
//  ① これまでの「◯◯」 — 同じ予定が何回目か、前回はいつか
//  ② その日の、ほかの予定 — 同じ日にほかに何が入っているか
//
// どちらも**書かなくても出る**のが肝心なところ。操作を「···」にしまって
// 下が空いたのを埋めるために足したので、入力が要るものだと元の木阿弥になる。
//
// ここは計算だけにしてある（保存も通信もしない）ので、Node でそのまま試せる。

const dayNo = (y, m, d) => Math.floor(Date.UTC(y, m, d) / 86400000);
const span = (e) => Math.max(1, Math.min(60, (e && e.days) | 0 || 1));
const from = (e) => dayNo(e.y, e.m, e.day);
const to = (e) => from(e) + span(e) - 1;

/** 前後の空白だけ落とす。中の空白は別ものとして扱う（「歯医者」と「歯 医者」は別） */
const norm = (s) => String(s == null ? '' : s).trim();

/**
 * 同じ予定と見なすか。**種類が同じ ＋ 題名が完全一致**。
 *
 * くり返しの結びつき（repId）だけで結ぶ手もあったが、それだと手で入れた回が
 * 漏れる。逆に題名だけで結ぶと、種類の違う同名（バイトの「面談」と用事の
 * 「面談」）が混ざる。両方を見るのがいちばん外れが少ない。
 */
export const sameKind = (a, b) => !!a && !!b && a.type === b.type && norm(a.title) === norm(b.title);

/** 無くなった予定は、どちらのまとまりにも出さない（もう予定ではないため） */
const alive = (e) => e && e.status !== 'nakunatta';

/** 並び順：終日が先、そのあと時刻の早い順。同じなら題名、それも同じなら id */
const byTime = (x, y) => {
  const ax = x.allDay ? '' : (x.start || '');
  const ay = y.allDay ? '' : (y.start || '');
  if (ax !== ay) return ax < ay ? -1 : 1;
  if (x.title !== y.title) return x.title < y.title ? -1 : 1;
  return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
};

/** 日付の早い順。同じ日なら時刻順 */
const byDate = (x, y) => (from(x) - from(y)) || byTime(x, y);

/**
 * ① この予定が何回目か。
 *
 * 「今年18回目」は、**この予定を含めて18番目**という意味。先の予定は数に
 * 入れない——未来の予定を開くたびに数が変わると、何の数か分からなくなる。
 *
 * @returns null（はじめての予定）または { yearNth, monthNth, prev, daysAgo }
 */
export function historyFor(events, ev) {
  if (!ev) return null;
  const mine = (events || []).filter((e) => alive(e) && sameKind(e, ev)).sort(byDate);
  const i = mine.findIndex((e) => e.id === ev.id);
  if (i < 0) return null;
  const upto = mine.slice(0, i + 1);           // 自分まで
  const before = upto.slice(0, i);             // 自分より前
  if (!before.length) return null;             // これがはじめて
  const prev = before[before.length - 1];
  return {
    yearNth: upto.filter((e) => e.y === ev.y).length,
    monthNth: upto.filter((e) => e.y === ev.y && e.m === ev.m).length,
    prev,
    daysAgo: from(ev) - from(prev),
  };
}

/**
 * ② その日の、ほかの予定。
 *
 * 「その日」はこの予定が始まる日。日をまたぐ予定も、その日を覆っていれば出す。
 *
 * @param limit いくつまで並べるか。あふれたぶんは rest に数だけ返す
 *              （ここを長くすると日表示と同じものになってしまう）
 */
export function othersOnDay(events, ev, limit = 3) {
  if (!ev) return { list: [], rest: 0 };
  const n = from(ev);
  const all = (events || [])
    .filter((e) => alive(e) && e.id !== ev.id && from(e) <= n && to(e) >= n)
    .sort(byTime);
  return { list: all.slice(0, limit), rest: Math.max(0, all.length - limit) };
}

/**
 * 前回からどれくらい経ったかを、読める言葉にする。
 * 「365日前」と言われても長さが掴めないので、離れるほど単位を粗くする。
 */
export function agoText(days) {
  const n = Math.round(days);
  if (n <= 0) return '同じ日';
  if (n === 1) return '前の日';
  if (n < 45) return n + '日前';
  if (n < 365) return Math.round(n / 30.4) + 'か月前';
  return Math.round(n / 365) + '年前';
}
