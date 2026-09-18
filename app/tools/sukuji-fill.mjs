// ChatGPT が描いた「画面が白いスマホ」の絵に、本物のスクショを貼る。
//
//   node app/tools/sukuji-fill.mjs
//
// 入力: store-assets/sukuji/gen/gen-N.png（画面が白い絵）と、貼る画面。
// 出力: store-assets/sukuji/out/N.png
//
// やっていること:
//   1. 絵の中の「真っ白な、いちばん大きい塊」を見つける（それが画面）。
//      背景は生成りで真っ白ではないので、白（RGB がどれも 248 以上）だけを拾える
//   2. 塊の四隅を取る。スマホは少し傾いているので、x+y が最小の点が左上、といった
//      取り方で4つの角を出す
//   3. スクショをその四角に合わせて歪める（アフィン。回転と拡縮）
//   4. 白い塊そのものを型にして切り抜く。角の丸みも、ダイナミックアイランドの黒も、
//      塊の形に含まれているので、そのまま残る
//
// ウィジェットの絵（gen-3）だけは、貼るのがスクショではなく、実機のホーム画面から
// 切り出したウィジェット。その切り出しも同じ「白い塊」の取り方でやる。
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..', 'store-assets', 'sukuji');
const GEN = join(ROOT, 'gen'), OUT = join(ROOT, 'out');
mkdirSync(OUT, { recursive: true });
const TARGET_W = 1290;   // 絵は 853 幅で来るので、先に店の寸法へ拡げてから貼る

// 真っ白（しきい値以上）の、いちばん大きい塊。戻り値は塊のマスク（Uint8Array）と四隅
async function whiteBlob(buf, thr = 248, region = null, seed = null) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const white = new Uint8Array(W * H);
  const [rx0, ry0, rx1, ry1] = region || [0, 0, W, H];
  for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
    const o = (y * W + x) * C;
    if (data[o] >= thr && data[o + 1] >= thr && data[o + 2] >= thr) white[y * W + x] = 1;
  }
  // seed は候補の並び。白い所に当たった最初の点を使う（文字や札の上だと外れるので）
  if (seed) { const hit = seed.find(([x, y]) => white[y * W + x]); if (!hit) throw new Error("seed がどれも白くない"); seed = hit; }
  // 塊ごとに番号を振って、いちばん大きいものを選ぶ
  const label = new Int32Array(W * H);
  let best = { id: 0, n: 0 }, id = 0;
  const stack = new Int32Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (!white[s] || label[s]) continue;
    id += 1; let sp = 0, n = 0; stack[sp++] = s; label[s] = id;
    while (sp) {
      const p = stack[--sp]; n += 1;
      const x = p % W, y = (p / W) | 0;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
        if (white[q] && !label[q]) { label[q] = id; stack[sp++] = q; }
      }
    }
    // seed（この点を含む塊）が指定されていればそれを、無ければいちばん大きいものを
    if (seed ? label[seed[1] * W + seed[0]] === id : n > best.n) best = { id, n };
  }
  const mask = new Uint8Array(W * H);
  let tl = [1e9, null], tr = [-1e9, null], br = [-1e9, null], bl = [1e9, null];
  for (let p = 0; p < W * H; p++) {
    if (label[p] !== best.id) continue;
    mask[p] = 255;
    const x = p % W, y = (p / W) | 0;
    if (x + y < tl[0]) tl = [x + y, [x, y]];
    if (x - y > tr[0]) tr = [x - y, [x, y]];
    if (x + y > br[0]) br = [x + y, [x, y]];
    if (x - y < bl[0]) bl = [x - y, [x, y]];
  }
  return { W, H, mask, corners: { tl: tl[1], tr: tr[1], br: br[1], bl: bl[1] }, n: best.n };
}

// スクショを四隅に合わせて歪め、白い塊の形で切り抜いて、絵の上に貼る
async function fill(genFile, srcBuf, outFile) {
  const gen = await sharp(join(GEN, genFile)).resize(TARGET_W).png().toBuffer();
  const { W, H, mask, corners: c, n } = await whiteBlob(gen);
  const sm = await sharp(srcBuf).metadata();
  const sw = sm.width, sh = sm.height;
  // 左上を原点に、右上・左下へ向かうベクトルで行列を作る
  const a = (c.tr[0] - c.tl[0]) / sw, cc = (c.tr[1] - c.tl[1]) / sw;
  const b = (c.bl[0] - c.tl[0]) / sh, d = (c.bl[1] - c.tl[1]) / sh;
  const warped = await sharp(srcBuf).affine([[a, b], [cc, d]], { background: { r: 0, g: 0, b: 0, alpha: 0 }, interpolator: 'bicubic' }).png().toBuffer();
  // 歪めたあとの絵は、四隅の最小の x・y から始まる。左上の点に合わせて置く
  const xs = [0, a * sw, b * sh, a * sw + b * sh], ys = [0, cc * sw, d * sh, cc * sw + d * sh];
  const left = Math.round(c.tl[0] + Math.min(...xs)), top = Math.round(c.tl[1] + Math.min(...ys));
  const maskPng = await sharp(Buffer.from(mask), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  const layer = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: warped, left, top }]).png().toBuffer();
  const clipped = await sharp(layer).composite([{ input: maskPng, blend: 'dest-in' }]).png().toBuffer();
  await sharp(gen).composite([{ input: clipped }]).png().toFile(outFile);
  const tilt = (Math.atan2(cc, a) * 180 / Math.PI).toFixed(1);
  console.log(`${genFile} → ${outFile.split(/[\\/]/).pop()}  画面 ${Math.round(Math.hypot(c.tr[0] - c.tl[0], c.tr[1] - c.tl[1]))}×${Math.round(Math.hypot(c.bl[0] - c.tl[0], c.bl[1] - c.tl[1]))}px  傾き ${tilt}°  白 ${n}px`);
}

// ---- ウィジェット：実機のホーム画面から切り出す ----
// 白い塊で取ろうとしたが、壁紙の明るい所がウィジェットの上辺とつながって外れた。
// 左右と下は壁紙の暗い所に接しているので、そこは白が途切れる所を探して決める。
// 上辺だけは iOS の中サイズの比（1092×510 @3x ＝ 2.14）から出す。
async function widgetCrop() {
  const home = join(GEN, 'widget-home.png');
  if (!existsSync(home)) return null;
  const { data, info } = await sharp(home).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, C = info.channels;
  const white = (x, y) => { const o = (y * W + x) * C; return data[o] >= 240 && data[o + 1] >= 240 && data[o + 2] >= 240; };
  // 種：ウィジェットの中の白い所。文字や札に当たったら次
  const cands = [[0.5, 0.19], [0.55, 0.22], [0.3, 0.25], [0.8, 0.27], [0.5, 0.26]].map(([fx, fy]) => [Math.round(W * fx), Math.round(info.height * fy)]);
  const seed = cands.find(([x, y]) => white(x, y));
  if (!seed) throw new Error('ウィジェットの白い所が見つからない');
  // その行で左右へ、その列で下へ。白が 12px 続けて途切れた所を縁とする（文字は跳び越える）
  const run = (sx, sy, dx, dy) => { let x = sx, y = sy, gap = 0, last = [sx, sy]; while (x > 0 && y > 0 && x < W - 1 && y < info.height - 1) { x += dx; y += dy; if (white(x, y)) { gap = 0; last = [x, y]; } else if (++gap > 12) break; } return last; };
  // 縁ぎりぎりは壁紙が1〜2px 混ざるので、少し内側で切る
  const left = run(seed[0], seed[1], -1, 0)[0] + 3, right = run(seed[0], seed[1], 1, 0)[0] - 3, bottom = run(seed[0], seed[1], 0, 1)[1] - 4;
  const width = right - left, height = Math.round(width / 2.14), top = bottom - height;
  console.log(`ウィジェット: (${left},${top})–(${right},${bottom})  ${width}×${height}px`);
  // 四角に切ると、丸い角の外の壁紙が隅に残る。角を丸く抜いて、外は白にする（貼る先の白と揃う）
  const r = Math.round(width * 0.062);
  const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${r}" fill="#fff"/></svg>`);
  const cut = await sharp(home).extract({ left, top, width, height }).ensureAlpha().composite([{ input: round, blend: 'dest-in' }]).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: '#FFFFFF' } }).composite([{ input: cut }]).png().toBuffer();
}

const jobs = [
  ['gen-2.png', join(ROOT, '2-dialog.png'), '2.png'],
  ['gen-4.png', join(ROOT, '3-free.png'), '4.png'],
  ['gen-5.png', join(ROOT, '5-report.png'), '5.png'],
];
for (const [g, s, o] of jobs) await fill(g, await sharp(s).png().toBuffer(), join(OUT, o));
const wc = await widgetCrop();
if (wc) await fill('gen-3.png', wc, join(OUT, '3.png'));
else console.log('gen/widget-home.png が無いので 3 は飛ばした');
// 1 はスマホの無い絵なので、そのまま拡げて置く
await sharp(join(GEN, 'gen-1.png')).resize(TARGET_W).png().toFile(join(OUT, '1.png'));
console.log('できた store-assets/sukuji/out/');
