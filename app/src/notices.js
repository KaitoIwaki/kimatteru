import { endMoment } from './whenlib';
// ベルに溜まるお知らせ。
// 種類は2つだけ ——「シフトの記録を促すもの」と「アップデートのお知らせ」。

export const KIND_SHIFT = 'shift';
export const KIND_INFO = 'info';

// アップデートのお知らせ。新しい版を出すときは、ここに上から足していく。
// version はそのお知らせを出し始めた版。初回起動の人には出さない。
//
// 書き方（アプリの文章のきまり）：
//  ・短く。1項目1文、40字くらいまで
//  ・内容が2つ以上なら、「・」で始まる行の箇条書きにする（行は \n で区切る）
//  ・何が変わったか・どう使うかだけ。理由や経緯、細かい数字は書かない（コミットメッセージに回す）
// 前は1段落に全部を詰めていて、「整理されておらず見にくい」と言われた
const L = (...lines) => lines.map((x) => '・' + x).join('\n');
export const RELEASE_NOTES = [
  {
    version: '0.31.0',
    title: '仕事の予定にも使いやすくしました',
    body: L(
      '設定の「使い方」で、会社の仕事・シフト勤務・学校とバイト・子育てから選べます',
      '選ぶと、予定の種類と呼び名が変わります（仕事の点線は「仮押さえ」）',
      '週表示と、日の「時間」表示ができました',
      '🔍 で予定を探せます',
      '候補日をまとめて置けます。1つ決めると残りを片づけます',
      '延期と、日にち未定（今月のどこか など）ができました',
      '空いてる日を「10/3（金）19時以降」のような文字でも送れます',
      '会社などの iPhone のカレンダーを重ねて見られます',
      '消した予定は30日間、「最近消した予定」から戻せます',
      '予定を毎日1回、自動で端末に控えます',
      'iCloud で、2台の iPhone の予定をそろえられます',
      'Face ID でロックできます',
      '設定の画面を見やすく作り直しました',
      '予定の文字の大きさを変えられます',
      '開始時刻を動かすと、終わりも一緒に動くようにしました',
    ),
  },
  {
    version: '0.30.0',
    title: 'まとめで、何に時間を使ったかが見られます',
    body: L(
      'まとめに、その月に何へどれだけ時間を使ったかを出します',
      '月と年で切り替えられます',
      '予定をファイル（.ics）で出し入れできます',
      '取り込みの画面を短くしました',
      'カレンダーを払ったとき、画面がずれて止まる不具合を直しました',
    ),
  },
  {
    version: '0.29.0',
    title: '名前を LUKKO に変えました',
    body: L(
      'アプリの名前を「LUKKO（ルッコ）」に変えました。中身は同じです',
      'ダークモードで、決まった予定とまだの予定を見分けやすくしました',
      'アイコンを少し変えました',
      'まとめに「使い始める前の額」を入れられます',
      '「働いた時間を直す」は、右上の「···」に移しました',
    ),
  },
  {
    version: '0.26.0',
    title: 'ウィジェットを置けるようになりました',
    body: L(
      'ホーム画面に今日の予定を置けます（小・中・大）',
      '置き方：ホーム画面を長押し →「＋」→「LUKKO」',
      'メモに書いた持ち物も並びます',
      'iOS 17 以降で使えます',
    ),
  },
  {
    version: '0.24.0',
    title: 'まとめを作り直しました',
    body: L(
      'まとめに、バイト先ごとの内訳を出します',
      'シェアするカードを作り直しました（今月は横長、今年は縦長）',
      '金額は時給と実働から出した目安です（割増・交通費は入りません）',
      '予定の色をやさしい色にしました',
    ),
  },
  {
    version: '0.23.1',
    title: 'ほかのカレンダーの予定も取り込めます',
    body: L(
      'Google・Outlook・Yahoo! なども、iPhone の設定にアカウントを足せば取り込めます',
      '手順を取り込みの画面に置きました',
      '設定の画面を整理しました',
    ),
  },
  {
    version: '0.22.3',
    title: 'サポーターカードに段ができました',
    body: L(
      '応援の合計で、カードがノーマル・ゴールド（¥1,000〜）・ブラック（¥3,000〜）に変わります',
      '見た目だけで、機能は増えません',
      '指でなぞると回せます',
    ),
  },
  {
    version: '0.20.0',
    title: 'サポーターカードを作りました',
    body: L(
      '応援してくださった方に、サポーターカードをお渡しします',
      '設定の「応援」から開けます',
      '画像にして共有できます',
    ),
  },
  {
    version: '0.19.0',
    title: '画面の地を白くしました',
    body: L(
      '画面の地をベージュから白にして、読みやすくしました',
      '設定のいちばん下に「開発を応援する」を置きました（機能は増えません）',
    ),
  },
  {
    version: '0.18.0',
    title: 'くり返しと複数日を作り直しました',
    body: L(
      'くり返しに毎月・毎年が増え、毎週は曜日を選べます',
      '同じ予定を別々の日にまとめて置けます（「＋」→「複数日」）',
      '日をまたぐ予定は、終わりが翌日だと分かるようにしました',
    ),
  },
  {
    version: '0.17.0',
    title: '控えをファイルから戻せるようになりました',
    body: L(
      '設定の「控えから戻す」で、控えのファイルを選ぶだけで戻せます',
      '戻したあと、何件戻したかを出します',
    ),
  },
  {
    version: '0.16.0',
    title: '予定が消えないようにしました',
    body: L(
      '予定を2か所に保存して、消えにくくしました',
      '保存できなかったときは、画面でお知らせします',
      'はじめての案内を作り直しました',
    ),
  },
  {
    version: '0.15.0',
    title: 'くり返し・場所・メモを足しました',
    body: L(
      '毎日・毎週の予定をまとめて置けます',
      '場所を入れると、地図で開けます',
      'メモに持ち物を書けます',
      '年月を押すと、離れた月へ飛べます',
    ),
  },
  {
    version: '0.14.0',
    title: '予定の控えを取れるようになりました',
    body: L(
      '予定をまるごとファイルに書き出せます（設定の「控え」）',
      '機種変更や紛失にそなえて、ときどき取っておいてください',
    ),
  },
  {
    version: '0.13.0',
    title: '前後の月の日付が見えるようになりました',
    body: L(
      '月のはじめと終わりのマスに、前後の月の日付を薄く出します',
      '設定からお問い合わせできます',
    ),
  },
  {
    version: '0.12.2',
    title: 'カレンダーの見た目を整えました',
    body: L(
      '月の形がすっきり見えるようにしました',
      '1日に置ける予定を4件に増やしました',
    ),
  },
  {
    version: '0.12.1',
    title: 'カレンダーを画面いっぱいに広げました',
    body: L(
      'カレンダーを画面の横いっぱいまで広げました',
      '予定の名前が6文字まで入ります',
    ),
  },
  {
    version: '0.12.0',
    title: '休憩を引いて給料を出せます',
    body: L(
      '働いた記録に休憩を入れられます',
      '給料は、休憩を引いた実働で出します',
    ),
  },
  {
    version: '0.11.2',
    title: '空き状況も横に払って月を送れます',
    body: L(
      '「いつ空いてる？」を左右に払うと、月が変わります',
      '予定の帯を細くして、見渡しやすくしました',
    ),
  },
  {
    version: '0.11.1',
    title: '規約とプライバシーポリシーを更新しました',
    body: L(
      '通知について書き足しました',
      '給料は目安であることを、はっきり書きました',
    ),
  },
  {
    version: '0.11.0',
    title: '設定を整理して、種類を足せるようにしました',
    body: L(
      '時給はバイト先ごとに決めるようにしました',
      '予定の種類の名前を変えたり、足したりできます',
      '祝日を二重に取り込む不具合を直しました',
    ),
  },
  {
    version: '0.10.0',
    title: 'お知らせと、スワイプで削除ができます',
    body: L(
      '予定ごとに「30分前」などのお知らせを付けられます',
      '一覧で予定を左へなぞると、削除できます',
      '時刻は5分きざみで選べます',
    ),
  },
  {
    version: '0.9.0',
    title: '何日か続く予定を、1本の帯で置けます',
    body: L(
      '何日か続く予定を、1本の帯で置けます',
      '予定の名前を長く出せるようにしました',
    ),
  },
  {
    version: '0.5.0',
    title: '祝日と、お知らせの一覧を追加しました',
    body: L(
      '祝日が赤くなりました',
      'ベルから、お知らせをまとめて見られます',
    ),
  },
  {
    version: '0.3.0',
    title: 'iPhone のカレンダーから取り込めます',
    body: L(
      '設定から、iPhone のカレンダーの予定をまとめて取り込めます',
      '読むだけで、書き込みはしません',
    ),
  },
];

/** 受け取ったあとに書き直したお知らせも、開いたときは今の文で見せる（端末には受け取った時の文が残っている） */
export function currentNoteText(n) {
  if (!n || n.kind !== KIND_INFO) return n;
  const r = RELEASE_NOTES.find((x) => 'info-' + x.version === n.id);
  return r ? { ...n, title: r.title, body: r.body } : n;
}

export const shiftNoticeId = (eventId) => 'shift-' + eventId;
export const infoNoticeId = (version) => 'info-' + version;

/**
 * 終わったのにまだ実績を入れていないバイトについて、お知らせを作る。
 * すでに同じものがあれば作らない。記録済みになったものは取り除く。
 */
export function syncShiftNotices(notices, events, now) {
  // 「終わったのにまだ記録していない」バイト。
  // 年月日を1段ずつ比べていたが、それだと 22:00–1:00 の深夜勤務で
  // 「1:00 はもう過ぎている」と判定され、シフトが始まる前の朝に催促が出ていた。
  // 終わる瞬間を出してから、いまと比べる。
  const due = events.filter((e) => {
    if (e.type !== 'baito' || e.status !== 'kakutei' || e.allDay) return false;
    return endMoment(e).getTime() <= now.getTime();
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
      title: `${e.title}、おつかれさまでした`,
      body: `働いた時間を記録しますか？（予定 ${e.start}–${e.end}）`,
      at: endMoment(e).getTime(),
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
