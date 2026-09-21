// 2 ページにまたがる 1 枚もの（App Store で横に並んだ 2 枚が、つながって 1 枚の絵に見えるやつ）。
//
//   node app/tools/sukuji-wide.mjs
//
// 出力: store-assets/sukuji/flat/wide.png（2580×2796 の全体）と wide-1.png / wide-2.png（左右に割ったもの）
//
// 左ページの上に「未定のまま、置ける」、右ページの上に「決まったら、押すだけ」。
// その下を、月の画面と確定のダイアログの 2 台が、少し傾いて右上がりに横切る（スマート手帳の 2〜3 枚目の型）。
// 2 台とも下は絵の外に出す（画面の上のほうが大きく見える）。
// 地・見出し・スマホの描き方は sukuji-flat.mjs と同じ（TEXT / PHONE の上書きもそちらに揃える）。
import sharp from 'sharp';
import { join } from 'node:path';
import { drawTitle, phoneLayer, PHONE, TEXT, ROOT } from './sukuji-fill.mjs';

const OUT = join(ROOT, 'flat');
const PW = 1290, H = 2796, W = PW * 2;
TEXT.head.max = 140; TEXT.head.gapAbove = 44; TEXT.sub.top = 330; TEXT.sub.size = 56;
TEXT.accent = '#3E7A4D'; TEXT.sub.color = '#4A6E4F'; TEXT.head.color = '#1C1F1B';

// 地：縦のグラデーション（横にすると、割ったときに左右で色が違ってしまう）
const bg = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF3EA"/><stop offset="1" stop-color="#D6E3D1"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/></svg>`)).png().toBuffer();

// 見出しは 1 ページ分の透明な絵に描いて、左か右に置く
async function titleAt(canvas, page, sub, lines, accent) {
  const blank = await sharp({ create: { width: PW, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const t = await drawTitle(blank, PW, H, sub, lines, accent);
  return sharp(canvas).composite([{ input: t.canvas, left: page * PW, top: 0 }]).png().toBuffer();
}

// 傾けたスマホを、中心 (cx, cy) に置く。絵の外にはみ出す分は切る
// （composite は絵より大きいものを拒むので、いったん大きい透明な絵に置いてから、絵の範囲を切り出す）
async function placePhone(canvas, shotFile, w, tilt, cx, cy) {
  const { layer } = await phoneLayer(shotFile, w);
  const rotated = await sharp(layer).rotate(tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(rotated).metadata();
  const P = 1600;
  // composite と extract を同じパイプラインに入れると、sharp は extract を先にやってしまう。2 段に分ける
  const placed = await sharp({ create: { width: W + P * 2, height: H + P * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: rotated, left: Math.round(P + cx - m.width / 2), top: Math.round(P + cy - m.height / 2) }]).png().toBuffer();
  const big = await sharp(placed).extract({ left: P, top: P, width: W, height: H }).png().toBuffer();
  return sharp(canvas).composite([{ input: big }]).png().toBuffer();
}

let canvas = bg;
canvas = await titleAt(canvas, 0, 'たぶんの予定も、そのまま', ['未定のまま、', '置ける'], ['未定']);
canvas = await titleAt(canvas, 1, '点線が、塗りに変わる', ['決まったら、', '押すだけ'], ['押すだけ']);
// 左：月の画面。右：確定のダイアログ（手前）。どちらも -8° で右上がり
const w = 1000, tilt = -8;
canvas = await placePhone(canvas, join(ROOT, '1-calendar.png'), w, tilt, 930, 2080);
canvas = await placePhone(canvas, join(ROOT, '2-dialog.png'), w, tilt, 1840, 1930);
await sharp(canvas).png().toFile(join(OUT, 'wide.png'));
await sharp(canvas).extract({ left: 0, top: 0, width: PW, height: H }).png().toFile(join(OUT, 'wide-1.png'));
await sharp(canvas).extract({ left: PW, top: 0, width: PW, height: H }).png().toFile(join(OUT, 'wide-2.png'));
console.log('できた flat/wide.png, wide-1.png, wide-2.png');
