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
async function whiteBlob(buf, thr = 248, region = null, seed = null, ramp = [200, 236]) {
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
  // 四隅。「x+y が最小の点」で取ると、角が丸い画面では丸みの上の点になり、
  // 画面が一回り小さく貼られる（下と横に白い隙間が出た）。
  // 塊の向き（主軸の角度）を出し、その向きに揃えた枠の最小・最大から角を出す。
  // 丸い角は直線の辺より内側にあるので、揃えた枠の最小・最大には効かない
  // 白の度合い（ramp の下〜上を 0〜255 に）。スマホの画面は暗い縁に接するので低め（200〜236）から
  // 立ち上げて、縁の中間色を画面で覆う（下を高くすると、縁の内側に白い筋が残る）。しきい値で 0/1 に切ると縁が階段になり、
  // 島のまわりや角がギザギザに見えた。もとの絵の縁の中間色をそのままアルファにする
  const soft = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const o = p * C; const v = Math.min(data[o], data[o + 1], data[o + 2]);
    soft[p] = v <= ramp[0] ? 0 : v >= ramp[1] ? 255 : Math.round((v - ramp[0]) / (ramp[1] - ramp[0]) * 255);
  }
  const mask = new Uint8Array(W * H);
  let sx = 0, sy = 0, cnt = 0;
  for (let p = 0; p < W * H; p++) if (label[p] === best.id) { mask[p] = 255; sx += p % W; sy += (p / W) | 0; cnt += 1; }
  const cx = sx / cnt, cy = sy / cnt;
  let vxx = 0, vyy = 0, vxy = 0;
  for (let p = 0; p < W * H; p++) if (label[p] === best.id) { const dx = (p % W) - cx, dy = ((p / W) | 0) - cy; vxx += dx * dx; vyy += dy * dy; vxy += dx * dy; }
  // 主軸。縦長の画面なら主軸は縦。横の辺の傾きにしたいので、縦向きなら 90° 戻す
  let th = 0.5 * Math.atan2(2 * vxy, vxx - vyy);
  if (vyy > vxx) th += Math.PI / 2;
  th = ((th + Math.PI / 2) % Math.PI) - Math.PI / 2;      // -90°〜90° に
  if (th > Math.PI / 4) th -= Math.PI / 2; if (th < -Math.PI / 4) th += Math.PI / 2;
  const cs = Math.cos(th), sn = Math.sin(th);
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (let p = 0; p < W * H; p++) if (label[p] === best.id) {
    const dx = (p % W) - cx, dy = ((p / W) | 0) - cy;
    const u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
    if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
  }
  // 枠の中心（塊の重心ではない。島の切り欠きで重心は少し下にずれる）
  const mu = (u0 + u1) / 2, mv = (v0 + v1) / 2;
  const rect = { w: u1 - u0, h: v1 - v0, cx: cx + mu * cs - mv * sn, cy: cy + mu * sn + mv * cs };
  const back = (u, v) => [cx + u * cs - v * sn, cy + u * sn + v * cs];
  return { W, H, mask, soft, rect, corners: { tl: back(u0, v0), tr: back(u1, v0), br: back(u1, v1), bl: back(u0, v1) }, n: best.n, tilt: th * 180 / Math.PI };
}

// スクショを画面の大きさに縮め、画面の傾きだけ回し、画面の中心に置いて、白い塊の形で切り抜く。
// アフィンで一度にやると、出てきた絵の原点がどこか分からず、大きめ・上寄りに貼られた。
// 回転は中心まわりなので、回した絵の中心を画面の中心に合わせれば済む。
async function fill(genFile, srcBuf, outFile, ramp) {
  const gen = await sharp(join(GEN, genFile)).resize(TARGET_W).png().toBuffer();
  const { W, H, mask, soft, rect, tilt } = await whiteBlob(gen, 248, null, null, ramp);
  const { w, h, cx, cy } = rect;
  const rotated = await sharp(srcBuf).resize(Math.round(w), Math.round(h), { fit: 'fill' })
    .rotate(tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const rm = await sharp(rotated).metadata();
  const left = Math.round(cx - rm.width / 2), top = Math.round(cy - rm.height / 2);
  // 型。塊を 3px 太らせた範囲の中で、白の度合い（soft）をそのままアルファにする。
  // 縁の中間色がそのまま効くので、もとの絵と同じなめらかさで切れる。
  // 太らせるのは、縁の中間色の画素（しきい値では塊に入らない）を範囲に入れるため
  const dil = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    if (!mask[p]) continue;
    const x = p % W, y = (p / W) | 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) dil[yy * W + xx] = 1;
    }
  }
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) { rgba[p * 4] = 255; rgba[p * 4 + 1] = 255; rgba[p * 4 + 2] = 255; rgba[p * 4 + 3] = dil[p] ? soft[p] : 0; }
  const maskPng = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const layer = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: rotated, left, top }]).png().toBuffer();
  const clipped = await sharp(layer).composite([{ input: maskPng, blend: 'dest-in' }]).png().toBuffer();
  await sharp(gen).composite([{ input: clipped }]).png().toFile(outFile);
  console.log(`${genFile} → ${outFile.split(/[\/]/).pop()}  画面 ${Math.round(w)}×${Math.round(h)}px（比 ${(h / w).toFixed(2)}）  傾き ${tilt.toFixed(1)}°  中心 (${Math.round(cx)},${Math.round(cy)})`);
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
  // 「このあと」の行に、本人の予定の名前（塾の名前）が写っていた。そこだけ白で消して、
  // 同じ色・同じ大きさで別の名前を置く。場所はこのスクショに合わせて測ったもの
  // （crop の座標。別のスクショでは合わないので、そのときは REDACT を消すか測り直す）
  const REDACT = { x: 266, y: 244, w: 170, h: 44, text: 'ランチ', size: 31, baseline: 279, color: '#8B887D' };
  const patch = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${REDACT.x}" y="${REDACT.y}" width="${REDACT.w}" height="${REDACT.h}" fill="#FBFBFD"/>
    <text x="${REDACT.x + 4}" y="${REDACT.baseline}" font-family="'Hiragino Sans','Yu Gothic UI','Yu Gothic',sans-serif" font-size="${REDACT.size}" fill="${REDACT.color}">${REDACT.text}</text></svg>`);
  // composite は1つのパイプラインで1回しか効かない（2回呼ぶと後の方だけ残る）。段階を分ける
  const base = await sharp(home).extract({ left, top, width, height }).png().toBuffer();
  const patched = await sharp(base).composite([{ input: patch }]).png().toBuffer();
  const cut = await sharp(patched).ensureAlpha().composite([{ input: round, blend: 'dest-in' }]).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: '#FFFFFF' } }).composite([{ input: cut }]).png().toBuffer();
}

const jobs = [
  ['gen-2.png', join(ROOT, '2-dialog.png'), '2.png'],
  ['gen-4.png', join(ROOT, '3-free.png'), '4.png'],
  ['gen-5.png', join(ROOT, '5-report.png'), '5.png'],
];
for (const [g, s, o] of jobs) await fill(g, await sharp(s).png().toBuffer(), join(OUT, o));
const wc = await widgetCrop();
if (wc) await fill('gen-3.png', wc, join(OUT, '3.png'), [232, 250]);   // 壁紙が明るいので、高めから立ち上げる
else console.log('gen/widget-home.png が無いので 3 は飛ばした');
// 1 はスマホの無い絵なので、そのまま拡げて置く
await sharp(join(GEN, 'gen-1.png')).resize(TARGET_W).png().toFile(join(OUT, '1.png'));
console.log('できた store-assets/sukuji/out/');
