// App Store のスクリーンショット撮影用のサンプル予定。
// `?demo=1` を付けて開いたときだけ、表示中の月に流し込む。通常の利用では一切現れない。
const RAW = [
  { day: 1, type: 'baito', title: 'カフェ', start: '17:00', end: '22:00', status: 'jisseki', actualEnd: '22:30' },
  { day: 3, type: 'baito', title: 'カフェ', start: '17:00', end: '21:00', status: 'jisseki', actualEnd: '21:00' },
  { day: 4, type: 'asobi', title: '映画', start: '19:00', end: '22:00', status: 'kakutei' },
  { day: 6, type: 'baito', title: 'カフェ', start: '10:00', end: '15:00', status: 'jisseki', actualEnd: '15:15' },
  { day: 8, type: 'baito', title: '倉庫バイト', start: '09:00', end: '17:00', status: 'nakunatta' },
  { day: 11, type: 'asobi', title: 'BBQ', start: '12:00', end: '17:00', status: 'mikakutei' },
  { day: 13, type: 'yoji', title: '歯医者', start: '18:00', end: '19:00', status: 'kakutei' },
  { day: 14, type: 'baito', title: 'カフェ', start: '17:00', end: '22:00', status: 'jisseki', actualEnd: '22:00' },
  { day: 15, type: 'yoji', title: '研修', start: '09:00', end: '22:00', status: 'kakutei' },
  { day: 16, type: 'baito', title: 'カフェ', start: '17:00', end: '22:00', status: 'jisseki', actualEnd: '23:00' },
  { day: 18, type: 'asobi', title: 'ライブ', start: '18:00', end: '22:00', status: 'mikakutei' },
  { day: 20, type: 'yoji', title: '健康診断', start: '09:00', end: '11:00', status: 'kakutei' },
  { day: 21, type: 'baito', title: 'カフェ', start: '17:00', end: '22:00', status: 'kakutei' },
  { day: 24, type: 'baito', title: 'カフェ', start: '17:00', end: '22:00', status: 'mikakutei', want: ['17:00', '22:00'] },
  { day: 25, type: 'baito', title: 'カフェ', start: '12:00', end: '18:00', status: 'mikakutei' },
  { day: 26, type: 'asobi', title: '花火大会', start: '18:00', end: '22:00', status: 'mikakutei' },
  { day: 27, type: 'yoji', title: '区役所', start: '13:00', end: '14:00', status: 'mikakutei' },
  { day: 28, type: 'baito', title: 'カフェ', start: '17:00', end: '22:00', status: 'kakutei' },
];

export function demoEvents(y, m) {
  const dim = new Date(y, m + 1, 0).getDate();
  return RAW.filter((r) => r.day <= dim).map((r, i) => ({ ...r, id: 'demo' + i, y, m }));
}

export const wantsDemo = () => {
  try {
    return new URLSearchParams(location.search).get('demo') === '1';
  } catch (e) {
    return false;
  }
};
