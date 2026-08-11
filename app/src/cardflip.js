// サポーターカードを指で回すための計算。
//
// 角度ひとつだけを本当のこととして、表と裏のどちらが見えるかも、
// 指を離したあとの落ち着き先も、すべてそこから出す。
// 角度と面の見え方を別々に持つと、片方が遅れて「回っている途中で
// カードが消える」ずれが出る。実際に一度出した（v0.21.2）。
// あのときは時間を合わせて直したが、合わせる作業が要ること自体が
// 崩れやすさだった。ここでは持ち方から断ってある。

/** 0以上360未満に直す */
export const norm = (deg) => ((deg % 360) + 360) % 360;

/** その角度で、表と裏のどちらが手前を向いているか */
export const showsFront = (deg) => {
  const a = norm(deg);
  return a < 90 || a >= 270;
};

/** なぞった長さを角度にする。カードの幅いっぱいでちょうど半回転。 */
export const dragToDeg = (dx, width) => (width > 0 ? (dx / width) * 180 : 0);

// 上下になぞったときの傾き。裏返りはしないが、指について少しだけ動く。
// 手に持った紙が、押した側へわずかに寝るくらい。8度を上限にしてある。
// これ以上つけると「持っている」ではなく「浮いている」に見える。
export const TILT_MAX = 8;
const TILT_K = 0.08; // 指1pxあたり何度。100px なぞって上限に届く
/** 上下になぞった長さを傾きにする。下へなぞると、手前の縁が下がる。 */
export const tiltFor = (dy) => Math.max(-TILT_MAX, Math.min(TILT_MAX, -dy * TILT_K));

// 速く払ったと見なす速さ（度/秒）。
// カードの幅を 0.25秒でなぞると 720度/秒 になるので、その3分の1あたり。
export const FLICK = 260;

/**
 * 指を離したとき、どこで落ち着くか。
 * ふつうは近いほうの面。速く払ったときは、半分まで来ていなくても
 * 払った向きの次の面へ回す（勢いを殺すと、指で回している感じが消える）。
 */
export const settle = (deg, vel = 0) => {
  if (Math.abs(vel) >= FLICK) {
    return vel > 0
      ? Math.floor(deg / 180) * 180 + 180
      : Math.ceil(deg / 180) * 180 - 180;
  }
  return Math.round(deg / 180) * 180;
};

/** 落ち着くまでの時間（秒）。残りが少なければ短く。半回転で 0.56秒。 */
export const TURN = 0.56;
export const settleTime = (from, to) => {
  const d = Math.abs(to - from);
  return Math.max(0.16, Math.min(0.6, (d / 180) * TURN));
};

/**
 * 落ち着き方の曲線。0→1。
 * 動きだしと止まりがなめらかで、最後にほんの少しだけ行き過ぎて戻る——
 * 紙の1枚が、ぱたんと置かれるときの跳ね。
 * ばねの式そのもの（減衰したばねの位置）を使っている。
 *   1 - e^(-at)(cos bt + (a/b) sin bt)
 * 速さは t=0 でちょうど 0 から始まるので、動きだしが急にならない。
 * 行き過ぎの大きさは e^(-aπ/b) で決まり、この値では約4%。
 * 半回転なら 7度ぶんで、「跳ねた」と分かるかどうかの手前に収まる。
 */
const SPRING_A = 5, SPRING_B = 4.88;
export const ease = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const e = Math.exp(-SPRING_A * t);
  return 1 - e * (Math.cos(SPRING_B * t) + (SPRING_A / SPRING_B) * Math.sin(SPRING_B * t));
};

/**
 * その角度のときの影。回っている最中は、横にずれて濃く広がる。
 * 空中で浮いて裏返っている感じを、影の側からも支える。
 * 真横を向いたとき（90度・270度）がいちばん深い。
 * back が true なら裏面用——裏面は先に180度回してあるので、
 * そのまま渡すと影だけ左右が逆に出る。
 */
export const cardShadow = (deg, back = false) => {
  const rad = (deg * Math.PI) / 180;
  const lift = Math.abs(Math.sin(rad));            // 0（正面）→ 1（真横）
  const x = Math.round(-16 * Math.sin(rad) * (back ? -1 : 1));
  const y = Math.round(14 - 5 * lift);
  const blur = Math.round(34 + 16 * lift);
  const a = (0.18 + 0.1 * lift).toFixed(3);
  // 内側の細い線2本が、カードの厚みになる。上に明かり、下に影。
  return `${x}px ${y}px ${blur}px rgba(38,37,31,${a}), inset 0 1px 0 rgba(255,255,255,.5), inset 0 -1px 0 rgba(0,0,0,.14)`;
};
