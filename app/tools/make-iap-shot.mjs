// App内課金の審査用スクリーンショットを作る。
//
// 要件は 640×920 以上。実機で撮れるようになるまでの仮の1枚として使う。
// 提出の前には、実際にサポーターカードが出た画面に差し替えること。
//
// 実行: node tools/make-iap-shot.mjs
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'store-assets', 'iap-review-shot.png');

const W = 1242, H = 2208; // 要件（640×920）を大きく上回る、よくある比率

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#F6F7F9"/>

  <text x="90" y="240" font-family="${F}" font-size="46" font-weight="700" fill="#1E2024">設定</text>

  <text x="90" y="400" font-family="${F}" font-size="34" font-weight="600" fill="#82878F">${esc('開発を応援する')}</text>

  <rect x="72" y="440" width="${W - 144}" height="330" rx="40" fill="#FFFFFF" stroke="#E4E7EC" stroke-width="3"/>
  ${[['コーヒー1杯', '¥300', 0], ['ランチ1回', '¥600', 110], ['しっかり応援', '¥1,000', 220]]
    .map(([label, price, dy]) => `
    <text x="120" y="${515 + dy}" font-family="${F}" font-size="40" fill="#1E2024">${esc(label)}</text>
    <text x="${W - 120}" y="${515 + dy}" font-family="${F}" font-size="40" font-weight="700" fill="#4A4E55" text-anchor="end">${price}</text>
    ${dy < 220 ? `<line x1="120" y1="${548 + dy}" x2="${W - 120}" y2="${548 + dy}" stroke="#E4E7EC" stroke-width="2"/>` : ''}`).join('')}

  <text x="90" y="850" font-family="${F}" font-size="30" fill="#82878F">${esc('応援しても、増える機能はありません。')}</text>
  <text x="90" y="900" font-family="${F}" font-size="30" fill="#82878F">${esc('広告なし・通信なしのままで作りつづけます。')}</text>

  <text x="90" y="1060" font-family="${F}" font-size="34" font-weight="600" fill="#82878F">${esc('応援したあとに出るもの')}</text>
  <rect x="72" y="1100" width="${W - 144}" height="210" rx="40" fill="#FFFFFF" stroke="#E4E7EC" stroke-width="3"/>
  <circle cx="140" cy="1180" r="26" fill="#1D9E75"/>
  <text x="140" y="1194" font-family="${F}" font-size="30" font-weight="800" fill="#fff" text-anchor="middle">✓</text>
  <text x="190" y="1194" font-family="${F}" font-size="38" font-weight="700" fill="#1E2024">${esc('応援ありがとうございます')}</text>
  <text x="190" y="1262" font-family="${F}" font-size="44" font-weight="700" fill="#1E2024">¥600</text>
  <text x="330" y="1262" font-family="${F}" font-size="30" fill="#4A4E55">1回</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
const meta = await sharp(out).metadata();
console.log('wrote', out);
console.log(`大きさ: ${meta.width}×${meta.height}（要件は 640×920 以上）`);
