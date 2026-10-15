// 正解表（golden）：はじめての案内と、予定の取り込みの画面の中身（sw-form の受け持ち）。
// renderVals の値（言葉・数・色）を書き出す。押したときの動きは gen-actions-more.mjs などが見ている。
//
// 実行：node gen-form-ui.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 97531;
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
globalThis.requestAnimationFrame = (f) => { f(); return 0; };

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};

// ---------- はじめての案内 ----------
const onboard = [];
for (let k = 0; k < 120; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(0, 23), int(0, 59)).getTime();
  const base = mkApp({});
  const types = J(base.state.types);
  if (rnd() < 0.3) { const a = types.find((t) => t.key === 'asobi'); if (a) a.color = pick(['#8B7AB8', '#D2916A', '#5FA8A2']); }
  if (rnd() < 0.15) { const i = types.findIndex((t) => t.key === 'asobi'); if (i >= 0) types.splice(i, 1); }
  const settings = { ...base.state.settings, onboarded: false, profile: pick(['student', 'work', 'shift', 'free', 'family', undefined]), theme: pick([undefined, 'dark', 'auto', 'light']) };
  const ob = { step: int(0, 4), picked: pick([null, 'student', 'work', 'shift', 'free', 'family']), demo: pick(['dash', 'asking', 'fill', 'done']), morning: rnd() < 0.5, fast: rnd() < 0.3 };
  const app = mkApp(J({ types, settings, onboard: ob, screen: 'month' }));
  const { v } = app.renderVals();
  onboard.push({ now: NOW, state: J({ types, settings, onboard: ob }), view: {
    step: v.obStep, fast: v.obFast,
    profiles: v.obProfiles.map((p) => ({ key: p.key, label: p.label, note: p.note, sel: p.style.border === '1px solid var(--ink)' })),
    dateText: v.obDateText, solidLabel: v.obSolidLabel, demoLabel: v.obDemoLabel, askHeading: v.obAskHeading,
    asking: v.obAsking, filled: v.obDemoFillStyle.transform === 'scaleX(1)', done: v.obDemoDone,
    caption: v.obDemoCaption, captionGreen: v.obDemoCaptionColor === '#0F6E56',
    nextDark: v.obNextStyle.background === 'var(--ink)', morningOn: v.obMorningOn,
    solidBg: v.obSolidPillStyle.background, solidLine: v.obSolidPillStyle.border.replace('1.6px solid ', ''), solidInk: v.obSolidPillStyle.color,
    dashBg: v.obDemoPillStyle.background, dashLine: v.obDemoPillStyle.border.replace(/^1\.6px (solid|dashed) /, ''), dashInk: v.obDemoPillStyle.color,
    fillBg: v.obDemoFillStyle.background,
  } });
}
fs.writeFileSync(path.join(OUT, 'form-onboard.json'), JSON.stringify(onboard));

// ---------- 予定の取り込み ----------
const imports = [];
for (let k = 0; k < 160; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const base = mkApp({});
  const types = J(base.state.types);
  if (rnd() < 0.3) types.push({ key: 'work', name: '仕事', color: '#6E85BE', paper: 'p', dark: 'd', uWord: '仮押さえ', cWord: '確定' });
  if (rnd() < 0.2) types[1] = { ...types[1], hidden: true };
  const keys = types.map((t) => t.key);
  const found = [];
  for (let i = 0; i < pick([0, 0, 1, 3, 8]); i++) {
    const e = { key: pick(['k', 'c', 'g']) + i, title: pick(['定例', 'カフェ', '誕生日', '']), y: 2026, m: int(0, 11), day: int(1, 28), start: pick(['09:00', '17:30']), end: pick(['10:00', '22:00']),
      type: pick([...keys, 'zzz']), on: rnd() < 0.7, status: pick(['kakutei', 'mikakutei', undefined]) };
    if (rnd() < 0.3) { e.allDay = true; if (rnd() < 0.5) e.days = int(1, 4); }
    if (rnd() < 0.3) e.place = pick(['渋谷', '']);
    if (rnd() < 0.3) e.guessed = true;
    if (rnd() < 0.2) { e.kind = 'changed'; e.was = '3/4 10:00'; } else if (rnd() < 0.15) e.kind = 'gone';
    found.push(e);
  }
  const cals = [];
  for (let i = 0; i < pick([0, 1, 3]); i++) cals.push({ id: 'C' + i, title: pick(['仕事', '家族', 'Home']), color: pick(['#E5463C', '#3D6E9C']), on: rnd() < 0.7, type: pick(['', '', ...keys, 'zzz']) });
  const imp = { phase: pick(['idle', 'scanning', 'cals', 'found', 'done']), found, cals, type: 'yoji', error: pick(['', '', 'カレンダーを読む許可が下りませんでした。']),
    denied: rnd() < 0.3, range: pick([undefined, 'month', 'year', 'back']), source: pick([undefined, 'cal', 'ics', 'tidy']),
    otherOpen: rnd() < 0.3, askOpen: rnd() < 0.3, bulkOpen: rnd() < 0.3 };
  if (imp.phase === 'done') {
    imp.added = pick([undefined, 0, 3]); imp.tidied = pick([undefined, '', 'skip', 'delete']);
    imp.updated = pick([0, 2]); imp.removed = pick([0, 1]); imp.withPlace = pick([0, 4]); imp.multi = pick([0, 2]); imp.dashed = pick([0, 1]);
  }
  const settings = { ...base.state.settings, onboarded: true, theme: pick([undefined, 'dark']), lastImport: pick([undefined, null, { at: 1, ids: ['a'] }]) };
  const app = mkApp(J({ types, settings, imp, screen: 'import' }));
  const { v } = app.renderVals();
  imports.push({ now: NOW, state: J({ types, settings, imp }), view: {
    phase: v.impPhase, error: v.impError || '', denied: v.impDenied, count: v.impCount, onCount: v.impOnCount, allOn: v.impAllOn, guessText: v.impGuessText,
    rows: v.impRows.map((r) => ({ key: r.key, title: r.title, on: r.on, kindTag: r.kindTag, place: r.place, when: r.when, typeName: r.typeName,
      typeBg: r.typeStyle.background, typeInk: r.typeStyle.color, typeLine: r.typeStyle.border.replace('1px solid ', '') })),
    bulkChips: v.impBulkChips.map((c) => c.label), added: v.impAdded, doneDetail: v.impDoneDetail, doneDashed: v.impDoneDashed, undoShown: v.impUndoShown,
    cals: v.impCals.map((c) => ({ id: c.key, label: c.label, color: c.color, on: c.on, typeName: c.typeName, typeBg: c.typeStyle.background, typeInk: c.typeStyle.color })),
    rangeChips: v.impRangeChips.map((c) => ({ label: c.label, sel: c.style.background === 'var(--ink)' })), calsOnCount: v.impCalsOnCount,
    none: v.impNone, fromIcs: v.impFromIcs, tidy: v.impTidy, tidied: v.impTidied, otherOpen: v.impOtherOpen, askOpen: v.impAskOpen, bulkOpen: v.impBulkOpen, otherSteps: v.impOtherSteps,
  } });
}
fs.writeFileSync(path.join(OUT, 'form-import.json'), JSON.stringify(imports));
console.log('form-ui', onboard.length, 'onboard', imports.length, 'import');
