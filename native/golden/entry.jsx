// Node で App を作るための入口。ブラウザにしか無いものを、最低限だけ用意する
const mem = new Map();
globalThis.window = globalThis;
globalThis.__ls = mem; // 正解表を作るとき、起動前の保存の中身を入れる
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.document = { addEventListener() {}, removeEventListener() {}, hidden: false, documentElement: { style: { setProperty() {} }, setAttribute() {}, dataset: {} }, getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null, setAttribute() {}, appendChild() {} }), body: { appendChild() {}, removeChild() {} }, querySelector: () => null, fonts: { ready: Promise.resolve() } };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} });
globalThis.innerWidth = 393; globalThis.innerHeight = 852;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.location = { search: '', href: 'http://localhost/' };
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };
export { default as App } from '../../app/src/App.jsx';
export * as AppMod from '../../app/src/App.jsx';
export * as whenlib from '../../app/src/whenlib.js';
export * as timegrid from '../../app/src/timegrid.js';
export * as holidays from '../../app/src/holidays.js';
export * as notify from '../../app/src/notify.js';
export * as ics from '../../app/src/ics.js';
export * as calendarimport from '../../app/src/calendarimport.js';
export * as widgetdata from '../../app/src/widgetdata.js';
export * as sync from '../../app/src/sync.js';
export * as notices from '../../app/src/notices.js';
export * as eventctx from '../../app/src/eventctx.js';
