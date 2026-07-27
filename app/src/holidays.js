// 日本の祝日を、通信なしでその場で計算する。
// 春分・秋分は近似式（1980〜2099年で一致する式）を使う。

const nthMonday = (y, m, nth) => {
  const first = new Date(y, m, 1).getDay(); // 0=日
  return 1 + ((8 - first) % 7) + (nth - 1) * 7;
};

const vernal = (y) => Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
const autumnal = (y) => Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));

// その年の「日付 → 祝日名」を作る
function buildYear(y) {
  const map = {};
  const put = (m, d, name) => { if (d >= 1) map[m + '-' + d] = name; };

  put(0, 1, '元日');
  put(0, nthMonday(y, 0, 2), '成人の日');
  put(1, 11, '建国記念の日');
  if (y >= 2020) put(1, 23, '天皇誕生日');
  put(2, vernal(y), '春分の日');
  put(3, 29, '昭和の日');
  put(4, 3, '憲法記念日');
  put(4, 4, 'みどりの日');
  put(4, 5, 'こどもの日');

  // 2020・2021 は五輪にあわせて日付が動いた
  if (y === 2020) { put(6, 23, '海の日'); put(6, 24, 'スポーツの日'); put(7, 10, '山の日'); }
  else if (y === 2021) { put(6, 22, '海の日'); put(6, 23, 'スポーツの日'); put(7, 8, '山の日'); }
  else {
    put(6, nthMonday(y, 6, 3), '海の日');
    if (y >= 2016) put(7, 11, '山の日');
    put(9, nthMonday(y, 9, 2), y >= 2020 ? 'スポーツの日' : '体育の日');
  }

  put(8, nthMonday(y, 8, 3), '敬老の日');
  put(8, autumnal(y), '秋分の日');
  put(10, 3, '文化の日');
  put(10, 23, '勤労感謝の日');

  // 国民の休日：前後を祝日にはさまれた平日
  for (let m = 0; m < 12; m++) {
    const dim = new Date(y, m + 1, 0).getDate();
    for (let d = 2; d < dim; d++) {
      if (map[m + '-' + d]) continue;
      const dow = new Date(y, m, d).getDay();
      if (dow === 0) continue;
      if (map[m + '-' + (d - 1)] && map[m + '-' + (d + 1)]) map[m + '-' + d] = '国民の休日';
    }
  }

  // 振替休日：日曜が祝日なら、次の祝日でない日
  const extra = {};
  for (let m = 0; m < 12; m++) {
    const dim = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      if (!map[m + '-' + d]) continue;
      if (new Date(y, m, d).getDay() !== 0) continue;
      let nm = m, nd = d + 1;
      // 月をまたぐ場合も追う
      for (let guard = 0; guard < 7; guard++) {
        if (nd > new Date(y, nm + 1, 0).getDate()) { nd = 1; nm += 1; }
        if (nm > 11) break;
        if (!map[nm + '-' + nd] && !extra[nm + '-' + nd]) { extra[nm + '-' + nd] = '振替休日'; break; }
        nd += 1;
      }
    }
  }
  return { ...map, ...extra };
}

const cache = new Map();

/** その日が祝日なら名前を、そうでなければ null を返す */
export function holidayName(y, m, d) {
  if (!cache.has(y)) cache.set(y, buildYear(y));
  return cache.get(y)[m + '-' + d] || null;
}
