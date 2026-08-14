// 予定の画面（詳細）の下半分をどう組むか。実寸 375 幅で比べる。
// いまは「この予定を削除」が赤い字ひとつで宙に浮いていて、下は空白。
// ここにコピーを足すなら、置き場そのものを決め直したほうがいい。
// 実行: node tools/detail-actions.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;

const BG = '#F6F7F9', CARD = '#FFFFFF', LINE = '#E4E7EC', BG2 = '#EDEFF3';
const INK = '#1E2024', MUT = '#82878F', SOFT = '#4A4E55', FAINT = '#B3B8C0';
const RED = '#A8452B';
const YOJI = '#8B7AB8', YOJI_PAPER = '#D3CCE4', YOJI_DARK = '#2F293F', YOJI_SOFT = '#B0A5CF';

const W = 375;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, stroke) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${1 * S}"` : ''}/>`;

// 上の見出し。案によって中身が変わる
function head(title, right) {
  let o = t(18, 34, '←', 20, 400, MUT);
  if (title) o += t(W / 2, 34, title, 16, 400, INK, 'middle');
  if (right) o += t(W - 18, 34, right, right === '…' ? 22 : 16, 400, MUT, 'end');
  return o;
}

// 予定のカード（いまのまま）。返り値は下端の y
function card(y0) {
  const h = 170;
  let o = rect(16, y0, W - 32, h, CARD, 16, LINE);
  o += `<clipPath id="c${y0}"><rect x="${16 * S}" y="${y0 * S}" width="${(W - 32) * S}" height="${h * S}" rx="${16 * S}"/></clipPath>`;
  o += `<g clip-path="url(#c${y0})">`;
  o += rect(16, y0, 7, h, YOJI_PAPER) + rect(16, y0 + 46, 7, h - 46, YOJI_SOFT);
  o += `</g>`;
  o += `<circle cx="${(23 + 20 + 14) * S}" cy="${(y0 + 26) * S}" r="${13 * S}" fill="${YOJI}"/>`;
  o += t(23 + 34, y0 + 31, '✓', 13, 400, '#fff', 'middle');
  o += t(23 + 34 + 24, y0 + 31, '確定した用事', 13, 400, YOJI_DARK);
  o += t(38, y0 + 66, 'ダンス', 24, 300, INK);
  o += t(38, y0 + 88, '8月20日', 14, 400, MUT);
  o += t(38, y0 + 128, '17:00–18:00', 15, 400, INK);
  return o;
}
const CARD_H = 170;

// 行の束（iOS の設定のような並び）
function rows(y0, items) {
  const rh = 52;
  let o = rect(16, y0, W - 32, rh * items.length, CARD, 14, LINE);
  items.forEach((it, i) => {
    const y = y0 + rh * i;
    if (i) o += rect(17, y, W - 34, 0.7, LINE);
    o += t(it.mid ? W / 2 : 34, y + rh / 2 + 5, it.label, 15, 400, it.color || INK, it.mid ? 'middle' : null);
    if (!it.mid) o += t(W - 34, y + rh / 2 + 5, '›', 15, 400, FAINT, 'end');
  });
  return o;
}

const CASES = {};

// ---- いま ----
// タイトルが見出しとカードで2回。削除だけが赤い字で宙に浮いて、下は空白。
CASES['いま'] = () =>
  rect(0, 0, W, 560, BG) + head('ダンス', '編集') + card(62)
  + t(W / 2, 62 + CARD_H + 44, 'この予定を削除', 14, 400, RED, 'middle');

// ---- 案A：行の束にする ----
CASES['案A｜行の束'] = () =>
  rect(0, 0, W, 560, BG) + head('', 0) + card(50)
  + rows(50 + CARD_H + 20, [{ label: '編集' }, { label: 'コピー' }])
  + rows(50 + CARD_H + 20 + 104 + 14, [{ label: 'この予定を削除', color: RED, mid: true }]);

// ---- 案D：タイムツリー式。「…」の中にしまう ----
// 置いていないときの画面（ふだん見えているのはこれ）
CASES['案D｜…にしまう（閉）'] = () =>
  rect(0, 0, W, 560, BG) + head('', '…') + card(50);

// 開いたとき
CASES['案D｜…にしまう（開）'] = () => {
  let o = rect(0, 0, W, 560, BG) + head('', '…') + card(50);
  o += rect(0, 0, W, 560, 'rgba(20,20,22,.14)');
  const mw = 210, mx = W - 16 - mw, my = 44, rh = 52;
  o += rect(mx, my, mw, rh * 3, CARD, 13, LINE);
  ['編集', 'コピー', 'この予定を削除'].forEach((L, i) => {
    if (i) o += rect(mx + 1, my + rh * i, mw - 2, 0.7, LINE);
    o += t(mx + 18, my + rh * i + rh / 2 + 5, L, 15, 400, i === 2 ? RED : INK);
  });
  return o;
};

(async () => {
  const names = ['いま', '案A｜行の束', '案D｜…にしまう（閉）', '案D｜…にしまう（開）'];
  const SC = 1.15, GAP = 22, PAD = 18, LABEL = 26, H0 = 560;
  const imgs = [];
  for (const n of names) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H0 * S}">${CASES[n]()}</svg>`;
    imgs.push({ n, buf: await sharp(Buffer.from(svg)).resize(Math.round(W * SC)).png().toBuffer() });
  }
  const cw = Math.round(W * SC), ch = Math.round(H0 * SC);
  const TW = PAD * 2 + names.length * cw + (names.length - 1) * GAP;
  const TH = PAD * 2 + LABEL + ch;
  const comp = [];
  imgs.forEach((im, i) => {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc(im.n)}</text></svg>`), top: PAD, left });
    comp.push({ input: im.buf, top: PAD + LABEL, left });
  });
  await sharp({ create: { width: TW, height: TH, channels: 3, background: '#DDE1E8' } })
    .composite(comp).png().toFile('../store-assets/detail-actions.png');
  console.log('できた');
})();
