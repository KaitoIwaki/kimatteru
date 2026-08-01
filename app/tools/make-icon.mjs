// アプリアイコンを書き出す。
// 図案は tools/icon-source.png。紙に型押ししたもので、上の2本のスリットが
// 「カレンダー」を担保し、下の丸のグリッドが日を表す。色は持たない。
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

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SRC = join(here, 'icon-source.png');
const OUT = join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');

// 地の色。四隅がこの色で埋まっている前提（透過が混じっていてもこれで潰す）
const PAPER = '#FDF7EC';

await sharp(SRC)
  .resize(1024, 1024, { fit: 'fill' })
  .flatten({ background: PAPER })
  .png()
  .toFile(OUT);

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
const corner = await sharp(OUT).extract({ left: 0, top: 0, width: 8, height: 8 }).raw().toBuffer();
const avg = [0, 1, 2].map((i) => Math.round([...corner].filter((_, k) => k % 3 === i).reduce((s, v) => s + v, 0) / (corner.length / 3)));
console.log(`\n左上の隅: rgb(${avg.join(',')})  ← 地の色と同じであること`);
