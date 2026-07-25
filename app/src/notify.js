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

// 予定の終了時刻に「実働どうだった？」を出す。
// 対象は、これから終わる確定シフト（バイト種別）だけ。
function buildSchedule(events, types) {
  const now = Date.now();
  const out = [];
  for (const e of events) {
    if (e.status !== 'kakutei' || e.allDay) continue;
    const t = types.find((x) => x.key === e.type);
    // 「実績（給料）」を持つのはバイト系だけなので、それ以外は記録を促さない
    if (e.type !== 'baito') continue;
    const [hh, mm] = String(e.end).split(':').map(Number);
    const at = new Date(e.y, e.m, e.day, hh, mm, 0, 0);
    if (at.getTime() <= now) continue;
    out.push({
      id: numericId(e.id),
      title: `今日の${e.title}、おつかれさま`,
      body: `実働時間はどうでしたか？タップして記録しよう（${e.start}–${e.end}）`,
      schedule: { at },
      extra: { eventId: String(e.id) },
    });
    if (out.length >= 30) break; // iOSの保留通知数に余裕をもたせる
  }
  return out;
}

// 予定や設定が変わるたびに呼ぶ。既存の予約を消してから貼り直す。
export async function syncReminders(events, settings, types) {
  if (!native()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications && pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    if (!settings.remind) return;
    const ok = await ensurePermission();
    if (!ok) return;
    const list = buildSchedule(events, types);
    if (list.length) await LocalNotifications.schedule({ notifications: list });
  } catch (e) {
    // 通知が使えなくてもアプリの利用は妨げない
  }
}

// 通知をタップして起動したときに、その予定を開けるようにする
export function onNotificationTap(handler) {
  if (!native()) return;
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const id = action?.notification?.extra?.eventId;
      if (id) handler(id);
    });
  } catch (e) {
    /* 何もしない */
  }
}
