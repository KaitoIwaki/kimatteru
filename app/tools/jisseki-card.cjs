// 実績（働いた記録）の画面。いま何行あるか、どこまで減らせるか。
// 実寸 375 幅。実行: node tools/jisseki-card.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;

const BG = '#F6F7F9', CARD = '#FFFFFF', LINE = '#E4E7EC';
const INK = '#1E2024', MUT = '#82878F', FAINT = '#B3B8C0';
const RED = '#A8452B', ORANGE = '#D85A30';
const G = '#7FAE85', G_PAPER = '#CEE0D1', G_DARK = '#2B3B2D', G_SOFT = '#A8C8AC';

const W = 375, X = 38;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, stroke) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${1 * S}"` : ''}/>`;

// カードの枠と、左の緑の帯
function shell(y0, h, id) {
  let o = rect(16, y0, W - 32, h, CARD, 16, LINE);
  o += `<clipPath id="k${id}"><rect x="${16 * S}" y="${y0 * S}" width="${(W - 32) * S}" height="${h * S}" rx="${16 * S}"/></clipPath>`;
  o += `<g clip-path="url(#k${id})">` + rect(16, y0, 7, h, G_PAPER) + rect(16, y0 + 46, 7, h - 46, G_SOFT) + `</g>`;
  o += `<circle cx="${57 * S}" cy="${(y0 + 27) * S}" r="${13 * S}" fill="${G}"/>` + t(57, y0 + 32, '✓', 13, 400, '#fff', 'middle');
  o += t(81, y0 + 32, '実績', 13, 400, G_DARK);
  o += t(X, y0 + 68, 'マクド', 24, 300, INK);
  o += t(X, y0 + 90, '8月6日', 14, 400, MUT);
  return o;
}

// 下の操作。green=true なら緑のボタンを出す
function actions(y0, green) {
  let o = '', y = y0;
  if (green) {
    o += rect(16, y, W - 32, 54, G_PAPER, 14, G);
    o += t(W / 2, y + 33, '働いた時間を直す', 16, 400, G_DARK, 'middle');
    y += 54 + 16;
  }
  const rows = green ? ['編集'] : ['働いた時間を直す', '編集'];
  o += rect(16, y, W - 32, 52 * rows.length, CARD, 14, LINE);
  rows.forEach((L, i) => {
    if (i) o += rect(17, y + 52 * i, W - 34, 0.7, LINE);
    o += t(34, y + 52 * i + 31, L, 15, 400, INK) + t(W - 34, y + 52 * i + 31, '›', 15, 400, FAINT, 'end');
  });
  y += 52 * rows.length + 14;
  o += rect(16, y, W - 32, 52, CARD, 14, LINE) + t(W / 2, y + 31, 'この実績を削除', 15, 400, RED, 'middle');
  return o;
}

const CASES = {};

// ---- いま ----
// 時間の話が4か所に散っている（実際の時刻／変更あり／希望／休憩）。
// そのうえ「働いた時間を直す」と「編集」が両方ある。
CASES['いま'] = () => {
  const y0 = 50, h = 276;
  let o = rect(0, 0, W, 700, BG) + t(18, 34, '←', 20, 400, MUT) + shell(y0, h, 1);
  o += t(X, y0 + 130, '17:00–00:35', 15, 400, INK);
  o += t(X + 92, y0 + 130, '→ 変更あり', 12, 400, ORANGE);
  o += t(X, y0 + 147, '希望 17:00–00:00', 12, 400, MUT);
  o += rect(X, y0 + 169, W - 32 - 44, 1, LINE);
  o += t(X, y0 + 196, '実働時間', 13, 400, MUT) + t(W - X, y0 + 196, '6時間35分', 15, 400, INK, 'end');
  o += t(W - X, y0 + 211, '休憩 60分を引いています', 11, 400, FAINT, 'end');
  o += t(X, y0 + 246, '給料', 13, 400, MUT) + t(W - X, y0 + 250, '¥7,387', 24, 300, INK, 'end');
  return o + actions(y0 + h + 16, true);
};

// ---- 案1：金額を主役に。根拠は下に小さく畳む ----
CASES['案1｜金額を主役に'] = () => {
  const y0 = 50, h = 214;
  let o = rect(0, 0, W, 700, BG) + t(18, 34, '←', 20, 400, MUT) + shell(y0, h, 2);
  o += rect(X, y0 + 110, W - 32 - 44, 1, LINE);
  o += t(X, y0 + 152, '¥7,387', 34, 300, INK);
  o += t(X, y0 + 174, '6時間35分　17:00–00:35', 14, 400, MUT);
  o += t(X, y0 + 191, '休憩60分をひいて、希望より35分ながい', 11, 400, FAINT);
  return o + actions(y0 + h + 20, false);
};

// ---- 案2：表は残す。時間の話だけ1行にまとめる ----
CASES['案2｜表は残す'] = () => {
  const y0 = 50, h = 244;
  let o = rect(0, 0, W, 700, BG) + t(18, 34, '←', 20, 400, MUT) + shell(y0, h, 3);
  o += t(X, y0 + 130, '17:00–00:35', 15, 400, INK);
  o += t(X, y0 + 147, '希望より35分ながい', 11, 400, FAINT);
  o += rect(X, y0 + 167, W - 32 - 44, 1, LINE);
  o += t(X, y0 + 194, '実働時間', 13, 400, MUT) + t(W - X, y0 + 194, '6時間35分', 15, 400, INK, 'end');
  o += t(X, y0 + 209, '休憩60分をひく', 11, 400, FAINT);
  o += t(X, y0 + 218 + 22, '給料', 13, 400, MUT) + t(W - X, y0 + 218 + 26, '¥7,387', 24, 300, INK, 'end');
  return o + actions(y0 + h + 20, false);
};

(async () => {
  const names = ['いま', '案1｜金額を主役に', '案2｜表は残す'];
  const SC = 1.3, GAP = 26, PAD = 18, LABEL = 26, H0 = 700;
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
    .composite(comp).png().toFile('../store-assets/jisseki-card.png');
  console.log('できた');
})();
