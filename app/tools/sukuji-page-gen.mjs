// ChatGPT が描いた 1 枚もの（gen/gen-N.png：白い画面のまっすぐなスマホ）に、本物のスクショを貼る。
//
//   node app/tools/sukuji-page-gen.mjs
//
// 出力: store-assets/sukuji/flat/N.png（1290×2796）
//
// ChatGPT の縦長は 2:3（1024×1536）で、App Store の 9:19.5 より横に広い。
// 「中央 70% に収めて」と頼んでも見出しを左端まで置いてくるので、左右を切ると見出しが欠ける。
// なので幅で合わせて（1290×1935）、上下を継ぎ足して 2796 にする：
//   - 上：いちばん上の行をそのまま伸ばす（無地）
//   - 下：いちばん下の行をそのまま伸ばす。スマホはまっすぐで下が絵の外なので、縁と画面がそのまま続く
// そのあと、白い塊（画面）の上の 2 角から幅と傾きを取ってスクショを貼り、アイランドの画素を戻す。
// tap があれば、スクショの座標をカードの座標に写してタップの輪を描く。
import sharp from 'sharp';
import { join } from 'node:path';
import { whiteBlob, drawPhone, PHONE, TEXT, GEN, ROOT } from './sukuji-fill.mjs';

const OUT = join(ROOT, 'flat');
const W = 1290, H = 2796;
const GREEN = '#3E7A4D';
// ChatGPT のスマホは幅の半分しかなく、下も絵の中で終わっていた（貼ると画面の下に白が余る）。
// なので ChatGPT の絵は「地・見出し・小物」としてだけ使い、スマホは 2 ページものと同じ白いものを
// こちらで大きく（幅 920）描いて、ChatGPT のスマホの上にかぶせる。スマホの下に描かれた札は隠れるので描き直す
PHONE.w = 960; PHONE.body = "#FAFAFA"; PHONE.rimColor = "#D6D6D6";   // 960 なら下端が絵の外（2829）に出て、ChatGPT のスマホが下からのぞかない
function geom(shotW, top) { const left = Math.round((W - PHONE.w) / 2), sw = PHONE.w - PHONE.bezel * 2; return { x0: left + PHONE.bezel, y0: top + PHONE.bezel, k: sw / shotW }; }

// 「点線 → ✓ 塗り」の帯（flat の 2 枚目と同じ）。y はスクショの座標
async function chipsCard(canvas, g, y, text) {
  const cw = 980, ch = 210, r = 30;
  const left = Math.round((W - cw) / 2), top = Math.round(g.y0 + y * g.k - ch / 2);
  const chip = (x, dashed) => dashed
    ? `<rect x="${x}" y="${top + 62}" width="330" height="86" rx="16" fill="#FFF6EA" stroke="#E0A87E" stroke-width="5" stroke-dasharray="14 10"/><text x="${x + 165}" y="${top + 62 + 60}" text-anchor="middle" font-family="${TEXT.font}" font-size="44" fill="#9A6A45">${text}</text>`
    : `<rect x="${x}" y="${top + 62}" width="330" height="86" rx="16" fill="#A9C5A6"/><text x="${x + 165}" y="${top + 62 + 60}" text-anchor="middle" font-family="${TEXT.font}" font-size="44" fill="#243126">✓ ${text}</text>`;
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${left}" y="${top + 18}" width="${cw}" height="${ch}" rx="${r}" fill="#000" fill-opacity="0.22"/></svg>`)).blur(22).png().toBuffer();
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="${left}" y="${top}" width="${cw}" height="${ch}" rx="${r}" fill="#fff" stroke="${GREEN}" stroke-width="5"/>
    ${chip(left + 70, true)}
    <text x="${left + cw / 2}" y="${top + 62 + 64}" text-anchor="middle" font-family="${TEXT.font}" font-weight="bold" font-size="64" fill="${GREEN}">→</text>
    ${chip(left + cw - 70 - 330, false)}
  </svg>`);
  return sharp(canvas).composite([{ input: shadow }, { input: svg }]).png().toBuffer();
}

// 上下を継ぎ足して 1290×2796 にする。topExt は上に足す量（見出しの上の余白。他のカードは小見出しが y=330 から）
async function fitCanvas(genFile, topExt = 300) {
  const body = await sharp(join(GEN, genFile)).resize({ width: W }).png().toBuffer();
  const bh = (await sharp(body).metadata()).height;
  const botExt = H - bh - topExt;
  if (botExt < 0) throw new Error(`絵が高すぎる（${bh}）。topExt を減らす`);
  const topRow = await sharp(body).extract({ left: 0, top: 0, width: W, height: 1 }).resize(W, topExt, { fit: 'fill', kernel: 'nearest' }).png().toBuffer();
  const botRow = await sharp(body).extract({ left: 0, top: bh - 1, width: W, height: 1 }).resize(W, botExt, { fit: 'fill', kernel: 'nearest' }).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: '#F3F7F1' } })
    .composite([{ input: topRow, left: 0, top: 0 }, { input: body, left: 0, top: topExt }, { input: botRow, left: 0, top: topExt + bh }]).png().toBuffer();
}

// 白い画面にスクショを貼る（2 ページものと同じやり方）。戻り値は貼った絵と、座標の写し方
async function pasteScreen(base, shotFile) {
  const b = await whiteBlob(base, 248, null, null, [200, 236]);
  const tl = { x: b.corners.tl[0], y: b.corners.tl[1] }, tr = { x: b.corners.tr[0], y: b.corners.tr[1] };
  const w = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const tilt = Math.atan2(tr.y - tl.y, tr.x - tl.x);
  const sm = await sharp(shotFile).metadata();
  const k = w / sm.width, h = sm.height * k;
  const cx = tl.x + (w / 2) * Math.cos(tilt) - (h / 2) * Math.sin(tilt);
  const cy = tl.y + (w / 2) * Math.sin(tilt) + (h / 2) * Math.cos(tilt);
  console.log(`  画面 幅 ${Math.round(w)} 傾き ${(tilt * 180 / Math.PI).toFixed(1)}° 左上 (${Math.round(tl.x)},${Math.round(tl.y)}) 画面の下端 ${Math.round(tl.y + h)}（絵は ${H}）`);
  const iw = Math.round(w), ih = Math.round(h), r = Math.round(w * 0.09);
  const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}"><rect width="${iw}" height="${ih}" rx="${r}" fill="#fff"/></svg>`);
  const shot = await sharp(shotFile).resize(iw, ih, { fit: 'fill' }).ensureAlpha().composite([{ input: round, blend: 'dest-in' }]).png().toBuffer();
  const rotated = await sharp(shot).rotate(tilt * 180 / Math.PI, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const rm = await sharp(rotated).metadata();
  const P = 2400;
  const placed = await sharp({ create: { width: W + P * 2, height: H + P * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: rotated, left: Math.round(P + cx - rm.width / 2), top: Math.round(P + cy - rm.height / 2) }]).png().toBuffer();
  const layer = await sharp(placed).extract({ left: P, top: P, width: W, height: H }).png().toBuffer();
  // 型：白い塊を 3px 太らせた範囲で、白の度合いをアルファに
  const dil = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    if (!b.mask[p]) continue;
    const x = p % W, y = (p / W) | 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) dil[yy * W + xx] = 1; }
  }
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) { rgba[p * 4] = 255; rgba[p * 4 + 1] = 255; rgba[p * 4 + 2] = 255; rgba[p * 4 + 3] = dil[p] ? b.soft[p] : 0; }
  const maskPng = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const clipped = await sharp(layer).composite([{ input: maskPng, blend: 'dest-in' }]).png().toBuffer();
  // アイランド：塊の上のほう（上端から 12%）の黒い画素を元の絵から戻す
  const { data, info } = await sharp(base).raw().toBuffer({ resolveWithObject: true });
  let y0 = H, y1 = 0;
  for (let p = 0; p < W * H; p++) if (b.mask[p]) { const y = (p / W) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const isl = Buffer.alloc(W * H * 4), ch = info.channels;
  for (let y = y0; y < y0 + (y1 - y0) * 0.12; y++) for (let x = 2; x < W - 2; x++) {
    const o = (y * W + x) * ch;
    if (data[o] + data[o + 1] + data[o + 2] < 300) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const q = (y + dy) * W + (x + dx), oq = q * ch;
      isl[q * 4] = data[oq]; isl[q * 4 + 1] = data[oq + 1]; isl[q * 4 + 2] = data[oq + 2]; isl[q * 4 + 3] = 255;
    }
  }
  const islandPng = await sharp(isl, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const out = await sharp(base).composite([{ input: clipped }, { input: islandPng }]).png().toBuffer();
  // スクショの座標 (x, y) → カードの座標
  const map = (x, y) => ({ x: tl.x + x * k * Math.cos(tilt) - y * k * Math.sin(tilt), y: tl.y + x * k * Math.sin(tilt) + y * k * Math.cos(tilt) });
  return { out, map };
}

// タップの印（緑の輪を二重に）
async function tapRing(canvas, p) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <circle cx="${p.x}" cy="${p.y}" r="26" fill="${GREEN}" fill-opacity="0.35"/>
    <circle cx="${p.x}" cy="${p.y}" r="52" fill="none" stroke="${GREEN}" stroke-width="9" stroke-opacity="0.9"/>
    <circle cx="${p.x}" cy="${p.y}" r="88" fill="none" stroke="${GREEN}" stroke-width="5" stroke-opacity="0.4"/>
  </svg>`);
  return sharp(canvas).composite([{ input: svg }]).png().toBuffer();
}

async function page(n, shot, { tap = null, topExt = 300, phoneTop = 800, chips = null } = {}) {
  const base = await fitCanvas(`gen-${n}.png`, topExt);
  const shotFile = join(ROOT, shot);
  const sm = await sharp(shotFile).metadata();
  const g = geom(sm.width, phoneTop);
  let out = await drawPhone(base, W, H, shotFile, phoneTop);
  const map = (x, y) => ({ x: g.x0 + x * g.k, y: g.y0 + y * g.k });
  if (tap) out = await tapRing(out, map(tap[0], tap[1]));
  if (chips) out = await chipsCard(out, g, chips.y, chips.text);
  await sharp(out).png().toFile(join(OUT, `${n}.png`));
  console.log(`→ flat/${n}.png`);
}

const PAGES = {
  3: ['2-dialog.png', { tap: [645, 1516], chips: { y: 2350, text: 'バイト' } }],   // 「確定した」に印、下に 点線 → 塗り
  4: ['3-free.png', {}],
  6: ['5-report.png', {}],
};
const only = process.argv[2] ? [process.argv[2]] : Object.keys(PAGES);
const { existsSync } = await import('node:fs');
for (const n of only) {
  if (!PAGES[n]) { console.log(`${n} は無い`); continue; }
  if (!existsSync(join(GEN, `gen-${n}.png`))) { console.log(`gen/gen-${n}.png が無いので ${n} は飛ばした`); continue; }
  await page(n, ...PAGES[n]);
}
