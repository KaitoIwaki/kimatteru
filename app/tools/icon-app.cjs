// アプリの見た目からアイコンを作る案。
//
// いまのアイコンは「紙に型押し」で、アプリの画面（冷たい暗い地／白い地に、
// 塗りと点線の帯）とどこも似ていない。押す前と押した後がつながっていない。
// ここでは **アプリが実際に使っている色と形だけ** でアイコンを作る。
//
// 使う色は v0.29.0 の配色そのもの:
//   暗い地 #0B0D10 ／ マス #12151A ／ 線 #1F252D ／ 字 #E7EBF0
//   明るい地 #F6F7F9 ／ マス #FFFFFF ／ 線 #E4E7EC ／ 字 #1E2024
//   種類の色 用事 #8B7AB8 ／ バイト #7FAE85 ／ 遊び #D2916A ／ その他 #8A8A8A
//
// 決まりごと（差し替えても守る）:
//   - 角を丸めない。iOS が自分でマスクをかけるので、こちらで丸めると縁に黒が残る
//   - 四隅まで地の色を敷く。透過も不可（App Store が許さない）
//
// 実行: node tools/icon-app.cjs
const sharp = require('sharp');
const { render, N, SIZES, slits, grid } = require('./icon-ideas.cjs');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";

const DARK = { bg: '#0B0D10', cell: '#12151A', line: '#1F252D', ink: '#E7EBF0' };
const LITE = { bg: '#F6F7F9', cell: '#FFFFFF', line: '#E4E7EC', ink: '#1E2024' };
const HUE = { yoji: '#8B7AB8', baito: '#7FAE85', asobi: '#D2916A', other: '#8A8A8A' };

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => `#${hexRgb(a).map((v, i) => Math.round(v * (1 - k) + hexRgb(b)[i] * k).toString(16).padStart(2, '0')).join('')}`;

// 帯。アプリと同じ —— 決まった＝塗り、まだ＝点線の枠だけ
const solid = (x, y, w, h, c, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
function dashed(x, y, w, h, c, r, sw, n) {
  const peri = 2 * (w + h) - 8 * r + 2 * Math.PI * r, seg = peri / n;
  return `<rect x="${x + sw / 2}" y="${y + sw / 2}" width="${w - sw}" height="${h - sw}" rx="${Math.max(0, r - sw / 2)}"`
    + ` fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="butt"`
    + ` stroke-dasharray="${(seg * 0.6).toFixed(1)} ${(seg * 0.4).toFixed(1)}"/>`;
}
const wrap = (bg, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">`
  + `<rect width="${N}" height="${N}" fill="${bg}"/>${inner}</svg>`;

// ---- 案 ----
// 帯を2本。塗りと点線を上下に。アプリが月表示で描いているものそのもの
const bars = (T, hue) => wrap(T.bg,
  solid(182, 372, 660, 152, hue, 40)
  + dashed(182, 570, 660, 152, hue, 40, 18, 15));

// マスを1つ切り出す。上の辺の線は「今日」の印（D1）
const oneCell = (T, hue) => wrap(T.bg,
  `<rect x="132" y="182" width="760" height="660" rx="34" fill="${T.cell}"/>`
  + `<rect x="132" y="182" width="760" height="14" rx="7" fill="${T.ink}"/>`
  + solid(186, 372, 652, 132, hue, 34)
  + dashed(186, 550, 652, 132, hue, 34, 16, 15));

// 月表示のかけら。2×2 のマスに、塗りとまだを置く
const fragment = (T) => {
  const x0 = 92, y0 = 172, w = 420, h = 340, g = 20;
  let s = '';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++)
    s += `<rect x="${x0 + c * (w + g)}" y="${y0 + r * (h + g)}" width="${w}" height="${h}" rx="18" fill="${T.cell}"/>`;
  const pill = (c, r, i, kind, hue) => {
    const x = x0 + c * (w + g) + 34, y = y0 + r * (h + g) + 118 + i * 106;
    return kind === 'k' ? solid(x, y, w - 68, 84, hue, 22) : dashed(x, y, w - 68, 84, hue, 22, 13, 11);
  };
  s += pill(0, 0, 0, 'k', HUE.baito) + pill(1, 0, 0, 'm', HUE.yoji)
     + pill(0, 1, 0, 'm', HUE.asobi) + pill(1, 1, 0, 'k', HUE.other);
  return wrap(T.bg, s);
};

// 大きく2つ。丸で「決まった／まだ」を言う
const twoDots = (T, hue) => wrap(T.bg,
  `<circle cx="368" cy="512" r="188" fill="${hue}"/>`
  + `<circle cx="700" cy="512" r="176" fill="none" stroke="${hue}" stroke-width="26" stroke-linecap="butt"`
  + ` stroke-dasharray="${((2 * Math.PI * 176) / 11 * 0.6).toFixed(1)} ${((2 * Math.PI * 176) / 11 * 0.4).toFixed(1)}"/>`);

// アプリの塗り方そのまま（暗い地では面を沈め、縁で色を持たせる）。忠実だが弱い
const faithful = (T, hue) => wrap(T.bg,
  `<rect x="182" y="372" width="660" height="152" rx="40" fill="${mix(hue, T.cell, 0.76)}" stroke="${hue}" stroke-width="6"/>`
  + dashed(182, 570, 660, 152, hue, 40, 18, 15));

const IDEAS = {
  'A｜いま（比べる用）': { src: true },
  // 型押しはそのまま、地だけ今回の冷たい色にする。作りは残して見た目をつなげる
  'J｜冷たい地に彫る': {
    shapes: [...slits(), ...grid(true)],
    o: { wall: 4, depth: 8, ao: 0.02, cast: 0.35, castBlur: 3.5, castDist: 12, smooth: 0.6, grain: 0.008,
         mode: 'core', ground: [18, 21, 26], core: [231, 235, 240] },
  },
  'K｜帯を2本・暗い地': { svg: bars(DARK, HUE.yoji) },
  'L｜マスを1つ・暗い地': { svg: oneCell(DARK, HUE.baito) },
  'M｜月のかけら・暗い地': { svg: fragment(DARK) },
  'N｜大きく2つ・暗い地': { svg: twoDots(DARK, HUE.baito) },
  'O｜帯を2本・明るい地': { svg: bars(LITE, HUE.yoji) },
  'P｜月のかけら・明るい地': { svg: fragment(LITE) },
  // アプリの暗い塗り方をそのまま持ってきた場合。面が沈むので、小さいと消える
  'Q｜アプリのままの塗り': { svg: faithful(DARK, HUE.yoji) },
};

// ---- 確かめ ----
const lum = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
async function measure(buf, px) {
  const { data, info } = await sharp(buf).resize(px, px, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const a = Math.floor(px * 0.2), b = Math.floor(px * 0.8);
  let mn = 255, mx = 0;
  for (let y = a; y < b; y++) for (let x = a; x < b; x++) { const v = data[y * info.width + x]; if (v < mn) mn = v; if (v > mx) mx = v; }
  return cr(mx, mn);
}
async function onWhite(buf) {
  const { data, info } = await sharp(buf).resize(87, 87, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return cr(data[(3 * info.width + 3) * info.channels], 255);
}

(async () => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const names = Object.keys(IDEAS);
  const bufs = {};
  for (const n of names) {
    const d = IDEAS[n];
    bufs[n] = d.src
      ? await sharp(`${__dirname}/icon-source.png`).resize(N, N, { fit: 'fill' }).flatten({ background: '#FDF7EC' }).png().toBuffer()
      : d.svg ? await sharp(Buffer.from(d.svg)).png().toBuffer()
      : await render(d.shapes, d.o);
  }

  console.log('中でいちばん明るいところと暗いところの差（実際に出る画素数で）と、白地での立ち方\n');
  for (const n of names) {
    const cells = [];
    for (const [place, pt, px] of SIZES) cells.push(`${place} ${(await measure(bufs[n], px)).toFixed(2)}`);
    console.log(`  ${n.padEnd(22)} ${cells.join('   ')}   白地 ${(await onWhite(bufs[n])).toFixed(2)}`);
  }

  const BIG = 236, PAD = 20, GAP = 24, LABEL = 24, STRIP = 132, COLN = 4;
  const rowH = LABEL + BIG + 8 + STRIP + 26;
  const comp = [];
  for (let idx = 0; idx < names.length; idx++) {
    const n = names[idx];
    const left = PAD + (idx % COLN) * (BIG + GAP), top = PAD + Math.floor(idx / COLN) * rowH;
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${BIG + GAP}" height="${LABEL}"><text x="0" y="15" font-family="${F}" font-size="12" font-weight="700" fill="#1E2024">${esc(n)}</text></svg>`), top, left });
    comp.push({ input: await sharp(bufs[n]).resize(BIG, BIG).png().toBuffer(), top: top + LABEL, left });
    comp.push({ input: await sharp({ create: { width: BIG, height: STRIP, channels: 3, background: '#FFFFFF' } }).png().toBuffer(), top: top + LABEL + BIG + 8, left });
    let x = 10;
    for (const [place, pt, px] of SIZES) {
      const disp = Math.round((px / 3) * 1.6);   // 見やすさのため 1.6 倍で置く（比率は保つ）
      comp.push({ input: await sharp(bufs[n]).resize(disp, disp).png().toBuffer(), top: top + LABEL + BIG + 26, left: left + x });
      comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${disp + 14}" height="16"><text x="0" y="12" font-family="${F}" font-size="9" fill="#6B7280">${esc(pt)}pt</text></svg>`), top: top + LABEL + BIG + 30 + disp, left: left + x });
      x += disp + 14;
    }
  }
  const rows = Math.ceil(names.length / COLN);
  await sharp({ create: { width: PAD * 2 + COLN * BIG + (COLN - 1) * GAP, height: PAD * 2 + rows * rowH, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile('../store-assets/icon-app.png');
  console.log('\nできた  store-assets/icon-app.png');
})();
