// 決めた配色を、いまの色と並べて見る。実寸 375 幅。
// 値は NEXT.md に書いたものをそのまま写している——ここと食い違ったら
// NEXT.md のほうが正。実装するときはあちらを見る。
// 実行: node tools/theme-decided.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;
const W = 375, HEAD = 52, WD = 26, CH = 100, ROWS = 4;
const CW = W / 7;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"/>`;

// 種類ごとに [色, 塗りの面, 塗りの字, まだの字]。まだの面は敷かない（地のまま）
const NOW = {
  bg: '#F6F7F9', cell: '#FFFFFF', line: '#E4E7EC', lineF: '#F1F3F6',
  ink: '#1E2024', mut: '#82878F', faint: '#B3B8C0',
  sun: '#B4453A', sat: '#3D6E9C', today: '#1E2024', radius: 4, edge: false,
  ty: {
    yoji: ['#8B7AB8', '#B0A5CF', '#2F293F', '#2F293F', '#D3CCE4'],
    baito: ['#7FAE85', '#A8C8AC', '#2B3B2D', '#2B3B2D', '#CEE0D1'],
    asobi: ['#D2916A', '#E0B49A', '#473124', '#473124', '#EED5C6'],
    other: ['#8A8A8A', '#AFAFAF', '#2F2F2F', '#2F2F2F', '#D3D3D3'],
  },
};
const LIGHT = {
  bg: '#FAFBFC', cell: '#FFFFFF', line: '#E4E8ED', lineF: '#EFF2F5',
  ink: '#10141A', mut: '#69727E', faint: '#A3ABB5',
  sun: '#b24c4f', sat: '#0074a7', today: '#00838d', radius: 6, edge: true,
  ty: {
    yoji: ['#5a6aa9', '#ced2e5', '#323a5d', '#171b2a', null],
    baito: ['#1b7c58', '#bbd8cd', '#0f4430', '#071f16', null],
    asobi: ['#a35944', '#e3cdc7', '#5a3125', '#291611', null],
    other: ['#5b707f', '#ced4d9', '#323e46', '#171c20', null],
  },
};
const DARK = {
  bg: '#0B0D10', cell: '#12151A', line: '#1F252D', lineF: '#171C22',
  ink: '#E7EBF0', mut: '#8A939F', faint: '#565F6B',
  sun: '#dc7a78', sat: '#509dcf', today: '#00c5d1', radius: 6, edge: true,
  ty: {
    yoji: ['#8997df', '#2f3449', '#e5e8f8', '#f1f3fb', null],
    baito: ['#4cac84', '#203933', '#d8ede4', '#eaf5f0', null],
    asobi: ['#d9856d', '#42302e', '#f7e4df', '#faf0ed', null],
    other: ['#889eaf', '#2e363e', '#e5eaed', '#f1f3f5', null],
  },
};

// いまのダークモード。色は明るい方と同じものを使っている——
// softFill も paper も inkOn も、地の明暗を見ていない。
// つまり「明るい方のピルを、暗い地の上にそのまま置いた」状態。
const mixc = (a, b, k) => {                    // a から b へ k
  const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  return `#${h(a).map((v, i) => Math.round(v * (1 - k) + h(b)[i] * k).toString(16).padStart(2, '0')).join('')}`;
};
const over = (a, bg, alpha) => {               // a を alpha で bg に重ねる
  const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  return `#${h(a).map((v, i) => Math.round(v * alpha + h(bg)[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
};
const NOW_DARK_CELL = '#26251F';
const nowDarkTyOn = (hue, paperHex, cell) => [
  mixc(hue, '#ffffff', 0.16),
  mixc(hue, '#ffffff', 0.32),
  mixc(hue, '#000000', 0.66),
  mixc(hue, '#000000', 0.66),
  over(paperHex, cell, 0.72),
];
const nowDarkTy = (hue, paperHex) => [
  mixc(hue, '#ffffff', 0.16),                  // softLine（点線の縁）
  mixc(hue, '#ffffff', 0.32),                  // softFill（塗りの面）
  mixc(hue, '#000000', 0.66),                  // inkOn（塗りの字）
  mixc(hue, '#000000', 0.66),                  // まだの字も同じ
  over(paperHex, NOW_DARK_CELL, 0.72),         // まだの面（紙を地に重ねる）
];
const NOW_DARK = {
  bg: '#1A1A17', cell: NOW_DARK_CELL, line: '#3A392F', lineF: '#2D2C25',
  ink: '#EDEBE1', mut: '#8C887C', faint: '#5E5C51',
  sun: '#B4453A', sat: '#3D6E9C', today: '#EDEBE1', radius: 4, edge: false,
  ty: {
    yoji: nowDarkTy('#8B7AB8', '#D3CCE4'),
    baito: nowDarkTy('#7FAE85', '#CEE0D1'),
    asobi: nowDarkTy('#D2916A', '#EED5C6'),
    other: nowDarkTy('#8A8A8A', '#D3D3D3'),
  },
};

// A：地も色もそのまま、作り方だけ地の明暗に合わせた場合。
// 塗り＝地に色を24%混ぜた面＋色の縁、まだ＝面なし・点線の縁だけ。
//
// 縁は飾りではなく必要。面だけだと 用事 #3e3944 と その他 #3e3d39 が
// ほとんど同じ色になり、**色＝種類 が壊れる**。縁が種類を運ぶ。
const A_CELL = '#26251F';
const aTy = (hue) => [
  hue,                                  // 縁と点線の色
  mixc(hue, A_CELL, 0.76),              // 塗りの面（色を24%残す）
  // 字は「色を22%だけ残した、ほぼ白」。mixc は a から b へ k なので 0.78。
  // ここを 0.22 にすると色が78%残った濃い字になり、面に近づく（一度やった）
  mixc(hue, '#ffffff', 0.78),           // 塗りの字
  mixc(hue, '#ffffff', 0.88),           // まだの字
  null,                                 // まだの面は敷かない
];
const NOW_DARK_FIXED = {
  bg: '#1A1A17', cell: A_CELL, line: '#3A392F', lineF: '#2D2C25',
  ink: '#EDEBE1', mut: '#8C887C', faint: '#5E5C51',
  // 日曜と土曜も地の明暗を見る。白へ30%で 4.92 / 5.21（元は 2.82 / 2.86）
  sun: mixc('#B4453A', '#ffffff', 0.30), sat: mixc('#3D6E9C', '#ffffff', 0.30),
  today: '#EDEBE1', radius: 4, edge: true,
  ty: {
    yoji: aTy('#8B7AB8'), baito: aTy('#7FAE85'),
    asobi: aTy('#D2916A'), other: aTy('#8A8A8A'),
  },
};

// B だけ：色は新しく（Lab で揃えたもの）、作り方はいまのまま。
// softFill は白へ32%、paper は白へ62% を 0.72 で重ねる、inkOn は黒へ66%。
// どれも地の明暗を見ていない——そこが直っていないと、暗い方はどうなるか。
const bOnlyTy = (hue, cell) => [
  mixc(hue, '#ffffff', 0.16),                        // softLine
  mixc(hue, '#ffffff', 0.32),                        // softFill（塗りの面）
  mixc(hue, '#000000', 0.66),                        // inkOn（塗りの字）
  mixc(hue, '#000000', 0.66),                        // まだの字も同じ
  over(mixc(hue, '#ffffff', 0.62), cell, 0.72),      // paper を地に重ねる
];
const B_HUES_L = { yoji: '#5a6aa9', baito: '#1b7c58', asobi: '#a35944', other: '#5b707f' };
const B_HUES_D = { yoji: '#8997df', baito: '#4cac84', asobi: '#d9856d', other: '#889eaf' };
const bOnly = (hues, base) => ({
  ...base,
  ty: Object.fromEntries(Object.entries(hues).map(([k, hue]) => [k, bOnlyTy(hue, base.cell)])),
});
// 明るい方はいまの地のまま、暗い方もいまの地のまま（B は色だけの話なので）
const B_ONLY_LIGHT = bOnly(B_HUES_L, {
  bg: '#F6F7F9', cell: '#FFFFFF', line: '#E4E7EC', lineF: '#F1F3F6',
  ink: '#1E2024', mut: '#82878F', faint: '#B3B8C0',
  sun: '#B4453A', sat: '#3D6E9C', today: '#1E2024', radius: 4, edge: false,
});
const B_ONLY_DARK = bOnly(B_HUES_D, {
  bg: '#1A1A17', cell: '#26251F', line: '#3A392F', lineF: '#2D2C25',
  ink: '#EDEBE1', mut: '#8C887C', faint: '#5E5C51',
  sun: '#B4453A', sat: '#3D6E9C', today: '#EDEBE1', radius: 4, edge: false,
});

// 地だけ替えた場合。ピルの作り方も色もいまのまま、暗い地だけ冷たい黒にする。
// まだの紙は 0.72 で重ねるので、地が暗くなっても 72% は紙のまま。
// つまり塗りとまだの差は、地を替えてもほとんど動かない。
const COOL_CELL = '#12151A';
const GROUND_ONLY = {
  bg: '#0B0D10', cell: COOL_CELL, line: '#1F252D', lineF: '#171C22',
  ink: '#EDEBE1', mut: '#8C887C', faint: '#5E5C51',
  sun: '#B4453A', sat: '#3D6E9C', today: '#EDEBE1', radius: 4, edge: false,
  ty: {
    yoji: nowDarkTyOn('#8B7AB8', '#D3CCE4', COOL_CELL),
    baito: nowDarkTyOn('#7FAE85', '#CEE0D1', COOL_CELL),
    asobi: nowDarkTyOn('#D2916A', '#EED5C6', COOL_CELL),
    other: nowDarkTyOn('#8A8A8A', '#D3D3D3', COOL_CELL),
  },
};

// A ＋ 冷たい地。作り方は A のまま、地だけ冷たい黒に替える。
// 色（種類の hue）は替えない＝移行もウィジェットの作り直しも要らない。
const AC_CELL = '#12151A';
const acTy = (hue) => [
  hue,
  mixc(hue, AC_CELL, 0.76),
  mixc(hue, '#ffffff', 0.78),
  mixc(hue, '#ffffff', 0.88),
  null,
];
const A_COOL = {
  bg: '#0B0D10', cell: AC_CELL, line: '#1F252D', lineF: '#171C22',
  ink: '#E7EBF0', mut: '#8A939F', faint: '#565F6B',
  sun: mixc('#B4453A', '#ffffff', 0.30), sat: mixc('#3D6E9C', '#ffffff', 0.30),
  today: '#E7EBF0', radius: 4, edge: true,
  ty: {
    yoji: acTy('#8B7AB8'), baito: acTy('#7FAE85'),
    asobi: acTy('#D2916A'), other: acTy('#8A8A8A'),
  },
};

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

function pill(C, x, y, w, [type, solid, label]) {
  const [hue, face, ink, dashInk, paper] = C.ty[type];
  const h = 17, r = C.radius;
  if (solid) {
    let o = rect(x, y, w, h, face, r);
    // 決めた案は面のうえに明るい縁を1本引く。いまの作りには縁が無い
    if (C.edge) o += `<rect x="${(x + 0.5) * S}" y="${(y + 0.5) * S}" width="${(w - 1) * S}" height="${(h - 1) * S}" rx="${(r - 0.5) * S}" fill="none" stroke="${hue}" stroke-width="${1 * S}"/>`;
    return o + t(x + 6, y + 12, label, 11, 500, ink);
  }
  // まだ。いまの作りは薄い紙を敷く、決めた案は地のまま（面の有無で差をつける）
  const bg = paper ? `fill="${paper}"` : 'fill="none"';
  return `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" ${bg} stroke="${hue}" stroke-width="${1.3 * S}" stroke-dasharray="${3 * S} ${2.6 * S}" opacity=".85"/>`
    + t(x + 6, y + 12, label, 11, 500, dashInk);
}

function screen(C) {
  const H = HEAD + WD + CH * ROWS;
  let o = rect(0, 0, W, H, C.bg);
  o += t(18, HEAD - 20, '8月', 22, 300, C.ink, null, -0.3);
  o += t(58, HEAD - 20, '2026', 13, 400, C.mut, null, 1.4);
  o += t(W - 18, HEAD - 21, '給料', 11, 600, C.mut, 'end', 1.2);
  ['日', '月', '火', '水', '木', '金', '土'].forEach((d, i) => {
    const col = i === 0 ? C.sun : i === 6 ? C.sat : C.mut;
    o += t(CW * i + CW / 2, HEAD + 16, d, 9.5, 700, col, 'middle', 1.1);
  });
  o += rect(0, HEAD + WD - 0.5, W, 0.7, C.line);
  WEEKS.forEach((week, r) => {
    const y0 = HEAD + WD + r * CH;
    o += rect(0, y0, W, CH, C.cell);
    week.forEach(([day, bars, today], k) => {
      const x = CW * k;
      if (k < 6) o += rect(x + CW - 0.5, y0, 0.7, CH, C.lineF);
      if (today) o += rect(x, y0, CW, 2, C.today);
      const col = today ? C.today : (k === 0 ? C.sun : k === 6 ? C.sat : C.ink);
      o += t(x + 5, y0 + (today ? 17 : 15), String(day), 11.5, today ? 700 : 400, col, null, 0.2);
      bars.forEach((b, j) => { o += pill(C, x + 2, y0 + (today ? 25 : 23) + j * 20, CW - 4, b); });
    });
    o += rect(0, y0 + CH, W, 0.7, C.line);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`;
}

(async () => {
  const list = [['いま・暗い方', NOW_DARK],
    ['A ＋ 冷たい地', A_COOL],
    ['（参考）A＋B・暗い方', DARK]];
  const SC = 1.2, GAP = 24, PAD = 18, LABEL = 26;
  const imgs = [];
  for (const [, C] of list) imgs.push(await sharp(Buffer.from(screen(C))).resize(Math.round(W * SC)).png().toBuffer());
  const cw = Math.round(W * SC), ch = Math.round((HEAD + WD + CH * ROWS) * SC);
  const comp = [];
  imgs.forEach((buf, i) => {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc(list[i][0])}</text></svg>`), top: PAD, left });
    comp.push({ input: buf, top: PAD + LABEL, left });
  });
  await sharp({ create: { width: PAD * 2 + list.length * cw + (list.length - 1) * GAP, height: PAD * 2 + LABEL + ch, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile('../store-assets/theme-acool.png');
  console.log('できた');
})();
