import { LocalNotifications } from '@capacitor/local-notifications';
import { endMoment } from './whenlib';
import { Capacitor } from '@capacitor/core';

const native = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
};

// 通知IDは数値でなければならないので、予定のidから安定した正の整数を作る
function numericId(id) {
  const str = String(id);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000000 || 1;
}

// 通知が使える環境か。ブラウザでは使えない（閉じていると鳴らないので、無いものとして扱う）
export const canNotify = () => native();

export async function ensurePermission() {
  if (!native()) return false;
  try {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch (e) {
    return false;
  }
}

// 終日の予定は時刻を持たないので、朝9時を基準にお知らせを出す
const ALLDAY_ANCHOR_H = 9;
// iOS が抱えられる保留通知は64件。余裕をもたせて、近いものから60件だけ予約する。
const MAX_PENDING = 60;

/** その予定に設定されている「何分前に知らせるか」。設定なしなら null */
export function remindMinutes(e) {
  const n = e && e.remindMin;
  return typeof n === 'number' && n >= 0 ? n : null;
}

// お知らせの本文。いつ始まるかが一目でわかる言い方にする。
function whenText(e, rm) {
  // 1日以上前に知らせるときは「何日後か」で言う（7日前に「明日」と言わないように）
  const days = rm >= 1440 ? Math.round(rm / 1440) : 0;
  const dayWord = days === 1 ? '明日' : days === 2 ? 'あさって' : `${days}日後`;
  if (e.allDay) return days ? `${dayWord}は終日の予定です` : '今日は終日の予定です';
  const span = `${e.start}–${e.end}`;
  if (days) return `${dayWord} ${span}`;
  if (rm >= 60) return `${Math.round(rm / 60)}時間後 ${span}`;
  if (rm > 0) return `まもなく（${rm}分後） ${span}`;
  return span;
}

const dayNo = (y, m, d) => Math.floor(Date.UTC(y, m, d) / 86400000);
const span = (e) => Math.max(1, Math.min(60, (e && e.days) | 0 || 1));
const covers = (e, y, m, d) => { const n = dayNo(y, m, d), f = dayNo(e.y, e.m, e.day); return n >= f && n <= f + span(e) - 1; };
const toMin = (t) => { const [h, mm] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (mm || 0); };

/**
 * その日の予定を1行にまとめる（朝のまとめ・前の晩のまとめ）。
 * 「今日 3件（まだ1件）：10:00 定例、14:00 ◯◯社、19:00 飲み会？」
 * 名前を隠す予定・隠す設定のときは「予定あり」とだけ書く。0件なら null（送らない）
 */
export function dayDigest(events, y, m, d, hideAll) {
  const list = (events || []).filter((e) => e && e.status !== 'nakunatta' && covers(e, y, m, d))
    .sort((a, b) => ((a.allDay ? 0 : 1) - (b.allDay ? 0 : 1)) || (toMin(a.start) - toMin(b.start)));
  if (!list.length) return null;
  const und = list.filter((e) => e.status === 'mikakutei').length;
  const name = (e) => (e.secret || hideAll) ? '予定あり' : (e.title || '予定');
  const items = list.slice(0, 4).map((e) => `${e.allDay ? '' : e.start + ' '}${name(e)}${e.status === 'mikakutei' ? '？' : ''}`);
  return { count: list.length, und, text: items.join('、') + (list.length > 4 ? ` ほか${list.length - 4}件` : '') };
}

/**
 * 予約する通知を組み立てる。
 *  - worked  : シフトが終わる時刻に「記録しますか？」（設定のトグルで切る）
 *  - remind  : 予定ごとに設定された「◯分前」のお知らせ。まだの予定には「決まった／無くなった」のボタン
 *  - morning : 朝のまとめ（設定でオンにした人だけ。7日ぶん先に予約しておく）
 *  - evening : 前の晩（21:00）に、明日の予定
 *  - weekly  : 日曜の夜（20:00）に、来週まだ決まっていない予定の数
 */
function buildSchedule(events, settings) {
  const now = Date.now();
  const out = [];
  const hideAll = !!settings.hideTitles;
  const title = (e) => (e.secret || hideAll) ? '予定の時間です' : e.title;
  for (const e of events) {
    if (e.status === 'nakunatta') continue;

    if (settings.remind && e.type === 'baito' && e.status === 'kakutei' && !e.allDay) {
      // 22:00–1:00 のような深夜の勤務は、終わるのが翌日。
      // ここで日をまたがないと、シフトが始まる前に「おつかれさま」が飛ぶ。
      const at = endMoment(e);
      if (at.getTime() > now) {
        out.push({
          id: numericId('w' + e.id),
          title: (e.secret || hideAll) ? 'おつかれさまでした' : `${e.title}、おつかれさまでした`,
          body: `記録しますか？（予定 ${e.start}–${e.end}）`,
          schedule: { at },
          extra: { eventId: String(e.id), kind: 'worked' },
          actionTypeId: 'WORKED',
        });
      }
    }

    const rm = remindMinutes(e);
    // 記録済み（実績）はもう終わった予定なので知らせない
    if (rm !== null && e.status !== 'jisseki') {
      const [hh, mm] = e.allDay ? [ALLDAY_ANCHOR_H, 0] : String(e.start).split(':').map(Number);
      const at = new Date(e.y, e.m, e.day, hh, mm, 0, 0);
      at.setMinutes(at.getMinutes() - rm);
      if (at.getTime() > now) {
        // 本文に場所も入れる（会議室を確かめに開かなくて済む）。まだの予定には「（まだ）」
        const place = (!e.secret && !hideAll && e.place) ? `・${e.place}` : '';
        out.push({
          id: numericId('r' + e.id),
          title: title(e) + (e.status === 'mikakutei' ? '（まだ）' : ''),
          body: whenText(e, rm) + place,
          schedule: { at },
          extra: { eventId: String(e.id), kind: 'remind' },
          ...(e.status === 'mikakutei' ? { actionTypeId: 'UNDECIDED' } : {}),
        });
      }
    }
  }

  // まとめのお知らせ。今日から7日ぶん
  const t0 = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i);
    if (settings.morning) {
      const mAt = typeof settings.morningAt === 'number' ? settings.morningAt : 450;
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(mAt / 60), mAt % 60);
      const g = dayDigest(events, d.getFullYear(), d.getMonth(), d.getDate(), hideAll);
      if (g && at.getTime() > now) {
        out.push({ id: numericId('m' + d.toDateString()), title: `今日 ${g.count}件${g.und ? `（うち まだ${g.und}件）` : ''}`,
          body: g.text, schedule: { at }, extra: { kind: 'morning', day: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` } });
      }
    }
    if (settings.evening) {
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21, 0);
      const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const g = dayDigest(events, n.getFullYear(), n.getMonth(), n.getDate(), hideAll);
      if (g && at.getTime() > now) {
        out.push({ id: numericId('e' + d.toDateString()), title: `明日 ${g.count}件${g.und ? `（うち まだ${g.und}件）` : ''}`,
          body: g.text, schedule: { at }, extra: { kind: 'morning', day: `${n.getFullYear()}-${n.getMonth()}-${n.getDate()}` } });
      }
    }
    // 日曜の夜に、来週まだ決まっていない予定を見直す
    if (settings.weekly && d.getDay() === 0) {
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 0);
      let und = 0;
      for (let k = 1; k <= 7; k++) {
        const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
        und += events.filter((e) => e.status === 'mikakutei' && e.y === x.getFullYear() && e.m === x.getMonth() && e.day === x.getDate()).length;
      }
      if (und && at.getTime() > now) {
        out.push({ id: numericId('wk' + d.toDateString()), title: `来週、まだ決まっていない予定が${und}件`,
          body: '開いて、決まった・無くなった を片づけられます', schedule: { at }, extra: { kind: 'weekly' } });
      }
    }
  }
  // 近いものを優先する。遠い先の予定が枠を食いつぶさないように。
  out.sort((a, b) => a.schedule.at - b.schedule.at);
  return out.slice(0, MAX_PENDING);
}

// 通知の上のボタン。押すとアプリが開いて、その場で反映する
let typesReady = false;
async function registerActions() {
  if (typesReady || !native()) return;
  typesReady = true;
  try {
    await LocalNotifications.registerActionTypes({ types: [
      { id: 'UNDECIDED', actions: [
        { id: 'yes', title: '決まった', foreground: true },
        { id: 'no', title: '無くなった', destructive: true, foreground: true },
      ] },
      { id: 'WORKED', actions: [
        { id: 'asplanned', title: '予定どおり記録する', foreground: true },
        { id: 'open', title: '開いて直す', foreground: true },
      ] },
    ] });
  } catch (e) {
    typesReady = false;
  }
}

// 予定や設定が変わるたびに呼ぶ。既存の予約を消してから貼り直す。
export async function syncReminders(events, settings) {
  if (!native()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications && pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    const list = buildSchedule(events, settings);
    if (!list.length) return;
    // 出すものがあるときだけ許可を聞く（起動しただけで許可ダイアログを出さない）
    const ok = await ensurePermission();
    if (!ok) return;
    await registerActions();
    await LocalNotifications.schedule({ notifications: list });
  } catch (e) {
    // 通知が使えなくてもアプリの利用は妨げない
  }
}

// 通知をタップして起動したときに、その予定を開けるようにする
export function onNotificationTap(handler) {
  if (!native()) return;
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const extra = action?.notification?.extra;
      // actionId は、ふつうに押したとき 'tap'。ボタンなら 'yes' 'no' 'asplanned' 'open'
      if (extra && (extra.eventId || extra.kind)) handler(extra.eventId || null, extra.kind || 'worked', action.actionId || 'tap', extra);
    });
  } catch (e) {
    /* 何もしない */
  }
}
