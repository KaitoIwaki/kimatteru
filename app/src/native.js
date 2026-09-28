// アプリの中に直接書いた Swift の窓口（ios/App/App/LukkoNative.swift）を呼ぶ。
//
//   ・Face ID / Touch ID / パスコードで確かめる（開くときのロック）
//   ・アプリを切り替える画面で中身をぼかす
//   ・App Store の評価の小窓（iPhone 標準の星の小窓。出すかどうか・回数は iPhone が決める）
//
// 窓口が無いとき（ブラウザ・古いビルド）は、静かに何もしない。
// どれも端末の中だけで終わる。外には何も送らない。
import { Capacitor, registerPlugin } from '@capacitor/core';

const Native = registerPlugin('LukkoNative');

const there = () => {
  try { return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LukkoNative'); } catch (e) { return false; }
};

/** 確かめる手段があるか。kind は 'faceID' | 'touchID' | 'passcode' */
export async function lockInfo() {
  if (!there()) return { available: false, kind: 'none' };
  try { const r = await Native.lockInfo(); return { available: !!r.available, kind: r.kind || 'none' }; } catch (e) { return { available: false, kind: 'none' }; }
}

/** 本人かを確かめる。Face ID が使えないときは iPhone のパスコードで */
export async function authenticate(reason) {
  if (!there()) return { ok: true };
  try { const r = await Native.authenticate({ reason: reason || 'LUKKO を開きます' }); return { ok: !!r.ok }; } catch (e) { return { ok: false }; }
}

/** アプリを切り替える画面で、中身をぼかすか */
export async function setShield(on) {
  if (!there()) return;
  try { await Native.setShield({ on: !!on }); } catch (e) { /* 無くても使える */ }
}

/** App Store の星の小窓。出すかどうかは iPhone が決める（1年に3回まで） */
export async function requestReview() {
  if (!there()) return false;
  try { await Native.requestReview(); return true; } catch (e) { return false; }
}
