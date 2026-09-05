// アプリアイコンを書き出す。
//
// 紙に型押ししたもので、上の2本のスリットが「カレンダー」を担保し、
// 下の丸のグリッドが日を表す。**そのうち3つは点線の輪**で、これが未確定の日。
// 塗りと点線の二つが在ることがこのアプリの全部なので、アイコンにも入れてある。
// 色は持たない。
//
// 2026-09-04 まで、図案は tools/icon-source.png（写真のような1枚の絵）だった。
// 1枚の絵では丸を輪に変えられないので、**高さの地図に光を当てて描く**作りに変えた。
// 描き方と落とし穴は tools/icon-ideas.cjs の頭に書いてある。元の絵とは
// 画素ごとの差で平均 2 ほどしか違わない（icon-source.png は比べる用に残してある）。
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
const { render, slits, grid, BASE } = require('./icon-ideas.cjs');

// 図案。grid(true) が「12個のうち3つを点線の輪にする」
await sharp(await render([...slits(), ...grid(true)], BASE)).png().toFile(OUT);
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
console.log(`\n左上の隅: rgb(${avg.join(',')})  ← 地の色（254,247,237）と同じであること`);
