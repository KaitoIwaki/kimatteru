// 正解表（golden）その8：新しい予定／予定を編集の画面。
// 画面の中身（renderVals の NEW）を書き出し、画面のボタンを手当たりしだいに押して、そのたびの中身と状態を記録する。
//
// 実行：node gen-form.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 24680;
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
globalThis.requestAnimationFrame = (f) => { f(); return 1; };

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
const sel = (st, on) => st && st.background === on;
const cells = (list) => list.map((c) => (c.label === '' ? null : { day: c.label, bg: c.style.background, color: c.style.color, border: c.style.border, weight: c.style.fontWeight }));
// 画面の中身のうち、見た目と言葉を決める値
const formOf = (v) => ({
  newTitle: v.newTitle, titlePlaceholder: v.titlePlaceholder, titleAutoFocus: v.titleAutoFocus, editing: v.editing, draftColor: v.draftColor, draftColorDeep: v.draftColorDeep,
  suggests: v.suggests.map((s) => ({ label: s.label, color: s.dotStyle.background })),
  durChips: v.durChips.map((c) => ({ label: c.label, sel: sel(c.style, 'var(--ink)') })),
  overlapNote: v.overlapNote, candShown: v.candShown, candOn: v.candOn,
  somedayChips: v.somedayChips.map((c) => ({ label: c.label, sel: sel(c.style, 'var(--ink)') })), somedayOn: v.somedayOn, somedayText: v.somedayText, secretOn: v.secretOn,
  dateLabel: v.dateLabel, dateOpen: v.dateOpen, dateExtraCount: v.dateExtraCount, dateSummary: v.dateSummary, dateHint: v.dateHint,
  datePickLabel: v.datePickLabel, ymPickOpen: v.ymPickOpen, ymYearLabel: v.ymYearLabel,
  ymMonths: v.ymMonths.map((c) => ({ label: c.label, sel: sel(c.style, 'var(--ink)') })),
  dateWeekdays: v.dateWeekdays.map((w) => [w.label, w.style.color]), dateCells: cells(v.dateCells),
  jobPickerShown: v.jobPickerShown, jobWordNew: v.jobWordNew, jobThisNew: v.jobThisNew,
  jobChips: v.jobChips.map((c) => ({ label: c.label, sel: sel(c.style, '#1D9E75') })), jobNone: { label: v.jobNoneChip.label, sel: sel(v.jobNoneChip.style, '#1D9E75') },
  newJobShown: v.newJobShown, newJobName: v.newJobShown ? v.newJobName : '', newJobEg: v.newJobShown ? v.newJobEg : '', newJobHourly: v.newJobShown ? v.newJobHourly : '',
  timed: v.timed, spanDays: v.spanDays, spanCountLabel: v.spanCountLabel, spanRangeLabel: v.spanRangeLabel, spanHint: v.spanHint,
  rowTypeOpen: v.rowTypeOpen, typeValue: v.typeValue, typeColor: v.typeDotStyle.background, rowJobOpen: v.rowJobOpen, jobValue: v.jobValue,
  addChips: v.addChips.map((c) => c.label),
  repRowShown: v.repRowShown, multiRowShown: v.multiRowShown, placeRowShown: v.placeRowShown, memoRowShown: v.memoRowShown, linkRowShown: v.linkRowShown,
  rowLinkOpen: v.rowLinkOpen, linkValue: v.linkValue, rowPlaceOpen: v.rowPlaceOpen, placeValue: v.placeValue, placePlaceholder: v.placePlaceholder,
  rowMemoOpen: v.rowMemoOpen, memoValue: v.memoValue,
  rowMultiOpen: v.rowMultiOpen, multiValue: v.multiValue, multiClearShown: v.multiClearShown, multiHint: v.multiHint, multiPickLabel: v.multiPickLabel, multiCells: cells(v.multiCells),
  rowRepOpen: v.rowRepOpen, repValue: v.repValue, repNthShown: v.repNthShown, repUntilShown: v.repUntilShown, repDowShown: v.repDowShown, repHint: v.repHint,
  repNthChips: v.repNthChips.map((c) => ({ label: c.label, sel: sel(c.style, '#1D9E75') })),
  repEveryChips: v.repEveryChips.map((c) => ({ label: c.label, sel: sel(c.style, '#1D9E75') })),
  repDowChips: v.repDowChips.map((c) => ({ label: c.label, sel: sel(c.style, '#1D9E75') })),
  repWeekChips: v.repWeekChips.map((c) => ({ label: c.label, sel: sel(c.style, 'var(--ink)') })),
  rowRemindOpen: v.rowRemindOpen, remindValue: v.remindValue, remindNote: v.remindNote,
  remindSeg: v.remindSeg.map((c) => ({ label: c.label, sel: sel(c.style, '#1D9E75') })),
  startValue: v.timeRows[0].value, endValue: v.timeRows[1].value, startOpen: v.timeRows[0].open, endOpen: v.timeRows[1].open,
  startDateText: v.startDateText, endDateText: v.endDateText, endNextDay: v.endNextDay, crossNote: v.crossNote,
  chips: v.chips.map((c) => ({ label: c.label, sel: c.style.background !== 'var(--card)' })),
  newTypeShown: v.newTypeShown, newTypeName: v.newTypeName, newTypeEg: v.newTypeShown ? v.newTypeEg : '',
  swatches: v.newTypeShown ? v.newTypeSwatches.map((s) => s.style.boxShadow.startsWith('0 0 0 2px')) : [],
  seg: v.seg.map((c) => ({ label: c.label, sel: sel(c.style, 'var(--card)') })),
  previewExplain: v.previewExplain, previewBg: v.previewDotStyle.background, previewBorder: v.previewDotStyle.border || '',
});
const KEYS = ['draft', 'newJob', 'newType', 'jobs', 'types', 'discardAsk', 'screen', 'returnTo', 'events', 'someday', 'settings', 'repEditAsk', 'ym', 'dayNum', 'detailId', 'today'];
const snap = (app) => { const o = {}; for (const k of KEYS) o[k] = app.state[k]; return J(o); };
const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '30', '15']);

const cases = [];
for (let k = 0; k < 140; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const types = J(mkApp({}).state.types);
  if (rnd() < 0.3) types.push({ key: 'work', name: '仕事', color: '#6E85BE', paper: 'p', dark: 'd', uWord: '仮押さえ', cWord: '確定', uLabel: '仮押さえ', cLabel: '確定' });
  if (rnd() < 0.2) types[1] = { ...types[1], hidden: true };
  const events = [];
  for (let i = 0; i < int(0, 20); i++) {
    const e = { id: 'e' + i, type: pick(['yoji', 'baito', 'asobi']), title: pick(['定例', 'カフェ', '歯医者', '飲み会', '無題', '']), y: today.y, m: today.m, day: int(1, 28),
      start: HH(), end: HH(), status: pick(['kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: i };
    if (rnd() < 0.2) e.allDay = true;
    if (rnd() < 0.3) e.place = '渋谷';
    if (rnd() < 0.2) e.link = 'https://zoom.us/j/123456789012345678901234567890';
    if (rnd() < 0.2) e.remindMin = pick([10, 60, 0]);
    if (rnd() < 0.2) e.jobId = 'j1';
    if (rnd() < 0.15) { e.repId = 'R'; }
    events.push(e);
  }
  const jobs = rnd() < 0.6 ? [{ id: 'j1', name: pick(['カフェ', '']), hourly: 1100 }, ...(rnd() < 0.5 ? [{ id: 'j2', name: '塾', hourly: 1500, retired: rnd() < 0.5 }] : [])] : [];
  const settings = { ...mkApp({}).state.settings, onboarded: true, weekStart: pick([0, 1]), profile: pick(['student', 'work', 'shift', 'free', 'family', undefined]),
    lastType: pick(['yoji', 'baito', undefined]), notifyOff: rnd() < 0.15, remindTimed: pick([undefined, 10]), remindAllDay: pick([undefined, 0]) };
  const app = mkApp(J({ events, types, jobs, settings, today, ym: { y: today.y, m: today.m }, screen: 'month', returnTo: 'month' }));
  const how = pick(['new', 'new', 'new', 'edit', 'copy']);
  if (how === 'new' || !events.length) app.openNew(int(1, 28), pick(['month', 'day']), pick([undefined, { allDay: true }, { start: int(0, 1430) }]));
  else if (how === 'edit') app.openEdit(pick(app.state.events), pick(['day', 'detail']));
  else app.openCopy(pick(app.state.events), 'day');
  const init = snap(app);
  const steps = [];
  for (let s = 0; s < int(4, 14); s++) {
    if (app.state.screen !== 'new') break;
    const { v } = app.renderVals();
    const form = formOf(v);
    // 押すもの
    const opts = [];
    const add = (w, op, fn) => { for (let i = 0; i < w; i++) opts.push([op, fn]); };
    add(2, { h: 'title', s: pick(['', '定', 'カフェ', ' 歯医者 ', '飲み会']) }, (o) => v.onTitle({ target: { value: o.s } }));
    v.suggests.forEach((x, i) => add(1, { h: 'suggest', i }, () => x.onClick()));
    v.durChips.forEach((x, i) => add(1, { h: 'dur', m: [30, 60, 90, 120, 180][i] }, () => x.onClick()));
    add(1, { h: 'cand' }, () => v.onToggleCand());
    v.somedayChips.forEach((x, i) => add(1, { h: 'someday', w: ['week', 'month', 'next', 'someday'][i] }, () => x.onClick()));
    add(1, { h: 'secret' }, () => v.onToggleSecret());
    add(2, { h: 'tapDate' }, () => v.onTapDate());
    add(1, { h: 'pick', n: -1 }, () => v.onDatePrev()); add(1, { h: 'pick', n: 1 }, () => v.onDateNext());
    add(1, { h: 'tapYM' }, () => v.onTapYM());
    add(1, { h: 'year', n: -1 }, () => v.onYearPrev()); add(1, { h: 'year', n: 1 }, () => v.onYearNext());
    const mi = int(0, 11); add(1, { h: 'month', i: mi }, () => v.ymMonths[mi].onClick());
    const dc = v.dateCells.filter((c) => c.label !== ''); if (dc.length) { const c = pick(dc); add(2, { h: 'day', d: c.label }, () => c.onClick()); }
    add(1, { h: 'clearExtra' }, () => v.onClearExtraDays());
    v.jobChips.forEach((x, i) => add(1, { h: 'pickJob', id: app.state.jobs[i].id }, () => x.onClick()));
    add(1, { h: 'clearJob' }, () => v.jobNoneChip.onClick());
    add(1, { h: 'startNewJob' }, () => v.onAddJobFromNew());
    if (v.newJobShown) {
      add(1, { h: 'newJobName', s: pick(['', ' コンビニ ']) }, (o) => v.onNewJobName({ target: { value: o.s } }));
      add(1, { h: 'newJobHourly', s: pick(['', '1,200', 'abc', '9999999', '0050']) }, (o) => v.onNewJobHourly({ target: { value: o.s } }));
      add(1, { h: 'newJobBump', d: -10 }, () => v.onNewJobMinus()); add(1, { h: 'newJobBump', d: 10 }, () => v.onNewJobPlus());
      add(1, { h: 'cancelNewJob' }, () => v.onCancelNewJob()); add(1, { h: 'commitNewJob' }, () => v.onCommitNewJob());
    }
    add(1, { h: 'span', d: -1 }, () => v.onSpanMinus()); add(1, { h: 'span', d: 1 }, () => v.onSpanPlus());
    add(2, { h: 'allDay' }, () => v.onToggleAllDay());
    for (const [key, fn] of [['type', 'onTapTypeRow'], ['job', 'onTapJobRow'], ['link', 'onTapLinkRow'], ['place', 'onTapPlaceRow'], ['memo', 'onTapMemoRow'], ['rep', 'onTapRepRow'], ['remind', 'onTapRemindRow']]) add(1, { h: 'row', key }, () => v[fn]());
    const addKeys = { 'くり返し': 'rep', '複数日': 'multi', '場所': 'place', 'Web会議・リンク': 'link', 'メモ': 'memo' };
    v.addChips.forEach((x) => add(2, { h: 'addRow', key: addKeys[x.label] }, () => x.onClick()));
    for (const [key, fn] of [['rep', 'onRemoveRep'], ['multi', 'onRemoveMulti'], ['place', 'onRemovePlace'], ['memo', 'onRemoveMemo'], ['link', 'onRemoveLink']]) add(1, { h: 'dropRow', key }, () => v[fn]());
    add(1, { h: 'place', s: pick(['', '渋谷', ' 本社 '] ) }, (o) => v.onPlaceText({ target: { value: o.s } }));
    add(1, { h: 'memo', s: pick(['', '持ち物：傘', '一行目\n二行目', 'とても長いメモを書いておく']) }, (o) => v.onMemoText({ target: { value: o.s } }));
    add(1, { h: 'link', s: pick(['', 'zoom.us/j/1', 'https://meet.google.com/abc-defg-hij-klmn-opqr']) }, (o) => v.onLinkText({ target: { value: o.s } }));
    add(1, { h: 'tapMulti' }, () => v.onTapMultiRow());
    add(1, { h: 'clearMulti' }, () => v.onClearMulti());
    const mc = v.multiCells.filter((c) => c.label !== ''); if (mc.length) { const c = pick(mc); add(2, { h: 'multiDay', d: c.label }, () => c.onClick()); }
    const everyKeys = [null, 'day', 'weekday', 'week', 'biweek', 'month', 'nth', 'monthEnd', 'year'];
    v.repEveryChips.forEach((x, i) => add(1, { h: 'repEvery', key: everyKeys[i] }, () => x.onClick()));
    v.repNthChips.forEach((x, i) => add(1, { h: 'repNth', k: i + 1 }, () => x.onClick()));
    v.repDowChips.forEach((x, i) => add(1, { h: 'repDow', i }, () => x.onClick()));
    v.repWeekChips.forEach((x, i) => add(1, { h: 'repSpan', i }, () => x.onClick()));
    const rv = v.allDayShown ? [null, 0, 1440, 2880, 4320, 10080] : [null, 10, 30, 60, 180, 1440, 2880, 4320, 10080];
    v.remindSeg.forEach((x, i) => add(1, { h: 'remind', val: rv[i] }, () => x.onClick()));
    add(1, { h: 'timeRow', f: 'start' }, () => v.timeRows[0].onTap()); add(1, { h: 'timeRow', f: 'end' }, () => v.timeRows[1].onTap());
    for (const f of ['start', 'end']) for (const u of ['h', 'm']) { const idx = u === 'h' ? int(0, 23) : int(0, 11); add(1, { h: 'wheel', f, u, idx }, () => app._onWheel({ target: { scrollTop: idx * 34 } }, f, u)); }
    v.chips.forEach((x, i) => add(1, { h: 'type', key: app.state.types.filter((t) => !t.hidden || t.key === app.state.draft.type)[i].key }, () => x.onClick()));
    add(1, { h: 'toggleNewType' }, () => v.onAddTypeChip());
    if (v.newTypeShown) {
      add(1, { h: 'newTypeName', s: pick(['', ' 習い事 ']) }, (o) => v.onNewTypeName({ target: { value: o.s } }));
      const si = int(0, 11); add(1, { h: 'newTypeColor', i: si }, () => v.newTypeSwatches[si].onClick());
      add(1, { h: 'addType' }, () => v.onAddType()); add(1, { h: 'cancelNewType' }, () => v.onCancelNewType());
    }
    v.seg.forEach((x, i) => add(1, { h: 'status', k: ['kakutei', 'mikakutei'][i] }, () => x.onClick()));
    add(1, { h: 'cancel' }, () => v.onCancel());
    add(1, { h: 'save' }, () => v.onSave());
    const [op, fn] = pick(opts);
    fn(op);
    if (op.h === 'repSpan') op.m = J(app.state.draft).repSpan;
    steps.push({ form, op, state: snap(app) });
  }
  cases.push({ now: NOW, init, steps });
}
fs.writeFileSync(path.join(OUT, 'form.json'), JSON.stringify(cases));
const ops = {};
for (const c of cases) for (const s of c.steps) ops[s.op.h] = (ops[s.op.h] || 0) + 1;
console.log('form', cases.length, cases.reduce((a, c) => a + c.steps.length, 0), 'steps', JSON.stringify(ops));
