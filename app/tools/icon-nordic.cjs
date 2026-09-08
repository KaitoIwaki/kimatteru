// 線画のカレンダーを、北欧風（綺麗め）に振った案。
//
// icon-cute.cjs との違いは4つ。飾りを足すのではなく、引く方向。
//   1. 地が純白ではなく生成り（オート）。白は硬い
//   2. 線が細く、太さが均一。黒ではなく炭色
//   3. 色は彩度を落としたものを1つだけ。原色は使わない
//   4. 余白を広く取る。図を小さくして、まわりを空ける
//
// 意味は落とさない —— **点のいくつかは点線の輪。** 決まった日は詰まった点、
// まだの日は点線の輪。これがこのアプリの全部なので、様式を変えても残す。
//
// 決まりごと（差し替えても守る）:
//   - 角を丸めない。iOS が自分でマスクをかけるので、こちらで丸めると縁に黒が残る
//   - 四隅まで地の色を敷く。透過も不可（App Store が許さない）
//   - 実際に出る画素数（180/120/87）で確かめる。ポイント数のまま測ると判断を誤る
//
// 実行: node tools/icon-nordic.cjs
const sharp = require('sharp');
const N = 1024;
const F = "'Hiragino Sans','Yu Gothic',sans-serif";

// 北欧の色。彩度を落とした中間色で、原色は使わない
const OAT = '#F2EEE6';        // 生成りの地
const CHARCOAL = '#3A3D40';   // 炭色。黒より柔らかい
const SAGE = '#93A98F';
const DUSTY = '#8CA3B8';
const TERRA = '#C08A6E';

const wrap = (bg, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">`
  + `<rect width="${N}" height="${N}" fill="${bg}"/>${inner}</svg>`;

/**
 * 線画のカレンダー。北欧風は線を細く、余白を広く。
 * @param flat 線を引かず、面だけで作る（いちばん北欧に寄る）
 */
function cal({ bg = OAT, ink = CHARCOAL, band = null, sw = 28, flat = false, dots }) {
  // 余白を広く取る。icon-cute より一回り小さい
  const x = 196, y = 322, w = N - x * 2, h = 512, r = 56;
  const ringW = 40, ringH = 108, ringSw = sw * 0.9;
  let s = '';

  if (flat) {
    // 面だけ。線を引かず、地との明暗だけで形を出す
    for (const cx of [x + w * 0.26, x + w * 0.5, x + w * 0.74]) {
      s += `<rect x="${cx - ringW / 2}" y="${y - 74}" width="${ringW}" height="${ringH}" rx="${ringW / 2}" fill="${ink}"/>`;
    }
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${ink}"/>`;
    if (band) s += `<clipPath id="cf"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>`
      + `<g clip-path="url(#cf)"><rect x="${x}" y="${y}" width="${w}" height="118" fill="${band}"/></g>`;
  } else {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${bg}"/>`;
    if (band) {
      s += `<clipPath id="c"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>`;
      s += `<g clip-path="url(#c)"><rect x="${x}" y="${y}" width="${w}" height="118" fill="${band}"/></g>`;
    }
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`;
    for (const cx of [x + w * 0.26, x + w * 0.5, x + w * 0.74]) {
      s += `<rect x="${cx - ringW / 2}" y="${y - 74}" width="${ringW}" height="${ringH}" rx="${ringW / 2}"`
        + ` fill="${bg}" stroke="${ink}" stroke-width="${ringSw}"/>`;
    }
  }

  // 点。詰まった点＝決まった、点線の輪＝まだ。
  // 面だけの案では、地の色で抜く（線画では ink で描く）
  const mark = flat ? bg : ink;
  const cols = 3, gx = w / (cols + 1), gy = 152, dotR = 40;
  const y0 = y + (band ? 250 : 200);
  dots.forEach((on, i) => {
    const cx = x + gx * ((i % cols) + 1), cy = y0 + gy * Math.floor(i / cols);
    if (on) { s += `<circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${mark}"/>`; return; }
    // 輪の外径は詰まった点と揃える。線は細く（太いと点線がつながって花になる）
    const ring = 15, rr = dotR - ring / 2, seg = (2 * Math.PI * rr) / 8;
    s += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${mark}" stroke-width="${ring}"`
      + ` stroke-linecap="butt" stroke-dasharray="${(seg * 0.55).toFixed(1)} ${(seg * 0.45).toFixed(1)}"/>`;
  });
  return s;
}

const DOTS = [1, 0, 1, 1, 1, 0];

const IDEAS = {
  'いま（比べる用）': { src: true },
  'A｜生成りの地・炭の細線': { svg: wrap(OAT, cal({ dots: DOTS })) },
  'B｜＋ セージの帯': { svg: wrap(OAT, cal({ dots: DOTS, band: SAGE })) },
  'C｜＋ くすんだ青の帯': { svg: wrap(OAT, cal({ dots: DOTS, band: DUSTY })) },
  'D｜＋ テラコッタの帯': { svg: wrap(OAT, cal({ dots: DOTS, band: TERRA })) },
  'E｜線を引かず面だけ': { svg: wrap(OAT, cal({ dots: DOTS, flat: true })) },
  'F｜面だけ・セージ': { svg: wrap(OAT, cal({ dots: DOTS, flat: true, ink: '#5E6B5C', band: null })) },
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
// 白地に置いたときに四隅が立つか（App Store の検索結果は白地）
async function onWhite(buf) {
  const { data, info } = await sharp(buf).resize(87, 87, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return cr(data[(3 * info.width + 3) * info.channels], 255);
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

  console.log('中でいちばん明るいところと暗いところの差（実際に出る画素数で）と、白地での立ち方\n');
  for (const n of names) {
    const cells = [];
    for (const [place, pt, px] of SIZES) cells.push(`${place} ${(await measure(bufs[n], px)).toFixed(2)}`);
    console.log(`  ${n.padEnd(22)} ${cells.join('   ')}   白地 ${(await onWhite(bufs[n])).toFixed(2)}`);
  }

  const BIG = 236, PAD = 20, GAP = 24, LABEL = 24, STRIP = 132, COLN = 4;
  const rowH = LABEL + BIG + 8 + STRIP + 26;
  const comp = [];
  for (let i = 0; i < names.length; i += 1) {
    const n = names[i];
    const left = PAD + (i % COLN) * (BIG + GAP), top = PAD + Math.floor(i / COLN) * rowH;
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${BIG + GAP}" height="${LABEL}"><text x="0" y="15" font-family="${F}" font-size="12" font-weight="700" fill="#1E2024">${esc(n)}</text></svg>`), top, left });
    comp.push({ input: await sharp(bufs[n]).resize(BIG, BIG).png().toBuffer(), top: top + LABEL, left });
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
    .composite(comp).png().toFile('../store-assets/icon-nordic.png');
  console.log('\nできた store-assets/icon-nordic.png');
})();
