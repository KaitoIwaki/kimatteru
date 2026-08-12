// ウィジェットへの受け渡し口。
//
// ウィジェットは別のプログラムなので、共有の置き場（App Group）を通す。
// その置き場に書けるのは Swift 側だけなので、ここは「native の窓口を呼ぶ」だけ。
// 窓口がまだ無いとき（ブラウザ、窓口を入れる前のビルド）は、静かに何もしない。
// そうしておけば、Xcode の作業が終わる前でも、こちら側を先に動かして確かめられる。
import { Capacitor } from '@capacitor/core';
import { buildWidgetPayload } from './widgetdata';

// Xcode 側の App Group と、この名前をそろえる。片方だけ変えると黙って届かなくなる。
export const APP_GROUP = 'group.com.kimatteru.app';
export const STORE_KEY = 'widget';

const bridge = () => {
  try {
    const p = Capacitor.Plugins && Capacitor.Plugins.WidgetBridge;
    return p && typeof p.save === 'function' ? p : null;
  } catch (e) {
    return null;
  }
};

/** 窓口があるか。設定の診断に出すために公開している */
export const widgetAvailable = () => !!bridge();

/**
 * いまの予定をウィジェットへ渡す。
 * 失敗しても投げない——ウィジェットが古いままなのは困るが、
 * そのせいで予定の保存やアプリの動きを止めるほうがずっと困る。
 */
export async function pushWidget(state, now) {
  const p = bridge();
  if (!p) return { ok: false, why: 'なし' };
  try {
    const payload = buildWidgetPayload(state, now || new Date());
    const json = JSON.stringify(payload);
    await p.save({ group: APP_GROUP, key: STORE_KEY, json });
    return { ok: true, size: json.length };
  } catch (e) {
    return { ok: false, why: String((e && e.message) || e) };
  }
}
