// 「かわいい」方向のアイコン案。線画のカレンダー。
//
// 参考にした3つ（TimeTree ほか）に共通していたのは4つ:
//   1. 白い地
//   2. 黒い太線で描いた輪郭（型押しのような陰影ではなく、線）
//   3. 上にリング（綴じ具）
//   4. 中は点。数は少なく、大きい
//
// いまのアイコン（紙の型押し）はこの逆で、線を持たず陰影だけでできている。
// 小さくすると陰影は消えるが、線は残る。**白地でも黒い線は立つ**ので、
// 「白い四角が白地に溶ける」問題もここで一緒に解ける。
//
// このアプリの意味は落とさない —— **点のいくつかを点線の輪にする。**
// 決まった日は詰まった点、まだの日は点線の輪。
//
// 決まりごと（差し替えても守る）:
//   - 角を丸めない。iOS が自分でマスクをかけるので、こちらで丸めると縁に黒が残る
//   - 四隅まで地の色を敷く。透過も不可（App Store が許さない）
//   - 実際に出る画素数（180/120/87）で確かめる。ポイント数のまま測ると判断を誤る
//
// 実行: node tools/icon-cute.cjs
const sharp = require('sharp');
const N = 1024;
const F = "'Hiragino Sans','Yu Gothic',sans-serif";

const INK = '#1E2024';                 // 線の色。アプリの字と同じ
const GREEN = '#1D9E75';               // アプリが「次へ進む」に使っている色
const PAPER = '#FDF7EC';               // いまのアイコンの紙

const wrap = (bg, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">`
  + `<rect width="${N}" height="${N}" fill="${bg}"/>${inner}</svg>`;

/**
 * 線画のカレンダーを1つ描く。
 * @param sw  線の太さ。太いほど「かわいい」側に寄る
 * @param dots 点の並び。1=詰まった点（決まった）、0=点線の輪（まだ）
 * @param band 上に色の帯を敷くか
 */
function cal({ sw = 46, r = 96, band = null, dotR = 52, dots, ink = INK, bg = '#FFFFFF' }) {
  const x = 152, y = 286, w = N - x * 2, h = 620;
  let s = '';

  // 本体。白で塗ってから線を引く（帯を敷いたとき、下の線が透けない）
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${bg}"/>`;

  // 上の帯（色を1つだけ入れる案）。本体の丸角に合わせて切り抜く
  if (band) {
    s += `<clipPath id="c"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>`;
    s += `<g clip-path="url(#c)"><rect x="${x}" y="${y}" width="${w}" height="150" fill="${band}"/></g>`;
  }

  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`;

  // リング。上の辺をまたいで3つ。またぐので、線は本体の外にも中にも出る
  for (const cx of [x + w * 0.24, x + w * 0.5, x + w * 0.76]) {
    s += `<rect x="${cx - 34}" y="${y - 96}" width="68" height="150" rx="34"`
      + ` fill="${bg}" stroke="${ink}" stroke-width="${sw * 0.82}"/>`;
  }

  // 点。詰まった点＝決まった日、点線の輪＝まだの日
  const cols = 3, rows = 2;
  const gx = w / (cols + 1), gy = 190;
  const y0 = y + (band ? 300 : 250);
  dots.forEach((on, i) => {
    const cx = x + gx * ((i % cols) + 1), cy = y0 + gy * Math.floor(i / cols);
    if (on) { s += `<circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${ink}"/>`; return; }
    // 輪の線は、外の大きさを詰まった点と揃えたうえで細くする。
    // 太いまま半径を詰めると、点線が中央でつながって花のような形になる（一度そうなった）
    const ring = 22, rr = dotR - ring / 2, seg = (2 * Math.PI * rr) / 7;
    s += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${ink}" stroke-width="${ring}"`
      + ` stroke-linecap="butt" stroke-dasharray="${(seg * 0.58).toFixed(1)} ${(seg * 0.42).toFixed(1)}"/>`;
  });
  return s;
}

// 6つのうち2つを「まだ」にする。散らばって見えるように置く
const DOTS = [1, 0, 1, 1, 1, 0];

const IDEAS = {
  'いま（比べる用）': { src: true },
  'A｜線画・白地': { svg: wrap('#FFFFFF', cal({ dots: DOTS })) },
  'B｜線が太い（かわいさ寄り）': { svg: wrap('#FFFFFF', cal({ dots: DOTS, sw: 58, r: 116, dotR: 58 })) },
  'C｜上に緑の帯': { svg: wrap('#FFFFFF', cal({ dots: DOTS, band: GREEN })) },
  'D｜地を生成りに': { svg: wrap(PAPER, cal({ dots: DOTS, bg: PAPER })) },
};

// ---- 確かめ ----
const lum = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
async function measure(buf, px) {
  const { data, info } = await sharp(buf).resize(px, px, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const a = Math.floor(px * 0.2), b = Math.floor(px * 0.8);
  let mn = 255, mx = 0;
  for (let y = a; y < b; y++) for (let x = a; x < b; x++) { const v = data[y * info.width + x]; if (v < mn) mn = v; if (v > mx) mx = v; }
  return cr(mx, mn);
}
const SIZES = [['ホーム画面', 60, 180], ['Spotlight', 40, 120], ['設定', 29, 87]];

(async () => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const names = Object.keys(IDEAS);
  const bufs = {};
  for (const n of names) {
    const d = IDEAS[n];
    bufs[n] = d.src
      ? await sharp(`${__dirname}/../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`).resize(N, N, { fit: 'fill' }).png().toBuffer()
      : await sharp(Buffer.from(d.svg)).png().toBuffer();
  }

  console.log('中でいちばん明るいところと暗いところの差（実際に出る画素数で）\n');
  for (const n of names) {
    const cells = [];
    for (const [place, pt, px] of SIZES) cells.push(`${place} ${(await measure(bufs[n], px)).toFixed(2)}`);
    console.log(`  ${n.padEnd(24)} ${cells.join('   ')}`);
  }

  const BIG = 236, PAD = 20, GAP = 24, LABEL = 24, STRIP = 132, COLN = 5;
  const rowH = LABEL + BIG + 8 + STRIP + 26;
  const comp = [];
  for (let i = 0; i < names.length; i += 1) {
    const n = names[i];
    const left = PAD + (i % COLN) * (BIG + GAP), top = PAD + Math.floor(i / COLN) * rowH;
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${BIG + GAP}" height="${LABEL}"><text x="0" y="15" font-family="${F}" font-size="12" font-weight="700" fill="#1E2024">${esc(n)}</text></svg>`), top, left });
    comp.push({ input: await sharp(bufs[n]).resize(BIG, BIG).png().toBuffer(), top: top + LABEL, left });
    // 実際に出る大きさ。App Store の検索結果は白地なので、白の上に置く
    comp.push({ input: await sharp({ create: { width: BIG, height: STRIP, channels: 3, background: '#FFFFFF' } }).png().toBuffer(), top: top + LABEL + BIG + 8, left });
    let x = 10;
    for (const [place, pt, px] of SIZES) {
      const disp = Math.round((px / 3) * 1.6);
      comp.push({ input: await sharp(bufs[n]).resize(disp, disp).png().toBuffer(), top: top + LABEL + BIG + 26, left: left + x });
      comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${disp + 14}" height="16"><text x="0" y="12" font-family="${F}" font-size="9" fill="#6B7280">${esc(pt)}pt</text></svg>`), top: top + LABEL + BIG + 30 + disp, left: left + x });
      x += disp + 14;
    }
  }
  const rows = Math.ceil(names.length / COLN);
  await sharp({ create: { width: PAD * 2 + COLN * BIG + (COLN - 1) * GAP, height: PAD * 2 + rows * rowH, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile('../store-assets/icon-cute.png');
  console.log('\nできた store-assets/icon-cute.png');
})();
