// App Store の1枚を「もっとスタイリッシュに」するには何を動かせばいいか、
// 実寸で比べるための道具。決めたら tools/store-cards.cjs へ移す。
//
// 動かせる軸は4つしかない。飾りを足すことではない。
//   1. 見出しの大きさ（字の落差）… いまは 32px。小さい字との差が足りない
//   2. 地の色（中立の灰 か 生成りの紙）… アイコンは型押しの紙。地を紙にすると
//      アプリの世界と一続きになる
//   3. 板の寄り（全体を見せる か 要るところだけ大きく）… 5枚とも同じ位置に
//      同じ大きさで置くと、めくっても絵が変わらない
//   4. 影（浮かせる か 置く）… いまの 0.20 はどっちつかず
//
// 実行: node tools/store-style.cjs
const sharp = require('sharp');
const { join } = require('node:path');

const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3, W = 430, H = 932;
const SRC = join(__dirname, '..', '..', 'store-assets', 'screenshots-6.9');
const OUT = join(__dirname, '..', '..', 'store-assets');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, r = 0, op) =>
  `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => `#${hexRgb(a).map((v, i) => Math.round(v * k + hexRgb(b)[i] * (1 - k)).toString(16).padStart(2, '0')).join('')}`;
const wide = (ch) => (/[　-鿿＀-￯]/.test(ch) ? 1 : ch === ' ' ? 0.26 : 0.55);
const tw = (s, size) => [...s].reduce((a, c) => a + wide(c), 0) * size;

// 地は2種類だけ。灰（いま）と、紙（アイコンと同じ生成り）
const GROUND = {
  灰: { bg: ['#FFFFFF', '#EDF0F5', '#D7DDE7'], ink: '#1E2024', small: '#666C74', grid: '#6B7A90', dot: '#41474F', edge: '#8A93A3' },
  紙: { bg: ['#FFFDF8', '#F7F1E4', '#EADFC9'], ink: '#2A2620', small: '#6B6152', grid: '#8A7A5C', dot: '#4A4335', edge: '#A2937A' },
};

function ground(g, id, shadow) {
  let o = `<defs>
    <radialGradient id="bg${id}" cx="18%" cy="10%" r="105%">
      <stop offset="0%" stop-color="${g.bg[0]}"/><stop offset="55%" stop-color="${g.bg[1]}"/><stop offset="100%" stop-color="${g.bg[2]}"/>
    </radialGradient>
    <filter id="sh${id}" x="-40%" y="-40%" width="180%" height="220%">
      <feDropShadow dx="0" dy="${10 * S}" stdDeviation="${14 * S}" flood-color="#3A4150" flood-opacity="${shadow}"/>
    </filter>
    <filter id="soft${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${60 * S}"/></filter>
    <linearGradient id="fade${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${g.bg[2]}" stop-opacity="0"/><stop offset="100%" stop-color="${g.bg[2]}" stop-opacity="1"/>
    </linearGradient>
  </defs>`;
  o += rect(0, 0, W, H, `url(#bg${id})`);
  o += `<ellipse cx="${0.14 * W * S}" cy="${0.03 * H * S}" rx="${0.6 * W * S}" ry="${0.24 * H * S}" fill="#FFFFFF" opacity="0.42" filter="url(#soft${id})"/>`;
  for (let x = 0; x <= W; x += 40) o += rect(x, 0, 0.5, H, g.grid, 0, 0.055);
  for (let y = 0; y <= H; y += 40) o += rect(0, y, W, 0.5, g.grid, 0, 0.044);
  const rnd = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 420; i += 1) o += rect(rnd(i * 2 + 1) * W, rnd(i * 2 + 2) * H, 0.9, 0.9, i % 2 ? g.dot : g.bg[2], 0, 0.05);
  return o;
}

function headline(g, x, y, parts, size, solid) {
  const [pre, key, post] = parts;
  let o = t(x, y, pre + key + post, size, 200, g.ink, -size * 0.035);
  if (key) {
    const kx = x + tw(pre, size), kw = tw(key, size), ly = y + size * 0.28;
    o += solid ? rect(kx, ly, kw, size * 0.062, g.ink, 1)
      : `<line x1="${kx * S}" y1="${(ly + 1) * S}" x2="${(kx + kw) * S}" y2="${(ly + 1) * S}" stroke="${mix(g.ink, g.bg[0], 0.5)}" stroke-width="${size * 0.062 * S}" stroke-dasharray="${size * 0.13 * S} ${size * 0.11 * S}" stroke-linecap="round"/>`;
  }
  return o;
}

// 板を1枚組む。crop を渡すと、画面のその範囲だけを板の幅いっぱいに拡大する
async function card({ name, g, src, size, lines, eyebrow, top, shadow, crop, band = 32, id }) {
  const DX = 30, DW = W - DX * 2, R = 26, DH = Math.round(DW * (H / W));
  let o = ground(g, id, shadow);
  if (eyebrow) o += t(DX + 4, 86, eyebrow, 10, 700, g.small, 1.8);
  let y = top.text;
  for (const [parts, solid] of lines) { o += headline(g, DX + 4, y, parts, size, solid === true); y += size * 1.28; }
  o += `<g filter="url(#sh${id})">${rect(DX, top.板, DW, DH, '#FFFFFF', R)}</g>`;
  const under = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`;

  const meta = await sharp(join(SRC, src)).metadata();
  const cut = crop || { left: 0, top: 0, width: meta.width, height: meta.height };
  const scale = (DW * S) / cut.width;                       // 板の幅いっぱいに広げる
  const inner = await sharp(join(SRC, src)).extract(cut)
    .resize(DW * S, Math.round(cut.height * scale), { fit: 'fill' }).png().toBuffer();
  // 寄って切るときは帯を置かない（切った先はもう画面の上端ではない）
  const bandBuf = band > 0 ? await sharp(join(SRC, src))
    .extract({ left: cut.left, top: cut.top, width: cut.width, height: 1 })
    .resize(DW * S, band * S, { fit: 'fill' }).png().toBuffer() : null;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${DW * S}" height="${DH * S}"><rect width="${DW * S}" height="${DH * S}" rx="${R * S}" fill="#fff"/></svg>`);
  const screen = await sharp({ create: { width: DW * S, height: DH * S, channels: 4, background: '#FFFFFF' } })
    .composite([...(bandBuf ? [{ input: bandBuf, top: 0, left: 0 }] : []), { input: inner, top: band * S, left: 0 }, { input: mask, blend: 'dest-in' }])
    .png().toBuffer();

  const over = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">`
    + `<rect x="${(DX + 0.5) * S}" y="${(top.板 + 0.5) * S}" width="${(DW - 1) * S}" height="${(DH - 1) * S}" rx="${R * S}" fill="none" stroke="${g.edge}" stroke-width="${1 * S}" opacity=".18"/>`
    + `<defs><linearGradient id="f2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${g.bg[2]}" stop-opacity="0"/><stop offset="100%" stop-color="${g.bg[2]}" stop-opacity="1"/></linearGradient></defs>`
    + `<rect x="0" y="${(H - 130) * S}" width="${W * S}" height="${130 * S}" fill="url(#f2)"/></svg>`;

  return { name, buf: await sharp(Buffer.from(under))
    .composite([{ input: screen, top: top.板 * S, left: DX * S }, { input: Buffer.from(over) }]).png().toBuffer() };
}

const L1 = [[['', '決まった', '予定と、'], true], [['', 'まだ', 'の予定。'], false]];

(async () => {
  const shots = [
    // いま。見出し 32px、地は灰、影 0.20、画面は全部見せる
    await card({ id: 0, name: 'いま', g: GROUND.灰, src: 'ss-1-month.png', size: 32, lines: L1,
      eyebrow: 'まだ決まっていない予定の、カレンダー', top: { text: 152, 板: 250 }, shadow: 0.20 }),
    // 見出しを大きく。字の落差がいちばん効く
    await card({ id: 1, name: '見出しを 32 → 46', g: GROUND.灰, src: 'ss-1-month.png', size: 46, lines: L1,
      eyebrow: 'まだ決まっていない予定の、カレンダー', top: { text: 168, 板: 300 }, shadow: 0.28 }),
    // 地を紙に。アイコンは型押しの紙なので、地を紙にすると一続きになる
    await card({ id: 2, name: '＋ 地を紙に', g: GROUND.紙, src: 'ss-1-month.png', size: 46, lines: L1,
      eyebrow: 'まだ決まっていない予定の、カレンダー', top: { text: 168, 板: 300 }, shadow: 0.24 }),
    // 寄って切る。ダイアログだけを板の幅いっぱいに拡大する（1.9倍）
    await card({ id: 3, name: '寄って切る（2枚目）', g: GROUND.灰, src: 'ss-6-dialog.png', size: 40,
      lines: [[['あとで、', '', ''], null], [['聞きます。', '', ''], null]],
      top: { text: 160, 板: 290 }, shadow: 0.28, band: 0,
      // 板の高さを埋める分だけ切る。足りないと下が白く空く（一度そうなった）。
      // 幅 1050/1290 で 1.23 倍。これ以上寄せると曜日や日付が切れる
      crop: { left: 120, top: 620, width: 1050, height: 1956 } }),
  ];

  const SC = 0.235, PAD = 16, GAP = 14, LABEL = 24;
  const cw = Math.round(W * S * SC), ch = Math.round(H * S * SC);
  const comp = [];
  for (let i = 0; i < shots.length; i += 1) {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc(shots[i].name)}</text></svg>`), top: PAD, left });
    comp.push({ input: await sharp(shots[i].buf).resize(cw).png().toBuffer(), top: PAD + LABEL, left });
  }
  await sharp({ create: { width: PAD * 2 + shots.length * cw + (shots.length - 1) * GAP, height: PAD * 2 + LABEL + ch, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile(join(OUT, 'store-style.png'));
  console.log('できた store-assets/store-style.png');
})();

// ---- 構図を動かす。字の大きさを変えずにスタイリッシュさを出す手 ----

/** 板を作って返す（帯＋画面を丸角で切ったもの）。傾ける前の素材 */
async function panel(src, DW, DH, R, band, crop) {
  const meta = await sharp(join(SRC, src)).metadata();
  const cut = crop || { left: 0, top: 0, width: meta.width, height: meta.height };
  const scale = (DW * S) / cut.width;
  const inner = await sharp(join(SRC, src)).extract(cut)
    .resize(DW * S, Math.round(cut.height * scale), { fit: 'fill' }).png().toBuffer();
  const bandBuf = band > 0 ? await sharp(join(SRC, src))
    .extract({ left: cut.left, top: cut.top, width: cut.width, height: 1 })
    .resize(DW * S, band * S, { fit: 'fill' }).png().toBuffer() : null;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${DW * S}" height="${DH * S}"><rect width="${DW * S}" height="${DH * S}" rx="${R * S}" fill="#fff"/></svg>`);
  return sharp({ create: { width: DW * S, height: DH * S, channels: 4, background: '#FFFFFF' } })
    .composite([...(bandBuf ? [{ input: bandBuf, top: 0, left: 0 }] : []), { input: inner, top: band * S, left: 0 }, { input: mask, blend: 'dest-in' }])
    .png().toBuffer();
}

/** 枠からはみ出す分を切ってから重ねる。sharp は枠より大きい画像を受け取らない */
async function place(img, left, top) {
  const m = await sharp(img).metadata();
  const CW = W * S, CH = H * S;
  const sx = Math.max(0, -left), sy = Math.max(0, -top);
  const w = Math.min(m.width - sx, CW - Math.max(0, left));
  const h = Math.min(m.height - sy, CH - Math.max(0, top));
  if (w <= 0 || h <= 0) return null;
  const cut = (sx || sy || w !== m.width || h !== m.height)
    ? await sharp(img).extract({ left: sx, top: sy, width: w, height: h }).png().toBuffer() : img;
  return { input: cut, left: Math.max(0, left), top: Math.max(0, top) };
}

/** 傾けたものの影。同じ形の黒を作ってぼかす（回すと矩形の影では合わない） */
async function shadowOf(buf, blur, alpha) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i += 1) {
    out[i * 4] = 58; out[i * 4 + 1] = 65; out[i * 4 + 2] = 80;
    out[i * 4 + 3] = Math.round(data[i * info.channels + 3] * alpha);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).blur(blur).png().toBuffer();
}

(async () => {
  const DX = 30, DW = W - DX * 2, R = 26, DH = Math.round(DW * (H / W));
  const g = GROUND.灰;
  const shots = [];

  // 0. いま
  shots.push(await card({ id: 10, name: 'いま', g, src: 'ss-1-month.png', size: 32, lines: L1,
    eyebrow: 'まだ決まっていない予定の、カレンダー', top: { text: 152, 板: 250 }, shadow: 0.20 }));

  // 1. 傾けて、画面の外へ流す。字の大きさは変えない
  {
    const raw = await panel('ss-1-month.png', DW, DH, R, 32, null);
    const rot = await sharp(raw).rotate(-6, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const sh = await shadowOf(rot, 22 * S, 0.30);
    const m = await sharp(rot).metadata();
    let o = ground(g, 11, 0);
    o += t(DX + 4, 86, 'まだ決まっていない予定の、カレンダー', 10, 700, g.small, 1.8);
    o += headline(g, DX + 4, 152, L1[0][0], 32, true);
    o += headline(g, DX + 4, 152 + 32 * 1.28, L1[1][0], 32, false);
    const left = Math.round((W * 0.30) * S), top = Math.round(250 * S);
    shots.push({ name: '傾けて外へ流す', buf: await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`))
      .composite([await place(sh, left + 2 * S, top + 14 * S), await place(rot, left, top)].filter(Boolean)).png().toBuffer() });
  }

  // 2. 一部を大きく切って、板の上に重ねる（拡大鏡）
  {
    const raw = await panel('ss-1-month.png', DW, DH, R, 32, null);
    // 月表示の一角（4日ぶん）を 2.4 倍で切る。本物のキャプチャの一部
    const loupeW = 520, loupeH = 300;
    const cut = await sharp(join(SRC, 'ss-1-month.png'))
      .extract({ left: 300, top: 1180, width: 640, height: 370 })
      .resize(loupeW * S, loupeH * S, { fit: 'fill' }).png().toBuffer();
    const lm = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${loupeW * S}" height="${loupeH * S}"><rect width="${loupeW * S}" height="${loupeH * S}" rx="${18 * S}" fill="#fff"/></svg>`);
    const loupe = await sharp(cut).composite([{ input: lm, blend: 'dest-in' }]).png().toBuffer();
    const lsh = await shadowOf(loupe, 20 * S, 0.34);
    let o = ground(g, 12, 0.22);
    o += t(DX + 4, 86, 'まだ決まっていない予定の、カレンダー', 10, 700, g.small, 1.8);
    o += headline(g, DX + 4, 152, L1[0][0], 32, true);
    o += headline(g, DX + 4, 152 + 32 * 1.28, L1[1][0], 32, false);
    o += `<g filter="url(#sh12)">${rect(DX, 250, DW, DH, '#FFFFFF', R)}</g>`;
    shots.push({ name: '一部を大きく重ねる', buf: await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`))
      .composite([
        { input: raw, top: 250 * S, left: DX * S },
        await place(lsh, Math.round(-8 * S), Math.round(610 * S)),
        await place(loupe, -10 * S, 600 * S),
      ].filter(Boolean)).png().toBuffer() });
  }

  // 3. 言葉を減らして、画面を端まで出す
  {
    const FW = W, FDH = Math.round(FW * (H / W));
    const raw = await panel('ss-1-month.png', FW, FDH, 0, 32, null);
    let o = ground(g, 13, 0.22);
    o += headline(g, DX + 4, 150, [' ', '決まってる？', ''], 42, true);
    o += t(DX + 4, 186, '塗りは決まった予定。点線は、まだの予定。', 12, 400, g.small, 0.4);
    const over = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}"><defs><linearGradient id="f3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${g.bg[2]}" stop-opacity="0"/><stop offset="100%" stop-color="${g.bg[2]}" stop-opacity="1"/></linearGradient></defs><rect x="0" y="${(H - 120) * S}" width="${W * S}" height="${120 * S}" fill="url(#f3)"/></svg>`;
    shots.push({ name: '言葉を減らして端まで', buf: await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${o}</svg>`))
      .composite([{ input: raw, top: 250 * S, left: 0 }, { input: Buffer.from(over) }]).png().toBuffer() });
  }

  const SC = 0.235, PAD = 16, GAP = 14, LABEL = 24;
  const cw = Math.round(W * S * SC), ch = Math.round(H * S * SC);
  const comp = [];
  for (let i = 0; i < shots.length; i += 1) {
    const left = PAD + i * (cw + GAP);
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw + GAP}" height="${LABEL}"><text x="0" y="16" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${esc(shots[i].name)}</text></svg>`), top: PAD, left });
    comp.push({ input: await sharp(shots[i].buf).resize(cw).png().toBuffer(), top: PAD + LABEL, left });
  }
  await sharp({ create: { width: PAD * 2 + shots.length * cw + (shots.length - 1) * GAP, height: PAD * 2 + LABEL + ch, channels: 3, background: '#C9CDD4' } })
    .composite(comp).png().toFile(join(OUT, 'store-style2.png'));
  console.log('できた store-assets/store-style2.png');
})();
