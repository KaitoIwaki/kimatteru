// App Store のスクリーンショット撮影用のサンプル予定。
// `?demo=1`（学生の1か月）か `?demo=work`（社会人の1か月）を付けて開いたときだけ、表示中の月に流し込む。
// 通常の利用では一切現れない。
const RAW = [
  { day: 1, type: 'baito', title: 'バイト', start: '17:00', end: '22:00', status: 'jisseki', actualEnd: '22:30' },
  { day: 3, type: 'baito', title: 'バイト', start: '17:00', end: '21:00', status: 'jisseki', actualEnd: '21:00' },
  { day: 4, type: 'asobi', title: '映画', start: '19:00', end: '22:00', status: 'kakutei' },
  { day: 6, type: 'baito', title: 'バイト', start: '10:00', end: '15:00', status: 'jisseki', actualEnd: '15:15' },
  { day: 8, type: 'baito', title: '倉庫バイト', start: '09:00', end: '17:00', status: 'nakunatta' },
  { day: 11, type: 'asobi', title: 'BBQ', start: '12:00', end: '17:00', status: 'mikakutei' },
  { day: 13, type: 'yoji', title: '歯医者', start: '18:00', end: '19:00', status: 'kakutei' },
  { day: 14, type: 'baito', title: 'バイト', start: '17:00', end: '22:00', status: 'jisseki', actualEnd: '22:00' },
  { day: 15, type: 'yoji', title: '研修', start: '09:00', end: '22:00', status: 'kakutei' },
  { day: 16, type: 'baito', title: 'バイト', start: '17:00', end: '22:00', status: 'jisseki', actualEnd: '23:00' },
  { day: 18, type: 'asobi', title: 'ライブ', start: '18:00', end: '22:00', status: 'mikakutei' },
  { day: 20, type: 'yoji', title: '健康診断', start: '09:00', end: '11:00', status: 'kakutei' },
  // まとめで「同じ名前はまとめる」が見えるように。朝のジムを3回、映画をもう1本
  { day: 7, type: 'yoji', title: 'ジム', start: '07:00', end: '08:30', status: 'kakutei' },
  { day: 14, type: 'yoji', title: 'ジム', start: '07:00', end: '08:30', status: 'kakutei' },
  { day: 21, type: 'yoji', title: 'ジム', start: '07:00', end: '08:30', status: 'kakutei' },
  { day: 12, type: 'asobi', title: '映画', start: '19:00', end: '22:00', status: 'kakutei' },
  { day: 21, type: 'baito', title: 'バイト', start: '17:00', end: '22:00', status: 'kakutei' },
  { day: 24, type: 'baito', title: 'バイト', start: '17:00', end: '22:00', status: 'mikakutei', want: ['17:00', '22:00'] },
  { day: 25, type: 'baito', title: 'バイト', start: '12:00', end: '18:00', status: 'mikakutei' },
  { day: 26, type: 'asobi', title: '花火大会', start: '18:00', end: '22:00', status: 'mikakutei' },
  { day: 27, type: 'yoji', title: '区役所', start: '13:00', end: '14:00', status: 'mikakutei' },
  { day: 28, type: 'baito', title: 'バイト', start: '17:00', end: '22:00', status: 'kakutei' },
];

// 社会人の1か月。会議の仮押さえ、飲み会の候補日、出張、歯医者、家族の予定。
// 「決まった予定と、まだの予定」が、会社員の暮らしでどう並ぶかを見せる
// （学生の見本は、バイトが10件で仕事が0件だった）
const RAW_WORK = [
  // 毎週の定例（月曜）と 1on1（木曜）
  { day: 7, type: 'work', title: '定例', start: '10:00', end: '11:00', status: 'kakutei' },
  { day: 14, type: 'work', title: '定例', start: '10:00', end: '11:00', status: 'kakutei' },
  { day: 28, type: 'work', title: '定例', start: '10:00', end: '11:00', status: 'kakutei' },
  { day: 3, type: 'work', title: '1on1', start: '15:00', end: '15:30', status: 'kakutei' },
  { day: 10, type: 'work', title: '1on1', start: '15:00', end: '15:30', status: 'kakutei' },
  { day: 17, type: 'work', title: '1on1', start: '15:00', end: '15:30', status: 'kakutei' },
  { day: 24, type: 'work', title: '1on1', start: '15:00', end: '15:30', status: 'kakutei' },
  // 出張と研修
  { day: 9, type: 'work', title: '出張 大阪', start: '00:00', end: '23:59', allDay: true, days: 2, status: 'kakutei' },
  { day: 15, type: 'work', title: '研修', start: '09:00', end: '18:00', status: 'kakutei' },
  { day: 2, type: 'work', title: 'A社 商談', start: '14:00', end: '15:00', status: 'jisseki', actualEnd: '15:30' },
  { day: 16, type: 'work', title: 'A社 商談', start: '14:00', end: '15:00', status: 'kakutei' },
  // 仮押さえ（まだ）
  { day: 28, type: 'work', title: '訪問', start: '14:00', end: '15:00', status: 'mikakutei', place: '品川' },
  { day: 29, type: 'work', title: '打ち合わせ', start: '13:00', end: '14:00', status: 'mikakutei' },
  { day: 25, type: 'work', title: '面接', start: '16:00', end: '17:00', status: 'mikakutei' },
  // 用事
  { day: 12, type: 'yoji', title: '歯医者', start: '10:30', end: '11:30', status: 'kakutei' },
  { day: 19, type: 'yoji', title: '美容院', start: '14:00', end: '15:30', status: 'kakutei' },
  { day: 30, type: 'yoji', title: '区役所', start: '12:00', end: '13:00', status: 'mikakutei' },
  // プライベート（遊び）と家族
  { day: 5, type: 'asobi', title: 'ランチ会', start: '12:00', end: '14:00', status: 'kakutei' },
  { day: 26, type: 'asobi', title: '二次会', start: '18:00', end: '21:00', status: 'mikakutei' },
  { day: 30, type: 'asobi', title: '飲み会', start: '19:00', end: '21:30', status: 'mikakutei' },
  { day: 11, type: 'asobi', title: 'ジム', start: '19:30', end: '21:00', status: 'kakutei' },
  { day: 18, type: 'asobi', title: 'ジム', start: '19:30', end: '21:00', status: 'kakutei' },
  { day: 4, type: 'asobi', title: 'ジム', start: '19:30', end: '21:00', status: 'kakutei' },
  { day: 21, type: 'family', title: '帰省', start: '00:00', end: '23:59', allDay: true, days: 3, status: 'kakutei' },
  { day: 13, type: 'family', title: '家族で食事', start: '12:00', end: '14:00', status: 'kakutei' },
  { day: 27, type: 'family', title: '面談', start: '10:00', end: '10:30', status: 'mikakutei' },
];

export function demoEvents(y, m, kind) {
  const dim = new Date(y, m + 1, 0).getDate();
  const src = kind === 'work' ? RAW_WORK : RAW;
  return src.filter((r) => r.day <= dim).map((r, i) => ({ ...r, id: 'demo' + i, y, m }));
}

/** '1'（学生）/ 'work'（社会人）/ null */
export const demoKind = () => {
  try {
    const q = new URLSearchParams(location.search).get('demo');
    return q === 'work' ? 'work' : q === '1' ? '1' : null;
  } catch (e) {
    return null;
  }
};
export const wantsDemo = () => !!demoKind();
