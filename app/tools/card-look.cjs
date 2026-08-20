// サポーターカードの地紋（案B＝予定の地紋）を、3つの段すべてで見る。
// 実寸 335×211（画面幅375のとき）。実行: node tools/card-look.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;
const W = 335, H = 211, R = 18, PX = 22, PY = 20;

// App.jsx の CARD_TIERS と同じ値。地紋の濃さだけ段ごとに変える——
// 黒い紙の上の金は、明るい紙の上の墨より沈む。同じ数字では見えない。
const TIERS = [
  { key: 'normal', name: 'NORMAL', yen: '¥600', times: '2回',
    paper: ['#F3EEE2', '#E7DFCE', '#F3EEE2'], foil: '#6B582F', mark: '#C8BFA6',
    edge: 'rgba(107,88,47,.3)', op: 0.075, ruleOp: 0.30 },
  { key: 'gold', name: 'GOLD', yen: '¥1,600', times: '3回',
    paper: ['#FDF6D6', '#D9B85F', '#F7E8AC', '#C9A544', '#F2DE9B'], foil: '#513706', mark: '#A9862C',
    edge: 'rgba(81,55,6,.44)', op: 0.06, ruleOp: 0.30 },
  { key: 'black', name: 'BLACK', yen: '¥3,600', times: '5回',
    paper: ['#2B2823', '#1B1915', '#2B2823'], foil: '#D8BC72', mark: '#7C6E4C',
    edge: 'rgba(216,188,114,.38)', op: 0.13, ruleOp: 0.34 },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;

// 地紋を置く帯。見出し（上）と名前・金額（下）にはかぶせない
const BAND_T = 58, BAND_B = 148;

// このアプリの地紋。カレンダーの升目に、塗りのピルと点線のピルを並べる。
// 散らすとゴミに見えたので、7列の週として整列させている。
// どの升に何を置くかは決め打ち——毎回変わると、模様ではなく雑音になる。
const MAP = [
  [1, 0, 2, 1, 0, 1, 2],
  [0, 1, 1, 0, 2, 1, 0],
  [2, 1, 0, 1, 1, 0, 1],
  [0, 2, 1, 1, 0, 1, 0],
];
function pills(foil, op) {
  const COLS = 7, ROWS = MAP.length;
  const gutter = 5, x0 = 16, cw = (W - x0 * 2 + gutter) / COLS, pw = cw - gutter, ph = 8;
  const rh = (BAND_B - BAND_T) / ROWS;
  let o = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const kind = MAP[r][c];
      if (!kind) continue;
      const x = x0 + c * cw, y = BAND_T + r * rh + (rh - ph) / 2;
      o += kind === 1
        ? `<rect x="${x * S}" y="${y * S}" width="${pw * S}" height="${ph * S}" rx="${2.5 * S}" fill="${foil}" opacity="${op}"/>`
        : `<rect x="${(x + 0.5) * S}" y="${(y + 0.5) * S}" width="${(pw - 1) * S}" height="${(ph - 1) * S}" rx="${2 * S}" fill="none" stroke="${foil}" stroke-width="${0.9 * S}" stroke-dasharray="${2.2 * S} ${1.8 * S}" opacity="${op * 1.7}"/>`;
    }
  }
  return o;
}

const rule = (foil, inset, op) =>
  `<rect x="${inset * S}" y="${inset * S}" width="${(W - inset * 2) * S}" height="${(H - inset * 2) * S}" rx="${(R - inset * 0.7) * S}" fill="none" stroke="${foil}" stroke-width="${0.75 * S}" opacity="${op}"/>`;

function card(T, i) {
  const stops = T.paper.map((c, k) => `<stop offset="${(k * 100) / (T.paper.length - 1)}%" stop-color="${c}"/>`).join('');
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">
    <defs><linearGradient id="p${i}" x1="0" y1="0" x2="0.87" y2="0.5">${stops}</linearGradient>
    <clipPath id="c${i}"><rect x="0" y="0" width="${W * S}" height="${H * S}" rx="${R * S}"/></clipPath></defs>
    <g clip-path="url(#c${i})">
      <rect x="0" y="0" width="${W * S}" height="${H * S}" fill="url(#p${i})"/>
      ${pills(T.foil, T.op)}
      ${rule(T.foil, 9, T.ruleOp)}
    </g>
    <rect x="${0.5 * S}" y="${0.5 * S}" width="${(W - 1) * S}" height="${(H - 1) * S}" rx="${R * S}" fill="none" stroke="${T.edge}" stroke-width="${1 * S}"/>`;
  o += t(PX, PY + 15, '決まってる？', 17, 400, T.foil);
  o += t(PX, PY + 31, 'SUPPORTER', 10, 700, T.foil, null, 1.4);
  // 右上は段の名前。前は「✓ ?」で、消し忘れの文字に見えた。
  // 色は mark（薄い箔）ではなく、箔そのものを 0.65 に薄めたもの。
  // mark だと NORMAL でコントラスト 1.4 しかなく、ほぼ見えなかった。
  // 0.65 なら、どの段でも 2.6〜4.7 に収まる（ラベルとして丁度いい濃さ）。
  o += `<g opacity="0.65">` + t(W - PX, PY + 14, T.name, 11, 700, T.foil, 'end', 1.6) + `</g>`;
  o += t(PX, H - PY - 14, 'いわき かいと', 15, 400, T.foil);
  o += t(PX, H - PY - 1, 'MEMBER SINCE 2026.06', 10, 700, T.foil, null, 1.2);
  o += t(W - PX, H - PY - 6, T.yen, 30, 300, T.foil, 'end');
  return o + '</svg>';
}

(async () => {
  const SC = 1.6, GAP = 26, PAD = 20, LABEL = 26;
  const imgs = [];
  for (let i = 0; i < TIERS.length; i++) {
    imgs.push({ n: `${TIERS[i].name}（地紋 ${Math.round(TIERS[i].op * 1000) / 10}%）`,
      buf: await sharp(Buffer.from(card(TIERS[i], i))).resize(Math.round(W * SC)).png().toBuffer() });
  }
  const cw = Math.round(W * SC), ch = Math.round(H * SC);
  const comp = [];
  imgs.forEach((im, i) => {
    const top = PAD + i * (ch + GAP + LABEL);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc(im.n)}</text></svg>`), top, left: PAD });
    comp.push({ input: im.buf, top: top + LABEL, left: PAD });
  });
  await sharp({ create: { width: PAD * 2 + cw, height: PAD * 2 + imgs.length * (ch + GAP + LABEL), channels: 3, background: '#DDE1E8' } })
    .composite(comp).png().toFile('../store-assets/card-look.png');
  console.log('できた');
})();
