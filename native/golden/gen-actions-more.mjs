// 正解表（golden）その3：予定のほかの操作（勤務先・種類・使い方・シフト入力・取り込み・整理・有給など）。
// gen-actions.mjs と同じやり方：いまの Web 版の App をそのまま動かし、操作のたびの状態を書き出す。
//
// 実行：node gen-actions-more.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 51013;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// ---- 時計と待ち時間を、こちらで進める ----
const RealDate = Date;
let NOW = new RealDate(2026, 9, 15, 10, 7, 0).getTime();
class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = FakeDate;
let timers = [];
let tid = 1;
globalThis.setTimeout = (fn, ms) => { const id = tid++; timers.push({ id, fn, at: NOW + (ms || 0) }); return id; };
globalThis.clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
const advance = (ms) => {
  const end = NOW + ms;
  for (let guard = 0; guard < 200; guard++) {
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    if (!timers.length || timers[0].at > end) break;
    const t = timers.shift();
    if (t.at > NOW) NOW = t.at;
    t.fn();
  }
  NOW = end;
};

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
// 比べる中身：保存するものと、画面の流れに関わるもの（この表で使う画面の中身も足す）
const KEYS = ['events', 'types', 'overrides', 'settings', 'notices', 'jobs', 'supports', 'trash', 'someday', 'gone',
  'screen', 'returnTo', 'detailId', 'ym', 'today', 'undo', 'shareMsg', 'shareToast', 'draft',
  'stamp', 'setPage', 'typeListOpen', 'editJobId', 'rateNote', 'newJob', 'confirmJob', 'editTypeKey', 'typeDelete',
  'profileSheet', 'onboard', 'imp', 'newType'];
const snap = (app) => { const o = {}; for (const k of KEYS) o[k] = app.state[k]; return JSON.parse(JSON.stringify(o)); };

const HH = () => String(int(6, 22)).padStart(2, '0') + ':' + pick(['00', '30']);
const BASE_TYPES = clone(mkApp({}).state.types);
const COLORS = ['#8B7AB8', '#7FAE85', '#D2916A', '#5FA8A2', '#C77D8E', '#6E85BE', 'zz'];
const PROFILE_KEYS = ['student', 'work', 'shift', 'free', 'family'];

const mkTypes = () => {
  let ts = clone(BASE_TYPES);
  if (rnd() < 0.4) ts = ts.map((t) => (rnd() < 0.3 ? { ...t, name: pick(['仕事', '用事', '自分の名前', '']) } : t));
  if (rnd() < 0.3) ts.push({ key: 'work', name: '仕事', color: '#6E85BE', paper: 'p', dark: 'd', uWord: '仮押さえ', cWord: '確定' });
  if (rnd() < 0.3) ts.push({ key: 'off', name: '休み', color: '#5FA8A2', free: true, allDayDefault: true, uWord: '希望休', cWord: '休み' });
  if (rnd() < 0.4) ts.push({ key: 'cAAA' + int(1, 9), name: pick(['ジム', '塾']), color: pick(COLORS), paper: 'p', dark: 'd', uWord: '未確定のジム', cWord: 'ジム', defStart: '18:00', defEnd: '19:30' });
  if (rnd() < 0.3) ts = ts.map((t) => (rnd() < 0.3 ? { ...t, hidden: true } : t));
  return ts;
};
const mkTemplates = () => {
  const out = [];
  for (let i = 0; i < int(0, 3); i++) {
    const allDay = rnd() < 0.25;
    const from = int(20, 80) * 15, to = from + int(8, 40) * 15;
    const t = { name: pick(['', '早番', '遅番', '夜勤']), from, to };
    if (rnd() < 0.6) t.id = 'tp' + i;
    if (allDay) t.allDay = true;
    if (rnd() < 0.5) t.brk = pick([0, 30, 60]);
    if (rnd() < 0.5) t.sym = pick(['早', '遅', '夜']);
    out.push(t);
  }
  return out;
};

const scenarios = [];
for (let k = 0; k < 200; k++) {
  NOW = new RealDate(2026, 9, int(1, 28), int(7, 22), int(0, 59), 0).getTime();
  const now0 = NOW;
  timers = [];
  const today = { y: 2026, m: 9, d: new RealDate(NOW).getDate() };
  const jobs = [];
  for (let i = 0; i < int(0, 3); i++) {
    const j = { id: 'j' + i, name: pick(['カフェ', '塾', '', '病院']), hourly: pick([1100, 1250, 1500]) };
    if (rnd() < 0.6) j.templates = mkTemplates();
    if (rnd() < 0.15) j.retired = true;
    jobs.push(j);
  }
  const types = mkTypes();
  const tkeys = types.map((t) => t.key);
  const events = [];
  for (let i = 0; i < int(3, 12); i++) {
    const e = { id: 'e' + i, type: pick(tkeys.concat(['off', 'baito'])), title: pick(['定例', 'バイト', '有給', '半休', '午前休', '誕生日', '飲み会', '年休']), y: 2026, m: pick([2, 3, 8, 9, 10]), day: int(1, 28),
      start: HH(), end: HH(), status: pick(['kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: 1000 + i };
    if (rnd() < 0.3) { e.allDay = true; if (rnd() < 0.4) e.days = int(2, 4); }
    if (jobs.length && rnd() < 0.4) e.jobId = pick(jobs).id;
    if (e.status === 'jisseki' && rnd() < 0.5) e.hourly = pick([1000, 1200]);
    if (rnd() < 0.15) e.stampKey = pick(['j0:tp0', 'j0:0', 'j1:tp1']);
    events.push(e);
  }
  // 取り込みで入った予定（ID が i で始まる）
  const oldTag = 'iold' + k;
  for (let i = 0; i < int(0, 4); i++) {
    const e = { id: oldTag + '-' + i, type: 'yoji', title: pick(['誕生日', 'クリスマス', '歯医者', 'Birthday', '振替休日']), y: 2026, m: pick([9, 10, 11]), day: int(1, 28),
      start: '00:00', end: '23:59', status: 'kakutei', updatedAt: 4000 + i };
    if (rnd() < 0.7) e.allDay = true;
    if (rnd() < 0.15) e.noReport = true;
    events.push(e);
  }
  const settings = { hourly: 1120, weekStart: pick([0, 1]), remind: true, onboarded: rnd() < 0.8, profile: pick(PROFILE_KEYS.concat([undefined, 'zzz'])), firstUseAt: now0 - 86400000 * 3 };
  if (rnd() < 0.5) settings.paidLeave = { start: pick([0, 3, 9]), grant: pick([10, 20, 15.5, undefined]) };
  if (rnd() < 0.4) settings.lastImport = { tag: oldTag, at: now0 - 86400000 };
  if (rnd() < 0.3) settings.priorWage = pick([{ 2025: 30000 }, [1, 2], 'x']);
  const trash = [];
  for (let i = 0; i < int(0, 3); i++) trash.push({ ev: { id: 'tr' + i, type: 'yoji', title: '消した', y: 2026, m: 9, day: 3, start: '10:00', end: '11:00', status: 'kakutei' }, at: now0 - int(1, 40) * 86400000 });
  const init = { events, types, jobs, settings, trash, someday: [], gone: [], today, ym: { y: 2026, m: pick([8, 9, 10]) }, screen: 'month', returnTo: 'month',
    overrides: rnd() < 0.5 ? {} : { '2026-9-3': '×' }, notices: [], supports: [] };
  const app = mkApp(JSON.parse(JSON.stringify(init)));
  const init0 = snap(app);
  const steps = [];
  let gap = 0;
  const record = (op, extra) => { steps.push({ op, gap, state: snap(app), ...(extra || {}) }); gap = 0; };
  const jobIds = () => app.state.jobs.map((j) => j.id).concat(['jNone']);
  const typeKeys = () => app.state.types.map((t) => t.key).concat(['zzz']);
  const anyEv = () => (app.state.events.length ? pick(app.state.events) : null);
  const ensureDraft = () => {
    if (app.state.screen === 'new' && app.state.draft) return;
    const day = int(1, 28), ret = pick(['month', 'day']);
    app.openNew(day, ret);
    record({ call: 'openNew', day, ret });
  };

  for (let s = 0; s < int(3, 9); s++) {
    gap = int(1, 600) * 1000;
    advance(gap);
    const r = rnd();
    if (r < 0.06) {
      app.addJob(); record({ call: 'addJob' });
      const id = app.state.editJobId;
      if (rnd() < 0.7) { const patch = { name: pick(['新しい店', '  ']) }; app.patchJob(id, patch); record({ call: 'patchJob', id, patch }); }
    } else if (r < 0.14) {
      const id = pick(jobIds());
      const patch = pick([{ name: '改名' }, { hourly: pick([1100, 1300, 1500]) }, { hourly: '1400' }, { templates: mkTemplates() }, { hourly: 1300, name: 'X' }]);
      app.patchJob(id, patch); record({ call: 'patchJob', id, patch });
      if (app.state.rateNote && rnd() < 0.5) { const rid = app.state.rateNote; app.recountJob(rid); record({ call: 'recountJob', id: rid }); }
    } else if (r < 0.18) {
      const id = pick(jobIds()), on = rnd() < 0.6;
      app.retireJob(id, on); record({ call: 'retireJob', id, on });
    } else if (r < 0.22) {
      const id = pick(jobIds());
      app.setState({ confirmJob: id }); record({ call: 'set', patch: { confirmJob: id } });
      app.removeJob(id); record({ call: 'removeJob', id });
    } else if (r < 0.34) {
      ensureDraft();
      const q = rnd();
      if (q < 0.25) { const id = pick(jobIds()); app.pickJob(id); record({ call: 'pickJob', id }); }
      else if (q < 0.35) { app.clearJob(); record({ call: 'clearJob' }); }
      else if (q < 0.5) {
        app.startNewJob(); record({ call: 'startNewJob' });
        const nj = { ...app.state.newJob, name: pick(['', '  コンビニ ', '塾']) };
        app.setState({ newJob: nj }); record({ call: 'set', patch: { newJob: nj } });
        if (rnd() < 0.8) { app.commitNewJob(); record({ call: 'commitNewJob' }); } else { app.cancelNewJob(); record({ call: 'cancelNewJob' }); }
      } else if (q < 0.65) {
        const y = 2026, m = pick([9, 10]), d = rnd() < 0.2 ? app.state.draft.day : int(1, 28);
        app.toggleExtraDay(y, m, d); record({ call: 'toggleExtraDay', y, m, d });
      } else if (q < 0.85) {
        if (rnd() < 0.4) { const dr = { ...app.state.draft, start: HH() }; app.setState({ draft: dr }); record({ call: 'set', patch: { draft: dr } }); }
        const key = pick(typeKeys()); app.selectType(key); record({ call: 'selectType', key });
      } else {
        const nt = { name: pick(['', ' 習い事 ']), color: pick(COLORS) };
        app.setState({ newType: nt }); record({ call: 'set', patch: { newType: nt } });
        app.addType(); record({ call: 'addType' });
      }
      if (rnd() < 0.4) {
        const dr = { ...app.state.draft, title: pick([app.state.draft.title, '書いた']) };
        app.setState({ draft: dr }); app.save(); record({ call: 'saveDraft', draft: dr });
      }
    } else if (r < 0.42) {
      if (rnd() < 0.5 || !app.state.stamp) { app.toggleStamp(); record({ call: 'toggleStamp' }); }
      const tp = app.stampTemplates();
      if (tp.length && rnd() < 0.5) { const stamp = { key: pick(tp).key, status: pick(['kakutei', 'mikakutei']) }; app.setState({ stamp }); record({ call: 'set', patch: { stamp } }); }
      for (let i = 0; i < int(1, 4) && app.state.stamp; i++) {
        const Y = 2026, M = pick([9, 10]), d = int(1, 6);
        app.stampDay(Y, M, d); record({ call: 'stampDay', Y, M, d });
      }
      if (app.state.undo && rnd() < 0.3) { app.undoLast(); record({ call: 'undoLast' }); }
    } else if (r < 0.46) {
      app.confirmMonthShifts(); record({ call: 'confirmMonthShifts' });
      if (app.state.undo && rnd() < 0.3) { app.undoLast(); record({ call: 'undoLast' }); }
    } else if (r < 0.52) {
      const key = pick(PROFILE_KEYS), retire = rnd() < 0.3;
      app.setProfile(key, retire); record({ call: 'setProfile', key, retire });
    } else if (r < 0.62) {
      const key = pick(typeKeys()), q = rnd();
      if (q < 0.2) { const dir = pick([1, -1]); app.moveType(key, dir); record({ call: 'moveType', key, dir }); }
      else if (q < 0.4) { app.toggleTypeHidden(key); record({ call: 'toggleTypeHidden', key }); }
      else if (q < 0.55) {
        const to = pick(typeKeys());
        app.setState({ editTypeKey: key, typeDelete: key }); record({ call: 'set', patch: { editTypeKey: key, typeDelete: key } });
        app.deleteType(key, to); record({ call: 'deleteType', key, to });
      } else if (q < 0.7) { const which = pick(['u', 'c']), val = pick(['', '仮', 'とても長い呼び名をここに書いてみる', undefined]); app.setTypeWords(key, which, val); record({ call: 'setTypeWords', key, which, val }); }
      else if (q < 0.85) { const hex = pick(COLORS); app.recolorKey(key, hex); record({ call: 'recolorKey', key, hex }); }
      else { const name = pick(['新しい名前', '']); app.renameType(key, name); record({ call: 'renameType', key, name }); }
    } else if (r < 0.68) {
      const q = rnd();
      if (q < 0.4) { const day = pick(['2026-9-3', '2026-9-4', '2026-10-1']), auto = pick(['○', '△', '×']); app.cycleMark(day, auto); record({ call: 'cycleMark', day, auto }); }
      else if (q < 0.7) { const y = pick([2025, 2026]), n = pick([0, 12000, '35000', 'abc', -5, 1500.6, 123456789012, null]); app.setPrior(y, n); record({ call: 'setPrior', y, n }); }
      else { const k = pick(['weekStart', 'remind', 'hourly', 'darkMode']), val = pick([0, 1, true, false, 'auto', 1300]); app.setSetting(k, val); record({ call: 'setSetting', k, val }); }
    } else if (r < 0.74) {
      const onboard = { step: 0, replay: rnd() < 0.5, morning: rnd() < 0.5 };
      app.setState({ onboard }); record({ call: 'set', patch: { onboard } });
      const key = pick(PROFILE_KEYS.concat([app.state.settings.profile, 'zzz']));
      app.onboardPick(key); record({ call: 'onboardPick', key });
      if (rnd() < 0.7) { const goImport = rnd() < 0.4; app.finishOnboard(goImport); record({ call: 'finishOnboard', goImport }); }
    } else if (r < 0.82) {
      const found = [];
      const cur = app.state.events;
      for (let i = 0; i < int(0, 6); i++) {
        const kind = pick([undefined, 'new', 'new', 'changed', 'gone']);
        const allDay = rnd() < 0.3;
        const row = { key: 'k' + i, on: rnd() < 0.8, type: pick(typeKeys()), title: pick(['会議', '旅行', '通院']), y: 2026, m: pick([9, 10]), day: int(1, 28), start: HH(), end: HH() };
        if (allDay) { row.allDay = true; row.days = pick([1, 2, 3]); }
        if (kind) row.kind = kind;
        if (rnd() < 0.3) row.status = 'mikakutei';
        if (rnd() < 0.3) row.place = pick(['渋谷', '']);
        if (rnd() < 0.3) row.memo = 'メモ';
        if (rnd() < 0.2) row.link = 'https://x.test';
        if (rnd() < 0.3) { row.srcId = 'src' + i; row.srcCal = 'cal1'; }
        if ((kind === 'changed' || kind === 'gone') && cur.length) row.existingId = pick(cur).id;
        found.push(row);
      }
      const imp = { phase: 'found', found, type: 'yoji', error: '' };
      app.setState({ screen: 'import', imp }); record({ call: 'set', patch: { screen: 'import', imp } });
      app.doImport(); record({ call: 'doImport' });
      if (rnd() < 0.4) { app.undoImport(); record({ call: 'undoImport' }); }
    } else if (r < 0.86) {
      app.undoImport(); record({ call: 'undoImport' });
    } else if (r < 0.91) {
      app.openTidy(); record({ call: 'openTidy' });
      for (const row of app.state.imp.found) if (rnd() < 0.3) { app.toggleImportRow(row.key); record({ call: 'toggleImportRow', key: row.key }); }
      if (rnd() < 0.2) { const on = rnd() < 0.5; app.setAllImport(on); record({ call: 'setAllImport', on }); }
      if (rnd() < 0.2) { const type = pick(typeKeys()); app.setAllImportType(type); record({ call: 'setAllImportType', type }); }
      if (rnd() < 0.2 && app.state.imp.found.length) { const key = pick(app.state.imp.found).key, type = pick(typeKeys()); app.setImportRowType(key, type); record({ call: 'setImportRowType', key, type }); }
      if (rnd() < 0.5) { app.tidySkip(); record({ call: 'tidySkip' }); } else { app.tidyDelete(); record({ call: 'tidyDelete' }); }
    } else if (r < 0.95 && anyEv()) {
      const ev = anyEv(), ret = pick(['month', 'day', undefined]);
      app.openCopy(ev, ret); record({ call: 'openCopy', id: ev.id, ret });
      if (rnd() < 0.6) { const dr = { ...app.state.draft, day: int(1, 28) }; app.setState({ draft: dr }); app.save(); record({ call: 'saveDraft', draft: dr }); }
    } else if (r < 0.98) {
      const out = app.leaveSummary();
      record({ call: 'leaveSummary' }, { out: out === null ? null : out });
    } else {
      app._pruneTrash(); record({ call: 'pruneTrash' });
    }
  }
  scenarios.push({ init: init0, now0, steps });
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'actions-more.json'), JSON.stringify({ keys: KEYS, scenarios }));
const calls = {};
for (const sc of scenarios) for (const st of sc.steps) calls[st.op.call] = (calls[st.op.call] || 0) + 1;
console.log('actions-more', scenarios.length, scenarios.reduce((a, s) => a + s.steps.length, 0), 'steps', JSON.stringify(calls));
