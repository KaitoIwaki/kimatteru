// 実機でスクリーンショットを撮るための、1ヶ月ぶんのサンプル予定を
// 「控え」の形（BACKUP_FORMAT 2）で書き出す。
//
//   node app/tools/make-demo-backup.mjs          … 今月ぶん
//   node app/tools/make-demo-backup.mjs 2026-09  … 月を指定
//
// できたファイルを iPhone に送って（AirDrop・メール添付・iCloud Drive など）、
// アプリの 設定 →「控えから戻す」→ ファイルをえらぶ、で入る。
//
// ⚠ 復元は「置き換え」なので、いま入っている予定は消える。
//    自分の予定が入っている端末で使うなら、先に「控えを書き出す」で退避しておくこと。
//
// `?demo=1`（src/demo.js）はブラウザ用で、インストールした本物のアプリでは使えない。
// 実機で撮るにはこちら。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'store-assets');

const arg = process.argv[2];
const now = new Date();
let Y = now.getFullYear();
let M = now.getMonth();                       // 0始まり
if (arg) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(arg);
  if (!m) { console.error('月は YYYY-MM で指定してください（例 2026-09）'); process.exit(1); }
  Y = Number(m[1]); M = Number(m[2]) - 1;
  if (M < 0 || M > 11) { console.error('月が範囲外です'); process.exit(1); }
}
const DIM = new Date(Y, M + 1, 0).getDate();  // その月の日数

// バイト先。掛け持ちが見えるように2つ。時給はここで決まる（設定の時給ではない）。
const JOBS = [
  { id: 'demo-job-cafe',  name: 'カフェ', hourly: 1200 },
  { id: 'demo-job-souko', name: '倉庫',   hourly: 1300 },
];
const CAFE = JOBS[0].id;
const SOUKO = JOBS[1].id;

// 1ヶ月ぶん。塗り（確定・実績）と点線（未確定）が程よく混ざるように置いてある。
// status … jisseki=働いた記録 / kakutei=決まってる / mikakutei=まだ / nakunatta=流れた
const RAW = [
  { day: 1,  type: 'baito', title: 'カフェ',   start: '17:00', end: '22:00', status: 'jisseki', actualEnd: '22:30', breakMin: 30, jobId: CAFE },
  { day: 3,  type: 'baito', title: 'カフェ',   start: '17:00', end: '21:00', status: 'jisseki', jobId: CAFE },
  { day: 4,  type: 'asobi', title: '映画',     start: '19:00', end: '22:00', status: 'kakutei' },
  { day: 6,  type: 'baito', title: 'カフェ',   start: '10:00', end: '15:00', status: 'jisseki', actualEnd: '15:15', breakMin: 45, jobId: CAFE },
  { day: 8,  type: 'baito', title: '倉庫',     start: '09:00', end: '17:00', status: 'nakunatta', jobId: SOUKO },
  { day: 11, type: 'asobi', title: 'BBQ',      start: '12:00', end: '17:00', status: 'mikakutei' },
  { day: 13, type: 'yoji',  title: '歯医者',   start: '18:00', end: '19:00', status: 'kakutei',
    place: '東京都渋谷区道玄坂1-2-3', memo: '保険証を持っていく' },
  { day: 14, type: 'baito', title: 'カフェ',   start: '17:00', end: '22:00', status: 'jisseki', breakMin: 30, jobId: CAFE },
  { day: 15, type: 'yoji',  title: '研修',     start: '09:00', end: '17:00', status: 'kakutei' },
  { day: 16, type: 'baito', title: 'カフェ',   start: '17:00', end: '22:00', status: 'jisseki', actualEnd: '23:00', breakMin: 30, jobId: CAFE },
  { day: 18, type: 'asobi', title: 'ライブ',   start: '18:00', end: '22:00', status: 'mikakutei', remindMin: 1440 },
  { day: 20, type: 'yoji',  title: '健康診断', start: '09:00', end: '11:00', status: 'kakutei' },
  { day: 21, type: 'baito', title: 'カフェ',   start: '17:00', end: '22:00', status: 'kakutei', jobId: CAFE },
  // 日をまたぐ帯。週の境をまたいで1本に見えるのが分かりやすいので土曜から置く。
  // 日またぎは終日の予定にだけ許している（時間指定だと実働と給料の計算が壊れる）。
  { day: 22, type: 'asobi', title: '合宿',     start: '09:00', end: '18:00', status: 'kakutei', allDay: true, days: 3 },
  { day: 24, type: 'baito', title: 'カフェ',   start: '17:00', end: '22:00', status: 'mikakutei', want: ['17:00', '22:00'], jobId: CAFE },
  { day: 25, type: 'baito', title: 'カフェ',   start: '12:00', end: '18:00', status: 'mikakutei', jobId: CAFE },
  { day: 26, type: 'asobi', title: '花火大会', start: '18:00', end: '22:00', status: 'mikakutei' },
  { day: 27, type: 'yoji',  title: '区役所',   start: '13:00', end: '14:00', status: 'mikakutei' },
  { day: 28, type: 'baito', title: 'カフェ',   start: '17:00', end: '22:00', status: 'kakutei', jobId: CAFE },
  { day: 31, type: 'baito', title: '倉庫',     start: '09:00', end: '17:00', status: 'mikakutei', jobId: SOUKO },
];

const events = RAW
  .filter((r) => r.day <= DIM)                       // 短い月では溢れたぶんを落とす
  .map((r, i) => ({ ...r, id: `demo-${Y}${String(M + 1).padStart(2, '0')}-${i}`, y: Y, m: M }));

const backup = {
  app: 'kimatteru',
  format: 2,
  appVersion: 'demo',
  exportedAt: new Date(Y, M, Math.min(DIM, 1)).toISOString(),
  data: {
    events,
    jobs: JOBS,
    overrides: {},
    // types は入れない。入れると利用者が足した種類ごと置き換わってしまう。
    // 省くと復元側が「いまの種類のまま」にしてくれる（typesOk が false のため）。
    settings: { onboarded: true },
    notices: [],
    // 復元の直後に「更新のお知らせ」が出ないように、いまの版を入れておく
    lastSeenVersion: '0.17.0',
  },
};

mkdirSync(OUT, { recursive: true });
const name = `demo-backup-${Y}${String(M + 1).padStart(2, '0')}.json`;
writeFileSync(join(OUT, name), JSON.stringify(backup, null, 2));

const n = (s) => events.filter((e) => e.status === s).length;
console.log(`${join(OUT, name)}`);
console.log(`${Y}年${M + 1}月 の予定 ${events.length}件`);
console.log(`  働いた記録 ${n('jisseki')} / 決まってる ${n('kakutei')} / まだ ${n('mikakutei')} / 流れた ${n('nakunatta')}`);
console.log(`  バイト先 ${JOBS.map((j) => `${j.name}（時給${j.hourly}円）`).join(' ')}`);
