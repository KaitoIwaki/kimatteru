// ChatGPT が描いた見出しを、書体はそのままで切り出して、大きさと位置を揃えて置き直す部品。
// sukuji-page-gen.mjs（3 枚目以降）と sukuji-wide-gen.mjs（1〜2 枚目）の両方で使う。
//
// 見出しは「暗い画素（黒と緑の文字）のある行」を上からまとめたかたまり。行の間が gap px 以内なら
// 同じかたまい。x・y の範囲（limitX / limitY）で、スマホや札を見ないようにする。
// 地との色の差をアルファにして文字だけ抜くので、拡大しても地の四角は出ない。
import sharp from 'sharp';

// 見出し 1 行目の高さをこれに揃える（ChatGPT の 1024 幅の絵で 120px → 1.36 倍）。1〜2 枚目もこの値に縮める
export const TITLE_LINE = 163;

// 戻り値: { block（透明つき PNG）, left, top, bottom, lineHeight（1 行目の高さ。倍率を決める目安） }
export async function cutTitle(canvas, { W, H, limitX = W, limitY, gap = 90, scale = null, targetLine = null, left = 110, top = 410 }) {
  const { data, info } = await sharp(canvas).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels, bg = [data[(10 * W + 10) * ch], data[(10 * W + 10) * ch + 1], data[(10 * W + 10) * ch + 2]];
  const dark = (x, y) => { const o = (y * W + x) * ch; return data[o] + data[o + 1] + data[o + 2] < 400; };   // 400：スマホの縁の線は拾わない
  const rows = [];
  for (let y = 0; y < limitY; y++) { let n = 0; for (let x = 0; x < limitX; x += 2) if (dark(x, y)) { n++; if (n > 2) break; } if (n > 2) rows.push(y); }
  if (!rows.length) throw new Error('見出しが見つからない');
  // 行のかたまり。1 行目の高さから倍率を決められるように、行ごとにも分ける（間 12px 以内が同じ行）
  const lines = [];
  for (const y of rows) { const l = lines[lines.length - 1]; if (l && y - l[1] <= 12) l[1] = y; else lines.push([y, y]); }
  let y0 = rows[0], y1 = rows[0];
  for (const y of rows) { if (y - y1 > gap) break; y1 = y; }
  let x0 = W, x1 = 0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < limitX; x++) if (dark(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  x0 = Math.max(0, x0 - 8); y0 = Math.max(0, y0 - 8); x1 = Math.min(W - 1, x1 + 8); y1 = Math.min(limitY - 1, y1 + 8);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const rgba = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const o = ((y + y0) * W + (x + x0)) * ch, q = (y * bw + x) * 4;
    const d = Math.abs(data[o] - bg[0]) + Math.abs(data[o + 1] - bg[1]) + Math.abs(data[o + 2] - bg[2]);
    rgba[q] = data[o]; rgba[q + 1] = data[o + 1]; rgba[q + 2] = data[o + 2]; rgba[q + 3] = Math.min(255, d * 5);
  }
  const lineHeight = lines[0][1] - lines[0][0] + 1;
  let s = scale ?? (targetLine ? targetLine / lineHeight : 1);
  s = Math.min(s, (W - left - 110) / bw);   // 右にも 110px 残す
  const tw = Math.round(bw * s), th = Math.round(bh * s);
  const block = await sharp(rgba, { raw: { width: bw, height: bh, channels: 4 } }).resize(tw, th).png().toBuffer();
  console.log(`  見出しの塊 ${bw}×${bh}（1 行目 ${lineHeight}px）→ ×${s.toFixed(2)} で ${tw}×${th}、下端 ${top + th}`);
  return { block, left, top, bottom: top + th, lineHeight, bbox: { x0, y0, x1, y1 }, bg };
}

// 切り出した元の場所を地の色で塗る（地が一色の所だけに使う）
export async function eraseBox(canvas, { W, H }, { x0, y0, x1, y1 }, bg) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${x0 - 6}" y="${y0 - 6}" width="${x1 - x0 + 13}" height="${y1 - y0 + 13}" fill="rgb(${bg[0]},${bg[1]},${bg[2]})"/></svg>`);
  return sharp(canvas).composite([{ input: svg }]).png().toBuffer();
}
