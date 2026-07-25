// アプリアイコンを生成する。図案はアプリの核そのもの —
// 塗られた棒（決まってる）と、点線の棒（まだ不確定）。
// 実行: npm i -D sharp && node tools/make-icon.mjs
// （sharp は普段のビルドに不要なので依存に入れていない。作り直すときだけ入れる）
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const PAPER = '#FAF9F4';
const TEAL = '#1D9E75';
const TEAL_PAPER = '#E1F5EE';

// 1024 の中央に、塗り1本＋点線1本。余白をたっぷり取って「静かな文房具」に寄せる。
const W = 1024;
const barW = 560;
const barH = 132;
const r = barH / 2;
const x = (W - barW) / 2;
const yTop = 342;
const yBottom = 342 + barH + 78;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <rect width="${W}" height="${W}" fill="${PAPER}"/>
  <rect x="${x}" y="${yTop}" width="${barW}" height="${barH}" rx="${r}" fill="${TEAL}"/>
  <rect x="${x}" y="${yBottom}" width="${barW}" height="${barH}" rx="${r}"
        fill="${TEAL_PAPER}" stroke="${TEAL}" stroke-width="14" stroke-dasharray="42 34" stroke-linecap="round"/>
</svg>`;

mkdirSync(join(root, 'tools'), { recursive: true });
writeFileSync(join(root, 'tools', 'icon.svg'), svg);

const out = join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');

// App Store は透過を許さないので、必ず不透明な地の上に描く
await sharp(Buffer.from(svg))
  .flatten({ background: PAPER })
  .png()
  .toFile(out);

console.log('wrote', out);
