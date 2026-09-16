// ics.js の確かめ。node tools/test-ics.mjs
// 1) LUKKO → .ics → LUKKO の往復で、まだ／確定／実績・終日・日またぎが戻るか
// 2) Google カレンダー風の .ics（毎週・UTC・EXDATE・折り返し・エスケープ）が読めるか
import { toIcs, parseIcs } from '../src/ics.js';

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`);
  if (!ok) fails += 1;
};

console.log('■ 往復');
const src = [
  { id: 'a', type: 'asobi', title: '映画, 友達と; 夜', y: 2026, m: 8, day: 4, start: '19:00', end: '22:00', status: 'kakutei', memo: '一行目\n二行目', place: '新宿' },
  { id: 'b', type: 'baito', title: 'バイト', y: 2026, m: 8, day: 6, start: '17:00', end: '00:30', status: 'jisseki', actualEnd: '00:45' },
  { id: 'c', type: 'yoji', title: 'BBQ', y: 2026, m: 8, day: 11, start: '12:00', end: '17:00', status: 'mikakutei' },
  { id: 'd', type: 'asobi', title: '旅行', y: 2026, m: 8, day: 21, start: '09:00', end: '18:00', status: 'kakutei', allDay: true, days: 2 },
  { id: 'e', type: 'baito', title: '倉庫', y: 2026, m: 8, day: 8, start: '09:00', end: '17:00', status: 'nakunatta' },
];
const ics = toIcs(src);
eq('全行が 75 バイト以下', Math.max(...ics.split('\r\n').map((l) => new TextEncoder().encode(l).length)) <= 75, true);
const back = parseIcs(ics);
eq('無くなったものは書かない', back.length, 4);
eq('名前のエスケープが戻る', back[0].title, '映画, 友達と; 夜');
eq('メモの改行が戻る', back[0].memo, '一行目\n二行目');
eq('場所', back[0].place, '新宿');
eq('日またぎの実績は 23:59 まで（その日の分だけ）', [back[1].start, back[1].end], ['17:00', '23:59']);
eq('実績の印', back[1].lstatus, 'jisseki');
eq('まだ → TENTATIVE → まだ', [back[2].tentative, back[2].lstatus], [true, 'mikakutei']);
eq('終日2日', [back[3].allDay, back[3].days], [true, 2]);
eq('種類', back.map((e) => e.ltype), ['asobi', 'baito', 'yoji', 'asobi']);

console.log('■ Google 風');
const g = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'BEGIN:VEVENT',
  'DTSTART;TZID=Asia/Tokyo:20260907T180000', 'DTEND;TZID=Asia/Tokyo:20260907T210000',
  'RRULE:FREQ=WEEKLY;WKST=SU;COUNT=5;BYDAY=MO,TH',
  'EXDATE;TZID=Asia/Tokyo:20260914T180000',
  'UID:abc@google.com', 'SUMMARY:塾', 'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20260910T010000Z', 'DTEND:20260910T030000Z',      // UTC。日本なら 10:00–12:00
  'UID:utc@google.com', 'SUMMARY:これはとても長い名前の予定で、七十五バイトを超えるので折り返されて', ' いるはずです', 'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260920', 'DTEND;VALUE=DATE:20260921',
  'UID:allday@google.com', 'SUMMARY:健康診断', 'STATUS:TENTATIVE', 'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20261001T090000', 'DURATION:PT1H30M', 'UID:dur@x', 'SUMMARY:面談', 'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20261002T090000', 'DTEND:20261002T100000', 'UID:c@x', 'SUMMARY:消えた', 'STATUS:CANCELLED', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');
const gb = parseIcs(g);
const juku = gb.filter((e) => e.title === '塾');
eq('毎週 月・木 COUNT=5 から EXDATE 1つ → 4回', juku.map((e) => `${e.m + 1}/${e.day}`), ['9/7', '9/10', '9/17', '9/21']);
eq('塾の時刻（TZID は壁の時計）', [juku[0].start, juku[0].end], ['18:00', '21:00']);
const tzOff = -new Date(2026, 8, 10).getTimezoneOffset() / 60;
const utc = gb.find((e) => e.title.startsWith('これは'));
eq('UTC → 端末の時刻', utc.start, `${String(1 + tzOff).padStart(2, '0')}:00`);
eq('折り返しが戻る', utc.title.endsWith('折り返されているはずです'), true);
eq('終日 TENTATIVE', [gb.find((e) => e.title === '健康診断').allDay, gb.find((e) => e.title === '健康診断').tentative], [true, true]);
eq('DURATION', [gb.find((e) => e.title === '面談').start, gb.find((e) => e.title === '面談').end], ['09:00', '10:30']);
eq('CANCELLED は読まない', gb.some((e) => e.title === '消えた'), false);

console.log(fails ? `\n✗ ${fails} 件 外れた` : '\n全部通った');
process.exit(fails ? 1 : 0);
