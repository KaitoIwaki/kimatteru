// 正解表（golden）その6：起動したときの中身・日付の変わり目・戻ってきたとき・画面の行き来。
//
// 実行：node gen-boot.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 4242;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const J = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

const RealDate = Date;
let NOW = 0;
class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = FakeDate;
let timers = [];
globalThis.setTimeout = (fn, ms) => { timers.push(fn); return timers.length; };
globalThis.clearTimeout = () => {};

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};
const out = { defaults: [], steps: [] };

// はじめの状態（保存が無いとき）
globalThis.__ls.clear();
for (const t of [new RealDate(2026, 9, 15, 10, 7), new RealDate(2026, 11, 31, 23, 59, 59), new RealDate(2027, 0, 1, 0, 0, 0), new RealDate(2024, 1, 29, 12)]) {
  NOW = t.getTime();
  out.defaults.push({ now: NOW, state: J(new H.App({}).state) });
}

const KEYS = ['screen', 'returnTo', 'detailId', 'dayNum', 'ym', 'freeYM', 'freeDir', 'today', 'dialog', 'notices', 'settings', 'flashToday', 'weekAnchor', 'swipeRow', 'dayFrom', 'dayDir', 'detailMenu', 'locked', 'noticeOpen'];
const snap = (app) => { const o = {}; for (const k of KEYS) o[k] = app.state[k]; return J(o); };
const HH = () => String(int(0, 23)).padStart(2, '0') + ':' + pick(['00', '30']);
for (let k = 0; k < 150; k++) {
  NOW = new RealDate(2026, int(8, 11), int(1, 28), int(0, 23), int(0, 59)).getTime();
  const t0 = new RealDate(NOW - pick([0, 0, 86400000, 3 * 86400000]));
  const events = [];
  for (let i = 0; i < int(0, 8); i++) {
    events.push({ id: 'e' + i, type: pick(['baito', 'yoji']), status: pick(['kakutei', 'mikakutei', 'jisseki']), title: pick(['カフェ', '会議']), y: 2026, m: int(8, 11), day: int(1, 28), start: HH(), end: HH(), place: pick([undefined, '渋谷', 'https://x.test']) });
  }
  const notices = rnd() < 0.5 ? [{ id: 'shift-e0', kind: 'shift', eventId: 'e0', title: 't', body: 'b', at: 1, read: false }, { id: 'info-x', kind: 'info', title: 'i', body: 'b', at: 2, read: rnd() < 0.5 }] : [];
  const init = { events, notices, today: { y: t0.getFullYear(), m: t0.getMonth(), d: t0.getDate() }, ym: { y: 2026, m: int(0, 11) }, freeYM: { y: 2026, m: int(0, 11) },
    screen: pick(['month', 'day', 'detail', 'free', 'report', 'settings', 'new']), returnTo: pick(['month', 'day', '']), settings: { ...mkApp({}).state.settings, onboarded: true, lock: rnd() < 0.3, firstUseAt: NOW - int(0, 30) * 86400000, confirmCount: 0 } };
  const app = mkApp(J(init));
  app._lockAvailable = rnd() < 0.5;
  app.unlock = () => {};
  const init0 = snap(app);
  const steps = [];
  for (let s = 0; s < int(1, 5); s++) {
    const r = rnd();
    let op;
    if (r < 0.15) { app._checkToday(); op = { call: 'checkToday' }; }
    else if (r < 0.3) { const away = pick([0, 20000, 31000, 29 * 60000, 31 * 60000, 5 * 3600000]); app._hiddenAt = NOW - away; app._returnedAt = 0; app._onReturn(); op = { call: 'onReturn', away, lockAvailable: app._lockAvailable }; }
    else if (r < 0.45 && events.length) { const ev = pick(app.state.events); const from = pick([undefined, 'day', '']); app.openFor(ev, from); op = { call: 'openFor', id: ev.id, from }; }
    else if (r < 0.55) { const d = int(1, 28); app.openDay(d); op = { call: 'openDay', d }; }
    else if (r < 0.65) { app.goToday(); op = { call: 'goToday' }; }
    else if (r < 0.75) { const dir = pick([1, -1]); app.shiftFree(dir); op = { call: 'shiftFree', dir }; }
    else if (r < 0.85 && app.state.notices.length) { const id = pick(app.state.notices).id; app.openNotice({ id }); op = { call: 'openNotice', id }; }
    else if (r < 0.9) { app.markAllRead(); op = { call: 'markAllRead' }; }
    else { app._refreshNotif(); op = { call: 'refreshNotif' }; }
    steps.push({ op, state: snap(app) });
  }
  // 書きかけかどうか
  const dirty = [];
  for (let i = 0; i < 4; i++) {
    const ev = events.length && rnd() < 0.6 ? pick(events) : null;
    const draft = ev ? { editingId: ev.id, title: ev.title + pick(['', ' ', '!']), type: ev.type, start: ev.start, end: pick([ev.end, '23:00']), y: ev.y, m: ev.m, day: ev.day, status: ev.status, allDay: pick([false, undefined]), place: pick([ev.place, '', undefined]), memo: '', link: '' }
      : { editingId: pick([null, 'none']), title: pick(['', '  ', 'x']), place: pick(['', undefined]), memo: '', link: '' };
    const screen = pick(['new', 'new', 'month']);
    app.setState({ draft, screen });
    dirty.push({ draft, screen, events: J(app.state.events), out: app.draftDirty() });
  }
  out.steps.push({ now: NOW, init: init0, events: J(events), steps, dirty });
}
fs.writeFileSync(path.join(OUT, 'boot.json'), JSON.stringify(out));
console.log('boot', out.defaults.length, out.steps.length, out.steps.reduce((a, s) => a + s.steps.length, 0));
