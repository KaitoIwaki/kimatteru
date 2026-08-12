// ウィジェットの見た目を実寸で描く。実装は Swift（WidgetKit）になるので、
// これは決めごとを絵で残しておくためのもの。寸法や字の大きさを変えるときは、
// まずここで描いて確かめてから Swift を触る。
//
// iPhone のウィジェットの実寸（pt）：小 158×158 / 中 338×158 / 大 338×354
// 3倍で描いて、あとで縮める。
//
// 決めごと
//   ・答える一文は「今日、何が決まっていて、何がまだか」
//   ・上2段（日付と「まだ○件」、次の1件）は、どの日でも同じ場所に置く
//   ・見分けは形（塗り＝決まった／点線＝まだ）。色は補助——iOS 18 の
//     色を1色に染める表示やロック画面では、色が消えるため
//   ・空の日を空白にしない。「今週 まだ○件」や先の予定で埋める
//
// 実行: node tools/widget-mock.cjs
const sharp = require('sharp');
const F = "'Hiragino Sans','Yu Gothic',sans-serif";
const S = 3; // 3倍で描く

// アプリと同じ色
const T = { yoji: '#8B7AB8', baito: '#7FAE85', asobi: '#D2916A', other: '#8A8A8A' };
const PAPER = { yoji: '#D3CCE4', baito: '#CEE0D1', asobi: '#EED5C6', other: '#D3D3D3' };
const FILL = { yoji: '#B0A5CF', baito: '#A8C8AC', asobi: '#E0B49A', other: '#AFAFAF' };
const INK = { yoji: '#2F293F', baito: '#2B3B2D', asobi: '#473124', other: '#2F2F2F' };
const BG = '#FBFBFD', BODY = '#26251F', MUT = '#8C887C', FAINT = '#B7B3A6', LINE = '#E6E2D6';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, size, w, color, anchor, ls) =>
  `<text x="${x * S}" y="${y * S}" font-family="${F}" font-size="${size * S}" font-weight="${w}" fill="${color}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls * S}"` : ''}>${esc(s)}</text>`;

/**
 * 予定ひとつ。塗り＝決まっている、点線＝まだ。
 * 色を1色に染められる表示（iOS 18）やロック画面では色が消えるので、
 * 見分けは形（塗りか点線か）が受け持つ。色は補助。
 */
function pill(x, y, w, h, ev) {
  const r = 5;
  const solid = ev.solid;
  const bg = solid ? FILL[ev.type] : PAPER[ev.type];
  const box = solid
    ? `<rect x="${x * S}" y="${y * S}" width="${w * S}" height="${h * S}" rx="${r * S}" fill="${bg}"/>`
    : `<rect x="${(x + 0.75) * S}" y="${(y + 0.75) * S}" width="${(w - 1.5) * S}" height="${(h - 1.5) * S}" rx="${(r - 0.5) * S}" fill="${bg}" stroke="${T[ev.type]}" stroke-width="${1.5 * S}" stroke-dasharray="${3 * S} ${2.5 * S}"/>`;
  const ink = INK[ev.type];
  const ty = y + h / 2 + 3.6;
  return box
    + t(x + 7, ty, ev.time, 9.5, 400, ink)
    + t(x + 7 + 30, ty, ev.title, 10.5, 400, ink);
}

// 今週の7日。その日に予定があれば点、まだのものは輪だけ
function week(x, y, w, days) {
  const cw = w / 7;
  let out = '';
  days.forEach((d, i) => {
    const cx = x + cw * i + cw / 2;
    out += t(cx, y, d.w, 8.5, 400, d.today ? BODY : FAINT, 'middle');
    out += t(cx, y + 14, String(d.d), 12, d.today ? 600 : 400, d.today ? BODY : MUT, 'middle');
    if (d.today) out += `<circle cx="${cx * S}" cy="${(y + 10.5) * S}" r="${10 * S}" fill="none" stroke="${LINE}" stroke-width="${1.2 * S}"/>`;
    (d.marks || []).slice(0, 3).forEach((m, j) => {
      const my = y + 25 + j * 8;
      out += m.solid
        ? `<rect x="${(cx - 7) * S}" y="${my * S}" width="${14 * S}" height="${5 * S}" rx="${2.5 * S}" fill="${T[m.type]}"/>`
        : `<rect x="${(cx - 7 + 0.75) * S}" y="${(my + 0.75) * S}" width="${12.5 * S}" height="${3.5 * S}" rx="${1.8 * S}" fill="${PAPER[m.type]}" stroke="${T[m.type]}" stroke-width="${1.5 * S}" stroke-dasharray="${2.5 * S} ${2 * S}"/>`;
    });
  });
  return out;
}

const head = (x, y, label, right) => t(x, y, label, 11, 400, MUT, null, 0.4) + (right ? t(right.x, y, right.s, 10.5, 400, right.color || MUT, 'end') : '');

// ── 小 158×158 ────────────────────────────────
function small(state) {
  const W = 158, H = 158, P = 14;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  s += head(P, P + 10, state.date, { x: W - P, s: state.badge, color: state.badgeColor });
  if (!state.events.length) {
    s += t(P, P + 46, '予定なし', 15, 300, BODY);
    if (state.note) {
      s += t(P, P + 70, state.note[0], 10, 400, MUT);
      s += t(P, P + 84, state.note[1], 10, 400, MUT);
    }
    return { name: '小 158×158', W, H, svg: s };
  }
  let y = P + 22;
  state.events.slice(0, 3).forEach((e) => { s += pill(P, y, W - P * 2, 22, e); y += 26; });
  if (state.events.length > 3) s += t(P, y + 9, `ほか ${state.events.length - 3}件`, 10, 400, FAINT);
  return { name: '小 158×158', W, H, svg: s };
}


// ── 小・合わせ技 ──────────────────────────────
// 上半分は、どんな日でも同じ形にする（日付と「まだ○件」、次の予定のピル）。
// 毎日ホーム画面に出るものなので、見る場所が日によって動くと目が迷う。
// 下半分だけを中身で変える：持ち物があればそれ、無ければ今日の残り。
// 持ち物があって残りもある日は、残りを1行に畳んで両方入れる。
function smallBoth(state) {
  const W = 158, H = 158, P = 14;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  const e = state.events[0];
  if (!e) {
    s += head(P, P + 10, state.date, null);
    s += t(P, P + 46, '予定なし', 15, 300, BODY);
    if (state.note) { s += t(P, P + 70, state.note[0], 10, 400, MUT); s += t(P, P + 84, state.note[1], 10, 400, MUT); }
    return { name: '小・合わせ技', W, H, svg: s };
  }
  // ここまでは毎日同じ
  s += head(P, P + 10, state.date, { x: W - P, s: state.badge, color: state.badgeColor });
  s += pill(P, P + 22, W - P * 2, 26, e);

  const rest = state.events.slice(1);
  let y = P + 62;
  if (e.memo && e.memo.length) {
    // 持ち物は2行まで。3つ目からは「ほか」に畳む
    const shown = e.memo.slice(0, 3);
    const more = e.memo.length - shown.length;
    shown.forEach((m) => {
      s += `<circle cx="${(P + 2.5) * S}" cy="${(y - 3.4) * S}" r="${1.8 * S}" fill="${FAINT}"/>`;
      s += t(P + 9, y, m, 10.5, 400, BODY);
      y += 15;
    });
    if (more > 0) { s += t(P + 9, y, `ほか ${more}つ`, 9.5, 400, FAINT); y += 15; }
    // 残りの予定は1行に畳む。塗り／点線の印だけ残す
    if (rest.length) {
      y += 4;
      const r0 = rest[0];
      const mx = P + 3, my = y - 7;
      s += r0.solid
        ? `<rect x="${mx * S}" y="${my * S}" width="${12 * S}" height="${7.5 * S}" rx="${2.5 * S}" fill="${T[r0.type]}"/>`
        : `<rect x="${(mx + 0.6) * S}" y="${(my + 0.6) * S}" width="${10.8 * S}" height="${6.3 * S}" rx="${2 * S}" fill="${PAPER[r0.type]}" stroke="${T[r0.type]}" stroke-width="${1.4 * S}" stroke-dasharray="${2.4 * S} ${1.8 * S}"/>`;
      s += t(P + 20, y, `${r0.time} ${r0.title}`, 10, 400, MUT);
      if (rest.length > 1) s += t(W - P, y, `＋${rest.length - 1}`, 9.5, 400, FAINT, 'end');
    }
  } else {
    // 持ち物が無い日は、いまの案と同じく残りをピルで
    rest.slice(0, 2).forEach((r) => { s += pill(P, y - 16, W - P * 2, 26, r); y += 30; });
    if (rest.length > 2) s += t(P, y - 8, `ほか ${rest.length - 2}件`, 9.5, 400, FAINT);
  }
  return { name: '小・合わせ技', W, H, svg: s };
}

// ── 中 338×158 ────────────────────────────────
// 上2段は小と同じ（日付と「まだ○件」、次の1件）。
// 下は横に2つ割り。左に持ち物、右に今日の残り。持ち物が無ければ残りだけ。
function medium(state) {
  const W = 338, H = 158, P = 14;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  const e = state.events[0];
  if (!e) {
    s += head(P, P + 10, state.dateLong, null);
    s += t(P, P + 52, '今日は予定なし', 19, 300, BODY);
    if (state.note) s += t(P, P + 78, state.note.join('　'), 11, 400, MUT);
    if (state.next) s += t(P, P + 104, 'このあと　' + state.next, 11, 400, FAINT);
    return { name: '中 338×158', W, H, svg: s };
  }
  s += head(P, P + 10, state.dateLong, { x: W - P, s: state.badge, color: state.badgeColor });
  const rest = state.events.slice(1);
  const hasMemo = e.memo && e.memo.length;
  if (!hasMemo) {
    let y = P + 22;
    state.events.slice(0, 4).forEach((ee) => { s += pill(P, y, W - P * 2, 24, ee); y += 27; });
    if (state.events.length > 4) s += t(P, y + 9, `ほか ${state.events.length - 4}件`, 10, 400, FAINT);
    else if (state.next) { s += t(P, y + 11, 'このあと', 9.5, 400, FAINT, null, 0.6); s += t(P + 44, y + 11, state.next, 10.5, 400, MUT); }
    return { name: '中 338×158', W, H, svg: s };
  }
  const colW = (W - P * 2 - 14) / 2;
  s += pill(P, P + 22, W - P * 2, 26, e);
  let ly = P + 62;
  s += t(P, ly, '持ちもの', 9, 400, FAINT, null, 0.6);
  ly += 16;
  e.memo.slice(0, 4).forEach((m) => {
    s += `<circle cx="${(P + 2.5) * S}" cy="${(ly - 3.4) * S}" r="${1.8 * S}" fill="${FAINT}"/>`;
    s += t(P + 9, ly, m, 10.5, 400, BODY);
    ly += 15;
  });
  if (e.memo.length > 4) s += t(P + 9, ly, `ほか ${e.memo.length - 4}つ`, 9.5, 400, FAINT);
  // 右の列は今日の残り
  const rx = P + colW + 14;
  let ry = P + 62;
  if (rest.length) {
    s += t(rx, ry, 'このあと', 9, 400, FAINT, null, 0.6);
    ry += 12;
    rest.slice(0, 2).forEach((r) => { s += pill(rx, ry, colW, 22, r); ry += 25; });
    if (rest.length > 2) s += t(rx, ry + 9, `ほか ${rest.length - 2}件`, 9.5, 400, FAINT);
  }
  return { name: '中 338×158', W, H, svg: s };
}

// ── 大 338×354 ────────────────────────────────
// 今日の予定を上から並べ、持ち物のあるものは、その下にぶら下げる。
// 縦に余裕があるので、畳まずに全部見せられる。
function large(state) {
  const W = 338, H = 354, P = 16;
  let s = `<rect width="${W * S}" height="${H * S}" fill="${BG}"/>`;
  s += head(P, P + 10, state.dateLong, { x: W - P, s: state.badge, color: state.badgeColor });
  s += week(P, P + 30, W - P * 2, state.week || []);
  s += `<rect x="${P * S}" y="${(P + 92) * S}" width="${(W - P * 2) * S}" height="${1 * S}" fill="${LINE}"/>`;
  let y = P + 108;
  if (!state.events.length) {
    s += t(P, y + 14, '今日は予定なし', 17, 300, BODY);
    if (state.note) s += t(P, y + 38, state.note.join('　'), 11, 400, MUT);
    if (state.after) {
      let ay = y + 62;
      s += t(P, ay, 'このあと', 10, 400, MUT, null, 0.6);
      ay += 16;
      state.after.slice(0, 3).forEach((a) => { s += t(P, ay + 10, a.when, 10, 400, FAINT); s += pill(P + 40, ay, W - P * 2 - 40, 22, a.ev); ay += 26; });
    }
    return { name: '大 338×354', W, H, svg: s };
  }
  s += t(P, y, '今日', 10, 400, MUT, null, 0.6);
  y += 16;
  const LIMIT = H - P - 14;
  let shown = 0;
  for (const e of state.events) {
    if (y + 24 > LIMIT) break;
    s += pill(P, y, W - P * 2, 24, e);
    y += 28; shown++;
    if (e.memo && e.memo.length) {
      const line = e.memo.slice(0, 4).join('・') + (e.memo.length > 4 ? ` ほか${e.memo.length - 4}つ` : '');
      s += `<rect x="${(P + 7) * S}" y="${(y - 8) * S}" width="${1.5 * S}" height="${12 * S}" rx="${0.75 * S}" fill="${LINE}"/>`;
      s += t(P + 15, y + 2, line, 10, 400, MUT);
      y += 18;
    }
  }
  if (shown < state.events.length) {
    s += t(P, y + 10, `ほか ${state.events.length - shown}件`, 10, 400, FAINT);
  } else if (state.after && state.after.length && y + 60 < LIMIT) {
    // 下が空くなら、先の予定で埋める。空白のまま置かない
    y += 12;
    s += t(P, y, 'このあと', 10, 400, MUT, null, 0.6);
    y += 16;
    for (const a of state.after) {
      if (y + 22 > LIMIT) break;
      s += t(P, y + 10, a.when, 10, 400, FAINT);
      s += pill(P + 40, y, W - P * 2 - 40, 22, a.ev);
      y += 26;
    }
  }
  return { name: '大 338×354', W, H, svg: s };
}

// ── 中身の3パターン ────────────────────────────
const ev = (time, title, type, solid) => ({ time, title, type, solid });
const WEEK = [
  { w: '月', d: 10, marks: [{ type: 'baito', solid: true }] },
  { w: '火', d: 11, marks: [] },
  { w: '水', d: 12, today: true, marks: [{ type: 'baito', solid: true }, { type: 'asobi', solid: false }] },
  { w: '木', d: 13, marks: [{ type: 'yoji', solid: true }] },
  { w: '金', d: 14, marks: [{ type: 'asobi', solid: false }] },
  { w: '土', d: 15, marks: [{ type: 'baito', solid: true }, { type: 'yoji', solid: false }] },
  { w: '日', d: 16, marks: [] },
];
const STATES = {
  '持ち物あり': {
    date: '8/12 水', dateLong: '8月12日（水）', badge: 'まだ 1件', badgeColor: '#8B7AB8',
    events: [
      { ...ev('17:00', 'マクド', 'baito', true), memo: ['名札', '黒い靴下', '雨具'] },
      ev('20:30', '花火', 'asobi', false),
      ev('22:00', '打ち上げ', 'asobi', false),
    ],
    next: '木 13日　健康診断',
    after: [
      { when: '木', ev: ev('10:00', '健康診断', 'yoji', true) },
      { when: '金', ev: ev('19:00', '飲み会', 'asobi', false) },
      { when: '土', ev: ev('17:00', 'マクド', 'baito', true) },
    ],
    week: WEEK,
  },
  '持ち物なし・多い日': {
    date: '8/14 金', dateLong: '8月14日（金）', badge: 'まだ 3件', badgeColor: '#8B7AB8',
    events: [
      ev('09:00', '健康診断', 'yoji', true), ev('12:00', 'ゼミ', 'yoji', true),
      ev('15:00', '返却', 'other', false), ev('17:00', 'マクド', 'baito', true),
      ev('20:30', '花火', 'asobi', false), ev('22:00', '打ち上げ', 'asobi', false),
    ],
    next: '土 15日　マクド',
    after: [{ when: '土', ev: ev('17:00', 'マクド', 'baito', true) }],
    week: WEEK,
  },
  '予定なし': {
    date: '8/16 日', dateLong: '8月16日（日）', badge: '', badgeColor: MUT,
    events: [], note: ['今週 まだ2件', '決まっていません'],
    next: '月 17日　マクド',
    after: [
      { when: '月', ev: ev('17:00', 'マクド', 'baito', true) },
      { when: '火', ev: ev('19:00', '飲み会', 'asobi', false) },
    ],
    week: WEEK,
  },
};

(async () => {
  const cols = Object.keys(STATES);
  const rows = [smallBoth, medium, large];
  const cells = [];
  for (const fn of rows) {
    for (const key of cols) {
      const c = fn(STATES[key]);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.W * S}" height="${c.H * S}">
        <defs><clipPath id="r"><rect width="${c.W * S}" height="${c.H * S}" rx="${22 * S}"/></clipPath></defs>
        <g clip-path="url(#r)">${c.svg}</g></svg>`;
      cells.push({ name: c.name, state: key, buf: await sharp(Buffer.from(svg)).png().toBuffer(), W: c.W, H: c.H });
    }
  }
  // 並べる（列＝中身のパターン、行＝サイズ）
  const SC = 1.4; // 表示倍率
  const GAP = 20, LEFT = 120, TOP = 34;
  const colW = Math.max(...cells.map((c) => c.W)) * SC + GAP;
  let y = TOP;
  const comp = [];
  const rowsMeta = [];
  for (let r = 0; r < rows.length; r++) {
    const rowCells = cells.slice(r * cols.length, (r + 1) * cols.length);
    let x = LEFT;
    for (const c of rowCells) {
      comp.push({ input: await sharp(c.buf).resize(Math.round(c.W * SC)).toBuffer(), top: Math.round(y), left: Math.round(x) });
      x += colW;
    }
    rowsMeta.push({ label: rowCells[0].name, y });
    y += rowCells[0].H * SC + GAP + 10;
  }
  const totalW = LEFT + colW * cols.length;
  const totalH = y + 10;
  const labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">
    ${cols.map((k, i) => `<text x="${LEFT + colW * i}" y="20" font-family="${F}" font-size="13" font-weight="700" fill="#1E2024">${k}</text>`).join('')}
    ${rowsMeta.map((r) => `<text x="8" y="${r.y + 16}" font-family="${F}" font-size="12" font-weight="700" fill="#1E2024">${r.label}</text>`).join('')}
  </svg>`;
  comp.push({ input: Buffer.from(labels), top: 0, left: 0 });
  const base = sharp({ create: { width: Math.round(totalW), height: Math.round(totalH), channels: 3, background: '#DDE1E8' } }).composite(comp);
  await base.png().toFile('../store-assets/widget-3sizes.png');
  console.log('できた', Math.round(totalW), 'x', Math.round(totalH));
})();
