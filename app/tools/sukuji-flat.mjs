// sukuji.com 用の 5 枚を、絵を使わずに組む（minical 風）。
//
//   node app/tools/sukuji-flat.mjs
//
// 出力: store-assets/sukuji/flat/N.png（1290×2796）
//
// 本人が「いいな」と送ってきた紹介画像のうち、このアプリに合うのは minical の型だった：
// 淡い無地の地、まっすぐ大きいスマホ、太い見出し（売りの言葉だけ色）、画面の一部を
// 拡大した吹き出し。机の写真（ChatGPT の絵）はやめて、その型で組む。
// 見出しとスマホの描き方は sukuji-fill.mjs の部品を使う。
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { drawTitle, drawPhone, widgetCrop, PHONE, TEXT, ROOT } from './sukuji-fill.mjs';

const OUT = join(ROOT, 'flat');
mkdirSync(OUT, { recursive: true });
const W = 1290, H = 2796;
// 見出しは 175px だと直後の大きなスマホと詰まって息苦しかった。140px に下げて余白で見せる。
// 緑の地の上なので、アクセントの緑は濃いめに
TEXT.head.max = 140; TEXT.head.gapAbove = 44; TEXT.sub.top = 330; TEXT.sub.size = 56;
TEXT.accent = '#3E7A4D'; TEXT.sub.color = '#4A6E4F'; TEXT.head.color = '#1C1F1B';
const GREEN = TEXT.accent;
// スマホは幅 920px（71%）。見出しが小さくなったぶん、大きくできる
PHONE.w = 920;

// 地：淡い緑（アクセントの緑を薄めたもの）。最初は生成りにしたが、アプリの画面も生成りなので
// 全部が同じ色に沈んだ。minical が灰の地に白い画面で浮かせているのと同じ理屈で、地に色を置く
async function background() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF3EA"/><stop offset="1" stop-color="#D6E3D1"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// スマホの画面がカードのどこに来るか。スクショの座標 → カードの座標の換算に使う
function geom(shotW, shotH, top) {
  const left = Math.round((W - PHONE.w) / 2), sw = PHONE.w - PHONE.bezel * 2;
  const k = sw / shotW;
  return { x0: left + PHONE.bezel, y0: top + PHONE.bezel, k, sw, sh: Math.round(sw * shotH / shotW) };
}

// 吹き出し：スクショの一部（crop = [x, y, w, h]）を scale 倍にして、白い角丸のカードに入れ、
// 元の場所へ向く三角をつける。dy は元の場所からどれだけ下に置くか（負なら上）
// side: 'right' | 'left' | 'center'。端に寄せて、画面の真ん中を隠さない
async function callout(canvas, shotFile, crop, g, scale, dy = 90, side = 'center') {
  const [cx, cy, cw, chh] = crop;
  const pad = 18, border = 5, r = 26;
  const iw = Math.round(cw * scale), ih = Math.round(chh * scale);
  const w = iw + pad * 2, h = ih + pad * 2;
  const srcX = g.x0 + (cx + cw / 2) * g.k, srcY = g.y0 + (cy + chh / 2) * g.k, srcH = chh * g.k;
  const left = Math.round(side === 'right' ? W - 36 - w : side === 'left' ? 36 : Math.min(Math.max(40, W / 2 - w / 2), W - 40 - w));
  const top = Math.round(dy >= 0 ? srcY + srcH / 2 + dy : srcY - srcH / 2 + dy - h);
  const img = await sharp(shotFile).extract({ left: cx, top: cy, width: cw, height: chh }).resize(iw, ih).png().toBuffer();
  // 三角：元の場所の中心から、カードの縁へ。カードより先に描いて、根元はカードで隠す
  const apexY = dy >= 0 ? srcY + srcH / 2 - 6 : srcY - srcH / 2 + 6;
  const baseY = dy >= 0 ? top + border : top + h - border;
  const tri = `<polygon points="${srcX},${apexY} ${srcX - 64},${baseY} ${srcX + 64},${baseY}" fill="#fff" stroke="${GREEN}" stroke-width="${border}" stroke-linejoin="round"/>`;
  // 影はカード全体の大きさで描く（吹き出しが幅いっぱいだと、はみ出して composite が拒む）
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${left}" y="${top + 18}" width="${w}" height="${h}" rx="${r}" fill="#000" fill-opacity="0.22"/></svg>`)).blur(22).png().toBuffer();
  const card = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${tri}
    <rect x="${left}" y="${top}" width="${w}" height="${h}" rx="${r}" fill="#fff" stroke="${GREEN}" stroke-width="${border}"/>
    <rect x="${srcX - 58}" y="${dy >= 0 ? top - 1 : top + h - border - 2}" width="116" height="${border + 3}" fill="#fff"/>
  </svg>`);
  return sharp(canvas).composite([
    { input: shadow },
    { input: card },
    { input: img, left: left + pad, top: top + pad },
  ]).png().toBuffer();
}

// タップの印：スクショの座標 (x, y) に、緑の輪を二重に
async function tapRing(canvas, g, x, y) {
  const px = g.x0 + x * g.k, py = g.y0 + y * g.k;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <circle cx="${px}" cy="${py}" r="26" fill="${GREEN}" fill-opacity="0.35"/>
    <circle cx="${px}" cy="${py}" r="52" fill="none" stroke="${GREEN}" stroke-width="9" stroke-opacity="0.9"/>
    <circle cx="${px}" cy="${py}" r="88" fill="none" stroke="${GREEN}" stroke-width="5" stroke-opacity="0.4"/>
  </svg>`);
  return sharp(canvas).composite([{ input: svg }]).png().toBuffer();
}

// 「点線 → 塗り」の帯を自分で描く（アプリの帯と同じ見た目）。y はスクショの座標
async function chipsCard(canvas, g, { y, text }) {
  const cw = 980, ch = 210, r = 30;
  const left = Math.round((W - cw) / 2), top = Math.round(g.y0 + y * g.k - ch / 2);
  const chip = (x, dashed) => dashed
    ? `<rect x="${x}" y="${top + 62}" width="330" height="86" rx="16" fill="#EEF4EC" stroke="#7FA987" stroke-width="5" stroke-dasharray="14 10"/><text x="${x + 165}" y="${top + 62 + 60}" text-anchor="middle" font-family="${TEXT.font}" font-size="44" fill="#5E7D63">${text}</text>`
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

// 1 枚：地 → 見出し → スマホ → 吹き出し・印
async function card(n, { sub, lines, accent, shot, callouts = [], tap = null, screen = null, chips = null }) {
  let canvas = await background();
  const t = await drawTitle(canvas, W, H, sub, lines, accent);
  canvas = t.canvas;
  const top = t.bottom + 90;
  const shotFile = shot ? join(ROOT, shot) : screen;
  const m = await sharp(shotFile).metadata();
  const g = geom(m.width, m.height, top);
  canvas = await drawPhone(canvas, W, H, shotFile, top);
  if (tap) canvas = await tapRing(canvas, g, tap[0], tap[1]);
  for (const c of callouts) canvas = await callout(canvas, shotFile, c.crop, g, c.scale ?? 0.9, c.dy ?? 90, c.side ?? 'center');
  if (chips) canvas = await chipsCard(canvas, g, chips);
  await sharp(canvas).png().toFile(join(OUT, `${n}.png`));
  console.log(`→ flat/${n}.png`);
  return { canvas, g, top };
}

// ---- 3 枚目：ホーム画面を自分で組む ----
// 実機のホーム画面は本人のアプリや壁紙が写るので使えない。淡い壁紙の上に、切り出した
// 大・中のウィジェットと、ロゴ無しのアイコン・検索・ドックを描いて、それらしいホーム画面にする
async function homeScreen() {
  const sw = 1290, sh = 2796;
  const wall = `<defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6F1E6"/><stop offset="1" stop-color="#E9DFD2"/></linearGradient></defs><rect width="${sw}" height="${sh}" fill="url(#w)"/>`;
  const large = await widgetCrop('large'), medium = await widgetCrop('medium');
  const lw = 1067, lh = Math.round(lw * 382 / 364), mh = Math.round(lw / 2.14);
  const lx = Math.round((sw - lw) / 2), ly = 250, my = ly + lh + 96;
  const rounded = async (buf, w, h) => {
    const r = Math.round(Math.min(w, h) * 0.13);
    const m = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
    return sharp(buf).resize(w, h, { fit: 'fill' }).ensureAlpha().composite([{ input: m, blend: 'dest-in' }]).png().toBuffer();
  };
  const label = (y) => `<text x="${sw / 2}" y="${y}" text-anchor="middle" font-family="${TEXT.font}" font-size="34" fill="#3A3A3A">LUKKO</text>`;
  // ドック：半透明の板に、ロゴ無しの角丸 4 つ
  const dockY = sh - 60 - 300, iconY = dockY + 60;
  const icons = ['#8FB496', '#B9A6D2', '#E5B98E', '#A7C4D9'].map((c, i) => `<rect x="${150 + i * 260}" y="${iconY}" width="180" height="180" rx="42" fill="${c}"/>`).join('');
  const chrome = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}">${wall}
    ${label(ly + lh + 52)}${label(my + mh + 52)}
    <rect x="${sw / 2 - 150}" y="${dockY - 190}" width="300" height="84" rx="42" fill="#fff" fill-opacity="0.55"/>
    <text x="${sw / 2}" y="${dockY - 190 + 56}" text-anchor="middle" font-family="${TEXT.font}" font-size="36" fill="#6B6B6B">検索</text>
    <rect x="80" y="${dockY}" width="${sw - 160}" height="300" rx="90" fill="#fff" fill-opacity="0.5"/>
    ${icons}
  </svg>`);
  return sharp(chrome).composite([
    { input: await rounded(large, lw, lh), left: lx, top: ly },
    { input: await rounded(medium, lw, mh), left: lx, top: my },
  ]).png().toBuffer();
}

// 小のウィジェットを、スマホの縁に少し重ねて浮かせる
async function floatSmall(canvas, g) {
  const small = await widgetCrop('small');
  const size = 430, r = Math.round(size * 0.13);
  const m = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`);
  const img = await sharp(small).resize(size, size).ensureAlpha().composite([{ input: m, blend: 'dest-in' }]).png().toBuffer();
  const pad = 80;
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size + pad * 2}" height="${size + pad * 2}"><rect x="${pad}" y="${pad + 22}" width="${size}" height="${size}" rx="${r}" fill="#000" fill-opacity="0.28"/></svg>`)).blur(26).png().toBuffer();
  const left = 50, top = g.y0 + Math.round(g.sh * 0.56);
  return sharp(canvas).composite([{ input: shadow, left: left - pad, top: top - pad }, { input: img, left, top }]).png().toBuffer();
}

// ---- 5 枚 ----
await card(1, { sub: 'たぶんの予定も、そのまま', lines: ['未定のまま、', '置ける'], accent: ['未定'], shot: '1-calendar.png',
  callouts: [{ crop: [540, 1258, 750, 180], scale: 1.15, dy: 64, side: 'right' }] });   // 16 ✓バイト（塗り）と 18 ライブ（点線）
await card(2, { sub: '点線が、塗りに変わる', lines: ['決まったら、', '押すだけ'], accent: ['押すだけ'], shot: '2-dialog.png',
  tap: [645, 1516], chips: { y: 2350, text: 'バイト' } });                 // 「確定した」に印。下に 点線 → 塗り の帯
{
  const screen = join(OUT, '_home.png');
  await sharp(await homeScreen()).toFile(screen);
  const r = await card(3, { sub: '小・中・大、好きな大きさで', lines: ['ウィジェットで', '表示'], accent: ['ウィジェット'], screen });
  await sharp(await floatSmall(r.canvas, r.g)).png().toFile(join(OUT, '3.png'));
}
await card(4, { sub: '○△× で、空きがひと目', lines: ['いつ空いてる？', 'すぐ答える'], accent: ['すぐ答える'], shot: '3-free.png',
  callouts: [{ crop: [40, 838, 760, 150], scale: 1.2, dy: 64, side: 'left' }] });    // 木 3：バイトのあと空いてる行
await card(5, { sub: 'バイトも、遊びも、用事も', lines: ['何に時間を', '使ったか、見える'], accent: ['見える'], shot: '5-report.png',
  callouts: [{ crop: [50, 700, 1190, 300], scale: 0.95, dy: 64 }] });    // 62 時間とバイトの内訳
console.log('できた store-assets/sukuji/flat/');
