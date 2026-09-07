// App Store に登録する5枚を組む。1290×2796（6.9インチ）。
//
// **中の画面は本物のキャプチャ。** 描いた UI は使わない。
// 生成した画面をそのまま出すと、実際のアプリと違うものになり審査で弾かれる
// （store-assets/app-store-metadata.md にも同じことが書いてある）。
// ここが描くのは地と見出しだけで、板の中身は make-shots.mjs が撮ったもの。
//
// 見た目の作りは tools/hero2.cjs と同じ考え方:
//  ・見出しの「決まった」に実線、「まだ」に点線を引く。
//    宣伝の文字そのものが、アプリの決まりを説明している状態にする。
//  ・地は無地にせず、光源を左上に置いた面にする。細い格子と粒子を敷く。
//  ・板（画面）は下を地へ霞ませて終わらせる。ぶつ切りは「切り忘れ」に見える。
//
// 色は styles.css の明るい方から採る。小さい字だけ濃くしてある
// （地に対して 2.5 しかないと、実寸でも読みにくい）。
//
// 手順:
//   1. npm --prefix app run build && プレビューを立てる
//   2. node app/tools/make-shots.mjs http://localhost:5173/   ← 素のキャプチャ
//   3. node app/tools/store-cards.cjs                          ← これ
const sharp = require('sharp');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;                       // 430×932 の3倍 ＝ 1290×2796
const W = 430, H = 932;
const SRC = join(__dirname, '..', '..', 'store-assets', 'screenshots-6.9');
const OUT = join(__dirname, '..', '..', 'store-assets', 'store-cards-6.9');

// styles.css の明るい方
const CELL = '#FFFFFF', INK = '#1E2024';
const SMALL = '#666C74';           // 小さい字。地に対して 4.9
// 地のグラデーション。3段用意して、実寸で見て決める。
// 色は足さない（アプリに無い色を宣伝に出さないため）。変えるのは明暗の幅だけ。
// 強くすると「作った面」に見えるが、一覧の小さい絵では濁りやすい。
const GRADS = [
  { name: '弱（いま）', bg: ['#FFFFFF', '#F4F6F9', '#E6EAEF'], bloom: 0 },
  { name: '中', bg: ['#FFFFFF', '#EDF0F5', '#D7DDE7'], bloom: 0.5 },
  { name: '強', bg: ['#FFFFFF', '#E6EBF3', '#C2CCDB'], bloom: 0.9 },
  // 光を見出しの側（左上のすみ）へ寄せ、地の一番上を白から少し落とす。
  // 強くすると板の上の辺が地に溶けて消える（測ると 1.002）ので、光を板から外す
  { name: '深い（光は上に）', bg: ['#F6F8FC', '#E9EDF4', '#CFD7E3'], bloom: 0.9, high: true },
];
const LV = Math.max(0, Math.min(GRADS.length - 1, Number(process.argv[2] ?? 1)));
const BG = GRADS[LV].bg, BLOOM = GRADS[LV].bloom, HIGH = !!GRADS[LV].high;
const GRID = '#6B7A90', DOT = '#41474F', EDGE = '#8A93A3';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, op) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => `#${hexRgb(a).map((v, i) => Math.round(v * k + hexRgb(b)[i] * (1 - k)).toString(16).padStart(2, '0')).join('')}`;

// 文字の幅を測る。下線を引くのに要る——長さを勘で決めると必ずずれる
const wide = (ch) => {
  if (/[　-鿿＀-￯]/.test(ch)) return 1;
  if (ch === ' ') return 0.26;
  if (/[.,;:'’!|]/.test(ch)) return 0.28;
  if (/[A-Z]/.test(ch)) return 0.63;
  return 0.55;
};
const tw = (s, size) => [...s].reduce((a, c) => a + wide(c), 0) * size;

function ground() {
  let o = `<defs>
    <radialGradient id="bg" cx="18%" cy="10%" r="105%">
      <stop offset="0%" stop-color="${BG[0]}"/><stop offset="55%" stop-color="${BG[1]}"/><stop offset="100%" stop-color="${BG[2]}"/>
    </radialGradient>
    <filter id="sh" x="-40%" y="-40%" width="180%" height="200%">
      <feDropShadow dx="0" dy="${6 * S}" stdDeviation="${9 * S}" flood-color="#4A5260" flood-opacity="0.20"/>
    </filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${60 * S}"/></filter>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG[2]}" stop-opacity="0"/><stop offset="100%" stop-color="${BG[2]}" stop-opacity="1"/>
    </linearGradient>
  </defs>`;
  o += rect(0, 0, W, H, 'url(#bg)');
  // 左上の光。radialGradient だけだと平らなので、白い玉をぼかして重ねる
  if (BLOOM) o += `<ellipse cx="${(HIGH ? 0.10 : 0.18) * W * S}" cy="${(HIGH ? 0.02 : 0.06) * H * S}" rx="${(HIGH ? 0.52 : 0.72) * W * S}" ry="${(HIGH ? 0.20 : 0.42) * H * S}" fill="#FFFFFF" opacity="${0.5 * BLOOM}" filter="url(#soft)"/>`;
  for (let x = 0; x <= W; x += 40) o += rect(x, 0, 0.5, H, GRID, 0, 0.06);
  for (let y = 0; y <= H; y += 40) o += rect(0, y, W, 0.5, GRID, 0, 0.048);
  // 粒子。決め打ちの位置で、走るたびに変わらないように
  const rnd = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 420; i += 1) {
    o += rect(rnd(i * 2 + 1) * W, rnd(i * 2 + 2) * H, 0.9, 0.9, i % 2 ? DOT : BG[2], 0, 0.05);
  }
  return o;
}

/** 見出しの語に線を引く。solid=実線／dashed=点線。アプリの決まりをそのまま使う */
function headline(x, y, parts, size, solid) {
  const [pre, key, post] = parts;
  let o = t(x, y, pre + key + post, size, 250, INK, null, -0.5);
  if (key) {
    const kx = x + tw(pre, size), kw = tw(key, size), ly = y + size * 0.3;
    o += solid
      ? rect(kx, ly, kw, 2, INK, 1)
      : `<line x1="${kx * S}" y1="${(ly + 1) * S}" x2="${(kx + kw) * S}" y2="${(ly + 1) * S}" stroke="${mix(INK, CELL, 0.55)}" stroke-width="${2 * S}" stroke-dasharray="${4 * S} ${3.5 * S}" stroke-linecap="round" opacity=".8"/>`;
  }
  return o;
}

// 5枚。見出しは1行につき [前, 線を引く語, 後]。線を引かない行は語を空にする
const CARDS = [
  { file: 'card-1', src: 'ss-1-month.png',
    eyebrow: 'まだ決まっていない予定の、カレンダー',
    lines: [[['', '決まった', '予定と、'], true], [['', 'まだ', 'の予定。'], false]], size: 32 },
  // 見出しは画面に写っている字をなぞらない。ダイアログの文言は絵の中に出ているので、
  // ここでは**何が起きるか**を言う（点線が塗りに変わる）
  { file: 'card-2', src: 'ss-6-dialog.png',
    lines: [[['点線が、塗りに変わる。', '', ''], null], [['その一瞬だけ、聞きます。', '', ''], null]], size: 28 },
  { file: 'card-3', src: 'ss-2-wage.png',
    lines: [[['給料は、', '', ''], null], [['見たいときだけ。', '', ''], null]], size: 30 },
  // まとめ（合計と棒）は落とした。シフトのアプリならどれでも持っている画面で、
  // 3枚目と同じ「バイトと給料」の話。5枚のうち2枚を同じ機能に使わない
  { file: 'card-4', src: 'ss-3-free.png',
    lines: [[['予定から、', '', ''], null], [['空きを自動で出す。', '', ''], null]], size: 30 },
  // 4と5で対にする。先に用意されていて、あとから画像1枚で渡す
  { file: 'card-5', src: 'ss-4-share.png',
    lines: [[['「いつ空いてる？」に、', '', ''], null], [['画像1枚で答える。', '', ''], null]], size: 28 },
];

(async () => {
  mkdirSync(OUT, { recursive: true });
  const DX = 30, DW = W - DX * 2, R = 26;
  const DH = Math.round(DW * (H / W));      // 画面の比を保つ。下は画面外へ流す
  // 板の中、画面の上に空ける帯。実機なら時計や電池が出ている場所で、
  // アプリの地はその下まで続いている。**その地の色をそのまま上へ伸ばす**
  // （帯を白で塗ると継ぎ目が出るし、時計を描き足すと嘘になる）。
  // 実機の割合そのまま（50）だと空きすぎたので詰めた。argv[3] で変えられる
  const BAND = Number(process.argv[3] ?? 32);

  for (const c of CARDS) {
    const top = c.eyebrow ? 250 : 236;
    let o = ground();
    if (c.eyebrow) o += t(DX + 4, 92, c.eyebrow, 10, 700, SMALL, null, 1.8);
    let y = c.eyebrow ? 152 : 140;
    for (const [parts, solid] of c.lines) {
      o += headline(DX + 4, y, parts, c.size, solid === true);
      y += c.size * 1.34;
    }
    // 板の影と縁。中身はあとで重ねる
    o += `<g filter="url(#sh)">${rect(DX, top, DW, DH, CELL, R)}</g>`;
    const under = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`;

    // 画面はそのままの比で置き、上に帯を足してから丸角で切り抜く
    const meta = await sharp(join(SRC, c.src)).metadata();
    const band = await sharp(join(SRC, c.src))
      .extract({ left: 0, top: 0, width: meta.width, height: 1 })   // 画面の一番上の行
      .resize(DW * S, BAND * S, { fit: 'fill' }).png().toBuffer();
    const inner = await sharp(join(SRC, c.src))
      .resize(DW * S, Math.round(DW * (H / W)) * S, { fit: 'fill' }).png().toBuffer();
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${DW * S}" height="${DH * S}"><rect width="${DW * S}" height="${DH * S}" rx="${R * S}" fill="#fff"/></svg>`);
    const screen = await sharp({ create: { width: DW * S, height: DH * S, channels: 4, background: '#FFFFFF' } })
      .composite([{ input: band, top: 0, left: 0 }, { input: inner, top: BAND * S, left: 0 }, { input: mask, blend: 'dest-in' }])
      .png().toBuffer();

    // 縁の線と、下の霞み。板の上に重ねる
    const over = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">`
      + `<rect x="${(DX + 0.5) * S}" y="${(top + 0.5) * S}" width="${(DW - 1) * S}" height="${(DH - 1) * S}" rx="${R * S}" fill="none" stroke="${EDGE}" stroke-width="${1 * S}" opacity=".18"/>`
      + `<defs><linearGradient id="f2" x1="0" y1="0" x2="0" y2="1">`
      + `<stop offset="0%" stop-color="${BG[2]}" stop-opacity="0"/><stop offset="100%" stop-color="${BG[2]}" stop-opacity="1"/></linearGradient></defs>`
      + `<rect x="0" y="${(H - 130) * S}" width="${W * S}" height="${130 * S}" fill="url(#f2)"/></svg>`;

    await sharp(Buffer.from(under))
      .composite([{ input: screen, top: top * S, left: DX * S }, { input: Buffer.from(over) }])
      .png().toFile(join(OUT, `${c.file}.png`));
    console.log('書いた', `${c.file}.png`, `${W * S}×${H * S}`, '←', c.src);
  }

  // 並べて見る用の1枚（cmp のときは3段を並べる）
  const SC = 0.17, PAD = 16, GAP = 14, LABEL = 22;
  const cw = Math.round(W * S * SC), ch = Math.round(H * S * SC);
  const comp = [];
  for (let i = 0; i < CARDS.length; i += 1) {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="15" font-family="${F}" font-size="12" font-weight="700" fill="#1E2024">${i + 1}枚目</text></svg>`), top: PAD, left });
    comp.push({ input: await sharp(join(OUT, `${CARDS[i].file}.png`)).resize(cw).png().toBuffer(), top: PAD + LABEL, left });
  }
  await sharp({ create: { width: PAD * 2 + CARDS.length * cw + (CARDS.length - 1) * GAP, height: PAD * 2 + LABEL + ch, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile(join(__dirname, '..', '..', 'store-assets', 'store-cards.png'));
  console.log('\n並べたもの store-assets/store-cards.png');
})();
