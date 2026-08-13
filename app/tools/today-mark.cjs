// アプリの月表示で「今日」をどう示すか。案を実寸で描いて比べる。
// マスは iPhone 幅 375 のときの実寸（1マス 53.6 × 100）。
// 実行: node tools/today-mark.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;

const T = { yoji: '#8B7AB8', baito: '#7FAE85', asobi: '#D2916A', other: '#8A8A8A' };
const FILL = { yoji: '#B0A5CF', baito: '#A8C8AC', asobi: '#E0B49A', other: '#AFAFAF' };
const PAPER = { yoji: '#D3CCE4', baito: '#CEE0D1', asobi: '#EED5C6', other: '#D3D3D3' };
const INK_ON = { yoji: '#2F293F', baito: '#2B3B2D', asobi: '#473124', other: '#2F2F2F' };
const CARD = '#FFFFFF', INK = '#1E2024', MUT = '#82878F', FAINT = '#B3B8C0';
const LINE = '#E4E7EC', LINE_FAINT = '#F1F3F6';
const RED = '#B4453A', BLUE = '#3D6E9C';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(s)}</text>`;

const CW = 375 / 7, CH = 100, LANE = 19;

// 3週ぶん。今日は真ん中の週の木曜（4列目）。
// 上に週があるとき、上辺の線が「週の区切り」と重なって見えないかを確かめる。
const WEEK0 = [
  { d: 2,  dow: 0, bars: [] },
  { d: 3,  dow: 1, bars: [['baito', 1, 'マクド']] },
  { d: 4,  dow: 2, bars: [] },
  { d: 5,  dow: 3, bars: [['yoji', 1, 'ゼミ']] },
  { d: 6,  dow: 4, bars: [['baito', 1, 'マクド'], ['asobi', 0, '花火']] },
  { d: 7,  dow: 5, bars: [] },
  { d: 8,  dow: 6, bars: [['other', 1, '受け取り']] },
];
const WEEK1 = [
  { d: 9,  dow: 0, bars: [] },
  { d: 10, dow: 1, bars: [['baito', 1, 'マクド']] },
  { d: 11, dow: 2, bars: [] },
  { d: 12, dow: 3, bars: [['asobi', 1, '花火'], ['yoji', 0, '歯医者']] },
  { d: 13, dow: 4, today: true, bars: [['baito', 1, 'マクド'], ['other', 0, '返却']] },
  { d: 14, dow: 5, bars: [] },
  { d: 15, dow: 6, bars: [['asobi', 0, '打ち上げ']] },
];
const WEEK2 = [
  { d: 16, dow: 0, bars: [] },
  { d: 17, dow: 1, bars: [['baito', 1, 'マクド']] },
  { d: 18, dow: 2, bars: [] },
  { d: 19, dow: 3, bars: [['baito', 0, 'マクド']] },
  { d: 20, dow: 4, bars: [['other', 0, '返却'], ['yoji', 1, 'ゼミ']] },
  { d: 21, dow: 5, bars: [] },
  { d: 22, dow: 6, bars: [['baito', 1, 'マクド']] },
];

function bar(x, y, w, [type, solid, label]) {
  const h = 17, r = 3;
  const box = solid
    ? `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${FILL[type]}"/>`
    : `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" fill="${PAPER[type]}" stroke="${T[type]}" stroke-width="${1.5 * S}" stroke-dasharray="${3 * S} ${2.5 * S}"/>`;
  return box + t(x + 4, y + 12, label, 10, 400, INK_ON[type]);
}

// mode:
//  D1 上辺だけ  D2 上辺と下辺  E1 短い縦棒  E2 数字から帯の下まで伸ばす  E3 マスの高さいっぱい
function week(x0, y0, days, mode) {
  let out = `<rect x="${x0 * S}" y="${y0 * S}" width="${375 * S}" height="${CH * S}" fill="${CARD}"/>`;
  days.forEach((day, i) => {
    const x = x0 + CW * i;
    if (i < 6) out += `<rect x="${(x + CW - 0.5) * S}" y="${y0 * S}" width="${1 * S}" height="${CH * S}" fill="${LINE_FAINT}"/>`;
    const isToday = !!day.today;
    const col = day.dow === 0 ? RED : day.dow === 6 ? BLUE : INK;

    if (isToday && (mode === 'D1' || mode === 'D2')) {
      out += `<rect x="${x * S}" y="${y0 * S}" width="${CW * S}" height="${2 * S}" fill="${INK}"/>`;
    }
    if (isToday && mode === 'D2') {
      out += `<rect x="${x * S}" y="${(y0 + CH - 2) * S}" width="${CW * S}" height="${2 * S}" fill="${INK}"/>`;
    }

    let numX = x + 3, numY = y0 + 14, weight = day.dow === 0 || day.dow === 6 ? 600 : 500;
    if (isToday) {
      weight = 700;
      if (mode === 'D1' || mode === 'D2') numY = y0 + 16;
      if (mode.startsWith('E')) numX = x + 9;
    }
    if (isToday && mode === 'E1') {
      out += `<rect x="${(x + 3) * S}" y="${(numY - 10) * S}" width="${2 * S}" height="${11 * S}" rx="${1 * S}" fill="${INK}"/>`;
    }
    if (isToday && mode === 'E2') {
      const h = 22 + day.bars.length * LANE - 2;
      out += `<rect x="${(x + 3) * S}" y="${(y0 + 4) * S}" width="${2 * S}" height="${h * S}" rx="${1 * S}" fill="${INK}"/>`;
    }
    if (isToday && mode === 'E3') {
      out += `<rect x="${(x + 3) * S}" y="${(y0 + 4) * S}" width="${2 * S}" height="${(CH - 8) * S}" rx="${1 * S}" fill="${INK}"/>`;
    }
    out += t(numX, numY, String(day.d), 11, weight, col);

    const top = (mode === 'D1' || mode === 'D2') ? y0 + 24 : y0 + 22;
    const bx = mode.startsWith('E') && isToday ? x + 7 : x + 2;
    const bw = mode.startsWith('E') && isToday ? CW - 9 : CW - 4;
    day.bars.forEach((b, j) => { out += bar(bx, top + j * LANE, bw, b); });
  });
  out += `<rect x="${x0 * S}" y="${(y0 + CH) * S}" width="${375 * S}" height="${1 * S}" fill="${LINE}"/>`;
  return out;
}

const NAMES = {
  D1: '案D1｜上辺だけに線',
  D2: '案D2｜上辺と下辺の両方に線（マスをはさむ）',
  E1: '案E1｜数字の左に短い縦棒',
  E2: '案E2｜縦棒を、予定の帯の下まで伸ばす',
  E3: '案E3｜縦棒をマスの高さいっぱいに',
};

(async () => {
  const modes = ['D1', 'D2'];
  const SC = 1.5, GAP = 26, LEFT = 16, LABEL = 24;
  const imgs = [];
  for (const m of modes) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${375 * S}" height="${(CH * 3 + 3) * S}">`
      + week(0, 0, WEEK0, m) + week(0, CH + 1, WEEK1, m) + week(0, (CH + 1) * 2, WEEK2, m) + `</svg>`;
    imgs.push({ name: NAMES[m], buf: await sharp(Buffer.from(svg)).resize(Math.round(375 * SC)).png().toBuffer() });
  }
  const rowH = Math.round((CH * 3 + 3) * SC);
  const W = Math.round(375 * SC) + LEFT * 2;
  const H = modes.length * (rowH + GAP + LABEL) + 16;
  const comp = []; let y = 16;
  for (const im of imgs) {
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="14" font-weight="700" fill="#1E2024">${im.name}</text></svg>`), top: y, left: LEFT });
    comp.push({ input: im.buf, top: y + LABEL, left: LEFT });
    y += rowH + GAP + LABEL;
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#DDE1E8' } })
    .composite(comp).png().toFile('../store-assets/today-mark3.png');
  console.log('できた');
})();
