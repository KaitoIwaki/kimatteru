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
import { NativePurchases } from '@capgo/native-purchases';

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

// 動的に読み込んでいたが、実機で import() が返ってこないまま止まった。
// チャンクは iOS の中に確かに入っていたのに、読み込みが完了しない。
// Capacitor のプラグインは静的に import するのが普通で、
// 動的にする理由も無かった（呼ぶ側は native() で止めている）。
// 失敗しうる経路を自分で増やしていた。
const plugin = () => (native() ? NativePurchases : null);

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
  const p = plugin();
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
      return got ? { ...t, price: priceText(got, t) } : null;
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
 * 画面に出す値段。
 *
 * ふだんは StoreKit が返した文字列をそのまま使う。値段は Apple が持っていて、
 * こちらが持つ数字はいつか古くなるため——アプリが本当と違う値段を出すのは、
 * それ自体がまずい。
 *
 * ただし**円で返ってこなかったときだけ**、こちらの円に置き換える。
 * このアプリは日本にしか出していないので（2026-08）、実際に買う人が払うのは
 * 必ず円。円以外が返るのは、テストに使っている Apple ID のストアが日本以外の
 * ときで、そこでドルを出すと、買った記録（サポーターカードの合計は
 * TIPS の yen で数える）とも食い違う。
 *
 * 世界に出すときは、ここと `buyTip` の記録の両方を、実際に払った額と通貨で
 * 持つように作り直すこと。ここだけ直しても記録は円のままになる。
 */
function priceText(got, t) {
  const raw = got.priceString || got.displayPrice || '';
  const code = String(got.currencyCode || (got.priceLocale && got.priceLocale.currencyCode) || '').toUpperCase();
  // 通貨コードが取れればそれで見る。取れないときは記号で見る
  // （¥ は人民元でも使うが、日本にしか出していないので取り違えは起きない）
  const isYen = code ? code === 'JPY' : /[¥￥]|円/.test(raw);
  if (raw && isYen) return raw;
  return '¥' + t.yen.toLocaleString('ja-JP');
}

/**
 * 買う。戻り値は利用者に見せるひとこと。
 * 途中でやめたときは何も言わない（失敗として騒がない）。
 */
export async function buyTip(id) {
  const p = plugin();
  if (!p) return { ok: false, msg: '' };
  try {
    // ここに待ち時間の上限をかけてはいけない。
    // 購入は確認ダイアログやパスワード入力を挟む——人が操作している時間で、
    // 何秒かかるか決められない。上限をかけていたら、Apple 側が「完了しました」と
    // 言っているのに、こちらは「購入できませんでした」と出していた。
    // 上限が要るのは、返事を待つだけの処理（商品の取得）だけ。
    await p.purchaseProduct({ productIdentifier: id });
    return { ok: true, msg: 'ありがとうございます。' };
  } catch (e) {
    // 「やめた」も例外で来る。押し間違いを咎めない。
    // 文面は端末の言語で変わるので、英語と日本語の両方を見る
    // （Apple の paymentCancelled は 2 番）。
    const m = String((e && e.message) || '');
    const code = e && (e.code || e.errorCode);
    if (/cancel/i.test(m) || m.includes('キャンセル') || String(code) === '2') {
      return { ok: false, msg: '' };
    }
    return { ok: false, msg: '購入できませんでした。時間をおいて試してください。' };
  }
}
