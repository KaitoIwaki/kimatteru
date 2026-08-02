// シェア画像をキャンバスに直接描く。
// DOMのスクショ変換ライブラリを使わないのは、書き出しの見た目を「静かな文房具」から
// 一切ぶらさないため（影やぼかしの再現ズレが起きない）。
const PAPER = '#FBFBFD';
const PAPER2 = '#F4F6F8';
const INK = '#26251F';
const INK_MUT = '#8C887C';
const INK_FAINT = '#B7B3A6';
const LINE = '#E6E2D6';
const TEAL = '#1D9E75';
const TEAL_DARK = '#085041';
const CORAL = '#D85A30';
const CORAL_DARK = '#712B13';
const GRAY_FILL = '#EDEEF0';

const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN",-apple-system,system-ui,sans-serif';
const f = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function badge(ctx, x, y, d, bg, glyph, fg, fontSize) {
  ctx.fillStyle = bg;
  rr(ctx, x, y, d, d, d / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = f(fontSize, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x + d / 2, y + d / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// 末尾の合印「✓？」— アプリの署名
function signature(ctx, x, y, size, label) {
  ctx.font = f(size, 700);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEAL;
  ctx.fillText('✓', x, y);
  const w = ctx.measureText('✓').width;
  ctx.fillStyle = '#C1C5CC';
  ctx.fillText('？', x + w - size * 0.1, y);
  const w2 = ctx.measureText('？').width;
  ctx.font = f(size * 0.62, 600);
  ctx.fillStyle = '#55524A';
  ctx.fillText(label, x + w + w2 + size * 0.25, y);
  ctx.textBaseline = 'alphabetic';
}

/**
 * 今月のまとめ（ストーリーズ向け 9:16）
 */
export function drawSummaryCard({ yearMonth, wage, hours, promises, canceled, rhythm }) {
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PAPER);
  g.addColorStop(1, PAPER2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const PAD = 108;
  let y = 320;

  ctx.font = f(40, 600);
  ctx.fillStyle = INK_MUT;
  ctx.fillText(yearMonth, PAD, y);
  ctx.textAlign = 'right';
  ctx.font = f(38, 600);
  ctx.fillText('まとめ', W - PAD, y);
  ctx.textAlign = 'left';

  // 予定のリズム（塗り＝決まった / 点線＝未確定 / 灰＝流れた）
  y += 110;
  const sq = 54;
  const gap = 17;
  const perRow = Math.floor((W - PAD * 2 + gap) / (sq + gap));
  rhythm.slice(0, perRow * 4).forEach((r, i) => {
    const cx = PAD + (i % perRow) * (sq + gap);
    const cy = y + Math.floor(i / perRow) * (sq + gap);
    rr(ctx, cx, cy, sq, sq, 12);
    if (r.kind === 'solid') {
      ctx.fillStyle = r.color;
      ctx.fill();
    } else if (r.kind === 'gone') {
      ctx.fillStyle = GRAY_FILL;
      ctx.fill();
    } else {
      ctx.fillStyle = r.paper;
      ctx.fill();
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4;
      ctx.setLineDash([9, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
  y += Math.ceil(Math.min(rhythm.length, perRow * 4) / perRow) * (sq + gap) + 150;

  badge(ctx, PAD, y - 34, 52, TEAL, '✓', '#fff', 30);
  ctx.font = f(34, 600);
  ctx.fillStyle = TEAL_DARK;
  ctx.fillText('稼いだ', PAD + 72, y + 3);

  y += 200;
  ctx.font = f(168, 800);
  ctx.fillStyle = INK;
  ctx.fillText(wage, PAD - 8, y);

  y += 76;
  ctx.font = f(36, 400);
  ctx.fillStyle = INK_MUT;
  ctx.fillText(`${hours} 働きました`, PAD, y);

  y += 118;
  ctx.fillStyle = LINE;
  ctx.fillRect(PAD, y, W - PAD * 2, 2);

  y += 140;
  const colW = (W - PAD * 2) / 2;
  badge(ctx, PAD, y - 30, 40, CORAL, '✓', '#fff', 23);
  ctx.font = f(30, 600);
  ctx.fillStyle = CORAL_DARK;
  ctx.fillText('果たした約束', PAD + 56, y + 2);

  badge(ctx, PAD + colW, y - 30, 40, GRAY_FILL, '×', INK_MUT, 24);
  ctx.fillStyle = INK_MUT;
  ctx.fillText('流れた予定', PAD + colW + 56, y + 2);

  y += 140;
  ctx.font = f(120, 800);
  ctx.fillStyle = INK;
  ctx.fillText(String(promises), PAD, y);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(String(canceled), PAD + colW, y);

  signature(ctx, PAD, H - 210, 46, 'Penciled In — 一目でわかるカレンダー');

  return c;
}

/**
 * 空いてる日（予定の中身は出さない）
 */
export function drawFreeCard({ monthLabel, weekdays, cells }) {
  const W = 1080;
  const cellH = 88;
  const rowGap = 10;
  const rows = Math.ceil(cells.length / 7);
  // マスの行数に合わせて高さを決める。余白が間延びしないようにするため。
  const H = 430 + rows * (cellH + rowGap) + 300;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#FFFDF8';
  ctx.fillRect(0, 0, W, H);

  const PAD = 92;
  let y = 176;

  badge(ctx, PAD, y - 40, 54, CORAL, '○', '#fff', 28);
  ctx.font = f(34, 600);
  ctx.fillStyle = CORAL;
  ctx.fillText('わたしの空いてる日', PAD + 74, y);

  y += 92;
  ctx.font = f(70, 800);
  ctx.fillStyle = INK;
  ctx.fillText(`${monthLabel}月のあいてる日`, PAD, y);

  // 「予定の中身は出していません」は送る前の画面にだけ置く。
  // 受け取る側には、予定名が無いことも凡例も見れば伝わるので、画像には入れない。

  // 曜日
  y += 92;
  const gw = W - PAD * 2;
  const cw = gw / 7;
  ctx.font = f(26, 600);
  ctx.textAlign = 'center';
  weekdays.forEach((w, i) => {
    ctx.fillStyle = '#B0B4BB';
    ctx.fillText(w, PAD + cw * i + cw / 2, y);
  });

  // 日付マス
  y += 34;
  const inset = 7;
  cells.forEach((cell, i) => {
    if (!cell.label) return;
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = PAD + cw * col + inset;
    const yy = y + row * (cellH + rowGap);
    const w = cw - inset * 2;
    rr(ctx, x, yy, w, cellH, 18);
    if (cell.busy) {
      ctx.fillStyle = GRAY_FILL;
      ctx.fill();
      ctx.fillStyle = '#C1C5CC';
      ctx.font = f(30, 600);
    } else {
      ctx.fillStyle = '#FAECE7';
      ctx.fill();
      ctx.strokeStyle = CORAL;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = CORAL_DARK;
      ctx.font = f(32, 700);
    }
    ctx.fillText(String(cell.label), x + w / 2, yy + cellH / 2 + 11);
  });
  ctx.textAlign = 'left';

  y += rows * (cellH + rowGap) + 46;

  ctx.fillStyle = LINE;
  ctx.fillRect(PAD, y, W - PAD * 2, 2);
  y += 62;

  // 凡例
  rr(ctx, PAD, y - 30, 40, 40, 12);
  ctx.fillStyle = '#FAECE7';
  ctx.fill();
  ctx.strokeStyle = CORAL;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = f(28, 400);
  ctx.fillStyle = '#55524A';
  ctx.fillText('空いてる', PAD + 56, y);

  rr(ctx, PAD + 240, y - 30, 40, 40, 12);
  ctx.fillStyle = GRAY_FILL;
  ctx.fill();
  ctx.fillStyle = '#55524A';
  ctx.fillText('予定あり', PAD + 296, y);

  signature(ctx, PAD, H - 96, 40, 'Penciled In');

  return c;
}
