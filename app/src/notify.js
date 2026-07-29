import { LocalNotifications } from '@capacitor/local-notifications';
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
  if (e.allDay) return rm >= 1440 ? '明日は終日の予定です' : '今日は終日の予定です';
  const span = `${e.start}–${e.end}`;
  if (rm >= 1440) return `明日 ${span}`;
  if (rm >= 60) return `${Math.round(rm / 60)}時間後 ${span}`;
  if (rm > 0) return `まもなく（${rm}分後） ${span}`;
  return span;
}

/**
 * 予約する通知を組み立てる。2種類ある。
 *  - worked : シフトが終わる時刻に「実働どうだった？」（設定のトグルで切る）
 *  - remind : 予定ごとに設定された「◯分前」のお知らせ（予定ごとに入れたものなので設定では切らない）
 */
function buildSchedule(events, settings) {
  const now = Date.now();
  const out = [];
  for (const e of events) {
    if (e.status === 'nakunatta') continue;

    if (settings.remind && e.type === 'baito' && e.status === 'kakutei' && !e.allDay) {
      const [hh, mm] = String(e.end).split(':').map(Number);
      const at = new Date(e.y, e.m, e.day, hh, mm, 0, 0);
      if (at.getTime() > now) {
        out.push({
          id: numericId('w' + e.id),
          title: `今日の${e.title}、おつかれさま`,
          body: `実働時間はどうでしたか？タップして記録しよう（${e.start}–${e.end}）`,
          schedule: { at },
          extra: { eventId: String(e.id), kind: 'worked' },
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
        out.push({
          id: numericId('r' + e.id),
          title: e.title,
          body: whenText(e, rm),
          schedule: { at },
          extra: { eventId: String(e.id), kind: 'remind' },
        });
      }
    }
  }
  // 近いものを優先する。遠い先の予定が枠を食いつぶさないように。
  out.sort((a, b) => a.schedule.at - b.schedule.at);
  return out.slice(0, MAX_PENDING);
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
      if (extra && extra.eventId) handler(extra.eventId, extra.kind || 'worked');
    });
  } catch (e) {
    /* 何もしない */
  }
}
