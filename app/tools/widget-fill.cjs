// 予定が少ない日に、中・大の空白をどう埋めるかの案を実寸で描く。
// 実行: node tools/widget-fill.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3;

const T = { yoji: '#8B7AB8', baito: '#7FAE85', asobi: '#D2916A', other: '#8A8A8A' };
const FILL = { yoji: '#B0A5CF', baito: '#A8C8AC', asobi: '#E0B49A', other: '#AFAFAF' };
const PAPER = { yoji: '#D3CCE4', baito: '#CEE0D1', asobi: '#EED5C6', other: '#D3D3D3' };
const INK = { yoji: '#2F293F', baito: '#2B3B2D', asobi: '#473124', other: '#2F2F2F' };
const BG = '#FBFBFD', BODY = '#26251F', MUT = '#8C887C', FAINT = '#B7B3A6', LINE = '#E6E2D6';
const UND = '#8B7AB8';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;

function pill(x, y, w, h, ev) {
  const r = 5, solid = ev.solid;
  const box = solid
    ? `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${FILL[ev.type]}"/>`
    : `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" fill="${PAPER[ev.type]}" stroke="${T[ev.type]}" stroke-width="${1.5 * S}" stroke-dasharray="${3 * S} ${2.5 * S}"/>`;
  const ty = y + h / 2 + 3.6;
  return box + t(x + 7, ty, ev.time, 9.5, 400, INK[ev.type]) + t(x + 7 + 30, ty, ev.title, 10.5, 400, INK[ev.type]);
}
const head = (x, y, label, und) =>
  t(x, y, label, 11, 400, MUT, null, 0.4) + (und ? t(x + 0, y, '', 0, 0, MUT) : '');

// 月のミニカレンダー。日付の丸そのもので確定度を出す
// 塗り＝その日に決まった予定がある／点線の輪＝まだのものだけ／素＝予定なし
function month(x0, y0, w, h, days, opt = {}) {
  const cols = 7, cw = w / cols;
  const rows = Math.ceil((days.first + days.last) / 7);
  const rh = Math.min(opt.rh || 18, (h - 14) / rows);
  const r = Math.min(cw, rh) * 0.42;
  let out = '';
  ['日', '月', '火', '水', '木', '金', '土'].forEach((d, i) => {
    out += t(x0 + cw * i + cw / 2, y0, d, 8, 400, FAINT, 'middle');
  });
  const top = y0 + 12;
  for (let d = 1; d <= days.last; d++) {
    const idx = days.first + d - 1, col = idx % 7, row = Math.floor(idx / 7);
    const cx = x0 + cw * col + cw / 2, cy = top + row * rh + rh / 2;
    const m = days.marks[d];
    if (m) {
      out += m.solid
        ? `<circle cx="${cx * S}" cy="${cy * S}" r="${r * S}" fill="${FILL[m.type]}"/>`
        : `<circle cx="${cx * S}" cy="${cy * S}" r="${(r - 0.8) * S}" fill="${PAPER[m.type]}" stroke="${T[m.type]}" stroke-width="${1.3 * S}" stroke-dasharray="${2.4 * S} ${1.9 * S}"/>`;
    }
    if (days.today === d) {
      out += `<circle cx="${cx * S}" cy="${cy * S}" r="${(r + 2.2) * S}" fill="none" stroke="${BODY}" stroke-width="${1.1 * S}"/>`;
    }
    const col2 = m ? INK[m.type] : (days.today === d ? BODY : FAINT);
    out += t(cx, cy + 3.2, String(d), 9, days.today === d ? 600 : 400, col2, 'middle');
  }
  return out;
}

// 今週の帯（いまの大で使っているもの）
function week(x0, y0, w, days) {
  const cw = w / 7;
  let out = '';
  days.forEach((d, i) => {
    const cx = x0 + cw * i + cw / 2;
    out += t(cx, y0, d.w, 8.5, 400, d.today ? BODY : FAINT, 'middle');
    out += t(cx, y0 + 14, String(d.d), 12, d.today ? 600 : 400, d.today ? BODY : MUT, 'middle');
    if (d.today) out += `<circle cx="${cx * S}" cy="${(y0 + 10.5) * S}" r="${10 * S}" fill="none" stroke="${LINE}" stroke-width="${1.2 * S}"/>`;
    (d.marks || []).slice(0, 3).forEach((m, j) => {
      const my = y0 + 25 + j * 8;
      out += m.solid
        ? `<rect x="${(cx - 7) * S}" y="${my * S}" width="${14 * S}" height="${5 * S}" rx="${2.5 * S}" fill="${T[m.type]}"/>`
        : `<rect x="${(cx - 6.25) * S}" y="${(my + 0.75) * S}" width="${12.5 * S}" height="${3.5 * S}" rx="${1.8 * S}" fill="${PAPER[m.type]}" stroke="${T[m.type]}" stroke-width="${1.5 * S}" stroke-dasharray="${2.5 * S} ${2 * S}"/>`;
    });
  });
  return out;
}

const ev = (time, title, type, solid) => ({ time, title, type, solid });

// 2026年8月。1日=土（日曜はじまりなので first=6）
const MARKS = {
  1: { type: 'baito', solid: 1 }, 5: { type: 'baito', solid: 1 }, 6: { type: 'baito', solid: 1 },
  9: { type: 'baito', solid: 1 }, 12: { type: 'asobi', solid: 1 }, 13: { type: 'baito', solid: 1 },
  15: { type: 'asobi', solid: 0 }, 19: { type: 'baito', solid: 0 }, 20: { type: 'other', solid: 0 },
  22: { type: 'baito', solid: 1 }, 24: { type: 'yoji', solid: 0 }, 26: { type: 'other', solid: 1 },
  27: { type: 'baito', solid: 0 }, 29: { type: 'yoji', solid: 1 }, 31: { type: 'baito', solid: 1 },
};
const MONTH = { first: 6, last: 31, today: 13, marks: MARKS };
const WEEK = [
  { w: '日', d: 9, marks: [{ type: 'baito', solid: 1 }] },
  { w: '月', d: 10, marks: [] },
  { w: '火', d: 11, marks: [] },
  { w: '水', d: 12, marks: [{ type: 'asobi', solid: 1 }] },
  { w: '木', d: 13, today: true, marks: [{ type: 'baito', solid: 1 }] },
  { w: '金', d: 14, marks: [] },
  { w: '土', d: 15, marks: [{ type: 'asobi', solid: 0 }] },
];
const TODAY1 = [ev('17:00', 'マクド', 'baito', 1)];
const UNDECIDED = [
  { when: '土 15日', ev: ev('18:00', '花火', 'asobi', 0) },
  { when: '水 19日', ev: ev('17:00', 'マクド', 'baito', 0) },
  { when: '木 20日', ev: ev('12:00', '返却', 'other', 0) },
];

// ── 中：右に月カレンダー ─────────────────────────
function medMonth() {
  const W = 338, H = 158, P = 14, LW = 150;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  s += t(P, P + 10, '8月13日（木）', 11, 400, MUT, null, 0.4);
  s += t(P + LW - 6, P + 10, 'まだ 1件', 10.5, 400, UND, 'end');
  TODAY1.forEach((e, i) => { s += pill(P, P + 22 + i * 28, LW - 14, 26, e); });
  s += t(P, P + 74, 'このあと', 9, 400, FAINT, null, 0.6);
  s += t(P, P + 90, '土 15日　18:00 花火', 10.5, 400, MUT);
  s += month(P + LW, P + 4, W - P * 2 - LW, H - P * 2 - 4, MONTH, { rh: 19 });
  return { name: '中A｜右に月カレンダー', W, H, svg: s };
}
// ── 中：右に今週 ────────────────────────────────
function medWeek() {
  const W = 338, H = 158, P = 14, LW = 150;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  s += t(P, P + 10, '8月13日（木）', 11, 400, MUT, null, 0.4);
  s += t(P + LW - 6, P + 10, 'まだ 1件', 10.5, 400, UND, 'end');
  TODAY1.forEach((e, i) => { s += pill(P, P + 22 + i * 28, LW - 14, 26, e); });
  s += t(P, P + 74, 'このあと', 9, 400, FAINT, null, 0.6);
  s += t(P, P + 90, '土 15日　18:00 花火', 10.5, 400, MUT);
  s += week(P + LW, P + 20, W - P * 2 - LW, WEEK);
  return { name: '中B｜右に今週', W, H, svg: s };
}
// ── 中：まだ決まっていないものを並べる ──────────────
function medUndecided() {
  const W = 338, H = 158, P = 14;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  s += t(P, P + 10, '8月13日（木）', 11, 400, MUT, null, 0.4);
  s += t(W - P, P + 10, 'まだ 1件', 10.5, 400, UND, 'end');
  s += pill(P, P + 22, W - P * 2, 26, TODAY1[0]);
  s += t(P, P + 66, 'まだ決まっていない', 9, 400, FAINT, null, 0.6);
  UNDECIDED.forEach((u, i) => {
    const y = P + 74 + i * 24;
    s += t(P, y + 14, u.when, 10, 400, FAINT);
    s += pill(P + 46, y + 2, W - P * 2 - 46, 20, u.ev);
  });
  return { name: '中C｜まだ決まっていないものを並べる', W, H, svg: s };
}

// ── 中：左に今日＋まだ、右に月カレンダー ─────────────
function medBoth() {
  const W = 338, H = 158, P = 14, LW = 158;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  s += t(P, P + 10, '8月13日（木）', 11, 400, MUT, null, 0.4);
  s += t(P + LW - 12, P + 10, 'まだ 1件', 10.5, 400, UND, 'end');
  s += pill(P, P + 22, LW - 14, 24, TODAY1[0]);
  s += t(P, P + 62, 'まだ決まっていない', 9, 400, FAINT, null, 0.6);
  UNDECIDED.slice(0, 2).forEach((u, i) => {
    const y = P + 68 + i * 24;
    s += t(P, y + 14, u.when, 9, 400, FAINT);
    s += pill(P + 38, y + 2, LW - 14 - 38, 20, u.ev);
  });
  s += month(P + LW, P + 4, W - P * 2 - LW, H - P * 2 - 4, MONTH, { rh: 19 });
  return { name: '中D｜左に今日とまだ、右に月カレンダー', W, H, svg: s };
}


// 数字の下に点を置く形。塗りの点＝決まった予定、輪＝まだのもの。
// 5pt の点線は潰れて読めないが、輪なら読める。しかも1日に両方あるときは
// 「●○」と並べられるので、どちらを優先するかを決めずに済む。
const SUMI = '#5A5750';
function monthDots(x0, y0, w, h, days, opt = {}) {
  const cw = w / 7;
  const rows = Math.ceil((days.first + days.last) / 7);
  const rh = opt.rh || 20;
  const dr = opt.dr || 2.1;          // 点の半径
  let out = '';
  ['日', '月', '火', '水', '木', '金', '土'].forEach((d, i) => {
    out += t(x0 + cw * i + cw / 2, y0, d, 8, 400, FAINT, 'middle');
  });
  const top = y0 + 12;
  for (let d = 1; d <= days.last; d++) {
    const idx = days.first + d - 1, col = idx % 7, row = Math.floor(idx / 7);
    const cx = x0 + cw * col + cw / 2, cy = top + row * rh;
    const marks = days.dots[d] || [];
    if (days.today === d) {
      out += `<circle cx="${cx * S}" cy="${(cy + 4.5) * S}" r="${9 * S}" fill="${BODY}"/>`;
    }
    out += t(cx, cy + 8, String(d), 10, days.today === d ? 600 : 400,
             days.today === d ? '#ffffff' : (marks.length ? BODY : FAINT), 'middle');
    const n = Math.min(marks.length, 3);
    const span = (n - 1) * (dr * 2 + 1.6);
    marks.slice(0, 3).forEach((m, k) => {
      const dx = cx - span / 2 + k * (dr * 2 + 1.6);
      const dy = cy + 14.5;
      out += m.solid
        ? `<circle cx="${dx * S}" cy="${dy * S}" r="${dr * S}" fill="${opt.color ? T[m.type] : SUMI}"/>`
        : `<circle cx="${dx * S}" cy="${dy * S}" r="${(dr - 0.35) * S}" fill="none" stroke="${opt.color ? T[m.type] : SUMI}" stroke-width="${1 * S}"/>`;
    });
  }
  return out;
}

// 1日に複数ある日も入れる
const DOTS = {
  1: [{ type: 'baito', solid: 1 }],
  5: [{ type: 'baito', solid: 1 }],
  6: [{ type: 'baito', solid: 1 }],
  9: [{ type: 'baito', solid: 1 }, { type: 'yoji', solid: 1 }],
  12: [{ type: 'asobi', solid: 1 }],
  13: [{ type: 'baito', solid: 1 }, { type: 'asobi', solid: 0 }],
  15: [{ type: 'asobi', solid: 0 }],
  19: [{ type: 'baito', solid: 0 }],
  20: [{ type: 'other', solid: 0 }, { type: 'yoji', solid: 0 }],
  22: [{ type: 'baito', solid: 1 }],
  24: [{ type: 'yoji', solid: 0 }],
  26: [{ type: 'other', solid: 1 }, { type: 'baito', solid: 1 }, { type: 'asobi', solid: 0 }],
  27: [{ type: 'baito', solid: 0 }],
  29: [{ type: 'yoji', solid: 1 }],
  31: [{ type: 'baito', solid: 1 }],
};
const MONTH2 = { first: 6, last: 31, today: 13, dots: DOTS };

function medDots(color) {
  const W = 338, H = 158, P = 14, LW = 148;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  s += t(P, P + 10, '8月13日（木）', 11, 400, MUT, null, 0.4);
  s += t(P + LW - 8, P + 10, 'まだ 1件', 10.5, 400, UND, 'end');
  s += pill(P, P + 22, LW - 14, 26, TODAY1[0]);
  s += t(P, P + 74, 'このあと', 9, 400, FAINT, null, 0.6);
  s += t(P, P + 90, '土 15日　18:00 花火', 10.5, 400, MUT);
  s += monthDots(P + LW, P + 4, W - P * 2 - LW, H - P * 2 - 4, MONTH2, { rh: 20, dr: 2.1, color });
  return { name: color ? '案② 点に色をつける' : '案① 点は墨だけ（●＝決まった／○＝まだ）', W, H, svg: s };
}

// ── 大：月カレンダー ────────────────────────────
function bigMonth() {
  const W = 338, H = 354, P = 16;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  s += t(P, P + 10, '8月13日（木）', 11, 400, MUT, null, 0.4);
  s += t(W - P, P + 10, 'まだ 1件', 10.5, 400, UND, 'end');
  s += month(P, P + 30, W - P * 2, 150, MONTH, { rh: 23 });
  s += `<rect x="${P * S}" y="${(P + 186) * S}" width="${(W - P * 2) * S}" height="${1 * S}" fill="${LINE}"/>`;
  s += t(P, P + 206, '今日', 10, 400, MUT, null, 0.6);
  s += pill(P, P + 214, W - P * 2, 24, TODAY1[0]);
  s += t(P, P + 262, 'まだ決まっていない', 10, 400, MUT, null, 0.6);
  UNDECIDED.forEach((u, i) => {
    const y = P + 270 + i * 26;
    s += t(P, y + 15, u.when, 10, 400, FAINT);
    s += pill(P + 48, y + 2, W - P * 2 - 48, 22, u.ev);
  });
  return { name: '大A｜月カレンダー ＋ 今日 ＋ まだ', W, H, svg: s };
}

(async () => {
  const cards = [medDots(false), medDots(true), medMonth()];
  const SC = 2.0, GAP = 22, LEFT = 20, TOP = 34;
  const imgs = [];
  for (const c of cards) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.W * S}" height="${c.H * S}">
      <defs><clipPath id="r"><rect width="${c.W * S}" height="${c.H * S}" rx="${22 * S}"/></clipPath></defs>
      <g clip-path="url(#r)">${c.svg}</g></svg>`;
    imgs.push({ name: c.name, buf: await sharp(Buffer.from(svg)).resize(Math.round(c.W * SC)).png().toBuffer(), h: Math.round(c.H * SC) });
  }
  const totalH = imgs.reduce((a, i) => a + i.h + GAP + 22, TOP);
  const W = Math.round(338 * SC) + LEFT * 2;
  const comp = []; let y = TOP;
  for (const i of imgs) {
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="20"><text x="0" y="15" font-family="${F}" font-size="14" font-weight="700" fill="#1E2024">${i.name}</text></svg>`), top: y - 22, left: LEFT });
    comp.push({ input: i.buf, top: y, left: LEFT });
    y += i.h + GAP + 22;
  }
  await sharp({ create: { width: W, height: totalH, channels: 3, background: '#DDE1E8' } })
    .composite(comp).png().toFile('../store-assets/widget-dots.png');
  console.log('できた');
})();
