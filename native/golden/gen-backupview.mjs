// 正解表（golden）：設定の「控えと機種変更」「ファイルで出し入れ」「最近消した予定」と、設定の画面の残りの値（設定の担当ぶん）。
//  ・控えの一覧の行・一覧から戻す（pickLocalBackup）・ファイルから戻す（readBackupFile）・ファイルをえらべないとき（pickBackupFile）
//  ・貼り付け（onTogglePaste・onBackupText・askRestore）・書き出した日（exportBackup）・.ics の中身（toIcs）
//  ・設定の値：週のはじまり・働いたあとに記録を聞くの行・重ねた予定・新しい種類・シフトの型・整理の数・貼り付け
//  ・設定の操作：種類を追加の行・時給の − ＋・型の記号と名前・規約を開く／戻る・最近消した予定を開く／戻す
//
// 実行：node gen-backupview.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 777;
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
// iPhone として動かす（通知が使える・同期の行が出る）
globalThis.__native = true;

// 番号を決め打ちにする（Swift の試験でも同じ順で作る）
let uidN = 0;
const realRandom = Math.random;
Math.random = () => { uidN++; return ((uidN * 7919) % 10007) / 10007; };

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};

const ev = (i, extra = {}) => ({ id: 'e' + i, type: pick(['yoji', 'baito', 'asobi']), title: pick(['定例', 'カフェ', '', '誕生日']), y: 2026, m: int(0, 11), day: int(1, 28),
  start: '10:00', end: '11:00', status: pick(['kakutei', 'mikakutei', 'jisseki', 'nakunatta']), updatedAt: int(1, 1000), ...extra });
const backupText = (events, extra = {}) => JSON.stringify({ app: 'kimatteru', format: 2, appVersion: '0.32.1', exportedAt: '2026-09-28T01:02:03.000Z',
  data: { events, types: [], settings: { hourly: 1200 }, supports: [{ id: 'com.kimatteru.app.tip300', yen: 300, at: 5 }], ...extra } });

// ---- 控えの操作 ----
const acts = [];
for (let k = 0; k < 80; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(0, 23), int(0, 59), int(0, 59)).getTime();
  const events = []; for (let i = 0; i < pick([0, 2, 5]); i++) events.push(ev(i));
  const settings = { ...mkApp({}).state.settings, onboarded: true, lastExportAt: pick([undefined, NOW - 86400000]) };
  // ブラウザの控え（端末の中の控えの代わり）
  const web = [];
  for (let i = 0; i < pick([0, 1, 3]); i++) {
    web.push({ name: pick(['auto-2026-09-2' + i + '.json', 'before-2026-09-2' + i + '-153012.json', 'bad-name.json']), at: NOW - i * 86400000,
      text: pick([backupText([ev(10 + i), ev(20 + i)]), '{oops', JSON.stringify({ app: 'other' }), backupText('x'), '', JSON.stringify({ app: 'kimatteru', format: 3, data: { events: [] } })]) });
  }
  globalThis.__ls.set('lukko.backups', JSON.stringify(web));
  globalThis.__native = false;   // 控えの一覧はブラウザの置き場から読む
  const st0 = { events, settings, screen: 'settings', setPage: 'backup', types: mkApp({}).state.types };
  const app = mkApp(J(st0));
  const ops = [], steps = [];
  for (let s = 0; s < 5; s++) {
    const op = pick(['open', 'pickLocal', 'pickLocal', 'file', 'file', 'file', 'noInput', 'paste', 'text', 'ask', 'export', 'close']);
    const o = { op };
    if (op === 'open') { await app.openBackups(); o.list = app.state.backupList; }
    if (op === 'pickLocal') { o.name = pick([...web.map((w) => w.name), 'missing.json']); const x = web.find((w) => w.name === o.name); o.text = x ? x.text : null; await app.pickLocalBackup(o.name); }
    if (op === 'file') {
      o.size = pick([100, 5 * 1024 * 1024, 5 * 1024 * 1024 + 1]);
      o.text = pick([backupText([ev(1), ev(2), { bad: true }]), '{"app":"kimatteru","format":2,"data":{"events":[]}}', 'not json', null]);
      const text = o.text;
      await app.readBackupFile({ target: { files: [{ size: o.size, text: async () => { if (text === null) throw new Error('x'); return text; } }], value: 'f' } });
    }
    if (op === 'noInput') app.pickBackupFile();
    const { v } = app.renderVals();
    if (op === 'paste') v.onTogglePaste();
    if (op === 'text') { o.s = pick(['', '  ', backupText([ev(3)]), '{']); v.onBackupText({ target: { value: o.s } }); }
    if (op === 'ask') app.askRestore();
    if (op === 'export') { o.now = NOW; await app.exportBackup(); }
    if (op === 'close') { if (v.onCloseBackups) v.onCloseBackups(); else o.skip = true; }
    ops.push(o);
    const s1 = app.state;
    const v2 = app.renderVals().v;
    steps.push(J({ backupError: s1.backupError, backupListOpen: s1.backupListOpen, pasteOpen: s1.pasteOpen, backupText: s1.backupText,
      confirmRestore: s1.confirmRestore ? { count: s1.confirmRestore.count, dropped: s1.confirmRestore.dropped, at: s1.confirmRestore.at, n: (s1.confirmRestore.data.events || []).length } : null,
      lastExportAt: s1.settings.lastExportAt, backupRows: v2.backupListShown ? v2.backupRows.map((r) => ({ key: r.key, label: r.label })) : [],
      restoreDisabled: v2.restoreDisabled }));
  }
  globalThis.__native = true;
  acts.push({ now: NOW, state: J(st0), ops, steps });
}

// ---- 設定の画面の残りの値 ----
const views = [];
for (let k = 0; k < 120; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const jobs = [];
  for (let i = 0; i < pick([0, 1, 2]); i++) jobs.push({ id: 'j' + i, name: pick(['カフェ', '']), hourly: pick([1100, 5, 0]), retired: rnd() < 0.4 });
  const events = [];
  for (let i = 0; i < pick([0, 4, 10]); i++) events.push(ev(i, rnd() < 0.4 ? { id: 'i' + i, allDay: true, noReport: rnd() < 0.3 ? true : undefined } : {}));
  const settings = { ...mkApp({}).state.settings, onboarded: true, profile: pick(['student', 'work']), weekStart: pick([0, 1, undefined, '1']), overlayFree: rnd() < 0.5 };
  const st0 = { events, jobs, settings, screen: 'settings', setPage: pick([null, 'free', 'notify', 'types', 'backup', 'files']),
    overlayCals: pick([undefined, [], [{ id: 'a', title: '会社', color: '#f00' }]]),
    newType: pick([null, null, { name: '', color: '#2F72C4' }, { name: 'ジム', color: '#8B7AB8' }]),
    tplNew: pick([null, null, { jobId: 'j0', sym: '', name: '', from: 510, to: 1050, brk: 60, allDay: false }, { jobId: 'j0', sym: '夜', name: '夜勤', from: 1320, to: 420, brk: 90, allDay: true }]),
    pasteOpen: rnd() < 0.5, backupText: pick([undefined, '', '  ', 'abc']), backupError: pick([undefined, '', 'エラー']), trashOpen: rnd() < 0.3 };
  const app = mkApp(J(st0));
  const { v } = app.renderVals();
  views.push({ now: NOW, state: J(st0), out: J({ weekSeg: v.weekSeg.map((x) => ({ label: x.label, sel: x.sel })), remindRowShown: v.remindRowShown,
    overlayFree: v.overlayFree.on, overlayCalsShown: v.overlayCals.length > 0, syncShown: v.syncShown,
    newTypeShown: v.newTypeShown, newTypeName: v.newTypeName, newTypeEg: v.newTypeShown ? v.newTypeEg : '',
    tplNewShown: v.tplNewShown, tplSym: v.tplNewShown ? v.tplSym : '', tplName: v.tplNewShown ? v.tplName : '', tplAllDay: v.tplNewShown ? v.tplAllDay.on : false,
    tidyCount: v.tidyCount, pasteOpen: v.pasteOpen, backupText: v.backupText, backupError: v.backupError, restoreDisabled: v.restoreDisabled, trashShown: v.trashShown,
    stamp: `LUKKO-控え-${new Date(NOW).getFullYear()}${String(new Date(NOW).getMonth() + 1).padStart(2, '0')}${String(new Date(NOW).getDate()).padStart(2, '0')}.json`,
    ics: H.ics.toIcs(events) }) });
}

// ---- 設定の操作 ----
const setActs = [];
for (let k = 0; k < 80; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(7, 22), int(0, 59)).getTime();
  const jobs = [{ id: 'j0', name: 'カフェ', hourly: pick([5, 1100]), templates: [] }, { id: 'j1', name: '塾', hourly: 1500 }];
  const types = mkApp({}).state.types;
  const trash = [];
  for (let i = 0; i < 3; i++) trash.push({ ev: { ...ev(50 + i), id: 't' + i }, at: NOW - int(1, 20) * 86400000 });
  const st0 = { events: [ev(1, { jobId: 'j0', type: 'baito', status: 'jisseki' })], jobs, types, trash, settings: { ...mkApp({}).state.settings, onboarded: true },
    screen: 'settings', setPage: pick(['types', 'jobs', 'help', 'data']), editTypeKey: pick([null, 'yoji']), newType: pick([null, { name: 'x', color: '#8B7AB8' }]) };
  const app = mkApp(J(st0));
  const ops = [], steps = [];
  for (let s = 0; s < 6; s++) {
    const op = pick(['addTypeRow', 'minus', 'plus', 'tplOpen', 'tplSym', 'tplName', 'tplSave', 'tplClose', 'terms', 'privacy', 'docBack', 'trashOpen', 'trashClose', 'restore']);
    const o = { op };
    let { v } = app.renderVals();
    // 設定の値（_settingsVals）は設定の画面にいるときだけ。規約を開いているあいだは、規約から戻るだけ
    if (app.state.screen !== 'settings' && op !== 'docBack') { o.skip = true; o.uidN = uidN; ops.push(o); steps.push(steps.length ? steps[steps.length - 1] : null); continue; }
    if (op === 'addTypeRow') v.onAddTypeRow();
    if (op === 'minus' || op === 'plus') {
      app.setState({ editJobId: 'j0' }); v = app.renderVals().v;
      const row = v.jobRows.find((r) => r.open) || v.jobRows[0];
      if (row) (op === 'minus' ? row.onMinus : row.onPlus)(); else o.skip = true;
    }
    if (op === 'tplOpen') { app.setState({ editJobId: 'j0' }); v = app.renderVals().v; const row = v.jobRows.find((r) => r.open); if (row) row.onAddTemplate(); else o.skip = true; }
    if (op === 'tplSym') { o.s = pick(['', '日', '夜勤帯', '😀x']); if (v.onTplSym) v.onTplSym({ target: { value: o.s } }); else o.skip = true; }
    if (op === 'tplName') { o.s = pick(['', '日勤', 'とても長い型の名前ですよね']); if (v.onTplName) v.onTplName({ target: { value: o.s } }); else o.skip = true; }
    if (op === 'tplSave') { if (v.onTplSave) v.onTplSave(); else o.skip = true; }
    if (op === 'tplClose') { if (v.onTplCancel) v.onTplCancel(); else o.skip = true; }
    if (op === 'terms') v.onOpenTerms();
    if (op === 'privacy') v.onOpenPrivacy();
    if (op === 'docBack') v.onDocBack();
    if (op === 'trashOpen') v.onOpenTrash();
    if (op === 'trashClose') { if (v.onCloseTrash) v.onCloseTrash(); else o.skip = true; }
    if (op === 'restore') { app.setState({ trashOpen: true }); v = app.renderVals().v; const r = v.trashRows[0]; if (r) { o.key = r.key; r.onRestore(); } else o.skip = true; }
    o.uidN = uidN;
    ops.push(o);
    const s1 = app.state;
    steps.push(J({ newType: s1.newType, editTypeKey: s1.editTypeKey, editJobId: s1.editJobId, jobs: s1.jobs.map((j) => ({ id: j.id, hourly: j.hourly, templates: (j.templates || []).map((t) => ({ sym: t.sym, name: t.name, from: t.from, to: t.to, brk: t.brk, allDay: t.allDay })) })),
      tplNew: s1.tplNew, screen: s1.screen, docKey: s1.docKey, trashOpen: s1.trashOpen, trash: (s1.trash || []).map((x) => x.ev.id), events: s1.events.map((e) => e.id) }));
  }
  setActs.push({ now: NOW, state: J(st0), ops, steps });
}
Math.random = realRandom;
globalThis.__native = false;

fs.writeFileSync(path.join(OUT, 'backup-view.json'), JSON.stringify({ acts, views, setActs }));
console.log('backup-view', acts.length, 'acts', views.length, 'views', setActs.length, 'setActs');
