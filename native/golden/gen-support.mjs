// 正解表（golden）：応援・サポーターカード・規約の文・診断の行（設定の担当ぶん）。
//  ・cardflip.js（norm・showsFront・dragToDeg・tiltFor・settle・settleTime・ease・cardShadow）
//  ・cardtexture.js（刷り目・粒子・画面用の粒の型）
//  ・App.jsx の CARD_TIERS・FLECKS・tierFor・nextTier・formHref
//  ・tipjar.js の priceText（外に出していないので、元の文をそのまま読んで使う）
//  ・docs.js の本文
//  ・renderVals の応援・カード・診断の値と、応援の操作（buyTip・お礼・カード・名前）
//
// 実行：node gen-support.mjs（先に build-harness.mjs で束ねておく）
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
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};

const mkApp = (st) => {
  const app = new H.App({});
  app.setState = (u, cb) => { const p = typeof u === 'function' ? u(app.state, app.props) : u; if (p) app.state = { ...app.state, ...p }; if (cb) cb(); };
  app.state = { ...app.state, ...st };
  return app;
};

// ---- カードを回す計算 ----
const F = H.cardflip;
const flip = [];
for (let k = 0; k < 400; k++) {
  const deg = pick([0, 90, 180, 270, 360, -90, -180, 45, 179.9, 270.1, -0.5]) + (rnd() < 0.6 ? (rnd() - 0.5) * 1440 : 0);
  const vel = pick([0, 100, -100, 259.9, 260, -260, 1000, -1000, (rnd() - 0.5) * 2000]);
  const dx = (rnd() - 0.5) * 800, w = pick([0, 320, 335, 351.5, -1]);
  const dy = pick([0, -0, 50, -50, 100, -100, 200, -200, (rnd() - 0.5) * 300]);
  const to = F.settle(deg, vel);
  const t = pick([-0.1, 0, 0.05, 0.2, 0.5, 0.8, 1, 1.2, rnd()]);
  const other = deg + (rnd() - 0.5) * 900;
  flip.push({ deg, vel, dx, w, dy, t, other, norm: F.norm(deg), front: F.showsFront(deg), drag: F.dragToDeg(dx, w), tilt: F.tiltFor(dy), settle: to,
    settleTime: F.settleTime(deg, to), settleTime2: F.settleTime(deg, other), ease: F.ease(t),
    shadow: F.cardShadow(deg), shadowBack: F.cardShadow(deg, true) });
}

// ---- 肌理 ----
const T = H.cardtexture;
const tileN = Math.round((T.GRAIN_N * 64 * 64) / (335 * 211));
const texture = {
  brush: T.brushLines(335, 211), brushBig: T.brushLines(1080, Math.round(1080 / 1.586)),
  grain: T.grainDots(335, 211), tile: T.grainDots(64, 64).slice(0, tileN), tileN,
  consts: [T.BRUSH_N, T.GRAIN_N, T.BRUSH_LIGHT, T.BRUSH_DARK, T.GRAIN_LIGHT, T.GRAIN_DARK],
};

// ---- 段 ----
const A = H.AppMod;
const tiers = A.CARD_TIERS.map((t) => ({ ...t, stops: t.paper.map((c, i) => `${c} ${Math.round((i * 100) / (t.paper.length - 1))}%`).join(', ') }));
const totals = [];
for (const n of [0, 1, 299, 300, 999, 1000, 1001, 2999, 3000, 3001, 9999, 100000]) totals.push({ total: n, tier: A.tierFor(n).key, next: A.nextTier(n) ? A.nextTier(n).key : null });

// ---- フォームのアドレス（端末の字は UA から作られる。こちらは「iPhone・iOS 18.1」の形で比べる）----
const forms = [];
for (const ua of ['node', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)', 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)']) {
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua }, configurable: true, writable: true });
  const m = /(iPhone|iPad).*?OS (\d+)_(\d+)/.exec(ua);
  const device = m ? `${m[1]}・iOS ${m[2]}.${m[3]}` : null;
  for (const version of ['1.3.3（0.32.2）', '2.0（0.40.0）', '']) {
    for (const kind of ['', '機能のリクエスト', 'a b&c=d/?']) forms.push({ version, kind, device, href: A.formHref(version, kind) });
  }
}
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true, writable: true });

// ---- 値段の字（tipjar.js の priceText を元の文から取り出して使う）----
const src = fs.readFileSync(path.join(here, '..', '..', 'app', 'src', 'tipjar.js'), 'utf8').split(String.fromCharCode(13)).join('');
const body = src.slice(src.indexOf('function priceText('), src.indexOf('\n}\n', src.indexOf('function priceText(')) + 3);
const priceText = new Function(body + '; return priceText;')();
const prices = [];
for (const raw of ['¥300', '￥600', '300円', '$2.99', '', '1,000 JPY', '¥1,000']) {
  for (const code of ['', 'JPY', 'jpy', 'USD']) {
    for (const t of H.tipjar.TIPS) prices.push({ raw, code, yen: t.yen, out: priceText({ priceString: raw, currencyCode: code }, t) });
  }
}

// ---- 規約の文 ----
const docs = { contact: H.docs.CONTACT, appName: H.docs.APP_NAME, appStoreId: H.docs.APP_STORE_ID, effective: H.docs.EFFECTIVE, formURL: H.docs.FORM_URL,
  privacy: H.docs.PRIVACY, terms: H.docs.TERMS, keys: Object.keys(H.docs.DOCS) };

// ---- 画面の値（応援・カード・お礼・診断）----
globalThis.__native = true;
const views = [];
const TIPS = H.tipjar.TIPS;
for (let k = 0; k < 160; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(0, 23), int(0, 59)).getTime();
  const supports = [];
  const n = pick([0, 0, 1, 2, 3, 5, 12]);
  for (let i = 0; i < n; i++) {
    const t = pick(TIPS);
    supports.push({ id: t.id, yen: pick([t.yen, t.yen, 1000.7, -5, 2147483648 + 300]), at: NOW - int(0, 800) * 86400000 - int(0, 86399999) });
  }
  if (n > 2 && rnd() < 0.3) supports[1].at = supports[0].at;   // 同じ時刻（並べ替えの安定さ）
  const tips = rnd() < 0.6 ? TIPS.filter(() => rnd() < 0.8).map((t) => ({ ...t, price: pick(['¥' + t.yen, '¥' + t.yen.toLocaleString('ja-JP'), '$2.99']) })) : pick([null, undefined, []]);
  const settings = { ...mkApp({}).state.settings, onboarded: true, supporterName: pick([undefined, '', '  ', '見本', ' 名前 ', 'とても長い名前とても長い名前とても長い']) };
  const probe = pick([null, null, { running: true },
    { native: true, billing: null, asked: TIPS.map((t) => t.id), got: [], error: '', tips: null },
    { native: true, billing: true, asked: TIPS.map((t) => t.id), got: [TIPS[0].id, TIPS[2].id], error: '', tips: null, widget: { there: true, last: { ok: true, days: 20, size: 1234 } } },
    { native: false, billing: false, asked: [], got: [], error: 'ネイティブではない（ブラウザ）', tips: null, widget: { there: false, last: { ok: false, why: '窓口が無い' } } },
    { native: true, billing: false, asked: ['a'], got: ['a', 'b'], error: 'x', tips: null, widget: { there: true, last: null } }]);
  const st0 = { supports, tips, settings, screen: supports.length ? pick(['settings', 'card']) : 'settings', cardAngle: 0, tipBusy: rnd() < 0.3 && tips && tips.length ? pick(tips).id : pick([null, undefined]),
    tipThanks: rnd() < 0.3 ? { id: pick([...TIPS.map((t) => t.id), 'zzz']) } : null, probe };
  const app = mkApp(J(st0));
  const { v } = app.renderVals();
  const out = J({ supporterShown: v.supporterShown, supporterTotal: v.supporterTotal, supporterCount: v.supporterCount, supporterSince: v.supporterSince,
    tipShown: v.tipShown, tipRows: v.tipRows.map((t) => ({ id: t.id, label: t.label, price: t.price, pressed: t.pressed })),
    tipThanksShown: v.tipThanksShown, tipThanksId: v.tipThanksId, tipThanksPrice: v.tipThanksPrice,
    cardShown: v.cardShown, cardOwner: v.cardOwner, cardOwnerShown: v.cardOwnerShown, cardSince: v.cardSince, cardTotal: v.cardTotal, cardTimes: v.cardTimes,
    cardHistory: v.cardHistory, cardTierName: v.cardTierName, cardMarkColor: v.cardMarkColor, cardNextText: v.cardNextText,
    probeShown: v.probeShown, probeRows: v.probeRows });
  views.push({ now: NOW, state: J(st0), out });
}

// ---- 応援の操作 ----
const acts = [];
for (let k = 0; k < 60; k++) {
  NOW = new RealDate(2026, int(0, 11), int(1, 28), int(0, 23), int(0, 59)).getTime();
  const supports = rnd() < 0.5 ? [{ id: TIPS[0].id, yen: 300, at: NOW - 86400000 * 40 }] : [];
  const st0 = { supports, tips: TIPS.map((t) => ({ ...t, price: '¥' + t.yen })), settings: { ...mkApp({}).state.settings, onboarded: true }, screen: 'settings', setPage: pick([null, 'support']) };
  const now0 = NOW;
  const app = mkApp(J(st0));
  const ops = [];
  const steps = [];
  for (let s = 0; s < 6; s++) {
    const op = pick(['buy', 'buy', 'close', 'thanksCard', 'openCard', 'cardBack', 'name', 'busyBuy']);
    const o = { op };
    if (op === 'buy') { o.id = pick(TIPS).id; NOW += int(1, 100000); await app.buyTip(o.id); }
    if (op === 'busyBuy') { o.id = pick(TIPS).id; app.state.tipBusy = TIPS[0].id; await app.buyTip(o.id); app.state.tipBusy = null; }
    const { v } = app.renderVals();
    if (op === 'close' && v.onTipThanksClose) v.onTipThanksClose();
    if (op === 'thanksCard' && v.onTipThanksCard) v.onTipThanksCard();
    if (op === 'openCard' && v.onOpenCard) v.onOpenCard();
    if (op === 'cardBack' && v.onCardBack) v.onCardBack();
    if (op === 'name') { o.s = pick(['', '見本', 'あいうえおかきくけこさしすせそたちつてとなにぬねの', '😀😀😀😀😀😀😀😀😀😀😀']); if (v.onCardName) v.onCardName({ target: { value: o.s } }); else o.skip = true; }
    if ((op === 'close' && !v.onTipThanksClose) || (op === 'thanksCard' && !v.onTipThanksCard) || (op === 'openCard' && !v.onOpenCard) || (op === 'cardBack' && !v.onCardBack)) o.skip = true;
    o.now = NOW;
    ops.push(o);
    const s1 = app.state;
    steps.push(J({ supports: s1.supports, tipThanks: s1.tipThanks, tipBusy: s1.tipBusy, screen: s1.screen, cardAngle: s1.cardAngle, supporterName: s1.settings.supporterName }));
  }
  acts.push({ now: now0, state: J(st0), ops, steps });
}
globalThis.__native = false;

fs.writeFileSync(path.join(OUT, 'support.json'), JSON.stringify({ flip, texture, tiers, totals, flecks: A.FLECKS, forms, prices, docs, views, acts }));
console.log('support', flip.length, 'flip', views.length, 'views', acts.length, 'acts', forms.length, 'forms', prices.length, 'prices');
