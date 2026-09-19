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
// 上辺だけは iOS の大きさの比から出す（小 1:1、中 2.14:1、大 1:1.05）。
// 「このあと」の行に本人の予定の名前が写っていたら redact で消せる。
const WIDGET = {
  small:  { file: 'widget-small.png',  ratio: 1.0,        seeds: [[0.25, 0.19], [0.3, 0.22], [0.2, 0.25], [0.35, 0.27]] },
  medium: { file: 'widget-medium.png', ratio: 1 / 2.14,   seeds: [[0.5, 0.19], [0.55, 0.22], [0.3, 0.25], [0.8, 0.27], [0.5, 0.26]],
            redact: { x: 266, y: 244, w: 170, h: 44, text: 'ランチ', size: 31, baseline: 279, color: '#8B887D' } },
  large:  { file: 'widget-large.png',  ratio: 382 / 364,  seeds: [[0.5, 0.3], [0.5, 0.35], [0.3, 0.4], [0.7, 0.45]] },
};
async function widgetCrop(kind) {
  const def = WIDGET[kind];
  let home = join(GEN, def.file);
  if (kind === 'medium' && !existsSync(home)) home = join(GEN, 'widget-home.png');   // 前の名前
  if (!existsSync(home)) return null;
  const { data, info } = await sharp(home).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, C = info.channels;
  const white = (x, y) => { const o = (y * W + x) * C; return data[o] >= 240 && data[o + 1] >= 240 && data[o + 2] >= 240; };
  const cands = def.seeds.map(([fx, fy]) => [Math.round(W * fx), Math.round(info.height * fy)]);
  const seed = cands.find(([x, y]) => white(x, y));
  if (!seed) throw new Error(`${def.file}: ウィジェットの白い所が見つからない`);
  const run = (sx, sy, dx, dy) => { let x = sx, y = sy, gap = 0, last = [sx, sy]; while (x > 0 && y > 0 && x < W - 1 && y < info.height - 1) { x += dx; y += dy; if (white(x, y)) { gap = 0; last = [x, y]; } else if (++gap > 12) break; } return last; };
  const left = run(seed[0], seed[1], -1, 0)[0] + 3, right = run(seed[0], seed[1], 1, 0)[0] - 3, bottom = run(seed[0], seed[1], 0, 1)[1] - 4;
  const width = right - left, height = Math.round(width * def.ratio), top = bottom - height;
  console.log(`ウィジェット ${kind}: (${left},${top})–(${right},${bottom})  ${width}×${height}px`);
  const r = Math.round(Math.min(width, height) * 0.13);
  const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${r}" fill="#fff"/></svg>`);
  let base = await sharp(home).extract({ left, top, width, height }).png().toBuffer();
  if (def.redact) {
    const R = def.redact;
    const patch = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}" fill="#FBFBFD"/><text x="${R.x + 4}" y="${R.baseline}" font-family="'Hiragino Sans','Yu Gothic UI','Yu Gothic',sans-serif" font-size="${R.size}" fill="${R.color}">${R.text}</text></svg>`);
    base = await sharp(base).composite([{ input: patch }]).png().toBuffer();
  }
  const cut = await sharp(base).ensureAlpha().composite([{ input: round, blend: 'dest-in' }]).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: '#FFFFFF' } }).composite([{ input: cut }]).png().toBuffer();
}

// 白い塊を大きい順に n 個。取った塊を塗りつぶして、次を取る
async function whiteBlobs(buf, n, ramp) {
  const out = [];
  let cur = buf;
  for (let i = 0; i < n; i++) {
    const b = await whiteBlob(cur, 248, null, null, ramp);
    if (b.n < 2000) break;
    out.push(b);
    const { data, info } = await sharp(cur).raw().toBuffer({ resolveWithObject: true });
    for (let p = 0; p < info.width * info.height; p++) if (b.mask[p]) { const o = p * info.channels; data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; }
    cur = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
  }
  return out;
}

// 1つの塊に1枚を貼る（型は塊のなめらかな縁）。戻り値は貼ったあとの絵
async function paste(canvas, b, src, W, H) {
  const { w, h, cx, cy } = b.rect;
  const rotated = await sharp(src).resize(Math.round(w), Math.round(h), { fit: 'fill' }).rotate(b.tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const rm = await sharp(rotated).metadata();
  const dil = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) { if (!b.mask[p]) continue; const x = p % W, y = (p / W) | 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) dil[yy * W + xx] = 1; } }
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) { rgba[p * 4] = 255; rgba[p * 4 + 1] = 255; rgba[p * 4 + 2] = 255; rgba[p * 4 + 3] = dil[p] ? b.soft[p] : 0; }
  const maskPng = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const layer = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: rotated, left: Math.round(cx - rm.width / 2), top: Math.round(cy - rm.height / 2) }]).png().toBuffer();
  const clipped = await sharp(layer).composite([{ input: maskPng, blend: 'dest-in' }]).png().toBuffer();
  return sharp(canvas).composite([{ input: clipped }]).png().toBuffer();
}

// 3枚目：白い四角が3つ。比の順（横長→正方形→縦長め）で 中・小・大 に振り分けて貼る
async function fillWidgets(genFile, outFile) {
  const gen = await sharp(join(GEN, genFile)).resize(TARGET_W).png().toBuffer();
  const blobs = await whiteBlobs(gen, 3, [232, 250]);
  if (blobs.length < 3) { console.log(`${genFile}: 白い四角が ${blobs.length} つしか無い`); return false; }
  const byA = blobs.map((b) => ({ b, a: b.rect.h / b.rect.w })).sort((x, y) => x.a - y.a);
  const kinds = [['medium', byA[0].b], ['small', byA[1].b], ['large', byA[2].b]];
  const { W, H } = blobs[0];
  let canvas = gen;
  for (const [kind, b] of kinds) {
    const src = await widgetCrop(kind);
    if (!src) { console.log(`  ${kind} のスクショが無い（gen/${WIDGET[kind].file}）。空のまま`); continue; }
    canvas = await paste(canvas, b, src, W, H);
    console.log(`  ${kind}: ${Math.round(b.rect.w)}×${Math.round(b.rect.h)}px 傾き ${b.tilt.toFixed(1)}°`);
  }
  await sharp(canvas).png().toFile(outFile);
  console.log(`${genFile} → 3.png（3つ）`);
  return true;
}

const jobs = [
  ['gen-2.png', join(ROOT, '2-dialog.png'), '2.png'],
  ['gen-4.png', join(ROOT, '3-free.png'), '4.png'],
  ['gen-5.png', join(ROOT, '5-report.png'), '5.png'],
];
for (const [g, s, o] of jobs) await fill(g, await sharp(s).png().toBuffer(), join(OUT, o));
// 3枚目：白い四角が3つある絵（gen-3-sizes.png）なら大・中・小を貼る。無ければ前の1つの絵に中を貼る
if (existsSync(join(GEN, 'gen-3-sizes.png'))) await fillWidgets('gen-3-sizes.png', join(OUT, '3.png'));
else {
  const wc = await widgetCrop('medium');
  if (wc) await fill('gen-3.png', wc, join(OUT, '3.png'), [232, 250]);   // 壁紙が明るいので、高めから立ち上げる
  else console.log('gen/widget-home.png が無いので 3 は飛ばした');
}
// 1 はスマホの無い絵なので、そのまま拡げて置く
await sharp(join(GEN, 'gen-1.png')).resize(TARGET_W).png().toFile(join(OUT, '1.png'));
console.log('できた store-assets/sukuji/out/');
