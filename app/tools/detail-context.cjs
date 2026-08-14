// 用事の画面の下に、①同じ予定の履歴 と ②その日のほかの予定 を置く案。
// どちらも「書かなくても出る」ので、空白が確実に埋まる。
// 予定が1件だけの日は②が縮み、はじめての予定なら①が縮む——互いの空を埋め合う。
// 実寸 375 幅。実行: node tools/detail-context.cjs
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

const W = 375, X = 32, H0 = 760;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, stroke) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${1 * S}"` : ''}/>`;

const head = () => t(18, 34, '←', 20, 400, MUT) + t(W - 18, 32, '···', 20, 400, MUT, 'end');

function card(y0, id) {
  const h = 170;
  let o = rect(16, y0, W - 32, h, CARD, 16, LINE);
  o += `<clipPath id="k${id}"><rect x="${16 * S}" y="${y0 * S}" width="${(W - 32) * S}" height="${h * S}" rx="${16 * S}"/></clipPath>`;
  o += `<g clip-path="url(#k${id})">` + rect(16, y0, 7, h, Y_PAPER) + rect(16, y0 + 46, 7, h - 46, Y_SOFT) + `</g>`;
  o += `<circle cx="${57 * S}" cy="${(y0 + 27) * S}" r="${13 * S}" fill="${Y}"/>` + t(57, y0 + 32, '✓', 13, 400, '#fff', 'middle');
  o += t(81, y0 + 32, '確定した用事', 13, 400, Y_DARK);
  o += t(38, y0 + 68, 'ダンス', 24, 300, INK);
  o += t(38, y0 + 90, '8月20日（木）', 14, 400, MUT);
  o += t(38, y0 + 130, '17:00–18:00', 15, 400, INK);
  return { svg: o, bottom: y0 + h };
}

const label = (y, s) => t(X, y, s, 12, 400, MUT);

function pill(x, y, w, type, solid, text) {
  const h = 24, r = 5;
  const box = solid
    ? rect(x, y, w, h, FILL[type], r)
    : `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" fill="${PAPER[type]}" stroke="${T[type]}" stroke-width="${1.5 * S}" stroke-dasharray="${3.5 * S} ${3 * S}"/>`;
  return box + t(x + 9, y + 16, text, 12, 400, INK_ON[type]);
}

// ② その日のほかの予定
function others(y0, list) {
  let o = label(y0, '8月20日の、ほかの予定');
  const y = y0 + 14;
  if (!list.length) {
    o += rect(16, y, W - 32, 54, CARD, 14, LINE);
    o += t(W / 2, y + 33, 'この日は、これだけです', 14, 400, MUT, 'middle');
    return { svg: o, bottom: y + 54 };
  }
  const h = 14 + list.length * 34;
  o += rect(16, y, W - 32, h, CARD, 14, LINE);
  list.forEach((it, i) => {
    const ry = y + 12 + i * 34;
    if (i) o += rect(X, ry - 5, W - X * 2, 0.7, LINE_F);
    o += t(X + 4, ry + 16, it[0], 12, 400, FAINT);
    o += pill(X + 46, ry, 205, it[1], it[2], it[3]);
  });
  return { svg: o, bottom: y + h };
}

// ① 同じ名前の予定の履歴。この予定が何回目かで言う（先の予定も混ざらない）
function history(y0, times) {
  let o = label(y0, 'これまでの「ダンス」');
  const y = y0 + 14;
  if (!times) {
    o += rect(16, y, W - 32, 54, CARD, 14, LINE);
    o += t(W / 2, y + 33, 'これが、はじめてです', 14, 400, MUT, 'middle');
    return { svg: o, bottom: y + 54 };
  }
  const h = 92;
  o += rect(16, y, W - 32, h, CARD, 14, LINE);
  o += t(X + 4, y + 32, '今年 18回目', 15, 400, INK);
  o += t(X + 4 + 96, y + 32, '今月 4回目', 15, 400, SOFT);
  o += rect(X, y + 46, W - X * 2, 0.7, LINE_F);
  o += t(X + 4, y + 72, '前回', 13, 400, MUT);
  o += t(X + 4 + 42, y + 72, '8月13日（木）', 13, 400, INK);
  o += t(W - X - 4, y + 72, '7日前', 12, 400, FAINT, 'end');
  return { svg: o, bottom: y + h };
}

const CASES = {};

CASES['いま（空いている）'] = () => rect(0, 0, W, H0, BG) + head() + card(50, 1).svg;

CASES['①＋②｜ふつうの日'] = () => {
  const c = card(50, 2);
  const a = others(c.bottom + 30, [['19:00', 'baito', 1, 'マクド'], ['終日', 'yoji', 0, 'ゼミ合宿']]);
  const b = history(a.bottom + 26, true);
  return rect(0, 0, W, H0, BG) + head() + c.svg + a.svg + b.svg;
};

CASES['①＋②｜ほかに予定が無い日'] = () => {
  const c = card(50, 3);
  const a = others(c.bottom + 30, []);
  const b = history(a.bottom + 26, true);
  return rect(0, 0, W, H0, BG) + head() + c.svg + a.svg + b.svg;
};

CASES['①＋②｜はじめての予定'] = () => {
  const c = card(50, 4);
  const a = others(c.bottom + 30, [['19:00', 'baito', 1, 'マクド']]);
  const b = history(a.bottom + 26, false);
  return rect(0, 0, W, H0, BG) + head() + c.svg + a.svg + b.svg;
};

(async () => {
  const names = ['いま（空いている）', '①＋②｜ふつうの日', '①＋②｜ほかに予定が無い日', '①＋②｜はじめての予定'];
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
    .composite(comp).png().toFile('../store-assets/detail-context.png');
  console.log('できた');
})();
