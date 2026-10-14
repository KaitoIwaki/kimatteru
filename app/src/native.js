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

/** iPhone 標準の確認画面（sheet: true なら下から出る選択肢）を出せるか */
export const canNativeAlert = () => there();

/**
 * iPhone 標準の確認画面を出す。押されたボタンの番号を返す（閉じた・出せないときは -1）。
 * buttons: [{ label, style: 'default' | 'cancel' | 'destructive', preferred }]
 */
export async function nativeAlert({ title, message, buttons, sheet }) {
  if (!there()) return -1;
  try {
    const r = await Native.alert({ title: title || '', message: message || '', sheet: !!sheet,
      buttons: (buttons || []).map((b) => ({ label: b.label, style: b.style || 'default', preferred: !!b.preferred })) });
    return typeof r.index === 'number' ? r.index : -1;
  } catch (e) { return -1; }
}

/** App Store の星の小窓。出すかどうかは iPhone が決める（1年に3回まで） */
export async function requestReview() {
  if (!there()) return false;
  try { await Native.requestReview(); return true; } catch (e) { return false; }
}
