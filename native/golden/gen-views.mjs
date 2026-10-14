// 正解表（golden）その7：画面に出す中身（renderVals の結果のうち、見た目を決める値）。
// 月表示：週ごとの帯（何列目から何列・何段目・字・印・色）、「+N件」、日付の色、見出しの数。
//
// 実行：node gen-views.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 8675309;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const J = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

const RealDate = Date;
let NOW = 0;
class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = FakeDate;
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '30', '15']);
const BAR_KEYS = ['background', 'color', 'border', 'borderLeft', 'borderRight', 'borderBottom', 'textDecoration', 'opacity', 'borderRadius', 'marginLeft', 'marginRight', 'height', 'lineHeight'];

const cases = [];
for (let k = 0; k < 120; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const types = J(mkApp({}).state.types);
  if (rnd() < 0.3) types.push({ key: 'off', name: '休み', color: '#5FA8A2', paper: 'rgba(192,224,221,.72)', dark: 'rgb(48,84,81)', free: true });
  if (rnd() < 0.3) types.push({ key: 'c1', name: 'ジム', color: pick(['#C77D8E', '#55555F', '#6FA8B8']), paper: 'p', dark: 'd' });
  const keys = types.map((t) => t.key).concat(['zzz']);
  const ym = { y: now.getFullYear(), m: (now.getMonth() + pick([0, 0, 0, 1, -1]) + 12) % 12 };
  const events = [];
  const n = pick([0, 3, 10, 25, 50]);
  for (let i = 0; i < n; i++) {
    const e = { id: 'e' + String(i).padStart(2, '0'), type: pick(keys), title: pick(['定例', '歯医者', 'とても長い名前の予定です', '飲み会', 'カフェ', '']), y: ym.y, m: (ym.m + pick([0, 0, 0, 0, 1, -1]) + 12) % 12, day: int(1, 31),
      start: HH(), end: HH(), status: pick(['kakutei', 'kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: i };
    if (e.m === 11 && ym.m === 0) e.y = ym.y - 1;
    if (e.m === 0 && ym.m === 11) e.y = ym.y + 1;
    if (rnd() < 0.2) { e.allDay = true; e.start = '00:00'; e.end = '23:59'; if (rnd() < 0.6) e.days = int(2, 9); }
    if (rnd() < 0.1) e.sym = pick(['早', '遅', '休']);
    if (e.type === 'baito' && rnd() < 0.5) e.jobId = 'j1';
    events.push(e);
  }
  const someday = [];
  for (let i = 0; i < pick([0, 0, 1, 3]); i++) someday.push({ id: 's' + i, title: pick(['旅行', '髪を切る']), when: pick(['week', 'month', 'next', 'someday']), y: ym.y, m: (ym.m + pick([0, -1])) % 12, day: 1 });
  const notices = [];
  for (let i = 0; i < pick([0, 1, 12]); i++) notices.push({ id: 'n' + i, kind: 'info', title: 't', body: 'b', at: i, read: rnd() < 0.3 });
  const settings = { ...mkApp({}).state.settings, onboarded: true, weekStart: pick([0, 1]), hideCanceled: rnd() < 0.3, barTime: rnd() < 0.4, kariMark: rnd() < 0.4,
    theme: pick([undefined, 'light', 'dark']), dark: rnd() < 0.2, hourly: 1100 };
  const jobs = rnd() < 0.5 ? [{ id: 'j1', name: 'カフェ', hourly: 1200, templates: rnd() < 0.5 ? [{ name: '早番', from: 540, to: 1020, sym: '早' }] : undefined }] : [];
  const app = mkApp({ events, types, someday, notices, settings, jobs, ym, today: { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }, wageOn: rnd() < 0.3, screen: 'month', stamp: null });
  const { v } = app.renderVals();
  const page = v.monthPages[1];
  const weeks = page.weeks.map((wk) => ({
    slots: wk.slots.map((s) => ({ day: s.day, blank: !!s.blank, color: s.numStyle.color, today: !!s.numStyle.background, todayBg: s.numStyle.background || null, bg: s.bgStyle.background, weight: s.numStyle.fontWeight })),
    bars: wk.bars.map((b) => { const o = { key: b.key, text: b.text, mark: b.mark, col: b.style.gridColumn, row: b.style.gridRow }; for (const kk of BAR_KEYS) if (b.style[kk] !== undefined) o[kk] = b.style[kk]; return o; }),
    more: wk.more.map((m) => ({ text: m.text, col: m.style.gridColumn, row: m.style.gridRow })),
  }));
  const head = { monthLabel: v.monthLabel, year: v.year, todayBtnShown: v.todayBtnShown, undecidedCount: v.undecidedCount, shelfCount: v.shelfCount, shelfLabel: v.shelfLabel,
    bellCount: v.bellCount, bellBadge: v.bellBadge, weekdays: v.weekdays.map((w) => [w.label, w.style.color]), stampChipShown: v.stampChipShown, wageToggleShown: v.wageToggleShown, calView: v.calView };
  cases.push({ now: NOW, state: J({ events, types, someday, notices, settings, jobs, ym, today: app.state.today, wageOn: app.state.wageOn, screen: 'month' }), weeks, head });
}
fs.writeFileSync(path.join(OUT, 'view-month.json'), JSON.stringify(cases));
console.log('view-month', cases.length, cases.reduce((a, c) => a + c.weeks.reduce((b, w) => b + w.bars.length, 0), 0), 'bars');
