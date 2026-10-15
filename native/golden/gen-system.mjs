// 正解表（golden）：アプリ全体のしくみ。
//  ・下のタブを押したとき（onNavCal・onNavFree・onNavReport・onNavSettings・onFab）に state がどう変わるか
//  ・iPhone の文字の大きさ（本文の pt）から、予定の字の倍率（_readSystemLook → evScale）
//
// 実行：node gen-system.mjs（先に build-harness.mjs で束ねておく）
process.env.TZ = 'Asia/Tokyo';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from './out/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'LukkoKit', 'Tests', 'LukkoKitTests', 'Fixtures', 'golden');

let seed = 20261015;
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

// ---- 下のタブ ----
const KEYS = ['screen', 'ym', 'dayNum', 'detailId', 'weekAnchor', 'flashToday', 'editTypeKey', 'setPage', 'returnTo', 'newType', 'draft'];
const nav = [];
for (let k = 0; k < 160; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(6, 23), int(0, 59)).getTime();
  const now = new RealDate(NOW);
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const ym = pick([{ y: today.y, m: today.m }, { y: today.y, m: today.m }, { y: today.y, m: (today.m + 1) % 12 }, { y: today.y - 1, m: today.m }]);
  const screen = pick(['month', 'month', 'day', 'detail', 'list', 'free', 'report', 'settings', 'notices', 'share', 'doc']);
  const base = mkApp({}).state;
  const settings = { ...base.settings, onboarded: true, lastType: pick([undefined, 'baito', 'yoji', 'zzz']), remindTimed: pick([undefined, 10, 60]), remindAllDay: pick([undefined, 0, 1440]) };
  const jobs = rnd() < 0.5 ? [{ id: 'j1', name: 'カフェ', hourly: 1200, retired: rnd() < 0.3 }, { id: 'j2', name: '塾', hourly: 1500 }] : [];
  const init = { screen, ym, today, settings, jobs, dayNum: pick([null, int(1, 28)]), detailId: pick([null, 'e1']), weekAnchor: pick([null, 5]),
    editTypeKey: pick([null, 'yoji']), setPage: pick([null, 'backup', 'notify']), returnTo: pick(['month', 'day', 'list']), events: [], flashToday: null };
  const tab = pick(['month', 'month', 'free', 'report', 'settings', 'add']);
  const app = mkApp(J(init));
  const { v } = app.renderVals();
  ({ month: v.onNavCal, free: v.onNavFree, report: v.onNavReport, settings: v.onNavSettings, add: v.onFab })[tab]();
  const out = {};
  for (const key of KEYS) out[key] = J(app.state[key]);
  nav.push({ now: NOW, init: J(init), tab, out });
}

// ---- 文字の大きさ ----
const zoom = [];
for (const px of [0, 11, 14, 15, 16, 16.5, 17, 17.4, 17.5, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 33, 40, 47, 53]) {
  for (const fontScale of [undefined, 1, 1.15, 1.3, 1.6, 0.8]) {
    const app = mkApp({ settings: { ...mkApp({}).state.settings, fontScale } });
    const saved = { createElement: globalThis.document.createElement, gcs: globalThis.getComputedStyle };
    globalThis.document.createElement = () => ({ style: {}, textContent: '' });
    globalThis.getComputedStyle = () => ({ fontSize: px ? px + 'px' : '' });
    app._readSystemLook();
    globalThis.document.createElement = saved.createElement;
    globalThis.getComputedStyle = saved.gcs;
    zoom.push({ px, fontScale: fontScale === undefined ? null : fontScale, sysZoom: app._sysZoom, evScale: app.evScale() });
  }
}

fs.writeFileSync(path.join(OUT, 'system.json'), JSON.stringify({ nav, zoom }));
console.log('system.json', nav.length, zoom.length);
