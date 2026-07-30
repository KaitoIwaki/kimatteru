// ベルに溜まるお知らせ。
// 種類は2つだけ ——「シフトの記録を促すもの」と「アップデートのお知らせ」。

export const KIND_SHIFT = 'shift';
export const KIND_INFO = 'info';

// アップデートのお知らせ。新しい版を出すときは、ここに上から足していく。
// version はそのお知らせを出し始めた版。初回起動の人には出さない。
export const RELEASE_NOTES = [
  {
    version: '0.11.1',
    title: '規約とプライバシーポリシーを更新しました',
    body: '予定ごとのお知らせを足したので、通知についての説明を書き直しました。給料計算が休憩時間を差し引かないことも、はっきり書いています。長い文章が読みやすくなるよう、行末をそろえました。',
  },
  {
    version: '0.11.0',
    title: '設定を整理して、種類を足せるようにしました',
    body: '設定画面を短くしました。時給はバイト先ごとに決めるようにして、設定からは外しています。予定の種類は、設定から名前を変えたり新しく足したりできます。iPhone のカレンダーから祝日を取り込んでしまう問題も直しました。',
  },
  {
    version: '0.10.0',
    title: 'お知らせと、スワイプで削除ができます',
    body: '予定ごとに「30分前に知らせて」を設定できるようになりました。10分前から1週間前までえらべます。予定の一覧は左にスワイプすると削除できます。予定を作る画面も、必要なところだけ開く形にして短くしました。時刻は5分きざみでえらべます。',
  },
  {
    version: '0.9.0',
    title: '何日か続く予定を、1本の帯で置けます',
    body: '合宿や旅行のように何日か続く予定は、まとめて1本の帯になりました。終日をえらぶと「何日間」が出ます。カレンダーの線を減らして、予定の名前も長く出るようにしています。',
  },
  {
    version: '0.5.0',
    title: '祝日と、お知らせの一覧を追加しました',
    body: 'カレンダーの祝日が赤くなりました。このベルからは、記録し忘れているシフトやアップデートのお知らせをまとめて見られます。',
  },
  {
    version: '0.3.0',
    title: 'iPhone のカレンダーから取り込めます',
    body: '設定の「予定の取り込み」から、いま使っているカレンダーの予定をまとめて持ってこられます。読むだけで、書き込みはしません。',
  },
];

export const shiftNoticeId = (eventId) => 'shift-' + eventId;
export const infoNoticeId = (version) => 'info-' + version;

/**
 * 終わったのにまだ実績を入れていないバイトについて、お知らせを作る。
 * すでに同じものがあれば作らない。記録済みになったものは取り除く。
 */
export function syncShiftNotices(notices, events, now) {
  const t = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (s) => { const [h, mm] = String(s).split(':').map(Number); return h * 60 + mm; };

  // 「終わったのにまだ記録していない」バイト（今日より前の日も含める）
  const due = events.filter((e) => {
    if (e.type !== 'baito' || e.status !== 'kakutei' || e.allDay) return false;
    if (e.y > t.y) return false;
    if (e.y === t.y && e.m > t.m) return false;
    if (e.y === t.y && e.m === t.m && e.day > t.d) return false;
    if (e.y === t.y && e.m === t.m && e.day === t.d && toMin(e.end) > mins) return false;
    return true;
  });

  const dueIds = new Set(due.map((e) => shiftNoticeId(e.id)));
  // 記録済み・削除済みのシフトのお知らせは消す
  let out = notices.filter((n) => n.kind !== KIND_SHIFT || dueIds.has(n.id));

  for (const e of due) {
    const id = shiftNoticeId(e.id);
    if (out.some((n) => n.id === id)) continue;
    out.push({
      id,
      kind: KIND_SHIFT,
      eventId: e.id,
      title: `${e.title}、おつかれさま`,
      body: `実働時間はどうでしたか？タップして記録しよう（${e.start}–${e.end}）`,
      at: new Date(e.y, e.m, e.day, ...String(e.end).split(':').map(Number)).getTime(),
      read: false,
    });
  }
  return out;
}

/**
 * 版の新しい・古いを数として比べる。
 * 文字列のまま比べると '0.10.0' < '0.9.0' になってしまい、
 * 0.10 以降のお知らせが誰にも出なくなる。
 */
export function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** 版が上がったときに、アップデートのお知らせを足す */
export function syncInfoNotices(notices, currentVersion, lastSeenVersion) {
  // 初めて使う人には、過去のお知らせを出さない
  if (!lastSeenVersion) return notices;
  if (lastSeenVersion === currentVersion) return notices;
  const out = [...notices];
  for (const r of RELEASE_NOTES) {
    if (cmpVersion(r.version, lastSeenVersion) <= 0) continue;
    // まだ配っていない版のお知らせは出さない（書きかけを取り違えないように）
    if (cmpVersion(r.version, currentVersion) > 0) continue;
    const id = infoNoticeId(r.version);
    if (out.some((n) => n.id === id)) continue;
    out.push({ id, kind: KIND_INFO, title: r.title, body: r.body, at: Date.now(), read: false });
  }
  return out;
}

export const unreadCount = (notices) => notices.filter((n) => !n.read).length;

/** 新しい順に並べる */
export const sortNotices = (notices) => [...notices].sort((a, b) => b.at - a.at);

// 「たった今」「3時間前」のような言い方にする
export function relativeTime(ms, now) {
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return min + '分前';
  const hour = Math.floor(min / 60);
  if (hour < 24) return hour + '時間前';
  const day = Math.floor(hour / 24);
  if (day < 7) return day + '日前';
  const d = new Date(ms);
  return d.getMonth() + 1 + '月' + d.getDate() + '日';
}
