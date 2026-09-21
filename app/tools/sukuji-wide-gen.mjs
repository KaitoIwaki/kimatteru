// ChatGPT が描いた 2 ページもの（gen/gen-wide.png：白い画面の傾いたスマホ）に、本物のスクショを貼って 2 枚に割る。
//
//   node app/tools/sukuji-wide-gen.mjs
//
// 出力: store-assets/sukuji/flat/wide.png（2580×2796）、wide-1.png / wide-2.png
//
// 絵は正方形で来る。高さを 2796 に合わせて、真ん中の 2580 を切る（左の見出しと右下の帯は入る）。
// 画面は傾いていて下が絵の外に切れているので、白い塊の「上の 2 角」から幅と傾きを取り、
// 高さはスクショの比から出す。貼ったあと、白い塊の形で切り抜く（帯が画面に重なっている所は帯が残る）。
// アイランド（黒い錠剤）は絵に描いてあるが、スクショを貼ると隠れるので、貼ったあとに元の画素を戻す。
import sharp from 'sharp';
import { join } from 'node:path';
import { whiteBlob, GEN, ROOT } from './sukuji-fill.mjs';

const OUT = join(ROOT, 'flat');
const PW = 1290, H = 2796, W = PW * 2;
const SHOT = join(ROOT, '1-calendar.png');

const square = await sharp(join(GEN, 'gen-wide.png')).resize({ height: H }).png().toBuffer();
const sqW = (await sharp(square).metadata()).width;
const base = await sharp(square).extract({ left: Math.round((sqW - W) / 2), top: 0, width: W, height: H }).png().toBuffer();

// 白い塊（画面）。枠も白いが、画面との境に灰色の線があるので、248 以上で拾えば画面だけになる
const b = await whiteBlob(base, 248, null, null, [200, 236]);
// corners は [x, y] の配列
const tl = { x: b.corners.tl[0], y: b.corners.tl[1] }, tr = { x: b.corners.tr[0], y: b.corners.tr[1] };
const w = Math.hypot(tr.x - tl.x, tr.y - tl.y);
const tilt = Math.atan2(tr.y - tl.y, tr.x - tl.x);   // ラジアン。正なら時計回り
// ChatGPT の画面は本物より縦長（幅 1060 に高さ 2481。iPhone なら 2297）。幅で合わせると下が 184px 空く。
// 最初は全部を上の帯（ステータスバー）に足したら、アイランドの下が空きすぎた（「上広すぎない？」）。
// いまは 3 つに分ける：画面そのものを 3% だけ縦に伸ばし（見て分からない程度）、残りを上と下の帯に半々。
// 帯は SAFE=1 で撮ったスクショの一色の部分（上はステータスバー、下はホームバーの所）
const sm0 = await sharp(SHOT).metadata();
const k = w / sm0.width;
const want = Math.round(b.rect.h / k);                       // スクショの座標での、画面の高さ
const stretched = Math.min(want, Math.round(sm0.height * 1.03));
const rest = Math.max(0, want - stretched);
const topExtra = Math.round(rest * 0.5), botExtra = rest - topExtra;
const rowColor = async (y) => { const { data } = await sharp(SHOT).extract({ left: 0, top: y, width: sm0.width, height: 1 }).raw().toBuffer({ resolveWithObject: true }); return { r: data[0], g: data[1], b: data[2] }; };
const bandTop = await rowColor(2), bandBot = await rowColor(sm0.height - 3);
const shotSrc = await sharp({ create: { width: sm0.width, height: want, channels: 3, background: bandTop } })
  .composite([
    { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sm0.width}" height="${botExtra + 2}"><rect width="${sm0.width}" height="${botExtra + 2}" fill="rgb(${bandBot.r},${bandBot.g},${bandBot.b})"/></svg>`), left: 0, top: want - botExtra - 2 },
    { input: await sharp(SHOT).resize(sm0.width, stretched, { fit: 'fill' }).png().toBuffer(), left: 0, top: topExtra },
  ]).png().toBuffer();
console.log(`画面の高さ ${want}：スクショを ${stretched}（×${(stretched / sm0.height).toFixed(3)}）、上の帯 +${topExtra}、下の帯 +${botExtra}`);
const sm = await sharp(shotSrc).metadata();
const h = w * sm.height / sm.width;
// 画面の中心 = 左上の角 + (w/2, h/2) を tilt だけ回したもの
const cx = tl.x + (w / 2) * Math.cos(tilt) - (h / 2) * Math.sin(tilt);
const cy = tl.y + (w / 2) * Math.sin(tilt) + (h / 2) * Math.cos(tilt);
console.log(`画面 幅 ${Math.round(w)} 高さ ${Math.round(h)} 傾き ${(tilt * 180 / Math.PI).toFixed(1)}° 左上 (${Math.round(tl.x)},${Math.round(tl.y)}) 中心 (${Math.round(cx)},${Math.round(cy)})`);

// スクショ：角を丸めて、傾けて、中心に置く（絵より大きいので、大きい透明な絵に置いてから切り出す）
const iw = Math.round(w), ih = Math.round(h), r = Math.round(w * 0.09);
const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}"><rect width="${iw}" height="${ih}" rx="${r}" fill="#fff"/></svg>`);
const shot = await sharp(shotSrc).resize(iw, ih, { fit: 'fill' }).ensureAlpha().composite([{ input: round, blend: 'dest-in' }]).png().toBuffer();
const rotated = await sharp(shot).rotate(tilt * 180 / Math.PI, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const rm = await sharp(rotated).metadata();
const P = 2400;
const placed = await sharp({ create: { width: W + P * 2, height: H + P * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: rotated, left: Math.round(P + cx - rm.width / 2), top: Math.round(P + cy - rm.height / 2) }]).png().toBuffer();
const layer = await sharp(placed).extract({ left: P, top: P, width: W, height: H }).png().toBuffer();

// 型：白い塊を 3px 太らせた範囲で、白の度合いをそのままアルファに（縁がなめらかに切れる）
const dil = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  if (!b.mask[p]) continue;
  const x = p % W, y = (p / W) | 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) dil[yy * W + xx] = 1; }
}
const rgba = Buffer.alloc(W * H * 4);
for (let p = 0; p < W * H; p++) { rgba[p * 4] = 255; rgba[p * 4 + 1] = 255; rgba[p * 4 + 2] = 255; rgba[p * 4 + 3] = dil[p] ? b.soft[p] : 0; }
const maskPng = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
const clipped = await sharp(layer).composite([{ input: maskPng, blend: 'dest-in' }]).png().toBuffer();

// アイランド：画面の上のほう（塊の上端から 12%）にある黒い画素を、元の絵から戻す
const { data, info } = await sharp(base).raw().toBuffer({ resolveWithObject: true });
let y0 = H, y1 = 0;
for (let p = 0; p < W * H; p++) if (b.mask[p]) { const y = (p / W) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const isl = Buffer.alloc(W * H * 4);
const ch = info.channels;
for (let y = y0; y < y0 + (y1 - y0) * 0.12; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x, o = p * ch;
  if (data[o] + data[o + 1] + data[o + 2] < 300) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const q = (y + dy) * W + (x + dx), oq = q * ch;
    isl[q * 4] = data[oq]; isl[q * 4 + 1] = data[oq + 1]; isl[q * 4 + 2] = data[oq + 2]; isl[q * 4 + 3] = 255;
  }
}
const islandPng = await sharp(isl, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

const out = await sharp(base).composite([{ input: clipped }, { input: islandPng }]).png().toBuffer();
await sharp(out).png().toFile(join(OUT, 'wide.png'));
await sharp(out).extract({ left: 0, top: 0, width: PW, height: H }).png().toFile(join(OUT, 'wide-1.png'));
await sharp(out).extract({ left: PW, top: 0, width: PW, height: H }).png().toFile(join(OUT, 'wide-2.png'));
console.log('できた flat/wide.png, wide-1.png, wide-2.png');
