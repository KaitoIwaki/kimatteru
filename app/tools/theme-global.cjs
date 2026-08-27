// 「海外でも使われるアプリ」を狙った配色と組みかた。実寸 375 幅。
//
// 狙いは3つ。
//  1. **色を勘で選ばない。** 4つの種類の色を Lab で同じ明るさ・同じ鮮やかさに
//     揃える。集めた色と、設計した色の差はここに出る。
//  2. **今日の色を、どの種類にも使わせない。** 今日は予定ではないので、
//     種類と同じ色を使うと嘘になる。
//  3. **英語で崩れないか同時に見る。** 日本語だけで詰めた枠は、
//     Wednesday や Appointment で必ず溢れる。
//
// 実行: node tools/theme-global.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;
const W = 375, HEAD = 52, WD = 26, CH = 100, ROWS = 4;
const H = HEAD + WD + CH * ROWS;
const CW = W / 7;

// ---- Lab から sRGB へ。色を計算で作るために要る ----
const f1 = (t) => (t > 6 / 29 ? t ** 3 : 3 * (6 / 29) ** 2 * (t - 4 / 29));
const g = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};
function lch(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const X = 0.95047 * f1(fx), Y = f1(fy), Z = 1.08883 * f1(fz);
  const r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const gg = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const bb = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  return `#${[g(r), g(gg), g(bb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// 種類の色。角度だけ変えて、明るさと鮮やかさは同じ。
// その他だけ鮮やかさを落とす——「種類が無い」ことを色の弱さで表す。
const HUES = { yoji: 288, baito: 162, asobi: 42, other: 250 };
const CHROMA = { yoji: 40, baito: 40, asobi: 40, other: 12 };
// 今日。どの種類とも 60度以上離れた角度を選ぶ
const TODAY_H = 205;

const mkTypes = (L, C0) => Object.fromEntries(
  Object.entries(HUES).map(([k, h]) => [k, lch(L, CHROMA[k] * (C0 / 40), h)]));

const DARK = {
  name: '提案（暗い方）',
  bg: '#0B0D10', cell: '#12151A', line: '#1F252D', lineF: '#171C22',
  ink: '#E7EBF0', mut: '#8A939F', faint: '#565F6B',
  sun: lch(62, 42, 25), sat: lch(62, 34, 255),
  today: lch(72, 44, TODAY_H),
  ty: mkTypes(64, 40), tint: 0.24, edge: 0.85, radius: 6, dark: true,
};
const LIGHT = {
  name: '提案（明るい方）',
  bg: '#FAFBFC', cell: '#FFFFFF', line: '#E4E8ED', lineF: '#EFF2F5',
  ink: '#10141A', mut: '#69727E', faint: '#A3ABB5',
  sun: lch(46, 46, 25), sat: lch(46, 36, 255),
  today: lch(48, 40, TODAY_H),
  ty: mkTypes(46, 38), tint: 0.30, edge: 1, radius: 6, dark: false,
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, op) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;

// マスに入る幅で切る。日本語は1文字ぶん、英語はおよそ 0.56 文字ぶん。
// 切らずに描くと、隣のマスへ流れ出て「入っているように見える」嘘になる。
const wide = (ch) => (/[　-鿿＀-￯]/.test(ch) ? 1 : 0.56);
function fit(text, px, size) {
  const max = px / size;
  let w = 0, out = '';
  for (const ch of text) {
    if (w + wide(ch) > max) return `${out}…`;
    w += wide(ch);
    out += ch;
  }
  return out;
}

const JA = { yoji: ['ゼミ', '歯医者', '面談'], baito: ['マクド'], asobi: ['花火', '打ち上げ', 'ライブ', '映画'], other: ['受け取り', '返却'] };
const EN = { yoji: ['Seminar', 'Dentist', 'Interview'], baito: ['Shift'], asobi: ['Fireworks', 'Afterparty', 'Live show', 'Movie'], other: ['Pickup', 'Return'] };
const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];
const DOW_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// [日, [[種類, 確定か, 言葉の番号], ...], 今日か]
const WEEKS = [
  [[2, []], [3, [['baito', 1, 0]]], [4, []], [5, [['yoji', 1, 0]]],
   [6, [['baito', 1, 0], ['asobi', 0, 0]]], [7, []], [8, [['other', 1, 0]]]],
  [[9, []], [10, [['baito', 1, 0]]], [11, []], [12, [['asobi', 1, 0], ['yoji', 0, 1]]],
   [13, [['baito', 1, 0], ['other', 0, 1]], true], [14, []], [15, [['asobi', 0, 1]]]],
  [[16, []], [17, [['baito', 1, 0]]], [18, [['yoji', 1, 0]]], [19, [['baito', 0, 0]]],
   [20, [['other', 0, 1], ['yoji', 1, 0]]], [21, []], [22, [['baito', 1, 0]]]],
  [[23, [['asobi', 0, 2]]], [24, [['baito', 1, 0]]], [25, []], [26, [['yoji', 1, 2]]],
   [27, [['baito', 1, 0]]], [28, [['asobi', 1, 3]]], [29, []]],
];

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => `#${hexRgb(a).map((v, i) => Math.round(v * k + hexRgb(b)[i] * (1 - k)).toString(16).padStart(2, '0')).join('')}`;

function pill(T, x, y, w, [type, solid, wi], words) {
  const hue = T.ty[type], h = 17, r = T.radius;
  const label = fit(words[type][wi] || words[type][0], w - 12, 11);
  // 確定＝面あり＋縁。まだ＝縁だけ、しかも点線。
  // 面の有無と線の切れ目、2つで差をつける。片方だけだと暗い地で弱い。
  if (solid) {
    const face = mix(hue, T.cell, T.tint);
    // 面の上に置く字は、面を濃くしたぶんだけ離す。
    // 暗い方は色を白へ、明るい方は色を黒へ寄せる。ここを面と同じ色のままに
    // すると、濃くした瞬間に読めなくなる（一度 3.4 まで落とした）。
    const ink = T.dark ? mix(hue, '#ffffff', 0.22) : mix(hue, '#000000', 0.55);
    return rect(x, y, w, h, face, r)
      + `<rect x="${(x + 0.5) * S}" y="${(y + 0.5) * S}" width="${(w - 1) * S}" height="${(h - 1) * S}" rx="${(r - 0.5) * S}" fill="none" stroke="${hue}" stroke-width="${1 * S}" opacity="${T.edge}"/>`
      + t(x + 6, y + 12, label, 11, 500, ink);
  }
  return `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" fill="none" stroke="${hue}" stroke-width="${1.2 * S}" stroke-dasharray="${3 * S} ${2.5 * S}" opacity=".8"/>`
    + t(x + 6, y + 12, label, 11, 500, T.dark ? mix(hue, '#ffffff', 0.12) : mix(hue, '#000000', 0.25));
}

function screen(T, lang) {
  const words = lang === 'en' ? EN : JA;
  const dows = lang === 'en' ? DOW_EN : DOW_JA;
  let o = rect(0, 0, W, H, T.bg);
  // 見出し。月と年をひとかたまりにして、字間を広げる
  o += t(18, HEAD - 20, lang === 'en' ? 'August' : '8月', 22, 300, T.ink, null, -0.3);
  o += t(lang === 'en' ? 96 : 60, HEAD - 20, '2026', 13, 400, T.mut, null, 1.5);
  o += t(W - 18, HEAD - 21, lang === 'en' ? 'PAY' : '給料', 10, 700, T.mut, 'end', 1.4);
  dows.forEach((d, k) => {
    const col = k === 0 ? T.sun : k === 6 ? T.sat : T.mut;
    o += t(CW * k + CW / 2, HEAD + 16, d, lang === 'en' ? 8.5 : 9.5, 700, col, 'middle', 1.1);
  });
  o += rect(0, HEAD + WD - 0.5, W, 0.7, T.line);
  WEEKS.forEach((week, r) => {
    const y0 = HEAD + WD + r * CH;
    o += rect(0, y0, W, CH, T.cell);
    week.forEach(([day, bars, today], k) => {
      const x = CW * k;
      if (k < 6) o += rect(x + CW - 0.5, y0, 0.7, CH, T.lineF);
      if (today) o += rect(x, y0, CW, 2, T.today);
      const col = today ? T.today : (k === 0 ? T.sun : k === 6 ? T.sat : T.ink);
      o += t(x + 5, y0 + (today ? 17 : 15), String(day), 11.5, today ? 700 : 400, col, null, 0.2);
      bars.forEach((b, j) => { o += pill(T, x + 2, y0 + (today ? 25 : 23) + j * 20, CW - 4, b, words); });
    });
    o += rect(0, y0 + CH, W, 0.7, T.line);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`;
}

const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, gg, b] = hexRgb(h).map(lin); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  console.log('■ 種類の色（Lab で明るさと鮮やかさを揃えた）\n');
  for (const T of [DARK, LIGHT]) {
    const list = Object.entries(T.ty).map(([k, v]) => `${k} ${v}`).join('  ');
    console.log(`  ${T.name}  ${list}`);
    console.log(`     今日 ${T.today}   明るさのばらつき ${(Math.max(...Object.values(T.ty).map(lum)) / Math.min(...Object.values(T.ty).map(lum))).toFixed(2)} 倍`);
  }
  console.log('\n■ 塗り（決まってる）と まだ の差、および字の読みやすさ\n');
  for (const T of [DARK, LIGHT]) {
    const rows = Object.entries(T.ty).map(([k, hue]) => {
      const face = mix(hue, T.cell, T.tint);
      const ink = T.dark ? mix(hue, '#ffffff', 0.22) : mix(hue, '#000000', 0.55);
      const dash = T.dark ? mix(hue, '#ffffff', 0.12) : mix(hue, '#000000', 0.25);
      return `${k} 面差 ${cr(face, T.cell).toFixed(2)} 塗りの字 ${cr(ink, face).toFixed(2)} まだの字 ${cr(dash, T.cell).toFixed(2)}`;
    });
    console.log(`  ${T.name}`);
    console.log(`     ${rows.join('   ')}`);
  }

  const panels = [[DARK, 'ja'], [DARK, 'en'], [LIGHT, 'en']];
  const names = ['暗い方（日本語）', '暗い方（English）', '明るい方（English）'];
  const SC = 1.15, GAP = 22, PAD = 18, LABEL = 26;
  const imgs = [];
  for (let i = 0; i < panels.length; i += 1) {
    imgs.push(await sharp(Buffer.from(screen(panels[i][0], panels[i][1]))).resize(Math.round(W * SC)).png().toBuffer());
  }
  const cw = Math.round(W * SC), ch = Math.round(H * SC);
  const comp = [];
  imgs.forEach((buf, i) => {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#E8EAED">${esc(names[i])}</text></svg>`), top: PAD, left });
    comp.push({ input: buf, top: PAD + LABEL, left });
  });
  await sharp({ create: { width: PAD * 2 + panels.length * cw + (panels.length - 1) * GAP, height: PAD * 2 + LABEL + ch, channels: 3, background: '#1B1F26' } })
    .composite(comp).png().toFile('../store-assets/theme-global.png');
  console.log('\nできた');
})();
