// カードをどこまで「物」に見せられるか。いまの作りとリアル寄せを実寸で比べる。
// 実行: node tools/card-real.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 4;                       // 肌理を見たいので粗く描かない
const W = 335, H = 211, R = 18, PX = 22, PY = 20;

const PAPER = ['#FDF6D6', '#D9B85F', '#F7E8AC', '#C9A544', '#F2DE9B'];
const FOIL = '#513706', MARK = '#A9862C', EDGE = 'rgba(81,55,6,.44)';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls, extra) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}${extra || ''}>${esc(s)}</text>`;

const stops = PAPER.map((c, k) => `<stop offset="${(k * 100) / (PAPER.length - 1)}%" stop-color="${c}"/>`).join('');

// ---- 刷り目（ヘアライン）。金属を金属に見せているのは、この細い筋 ----
// 向きはグラデーションと同じ 150deg 側にそろえる。バラバラだと汚れに見える。
function brushed() {
  let o = '';
  const n = 150;
  for (let i = 0; i < n; i++) {
    const x = -H + (i * (W + H)) / n;
    const jitter = ((i * 7919) % 100) / 100;          // 決め打ちの揺らぎ
    const op = (0.020 + jitter * 0.030).toFixed(3);
    const wdt = (0.35 + jitter * 0.5).toFixed(2);
    const col = i % 3 === 0 ? '#ffffff' : '#4a3510';
    o += `<line x1="${x * S}" y1="${H * S}" x2="${(x + H) * S}" y2="0" stroke="${col}" stroke-width="${wdt * S}" opacity="${op}"/>`;
  }
  return o;
}

// ---- 粒子。紙にも金属にも、必ずある細かいムラ ----
function grain() {
  let o = '';
  for (let i = 0; i < 900; i++) {
    const a = (i * 2654435761) % 4294967296;
    const x = (a % 10007) / 10007 * W;
    const y = ((a >> 8) % 10009) / 10009 * H;
    const dark = i % 2 === 0;
    o += `<rect x="${x * S}" y="${y * S}" width="${0.8 * S}" height="${0.8 * S}" fill="${dark ? '#3a2a08' : '#fffdf0'}" opacity="${dark ? 0.035 : 0.05}"/>`;
  }
  return o;
}

// ---- 面取り。光は左上から。上と左は明るく、下と右は暗い ----
// **縁にだけ**かける。面にかけると、ただ暗くなって汚れに見えた（一度そうなった）。
function bevel() {
  return `
   <linearGradient id="bev" x1="0" y1="0" x2="0.6" y2="1">
     <stop offset="0%" stop-color="#fffbe8" stop-opacity=".85"/>
     <stop offset="45%" stop-color="#fffbe8" stop-opacity="0"/>
     <stop offset="62%" stop-color="#2a1c02" stop-opacity="0"/>
     <stop offset="100%" stop-color="#2a1c02" stop-opacity=".55"/>
   </linearGradient>`;
}

// 落ち影。いまは1枚、リアル寄せは接地の濃い影と広い環境の影で2枚
const shadow = `
  <filter id="sh1" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="${14 * S}" stdDeviation="${17 * S}" flood-color="#26251F" flood-opacity="0.18"/>
  </filter>
  <filter id="sh" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="${2 * S}" stdDeviation="${2.5 * S}" flood-color="#26251F" flood-opacity="0.30"/>
    <feDropShadow dx="0" dy="${14 * S}" stdDeviation="${17 * S}" flood-color="#26251F" flood-opacity="0.18"/>
  </filter>`;

// 文字。deep=true で「押し込まれた」影の付け方にする
function label(deep) {
  const up = deep ? ` filter="url(#press)"` : '';
  let o = '';
  const line = (x, y, s, size, w, color, anchor, ls) => {
    if (!deep) {
      // いま：下に明かり1本だけ＝浮き出しに見える
      return t(x, y + 0.6, s, size, w, 'rgba(255,255,255,.6)', anchor, ls) + t(x, y, s, size, w, color, anchor, ls);
    }
    // リアル寄せ：上に影、下に明かり＝紙に沈んで見える
    return t(x, y - 0.5, s, size, w, 'rgba(60,40,4,.45)', anchor, ls)
         + t(x, y + 0.8, s, size, w, 'rgba(255,252,232,.75)', anchor, ls)
         + t(x, y, s, size, w, color, anchor, ls);
  };
  o += line(PX, PY + 15, '決まってる？', 17, 400, FOIL);
  o += line(PX, PY + 31, 'SUPPORTER', 10, 700, FOIL, null, 1.4);
  o += `<g opacity="0.65">` + line(W - PX, PY + 14, 'GOLD', 11, 700, FOIL, 'end', 1.6) + `</g>`;
  o += line(PX, H - PY - 14, 'いわき かいと', 15, 400, FOIL);
  o += line(PX, H - PY - 1, 'MEMBER SINCE 2026.06', 10, 700, FOIL, null, 1.2);
  o += line(W - PX, H - PY - 6, '¥1,600', 30, 300, FOIL, 'end');
  return o;
}

function card(real) {
  const M = 26;                                  // 影のぶんの余白
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(W + M * 2) * S}" height="${(H + M * 2) * S}">
   <defs>
     <linearGradient id="p" x1="0" y1="0" x2="0.87" y2="0.5">${stops}</linearGradient>
     <clipPath id="c"><rect x="0" y="0" width="${W * S}" height="${H * S}" rx="${R * S}"/></clipPath>
     ${bevel()}${shadow}
   </defs>
   <rect x="0" y="0" width="${(W + M * 2) * S}" height="${(H + M * 2) * S}" fill="#DDE1E8"/>
   <g transform="translate(${M * S},${M * S})" filter="${real ? 'url(#sh)' : 'url(#sh1)'}">

     <g clip-path="url(#c)">
       <rect x="0" y="0" width="${W * S}" height="${H * S}" fill="url(#p)"/>
       ${real ? brushed() + grain() : ''}
       <rect x="0" y="0" width="${W * S}" height="${H * S}" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="${2 * S}"/>
       ${real ? `<rect x="${1.2 * S}" y="${1.2 * S}" width="${(W - 2.4) * S}" height="${(H - 2.4) * S}" rx="${(R - 1.2) * S}" fill="none" stroke="url(#bev)" stroke-width="${2.4 * S}"/>` : ''}
     </g>
     <rect x="${0.5 * S}" y="${0.5 * S}" width="${(W - 1) * S}" height="${(H - 1) * S}" rx="${R * S}" fill="none" stroke="${EDGE}" stroke-width="${1 * S}"/>
     <g>${label(real)}</g>
   </g>
  </svg>`;
}

(async () => {
  const M = 26, SC = 1.55, GAP = 22, PAD = 20, LABEL = 26;
  const names = ['いま', 'リアル寄せ（刷り目・粒子・面取り・沈んだ箔・影2枚）'];
  const imgs = [];
  for (let i = 0; i < 2; i++)
    imgs.push({ n: names[i], buf: await sharp(Buffer.from(card(i === 1))).resize(Math.round((W + M * 2) * SC)).png().toBuffer() });
  // 表面だけを2倍で切り出す
  const crops = [];
  for (let i = 0; i < 2; i++) {
    const full = await sharp(Buffer.from(card(i === 1))).png().toBuffer();
    crops.push(await sharp(full)
      .extract({ left: Math.round((M + 120) * S), top: Math.round((M + 60) * S), width: Math.round(110 * S), height: Math.round(56 * S) })
      .resize(Math.round(110 * S * 1.5)).png().toBuffer());
  }
  const cw = Math.round((W + M * 2) * SC), ch = Math.round((H + M * 2) * SC);
  const kw = Math.round(110 * S * 1.5), kh = Math.round(56 * S * 1.5);
  const comp = [];
  imgs.forEach((im, i) => {
    const top = PAD + i * (ch + GAP + LABEL);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc(im.n)}</text></svg>`), top, left: PAD });
    comp.push({ input: im.buf, top: top + LABEL, left: PAD });
  });
  const yk = PAD + 2 * (ch + GAP + LABEL);
  comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc('表面を6倍で（左＝いま／右＝リアル寄せ）')}</text></svg>`), top: yk, left: PAD });
  comp.push({ input: crops[0], top: yk + LABEL, left: PAD });
  comp.push({ input: crops[1], top: yk + LABEL, left: PAD + kw + 14 });
  await sharp({ create: { width: Math.max(PAD * 2 + cw, PAD * 2 + kw * 2 + 14), height: yk + LABEL + kh + PAD, channels: 3, background: '#DDE1E8' } })
    .composite(comp).png().toFile('../store-assets/card-real.png');
  console.log('できた');
})();
