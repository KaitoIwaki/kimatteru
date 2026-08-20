// カードの肌理。刷り目（ヘアライン）と粒子。
//
// これを入れる前のカードは、完璧に滑らかなグラデーションだった。本物の金属に
// その清潔さは無く、そこが「よくできた金の絵」に留まっていた一番の原因。
// 足すのは柄ではなく肌理なので、何が変わったかは意識に上らない。
// 拡大して並べると差は歴然だが、実寸では「なんとなく本物っぽい」としか見えない。
// それでいい。
//
// 画面（CSS）と書き出し（canvas）の両方から使う。数字がここ1か所にあれば、
// 2つの絵が食い違わない。

// 決め打ちの擬似乱数。開くたびに肌理が変わると、模様ではなく雑音になる。
// Math.random は使えない（同じカードが毎回違う顔になる）。
const rnd = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export const BRUSH_N = 150;
export const GRAIN_N = 900;

// 色は段によらず、明かりは白・影は濃い茶。金属の陰影は素材の色ではなく
// 光そのものなので、紙が変わっても同じでいい。
export const BRUSH_LIGHT = '255,255,255';
export const BRUSH_DARK = '42,28,2';
export const GRAIN_LIGHT = '255,253,240';
export const GRAIN_DARK = '58,42,8';

/**
 * 刷り目。左下から右上へ、グラデーションと同じ側に流す。
 * 向きを揃えないと、金属の目ではなく汚れに見える。
 * 太さと濃さを1本ずつ散らす——等間隔・等濃度だと網戸の柄になる。
 */
export function brushLines(w, h) {
  const out = [];
  for (let i = 0; i < BRUSH_N; i++) {
    const j = rnd(i + 1);
    const x = -h + (i * (w + h)) / BRUSH_N;
    out.push({
      x1: x, y1: h, x2: x + h, y2: 0,
      width: 0.35 + j * 0.5,
      op: 0.020 + j * 0.030,
      light: i % 3 === 0,
    });
  }
  return out;
}

/** 粒子。紙にも金属にも必ずある細かいムラ。明暗を半々に撒く */
export function grainDots(w, h) {
  const out = [];
  for (let i = 0; i < GRAIN_N; i++) {
    out.push({
      x: rnd(i * 2 + 1) * w, y: rnd(i * 2 + 2) * h,
      s: 0.8, light: i % 2 === 1,
    });
  }
  return out;
}

// 画面用。SVG を data URI にして background-image に敷く。
//
// 刷り目はカード全体に1枚。向きが揃っていることに意味があるので、
// 繰り返すと継ぎ目で目が折れる。縦横の比は固定なので、100%×100% に
// 引き伸ばせば歪まない。
//
// 粒子は 64px の型を繰り返す。全面に900粒を書き並べると data URI が
// 140KB になった。0.8px・濃さ3〜5%の点は、繰り返しても継ぎ目が見えない。
//
// 作るのは1度きり。カードは指で回すたびに再描画されるので、
// 毎回組み立てると回転が重くなる。
const TILE = 64;
let cached = null;
export function textureCss(w = 335, h = 211) {
  if (cached) return cached;
  const px = (n) => Math.round(n * 100) / 100;
  const wrap = (inner, tw, th) =>
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}">${inner}</svg>`)}")`;

  let brush = '';
  for (const l of brushLines(w, h)) {
    brush += `<line x1="${px(l.x1)}" y1="${px(l.y1)}" x2="${px(l.x2)}" y2="${px(l.y2)}"`
      + ` stroke="rgba(${l.light ? BRUSH_LIGHT : BRUSH_DARK},${l.op.toFixed(3)})"`
      + ` stroke-width="${px(l.width)}"/>`;
  }
  // 型の中の粒の数は、全面と同じ密度になるように決める
  const n = Math.round((GRAIN_N * TILE * TILE) / (w * h));
  let grain = '';
  for (let i = 0; i < n; i++) {
    const d = { x: rnd(i * 2 + 1) * TILE, y: rnd(i * 2 + 2) * TILE, light: i % 2 === 1 };
    grain += `<rect x="${px(d.x)}" y="${px(d.y)}" width="0.8" height="0.8"`
      + ` fill="rgba(${d.light ? GRAIN_LIGHT : GRAIN_DARK},${d.light ? 0.05 : 0.035})"/>`;
  }
  cached = {
    image: `${wrap(grain, TILE, TILE)}, ${wrap(brush, w, h)}`,
    size: `${TILE}px ${TILE}px, 100% 100%`,
    repeat: 'repeat, no-repeat',
  };
  return cached;
}

/** 書き出し用。canvas に同じものを描く */
export function drawTexture(ctx, w, h) {
  for (const l of brushLines(w, h)) {
    ctx.strokeStyle = `rgba(${l.light ? BRUSH_LIGHT : BRUSH_DARK},${l.op})`;
    ctx.lineWidth = l.width;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
  for (const d of grainDots(w, h)) {
    ctx.fillStyle = `rgba(${d.light ? GRAIN_LIGHT : GRAIN_DARK},${d.light ? 0.05 : 0.035})`;
    ctx.fillRect(d.x, d.y, d.s, d.s);
  }
}
