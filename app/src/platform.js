// ここが「アプリの中」なのか「ブラウザ」なのかを決める、唯一の場所。
//
// これまでは各ファイルが自前で Capacitor.isNativePlatform() を持っていた。
// 「ネイティブでないから、この機能は使えない」を判断するにはそれで足りる。
// けれど Web 版を出すとなると、それだけでは足りない話が出てくる。
//
// いちばん大きいのは、保存の話。
// store.js の冒頭に書いたとおり、このアプリはサーバーを持たないので、
// 端末から消えたら戻せない。アプリの中では、その最後の砦が Library の
// ファイルだった。ブラウザには、その砦が無い。
//
// しかもブラウザは、こちらが書いたものを勝手に捨てることがある。
//   - 空き容量が減ったとき、古いサイトのデータから捨てられる
//   - Safari は、7日間ひらかれなかったサイトの保存領域を捨てることがある
//
// どちらも「ホーム画面に追加してもらう」と「永続化を申請する」の
// 2つでかなり避けられる。この2つを、ここで面倒みる。
import { Capacitor } from '@capacitor/core';

/** iOS アプリの中で動いているか */
export function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
}

/** ふつうのブラウザで開かれているか */
export const isWeb = () => !isNative();

/**
 * ホーム画面に追加された状態（＝スタンドアロン）で開かれているか。
 * この状態だと Safari の「7日で捨てる」の対象から外れる。
 */
export function isInstalled() {
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    // iOS Safari だけは display-mode を見てくれないので、独自の印を見る
    return navigator.standalone === true;
  } catch (e) {
    return false;
  }
}

/**
 * 保存領域を「捨てないでほしい」とブラウザに申し込む。
 *
 * 通るかどうかはブラウザが決める（こちらから交渉はできない）。
 * Chrome や Firefox はサイトの使われ方を見て自動で判断し、
 * Safari はホーム画面に追加されていれば通る。
 * 断られても困らないように、返り値は「通ったか」だけにしてある。
 */
export async function requestPersistence() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    // すでに通っているなら、もう一度聞かない（ブラウザによっては聞くたびに
    // 許可のダイアログが出る）
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
    return await navigator.storage.persist();
  } catch (e) {
    return false;
  }
}

/** いま保存領域が守られているか。分からないときは false を返す */
export async function isPersisted() {
  try {
    if (!navigator.storage || !navigator.storage.persisted) return false;
    return await navigator.storage.persisted();
  } catch (e) {
    return false;
  }
}
