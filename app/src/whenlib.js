// 予定が「いつ終わるか」を、日またぎまで含めて1か所で決める。
//
// 時計は 24 時で折り返すので、終わりの時刻が始まりより前なら翌日に終わる。
// 22:00–1:00 の深夜バイトがこれにあたる。給料の計算（hoursBetween）は
// 前からこの折り返しに対応していたが、通知と空き状況が見落としていた。
// 判定を散らばらせると、また片方だけ直し忘れるので、ここに集める。

export const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** 終わりが翌日にずれ込むか（終日は対象外） */
export const endsNextDay = (ev) => {
  if (!ev || ev.allDay) return false;
  const end = ev.actualEnd || ev.end;
  return toMin(end) <= toMin(ev.start) && toMin(end) !== toMin(ev.start);
};

/** その予定が実際に終わる瞬間（Date） */
export const endMoment = (ev) => {
  const end = ev.actualEnd || ev.end;
  const [h, m] = String(end).split(':').map(Number);
  return new Date(ev.y, ev.m, ev.day + (endsNextDay(ev) ? 1 : 0), h || 0, m || 0, 0, 0);
};

/**
 * その日のうちで、予定がふさいでいる終わりの分。
 * 日をまたぐなら、その日は 24:00 までふさがっている。
 * （翌日の 0:00〜1:00 側は、空き状況が見る 9:00–22:00 の外なので影響しない）
 */
export const busyEndMin = (ev) => (endsNextDay(ev) ? 1440 : toMin(ev.actualEnd || ev.end));
