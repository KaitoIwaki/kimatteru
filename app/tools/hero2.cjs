// App Store の1枚目、作り込んだ版。
//
// 凝るといっても、飾りを足すのではない。**このアプリの文法で凝る。**
//  ・見出しの「決まった」に実線、「まだ」に点線を引く。
//    宣伝の文字そのものが、アプリの決まりを説明している状態にする。
//  ・決まった予定には影を落とし、まだの予定には落とさない。
//    決まったものは重さを持ち、まだのものは浮いている——という理屈。
//  ・地は真っ黒にせず、光源を左上に置いた面にする。細い格子と粒子を敷く。
//    無地の黒は「作っていない」に見え、面は「作った」に見える。
//
// 実行: node tools/hero2.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 2;
const W = 430, H = 932;

const CELL = '#12151A', LINE = '#1F252D', LINEF = '#171C22';
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

// 文字の幅を測る。下線を引くのに要る——長さを勘で決めると必ずずれる。
// 英字を一律 0.56 で見ていたら、下線が語からはみ出した。
// 大文字・小文字・記号・空白で幅が違うので、そこまで分ける。
const wide = (ch) => {
  if (/[　-鿿＀-￯]/.test(ch)) return 1;      // 日本語
  if (ch === ' ') return 0.26;
  if (/[.,;:'’!|]/.test(ch)) return 0.28;
  if (/[ilj]/.test(ch)) return 0.25;
  if (/[frt]/.test(ch)) return 0.34;
  if (/[A-Z]/.test(ch)) return 0.63;
  if (/[mw]/.test(ch)) return 0.86;
  return 0.55;
};
const tw = (s, size) => [...s].reduce((a, c) => a + wide(c), 0) * size;

/** 地。左上に光源を置いた面。細い格子と粒子を敷いて「作った面」にする */
function ground(id) {
  let o = `<defs>
    <radialGradient id="bg${id}" cx="18%" cy="10%" r="105%">
      <stop offset="0%" stop-color="#171D28"/>
      <stop offset="55%" stop-color="#0B0E14"/>
      <stop offset="100%" stop-color="#05070A"/>
    </radialGradient>
    <filter id="sh${id}" x="-40%" y="-40%" width="180%" height="200%">
      <feDropShadow dx="0" dy="${5 * S}" stdDeviation="${7 * S}" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <filter id="soft${id}" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${26 * S}"/>
    </filter>
  </defs>`;
  o += rect(0, 0, W, H, `url(#bg${id})`);
  // 細い格子。40pt ごと、ほとんど見えない濃さで
  for (let x = 0; x <= W; x += 40) o += rect(x, 0, 0.5, H, '#8FA6C8', 0, 0.05);
  for (let y = 0; y <= H; y += 40) o += rect(0, y, W, 0.5, '#8FA6C8', 0, 0.04);
  // 粒子。決め打ちの位置で、開くたびに変わらないように
  const rnd = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 420; i += 1) {
    o += rect(rnd(i * 2 + 1) * W, rnd(i * 2 + 2) * H, 0.9, 0.9, i % 2 ? '#C8D6EC' : '#000000', 0, i % 2 ? 0.05 : 0.05);
  }
  return o;
}

/** 見出しの語に線を引く。solid=実線／dashed=点線。アプリの決まりをそのまま使う */
function underline(x, y, w, solid, color) {
  if (solid) return rect(x, y, w, 2, color, 1);
  return `<line x1="${x * S}" y1="${(y + 1) * S}" x2="${(x + w) * S}" y2="${(y + 1) * S}" stroke="${color}" stroke-width="${2 * S}" stroke-dasharray="${4 * S} ${3.5 * S}" stroke-linecap="round" opacity=".75"/>`;
}

function bigPill(id, x, y, w, h, hue, solid, label, time) {
  const r = 14;
  if (solid) {
    // 決まったものは影を落とす。重さがあるという理屈
    return `<g filter="url(#sh${id})">${rect(x, y, w, h, mix(hue, CELL, 0.28), r)}</g>`
      + `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 1) * S}" fill="none" stroke="${hue}" stroke-width="${1.5 * S}"/>`
      + t(x + 22, y + h / 2 + 2, label, 18, 500, mix(hue, '#ffffff', 0.34))
      + t(x + w - 22, y + h / 2 + 2, time, 14, 400, mix(hue, '#ffffff', 0.06), 'end');
  }
  // まだのものは影を落とさない。浮いているという理屈
  return `<rect x="${(x + 1) * S}" y="${(y + 1) * S}" width="${(w - 2) * S}" height="${(h - 2) * S}" rx="${(r - 1) * S}" fill="none" stroke="${hue}" stroke-width="${2 * S}" stroke-dasharray="${5.5 * S} ${5 * S}" stroke-linecap="round" opacity=".92"/>`
    + t(x + 22, y + h / 2 + 2, label, 18, 500, mix(hue, '#ffffff', 0.18))
    + t(x + w - 22, y + h / 2 + 2, time, 14, 400, mix(hue, '#ffffff', 0.02), 'end');
}

function pill(x, y, w, hue, solid, label) {
  const h = 16, r = 5;
  if (solid) {
    return rect(x, y, w, h, mix(hue, CELL, 0.26), r)
      + `<rect x="${(x + 0.5) * S}" y="${(y + 0.5) * S}" width="${(w - 1) * S}" height="${(h - 1) * S}" rx="${(r - 0.5) * S}" fill="none" stroke="${hue}" stroke-width="${1 * S}"/>`
      + t(x + 5, y + 11.5, label, 10, 500, mix(hue, '#ffffff', 0.26));
  }
  return `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" fill="none" stroke="${hue}" stroke-width="${1.2 * S}" stroke-dasharray="${3 * S} ${2.5 * S}" opacity=".85"/>`
    + t(x + 5, y + 11.5, label, 10, 500, mix(hue, '#ffffff', 0.14));
}

const MONTH_JA = { Shift: 'マクド', Class: 'ゼミ', Party: '花火', Pickup: '受取', Trip: '合宿', Exam: '試験', Movie: '映画', Return: '返却' };
const MONTH = [
  [[3, [['baito', 1, 'Shift']]], [4, []], [5, [['yoji', 1, 'Class']]], [6, [['asobi', 0, 'Party']]], [7, []], [8, [['other', 1, 'Pickup']]], [9, []]],
  [[10, [['baito', 1, 'Shift']]], [11, []], [12, [['asobi', 0, 'Trip']]], [13, [['baito', 1, 'Shift']], true], [14, []], [15, [['yoji', 0, 'Exam']]], [16, []]],
  [[17, [['baito', 1, 'Shift']]], [18, [['yoji', 1, 'Class']]], [19, [['baito', 0, 'Shift']]], [20, []], [21, [['asobi', 1, 'Movie']]], [22, []], [23, [['other', 0, 'Return']]]],
];

/** 画面を「板」として置く。角を丸め、縁に光を1本、下に影。切って画面外へ流す */
function device(id, x, y, w, rows, lang) {
  const cw = w / 7, cellH = 96, r = 26;
  const h = 30 + rows * cellH + 40;
  let o = `<g filter="url(#sh${id})">${rect(x, y, w, h, CELL, r)}</g>`;
  o += `<clipPath id="dv${id}"><rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}"/></clipPath>`;
  o += `<g clip-path="url(#dv${id})">`;
  const dows = lang === 'ja' ? ['日', '月', '火', '水', '木', '金', '土'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  dows.forEach((d, i) => { o += t(x + cw * i + cw / 2, y + 20, d, 9.5, 700, FAINT, 'middle', 1.3); });
  o += rect(x, y + 29, w, 0.8, LINE);
  MONTH.slice(0, rows).forEach((week, ri) => {
    const yy = y + 30 + ri * cellH;
    week.forEach(([day, bars, today], k) => {
      const cx = x + cw * k;
      if (k < 6) o += rect(cx + cw - 0.5, yy, 0.8, cellH, LINEF);
      if (today) o += rect(cx, yy, cw, 2.5, TODAY);
      o += t(cx + 6, yy + 17, String(day), 12, today ? 700 : 400, today ? TODAY : INK);
      bars.forEach((b, j) => {
        const [ty, solid, label] = b;
        const word = lang === 'ja' ? (MONTH_JA[label] || label) : label;
        o += pill(cx + 3, yy + 24 + j * 19, cw - 6, TY[ty], solid, word);
      });
    });
    o += rect(x, yy + cellH, w, 0.8, LINE);
  });
  o += `</g>`;
  // 縁の光。左上を明るく
  o += `<rect x="${(x + 0.5) * S}" y="${(y + 0.5) * S}" width="${(w - 1) * S}" height="${(h - 1) * S}" rx="${r * S}" fill="none" stroke="#A9BBD4" stroke-width="${1 * S}" opacity=".14"/>`;
  return o;
}

const TXT = {
  en: {
    eyebrow: 'A CALENDAR FOR PLANS THAT AREN’T SET',
    a1: ['Some plans ', 'are set', '.'], a2: ['Some are still ', 'maybe', '.'],
    on: 'SET', off: 'MAYBE',
    b1: 'It asks you later:', b2: 'so, is this on?',
    opts: [['It is on', TY.baito], ['It is off', MUT], ['Still not sure', TY.asobi]],
    shift: 'Shift', party: 'Party', size: 30, bsize: 29,
  },
  ja: {
    eyebrow: 'まだ決まっていない予定の、カレンダー',
    a1: ['', '決まった', '予定と、'], a2: ['', 'まだ', 'の予定。'],
    on: '決まってる', off: 'まだ',
    b1: 'あとで聞きます。', b2: 'その予定、どうなった？',
    opts: [['決まった', TY.baito], ['無くなった', MUT], ['まだ分からない', TY.asobi]],
    shift: 'マクド', party: '花火', size: 32, bsize: 28,
  },
};

// 見出し1行。[前, 線を引く語, 後] で受けて、その語だけに線を引く
function headline(x, y, parts, size, solid) {
  const [pre, key, post] = parts;
  let o = t(x, y, pre + key + post, size, 250, INK, null, -0.5);
  const kx = x + tw(pre, size);
  o += underline(kx, y + size * 0.3, tw(key, size), solid, solid ? INK : mix(INK, CELL, 0.55));
  return o;
}

function heroA(lang, id) {
  const L = TXT[lang];
  let o = ground(id);
  o += t(34, 92, L.eyebrow, 10, 700, mix(MUT, FAINT, 0.55), null, 1.8);
  o += headline(34, 152, L.a1, L.size, true);
  o += headline(34, 152 + L.size * 1.34, L.a2, L.size, false);
  o += t(34, 300, L.on, 10, 700, MUT, null, 2.2);
  o += bigPill(id, 34, 314, W - 68, 58, TY.baito, true, L.shift, '17:00');
  o += t(34, 416, L.off, 10, 700, MUT, null, 2.2);
  o += bigPill(id, 34, 430, W - 68, 58, TY.asobi, false, L.party, '20:00');
  o += device(id, 30, 560, W - 60, 3, lang);
  return o;
}

function heroB(lang, id) {
  const L = TXT[lang];
  let o = ground(id);
  o += t(34, 92, L.eyebrow, 10, 700, mix(MUT, FAINT, 0.55), null, 1.8);
  o += t(34, 148, L.b1, L.bsize, 250, INK, null, -0.4);
  o += t(34, 148 + L.bsize * 1.34, L.b2, L.bsize, 250, INK, null, -0.4);
  o += bigPill(id, 34, 250, W - 68, 56, TY.asobi, false, L.party, '20:00');
  // つなぎは矢印ではなく、細い線と点。矢印より静かで、目が流れる
  o += `<line x1="${(W / 2) * S}" y1="${322 * S}" x2="${(W / 2) * S}" y2="${352 * S}" stroke="${FAINT}" stroke-width="${1 * S}" opacity=".7"/>`;
  o += `<circle cx="${(W / 2) * S}" cy="${356 * S}" r="${2.2 * S}" fill="${FAINT}"/>`;
  o += `<g filter="url(#sh${id})">${rect(28, 372, W - 56, 172, CELL, 20)}</g>`;
  o += `<rect x="${28 * S}" y="${372 * S}" width="${(W - 56) * S}" height="${172 * S}" rx="${20 * S}" fill="none" stroke="#A9BBD4" stroke-width="${1 * S}" opacity=".12"/>`;
  L.opts.forEach(([label, col], i) => {
    const y = 394 + i * 46;
    o += rect(44, y, W - 88, 38, mix(col, CELL, 0.16), 11);
    o += t(62, y + 24, label, 15, 500, mix(col, '#ffffff', 0.36));
  });
  o += `<line x1="${(W / 2) * S}" y1="${560 * S}" x2="${(W / 2) * S}" y2="${590 * S}" stroke="${FAINT}" stroke-width="${1 * S}" opacity=".7"/>`;
  o += `<circle cx="${(W / 2) * S}" cy="${594 * S}" r="${2.2 * S}" fill="${FAINT}"/>`;
  o += bigPill(id, 34, 610, W - 68, 56, TY.asobi, true, L.party, '20:00');
  o += device(id, 30, 706, W - 60, 2, lang);
  return o;
}

const CASES = {
  '案A（日本語）': (id) => heroA('ja', id),
  '案A（English）': (id) => heroA('en', id),
  '案B（日本語）': (id) => heroB('ja', id),
  '案B（English）': (id) => heroB('en', id),
};

(async () => {
  const names = Object.keys(CASES);
  const SC = 0.42, GAP = 22, PAD = 18, LABEL = 26;
  const imgs = [];
  for (let i = 0; i < names.length; i += 1) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${CASES[names[i]](i)}</svg>`;
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
    .composite(comp).png().toFile('../store-assets/hero2.png');
  console.log('できた');
})();
