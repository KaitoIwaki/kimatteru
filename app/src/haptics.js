import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// ネイティブ以外（PCのブラウザ確認時など）では何も起きない。呼び出し側で分岐しなくていいように握りつぶす。
const safe = (fn) => {
  try {
    const p = fn();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {
    /* 触覚が使えない環境では黙って無視する */
  }
};

// 押した瞬間の予備動作（§6「即応」）
export const tapLight = () => safe(() => Haptics.impact({ style: ImpactStyle.Light }));

// 破線が詰まって実線になる「チッ」
export const penTick = () => safe(() => Haptics.impact({ style: ImpactStyle.Rigid }));

// 塗りが満ちて着地した瞬間
export const settleSuccess = () => safe(() => Haptics.notification({ type: NotificationType.Success }));

// ✓の判子が押される瞬間（実績記録）
export const stampHeavy = () => safe(() => Haptics.impact({ style: ImpactStyle.Heavy }));
