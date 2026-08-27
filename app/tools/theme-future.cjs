// 月表示を「近未来風」に振る。実寸 375 幅。
// 塗り＝確定・点線＝まだ、色＝種類 の決まりは崩さない。
// ピルは「刷ったもの」ではなく「光っているもの」として作る——
// 薄い地に明るい縁、が近未来に見えるいちばん安い作り方。
// 実行: node tools/theme-future.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;
const W = 375, HEAD = 46, WD = 24, CH = 100, ROWS = 4;
const H = HEAD + WD + CH * ROWS;
const CW = W / 7;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, extra = '') =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${extra}/>`;

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

// hue = 種類の色。solidBg は hue を地に溶かした薄い面、text は乗せる字の色。
const THEMES = {
  '案①｜HUD（濃紺の闇・シアン）': {
    bg: '#070A12', cell: '#0C1120', line: '#1A2540', lineF: '#111A2E',
    ink: '#DCE6F5', mut: '#6B7C99', faint: '#3D4A63', sun: '#FF6B6B', sat: '#56A8FF',
    today: '#22D3EE', glow: true, radius: 3,
    ty: {
      yoji: { hue: '#A78BFA', solidBg: 'rgba(167,139,250,.30)', text: '#EDE7FF' },
      baito: { hue: '#2DE1A6', solidBg: 'rgba(45,225,166,.28)', text: '#D9FFF2' },
      asobi: { hue: '#FF9A5A', solidBg: 'rgba(255,154,90,.28)', text: '#FFE8D8' },
      other: { hue: '#7DD3FC', solidBg: 'rgba(125,211,252,.26)', text: '#E2F5FF' },
    },
  },
  '案②｜サイバー（黒紫・マゼンタ）': {
    bg: '#06040D', cell: '#0E0A1A', line: '#271E42', lineF: '#171029',
    ink: '#E6DEFF', mut: '#7E71A8', faint: '#4A3F६E'.replace('६', '6'), sun: '#FF5C8A', sat: '#5CC8FF',
    today: '#F0559B', glow: true, radius: 2,
    ty: {
      yoji: { hue: '#C084FC', solidBg: 'rgba(192,132,252,.32)', text: '#F3E8FF' },
      baito: { hue: '#22D3EE', solidBg: 'rgba(34,211,238,.30)', text: '#DFFAFF' },
      asobi: { hue: '#F0559B', solidBg: 'rgba(240,85,155,.30)', text: '#FFE0EE' },
      other: { hue: '#8B94B8', solidBg: 'rgba(139,148,184,.30)', text: '#E8EBF5' },
    },
  },
  '案③｜静かな近未来（彩度控えめ）': {
    bg: '#0D1117', cell: '#141C25', line: '#233040', lineF: '#18222E',
    ink: '#D7E1EC', mut: '#71818F', faint: '#414F5C', sun: '#E0736B', sat: '#6BA3D6',
    today: '#58C9A5', glow: false, radius: 4,
    ty: {
      yoji: { hue: '#9E8FD0', solidBg: 'rgba(158,143,208,.30)', text: '#E8E3F7' },
      baito: { hue: '#58C9A5', solidBg: 'rgba(88,201,165,.28)', text: '#DFF6EE' },
      asobi: { hue: '#D68F6A', solidBg: 'rgba(214,143,106,.28)', text: '#F7E5DA' },
      other: { hue: '#7E8CA0', solidBg: 'rgba(126,140,160,.30)', text: '#E3E9F0' },
    },
  },
};

// 確定＝薄い面＋明るい縁（光っているもの）。まだ＝縁だけ、しかも点線。
// 面の有無と線の切れ目、2つで差をつける。片方だけだと暗い地では弱い。
function pill(T, x, y, w, [type, solid, label]) {
  const c = T.ty[type], h = 16, r = T.radius;
  if (solid) {
    return rect(x, y, w, h, c.solidBg, r)
      + `<rect x="${(x + 0.5) * S}" y="${(y + 0.5) * S}" width="${(w - 1) * S}" height="${(h - 1) * S}" rx="${Math.max(0, r - 0.5) * S}" fill="none" stroke="${c.hue}" stroke-width="${1 * S}"/>`
      + t(x + 5, y + 11.5, label, 11, 500, c.text);
  }
  return `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${Math.max(0, r - 0.5) * S}" fill="none" stroke="${c.hue}" stroke-width="${1.3 * S}" stroke-dasharray="${3 * S} ${2.5 * S}" opacity=".85"/>`
    + t(x + 5, y + 11.5, label, 11, 500, c.hue);
}

function screen(name, i) {
  const T = THEMES[name];
  let o = `<defs><filter id="g${i}" x="-60%" y="-300%" width="220%" height="700%">`
    + `<feGaussianBlur stdDeviation="${1.6 * S}"/></filter></defs>`;
  o += rect(0, 0, W, H, T.bg);
  o += t(18, HEAD - 16, '‹', 17, 400, T.mut);
  o += t(40, HEAD - 15, '8月', 20, 200, T.ink);
  o += t(76, HEAD - 15, '2026', 12, 400, T.mut, null, 1.2);
  o += t(W - 18, HEAD - 15, '給料', 11, 400, T.mut, 'end', 1);
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  DOW.forEach((d, k) => {
    const col = k === 0 ? T.sun : k === 6 ? T.sat : T.mut;
    o += t(CW * k + CW / 2, HEAD + 15, d, 9.5, 600, col, 'middle', 1);
  });
  o += rect(0, HEAD + WD - 0.5, W, 0.7, T.line);
  WEEKS.forEach((week, r) => {
    const y0 = HEAD + WD + r * CH;
    o += rect(0, y0, W, CH, T.cell);
    week.forEach(([day, bars, today], k) => {
      const x = CW * k;
      if (k < 6) o += rect(x + CW - 0.5, y0, 0.7, CH, T.lineF);
      if (today) {
        if (T.glow) o += rect(x + 2, y0, CW - 4, 2, T.today, 1, ` filter="url(#g${i})"`);
        o += rect(x, y0, CW, 2, T.today, 1);
      }
      const col = k === 0 ? T.sun : k === 6 ? T.sat : T.ink;
      o += t(x + 4, y0 + (today ? 16 : 14), String(day), 11, today ? 700 : 400, today ? T.today : col, null, 0.3);
      bars.forEach((b, j) => { o += pill(T, x + 2, y0 + (today ? 24 : 22) + j * 19, CW - 4, b); });
    });
    o += rect(0, y0 + CH, W, 0.7, T.line);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`;
}

// 読めるかを測る。暗い地に光る色は、綺麗でも字が読めないことがある
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (rgb) => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (fg, bg, a) => fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));

(async () => {
  const names = Object.keys(THEMES);
  console.log('字が読めるか（4.5 で本文、3.0 で最低限）\n');
  for (const n of names) {
    const T = THEMES[n];
    const cell = hex(T.cell);
    const out = [];
    for (const [k, c] of Object.entries(T.ty)) {
      const a = Number(c.solidBg.match(/,\s*\.?(\d+)\)/)[1]) / 100;
      const bg = over(hex(c.hue), cell, a);
      out.push(`${k} 塗り ${cr(hex(c.text), bg).toFixed(2)} / まだ ${cr(hex(c.hue), cell).toFixed(2)}`);
    }
    console.log(`  ${n}`);
    console.log(`    ${out.join('  ')}`);
  }

  const SC = 1.15, GAP = 22, PAD = 18, LABEL = 26;
  const imgs = [];
  for (let i = 0; i < names.length; i += 1) {
    imgs.push({ n: names[i], buf: await sharp(Buffer.from(screen(names[i], i))).resize(Math.round(W * SC)).png().toBuffer() });
  }
  const cw = Math.round(W * SC), ch = Math.round(H * SC);
  const comp = [];
  imgs.forEach((im, i) => {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#E8EAED">${esc(im.n)}</text></svg>`), top: PAD, left });
    comp.push({ input: im.buf, top: PAD + LABEL, left });
  });
  await sharp({ create: { width: PAD * 2 + names.length * cw + (names.length - 1) * GAP, height: PAD * 2 + LABEL + ch, channels: 3, background: '#1B1F26' } })
    .composite(comp).png().toFile('../store-assets/theme-future.png');
  console.log('\nできた');
})();
