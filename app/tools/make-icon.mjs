// アプリアイコンを書き出す。
//
// 生成りの地に、炭色の細い線で描いたカレンダー。上にリング、中に6つの点。
// **そのうち2つは点線の輪**で、これが未確定の日。
// 決まった予定と、まだの予定。この二つが在ることがこのアプリの全部なので、
// アイコンにも入れてある。色は帯のくすんだ青だけ。
//
// 2026-09-08 まで、図案は紙に型押ししたものだった（tools/icon-ideas.cjs）。
// 陰影だけでできていて線を持たないため、小さくすると消え、白地でも輪郭が立たなかった
// （実際に出る画素数での差 2.75、白地との差 1.07）。線画に変えて 14.94 になった。
// 型押しの作りは icon-ideas.cjs に、比べた案は icon-cute.cjs / icon-nordic.cjs に残してある。
//
// 実行: node tools/make-icon.mjs
// （sharp は devDependencies にある。アプリ本体のビルドには使わない）
//
// 差し替えるときの決まりごと:
//   - 角を丸めない。iOS が自分でマスクをかけるので、こちらで丸めると縁に黒が残る
//   - 四隅まで地の色を敷く。透過も不可（App Store が許さない）
//   - 小さくしたときに模様が残るかは、下の「確かめ」の出力で見る

import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const OUT = join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');

const require = createRequire(import.meta.url);
const { wrap, cal, OAT, DUSTY, DOTS } = require('./icon-nordic.cjs');

// 採用したのは icon-nordic.cjs の C。生成りの地・炭の細線・くすんだ青の帯。
// 点のいくつかは点線の輪（DOTS の 0）。決まった＝詰まった点、まだ＝点線の輪。
// **アルファを必ず落とす。** SVG から起こすと4チャンネルになり、
// 透過が無くてもアルファの層があるだけで App Store は弾く。
await sharp(Buffer.from(wrap(OAT, cal({ dots: DOTS, band: DUSTY }))))
  .flatten({ background: OAT }).png().toFile(OUT);
console.log('wrote', OUT);

// ---- 確かめ ----
// iPhone は3倍解像度なので、実際に表示される画素数で見る。
// ポイント数のまま測ると6分の1の大きさで見ることになり、判断を誤る。
const lum = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2); };

console.log('\n表示される大きさごとの、紙と凹みの差');
for (const [place, pt, px] of [['ホーム画面', 60, 180], ['Spotlight', 40, 120], ['設定の一覧', 29, 87]]) {
  const { data, info } = await sharp(OUT).resize(px, px, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const a = Math.floor(px * 0.2), b = Math.floor(px * 0.8);
  let mn = 255, mx = 0;
  for (let y = a; y < b; y++) for (let x = a; x < b; x++) { const v = data[y * info.width + x]; if (v < mn) mn = v; if (v > mx) mx = v; }
  console.log(`  ${place.padEnd(12)} ${pt}pt (${px}px)  紙 ${mx} / 凹み ${mn}  コントラスト比 ${ratio(mx, mn)}`);
}

// 四隅が地の色で埋まっているか（丸めや透過が残っていると、iOS のマスクとずれる）
// **足並み（channels）を見て読む。** 3チャンネル決め打ちだと、4チャンネルの画像で
// 色が1つずつずれて混ざり、地の色と違って見える（一度そう読み違えた）。
const meta = await sharp(OUT).metadata();
const { data: cor, info: ci } = await sharp(OUT).extract({ left: 0, top: 0, width: 8, height: 8 })
  .raw().toBuffer({ resolveWithObject: true });
const avg = [0, 1, 2].map((i) => {
  let t = 0;
  for (let k = 0; k < 64; k += 1) t += cor[k * ci.channels + i];
  return Math.round(t / 64);
});
console.log(`\n左上の隅: rgb(${avg.join(',')})  ← 地の色（242,238,230）と同じであること`);
// アルファが残っていたら、そのまま出しても App Store が弾く。ここで止める
console.log(`アルファ: ${meta.hasAlpha ? '★残っている（このままでは弾かれる）' : '無し ✓'}`);
if (meta.hasAlpha) process.exit(1);
