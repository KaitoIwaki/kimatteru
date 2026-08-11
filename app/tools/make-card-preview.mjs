// サポーターカードの見本を1枚書き出す（見た目を決めるときの確認用）。
// アプリの中では sharecard.js がキャンバスに描くが、こちらは絵を見るためだけのもの。
// 実行: node tools/make-card-preview.mjs
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'store-assets', 'supporter-card-preview.png');

const W = 1080, H = Math.round(W / 1.586);
const PAPER = '#F3EEE2', PAPER2 = '#E7DFCE', FOIL = '#6B582F';
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const PAD = 62;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PAPER}"/><stop offset="55%" stop-color="${PAPER2}"/><stop offset="100%" stop-color="${PAPER}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0.18" y1="0" x2="0.52" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="50%" stop-color="#FFFCF0" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="34" fill="url(#paper)"/>
  <rect width="${W}" height="${H}" rx="34" fill="url(#sheen)"/>
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="33" fill="none" stroke="rgba(107,88,47,.32)" stroke-width="3"/>

  <text x="${PAD}" y="${PAD + 40}" font-family="${F}" font-size="40" font-weight="800" fill="${FOIL}">決まってる？</text>
  <text x="${PAD}" y="${PAD + 78}" font-family="${F}" font-size="23" font-weight="700" fill="${FOIL}">S U P P O R T E R</text>
  <text x="${W - PAD - 34}" y="${PAD + 44}" font-family="${F}" font-size="40" font-weight="700" fill="#1D9E75" text-anchor="end">✓</text>
  <text x="${W - PAD}" y="${PAD + 44}" font-family="${F}" font-size="40" font-weight="700" fill="#C8BFA6" text-anchor="end">？</text>

  <text x="${PAD}" y="${H - PAD - 42}" font-family="${F}" font-size="34" font-weight="700" fill="${FOIL}">いわき かいと</text>
  <text x="${PAD}" y="${H - PAD}" font-family="${F}" font-size="22" font-weight="700" fill="${FOIL}">MEMBER SINCE 2026.06</text>
  <text x="${W - PAD}" y="${H - PAD - 34}" font-family="${F}" font-size="50" font-weight="800" fill="${FOIL}" text-anchor="end">¥1,900</text>
  <text x="${W - PAD}" y="${H - PAD}" font-family="${F}" font-size="22" font-weight="700" fill="${FOIL}" text-anchor="end">3回</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log('wrote', out);
