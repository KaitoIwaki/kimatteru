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
const BAR_ON = '#7FAE85';   // 月ごとの棒。いちばん多い月
const BAR_OFF = '#CEE0D1';  // それ以外の月

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
// sub を渡すと2段になる。1行に続けると長すぎて、
// 「決まってる？」がどこまでなのか分からなくなる。
function signature(ctx, x, y, size, label, sub) {
  ctx.font = f(size, 700);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEAL;
  ctx.fillText('✓', x, y);
  const w = ctx.measureText('✓').width;
  ctx.fillStyle = '#C1C5CC';
  ctx.fillText('？', x + w - size * 0.1, y);
  const w2 = ctx.measureText('？').width;
  const tx = x + w + w2 + size * 0.25;
  ctx.font = f(size * 0.62, 600);
  ctx.fillStyle = '#55524A';
  ctx.fillText(label, tx, sub ? y - size * 0.34 : y);
  if (sub) {
    ctx.font = f(size * 0.52, 500);
    ctx.fillStyle = INK_MUT;
    ctx.fillText(sub, tx, y + size * 0.38);
  }
  ctx.textBaseline = 'alphabetic';
}

/**
 * 今月のまとめ（横長 1080×680）
 *
 * 中身は「稼いだ額・働いた時間と日数・バイト先ごとの内訳」だけ。
 * 前は「果たした約束」と「流れた予定」も出していたが、前者は遊びの予定を
 * 確定にしただけの数で、約束を果たしたかどうかは誰も記録していない。
 * 数えていないものを数えたふりをしていたので、やめた。
 *
 * 金額はすべて時給×実働で出した概算。深夜や残業の割増も交通費も入らないので、
 * 「およそ」と書いてある。時間だけは本人が記録した値そのもので、正確。
 */
export function drawMonthCard({ yearMonth, wage, hours, days, jobs }) {
  const list = jobs || [];
  // バイト先が3つ以上あると下に溢れるので、その数だけ背を伸ばす
  const W = 1080, H = 680 + Math.max(0, list.length - 2) * 88, PAD = 84;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  cardBase(ctx, W, H);

  ctx.fillStyle = INK_MUT;
  ctx.font = f(27, 400);
  fillTracked(ctx, yearMonth, PAD, 118, 3);

  bigNumber(ctx, PAD, 252, wage, 128);

  ctx.fillStyle = INK_MUT;
  ctx.font = f(25, 400);
  ctx.fillText(`およそ　${hours}・${days}日`, PAD, 302);

  ctx.fillStyle = LINE;
  ctx.fillRect(PAD, 356, W - PAD * 2, 2);

  if (list.length) jobRows(ctx, PAD, 424, W - PAD * 2, list, 30, 88);
  else emptyNote(ctx, PAD, 424, 26);

  signature(ctx, PAD, H - 46, 30, '決まってる？');
  return c;
}

/**
 * 今年のまとめ（縦 1080×1440）
 *
 * 年のカードにカレンダーは合わない（365マスは描けない）ので、
 * 月ごとの棒を置く。いちばん多かった月だけ濃くして、時間を添える。
 */
export function drawYearCard({ year, wage, hours, jobs, months }) {
  const list = jobs || [];
  const W = 1080, H = 1440 + Math.max(0, list.length - 2) * 116, PAD = 96;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  cardBase(ctx, W, H);

  let y = 176;
  ctx.fillStyle = INK_MUT;
  ctx.font = f(30, 400);
  fillTracked(ctx, year, PAD, y, 3);

  y += 142;
  bigNumber(ctx, PAD, y, wage, 132);

  y += 56;
  ctx.fillStyle = INK_MUT;
  ctx.font = f(27, 400);
  ctx.fillText(`およそ　${hours}`, PAD, y);

  y += 78;
  ctx.fillStyle = LINE;
  ctx.fillRect(PAD, y, W - PAD * 2, 2);

  y += 74;
  if (list.length) y = jobRows(ctx, PAD, y, W - PAD * 2, list, 34, 116);
  else y = emptyNote(ctx, PAD, y, 28) + 60;

  y += 60;
  ctx.fillStyle = INK_MUT;
  ctx.font = f(24, 400);
  fillTracked(ctx, '月ごとの働いた時間', PAD, y, 2);

  y += 40;
  monthBars(ctx, PAD, y, W - PAD * 2, 240, months);

  signature(ctx, PAD, H - 84, 38, '決まってる？');
  return c;
}

// ---- カードの部品 ----

function cardBase(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PAPER);
  g.addColorStop(1, PAPER2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// 字間を開けて書く。canvas に letterSpacing が無い環境でも同じに出したいので、
// 1文字ずつ置く（iOS の WKWebView は ctx.letterSpacing に対応していない版がある）。
function fillTracked(ctx, text, x, y, sp) {
  let cx = x;
  for (const ch of String(text)) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + sp;
  }
  return cx;
}

// 記号は数字より一段小さく薄く。数字が主役だと分かるように
function bigNumber(ctx, x, y, parts, size) {
  ctx.fillStyle = INK_MUT;
  ctx.font = f(Math.round(size * 0.31), 400);
  ctx.fillText(parts.unit, x, y);
  const uw = ctx.measureText(parts.unit).width;
  ctx.fillStyle = INK;
  ctx.font = f(size, 300);
  ctx.fillText(parts.num, x + uw + size * 0.06, y);
}

// バイト先ごとの行。丸の色は種類の色（バイトの緑）からずらした濃淡
function jobRows(ctx, x, y, w, jobs, fs, gap) {
  let cy = y;
  for (const j of jobs || []) {
    ctx.fillStyle = j.color;
    ctx.beginPath();
    ctx.arc(x + fs * 0.3, cy - fs * 0.32, fs * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 金額の幅を先に測り、残った幅に名前を収める。
    // canvas には text-overflow が無いので、自分で切って「…」を付ける。
    ctx.font = f(Math.round(fs * 1.36), 300);
    const wageW = ctx.measureText(j.wage).width;
    const room = w - fs - wageW - fs * 0.8;
    ctx.fillStyle = INK;
    ctx.font = f(fs, 400);
    ctx.fillText(ellipsis(ctx, j.name, room), x + fs, cy);

    ctx.fillStyle = INK_MUT;
    ctx.font = f(Math.round(fs * 0.68), 400);
    const sub = (j.hourly ? `時給 ¥${j.hourly}　` : '') + `${j.times}回　${j.hours}`;
    ctx.fillText(sub, x + fs, cy + fs * 1.1);

    ctx.fillStyle = INK;
    ctx.font = f(Math.round(fs * 1.36), 300);
    ctx.textAlign = 'right';
    ctx.fillText(j.wage, x + w, cy);
    ctx.textAlign = 'left';

    cy += gap;
  }
  return cy;
}

// 月ごとの棒。まだ来ていない月は下に細い線だけ置く（空白にすると欠けて見える）
function monthBars(ctx, x, y, w, h, months) {
  const n = 12, gap = 10, bw = (w - gap * (n - 1)) / n;
  const vals = months.filter((v) => v != null && v > 0);
  const max = vals.length ? Math.max(...vals) : 1;
  months.forEach((v, i) => {
    const bx = x + i * (bw + gap);
    if (!v) {
      ctx.fillStyle = '#EDEFF3';
      rr(ctx, bx, y + h - 4, bw, 4, 2);
      ctx.fill();
    } else {
      const bh = Math.max(6, (v / max) * h);
      const top = y + h - bh;
      ctx.fillStyle = v === max ? BAR_ON : BAR_OFF;
      rr(ctx, bx, top, bw, bh, Math.min(bw / 2, 10));
      ctx.fill();
      if (v === max) {
        ctx.fillStyle = INK_MUT;
        ctx.font = f(21, 400);
        ctx.textAlign = 'center';
        ctx.fillText(fmtBarHours(v), bx + bw / 2, top - 14);
        ctx.textAlign = 'left';
      }
    }
    ctx.fillStyle = INK_FAINT;
    ctx.font = f(21, 400);
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), bx + bw / 2, y + h + 38);
    ctx.textAlign = 'left';
  });
}

// 入る幅まで切って「…」を付ける
function ellipsis(ctx, text, room) {
  if (room <= 0 || ctx.measureText(text).width <= room) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + '…').width > room) out = out.slice(0, -1);
  return out + '…';
}

// 働いた記録が無い月／年のとき。0円のカードを黙って出さない
function emptyNote(ctx, x, y, fs) {
  ctx.fillStyle = INK_FAINT;
  ctx.font = f(fs, 400);
  ctx.fillText('働いた記録がありません', x, y);
  return y + fs * 1.6;
}

const fmtBarHours = (h) => (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10) + 'h';

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

  signature(ctx, PAD, H - 96, 40, '決まってる？');

  return c;
}

/**
 * サポーターカード。
 * 画面のカードと同じ見立て（生成りの紙に真鍮の箔）で、キャンバスに直接描く。
 * 通し番号と人数は入れない——全員を数える場所が無いので、書けば嘘になる。
 */
export function drawSupporterCard({ owner, since, total, times, paper, foil, mark, sheen, edge, tier, fleck }) {
  const W = 1080;
  const H = Math.round(W / 1.586);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // 段ごとの紙と箔。渡されなければノーマル。
  const STOPS = (paper && paper.length ? paper : ['#F3EEE2', '#E7DFCE', '#F3EEE2']);
  const FOIL = foil || '#6B582F';

  // 紙。斜めに濃淡をつけて、平らな一色に見せない。
  // 色の数は段によって違う（ゴールドは明暗を何度か折り返して金属に見せる）ので、
  // 決め打ちせず、渡された並びを等間隔に置く。
  const g = ctx.createLinearGradient(0, 0, W, H);
  STOPS.forEach((c, i) => g.addColorStop(i / (STOPS.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 向きに連れて動く光。画面では指で回すと滑るが、静止画では正面のとき——
  // つまり真ん中に一本置く。ゴールドだけ、真ん中がわずかに緑へ振れる。
  const glint = ctx.createLinearGradient(W * 0.1, 0, W * 0.62, H);
  glint.addColorStop(0.3, 'rgba(255,255,255,0)');
  if (tier === 'gold') {
    glint.addColorStop(0.44, 'rgba(255,246,200,.5)');
    glint.addColorStop(0.5, 'rgba(237,251,217,.6)');
    glint.addColorStop(0.56, 'rgba(255,239,192,.5)');
  } else {
    glint.addColorStop(0.5, tier === 'black' ? 'rgba(255,240,196,.22)' : 'rgba(255,252,238,.42)');
  }
  glint.addColorStop(0.7, 'rgba(255,255,255,0)');
  ctx.fillStyle = glint;
  ctx.fillRect(0, 0, W, H);

  // 箔の光。画面では流れているが、静止画では一本通しておく
  const sheen2 = ctx.createLinearGradient(W * 0.18, 0, W * 0.52, H);
  sheen2.addColorStop(0, 'rgba(255,255,255,0)');
  sheen2.addColorStop(0.5, sheen || 'rgba(255,252,240,.55)');
  sheen2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen2;
  ctx.fillRect(0, 0, W, H);

  // 箔の粒。画面と同じ居場所に置く（画面では昇って消えるが、静止画では止まった一瞬）
  if (fleck) {
    const FL = [[12,72],[26,34],[38,82],[47,18],[58,62],[66,28],[74,90],[83,46],[91,66],[19,50],[53,40],[88,20]];
    ctx.fillStyle = fleck;
    FL.forEach(([x, y], i) => {
      ctx.globalAlpha = i % 3 === 0 ? 0.85 : 0.5;
      ctx.beginPath();
      ctx.arc((x / 100) * W, (y / 100) * H, i % 3 === 0 ? 2.3 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = edge || 'rgba(107,88,47,.32)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  // 厚み。上の縁に明かり、下の縁に影
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(24, 2); ctx.lineTo(W - 24, 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.14)';
  ctx.beginPath(); ctx.moveTo(24, H - 2); ctx.lineTo(W - 24, H - 2); ctx.stroke();

  const PAD = 62;
  ctx.fillStyle = FOIL;

  ctx.font = f(40, 800);
  ctx.fillText('決まってる？', PAD, PAD + 40);
  ctx.font = f(23, 700);
  ctx.fillText('S U P P O R T E R', PAD, PAD + 78);

  // 合印
  ctx.font = f(40, 700);
  ctx.textAlign = 'right';
  ctx.fillStyle = TEAL;
  ctx.fillText('✓', W - PAD - 34, PAD + 44);
  ctx.fillStyle = mark || '#C8BFA6';
  ctx.fillText('？', W - PAD, PAD + 44);
  ctx.textAlign = 'left';

  ctx.fillStyle = FOIL;
  if (owner) {
    ctx.font = f(34, 700);
    ctx.fillText(owner, PAD, H - PAD - 42);
  }
  ctx.font = f(22, 700);
  ctx.fillText(since, PAD, H - PAD);

  ctx.textAlign = 'right';
  ctx.font = f(50, 800);
  ctx.fillText(total, W - PAD, H - PAD - 34);
  ctx.font = f(22, 700);
  ctx.fillText(times, W - PAD, H - PAD);
  ctx.textAlign = 'left';

  return c;
}
