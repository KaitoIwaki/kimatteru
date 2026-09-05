// アイコンの案を並べる。図案も、地の明暗も、数字で決められる。
//
// いまの tools/icon-source.png は写真のような1枚の絵なので、図案を変えられない。
// そこで **高さの地図を作って光を当てる**（凹みの傾きから法線を出して陰を計算する）
// 作りにした。
//
// 元の絵を測って合わせてある（1024 に直したときの値）:
//   座標  スリット 中心 x ±147・y 178.5 から 163px・幅 42
//         丸 列 312.5/446/578.5/709.5・行 510.5/636.5/762.5・直径 64
//   色    紙 rgb(254,247,237)／左上の縁 rgb(159,141,114)／底 rgb(244,234,220)
//
// 元の絵を真似るときに要った3つ:
//   1. **壁は穴の中に立っている。** ぼかしただけだと影が紙の外へにじんで、
//      へこみが柔らかく見える。内側へ縮めた形を重ねて、傾きを穴の中に閉じ込める
//   2. **底の影は左上の壁が落としている。** 光の方へずらして紙が有るかを見れば、
//      左上ほど暗く、右下へ抜けていく元の絵の階調が出る
//   3. **暗くなるほど暖かい。** 赤青の差が紙 17 → 底 24 → 縁 45。倍率で暗くすると
//      逆に差が縮んで灰色になる。暖かい影の色へ混ぜる
//
// 落とし穴（2回外した）:
//   - 粒（紙の質感）を高さに載せると、1画素ごとの差が傾きになって法線が壊れ、
//     紙が灰色に濁る。明るさの側に、ごく薄く載せる
//   - sharp に channels:1 の生データを渡しても、返ってくるのは3チャンネル。
//     足並み（info.channels）を見ずに読むと地図が横にずれ、何も無かったことになる
//
// 決まりごと（差し替えても守る）:
//   - 角を丸めない。iOS が自分でマスクをかけるので、こちらで丸めると縁に黒が残る
//   - 四隅まで地の色を敷く。透過も不可（App Store が許さない）
//
// 実行: node tools/icon-ideas.cjs
const sharp = require('sharp');
const N = 1024;
const F = "'Hiragino Sans','Yu Gothic',sans-serif";

// 地と、凹みがあらわす色
const LIGHT_PAPER = [254, 247, 237], LIGHT_DEEP = [88, 62, 18];
const DARK_PAPER = [35, 32, 28], DARK_CORE = [242, 237, 227];

// ---- 図案の部品。inset だけ内側へ縮められること ----
const dashOf = (peri, n) => `${((peri / n) * 0.58).toFixed(2)} ${((peri / n) * 0.42).toFixed(2)}`;
function part(s, i) {
  // 点線は端を切る（butt）。丸い端のまま幅を縮めると、一つずつが団子に膨らむ
  const W = (v, d) => `stroke-linecap="${d ? 'butt' : 'round'}" stroke-width="${v}" fill="none" stroke="#fff"`;
  switch (s.t) {
    case 'circle': {
      const r = s.r - i;
      return r > 0 ? `<circle cx="${s.cx}" cy="${s.cy}" r="${r}" fill="#fff"/>` : '';
    }
    case 'ring': {
      const sw = s.sw - i * 2, rr = s.r - s.sw / 2;
      if (sw <= 0) return '';
      const d = s.dashes ? ` stroke-dasharray="${dashOf(2 * Math.PI * rr, s.dashes)}"` : '';
      return `<circle cx="${s.cx}" cy="${s.cy}" r="${rr}" ${W(sw, s.dashes)}${d}/>`;
    }
    case 'rrect': {
      const w = s.w - i * 2, h = s.h - i * 2;
      if (w <= 0 || h <= 0) return '';
      return `<rect x="${s.x + i}" y="${s.y + i}" width="${w}" height="${h}" rx="${Math.max(0, s.rx - i)}" fill="#fff"/>`;
    }
    case 'rring': {
      const sw = s.sw - i * 2;
      if (sw <= 0) return '';
      const peri = 2 * (s.w + s.h) - 8 * s.rx + 2 * Math.PI * s.rx;
      const d = s.dashes ? ` stroke-dasharray="${dashOf(peri, s.dashes)}"` : '';
      return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" ${W(sw, s.dashes)}${d}/>`;
    }
    case 'stroke': {   // 好きな道。点線は px で指定する
      const sw = s.sw - i * 2;
      if (sw <= 0) return '';
      const d = s.dash ? ` stroke-dasharray="${s.dash.join(' ')}"` : '';
      return `<path d="${s.d}" ${W(sw, s.dash)}${d}/>`;
    }
    case 'halfL': {    // 丸の左半分だけ塗る。平らな辺も内側へ寄せる
      const r = s.r - i;
      if (r <= 0) return '';
      return `<path d="M ${s.cx - i} ${s.cy - r} A ${r} ${r} 0 0 0 ${s.cx - i} ${s.cy + r} Z" fill="#fff"/>`;
    }
    default: return '';
  }
}
const svgOf = (shapes, i) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">`
  + `<rect width="${N}" height="${N}" fill="#000"/>${shapes.map((s) => part(s, i)).join('')}</svg>`;

// ---- 高さの地図に光を当てる ----
// 生の高さの地図をぼかす。足並みは info.channels で見る（上の落とし穴）
async function blurF(H, sigma) {
  const g = Buffer.alloc(N * N);
  for (let i = 0; i < N * N; i++) g[i] = Math.round(Math.max(0, Math.min(1, H[i])) * 255);
  const { data, info } = await sharp(g, { raw: { width: N, height: N, channels: 1 } })
    .blur(sigma).raw().toBuffer({ resolveWithObject: true });
  const out = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) out[i] = data[i * info.channels] / 255;
  return out;
}

// 0＝紙、1＝底。縁から o.wall だけ内側で 1 に達する
async function heightMap(shapes, o) {
  const k = 8;
  const H = new Float32Array(N * N);
  for (let j = 1; j <= k; j++) {
    const m = await sharp(Buffer.from(svgOf(shapes, (j * o.wall) / k))).greyscale().raw().toBuffer();
    for (let i = 0; i < N * N; i++) H[i] += m[i] / 255 / k;
  }
  return blurF(H, o.smooth);   // 段を滑らかにするだけ。大きくすると影が外へにじむ
}

const LIGHT = [-0.52, -0.52, 0.68];   // 光は左上から。元の絵と同じ向き
const rnd = (() => { let a = 0x9e3779b9; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();

async function render(shapes, o) {
  const H = await heightMap(shapes, o);
  const HB = await blurF(H, o.castBlur);   // 壁が落とす影を見るための、ぼかした地図
  const dark = o.mode === 'core';
  const GROUND = o.ground || (dark ? DARK_PAPER : LIGHT_PAPER);
  const OTHER = o.core || (dark ? DARK_CORE : LIGHT_DEEP);
  const AMB = 0.30, KD = 1 - AMB;
  const flat = AMB + KD * LIGHT[2];        // 平らな紙。ここを 1.0 に正規化する
  const d0 = Math.round(o.castDist * 0.707);
  const out = Buffer.alloc(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const gx = (H[i + (x < N - 1 ? 1 : 0)] - H[i - (x > 0 ? 1 : 0)]) * 0.5;
    const gy = (H[i + (y < N - 1 ? N : 0)] - H[i - (y > 0 ? N : 0)]) * 0.5;
    const nx = o.depth * gx, ny = o.depth * gy;
    const len = Math.hypot(nx, ny, 1);
    let b = (AMB + KD * Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + LIGHT[2]) / len)) / flat;
    // 光の方（左上）へずらして紙が有れば、その壁が影を落としている
    const sx = x - d0, sy = y - d0;
    const up = sx >= 0 && sy >= 0 ? HB[sy * N + sx] : 0;
    b *= 1 - o.cast * H[i] * (1 - up);
    b *= 1 - o.ao * H[i];                  // 奥ほど光が回り込まない
    b *= 1 + (rnd() - 0.5) * o.grain;
    if (dark) {
      // 暗い紙を彫って、明るい芯を出す。凹んだところが明るくなる
      const m = Math.max(0, Math.min(1, H[i]));
      const bb = Math.max(0.38, Math.min(1.06, b));
      for (let k = 0; k < 3; k++)
        out[i * 3 + k] = Math.max(0, Math.min(255, Math.round((GROUND[k] * (1 - m) + OTHER[k] * m) * bb)));
    } else {
      // 暗くなるほど暖かい色へ。倍率で暗くすると灰色になる
      b = Math.min(1.03, b);
      const t = Math.max(0, Math.min(1, 1 - b));
      for (let k = 0; k < 3; k++)
        out[i * 3 + k] = Math.max(0, Math.min(255, Math.round(GROUND[k] * (b > 1 ? b : 1) * (1 - t) + OTHER[k] * t)));
    }
  }
  return sharp(out, { raw: { width: N, height: N, channels: 3 } }).png().toBuffer();
}

// ---- 図案 ----
const SLIT = { dx: 147, y0: 178.5, h: 163, w: 42 };
const slits = () => [512 - SLIT.dx, 512 + SLIT.dx].map((cx) =>
  ({ t: 'rrect', x: cx - SLIT.w / 2, y: SLIT.y0, w: SLIT.w, h: SLIT.h, rx: SLIT.w / 2 }));
const COLS = [312.5, 446, 578.5, 709.5], ROWS = [510.5, 636.5, 762.5], R = 32;
// 未確定の日。散らばって見えるように、行ごとに1つ、列をずらして置く
const RINGS = [[0, 2], [1, 0], [2, 3]];
const grid = (rings) => ROWS.flatMap((cy, r) => COLS.map((cx, c) =>
  rings && RINGS.some(([a, b]) => a === r && b === c)
    ? { t: 'ring', cx, cy, r: R, sw: 12, dashes: 7 }
    : { t: 'circle', cx, cy, r: R }));

const BASE = { wall: 4, depth: 8, ao: 0.05, cast: 0.34, castBlur: 3.5, castDist: 12, smooth: 0.6, grain: 0.008 };

const IDEAS = {
  // 図案はそのまま。深さも今のまま
  'A｜いま（比べる用）': { src: true },
  // 12個のうち3つを点線の輪に。いちばん小さい直し
  'B｜点線の輪を3つ': { shapes: [...slits(), ...grid(true)], o: BASE },
  // 数を捨てて、2つだけ大きく。29pt でも「二つある」が読める
  'C｜大きく2つ': {
    shapes: [...slits(),
      { t: 'circle', cx: 380, cy: 640, r: 122 },
      { t: 'ring', cx: 644, cy: 640, r: 122, sw: 26, dashes: 11 }],
    o: BASE,
  },
  // 1つの丸の中で、左が決まって右がまだ。形が1つなので小さくても崩れない
  'D｜半分と半分': {
    shapes: [...slits(),
      { t: 'halfL', cx: 512, cy: 645, r: 168 },
      { t: 'stroke', d: 'M 512 477 A 168 168 0 0 1 512 813', sw: 24, dash: [40, 26] }],
    o: BASE,
  },
  // アプリの名前そのもの。？ の輪を点線、点を塗りにする
  'E｜？ のかたち': {
    shapes: [
      { t: 'stroke', d: 'M 380 372 A 132 132 0 1 1 512 504 L 512 610', sw: 38, dash: [54, 34] },
      { t: 'circle', cx: 512, cy: 748, r: 46 }],
    o: BASE,
  },
  // アプリが実際に描いている帯そのもの。塗りと点線を上下に
  'F｜帯を2本': {
    shapes: [
      { t: 'rrect', x: 262, y: 396, w: 500, h: 128, rx: 30 },
      { t: 'rring', x: 262, y: 580, w: 500, h: 128, rx: 30, sw: 22, dashes: 15 }],
    o: BASE,
  },
  // 図案は B のまま、地を暗くして芯を出す。白地でも輪郭が残る
  'G｜暗い紙に彫る': { shapes: [...slits(), ...grid(true)], o: { ...BASE, mode: 'core', cast: 0.35, ao: 0.02 } },
  // 色を1色だけ入れる。まだの3つは刷ったものとして描き、決まった9つは型押しのまま。
  // 紙の型押しは色を持たないので、色が入るとそこだけが「別の種類」に見える
  'H｜紙に1色だけ': {
    shapes: [...slits(), ...ROWS.flatMap((cy, r) => COLS.map((cx, c) =>
      RINGS.some(([a, b]) => a === r && b === c) ? null : { t: 'circle', cx, cy, r: R })).filter(Boolean)],
    o: BASE,
    overlay: RINGS.map(([r, c]) => {
      const rr = R - 6, seg = (2 * Math.PI * rr) / 7;
      return `<circle cx="${COLS[c]}" cy="${ROWS[r]}" r="${rr}" fill="none" stroke="#0E7C86"`
        + ` stroke-width="12" stroke-linecap="butt" stroke-dasharray="${(seg * 0.58).toFixed(2)} ${(seg * 0.42).toFixed(2)}"/>`;
    }).join(''),
  },
  // C と G を重ねたもの。小さくても読めて、白地でも輪郭が残る
  'I｜大きく2つ・暗い紙': {
    shapes: [...slits(),
      { t: 'circle', cx: 380, cy: 640, r: 122 },
      { t: 'ring', cx: 644, cy: 640, r: 122, sw: 26, dashes: 11 }],
    o: { ...BASE, mode: 'core', cast: 0.35, ao: 0.02 },
  },
};

// ---- 確かめ。実際に出る画素数まで小さくしてから測る ----
// ポイント数のまま測ると6分の1の大きさで見ることになり、判断を誤る
const lum = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
async function measure(buf, px) {
  const { data, info } = await sharp(buf).resize(px, px, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const a = Math.floor(px * 0.2), b = Math.floor(px * 0.8);
  let mn = 255, mx = 0;
  for (let y = a; y < b; y++) for (let x = a; x < b; x++) { const v = data[y * info.width + x]; if (v < mn) mn = v; if (v > mx) mx = v; }
  return cr(mx, mn);
}
// 白地に置いたときに、四隅の地がどれだけ立つか（App Store の検索結果は白地）
async function onWhite(buf) {
  const { data, info } = await sharp(buf).resize(87, 87, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const c = [0, 1, 2].map((k) => data[(3 * info.width + 3) * info.channels + k]);
  const g = Math.round(c.reduce((s, v) => s + v) / 3);
  return cr(g, 255);
}

const SIZES = [['ホーム画面', 60, 180], ['Spotlight', 40, 120], ['設定', 29, 87]];

module.exports = { render, measure, onWhite, N, SIZES, slits, grid, COLS, ROWS, R, RINGS, BASE };
if (require.main !== module) return;

(async () => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const names = Object.keys(IDEAS);
  const bufs = {};
  for (const n of names) {
    const d = IDEAS[n];
    bufs[n] = d.src
      ? await sharp(`${__dirname}/icon-source.png`).resize(N, N, { fit: 'fill' }).flatten({ background: '#FDF7EC' }).png().toBuffer()
      : await render(d.shapes, d.o);
    if (d.overlay) bufs[n] = await sharp(bufs[n]).composite([{ input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">${d.overlay}</svg>`) }]).png().toBuffer();
  }

  console.log('紙といちばん暗いところの差（実際に出る画素数まで小さくしてから測る）と、白地での立ち方\n');
  for (const n of names) {
    const cells = [];
    for (const [place, pt, px] of SIZES) cells.push(`${place} ${(await measure(bufs[n], px)).toFixed(2)}`);
    console.log(`  ${n.padEnd(20)} ${cells.join('   ')}   白地に置いたとき ${(await onWhite(bufs[n])).toFixed(2)}`);
  }

  // 並べて見る。4つずつ2段。下の帯は白地に実際の大きさ
  const BIG = 236, PAD = 20, GAP = 24, LABEL = 24, STRIP = 132, COLN = 4;
  const rowH = LABEL + BIG + 8 + STRIP + 26;
  const comp = [];
  names.forEach((n, idx) => {
    const left = PAD + (idx % COLN) * (BIG + GAP), top = PAD + Math.floor(idx / COLN) * rowH;
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${BIG + GAP}" height="${LABEL}"><text x="0" y="15" font-family="${F}" font-size="12" font-weight="700" fill="#1E2024">${esc(n)}</text></svg>`), top, left });
  });
  for (let idx = 0; idx < names.length; idx++) {
    const n = names[idx];
    const left = PAD + (idx % COLN) * (BIG + GAP), top = PAD + Math.floor(idx / COLN) * rowH;
    comp.push({ input: await sharp(bufs[n]).resize(BIG, BIG).png().toBuffer(), top: top + LABEL, left });
    comp.push({ input: await sharp({ create: { width: BIG, height: STRIP, channels: 3, background: '#FFFFFF' } }).png().toBuffer(), top: top + LABEL + BIG + 8, left });
    let x = 10;
    for (const [place, pt, px] of SIZES) {
      const disp = Math.round((px / 3) * 1.6);   // 見やすさのため 1.6 倍で置く（比率は保つ）
      comp.push({ input: await sharp(bufs[n]).resize(disp, disp).png().toBuffer(), top: top + LABEL + BIG + 8 + 18, left: left + x });
      comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${disp + 14}" height="16"><text x="0" y="12" font-family="${F}" font-size="9" fill="#6B7280">${esc(pt)}pt</text></svg>`), top: top + LABEL + BIG + 30 + disp, left: left + x });
      x += disp + 14;
    }
  }
  const rows = Math.ceil(names.length / COLN);
  await sharp({ create: { width: PAD * 2 + COLN * BIG + (COLN - 1) * GAP, height: PAD * 2 + rows * rowH, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile('../store-assets/icon-ideas.png');
  console.log('\nできた  store-assets/icon-ideas.png');
})();
