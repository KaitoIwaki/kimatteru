// 用事の画面。操作を「···」にしまったあと、下が空いた。何で埋めるか。
// 実寸 375 幅。実行: node tools/detail-empty.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;

const BG = '#F6F7F9', CARD = '#FFFFFF', LINE = '#E4E7EC', LINE_F = '#F1F3F6';
const INK = '#1E2024', SOFT = '#4A4E55', MUT = '#82878F', FAINT = '#B3B8C0';
const T = { yoji: '#8B7AB8', baito: '#7FAE85' };
const FILL = { yoji: '#B0A5CF', baito: '#A8C8AC' };
const PAPER = { yoji: '#D3CCE4', baito: '#CEE0D1' };
const INK_ON = { yoji: '#2F293F', baito: '#2B3B2D' };
const Y_PAPER = '#D3CCE4', Y_SOFT = '#B0A5CF', Y = '#8B7AB8', Y_DARK = '#2F293F';

const W = 375, X = 38, H0 = 700;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, stroke) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${1 * S}"` : ''}/>`;

function head() {
  return t(18, 34, '←', 20, 400, MUT)
    + t(W - 18, 32, '···', 20, 400, MUT, 'end');
}

// 予定のカード。tall なら中身のあいだを広げる
function card(y0, id, tall) {
  const h = tall ? 226 : 170, g = tall ? 22 : 0;
  let o = rect(16, y0, W - 32, h, CARD, 16, LINE);
  o += `<clipPath id="k${id}"><rect x="${16 * S}" y="${y0 * S}" width="${(W - 32) * S}" height="${h * S}" rx="${16 * S}"/></clipPath>`;
  o += `<g clip-path="url(#k${id})">` + rect(16, y0, 7, h, Y_PAPER) + rect(16, y0 + 46, 7, h - 46, Y_SOFT) + `</g>`;
  o += `<circle cx="${57 * S}" cy="${(y0 + 27) * S}" r="${13 * S}" fill="${Y}"/>` + t(57, y0 + 32, '✓', 13, 400, '#fff', 'middle');
  o += t(81, y0 + 32, '確定した用事', 13, 400, Y_DARK);
  o += t(X, y0 + 68 + g * 0.3, 'ダンス', tall ? 27 : 24, 300, INK);
  o += t(X, y0 + 90 + g * 0.3, '8月20日（木）', 14, 400, MUT);
  o += t(X, y0 + 130 + g, '17:00–18:00', tall ? 17 : 15, 400, INK);
  return { svg: o, bottom: y0 + h };
}

// その日のほかの予定。ピルはカレンダーと同じ描き方（塗り＝確定、点線＝まだ）
function pill(x, y, w, type, solid, label) {
  const h = 24, r = 5;
  const box = solid
    ? rect(x, y, w, h, FILL[type], r)
    : `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" fill="${PAPER[type]}" stroke="${T[type]}" stroke-width="${1.5 * S}" stroke-dasharray="${3.5 * S} ${3 * S}"/>`;
  return box + t(x + 9, y + 16, label, 12, 400, INK_ON[type]);
}

const CASES = {};

// ---- いま ----
CASES['いま（空いている）'] = () => {
  const c = card(50, 1);
  return rect(0, 0, W, H0, BG) + head() + c.svg;
};

// ---- 案1：その日のほかの予定 ----
CASES['案1｜その日のほかの予定'] = () => {
  const c = card(50, 2);
  let o = rect(0, 0, W, H0, BG) + head() + c.svg;
  let y = c.bottom + 30;
  o += t(X - 6, y, '8月20日の、ほかの予定', 12, 400, MUT);
  y += 14;
  o += rect(16, y, W - 32, 24 + 34 * 2 + 6, CARD, 14, LINE);
  y += 16;
  o += t(X - 6, y + 12, '19:00', 12, 400, FAINT);
  o += pill(X + 38, y, 200, 'baito', 1, 'マクド');
  y += 34;
  o += rect(X - 6, y - 5, W - 2 * (X - 6), 0.7, LINE_F);
  o += t(X - 6, y + 12, '終日', 12, 400, FAINT);
  o += pill(X + 38, y, 200, 'yoji', 0, 'ゼミ合宿');
  return o;
};

// ---- 案1'：ほかに予定が無い日 ----
CASES["案1'｜ほかに無い日"] = () => {
  const c = card(50, 3);
  let o = rect(0, 0, W, H0, BG) + head() + c.svg;
  const y = c.bottom + 30;
  o += t(X - 6, y, '8月20日の、ほかの予定', 12, 400, MUT);
  o += rect(16, y + 14, W - 32, 56, CARD, 14, LINE);
  o += t(W / 2, y + 47, 'この日は、これだけです', 14, 400, MUT, 'middle');
  return o;
};

// ---- 案2：カードを大きくするだけ ----
CASES['案2｜カードを大きく'] = () => {
  const c = card(50, 4, true);
  return rect(0, 0, W, H0, BG) + head() + c.svg;
};

(async () => {
  const names = ['いま（空いている）', '案1｜その日のほかの予定', "案1'｜ほかに無い日", '案2｜カードを大きく'];
  const SC = 1.15, GAP = 24, PAD = 18, LABEL = 26;
  const imgs = [];
  for (const n of names) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H0 * S}">${CASES[n]()}</svg>`;
    imgs.push({ n, buf: await sharp(Buffer.from(svg)).resize(Math.round(W * SC)).png().toBuffer() });
  }
  const cw = Math.round(W * SC), ch = Math.round(H0 * SC);
  const TW = PAD * 2 + names.length * cw + (names.length - 1) * GAP;
  const comp = [];
  imgs.forEach((im, i) => {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc(im.n)}</text></svg>`), top: PAD, left });
    comp.push({ input: im.buf, top: PAD + LABEL, left });
  });
  await sharp({ create: { width: TW, height: PAD * 2 + LABEL + ch, channels: 3, background: '#DDE1E8' } })
    .composite(comp).png().toFile('../store-assets/detail-empty.png');
  console.log('できた');
})();
