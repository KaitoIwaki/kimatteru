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
import { whiteBlob, whiteBlobs, pasteBig, widgetCrop, drawPhone, eraseVertical, PHONE, TEXT, GEN, ROOT } from './sukuji-fill.mjs';
import { cutTitle, eraseBox, TITLE_LINE } from './sukuji-title.mjs';

const OUT = join(ROOT, 'flat');
const W = 1290, H = 2796;
const GREEN = '#3E7A4D';
// ChatGPT のスマホは幅の半分しかなく、下も絵の中で終わっていた（貼ると画面の下に白が余る）。
// なので ChatGPT の絵は「地・見出し・小物」としてだけ使い、スマホは 2 ページものと同じ白いものを
// こちらで大きく（幅 920）描いて、ChatGPT のスマホの上にかぶせる。スマホの下に描かれた札は隠れるので描き直す
PHONE.w = 960; PHONE.body = "#FAFAFA"; PHONE.rimColor = "#D6D6D6";   // 960 なら下端が絵の外（2829）に出て、ChatGPT のスマホが下からのぞかない
function geom(shotW, top) { const left = Math.round((W - PHONE.w) / 2), sw = PHONE.w - PHONE.bezel * 2; return { x0: left + PHONE.bezel, y0: top + PHONE.bezel, k: sw / shotW }; }

// 「点線 → ✓ 塗り」の帯（flat の 2 枚目と同じ）。y はスクショの座標。
// バイトなので点線も塗りも緑（アプリと同じ。色は種類、点線か塗りかが「決まったか」）。
// 前は点線がオレンジで、決まると緑になり「決まった＝緑」と誤解させた
async function chipsCard(canvas, g, y, text) {
  const cw = 980, ch = 210, r = 30;
  const left = Math.round((W - cw) / 2), top = Math.round(g.y0 + y * g.k - ch / 2);
  const chip = (x, dashed) => dashed
    ? `<rect x="${x}" y="${top + 62}" width="330" height="86" rx="16" fill="#DCE9DE" stroke="#8FB896" stroke-width="5" stroke-dasharray="14 10"/><text x="${x + 165}" y="${top + 62 + 60}" text-anchor="middle" font-family="${TEXT.font}" font-size="44" fill="#2F4A36">${text}</text>`
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

// スマホより上（y < limit）を、地と帯だけで描き直す。
// 見出しを大きく描き直したらスマホの上端が下がり、ChatGPT のスマホの上端がその上からのぞいた。
// 地は一色、帯は斜めの一色なので、スマホの外（左右の端の列）で帯の上端・下端を拾って直線を当て、
// その直線で地と帯を塗り分ければ、ChatGPT のスマホも見出しも消えて、帯の斜めはつながる
// rects = [[x, y, w, h], ...] の中を、地と帯で塗り直す
async function repaint(canvas, rects) {
  const { data, info } = await sharp(canvas).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const px = (x, y) => { const o = (y * W + x) * ch; return [data[o], data[o + 1], data[o + 2]]; };
  const bg = px(10, 10);
  // 帯の色：左端の列で、地と違う明るい色のうちいちばん多いもの
  const cnt = new Map();
  for (let y = 0; y < H; y += 2) for (let x = 0; x < 200; x += 4) { const c = px(x, y); if (Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]) > 24 && c[0] + c[1] + c[2] > 500) { const k = c.map((v) => v >> 3).join(','); cnt.set(k, (cnt.get(k) || 0) + 1); } }
  let band = null, bn = 0; for (const [k, n] of cnt) if (n > bn) { bn = n; band = k.split(',').map((v) => (v << 3) + 4); }
  if (!band) { console.log('  帯が見つからない。地だけで塗る'); }
  const isBand = (c) => band && Math.abs(c[0] - band[0]) + Math.abs(c[1] - band[1]) + Math.abs(c[2] - band[2]) < 30;
  // 端の列（x < 240、x > 1050）で、帯の上端と下端
  const tops = [], bots = [];
  for (let x = 0; x < W; x += 3) {
    if (x >= 240 && x <= 1050) continue;
    // 帯は厚いので、40px 続く所だけ帯と見る（緑の文字の縁が帯の色に近くて、x=200 で上端が 177 になった）
    let t = -1, b = -1, run = 0;
    for (let y = 0; y < H; y++) { if (isBand(px(x, y))) { run++; if (run >= 40) { if (t < 0) t = y - 39; b = y; } } else run = 0; }
    if (t >= 0) { tops.push([x, t]); if (b < H - 2) bots.push([x, b]); }
  }
  const fit = (pts) => { const n = pts.length; if (n < 10) return null; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; } const a = (n * sxy - sx * sy) / (n * sxx - sx * sx); return { a, b: (sy - a * sx) / n }; };
  const top = fit(tops), bot = fit(bots);
  console.log(`  地 ${bg.join(',')} 帯 ${band ? band.join(',') : '無し'} 上端の線 ${top ? top.a.toFixed(3) : '-'} 下端の線 ${bot ? bot.a.toFixed(3) : '-'}`);
  const out = Buffer.from(data);
  for (const [rx, ry, rw, rh] of rects) for (let y = Math.max(0, ry); y < Math.min(H, ry + rh); y++) for (let x = Math.max(0, rx); x < Math.min(W, rx + rw); x++) {
    const inBand = top && y >= top.a * x + top.b && (!bot || y <= bot.a * x + bot.b);
    const c = inBand ? band : bg, o = (y * W + x) * ch;
    out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
  }
  return sharp(out, { raw: { width: W, height: H, channels: ch } }).png().toBuffer();
}

// ChatGPT の見出しは小さく、位置も低かった（「もっと大きく、いい感じの位置に」）。
// 消して、1〜2 枚目（sukuji-wide.mjs）と同じ書体・大きさ・位置で描き直す。
// 消すのは、スマホより上（y < limit）にある暗い画素（黒い文字と緑の文字）。地と帯は明るいので残る
async function retitle(canvas, { lines, accent, sub }, limit) {
  const { data, info } = await sharp(canvas).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels, mask = new Uint8Array(W * H);
  for (let y = 0; y < limit; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * ch; if (data[o] + data[o + 1] + data[o + 2] < 600) mask[y * W + x] = 255; }
  const erased = await eraseVertical(canvas, mask, W, H, 24, 6);
  const INK = '#1C1F1B', GREENT = '#3E7A4D';
  const mark = (t) => { let out = t; for (const a of accent || []) out = out.split(a).join(`<tspan fill="${GREENT}">${a}</tspan>`); return out; };
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <g font-family="${TEXT.font}" font-weight="bold" fill="${INK}" font-size="168" letter-spacing="-4">
      <text x="110" y="560">${mark(lines[0])}</text>
      ${lines[1] ? `<text x="110" y="760">${mark(lines[1])}</text>` : ''}
    </g>
    <text x="112" y="900" font-family="${TEXT.font}" fill="#2E3A31" font-size="50" letter-spacing="1">${sub}</text>
  </svg>`);
  return sharp(erased).composite([{ input: svg }]).png().toBuffer();
}

// 上下を継ぎ足して 1290×2796 にする。topExt は上に足す量（見出しの上の余白。他のカードは小見出しが y=330 から）
async function fitCanvas(genFile, topExt = 300) {
  const body = await sharp(join(GEN, genFile)).resize({ width: W }).png().toBuffer();
  const bh = (await sharp(body).metadata()).height;
  const botExt = H - bh - topExt;
  if (botExt < 0) throw new Error(`絵が高すぎる（${bh}）。topExt を減らす`);
  const layers = [{ input: body, left: 0, top: topExt }];
  if (topExt > 0) layers.unshift({ input: await sharp(body).extract({ left: 0, top: 0, width: W, height: 1 }).resize(W, topExt, { fit: 'fill', kernel: 'nearest' }).png().toBuffer(), left: 0, top: 0 });
  if (botExt > 0) layers.push({ input: await sharp(body).extract({ left: 0, top: bh - 1, width: W, height: 1 }).resize(W, botExt, { fit: 'fill', kernel: 'nearest' }).png().toBuffer(), left: 0, top: topExt + bh });
  return sharp({ create: { width: W, height: H, channels: 3, background: '#F3F7F1' } }).composite(layers).png().toBuffer();
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

// 押している手（平らなイラスト）。人差し指の先を p に合わせ、右下から -28° で入る。
// 形は角丸の重ね合わせ：まず全部を太い縁取りで描き、その上に塗りだけを重ねて、内側の線を消す
async function hand(canvas, p) {
  const SKIN = '#FFF1E2', LINE = '#2E4B36', SLEEVE = '#A9C5A6';
  const parts = [
    ['rect', 120, 0, 58, 230, 29],        // 人差し指
    ['rect', 178, 122, 46, 74, 23],       // 折った指 ×3
    ['rect', 222, 136, 44, 74, 22],
    ['rect', 262, 152, 40, 74, 20],
    ['rect', 112, 182, 192, 176, 40],     // 手のひら
    ['thumb'],
  ];
  const shape = (fillOnly) => parts.map((q) => {
    const st = fillOnly ? `fill="${SKIN}"` : `fill="${SKIN}" stroke="${LINE}" stroke-width="15" stroke-linejoin="round"`;
    if (q[0] === 'thumb') return `<rect x="66" y="205" width="62" height="118" rx="31" transform="rotate(-24 97 264)" ${st}/>`;
    return `<rect x="${q[1]}" y="${q[2]}" width="${q[3]}" height="${q[4]}" rx="${q[5]}" ${st}/>`;
  }).join('');
  const sleeve = (fillOnly) => `<rect x="118" y="340" width="176" height="150" rx="22" fill="${SLEEVE}" ${fillOnly ? '' : `stroke="${LINE}" stroke-width="15"`}/>`;
  // 指先は (149, 0)。そこを p に置き、1.35 倍、-28° 回す
  const g = `transform="translate(${p.x} ${p.y}) rotate(-28) scale(1.2) translate(-149 -4)"`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <circle cx="${p.x}" cy="${p.y}" r="70" fill="none" stroke="${GREEN}" stroke-width="6" stroke-opacity="0.45"/>
    <circle cx="${p.x}" cy="${p.y}" r="110" fill="none" stroke="${GREEN}" stroke-width="4" stroke-opacity="0.22"/>
    <g ${g}>${sleeve(false)}${shape(false)}${sleeve(true)}${shape(true)}</g>
  </svg>`);
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g transform="translate(${p.x + 18} ${p.y + 30}) rotate(-28) scale(1.2) translate(-149 -4)"><rect x="60" y="0" width="250" height="490" rx="60" fill="#000" fill-opacity="0.18"/></g></svg>`)).blur(26).png().toBuffer();
  return sharp(canvas).composite([{ input: shadow }, { input: svg }]).png().toBuffer();
}

// ○△× の札：生成りの角丸に記号 1 つ。少し傾けて影つき。スマホのあとに描くので縁にかかる
async function stickerCards(canvas, list) {
  const size = 200, r = 32;   // 右の 2 つが画面の ○△ の列にかかるので、小さめにして右へ寄せる
  const sym = (kind) => kind === 'o' ? `<circle cx="100" cy="100" r="54" fill="none" stroke="#5E9068" stroke-width="13"/>`
    : kind === 'tri' ? `<polygon points="100,45 155,146 45,146" fill="none" stroke="#E0A87E" stroke-width="13" stroke-linejoin="round"/>`
    : `<path d="M54 54 L146 146 M146 54 L54 146" stroke="#8A8A86" stroke-width="13" stroke-linecap="round"/>`;
  const g = (c, extra) => `<g transform="translate(${c.x} ${c.y}) rotate(${c.rot || 0} 100 100)">${extra}</g>`;
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${list.map((c) => g({ ...c, y: c.y + 24 }, `<rect width="${size}" height="${size}" rx="${r}" fill="#000" fill-opacity="0.22"/>`)).join('')}</svg>`)).blur(22).png().toBuffer();
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${list.map((c) => g(c, `<rect width="${size}" height="${size}" rx="${r}" fill="#F5F2EA"/>${sym(c.kind)}`)).join('')}</svg>`);
  return sharp(canvas).composite([{ input: shadow }, { input: svg }]).png().toBuffer();
}

// 線画の小物（カップ・チケット・ダンベル）。ChatGPT のはスマホに隠れるので、同じ絵柄をこちらで余白に描く。
// 140×140 の枠で描いて、scale 倍・rot° で置く。線は緑、丸い端。右上に小さな「キラッ」の線
async function lineIcons(canvas, list) {
  const C = '#4E7D5C', st = `fill="none" stroke="${C}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"`;
  const art = {
    cup: `<rect x="22" y="16" width="96" height="22" rx="8" ${st}/><path d="M32 38 L42 128 Q42 138 52 138 L88 138 Q98 138 98 128 L108 38" ${st}/>`,
    ticket: `<path d="M22 28 H118 A10 10 0 0 1 128 38 V56 A12 12 0 0 0 128 80 V98 A10 10 0 0 1 118 108 H22 A10 10 0 0 1 12 98 V80 A12 12 0 0 0 12 56 V38 A10 10 0 0 1 22 28 Z" ${st}/><path d="M92 40 V96" ${st} stroke-dasharray="10 9"/>`,
    dumbbell: `<rect x="12" y="44" width="20" height="52" rx="6" ${st}/><rect x="32" y="52" width="14" height="36" rx="4" ${st}/><path d="M46 70 H94" ${st}/><rect x="94" y="52" width="14" height="36" rx="4" ${st}/><rect x="108" y="44" width="20" height="52" rx="6" ${st}/>`,
  };
  const spark = `<path d="M128 6 L136 -8 M142 18 L158 14 M118 -2 L114 -16" fill="none" stroke="${C}" stroke-width="9" stroke-linecap="round"/>`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${list.map((c) => `<g transform="translate(${c.x} ${c.y}) scale(${c.scale || 1.2}) rotate(${c.rot || 0} 70 70)">${art[c.kind]}${spark}</g>`).join('')}</svg>`);
  return sharp(canvas).composite([{ input: svg }]).png().toBuffer();
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

async function page(n, shot, { tap = null, topExt = 0, phoneTop = 1000, chips = null, title = null, repaintRects = [], stickers = [], icons = [] } = {}) {
  let base = await fitCanvas(`gen-${n}.png`, topExt);
  if (title === 'keep') {
    // 先に文字を切り出してから（repaint で消える前に）、上を塗り直して置き直す
    const k = await cutTitle(base, { W, H, limitY: phoneTop - 60, targetLine: TITLE_LINE });
    base = await repaint(base, [[0, 0, W, phoneTop + 40], ...repaintRects]);
    base = await sharp(base).composite([{ input: k.block, left: k.left, top: k.top }]).png().toBuffer();
    phoneTop = Math.max(phoneTop, k.bottom + 90);
  } else if (title) { base = await repaint(base, [[0, 0, W, phoneTop + 40], ...repaintRects]); base = await retitle(base, title, phoneTop - 60); }
  const shotFile = join(ROOT, shot);
  const sm = await sharp(shotFile).metadata();
  const g = geom(sm.width, phoneTop);
  // 小物の線画はスマホの前に描く（縁にかかった分はスマホの後ろに隠れる。前に描くと画面の上に線が乗って変）
  if (icons.length) base = await lineIcons(base, icons);
  let out = await drawPhone(base, W, H, shotFile, phoneTop);
  const map = (x, y) => ({ x: g.x0 + x * g.k, y: g.y0 + y * g.k });
  if (tap) out = tap.length > 2 && tap[2] === 'ring' ? await tapRing(out, map(tap[0], tap[1])) : await hand(out, map(tap[0], tap[1]));
  if (chips) out = await chipsCard(out, g, chips.y, chips.text);
  if (stickers.length) out = await stickerCards(out, stickers);
  await sharp(out).png().toFile(join(OUT, `${n}.png`));
  console.log(`→ flat/${n}.png`);
}

// ---- 5 枚目：白い角丸 3 つに、実機から切り出した小・中・大を貼る ----
// スマホは無い。ChatGPT の角丸を型にせず、傾きと中心だけ借りて、少し大きい（×1.12）カードを影ごと上からかぶせる
// （sukuji-fill.mjs の pasteBig）。見出しは他と同じく切り出して置き直し。角丸が見出しの下（y≈1000）に来るよう、上に 383px 足す
async function widgetPage() {
  let base = await fitCanvas('gen-5.png', 383);
  const k = await cutTitle(base, { W, H, limitY: 980, targetLine: TITLE_LINE });
  base = await eraseBox(base, { W, H }, k.bbox, k.bg);
  base = await sharp(base).composite([{ input: k.block, left: k.left, top: k.top }]).png().toBuffer();
  const blobs = await whiteBlobs(base, 3, [232, 250]);
  if (blobs.length < 3) { console.log(`白い角丸が ${blobs.length} つしか無い`); return; }
  // 中＝いちばん横長。残りは面積で 小・大
  const byA = blobs.map((b) => ({ b, a: b.rect.h / b.rect.w, area: b.rect.w * b.rect.h })).sort((x, y) => x.a - y.a);
  const rest = byA.slice(1).sort((x, y) => x.area - y.area);
  // ×1.12 だと下が 650px 空いた。小・中は 1.25 倍（重なるので左右に 30px ずつ離す）、大は 1.35 倍で 100px 下げる
  const plan = [['large', rest[1].b, 1.35, 0, 100], ['medium', byA[0].b, 1.25, 30, 0], ['small', rest[0].b, 1.25, -30, 0]];
  let out = base;
  for (const [kind, b, scale, dx, dy] of plan) {
    const src = await widgetCrop(kind);
    if (!src) { console.log(`  ${kind} のスクショが無い`); continue; }
    out = await pasteBig(out, b, src, W, H, scale, dx, dy);
    console.log(`  ${kind}: ${Math.round(b.rect.w)}×${Math.round(b.rect.h)} 傾き ${b.tilt.toFixed(1)}° 中心 (${Math.round(b.rect.cx)},${Math.round(b.rect.cy)})`);
  }
  await sharp(out).png().toFile(join(OUT, '5.png'));
  console.log('→ flat/5.png');
}

const PAGES = {
  // title: 'keep' = ChatGPT の文字を切り出して置き直す（書体そのまま）。文字を描き直すなら { lines, accent, sub }
  3: ["2-dialog.png", { tap: [880, 1530], chips: { y: 2350, text: 'バイト' }, title: 'keep' }],   // 「確定した」に印、下に 点線 → 塗り
  // ChatGPT の △ と × は右の帯の上（x 1000〜、y 1000〜1750）にあって、スマホに半分隠れるので消して描き直す
  4: ['3-free.png', { title: 'keep',
        repaintRects: [[990, 1000, 300, 760]],
        stickers: [{ kind: 'o', x: 30, y: 1180, rot: -8 }, { kind: 'tri', x: 1085, y: 1520, rot: 7 }, { kind: 'x', x: 1070, y: 2060, rot: -6 }] }],
  // ChatGPT の小物（カップ 左、チケット 右、ダンベル 右下）はスマホにかかるので消して、余白に描き直す
  6: ['5-report.png', { title: 'keep',
        repaintRects: [[40, 640, 240, 280], [990, 740, 300, 270], [980, 1200, 310, 260]],
        icons: [{ kind: 'cup', x: 8, y: 1180, rot: -8, scale: 1.05 }, { kind: 'ticket', x: 1135, y: 1560, rot: -22, scale: 1.0 }, { kind: 'dumbbell', x: 1130, y: 2150, rot: -32, scale: 1.0 }] }],
};
const only = process.argv[2] ? [process.argv[2]] : [...Object.keys(PAGES), '5'];
const { existsSync } = await import('node:fs');
for (const n of only) {
  if (n === '5') { if (existsSync(join(GEN, 'gen-5.png'))) await widgetPage(); else console.log('gen/gen-5.png が無いので 5 は飛ばした'); continue; }
  if (!PAGES[n]) { console.log(`${n} は無い`); continue; }
  if (!existsSync(join(GEN, `gen-${n}.png`))) { console.log(`gen/gen-${n}.png が無いので ${n} は飛ばした`); continue; }
  await page(n, ...PAGES[n]);
}
