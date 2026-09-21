// 2 ページにまたがる 1 枚もの（App Store で横に並んだ 2 枚が、つながって 1 枚の絵に見えるやつ）。
//
//   node app/tools/sukuji-wide.mjs
//
// 出力: store-assets/sukuji/flat/wide.png（2580×2796 の全体）と wide-1.png / wide-2.png（左右に割ったもの）
//
// 「みんなの縦型カレンダー」の 1〜2 枚目の型（本人が「こんな感じにしたい」）：
//   - 左ページ：左寄せの太い見出しと、その下に短い説明文
//   - 白い大きなスマホが、左ページの右下から右ページいっぱいへ斜めに伸びる（下は絵の外）
//   - スマホの周りに、予定の帯がシールのように浮いている
//   - 地は上が白っぽく、下に淡い色の帯が斜めに入る
import sharp from 'sharp';
import { join } from 'node:path';
import { phoneLayer, PHONE, TEXT, ROOT } from './sukuji-fill.mjs';

const OUT = join(ROOT, 'flat');
const PW = 1290, H = 2796, W = PW * 2;
const GREEN = '#3E7A4D', INK = '#1C1F1B';
PHONE.body = '#FAFAFA'; PHONE.rimColor = '#D6D6D6';   // 白いスマホ

// 地：上は白に近い緑、下に淡い緑の帯が「左下から右上へ」斜めに
const bg = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#F3F7F1"/>
  <polygon points="0,2150 ${W},700 ${W},${H} 0,${H}" fill="#D3E4CF"/>
</svg>`)).png().toBuffer();

// 見出しと説明文（左ページ、左寄せ）
const title = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <g font-family="${TEXT.font}" font-weight="bold" fill="${INK}" font-size="168" letter-spacing="-4">
    <text x="110" y="560"><tspan fill="${GREEN}">未定</tspan>のまま、</text>
    <text x="110" y="760">置ける。</text>
  </g>
  <g font-family="${TEXT.font}" fill="#2E3A31" font-size="50" letter-spacing="1">
    <text x="112" y="1000">たぶんの予定は、点線で。</text>
    <text x="112" y="1075">決まったら、押すだけで塗りに。</text>
  </g>
  <g font-family="${TEXT.font}" fill="#5A6B5D" font-size="40">
    <text x="112" y="1180">バイトも、遊びも、用事も</text>
  </g>
</svg>`);

// 傾けたスマホを、中心 (cx, cy) に置く。絵の外にはみ出す分は切る
// （composite は絵より大きいものを拒むので、いったん大きい透明な絵に置いてから、絵の範囲を切り出す。
//   composite と extract を同じパイプラインに入れると extract が先に効くので、2 段に分ける）
async function placePhone(canvas, shotFile, w, tilt, cx, cy) {
  const { layer } = await phoneLayer(shotFile, w);
  const rotated = await sharp(layer).rotate(tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(rotated).metadata();
  const P = 2000;
  const placed = await sharp({ create: { width: W + P * 2, height: H + P * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: rotated, left: Math.round(P + cx - m.width / 2), top: Math.round(P + cy - m.height / 2) }]).png().toBuffer();
  const big = await sharp(placed).extract({ left: P, top: P, width: W, height: H }).png().toBuffer();
  return sharp(canvas).composite([{ input: big }]).png().toBuffer();
}

// 浮いている帯。アプリの帯と同じ見た目で、大きめ。dashed は点線（まだ）。影つきで少し傾ける
function chip(x, y, text, color, { dashed = false, rot = 0, w = 0 } = {}) {
  const hh = 118, ww = w || Math.round(text.length * 60 + 90), r = 22;
  const body = dashed
    ? `<rect width="${ww}" height="${hh}" rx="${r}" fill="#FFFDF8" stroke="${color}" stroke-width="7" stroke-dasharray="20 14"/><text x="${ww / 2}" y="${hh * 0.7}" text-anchor="middle" font-family="${TEXT.font}" font-size="58" fill="${color}">${text}</text>`
    : `<rect width="${ww}" height="${hh}" rx="${r}" fill="${color}"/><text x="${ww / 2}" y="${hh * 0.7}" text-anchor="middle" font-family="${TEXT.font}" font-size="58" fill="#1F2A22">${text}</text>`;
  return { svg: `<g transform="translate(${x} ${y}) rotate(${rot})">${body}</g>`, shadow: `<g transform="translate(${x} ${y + 22}) rotate(${rot})"><rect width="${ww}" height="${hh}" rx="${r}" fill="#000" fill-opacity="0.22"/></g>` };
}
async function chips(canvas, list) {
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${list.map((c) => c.shadow).join('')}</svg>`)).blur(20).png().toBuffer();
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${list.map((c) => c.svg).join('')}</svg>`);
  return sharp(canvas).composite([{ input: shadow }, { input: svg }]).png().toBuffer();
}

let canvas = await sharp(bg).composite([{ input: title }]).png().toBuffer();
// スマホ：幅 1450、-16°。中心は右ページの中ほど。上端は見えて、左下の縁が左ページの右下にかかる
// （最初は中心を 1800 に置いたら、見出しの「未定のまま、」に画面がかぶった）
canvas = await placePhone(canvas, join(ROOT, '1-calendar.png'), 1450, -16, 1950, 2050);
// 帯：左ページの見出しの下〜スマホの左に 3 つ、右ページの右下に 2 つ
canvas = await chips(canvas, [
  chip(560, 1330, '✓ バイト', '#A9C5A6', { rot: -8 }),
  chip(430, 1560, 'ライブ', '#E0A87E', { dashed: true, rot: -6 }),
  chip(700, 1800, '17:00 ジム', '#B4A6D6', { rot: -10 }),
  chip(1980, 2300, '？ BBQ', '#E0A87E', { dashed: true, rot: -12 }),
  chip(2160, 2540, '✓ 合宿', '#A9C5A6', { rot: -9 }),
]);
await sharp(canvas).png().toFile(join(OUT, 'wide.png'));
await sharp(canvas).extract({ left: 0, top: 0, width: PW, height: H }).png().toFile(join(OUT, 'wide-1.png'));
await sharp(canvas).extract({ left: PW, top: 0, width: PW, height: H }).png().toFile(join(OUT, 'wide-2.png'));
console.log('できた flat/wide.png, wide-1.png, wide-2.png');
