// サポーターカードの見本を段ごとに書き出す（見た目を決めるときの確認用）。
// アプリの中では sharecard.js がキャンバスに描く。こちらは絵を見るためだけのもの。
// 実行: node tools/make-card-preview.mjs
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'store-assets');

const W = 1080, H = Math.round(W / 1.586);
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const PAD = 62;

// App.jsx の CARD_TIERS と同じ値
const TIERS = [
  { key: 'normal', name: 'ノーマル', total: '¥600', times: '2回',
    paper: ['#F3EEE2', '#E7DFCE', '#F3EEE2'], foil: '#6B582F', mark: '#C8BFA6',
    sheen: 'rgba(255,252,240,.5)', edge: 'rgba(107,88,47,.3)', fleck: null,
    glint: [[30, '#ffffff', 0], [50, '#FFFCEE', 0.42], [70, '#ffffff', 0]] },
  { key: 'gold', name: 'ゴールド', total: '¥1,600', times: '3回',
    paper: ['#FDF6D6', '#D9B85F', '#F7E8AC', '#C9A544', '#F2DE9B'], foil: '#513706', mark: '#A9862C',
    sheen: 'rgba(255,250,214,.45)', edge: 'rgba(81,55,6,.44)', fleck: '#FFFDF0',
    glint: [[30, '#ffffff', 0], [44, '#FFF6C8', 0.5], [50, '#EDFBD9', 0.6], [56, '#FFEFC0', 0.5], [70, '#ffffff', 0]] },
  { key: 'black', name: 'ブラック', total: '¥3,600', times: '5回',
    paper: ['#2B2823', '#1B1915', '#2B2823'], foil: '#D8BC72', mark: '#7C6E4C',
    sheen: 'rgba(255,240,196,.24)', edge: 'rgba(216,188,114,.38)', fleck: '#F0DFA8',
    glint: [[30, '#ffffff', 0], [50, '#FFF0C4', 0.22], [70, '#ffffff', 0]] },
];

// 箔の粒の居場所（％）。App.jsx の FLECKS と同じ
const FLECKS = [[12,72],[26,34],[38,82],[47,18],[58,62],[66,28],[74,90],[83,46],[91,66],[19,50],[53,40],[88,20]];

for (const t of TIERS) {
  const ps = t.paper.map((c, i) => `<stop offset="${Math.round((i * 100) / (t.paper.length - 1))}%" stop-color="${c}"/>`).join('');
  const gs = t.glint.map(([o, c, a]) => `<stop offset="${o}%" stop-color="${c}" stop-opacity="${a}"/>`).join('');
  const fl = t.fleck
    ? FLECKS.map(([x, y], i) => `<circle cx="${((x / 100) * W).toFixed(0)}" cy="${((y / 100) * H).toFixed(0)}" r="${i % 3 === 0 ? 2.3 : 1.6}" fill="${t.fleck}" opacity="${i % 3 === 0 ? 0.85 : 0.5}"/>`).join('')
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="p" x1="0" y1="0" x2="1" y2="1">${ps}</linearGradient>
      <linearGradient id="g" x1="0.1" y1="0" x2="0.62" y2="1">${gs}</linearGradient>
      <linearGradient id="s" x1="0.18" y1="0" x2="0.52" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="50%" stop-color="${t.sheen}"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="c"><rect width="${W}" height="${H}" rx="34"/></clipPath>
    </defs>
    <g clip-path="url(#c)">
      <rect width="${W}" height="${H}" fill="url(#p)"/>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect width="${W}" height="${H}" fill="url(#s)"/>
      ${fl}
    </g>
    <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="33" fill="none" stroke="${t.edge}" stroke-width="3"/>
    <path d="M24 2 H ${W - 24}" stroke="rgba(255,255,255,.5)" stroke-width="2" fill="none"/>
    <path d="M24 ${H - 2} H ${W - 24}" stroke="rgba(0,0,0,.14)" stroke-width="2" fill="none"/>
    <text x="${PAD}" y="${PAD + 40}" font-family="${F}" font-size="40" font-weight="800" fill="${t.foil}">決まってる？</text>
    <text x="${PAD}" y="${PAD + 78}" font-family="${F}" font-size="23" font-weight="700" fill="${t.foil}">S U P P O R T E R</text>
    <text x="${W - PAD - 34}" y="${PAD + 44}" font-family="${F}" font-size="40" font-weight="700" fill="#1D9E75" text-anchor="end">✓</text>
    <text x="${W - PAD}" y="${PAD + 44}" font-family="${F}" font-size="40" font-weight="700" fill="${t.mark}" text-anchor="end">？</text>
    <text x="${PAD}" y="${H - PAD - 42}" font-family="${F}" font-size="34" font-weight="700" fill="${t.foil}">いわき かいと</text>
    <text x="${PAD}" y="${H - PAD}" font-family="${F}" font-size="22" font-weight="700" fill="${t.foil}">MEMBER SINCE 2026.06</text>
    <text x="${W - PAD}" y="${H - PAD - 34}" font-family="${F}" font-size="50" font-weight="800" fill="${t.foil}" text-anchor="end">${t.total}</text>
    <text x="${W - PAD}" y="${H - PAD}" font-family="${F}" font-size="22" font-weight="700" fill="${t.foil}" text-anchor="end">${t.times}</text>
  </svg>`;
  const out = join(outDir, `supporter-card-${t.key}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log('wrote', out);
}
