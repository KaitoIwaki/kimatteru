// ウィジェットの月カレンダーで「今日」の線をどれくらいの長さにするか。
// 中のウィジェットの右半分を実寸で描いて比べる（1マス 21.5 × 20、数字 10pt）。
// 実行: node tools/widget-today-line.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 4;

const INK = '#26251F', FAINT = '#A9A79C', PAPER = '#FBFAF7';
const G = '#7FAE85', P = '#8B7AB8', O = '#D2916A';

let CW = 21.5, RH = 20, NUM = 10, DOTR = 2.4;
const WD = ['月', '火', '水', '木', '金', '土', '日'];

// 2026年8月。月始まり、今日は14日（金）
const START = 5; // 1日は土曜 → 月始まりで6列目
const DAYS = 31;
const DOTS = {
  1:[[P,1]], 2:[[G,1]], 4:[[G,1]], 5:[[P,1],[G,1]], 6:[[G,1]], 7:[[G,1]], 8:[[P,1]], 9:[[G,1]],
  10:[[G,1],[G,1]], 11:[[G,1]], 12:[[G,1]], 13:[[G,1]], 14:[[G,1]], 15:[[G,1]], 16:[[O,1]],
  17:[[O,1],[G,1]], 18:[[P,1],[P,1],[G,1]], 19:[[G,1]], 20:[[P,1]], 21:[[G,1]], 23:[[G,1]],
  24:[[P,1],[G,1]], 25:[[P,1],[G,1]], 26:[[G,1]], 27:[[P,1]], 28:[[G,1],[G,0]], 29:[[O,1]], 30:[[O,1]],
  31:[[O,1],[G,1]],
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}" text-anchor="middle">${esc(s)}</text>`;

// lineW: null なら маス幅いっぱい（今の作り）、数値ならその長さ
function grid(lineW) {
  const W = CW * 7, rows = Math.ceil((START + DAYS) / 7);
  let out = `<rect x="0" y="0" width="${W * S}" height="${(11 + rows * RH) * S}" fill="${PAPER}"/>`;
  WD.forEach((w, i) => { out += t(CW * (i + 0.5), 8, w, 8, 400, FAINT); });

  for (let n = 0; n < rows * 7; n++) {
    const d = n - START + 1;
    const cx = CW * (n % 7) + CW / 2;
    const y0 = 11 + Math.floor(n / 7) * RH;
    if (d < 1 || d > DAYS) continue;
    const isToday = d === 14;
    if (isToday) {
      const w = lineW == null ? CW - 2 : lineW;
      out += `<rect x="${(cx - w / 2) * S}" y="${y0 * S}" width="${w * S}" height="${1.5 * S}" rx="${0.75 * S}" fill="${INK}"/>`;
    }
    const dots = DOTS[d] || [];
    out += t(cx, y0 + 1.5 + 1 + NUM, String(d), NUM, isToday ? 600 : 400, dots.length || isToday ? INK : FAINT);
    const dy = y0 + 1.5 + 1 + NUM * 1.19 + 1.5 + DOTR;
    const total = dots.length * DOTR * 2 + (dots.length - 1) * 1.6;
    dots.slice(0, 3).forEach((dt, j) => {
      const x = cx - total / 2 + DOTR + j * (DOTR * 2 + 1.6);
      out += dt[1]
        ? `<circle cx="${x * S}" cy="${dy * S}" r="${DOTR * S}" fill="${dt[0]}"/>`
        : `<circle cx="${x * S}" cy="${dy * S}" r="${(DOTR - 0.5) * S}" fill="none" stroke="${dt[0]}" stroke-width="${1 * S}"/>`;
    });
  }
  return { svg: out, w: W, h: 11 + rows * RH };
}

// 大はマスが倍近く広い（43.7pt）。同じ長さで両方おかしくならないか確かめる
const CASES = [
  ['大｜いま（マス幅いっぱい・41.7pt）', null,       [43.7, 19, 11, 2.6]],
  ['大｜数字 × 1.4（15.4pt）',           11 * 1.4,  [43.7, 19, 11, 2.6]],
  ['大｜数字 × 2.2（24.2pt）',           11 * 2.2,  [43.7, 19, 11, 2.6]],
];

(async () => {
  const SC = 2, GAP = 30, PAD = 20, LABEL = 26;
  const imgs = [];
  for (const [name, lw, dim] of CASES) {
    if (dim) { CW = dim[0]; RH = dim[1]; NUM = dim[2]; DOTR = dim[3]; }
    const g = grid(lw);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${g.w * S}" height="${g.h * S}">${g.svg}</svg>`;
    imgs.push({ name, buf: await sharp(Buffer.from(svg)).resize(Math.round(g.w * SC)).png().toBuffer(), h: Math.round(g.h * SC) });
  }
  const cw = Math.round(CW * 7 * SC);
  const W = PAD * 2 + imgs.length * cw + (imgs.length - 1) * GAP;
  const H = PAD * 2 + LABEL + imgs[0].h;
  const comp = [];
  imgs.forEach((im, i) => {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="15" font-family="${F}" font-size="11" font-weight="700" fill="#1E2024">${esc(im.name)}</text></svg>`), top: PAD, left });
    comp.push({ input: im.buf, top: PAD + LABEL, left });
  });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#DDE1E8' } })
    .composite(comp).png().toFile('../store-assets/widget-today-line-l.png');
  console.log('できた');
})();
