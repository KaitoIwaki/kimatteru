// 明るいアイコンの案。カレンダーに見えなくてよい、という前提で作る。
//
// 縛りは1つだけ ——「決まっている（塗り）」と「まだ（点線）」の二つが在ること。
// それがこのアプリの全部なので、カレンダーの絵は無くても、これだけは残す。
//
// 地の色は、アプリが既に使っているものから採る:
//   緑 #1D9E75（次へ進む操作の色）／紫 #8B7AB8（用事）／生成り #FDF7EC（いまの紙）
//   濃い緑 #14archives … は使わない。増やす色は1つまで
//
// 決まりごと（差し替えても守る）:
//   - 角を丸めない。iOS が自分でマスクをかけるので、こちらで丸めると縁に黒が残る
//   - 四隅まで地の色を敷く。透過も不可（App Store が許さない）
//   - 実際に出る画素数（180/120/87）で確かめる。ポイント数のまま測ると判断を誤る
//
// 実行: node tools/icon-bright.cjs
const sharp = require('sharp');
const N = 1024;
const F = "'Hiragino Sans','Yu Gothic',sans-serif";

const GREEN = '#1D9E75', PURPLE = '#6C5CA8', PAPER = '#FDF7EC', INK = '#2A3A33', WHITE = '#FFFFFF';

const wrap = (bg, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">`
  + `<rect width="${N}" height="${N}" fill="${bg}"/>${inner}</svg>`;
const dashArr = (peri, n, r = 0.6) => `${((peri / n) * r).toFixed(1)} ${((peri / n) * (1 - r)).toFixed(1)}`;
const disc = (cx, cy, r, c) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`;
const ring = (cx, cy, r, c, sw, n) => `<circle cx="${cx}" cy="${cy}" r="${r - sw / 2}" fill="none" stroke="${c}"`
  + ` stroke-width="${sw}" stroke-linecap="butt" stroke-dasharray="${dashArr(2 * Math.PI * (r - sw / 2), n)}"/>`;
const pill = (x, y, w, h, c, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
const pillDash = (x, y, w, h, c, r, sw, n) =>
  `<rect x="${x + sw / 2}" y="${y + sw / 2}" width="${w - sw}" height="${h - sw}" rx="${Math.max(0, r - sw / 2)}"`
  + ` fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="butt"`
  + ` stroke-dasharray="${dashArr(2 * (w + h) - 8 * r + 2 * Math.PI * r, n)}"/>`;
const path = (d, c, sw, dash) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}"`
  + ` stroke-linecap="${dash ? 'butt' : 'round'}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

// 二つの丸。塗りとまだを、いちばん少ない形で
const twoDots = (bg, c) => wrap(bg, disc(340, 512, 176, c) + ring(724, 512, 176, c, 30, 11));
// 二つの丸が重なる。同じ予定が「まだ」から「決まった」へ動くことを言う
const overlap = (bg, c) => wrap(bg, ring(636, 512, 214, c, 30, 11) + disc(410, 512, 214, c));
// 帯を2本。アプリが月表示で描いているものそのもの
const bars = (bg, c) => wrap(bg, pill(182, 356, 660, 160, c, 42) + pillDash(182, 560, 660, 160, c, 42, 20, 15));
// ？ のかたち。輪を点線に、点を塗りに
const qmark = (bg, c) => wrap(bg,
  path('M 372 384 A 140 140 0 1 1 512 524 L 512 632', c, 52, '66 42') + disc(512, 776, 52, c));
// チェックを2つ。済んだものと、まだのもの
const checks = (bg, c) => wrap(bg,
  path('M 244 396 L 372 524 L 668 228', c, 62)
  + path('M 244 748 L 372 876 L 668 580', c, 62, '58 40'));
// 地を半分に割る。塗りの側とまだの側を、地そのもので言う
const split = (bg, c) => {
  let s = `<rect x="0" y="0" width="512" height="${N}" fill="${c}"/>`;
  for (let i = 0; i < 5; i++) {
    const y = 190 + i * 160;
    s += `<rect x="592" y="${y}" width="332" height="52" rx="26" fill="none" stroke="${c}" stroke-width="18"`
      + ` stroke-dasharray="46 30"/>`;
  }
  return wrap(bg, s);
};

const IDEAS = {
  'いま（比べる用）': { src: true },
  'R｜緑の地・白い2つ': { svg: twoDots(GREEN, WHITE) },
  'S｜紫の地・白い2つ': { svg: twoDots(PURPLE, WHITE) },
  'T｜生成りの地・濃い2つ': { svg: twoDots(PAPER, INK) },
  'U｜二つが重なる・緑': { svg: overlap(GREEN, WHITE) },
  'V｜帯を2本・緑の地': { svg: bars(GREEN, WHITE) },
  'W｜？ を大きく・緑': { svg: qmark(GREEN, WHITE) },
  'X｜チェックを2つ・緑': { svg: checks(GREEN, WHITE) },
  'Y｜地を半分に割る': { svg: split(PAPER, GREEN) },
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
      ? await sharp(`${__dirname}/icon-source.png`).resize(N, N, { fit: 'fill' }).flatten({ background: PAPER }).png().toBuffer()
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
  for (let idx = 0; idx < names.length; idx++) {
    const n = names[idx];
    const left = PAD + (idx % COLN) * (BIG + GAP), top = PAD + Math.floor(idx / COLN) * rowH;
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${BIG + GAP}" height="${LABEL}"><text x="0" y="15" font-family="${F}" font-size="12" font-weight="700" fill="#1E2024">${esc(n)}</text></svg>`), top, left });
    comp.push({ input: await sharp(bufs[n]).resize(BIG, BIG).png().toBuffer(), top: top + LABEL, left });
    comp.push({ input: await sharp({ create: { width: BIG, height: STRIP, channels: 3, background: WHITE } }).png().toBuffer(), top: top + LABEL + BIG + 8, left });
    let x = 10;
    for (const [place, pt, px] of SIZES) {
      const disp = Math.round((px / 3) * 1.6);   // 見やすさのため 1.6 倍で置く（比率は保つ）
      comp.push({ input: await sharp(bufs[n]).resize(disp, disp).png().toBuffer(), top: top + LABEL + BIG + 26, left: left + x });
      comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${disp + 14}" height="16"><text x="0" y="12" font-family="${F}" font-size="9" fill="#6B7280">${esc(pt)}pt</text></svg>`), top: top + LABEL + BIG + 30 + disp, left: left + x });
      x += disp + 14;
    }
  }
  const rows = Math.ceil(names.length / COLN);
  await sharp({ create: { width: PAD * 2 + COLN * BIG + (COLN - 1) * GAP, height: PAD * 2 + rows * rowH, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile('../store-assets/icon-bright.png');
  console.log('\nできた  store-assets/icon-bright.png');
})();
