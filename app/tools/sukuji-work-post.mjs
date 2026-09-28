// 社会人の1か月の紹介画像（sukuji/flat-work/）の仕上げ。
//
//   SUKUJI_SET=work node app/tools/sukuji-wide-gen.mjs
//   SUKUJI_SET=work node app/tools/sukuji-page-gen.mjs
//   node app/tools/sukuji-work-post.mjs
//
// やること
//  1. 見開き（wide）の札を、学生の言葉（バイト・ライブ・BBQ・合宿）から社会人の言葉に描き直す。
//     札は ChatGPT の絵の一部なので消さずに、同じ位置・同じ傾きで、ひと回り大きい札を上からかぶせる
//  2. 6 枚目（まとめ）の小見出し「バイトも、遊びも、用事も」→「仕事も、家族も、自分の時間も」
//  3. 7 枚目を足す：「仕事の予定も、外に出ない。」（アカウント登録なし・端末の中だけ・広告なし・月額なし）
//
// 文字は Noto Sans JP（Black / Bold）。ChatGPT の見出しの書体にいちばん近かった
import sharp from 'sharp';
import { join } from 'node:path';
import { ROOT } from './sukuji-fill.mjs';

const OUT = join(ROOT, 'flat-work');
const W = 1290, H = 2796;
const FONT = "'Noto Sans JP','Yu Gothic',sans-serif";

// ---- 1. 見開きの札 ----
// 位置・大きさ・傾きは、学生の版の札を画素から測ったもの（影を除いた本体）
const CHIPS = [
  { cx: 340, cy: 1315, w: 486, h: 184, deg: -17.6, text: '✓ 定例', kind: 'solid', c: 'work' },
  { cx: 332, cy: 1680, w: 505, h: 205, deg: -12.9, text: '？ 飲み会', kind: 'dash', c: 'asobi' },
  { cx: 830, cy: 1856, w: 540, h: 180, deg: -11.5, text: '10:30 歯医者', kind: 'solid', c: 'yoji' },
  { cx: 2248, cy: 1963, w: 560, h: 200, deg: -12.6, text: '？ 打ち合わせ', kind: 'dash', c: 'work' },
  { cx: 2322, cy: 2367, w: 425, h: 184, deg: -16.4, text: '✓ 出張', kind: 'solid', c: 'work' },
];
const PAL = {
  work: { solid: '#AAB8DC', ink: '#1F2740', paper: '#EEF1F9', line: '#7F93C9' },
  yoji: { solid: '#B7B0D6', ink: '#2B2645', paper: '#F1EEF8', line: '#8B7AB8' },
  asobi: { solid: '#E8C3AA', ink: '#4A3324', paper: '#FBF1E6', line: '#E39A5E' },
};
async function chips(file, list, cw) {
  const g = (c, body) => `<g transform="translate(${c.cx} ${c.cy}) rotate(${c.deg})">${body}</g>`;
  const S = 1.1; // 元の札より 1 割大きくして、縁と影まで覆う
  const shadow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${H}">${list.map((c) => {
    const w = c.w * S, h = c.h * S;
    return g({ ...c, cx: c.cx + 6, cy: c.cy + 16 }, `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="#000" fill-opacity="0.16"/>`);
  }).join('')}</svg>`);
  const blur = await sharp(shadow).blur(18).png().toBuffer();
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${H}">${list.map((c) => {
    const w = c.w * S, h = c.h * S, p = PAL[c.c];
    const box = c.kind === 'solid'
      ? `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${p.solid}"/>`
      : `<rect x="${-w / 2 + 5}" y="${-h / 2 + 5}" width="${w - 10}" height="${h - 10}" rx="${(h - 10) / 2}" fill="${p.paper}" stroke="${p.line}" stroke-width="10" stroke-dasharray="26 18"/>`;
    const fs = Math.min(76, Math.round((w - h * 0.7) / Math.max(3, [...c.text].length) * 1.05));
    return g(c, `${box}<text x="0" y="${fs * 0.36}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${fs}" fill="${p.ink}">${c.text}</text>`);
  }).join('')}</svg>`);
  return sharp(file).composite([{ input: blur }, { input: svg }]).png().toBuffer();
}
{
  const wide = join(OUT, 'wide.png');
  const meta = await sharp(wide).metadata();
  const out = await chips(wide, CHIPS, meta.width);
  await sharp(out).png().toFile(join(OUT, 'wide.png'));
  await sharp(out).extract({ left: 0, top: 0, width: W, height: H }).png().toFile(join(OUT, 'wide-1.png'));
  await sharp(out).extract({ left: W, top: 0, width: W, height: H }).png().toFile(join(OUT, 'wide-2.png'));
  console.log('→ flat-work/wide-1.png, wide-2.png（札を社会人の言葉に）');
}

// ---- 2. 6 枚目の小見出し ----
{
  const file = join(OUT, '6.png');
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const px = (x, y) => { const o = (y * W + x) * ch; return [data[o], data[o + 1], data[o + 2]]; };
  const d = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const bg = px(40, 1000), band = [214, 229, 208];
  // 小見出しの行を探す：緑の字がある行を上から数えて、いちばん下のかたまりが小見出し
  // （見出しの「見える」も緑なので、行のかたまりで分ける。前は両方まとめて拾って見出しの下を消した）
  const green = (c) => c[1] > c[0] + 12 && c[0] < 150;
  const rowsG = [];
  for (let y = 500; y < 1000; y++) { let n = 0; for (let x = 90; x < 1100; x += 2) if (green(px(x, y))) n++; rowsG.push([y, n]); }
  const groups = []; let cur = null;
  for (const [y, n] of rowsG) { if (n > 2) { if (cur && y - cur.b <= 10) cur.b = y; else { cur = { a: y, b: y }; groups.push(cur); } } }
  const sub = groups.filter((g) => g.b - g.a > 20).pop();
  let y0 = sub.a, y1 = sub.b, x0 = 9999, x1 = 0;
  for (let y = y0; y <= y1; y++) for (let x = 90; x < 1100; x++) if (green(px(x, y))) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  console.log(`  小見出し (${x0},${y0})–(${x1},${y1})`);
  // 字の色：元の小見出しの中で、いちばん濃い緑（字と字のすき間の地を拾わないように）
  let inkC = [78, 125, 92], lum = 999;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = px(x, y); if (green(c) && c[0] + c[1] + c[2] < lum) { lum = c[0] + c[1] + c[2]; inkC = c; } }
  // 帯の上の縁（斜めの直線）を、小見出しの右（x 1120〜1270）の列で拾って、式にする
  const pts = [];
  for (let x = 1120; x < 1270; x += 5) for (let y = 500; y < 1100; y++) { if (d(px(x, y), band) < 14 && d(px(x, y - 3), bg) < 14) { pts.push([x, y]); break; } }
  let a = 0, b = 9999;
  if (pts.length > 5) { const n = pts.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; } a = (n * sxy - sx * sy) / (n * sxx - sx * sx); b = (sy - a * sx) / n; }
  const outBuf = Buffer.from(data);
  for (let y = y0 - 14; y <= y1 + 14; y++) for (let x = x0 - 14; x <= x1 + 14; x++) {
    const c = y >= a * x + b ? band : bg, o = (y * W + x) * ch;
    outBuf[o] = c[0]; outBuf[o + 1] = c[1]; outBuf[o + 2] = c[2];
  }
  const size = Math.round((y1 - y0) * 1.12);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="${x0}" y="${y1}" font-family="${FONT}" font-weight="700" font-size="${size}" letter-spacing="3" fill="rgb(${inkC.join(',')})">仕事も、家族も、自分の時間も</text></svg>`);
  const out = await sharp(outBuf, { raw: { width: W, height: H, channels: ch } }).composite([{ input: svg }]).png().toBuffer();
  await sharp(out).png().toFile(file);
  console.log('→ flat-work/6.png（小見出し）');
}

// ---- 3. 7 枚目：外に出ない ----
{
  const BG = '#EEF3EC', BAND = '#D6E5D0', INK = '#1C1F1B', GREEN = '#3E7A4D', SUB = '#4E7D5C';
  const icon = {
    person: `<circle cx="70" cy="46" r="24" fill="none" stroke="${SUB}" stroke-width="11"/><path d="M26 124 Q70 76 114 124" fill="none" stroke="${SUB}" stroke-width="11" stroke-linecap="round"/><path d="M18 18 L122 122" stroke="${SUB}" stroke-width="11" stroke-linecap="round"/>`,
    phone: `<rect x="38" y="10" width="64" height="120" rx="14" fill="none" stroke="${SUB}" stroke-width="11"/><path d="M60 110 H80" stroke="${SUB}" stroke-width="10" stroke-linecap="round"/><path d="M58 52 L68 64 L86 42" fill="none" stroke="${SUB}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    ad: `<rect x="16" y="30" width="108" height="80" rx="12" fill="none" stroke="${SUB}" stroke-width="11"/><text x="70" y="86" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="40" fill="${SUB}">AD</text><path d="M14 16 L126 124" stroke="${SUB}" stroke-width="11" stroke-linecap="round"/>`,
    yen: `<circle cx="70" cy="70" r="54" fill="none" stroke="${SUB}" stroke-width="11"/><path d="M48 40 L70 70 L92 40 M52 74 H88 M52 92 H88 M70 70 V112" fill="none" stroke="${SUB}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  const rows = [
    ['person', 'アカウント登録なし', 'メールも電話番号も、いりません'],
    ['phone', '予定は iPhone の中だけ', '開発者のサーバーはありません'],
    ['ad', '広告なし', 'のぞき見も、追いかけもしません'],
    ['yen', '月額料金なし', 'いまある機能は、ずっと無料'],
  ];
  const cardY = 1120, cardH = 300, gap = 44, cardX = 110, cardW = W - 220;
  const cards = rows.map(([k, t, s], i) => {
    const y = cardY + i * (cardH + gap);
    return `<g><rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="46" fill="#FFFFFF"/>
      <g transform="translate(${cardX + 60} ${y + 80}) scale(1.0)">${icon[k]}</g>
      <text x="${cardX + 250}" y="${y + 138}" font-family="${FONT}" font-weight="900" font-size="72" fill="${INK}">${t}</text>
      <text x="${cardX + 252}" y="${y + 214}" font-family="${FONT}" font-weight="700" font-size="42" fill="#6B756D">${s}</text></g>`;
  }).join('');
  const shadowSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rows.map((_, i) => `<rect x="${cardX + 4}" y="${cardY + i * (cardH + gap) + 18}" width="${cardW}" height="${cardH}" rx="46" fill="#000" fill-opacity="0.10"/>`).join('')}</svg>`);
  const shadow = await sharp(shadowSvg).blur(20).png().toBuffer();
  const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <polygon points="0,${H * 0.62} ${W},${H * 0.36} ${W},${H * 0.36 + 900} 0,${H * 0.62 + 900}" fill="${BAND}"/>
  </svg>`);
  const title = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <text x="104" y="560" font-family="${FONT}" font-weight="900" font-size="160" letter-spacing="-4" fill="${INK}">仕事の予定も、</text>
    <text x="104" y="760" font-family="${FONT}" font-weight="900" font-size="160" letter-spacing="-4" fill="${GREEN}">外に出ない<tspan fill="${INK}">。</tspan></text>
    <text x="110" y="900" font-family="${FONT}" font-weight="700" font-size="52" letter-spacing="3" fill="${SUB}">会社の予定を入れても、安心</text>
    ${cards}
    <text x="${W / 2}" y="${cardY + 4 * (cardH + gap) + 90}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="44" fill="#4E5A51">開発者も、あなたの予定を見られません</text>
  </svg>`);
  await sharp(base).composite([{ input: shadow }, { input: title }]).png().toFile(join(OUT, '7.png'));
  console.log('→ flat-work/7.png（外に出ない）');
}
