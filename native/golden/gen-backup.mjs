// 正解表（golden）その4：控え（バックアップ）。控えの中身を作る・読む・戻す。
// 控えは前の版で書いたものも、これからも戻せないといけない（形は format 2 のまま）。
//
// 実行：node gen-backup.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 90210;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const RealDate = Date;
let NOW = new RealDate(2026, 9, 15, 10, 7, 0).getTime();
class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = FakeDate;
let timers = [];
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, at: NOW + (ms || 0) }); return timers.length; };
globalThis.clearTimeout = () => {};

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
const KEYS = ['events', 'types', 'overrides', 'settings', 'notices', 'lastSeenVersion', 'jobs', 'supports', 'trash', 'someday', 'gone',
  'screen', 'confirmRestore', 'pasteOpen', 'backupText', 'backupError', 'shareMsg', 'shareToast'];
const snap = (app) => { const o = {}; for (const k of KEYS) o[k] = app.state[k]; return JSON.parse(JSON.stringify(o)); };

const HH = () => String(int(6, 22)).padStart(2, '0') + ':' + pick(['00', '30']);
const mkEvents = (pfx, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const e = { id: pfx + i, type: pick(['yoji', 'baito', 'asobi']), title: pick(['定例', '歯医者', '飲み会']), y: 2026, m: int(0, 11), day: int(1, 28),
      start: HH(), end: HH(), status: pick(['kakutei', 'mikakutei', 'jisseki']), updatedAt: int(1, 9) * 1000 };
    out.push(e);
  }
  return out;
};
const dirty = () => pick([
  { id: 'd1', y: 2026, m: 12, day: 3, start: '10:00', end: '11:00' },
  { id: 'd2', y: '2026', m: 1, day: 3 },
  { id: 'd3', y: 2026, m: 1, day: 3, start: '25:00', end: 'x' },
  { y: 2026, m: 1, day: 3, start: '10:00', end: '11:00', title: '番号なし' },
  null, 'x', [1, 2],
  { id: 'd4', y: 2026, m: 1, day: 0 },
  { id: 'd5', y: 2026, m: 1, day: 3, start: '0:00', end: '23:59' },
]);
const mkState = (k) => {
  const st = { events: mkEvents('e', int(0, 6)), jobs: rnd() < 0.5 ? [{ id: 'j1', name: 'カフェ', hourly: 1100 }] : [], overrides: rnd() < 0.5 ? { '2026-9-3': '×' } : {},
    notices: [], supports: rnd() < 0.3 ? [{ at: 5, n: 1 }] : [], trash: [], someday: [], gone: rnd() < 0.3 ? [['e9', 5]] : [],
    settings: { ...mkApp({}).state.settings, hourly: pick([1100, 1300]), weekStart: pick([0, 1]), onboarded: true, firstUseAt: 7 },
    lastSeenVersion: pick([null, '0.30.0']), screen: pick(['settings', 'backup']), backupText: pick(['', 'x']), pasteOpen: rnd() < 0.5, backupError: pick(['', 'エラー']) };
  if (rnd() < 0.3) st.types = [...mkApp({}).state.types.map((t) => ({ ...t })), { key: 'c' + k, name: 'ジム', color: '#C77D8E', paper: 'p', dark: 'd', uWord: 'u', cWord: 'c' }];
  return st;
};

const texts = [];
// アプリが書いた控え（そのまま／書き出しの形＝字下げあり）
for (let k = 0; k < 60; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(0, 23), int(0, 59), int(0, 59)).getTime() + int(0, 999);
  const app = mkApp(JSON.parse(JSON.stringify(mkState(k))));
  // 控えにだけ入る、少し崩れた中身
  if (rnd() < 0.4) app.state.events = [...app.state.events, dirty(), dirty()];
  if (rnd() < 0.2) app.state.trash = [{ ev: { id: 'tr1', y: 2026, m: 1, day: 2, start: '10:00', end: '11:00' }, at: NOW - 86400000 * int(1, 40) }];
  const t = app._backupText();
  texts.push({ text: rnd() < 0.5 ? t : JSON.stringify(JSON.parse(t), null, 2), backup: JSON.parse(t), state: snap(app), now: NOW });
}
const odd = ['', 'not json', 'null', '123', '"x"', '[]', '{}', '{"app":"other","data":{"events":[]}}',
  '{"app":"kimatteru","format":3,"data":{"events":[]}}', '{"app":"kimatteru","format":"2","data":{"events":[]}}',
  '{"app":"kimatteru","format":2.9,"data":{"events":[]}}', '{"app":"kimatteru","format":1e10,"data":{"events":[]}}',
  '{"app":"kimatteru","format":-1,"data":{"events":[{"id":"a","y":2026,"m":0,"day":1}]}}',
  '{"app":"kimatteru","format":2}', '{"app":"kimatteru","data":{"events":{}}}', '{"app":"kimatteru","data":null}',
  '{"app":"kimatteru","data":{"events":[],"settings":"ab"},"exportedAt":"2026-01-02T03:04:05.000Z"}',
  '{"app":"kimatteru","data":{"events":[{"id":"a","y":2026,"m":0,"day":1,"updatedAt":99}],"settings":[1,2],"overrides":0,"notices":null,"lastSeenVersion":""}}',
  ' {"app":"kimatteru","data":{"events":[]}} ', '{"app":"kimatteru","data":{"events":[]},}'];
for (const t of odd) texts.push({ text: t });

const cases = [];
for (let i = 0; i < texts.length; i++) {
  const src = texts[i];
  for (let rep = 0; rep < 2; rep++) {
    NOW = new RealDate(2026, 9, 15, 10, int(0, 59), 0).getTime();
    const init = mkState(1000 + i);
    // 戻す先：予定の番号が一部重なるように
    if (src.backup && rnd() < 0.6) init.events = [...init.events, ...src.backup.data.events.filter((e) => e && typeof e === 'object' && !Array.isArray(e) && rnd() < 0.5).map((e) => ({ ...e, updatedAt: pick([1, 99999, e.updatedAt]) }))];
    const app = mkApp(JSON.parse(JSON.stringify(init)));
    const init0 = snap(app);
    const r = app.parseBackup(src.text);
    const c = { text: src.text, now: NOW, init: init0, parsed: JSON.parse(JSON.stringify(r)) };
    if (!r.error) {
      const merge = rep === 1;
      let backups = 0;
      const was = app.state.events.length;
      app.setState({ confirmRestore: merge ? { ...r, merge: true } : r });
      app.doRestore();
      backups = was ? 1 : 0;
      c.merge = merge;
      c.backups = backups;
      c.state = snap(app);
    }
    cases.push(c);
  }
}
// 控えの中身を作る（いまの状態 → 控えの JSON）
const make = texts.filter((t) => t.backup).map((t) => ({ state: t.state, now: t.now, backup: t.backup }));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'backup.json'), JSON.stringify({ keys: KEYS, make, cases }));
console.log('backup make', make.length, 'cases', cases.length, 'restored', cases.filter((c) => c.state).length);
