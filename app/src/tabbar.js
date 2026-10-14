// 下のタブを iPhone の本物の部品で出す（ios/App/App/TabBar.swift）。
// iPhone のアプリの中だけ。ブラウザや古いビルドでは何もしない（Web のタブが出る）。
import { Capacitor, registerPlugin } from '@capacitor/core';

const TB = registerPlugin('LukkoTabBar');

export const nativeTabBar = () => {
  try { return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LukkoTabBar'); } catch (e) { return false; }
};

/** 出す・隠す、選んでいるタブ（month / free / report / settings）、暗い表示か */
export function setTabBar(o) {
  if (!nativeTabBar()) return;
  TB.set(o).catch(() => {});
}

/** タブや「＋」が押されたとき。tab は month / free / report / settings / add */
export function onTabTap(fn) {
  if (!nativeTabBar()) return;
  TB.addListener('tap', (d) => fn(d && d.tab)).catch(() => {});
}
