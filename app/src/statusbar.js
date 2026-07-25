import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

const native = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
};

// 紙が白いときは黒文字、墨色のときは白文字。
export function applyStatusBarTheme(dark) {
  if (!native()) return;
  try {
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  } catch (e) {
    /* 使えない環境では何もしない */
  }
}
