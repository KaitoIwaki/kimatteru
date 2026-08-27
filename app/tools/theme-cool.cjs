// 月表示を「クール系」に振ったらどうなるか。実寸 375 幅で並べて比べる。
// 塗り＝確定・点線＝まだ、という決まりはどの案でも崩さない。
// 実行: node tools/theme-cool.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;
const W = 375, HEAD = 46, WD = 24, CH = 100, ROWS = 4;
const H = HEAD + WD + CH * ROWS;
const CW = W / 7;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"/>`;

// 4週ぶん。today は 13日
const WEEKS = [
  [[2, []], [3, [['baito', 1, 'マクド']]], [4, []], [5, [['yoji', 1, 'ゼミ']]],
   [6, [['baito', 1, 'マクド'], ['asobi', 0, '花火']]], [7, []], [8, [['other', 1, '受け取り']]]],
  [[9, []], [10, [['baito', 1, 'マクド']]], [11, []],
   [12, [['asobi', 1, '花火'], ['yoji', 0, '歯医者']]],
   [13, [['baito', 1, 'マクド'], ['other', 0, '返却']], true], [14, []], [15, [['asobi', 0, '打ち上げ']]]],
  [[16, []], [17, [['baito', 1, 'マクド']]], [18, [['yoji', 1, 'ゼミ']]], [19, [['baito', 0, 'マクド']]],
   [20, [['other', 0, '返却'], ['yoji', 1, 'ゼミ']]], [21, []], [22, [['baito', 1, 'マクド']]]],
  [[23, [['asobi', 0, 'ライブ']]], [24, [['baito', 1, 'マクド']]], [25, []], [26, [['yoji', 1, '面談']]],
   [27, [['baito', 1, 'マクド']]], [28, [['asobi', 1, '映画']]], [29, []]],
];

// 案ごとの色。fill=確定の塗り／dash=まだの点線。どちらも「種類の色」を持つ
const THEMES = {
  'いま（静かな文房具）': {
    bg: '#F6F7F9', cell: '#FFFFFF', line: '#E4E7EC', lineF: '#F1F3F6',
    ink: '#1E2024', mut: '#82878F', faint: '#B3B8C0', sun: '#B4453A', sat: '#3D6E9C',
    todayLine: '#1E2024', radius: 4, headW: 300,
    ty: {
      yoji: { fill: '#B0A5CF', on: '#2F293F', paper: '#D3CCE4', line: '#C5BCDD' },
      baito: { fill: '#A8C8AC', on: '#2B3B2D', paper: '#CEE0D1', line: '#BCD4BF' },
      asobi: { fill: '#E0B49A', on: '#473124', paper: '#EED5C6', line: '#E7C5B0' },
      other: { fill: '#AFAFAF', on: '#2F2F2F', paper: '#D3D3D3', line: '#C1C1C1' },
    },
  },
  '案A｜暗い地に、色は最小限': {
    bg: '#0B0C0E', cell: '#131519', line: '#22262C', lineF: '#191C21',
    ink: '#E8EAED', mut: '#7C848E', faint: '#464C55', sun: '#D9736A', sat: '#7FA6CE',
    todayLine: '#4DE1C1', radius: 3, headW: 300,
    ty: {
      yoji: { fill: '#2E3138', on: '#DDE1E8', paper: 'none', line: '#4A505A' },
      baito: { fill: '#E8EAED', on: '#0B0C0E', paper: 'none', line: '#6E7681' },
      asobi: { fill: '#2E3138', on: '#DDE1E8', paper: 'none', line: '#4A505A' },
      other: { fill: '#2E3138', on: '#DDE1E8', paper: 'none', line: '#4A505A' },
    },
  },
  '案B｜暗い地に、種類の色を強く': {
    bg: '#0B0C0E', cell: '#131519', line: '#22262C', lineF: '#191C21',
    ink: '#E8EAED', mut: '#7C848E', faint: '#464C55', sun: '#F0776B', sat: '#6FA8DC',
    todayLine: '#E8EAED', radius: 3, headW: 300,
    ty: {
      yoji: { fill: '#4C3A8A', on: '#E4DDFA', paper: 'none', line: '#8B6FE8' },
      baito: { fill: '#1B6B4A', on: '#D5F5E5', paper: 'none', line: '#34D399' },
      asobi: { fill: '#8A4416', on: '#FBE3CE', paper: 'none', line: '#FB923C' },
      other: { fill: '#3A424C', on: '#DDE1E8', paper: 'none', line: '#94A3B8' },
    },
  },
  '案C｜白のまま、角を落として硬く': {
    bg: '#FFFFFF', cell: '#FFFFFF', line: '#111315', lineF: '#DDE0E3',
    ink: '#000000', mut: '#6B7076', faint: '#A6ABB1', sun: '#9B2C1E', sat: '#1F4E79',
    todayLine: '#000000', radius: 0, headW: 300,
    ty: {
      yoji: { fill: '#4C3F7A', on: '#FFFFFF', paper: 'none', line: '#4C3F7A' },
      baito: { fill: '#2F6B45', on: '#FFFFFF', paper: 'none', line: '#2F6B45' },
      asobi: { fill: '#A85A28', on: '#FFFFFF', paper: 'none', line: '#A85A28' },
      other: { fill: '#3A3A3A', on: '#FFFFFF', paper: 'none', line: '#3A3A3A' },
    },
  },
};

function pill(T, x, y, w, [type, solid, label]) {
  const c = T.ty[type], h = 16, r = T.radius;
  if (solid) {
    return rect(x, y, w, h, c.fill, r) + t(x + 4, y + 11.5, label, 11, 500, c.on);
  }
  const bg = c.paper === 'none' ? 'none' : c.paper;
  const inner = `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 0.5) * S}" rx="${Math.max(0, r - 0.5) * S}" fill="${bg}" stroke="${c.line}" stroke-width="${1.5 * S}" stroke-dasharray="${3 * S} ${2.5 * S}"/>`;
  const ink = c.paper === 'none' ? c.line : c.on;
  return inner + t(x + 4, y + 12, label, 11, 500, ink);
}

function screen(name) {
  const T = THEMES[name];
  let o = rect(0, 0, W, H, T.bg);
  // 見出し
  o += t(18, HEAD - 16, '‹', 17, 400, T.mut);
  o += t(40, HEAD - 15, '8月', 20, 300, T.ink);
  o += t(74, HEAD - 15, '2026', 13, 400, T.mut);
  o += t(112, HEAD - 15, '▾', 10, 400, T.faint);
  o += t(W - 18, HEAD - 15, '給料', 12, 400, T.mut, 'end');
  // 曜日
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  DOW.forEach((d, i) => {
    const col = i === 0 ? T.sun : i === 6 ? T.sat : T.mut;
    o += t(CW * i + CW / 2, HEAD + 15, d, 10, 600, col, 'middle');
  });
  o += rect(0, HEAD + WD - 0.5, W, 0.7, T.line);
  // マス
  WEEKS.forEach((week, r) => {
    const y0 = HEAD + WD + r * CH;
    o += rect(0, y0, W, CH, T.cell);
    week.forEach(([day, bars, today], i) => {
      const x = CW * i;
      if (i < 6) o += rect(x + CW - 0.5, y0, 0.7, CH, T.lineF);
      if (today) o += rect(x, y0, CW, 2, T.todayLine);
      const col = i === 0 ? T.sun : i === 6 ? T.sat : T.ink;
      o += t(x + 3, y0 + (today ? 16 : 14), String(day), 11, today ? 700 : (i === 0 || i === 6 ? 600 : 500), col);
      bars.forEach((b, j) => { o += pill(T, x + 2, y0 + (today ? 24 : 22) + j * 19, CW - 4, b); });
    });
    o += rect(0, y0 + CH, W, 0.7, T.line);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`;
}

(async () => {
  const names = Object.keys(THEMES);
  const SC = 1.15, GAP = 22, PAD = 18, LABEL = 26;
  const imgs = [];
  for (const n of names) {
    imgs.push({ n, buf: await sharp(Buffer.from(screen(n))).resize(Math.round(W * SC)).png().toBuffer() });
  }
  const cw = Math.round(W * SC), ch = Math.round(H * SC);
  const comp = [];
  imgs.forEach((im, i) => {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc(im.n)}</text></svg>`), top: PAD, left });
    comp.push({ input: im.buf, top: PAD + LABEL, left });
  });
  await sharp({ create: { width: PAD * 2 + names.length * cw + (names.length - 1) * GAP, height: PAD * 2 + LABEL + ch, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile('../store-assets/theme-cool.png');
  console.log('できた');
})();
