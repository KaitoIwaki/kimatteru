// 明るいまま「きれい・クール・使いやすそう」に見せる。実寸 375 幅。
//
// 明るい画面でクールに見えるのは、暗いからではなく **線が少ないから**。
// いまの月表示は縦線・横線・枠がぜんぶ引いてあって、表計算に近い。
// 線を引くのをやめて、空きで区切ると、同じ情報のまま静かになる。
//
// 実行: node tools/theme-light.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;
const W = 375, HEAD = 58, WD = 30, ROWS = 4;
const CW = W / 7;

// ---- Lab から sRGB。色は計算で作る（theme-global.cjs と同じ作り） ----
const f1 = (t) => (t > 6 / 29 ? t ** 3 : 3 * (6 / 29) ** 2 * (t - 4 / 29));
const g8 = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};
function lch(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const X = 0.95047 * f1(fx), Y = f1(fy), Z = 1.08883 * f1(fz);
  return `#${[g8(3.2406 * X - 1.5372 * Y - 0.4986 * Z), g8(-0.9689 * X + 1.8758 * Y + 0.0415 * Z), g8(0.0557 * X - 0.2040 * Y + 1.0570 * Z)]
    .map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const HUES = { yoji: 288, baito: 162, asobi: 42, other: 250 };
const CHROMA = { yoji: 40, baito: 40, asobi: 40, other: 14 };
const TY = Object.fromEntries(Object.entries(HUES).map(([k, h]) => [k, lch(48, CHROMA[k], h)]));
const ACCENT = lch(52, 40, 205);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, op) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => `#${hexRgb(a).map((v, i) => Math.round(v * k + hexRgb(b)[i] * (1 - k)).toString(16).padStart(2, '0')).join('')}`;
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = hexRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const WEEKS = [
  [[2, []], [3, [['baito', 1, 'マクド']]], [4, []], [5, [['yoji', 1, 'ゼミ']]],
   [6, [['baito', 1, 'マクド'], ['asobi', 0, '花火']]], [7, []], [8, [['other', 1, '受取']]]],
  [[9, []], [10, [['baito', 1, 'マクド']]], [11, []], [12, [['asobi', 1, '花火'], ['yoji', 0, '歯医者']]],
   [13, [['baito', 1, 'マクド'], ['other', 0, '返却']], true], [14, []], [15, [['asobi', 0, '打上']]]],
  [[16, []], [17, [['baito', 1, 'マクド']]], [18, [['yoji', 1, 'ゼミ']]], [19, [['baito', 0, 'マクド']]],
   [20, [['other', 0, '返却'], ['yoji', 1, 'ゼミ']]], [21, []], [22, [['baito', 1, 'マクド']]]],
  [[23, [['asobi', 0, 'ライブ']]], [24, [['baito', 1, 'マクド']]], [25, []], [26, [['yoji', 1, '面談']]],
   [27, [['baito', 1, 'マクド']]], [28, [['asobi', 1, '映画']]], [29, []]],
];

// 案ごとの決めごと。線をどこまで引くか、面をどれだけ濃くするか
const T = {
  'いま（比べる用）': {
    bg: '#F6F7F9', card: '#FFFFFF', row: '#E4E7EC', col: '#F1F3F6', pad: 0, cardR: 0,
    ink: '#1E2024', mut: '#82878F', faint: '#B3B8C0', cellH: 100, tint: 0.30, pillR: 4,
    shadow: false, today: '#1E2024',
  },
  '案①｜線を消して、空きで区切る': {
    bg: '#FFFFFF', card: '#FFFFFF', row: null, col: null, pad: 0, cardR: 0,
    ink: '#171A1F', mut: '#767E89', faint: '#AEB5BE', cellH: 104, tint: 0.13, pillR: 6,
    shadow: false, today: ACCENT,
  },
  '案②｜白い板を浮かせる': {
    bg: '#F1F4F8', card: '#FFFFFF', row: null, col: null, pad: 12, cardR: 22,
    ink: '#171A1F', mut: '#767E89', faint: '#AEB5BE', cellH: 100, tint: 0.13, pillR: 6,
    shadow: true, today: ACCENT,
  },
  '案③｜横線だけ、極細で残す': {
    bg: '#FFFFFF', card: '#FFFFFF', row: '#EEF1F4', col: null, pad: 0, cardR: 0,
    ink: '#171A1F', mut: '#767E89', faint: '#AEB5BE', cellH: 102, tint: 0.16, pillR: 5,
    shadow: false, today: ACCENT,
  },
};

function pill(C, x, y, w, [type, solid, label]) {
  const hue = TY[type], h = 18, r = C.pillR;
  if (solid) {
    // 決まっている＝面。枠は引かない。線を減らすのがこの案の要
    return rect(x, y, w, h, mix(hue, C.card, C.tint), r)
      + t(x + 6, y + 12.5, label, 11, 500, mix(hue, '#000000', 0.22));
  }
  // まだ＝点線の枠だけ。面は敷かない
  return `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" fill="none" stroke="${hue}" stroke-width="${1.2 * S}" stroke-dasharray="${3 * S} ${2.6 * S}" opacity=".7"/>`
    + t(x + 6, y + 12.5, label, 11, 500, mix(hue, '#000000', 0.12));
}

function screen(name) {
  const C = T[name];
  const H = HEAD + WD + C.cellH * ROWS + C.pad * 2;
  let o = `<defs><filter id="s" x="-30%" y="-30%" width="160%" height="180%">
    <feDropShadow dx="0" dy="${2 * S}" stdDeviation="${3 * S}" flood-color="#8494A8" flood-opacity="0.16"/>
    <feDropShadow dx="0" dy="${10 * S}" stdDeviation="${14 * S}" flood-color="#8494A8" flood-opacity="0.14"/>
  </filter></defs>`;
  o += rect(0, 0, W, H, C.bg);

  o += t(20, HEAD - 22, '8月', 24, 250, C.ink, null, -0.4);
  o += t(58, HEAD - 22, '2026', 13, 400, C.mut, null, 1.4);
  o += t(W - 20, HEAD - 23, '給料', 11, 600, C.mut, 'end', 1.2);

  const x0 = C.pad, cw = (W - C.pad * 2) / 7, y0 = HEAD + C.pad;
  const gridH = WD + C.cellH * ROWS;
  if (C.shadow) o += `<g filter="url(#s)">${rect(x0, y0, W - C.pad * 2, gridH, C.card, C.cardR)}</g>`;
  else if (C.card !== C.bg) o += rect(x0, y0, W - C.pad * 2, gridH, C.card, C.cardR);

  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  DOW.forEach((d, i) => {
    const col = i === 0 ? mix('#B4453A', C.card, 0.7) : i === 6 ? mix('#3D6E9C', C.card, 0.7) : C.faint;
    o += t(x0 + cw * i + cw / 2, y0 + 19, d, 9.5, 700, col, 'middle', 1.2);
  });
  if (C.row) o += rect(x0, y0 + WD - 0.5, W - C.pad * 2, 0.7, C.row);

  WEEKS.forEach((week, r) => {
    const yy = y0 + WD + r * C.cellH;
    week.forEach(([day, bars, today], k) => {
      const x = x0 + cw * k;
      if (C.col && k < 6) o += rect(x + cw - 0.5, yy, 0.7, C.cellH, C.col);
      if (today) o += rect(x + (C.row ? 0 : 3), yy, cw - (C.row ? 0 : 6), 2, C.today, 1);
      const col = today ? C.today : (k === 0 ? '#B4453A' : k === 6 ? '#3D6E9C' : C.ink);
      o += t(x + 6, yy + (today ? 20 : 18), String(day), 12, today ? 700 : 400, col, null, 0.2);
      bars.forEach((b, j) => { o += pill(C, x + 3, yy + (today ? 28 : 26) + j * 21, cw - 6, b); });
    });
    if (C.row && r < ROWS - 1) o += rect(x0, yy + C.cellH, W - C.pad * 2, 0.7, C.row);
  });
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`, H };
}

(async () => {
  console.log('種類の色（Lab で揃えた・明るい方）');
  console.log(`  ${Object.entries(TY).map(([k, v]) => `${k} ${v}`).join('  ')}   今日 ${ACCENT}\n`);
  console.log('塗り（決まってる）の面と、まだ（＝地）の差／面の上の字\n');
  for (const [n, C] of Object.entries(T)) {
    const rows = Object.entries(TY).map(([k, hue]) => {
      const face = mix(hue, C.card, C.tint);
      return `${k} ${cr(face, C.card).toFixed(2)}／${cr(mix(hue, '#000000', 0.22), face).toFixed(2)}`;
    });
    console.log(`  ${n}\n     ${rows.join('   ')}`);
  }

  const names = Object.keys(T);
  const SC = 1.15, GAP = 22, PAD = 18, LABEL = 26;
  const imgs = [];
  let maxH = 0;
  for (const n of names) {
    const { svg, H } = screen(n);
    maxH = Math.max(maxH, Math.round(H * SC));
    imgs.push(await sharp(Buffer.from(svg)).resize(Math.round(W * SC)).png().toBuffer());
  }
  const cw = Math.round(W * SC);
  const comp = [];
  imgs.forEach((buf, i) => {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc(names[i])}</text></svg>`), top: PAD, left });
    comp.push({ input: buf, top: PAD + LABEL, left });
  });
  await sharp({ create: { width: PAD * 2 + names.length * cw + (names.length - 1) * GAP, height: PAD * 2 + LABEL + maxH, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile('../store-assets/theme-light.png');
  console.log('\nできた');
})();
