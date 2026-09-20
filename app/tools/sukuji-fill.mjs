// ChatGPT が描いた机の絵を下地にして、sukuji.com 用の 5 枚を組む。
//
//   node app/tools/sukuji-fill.mjs
//
// 入力: store-assets/sukuji/gen/gen-N.png（ChatGPT の絵）と、貼る画面。
// 出力: store-assets/sukuji/out/N.png（1290×2787）
//
// 最初は ChatGPT が描いたスマホの白い画面にスクショを貼っていたが、描かれたスマホが
// 幅の 4 割しかなく「画面が小さすぎる、文字ももっと大きく」と本人。いまは：
//   1. 絵の中の見出しと小見出しを消す（列ごとに上下の地の色でつなぐ）
//   2. 小見出しと見出しを、こちらで大きく描き直す（幅に合わせて自動で大きさを決める）
//   3. スマホは ChatGPT のを使わず、こちらで描く（幅の 68%）。ChatGPT のスマホは
//      その下に隠れる。○△× や道具の札は、スマホの後ろから少し見える
// ウィジェットの絵（gen-3-sizes）は、ホーム画面から切り出した実物のウィジェットを
// 3 つ貼る。切り出しは「白い塊」の取り方で。
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
  // 傾き。主軸（分散の向き）で取ると、正方形の塊では向きが決まらず角度が暴れる
  // （小のウィジェットで 35.8° と出た）。-12°〜12° を 0.25° 刻みで回してみて、
  // 揃えた枠がいちばん小さくなる角度を取る。塊の縁の画素だけ使えば足りる
  const edge = [];
  for (let p = 0; p < W * H; p++) {
    if (label[p] !== best.id) continue;
    const x = p % W, y = (p / W) | 0;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || label[p - 1] !== best.id || label[p + 1] !== best.id || label[p - W] !== best.id || label[p + W] !== best.id) edge.push(x - cx, y - cy);
  }
  const boxAt = (t) => {
    const c = Math.cos(t), sn2 = Math.sin(t);
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (let i = 0; i < edge.length; i += 2) {
      const u = edge[i] * c + edge[i + 1] * sn2, v = -edge[i] * sn2 + edge[i + 1] * c;
      if (u < a0) a0 = u; if (u > a1) a1 = u; if (v < b0) b0 = v; if (v > b1) b1 = v;
    }
    return { t, u0: a0, u1: a1, v0: b0, v1: b1, area: (a1 - a0) * (b1 - b0) };
  };
  let bestBox = null;
  for (let deg = -12; deg <= 12; deg += 0.25) { const b = boxAt(deg * Math.PI / 180); if (!bestBox || b.area < bestBox.area) bestBox = b; }
  const th = bestBox.t, cs = Math.cos(th), sn = Math.sin(th);
  const { u0, u1, v0, v1 } = bestBox;
  // 枠の中心（塊の重心ではない。島の切り欠きで重心は少し下にずれる）
  const mu = (u0 + u1) / 2, mv = (v0 + v1) / 2;
  const rect = { w: u1 - u0, h: v1 - v0, cx: cx + mu * cs - mv * sn, cy: cy + mu * sn + mv * cs };
  const back = (u, v) => [cx + u * cs - v * sn, cy + u * sn + v * cs];
  return { W, H, mask, soft, rect, corners: { tl: back(u0, v0), tr: back(u1, v0), br: back(u1, v1), bl: back(u0, v1) }, n: best.n, tilt: th * 180 / Math.PI };
}

// ---- ウィジェット：実機のホーム画面から切り出す ----
// 白い塊で取ろうとしたが、壁紙の明るい所がウィジェットの上辺とつながって外れた。
// 左右と下は壁紙の暗い所に接しているので、そこは白が途切れる所を探して決める。
// 上辺だけは iOS の大きさの比から出す（小 1:1、中 2.14:1、大 1:1.05）。
// 「このあと」の行に本人の予定の名前が写っていたら redact で消せる。
const WIDGET = {
  small:  { file: 'widget-small.png',  ratio: 1.0,        seeds: [[0.25, 0.19], [0.3, 0.22], [0.2, 0.25], [0.35, 0.27]],
            // ウィジェットだけを切り抜いた画像（幅 800 未満）のとき。上半分は壁紙の明るい所と地続きなので、下の方で取る
            cropSeeds: [[0.5, 0.65], [0.5, 0.55], [0.5, 0.75], [0.3, 0.65]] },
  medium: { file: 'widget-medium.png', ratio: 1 / 2.14,   seeds: [[0.5, 0.19], [0.55, 0.22], [0.3, 0.25], [0.8, 0.27], [0.5, 0.26]],
            redact: { x: 266, y: 244, w: 170, h: 44, text: 'ランチ', size: 31, baseline: 279, color: '#8B887D' } },
  large:  { file: 'widget-large.png',  ratio: 382 / 364,  seeds: [[0.5, 0.3], [0.5, 0.35], [0.3, 0.4], [0.7, 0.45]],
            // 本人の予定の名前（人名・会社名・塾名）を架空の用事に書き換える。座標はスクショ全体での帯の位置。
            // 帯は 134px の格子（x = 125 + 134×列、幅 128、2日なら 262）。色は帯の左端から拾う
            rename: [
              { x: 393, y: 435, w: 396, text: 'インターン' },   // インターン ファブ（3日）
              { x: 795, y: 435, w: 128, text: 'サークル' },      // サイル
              { x: 795, y: 473, w: 128, text: '英検' },          // G検定
              { x: 125, y: 610, w: 128, text: '歯医者' },        // あくゆで
              { x: 259, y: 610, w: 128, text: '友だちとご飯' },  // 小川 ご飯
              { x: 527, y: 610, w: 262, text: 'インターン' },   // インターン アビーム（2日）
              { x: 929, y: 610, w: 128, text: '説明会' },        // コンサル…
              { x: 661, y: 648, w: 128, text: '美容院' },        // 村上さん…
              { x: 527, y: 786, w: 128, text: '誕生日' },        // ママの誕…
              { x: 929, y: 786, w: 128, text: '塾' },            // マナビズ…
              { x: 259, y: 961, w: 128, text: 'ライブ' },        // ベビモン
              { x: 393, y: 961, w: 128, text: 'ライブ' },        // ベビモン
              // マクド → バイト（店の名前も出さない）。dashed は点線の「まだ」の帯：枠は残して中だけ塗り直す
              { x: 795, y: 511, w: 128, text: 'バイト' },
              { x: 929, y: 473, w: 128, text: 'バイト' },
              { x: 393, y: 648, w: 128, text: 'バイト' },
              { x: 795, y: 610, w: 128, text: 'バイト' },
              { x: 259, y: 786, w: 128, text: 'バイト' },
              { x: 393, y: 786, w: 128, text: 'バイト' },
              { x: 661, y: 961, w: 128, text: 'バイト' },
              { x: 795, y: 961, w: 128, text: 'バイト' },
              { x: 929, y: 823, w: 128, text: 'バイト', dashed: true },
              { x: 259, y: 1137, w: 128, text: 'バイト', dashed: true },
              { x: 393, y: 1137, w: 128, text: 'バイト', dashed: true },
            ] },
};

// 帯の文字を書き換える。帯の色で帯ごと塗り直して（角丸 6px）、その上に文字。
// 文字は元と同じく、帯の左から 11px、大きさ 23px、下端は帯の上から 22px
async function renameBars(home, list) {
  const { data, info } = await sharp(home).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const o = (y * info.width + x) * info.channels; return `rgb(${data[o]},${data[o + 1]},${data[o + 2]})`; };
  const h = 27;
  // 色は帯の右端の内側から拾う（文字は左に寄っているので当たらない）。点線の帯は枠 3px を残す
  const parts = list.map((r) => (r.dashed
    ? `<rect x="${r.x + 3}" y="${r.y + 3}" width="${r.w - 6}" height="${h - 6}" rx="4" fill="${px(r.x + r.w - 10, r.y + 13)}"/>`
    : `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${h}" rx="6" fill="${px(r.x + r.w - 10, r.y + 13)}"/>`) + `<text x="${r.x + 11}" y="${r.y + 22}" font-family="'Hiragino Sans','Yu Gothic UI','Yu Gothic',sans-serif" font-size="23" fill="#2E3A2E">${r.text}</text>`);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">${parts.join('')}</svg>`);
  return sharp(home).composite([{ input: svg }]).png().toBuffer();
}
async function widgetCrop(kind) {
  const def = WIDGET[kind];
  let home = join(GEN, def.file);
  if (kind === 'medium' && !existsSync(home)) home = join(GEN, 'widget-home.png');   // 前の名前
  if (!existsSync(home)) return null;
  const { data, info } = await sharp(home).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, C = info.channels;
  const white = (x, y) => { const o = (y * W + x) * C; return data[o] >= 240 && data[o + 1] >= 240 && data[o + 2] >= 240; };
  const cands = ((W < 800 && def.cropSeeds) ? def.cropSeeds : def.seeds).map(([fx, fy]) => [Math.round(W * fx), Math.round(info.height * fy)]);
  // 白い候補の中で、その行を左右に走らせたときいちばん広いものを種にする。
  // 文字や小さなカレンダーの中に落ちた種だと、走らせても手前で止まる
  const runAt = (sx, sy, dx, dy) => { let x = sx, y = sy, gap = 0, last = [sx, sy]; while (x > 0 && y > 0 && x < W - 1 && y < info.height - 1) { x += dx; y += dy; if (white(x, y)) { gap = 0; last = [x, y]; } else if (++gap > 12) break; } return last; };
  const whites = cands.filter(([x, y]) => white(x, y));
  if (!whites.length) throw new Error(`${def.file}: ウィジェットの白い所が見つからない`);
  const seed = whites.map((c) => ({ c, w: runAt(c[0], c[1], 1, 0)[0] - runAt(c[0], c[1], -1, 0)[0] })).sort((a, b) => b.w - a.w)[0].c;
  const run = (sx, sy, dx, dy) => { let x = sx, y = sy, gap = 0, last = [sx, sy]; while (x > 0 && y > 0 && x < W - 1 && y < info.height - 1) { x += dx; y += dy; if (white(x, y)) { gap = 0; last = [x, y]; } else if (++gap > 12) break; } return last; };
  // 1行だけ走らせると、予定の帯や数字に当たって手前で止まる（大で右端と下端が縮んだ）。
  // 逆に「いちばん広いもの」を取ると、壁紙の明るい所へ抜けた行が勝ってしまう（左右が画像の端まで行った）。
  // 何行も走らせて、**いちばん多く出た値**を取る。何にも当たらない行は全部同じ縁で止まるが、
  // 帯に当たった行や壁紙へ抜けた行は止まる場所がばらばらなので、多数決で縁が残る。
  // 行は種より下だけ（種より上は壁紙の明るい所と地続きになりやすい）
  const mode = (vals, pickMax) => {
    const bins = new Map();
    for (const v of vals) { const k = Math.round(v / 12); bins.set(k, (bins.get(k) || 0) + 1); }
    let bestK = null, bestN = 0;
    for (const [k, n] of bins) if (n > bestN || (n === bestN && (pickMax ? k > bestK : k < bestK))) { bestK = k; bestN = n; }
    const near = vals.filter((v) => Math.round(v / 12) === bestK);
    return pickMax ? Math.max(...near) : Math.min(...near);
  };
  const lefts = [], rights = [];
  const span = Math.round(info.height * 0.15);
  for (let y = seed[1]; y <= Math.min(info.height - 2, seed[1] + span); y += 2) {
    if (!white(seed[0], y)) continue;
    lefts.push(run(seed[0], y, -1, 0)[0]); rights.push(run(seed[0], y, 1, 0)[0]);
  }
  let left = mode(lefts, false), right = mode(rights, true);
  const bottoms = [];
  for (let x = left + 8; x <= right - 8; x += 2) {
    if (!white(x, seed[1])) continue;
    bottoms.push(run(x, seed[1], 0, 1)[1]);
  }
  // 下は多数決だと帯の上辺が勝つ（帯は列をまたいで同じ高さに並ぶ）。カードの下辺はまっすぐなので、
  // 何にも当たらなかった列は全部同じ y で止まる。**3列以上が同じ y で止まった中で、いちばん下**を取る。
  // 壁紙の明るい所へ抜けた列は止まる場所がばらばらなので、束にならず外れる
  const bins = new Map();
  for (const v of bottoms) { const k = Math.round(v / 12); bins.set(k, (bins.get(k) || 0) + 1); }
  let bk = null;
  for (const [k, n] of bins) if (n >= 3 && (bk === null || k > bk)) bk = k;
  let bottom = bk === null ? Math.max(...bottoms) : Math.max(...bottoms.filter((v) => Math.round(v / 12) === bk));
  left += 3; right -= 3; bottom -= 4;
  const width = right - left, height = Math.round(width * def.ratio), top = bottom - height;
  console.log(`ウィジェット ${kind}: (${left},${top})–(${right},${bottom})  ${width}×${height}px`);
  const r = Math.round(Math.min(width, height) * 0.13);
  const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${r}" fill="#fff"/></svg>`);
  const renamed = def.rename ? await renameBars(home, def.rename) : home;
  let base = await sharp(renamed).extract({ left, top, width, height }).png().toBuffer();
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

// 塊の中心と傾きだけ借りて、一回り大きいカードとして影ごと描く。
// ChatGPT の描いた四角は小さめだった（「もっと大きく」と本人）。四角の型で切ると
// その大きさに縛られるので、型は使わず、四角と影ごと上から覆う。
// scale はもとの四角に対する倍率。1.3 なら、四隅それぞれ 15% ずつ外へ広がるので、
// もとの影（10〜20px）も隠れる。dx/dy で少しずらせる（重なりを避けるため）
async function pasteBig(canvas, b, src, W, H, scale, dx = 0, dy = 0) {
  const w = Math.round(b.rect.w * scale), h = Math.round(b.rect.h * scale);
  const cx = b.rect.cx + dx, cy = b.rect.cy + dy;
  const r = Math.round(Math.min(w, h) * 0.13);
  // 角を丸く抜いたカード
  const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
  const card = await sharp(src).resize(w, h, { fit: 'fill' }).ensureAlpha().composite([{ input: round, blend: 'dest-in' }]).png().toBuffer();
  // 影：同じ形を黒 22% で、少し下にずらしてぼかす
  const pad = 60;
  const shadowSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}"><rect x="${pad}" y="${pad + 10}" width="${w}" height="${h}" rx="${r}" fill="#2A241C" fill-opacity="0.22"/></svg>`);
  const shadow = await sharp(shadowSvg).blur(14).png().toBuffer();
  const withShadow = await sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: shadow, left: 0, top: 0 }, { input: card, left: pad, top: pad }]).png().toBuffer();
  const rotated = await sharp(withShadow).rotate(b.tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const rm = await sharp(rotated).metadata();
  return sharp(canvas).composite([{ input: rotated, left: Math.round(cx - rm.width / 2), top: Math.round(cy - rm.height / 2) }]).png().toBuffer();
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
// 白い四角とその影を、まわりの地の色で塗りつぶして消す。
// 大きく貼り直すと、もとの四角の位置からはみ出す所・はみ出さない所ができて、
// もとの四角の縁や影が残って見えてしまう。先に消しておく。
// 地は上下に少しグラデーションがあるので、1色で塗らず、行ごとにその行の（四角の左右の）地の色で塗る
// avoid は、色を拾ってはいけない所（隣の四角とその影）。小の輪が中の白に届いて、白で塗ってしまった
// rIn/rOut は消す幅と色を拾う輪の幅。四角は影が広いので 48/80、文字は 24/44（文字の影まで消す幅。もっと広くすると左の葉の影まで塗って縞になる）
async function eraseBlob(canvas, b, avoid, rIn = 48, rOut = 80, feather = 10) {
  const { W, H } = b;
  // r px 太らせる。横に走らせて「x±r に1つでもあるか」、次にその結果を縦に同じく（累積和で）
  const dilate = (src, r) => {
    const pass = (inp, len, count, at) => {
      const out = new Uint8Array(W * H), acc = new Int32Array(len + 1);
      for (let i = 0; i < count; i++) {
        for (let j = 0; j < len; j++) acc[j + 1] = acc[j] + inp[at(i, j)];
        for (let j = 0; j < len; j++) { const lo = Math.max(0, j - r), hi = Math.min(len, j + r + 1); if (acc[hi] - acc[lo] > 0) out[at(i, j)] = 1; }
      }
      return out;
    };
    const h = pass(src, W, H, (y, x) => y * W + x);
    return pass(h, H, W, (x, y) => y * W + x);
  };
  const inner = dilate(b.mask, rIn), outer = dilate(b.mask, rOut);
  const { data, info } = await sharp(canvas).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  // 行ごとの地の色（内側の外・外側の内の輪から）。無い行は近い行から借りる
  const rowCol = new Array(H).fill(null);
  for (let y = 0; y < H; y++) {
    let r = 0, g = 0, bl = 0, n = 0;
    for (let x = 0; x < W; x++) { const p = y * W + x; if (outer[p] && !inner[p] && !avoid[p]) { const o = p * ch; r += data[o]; g += data[o + 1]; bl += data[o + 2]; n++; } }
    if (n) rowCol[y] = [r / n, g / n, bl / n];
  }
  for (let y = 0; y < H; y++) if (!rowCol[y]) { for (let d = 1; d < H; d++) { if (rowCol[y - d]) { rowCol[y] = rowCol[y - d]; break; } if (rowCol[y + d]) { rowCol[y] = rowCol[y + d]; break; } } }
  // 塗る層：色は行ごと、アルファは内側の型をぼかしたもの（縁をなじませる）
  // 1チャンネルで入れても、ぼかすと3チャンネルで返ってくることがある。何チャンネルかは長さから
  const alpha = await sharp(Buffer.from(inner.map((v) => v * 255)), { raw: { width: W, height: H, channels: 1 } }).blur(feather).raw().toBuffer();
  const ac = alpha.length / (W * H);
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) { const c = rowCol[(p / W) | 0] || [0, 0, 0]; rgba[p * 4] = c[0]; rgba[p * 4 + 1] = c[1]; rgba[p * 4 + 2] = c[2]; rgba[p * 4 + 3] = alpha[p * ac]; }
  const layer = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return sharp(canvas).composite([{ input: layer, left: 0, top: 0 }]).png().toBuffer();
}

// ---- 見出し ----
// ChatGPT の絵に焼き込まれた見出しは小さかったので、消して描き直す。
// 書体は Windows の游ゴシック太字。ChatGPT の書体とは少し違うが、この大きさなら気にならない。
// 小見出しは緑（絵の緑を拾った）、見出しは黒。幅は左右 70px を残して自動で決める
const TEXT = {
  font: "'Yu Gothic UI','Yu Gothic','Meiryo',sans-serif",
  sub: { size: 60, color: '#476A4B', top: 280 },   // 小見出しの上端
  // 見出し 2 行で下端が 770 くらい。スマホの上端はその 60px 下（830）。ChatGPT のスマホの上端（877〜892）より上に来て隠せる
  head: { max: 175, color: '#111111', gapAbove: 50, lineGap: 1.16, spacing: -4 },
  margin: 70,
};

// 文字の幅を測る（描いてみて、透明を切り落として測る）
async function textWidth(text, size, weight, spacing) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="${Math.round(size * 1.6)}"><text x="10" y="${Math.round(size * 1.1)}" font-family="${TEXT.font}" font-weight="${weight}" font-size="${size}" letter-spacing="${spacing}" fill="#000">${text}</text></svg>`);
  const { info } = await sharp(svg).trim().raw().toBuffer({ resolveWithObject: true });
  return info.width;
}

// 絵の上の方にある文字（見出し・小見出し）を探して消す。
// 中央の列（400〜890）に暗い画素のある行をまとめ、そのまとまりごとに x 200〜1090 の暗い画素を型にする。
// 端の葉は x で外れる。スマホの上端（y 830 より下）は見ない
async function eraseTitle(canvas, W, H) {
  const { data, info } = await sharp(canvas).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const dark = (x, y) => { const o = (y * W + x) * ch; return data[o] + data[o + 1] + data[o + 2] < 660; };
  const rows = [];
  for (let y = 150; y < 830; y++) { let c = 0; for (let x = 400; x < 890; x++) if (dark(x, y)) c++; if (c > 2) rows.push(y); }
  const groups = [];
  for (const y of rows) { const g = groups[groups.length - 1]; if (g && y - g[1] <= 40) g[1] = y; else groups.push([y, y]); }
  // 見出し（高さ 80 以上のまとまり）は端まで届く（1 枚目は x 132〜1157）ので x 100〜1190 まで見る。
  // ただし黒〜灰色の画素だけ（葉は緑なので外れる）。小見出しは細いので 200〜1090 で色を問わない
  const neutral = (x, y) => { const o = (y * W + x) * ch; const mx = Math.max(data[o], data[o + 1], data[o + 2]), mn = Math.min(data[o], data[o + 1], data[o + 2]); return mx - mn < 40; };
  const mask = new Uint8Array(W * H);
  for (const [y0, y1] of groups) {
    const big = y1 - y0 > 80, x0 = big ? 100 : 200, x1 = big ? 1190 : 1090;
    for (let y = y0; y <= y1; y++) for (let x = x0; x < x1; x++) if (dark(x, y) && (!big || neutral(x, y))) mask[y * W + x] = 255;
  }
  return eraseVertical(canvas, mask, W, H, 24, 6);
}

// 小見出し 1 行と見出し 1〜2 行を描く。戻り値は文字の下端
async function drawTitle(canvas, W, H, sub, lines) {
  const usable = W - TEXT.margin * 2;
  let size = TEXT.head.max;
  for (const t of lines) { const w = await textWidth(t, size, 'bold', TEXT.head.spacing); if (w > usable) size = Math.floor(size * usable / w); }
  const subBase = TEXT.sub.top + Math.round(TEXT.sub.size * 0.88);
  let y = TEXT.sub.top + TEXT.sub.size + TEXT.head.gapAbove;
  const parts = [`<text x="${W / 2}" y="${subBase}" text-anchor="middle" font-family="${TEXT.font}" font-weight="bold" font-size="${TEXT.sub.size}" letter-spacing="2" fill="${TEXT.sub.color}">${sub}</text>`];
  for (const t of lines) {
    const base = y + Math.round(size * 0.88);
    parts.push(`<text x="${W / 2}" y="${base}" text-anchor="middle" font-family="${TEXT.font}" font-weight="bold" font-size="${size}" letter-spacing="${TEXT.head.spacing}" fill="${TEXT.head.color}">${t}</text>`);
    y += Math.round(size * TEXT.head.lineGap);
  }
  const bottom = y - Math.round(size * (TEXT.head.lineGap - 1));
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`);
  console.log(`  見出し ${size}px（${lines.join('／')}） 下端 ${bottom}`);
  return { canvas: await sharp(canvas).composite([{ input: svg }]).png().toBuffer(), bottom, size };
}

// ---- スマホ ----
// 幅 880px（幅の 68%）。縁 22px、角は画面の角 + 縁。上の帯（SAFE=1 で撮ったスクショの
// ステータスバーの所）にダイナミックアイランドを描く。影は下へ落とす
const PHONE = { w: 880, bezel: 22, rim: 3, screenR: 107, island: { w: 245, h: 72, top: 21 } };
async function drawPhone(canvas, W, H, shotFile, top) {
  const { w, bezel, rim, screenR } = PHONE;
  const sw = w - bezel * 2;
  const sm = await sharp(shotFile).metadata();
  const sh = Math.round(sw * sm.height / sm.width);
  const h = sh + bezel * 2, outerR = screenR + bezel;
  const left = Math.round((W - w) / 2);
  // 画面：角を丸く抜いたスクショ
  const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}"><rect width="${sw}" height="${sh}" rx="${screenR}" fill="#fff"/></svg>`);
  const screen = await sharp(shotFile).resize(sw, sh, { fit: 'fill' }).ensureAlpha().composite([{ input: round, blend: 'dest-in' }]).png().toBuffer();
  // 本体：黒に近いグレー、外側に細い明るい縁。アイランドは画面の上に
  const body = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" rx="${outerR}" fill="#4A4A4E"/>
    <rect x="${rim}" y="${rim}" width="${w - rim * 2}" height="${h - rim * 2}" rx="${outerR - rim}" fill="#1C1C1F"/>
  </svg>`);
  const island = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${(w - PHONE.island.w) / 2}" y="${bezel + PHONE.island.top}" width="${PHONE.island.w}" height="${PHONE.island.h}" rx="${PHONE.island.h / 2}" fill="#0B0B0C"/></svg>`);
  const phone = await sharp(body).composite([{ input: screen, left: bezel, top: bezel }, { input: island }]).png().toBuffer();
  // 影：本体の形を黒 35% で、下へ 36px ずらして大きくぼかす。もう一つ、近い影を薄く
  const pad = 120;
  const shadowSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}"><rect x="${pad}" y="${pad + 36}" width="${w}" height="${h}" rx="${outerR}" fill="#2A241C" fill-opacity="0.35"/></svg>`);
  const shadow = await sharp(shadowSvg).blur(28).png().toBuffer();
  const near = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}"><rect x="${pad}" y="${pad + 8}" width="${w}" height="${h}" rx="${outerR}" fill="#2A241C" fill-opacity="0.25"/></svg>`)).blur(8).png().toBuffer();
  const layer = await sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: shadow, left: 0, top: 0 }, { input: near, left: 0, top: 0 }, { input: phone, left: pad, top: pad }]).png().toBuffer();
  console.log(`  スマホ ${w}×${h}px 上端 ${top} 下端 ${top + h}`);
  return sharp(canvas).composite([{ input: layer, left: left - pad, top: top - pad }]).png().toBuffer();
}

// 1 枚組む：見出しを消して描き直し、スマホがあれば描く
async function buildCard(genFile, outFile, sub, lines, shotFile) {
  const gen = await sharp(join(GEN, genFile)).resize(TARGET_W).png().toBuffer();
  const { width: W, height: H } = await sharp(gen).metadata();
  let canvas = await eraseTitle(gen, W, H);
  const t = await drawTitle(canvas, W, H, sub, lines);
  canvas = t.canvas;
  if (shotFile) canvas = await drawPhone(canvas, W, H, shotFile, t.bottom + 60);
  await sharp(canvas).png().toFile(outFile);
  console.log(`${genFile} → ${outFile.split(/[\\/]/).pop()}`);
  return t;
}

// mask を r px 太らせた範囲を、列ごとに上下の地の色を直線でつないで塗る（文字消し用）
async function eraseVertical(canvas, mask, W, H, r, feather) {
  const { data, info } = await sharp(canvas).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  // 縦横 r の太らせ（累積和）
  const pass = (inp, len, count, at) => {
    const out = new Uint8Array(W * H), acc = new Int32Array(len + 1);
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < len; j++) acc[j + 1] = acc[j] + (inp[at(i, j)] ? 1 : 0);
      for (let j = 0; j < len; j++) { const lo = Math.max(0, j - r), hi = Math.min(len, j + r + 1); if (acc[hi] - acc[lo] > 0) out[at(i, j)] = 1; }
    }
    return out;
  };
  const inner = pass(pass(mask, W, H, (y, x) => y * W + x), H, W, (x, y) => y * W + x);
  // 塗らない所は元の色を入れておく（縁のぼかしで黒がにじんで、影のような線が出た）
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) { const o = p * ch; rgba[p * 4] = data[o]; rgba[p * 4 + 1] = data[o + 1]; rgba[p * 4 + 2] = data[o + 2]; }
  const avg = (x, y0, y1) => { const c = [0, 0, 0]; let n = 0; for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) { const o = (y * W + x) * ch; c[0] += data[o]; c[1] += data[o + 1]; c[2] += data[o + 2]; n++; } return c.map((v) => v / Math.max(1, n)); };
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H) {
      if (!inner[y * W + x]) { y++; continue; }
      let e = y; while (e < H && inner[e * W + x]) e++;
      const top = avg(x, y - 6, y), bot = avg(x, e, e + 6);
      for (let yy = y; yy < e; yy++) { const t = (yy - y + 0.5) / (e - y); const o = (yy * W + x) * 4; for (let k = 0; k < 3; k++) rgba[o + k] = Math.round(top[k] + (bot[k] - top[k]) * t); rgba[o + 3] = 255; }
      y = e;
    }
  }
  // 縁をなじませる：アルファだけぼかす
  const a1 = await sharp(Buffer.from(inner.map((v) => v * 255)), { raw: { width: W, height: H, channels: 1 } }).blur(feather).raw().toBuffer();
  const ac = a1.length / (W * H);
  for (let p = 0; p < W * H; p++) rgba[p * 4 + 3] = a1[p * ac];
  const layer = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return sharp(canvas).composite([{ input: layer, left: 0, top: 0 }]).png().toBuffer();
}

async function fillWidgets(genFile, outFile) {
  const gen = await sharp(join(GEN, genFile)).resize(TARGET_W).png().toBuffer();
  const blobs = await whiteBlobs(gen, 3, [232, 250]);
  if (blobs.length < 3) { console.log(`${genFile}: 白い四角が ${blobs.length} つしか無い`); return false; }
  // 中＝いちばん横長。残り2つは比が近い（描かれた大は 1.02、小は 1.03 だった）ので、面積で決める
  const byA = blobs.map((b) => ({ b, a: b.rect.h / b.rect.w, area: b.rect.w * b.rect.h })).sort((x, y) => x.a - y.a);
  const rest = byA.slice(1).sort((x, y) => x.area - y.area);
  const kinds = { medium: byA[0].b, small: rest[0].b, large: rest[1].b };
  const { W, H } = blobs[0];
  // ChatGPT の四角は小さめだった（「もっとすべてを大きく」と本人）。四角の傾きと上下の位置は借りて、
  // 大きさと左右の位置はこちらで決める。まず、もとの四角と影を消す
  let canvas = await eraseTitle(gen, W, H);
  const title = await drawTitle(canvas, W, H, '小・中・大、好きな大きさで', ['ウィジェットで表示']);
  canvas = title.canvas;
  const near = new Uint8Array(W * H);
  for (const b of blobs) for (let p = 0; p < W * H; p++) if (b.mask[p]) { near[p] = 1; }
  // 3つぶんの白を 60px 太らせたものを「拾ってはいけない所」に
  const grow = (src, r) => { const out = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) if (src[p]) { const x = p % W, y = (p / W) | 0; for (let dy = -r; dy <= r; dy += 4) for (let dx = -r; dx <= r; dx += 4) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) out[yy * W + xx] = 1; } } return out; };
  const avoid = grow(near, 60);
  for (const b of blobs) canvas = await eraseBlob(canvas, b, avoid);
  if (process.env.DEBUG_ERASE) await sharp(canvas).png().toFile(process.env.DEBUG_ERASE);
  // 上の段：小と中を横に並べる。左右の余白 45px、あいだ 40px で、幅いっぱいに
  const margin = 45, gap = 40;
  const sw0 = kinds.small.rect.w, mw0 = kinds.medium.rect.w;
  const topScale = (W - margin * 2 - gap) / (sw0 + mw0);
  const sw = sw0 * topScale, mw = mw0 * topScale;
  // 上の段の上端は、見出しの下端 + 110px
  const topH = Math.max(kinds.small.rect.h, kinds.medium.rect.h) * topScale;
  const topCy = title.bottom + 110 + topH / 2;
  // 下の段：大は幅の 66% に。上の段の下端から 60px あける
  const lw = W * 0.66, largeScale = lw / kinds.large.rect.w;
  const topBottom = topCy + Math.max(kinds.small.rect.h, kinds.medium.rect.h) * topScale / 2;
  const largeCy = topBottom + 60 + kinds.large.rect.h * largeScale / 2;
  const plan = [
    ['large', kinds.large, largeScale, W / 2, largeCy],
    ['medium', kinds.medium, topScale, W - margin - mw / 2, topCy],
    ['small', kinds.small, topScale, margin + sw / 2, topCy],
  ];
  for (const [kind, b, scale, cx, cy] of plan) {
    const src = await widgetCrop(kind);
    if (!src) { console.log(`  ${kind} のスクショが無い（gen/${WIDGET[kind].file}）。空のまま`); continue; }
    canvas = await pasteBig(canvas, b, src, W, H, scale, cx - b.rect.cx, cy - b.rect.cy);
    console.log(`  ${kind}: ${Math.round(b.rect.w * scale)}×${Math.round(b.rect.h * scale)}px（×${scale.toFixed(2)}） 中心 (${Math.round(cx)},${Math.round(cy)}) 傾き ${b.tilt.toFixed(1)}°`);
  }
  await sharp(canvas).png().toFile(outFile);
  console.log(`${genFile} → 3.png（3つ）`);
  return true;
}

// 小見出しと見出し。見出しは 2 行までで、幅に合わせて大きさが決まる
await buildCard('gen-1.png', join(OUT, '1.png'), 'たぶんの予定も、そのまま', ['未定のまま、置ける'], null);
await buildCard('gen-2.png', join(OUT, '2.png'), '点線が、塗りに変わる', ['決まったら、', '押すだけ'], join(ROOT, '2-dialog.png'));
await buildCard('gen-4.png', join(OUT, '4.png'), '○△× で、空きがひと目', ['いつ空いてる？', 'すぐ答える'], join(ROOT, '3-free.png'));
await buildCard('gen-5.png', join(OUT, '5.png'), 'バイトも、遊びも、用事も', ['何に時間を', '使ったか、見える'], join(ROOT, '5-report.png'));
// 3枚目：白い四角が3つある絵に、大・中・小を貼る
if (existsSync(join(GEN, 'gen-3-sizes.png'))) await fillWidgets('gen-3-sizes.png', join(OUT, '3.png'));
else console.log('gen/gen-3-sizes.png が無いので 3 は飛ばした');
console.log('できた store-assets/sukuji/out/');
