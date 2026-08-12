// ウィジェットへの受け渡し口。
//
// ウィジェットは別のプログラムなので、共有の置き場（App Group）を通す。
// その置き場に書けるのは Swift 側だけなので、ここは「native の窓口を呼ぶ」だけ。
// 窓口がまだ無いとき（ブラウザ、窓口を入れる前のビルド）は、静かに何もしない。
// そうしておけば、Xcode の作業が終わる前でも、こちら側を先に動かして確かめられる。
import { Capacitor, registerPlugin } from '@capacitor/core';
import { buildWidgetPayload } from './widgetdata';

// Xcode 側の App Group と、この名前をそろえる。片方だけ変えると黙って届かなくなる。
export const APP_GROUP = 'group.com.kimatteru.app';
export const STORE_KEY = 'widget';

// registerPlugin で受け取る。Capacitor.Plugins から拾う古い書き方だと、
// native 側があっても見つからないことがある（実際に、ウィジェットは動いているのに
// 「まだ何も届いていません」のままになった）。
const WidgetBridge = registerPlugin('WidgetBridge');

/** 窓口があるか。native に登録されているかどうかで見る */
export const widgetAvailable = () => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('WidgetBridge');
  } catch (e) {
    return false;
  }
};

/**
 * いまの予定をウィジェットへ渡す。
 * 失敗しても投げない——ウィジェットが古いままなのは困るが、
 * そのせいで予定の保存やアプリの動きを止めるほうがずっと困る。
 */
export async function pushWidget(state, now) {
  if (!widgetAvailable()) return { ok: false, why: '窓口が無い（この端末では使えません）' };
  try {
    const payload = buildWidgetPayload(state, now || new Date());
    const json = JSON.stringify(payload);
    await WidgetBridge.save({ group: APP_GROUP, key: STORE_KEY, json });
    const days = Object.keys(payload.days).length;
    return { ok: true, size: json.length, days };
  } catch (e) {
    return { ok: false, why: String((e && e.message) || e) };
  }
}
