// App Store の1枚目。未確定という考えを、絵だけでどこまで伝えられるか。
//
// 前提：見る人はアプリを知らない。5秒しか見ない。日本語を読めないかもしれない。
// なので「機能の説明」ではなく「二つある」ことだけを伝える。
//
// 実行: node tools/hero.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 2;
const W = 430, H = 932;

// 配色は Lab で揃えたもの（theme-global.cjs で作った値）
const BG = '#0B0D10', CELL = '#12151A', LINE = '#1F252D', LINEF = '#171C22';
const INK = '#E7EBF0', MUT = '#8A939F', FAINT = '#565F6B';
const TY = { yoji: '#8997df', baito: '#4cac84', asobi: '#d9856d', other: '#889eaf' };
const TODAY = '#00c5d1';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, op) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => `#${hexRgb(a).map((v, i) => Math.round(v * k + hexRgb(b)[i] * (1 - k)).toString(16).padStart(2, '0')).join('')}`;

/** 大きいピル。solid=決まっている */
function bigPill(x, y, w, h, hue, solid, label, time) {
  const r = 13;
  if (solid) {
    return rect(x, y, w, h, mix(hue, CELL, 0.26), r)
      + `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 1) * S}" fill="none" stroke="${hue}" stroke-width="${1.5 * S}"/>`
      + t(x + 20, y + h / 2 + 2, label, 18, 500, mix(hue, '#ffffff', 0.3))
      + t(x + w - 20, y + h / 2 + 2, time, 14, 400, mix(hue, '#ffffff', 0.05), 'end');
  }
  return `<rect x="${(x + 1) * S}" y="${(y + 1) * S}" width="${(w - 2) * S}" height="${(h - 2) * S}" rx="${(r - 1) * S}" fill="none" stroke="${hue}" stroke-width="${2 * S}" stroke-dasharray="${5 * S} ${4.5 * S}" opacity=".9"/>`
    + t(x + 20, y + h / 2 + 2, label, 18, 500, mix(hue, '#ffffff', 0.16))
    + t(x + w - 20, y + h / 2 + 2, time, 14, 400, mix(hue, '#ffffff', 0.02), 'end');
}

/** 小さいピル（月表示の中） */
function pill(x, y, w, hue, solid, label) {
  const h = 16, r = 5;
  if (solid) {
    return rect(x, y, w, h, mix(hue, CELL, 0.26), r)
      + `<rect x="${(x + 0.5) * S}" y="${(y + 0.5) * S}" width="${(w - 1) * S}" height="${(h - 1) * S}" rx="${(r - 0.5) * S}" fill="none" stroke="${hue}" stroke-width="${1 * S}"/>`
      + t(x + 5, y + 11.5, label, 10, 500, mix(hue, '#ffffff', 0.24));
  }
  return `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" fill="none" stroke="${hue}" stroke-width="${1.2 * S}" stroke-dasharray="${3 * S} ${2.5 * S}" opacity=".85"/>`
    + t(x + 5, y + 11.5, label, 10, 500, mix(hue, '#ffffff', 0.12));
}

const MONTH_JA = { Shift: 'マクド', Class: 'ゼミ', Party: '花火', Pickup: '受取', Trip: '合宿', Exam: '試験', Movie: '映画', Return: '返却' };
// 月表示のかけら。y0 から rows 週ぶん
const MONTH = [
  [[3, [['baito', 1, 'Shift']]], [4, []], [5, [['yoji', 1, 'Class']]], [6, [['asobi', 0, 'Party']]], [7, []], [8, [['other', 1, 'Pickup']]], [9, []]],
  [[10, [['baito', 1, 'Shift']]], [11, []], [12, [['asobi', 0, 'Trip']]], [13, [['baito', 1, 'Shift']], true], [14, []], [15, [['yoji', 0, 'Exam']]], [16, []]],
  [[17, [['baito', 1, 'Shift']]], [18, [['yoji', 1, 'Class']]], [19, [['baito', 0, 'Shift']]], [20, []], [21, [['asobi', 1, 'Movie']]], [22, []], [23, [['other', 0, 'Return']]]],
];
function month(y0, rows, cellH, dim, lang) {
  const cw = W / 7;
  let o = '';
  const dows = lang === 'ja' ? ['日', '月', '火', '水', '木', '金', '土'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  dows.forEach((d, i) => {
    o += t(cw * i + cw / 2, y0 - 10, d, 10, 700, FAINT, 'middle', 1.4);
  });
  o += rect(0, y0 - 2, W, 0.8, LINE);
  MONTH.slice(0, rows).forEach((week, r) => {
    const yy = y0 + r * cellH;
    o += rect(0, yy, W, cellH, CELL);
    week.forEach(([day, bars, today], k) => {
      const x = cw * k;
      if (k < 6) o += rect(x + cw - 0.5, yy, 0.8, cellH, LINEF);
      if (today) o += rect(x, yy, cw, 2.5, TODAY);
      o += t(x + 6, yy + 17, String(day), 12, today ? 700 : 400, today ? TODAY : INK);
      bars.forEach((b, j) => {
        const [ty, solid, label] = b;
        const word = lang === 'ja' ? (MONTH_JA[label] || label) : label;
        const g = dim && solid ? 0.4 : 1;
        o += `<g opacity="${g}">${pill(x + 3, yy + 24 + j * 19, cw - 6, TY[ty], solid, word)}</g>`;
      });
    });
    o += rect(0, yy + cellH, W, 0.8, LINE);
  });
  return o;
}

const CASES = {};

// 言葉。訳ではなく、それぞれの言語で書く。
// 3択はアプリの中の言葉に合わせる——ここが違うと、入れたあとで話が食い違う。
// 英語の "It happened" は「実際に起きた」で、このアプリの「確定した」とは別。
// 聞いているのは「決まったか」なので、on / off で揃える。
const TXT = {
  en: {
    a1: 'Not every plan', a2: 'is decided yet.',
    on: 'DECIDED', off: 'NOT YET',
    b1: 'It asks you later:', b2: 'so, is this on?',
    opts: [['It is on', TY.baito], ['It is off', MUT], ['Still not sure', TY.asobi]],
    shift: 'Shift', party: 'Party', size: 34, bsize: 30,
  },
  ja: {
    a1: '決まった予定と、', a2: 'まだの予定。',
    on: '決まってる', off: 'まだ',
    b1: 'あとで聞きます。', b2: 'その予定、どうなった？',
    opts: [['決まった', TY.baito], ['無くなった', MUT], ['まだ分からない', TY.asobi]],
    shift: 'マクド', party: '花火', size: 32, bsize: 28,
  },
};

// ---- 案A：二つ並べて、比べさせる ----
function heroA(lang) {
  const L = TXT[lang];
  let o = rect(0, 0, W, H, BG);
  o += t(34, 138, L.a1, L.size, 250, INK, null, -0.5);
  o += t(34, 138 + L.size * 1.3, L.a2, L.size, 250, INK, null, -0.5);
  o += t(34, 288, L.on, 11, 700, MUT, null, 2);
  o += bigPill(34, 302, W - 68, 56, TY.baito, true, L.shift, '17:00');
  o += t(34, 400, L.off, 11, 700, MUT, null, 2);
  o += bigPill(34, 414, W - 68, 56, TY.asobi, false, L.party, '20:00');
  o += month(560, 3, 96, false, lang);
  return o;
}

// ---- 案B：流れを見せる（点線 → どうなった？ → 塗り） ----
function heroB(lang) {
  const L = TXT[lang];
  let o = rect(0, 0, W, H, BG);
  o += t(34, 118, L.b1, L.bsize, 250, INK, null, -0.4);
  o += t(34, 118 + L.bsize * 1.35, L.b2, L.bsize, 250, INK, null, -0.4);
  o += bigPill(34, 210, W - 68, 54, TY.asobi, false, L.party, '20:00');
  o += `<path d="M${(W / 2) * S} ${280 * S} L${(W / 2) * S} ${318 * S}" stroke="${FAINT}" stroke-width="${1.5 * S}"/>`;
  o += `<path d="M${(W / 2 - 5) * S} ${312 * S} L${(W / 2) * S} ${320 * S} L${(W / 2 + 5) * S} ${312 * S}" fill="none" stroke="${FAINT}" stroke-width="${1.5 * S}"/>`;
  o += rect(28, 336, W - 56, 168, CELL, 18);
  o += `<rect x="${28 * S}" y="${336 * S}" width="${(W - 56) * S}" height="${168 * S}" rx="${18 * S}" fill="none" stroke="${LINE}" stroke-width="${1 * S}"/>`;
  L.opts.forEach(([label, col], i) => {
    const y = 356 + i * 46;
    o += rect(44, y, W - 88, 38, mix(col, CELL, 0.14), 10);
    o += t(60, y + 24, label, 15, 500, mix(col, '#ffffff', 0.34));
  });
  o += `<path d="M${(W / 2) * S} ${524 * S} L${(W / 2) * S} ${560 * S}" stroke="${FAINT}" stroke-width="${1.5 * S}"/>`;
  o += `<path d="M${(W / 2 - 5) * S} ${554 * S} L${(W / 2) * S} ${562 * S} L${(W / 2 + 5) * S} ${554 * S}" fill="none" stroke="${FAINT}" stroke-width="${1.5 * S}"/>`;
  o += bigPill(34, 578, W - 68, 54, TY.asobi, true, L.party, '20:00');
  o += month(720, 2, 96, false, lang);
  return o;
}

CASES['案A（English）'] = () => heroA('en');
CASES['案A（日本語）'] = () => heroA('ja');
CASES['案B（English）'] = () => heroB('en');
CASES['案B（日本語）'] = () => heroB('ja');

(async () => {
  const names = Object.keys(CASES);
  const SC = 0.42, GAP = 22, PAD = 18, LABEL = 26;
  const imgs = [];
  for (const n of names) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${CASES[n]()}</svg>`;
    imgs.push(await sharp(Buffer.from(svg)).resize(Math.round(W * S * SC)).png().toBuffer());
  }
  const cw = Math.round(W * S * SC), ch = Math.round(H * S * SC);
  const comp = [];
  imgs.forEach((buf, i) => {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#E8EAED">${esc(names[i])}</text></svg>`), top: PAD, left });
    comp.push({ input: buf, top: PAD + LABEL, left });
  });
  await sharp({ create: { width: PAD * 2 + names.length * cw + (names.length - 1) * GAP, height: PAD * 2 + LABEL + ch, channels: 3, background: '#1B1F26' } })
    .composite(comp).png().toFile('../store-assets/hero.png');
  console.log('できた');
})();
