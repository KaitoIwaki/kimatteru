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

/**
 * 値段を App Store から取ってくる。
 * 円は TIPS にも書いてあるが、表示は必ず向こうの値を使う——
 * 為替も税も国ごとの価格もこちらでは決められない。
 * 取れなければ null を返す。呼ぶ側は「いま買えない」として扱う。
 */
export async function loadTips() {
  const p = await plugin();
  if (!p) return null;
  try {
    const r = await p.getProducts({ productIdentifiers: TIPS.map((t) => t.id) });
    const found = (r && r.products) || [];
    if (!found.length) return null;
    return TIPS.map((t) => {
      const got = found.find((x) => (x.identifier || x.id) === t.id);
      return got ? { ...t, price: got.priceString || got.displayPrice || `¥${t.yen}` } : null;
    }).filter(Boolean);
  } catch (e) {
    return null;
  }
}

/**
 * 買う。戻り値は利用者に見せるひとこと。
 * 途中でやめたときは何も言わない（失敗として騒がない）。
 */
export async function buyTip(id) {
  const p = await plugin();
  if (!p) return { ok: false, msg: '' };
  try {
    await p.purchaseProduct({ productIdentifier: id });
    return { ok: true, msg: 'ありがとうございます。' };
  } catch (e) {
    // 「キャンセルした」も例外で来る。押し間違いを咎めない。
    const m = String((e && e.message) || '');
    if (/cancel/i.test(m)) return { ok: false, msg: '' };
    return { ok: false, msg: '購入できませんでした。時間をおいて試してください。' };
  }
}
