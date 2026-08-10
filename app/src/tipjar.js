// 開発応援（投げ銭）。
//
// 見返りに機能を渡さない。渡した瞬間、応援ではなく機能販売になる。
// 消耗型（Consumable）なので、何度でも買える。権利を持たないので
// 「購入の復元」も要らない——復元するものが無いため。
//
// RevenueCat のような仲介は使わない。あちらは購入データを自社サーバーに通すので、
// 「本アプリ自身は外部のサーバーへ通信しません」というプライバシーポリシーと、
// App Store の「データを収集しない」という申告を、どちらも書き換えることになる。
// このプラグインは Apple としか話さない。
import { Capacitor } from '@capacitor/core';

const native = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
};

// App Store Connect に登録する商品ID。ここを変えるときは向こうも直す。
// 一番上を Pro（¥1,200前後）より必ず下にする。応援のほうが高いと不自然で、
// 「そこまで出すなら Pro を買おう」という流れも作れなくなる。
export const TIPS = [
  { id: 'com.kimatteru.app.tip300', yen: 300, label: 'コーヒー1杯' },
  { id: 'com.kimatteru.app.tip600', yen: 600, label: 'ランチ1回' },
  { id: 'com.kimatteru.app.tip1000', yen: 1000, label: 'しっかり応援' },
];

let mod = null;
const plugin = async () => {
  if (!native()) return null;
  if (!mod) mod = await import('@capgo/native-purchases');
  return mod.NativePurchases;
};

// ネイティブ側が黙ったままになることがある（例外も返らず、ただ返事が来ない）。
// 待ち続けると画面が「読み込み中…」のまま固まり、何が起きたか分からない。
// 返事が無いこと自体を結果として扱う。
const LIMIT = 8000;
const withLimit = (promise, label) => Promise.race([
  promise,
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(label + ' が ' + (LIMIT / 1000) + '秒たっても返事をしない')), LIMIT)),
]);

/**
 * 値段を App Store から取ってくる。
 * 円は TIPS にも書いてあるが、表示は必ず向こうの値を使う——
 * 為替も税も国ごとの価格もこちらでは決められない。
 * 取れなければ null を返す。呼ぶ側は「いま買えない」として扱う。
 */
export async function loadTips() {
  const r = await probeTips();
  return r.tips;
}

/**
 * 値段を取りにいって、何が起きたかも返す。
 * うまくいかないとき、画面には何も出ない作りにしてある（買えない行を並べないため）。
 * そのままだと原因が誰にも見えないので、診断用にここだけは全部返す。
 */
export async function probeTips() {
  const out = { native: native(), billing: null, asked: TIPS.map((t) => t.id), got: [], error: '', tips: null };
  let p = null;
  try {
    p = await withLimit(plugin(), 'プラグインの読み込み');
  } catch (e) {
    out.error = 'プラグインを読み込めない: ' + ((e && e.message) || String(e));
    return out;
  }
  if (!p) { out.error = 'ネイティブではない（ブラウザ）'; return out; }
  try {
    const b = await withLimit(p.isBillingSupported(), 'isBillingSupported');
    out.billing = !!(b && b.isBillingSupported);
  } catch (e) {
    out.billing = false;
    out.error = '課金が使えるか調べられない: ' + ((e && e.message) || String(e));
  }
  try {
    const r = await withLimit(p.getProducts({ productIdentifiers: TIPS.map((t) => t.id) }), 'getProducts');
    const found = (r && r.products) || [];
    out.got = found.map((x) => x.identifier || x.id || '(識別子なし)');
    if (!found.length) {
      if (!out.error) out.error = '商品が0件。App Store Connect 側が未完成か、製品IDがちがう。';
      return out;
    }
    const tips = TIPS.map((t) => {
      const got = found.find((x) => (x.identifier || x.id) === t.id);
      return got ? { ...t, price: got.priceString || got.displayPrice || `¥${t.yen}` } : null;
    }).filter(Boolean);
    out.tips = tips.length ? tips : null;
    if (!out.tips) out.error = '取れた商品の識別子が、こちらの製品IDと一致しない。';
    return out;
  } catch (e) {
    out.error = '取得でエラー: ' + ((e && e.message) || String(e));
    return out;
  }
}

/**
 * 買う。戻り値は利用者に見せるひとこと。
 * 途中でやめたときは何も言わない（失敗として騒がない）。
 */
export async function buyTip(id) {
  let p = null;
  try { p = await plugin(); } catch (e) { return { ok: false, msg: '購入できませんでした。' }; }
  if (!p) return { ok: false, msg: '' };
  try {
    await withLimit(p.purchaseProduct({ productIdentifier: id }), 'purchaseProduct');
    return { ok: true, msg: 'ありがとうございます。' };
  } catch (e) {
    // 「キャンセルした」も例外で来る。押し間違いを咎めない。
    const m = String((e && e.message) || '');
    if (/cancel/i.test(m)) return { ok: false, msg: '' };
    return { ok: false, msg: '購入できませんでした。時間をおいて試してください。' };
  }
}
