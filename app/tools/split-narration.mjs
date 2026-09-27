// 1 本で録ったナレーション（Google AI Studio などで作った WAV）を、台本の行ごとに切り分ける。
//
//   node app/tools/split-narration.mjs store-assets/promo/narration-gemini.wav
//
// 行のあいだの無音で切りたいが、「、」の所にも同じくらいの無音があるので、長い無音で切るだけでは外れる。
// そこで、各行の文字数から「この行は何秒くらいか」を見積もり、見積もりに合い、かつ無音が長い切れ目の
// 組み合わせを、動的計画法で選ぶ（行は 22、切れ目の候補は 0.2 秒以上の無音）。
// 出力：store-assets/promo/narration-split.json（各行の、元の音声での開始・終了秒）
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, '..', '..', 'store-assets', 'promo');
const wav = resolve(process.argv[2] || join(DIR, 'narration-gemini.wav'));
const { lines } = JSON.parse(readFileSync(join(DIR, 'narration.json'), 'utf8'));

const total = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' }).stdout.trim());
const log = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'silencedetect=noise=-38dB:d=0.2', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const sil = [];
let s0 = null;
for (const m of log.matchAll(/silence_(start|end): ([0-9.]+)/g)) {
  if (m[1] === 'start') s0 = Number(m[2]);
  else if (s0 !== null) { sil.push({ a: s0, b: Number(m[2]) }); s0 = null; }
}
if (s0 !== null) sil.push({ a: s0, b: total });
// 最初と最後の無音は、声の頭と尻を決めるのに使う
const head = sil.length && sil[0].a < 0.05 ? sil.shift().b : 0;
const tail = sil.length && sil[sil.length - 1].b > total - 0.05 ? sil.pop().a : total;
const cand = sil.map((x) => ({ t: (x.a + x.b) / 2, a: x.a, b: x.b, d: x.b - x.a }));

// 行の長さの見積もり：読む文字（かな・漢字・英字）を数える。漢字は 1.6 拍くらいに数える
const text = (l) => (l.read || l.text).replace(/[「」、。？！?!\s]/g, '');
const weight = (s) => [...s].reduce((a, ch) => a + (/[一-鿿]/.test(ch) ? 1.6 : 1), 0);
const W = lines.map((l) => weight(text(l)));
const speech = (tail - head) - 0.3 * (lines.length - 1);   // 行間の無音ぶん（0.3 秒ずつ）を引いた、話している時間
const k = speech / W.reduce((a, b) => a + b, 0);
const expect = W.map((w) => w * k);

// dp[i][j]：i 行目までを、j 番目の切れ目で終えたときの損失の最小。
// 損失 = 行の長さのずれ（見積もりとの比）の 2 乗 − 切れ目の無音の長さ × 重み（長い無音ほど切れ目らしい）
const N = lines.length, C = cand.length;
const pos = [head, ...cand.map((c) => c.t), tail];      // 0 = 頭、1..C = 候補、C+1 = 尻
const cutGain = [0, ...cand.map((c) => c.d), 0];
const cost = (i, p, q) => { const d = pos[q] - pos[p]; const e = expect[i]; return ((d - e) / e) ** 2; };
const GAIN = Number(process.env.SPLIT_GAIN || 1.0);
const INF = 1e18;
const dp = Array.from({ length: N + 1 }, () => new Array(C + 2).fill(INF));
const from = Array.from({ length: N + 1 }, () => new Array(C + 2).fill(-1));
dp[0][0] = 0;
for (let i = 0; i < N; i++) for (let p = 0; p < C + 2; p++) {
  if (dp[i][p] >= INF) continue;
  for (let q = p + 1; q < C + 2; q++) {
    if (i < N - 1 && q === C + 1) continue;   // 尻で終われるのは最後の行だけ
    if (i === N - 1 && q !== C + 1) continue;
    // 無音の長さの重みは 1.0。2.5 だと、行の中の「。」の長い間を行の切れ目と取り違えた（15〜17 行目）
    const v = dp[i][p] + cost(i, p, q) - GAIN * cutGain[q];
    if (v < dp[i + 1][q]) { dp[i + 1][q] = v; from[i + 1][q] = p; }
  }
}
const cuts = [];
for (let i = N, q = C + 1; i > 0; i--) { cuts.unshift(q); q = from[i][q]; }
// 行の開始・終了：切れ目の無音の中には入れない（無音の終わりから次の無音の始まりまで）
const segs = [];
let startAt = head;
cuts.forEach((q, i) => {
  const endAt = q === C + 1 ? tail : cand[q - 1].a;
  segs.push({ i: i + 1, start: +startAt.toFixed(3), end: +endAt.toFixed(3), expect: +expect[i].toFixed(2), text: lines[i].text });
  if (q !== C + 1) startAt = cand[q - 1].b;
});
for (const s of segs) {
  const d = s.end - s.start, r = d / s.expect;
  console.log(`${String(s.i).padStart(2)}  ${s.start.toFixed(2).padStart(6)}–${s.end.toFixed(2).padStart(6)}  ${d.toFixed(2)}s（見積もり ${s.expect.toFixed(2)}s${r < 0.7 || r > 1.4 ? '  ←ずれが大きい' : ''}）  ${s.text}`);
}
writeFileSync(join(DIR, 'narration-split.json'), JSON.stringify({ source: wav.split(/[\\/]/).pop(), total, segments: segs }, null, 2) + '\n');
console.log(`narration-split.json に書いた（${segs.length} 行）`);
