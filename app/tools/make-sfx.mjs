// プロモーション動画（ナレーションなし）に効果音を付ける。
//
//   node app/tools/make-sfx.mjs          ← 元の速さの動画を書き出して、効果音を重ねる
//   node app/tools/make-sfx.mjs quick    ← 動画は書き出し直さず（lukko-promo-base.mp4 を使う）、音だけ作り直す
//
// きっかけは store-assets/promo/sfx.json（どの場面の何秒で、どの音を鳴らすか）。
// 音はフリー素材を使わず、ffmpeg でその場で合成する（権利やクレジットの心配が無い）。
// 出力：lukko-promo-base.mp4（元の速さ、音なし）、lukko-promo-sfx.mp4（効果音つき。これを投稿する）
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, '..', '..', 'store-assets', 'promo');
const { cues } = JSON.parse(readFileSync(join(DIR, 'sfx.json'), 'utf8'));
// promo.html の BASE と同じ（場面の長さ）
const BASE = [['s1', 3.4], ['s2', 3.4], ['s3', 4.4], ['s4', 8.0], ['s5', 6.0], ['s6a', 3.0], ['s6b', 10.4], ['s7', 5.4], ['s8', 3.2], ['s9', 5.4], ['s10', 4.0]];
const start = {};
{ let a = 0; for (const [id, d] of BASE) { start[id] = a; a += d; } }

const video = join(DIR, 'lukko-promo-base.mp4');
if (process.argv[2] !== 'quick' || !existsSync(video)) {
  const r = spawnSync('node', [join(here, 'make-promo.mjs')], { stdio: 'inherit', env: { ...process.env, PROMO_TIMING: 'none', PROMO_OUT: 'lukko-promo-base.mp4' } });
  if (r.status !== 0) throw new Error('make-promo.mjs が失敗した');
}

// ---- 音を作る ----
// aevalsrc の式で波を書く。t は秒。exp(-t*k) で減衰させる
const SR = 48000;
const SOUNDS = {
  // 高い音からすっと下がる「ポン」（900Hz → 200Hz）
  pop: { d: 0.16, expr: '0.8*sin(2*PI*(900*t-2200*t*t))*exp(-t*26)' },
  // 低い音から上がる「ポワン」。？が浮かぶとき
  bloop: { d: 0.28, expr: '0.6*sin(2*PI*(260*t+1400*t*t))*exp(-t*11)' },
  // 短く高い「ピッ」
  tick: { d: 0.07, expr: '0.45*sin(2*PI*2200*t)*exp(-t*70)' },
  // 指で押す：低い「コツ」と高い「カチ」
  tap: { d: 0.12, expr: '0.9*sin(2*PI*140*t)*exp(-t*35)+0.35*sin(2*PI*2600*t)*exp(-t*150)' },
  // 塗りに変わる「キラン」：ミ（E6）に倍音、少し遅れてシ（B6）
  chime: { d: 1.0, expr: '0.42*sin(2*PI*1318.5*t)*exp(-t*5)+0.18*sin(2*PI*2637*t)*exp(-t*8)+gte(t,0.09)*0.42*sin(2*PI*1975.5*(t-0.09))*exp(-(t-0.09)*4.5)' },
  // 最後の「ジャン」：ド・ミ・ソ・ド を少しずつずらして重ねる
  finale: { d: 1.8, expr: [[1046.5, 0], [1318.5, 0.08], [1568, 0.16], [2093, 0.24]]
    .map(([f, s]) => `gte(t,${s})*0.3*sin(2*PI*${f}*(t-${s}))*exp(-(t-${s})*2.6)`).join('+') },
  // 「シュッ」：ピンクノイズを帯域で絞って、ふわっと入って抜ける。
  // 帯域で絞ると音が痩せる（最初は他の音より 15dB 小さく、スマホでは聞こえなかった）ので、そのぶん持ち上げる
  whoosh: { d: 0.5, noise: 'bandpass=f=900:width_type=o:w=2,afade=t=in:d=0.22,afade=t=out:st=0.24:d=0.26,volume=3.2' },
  swish: { d: 0.32, noise: 'bandpass=f=1800:width_type=o:w=1.6,afade=t=in:d=0.12,afade=t=out:st=0.14:d=0.18,volume=2.2' },
};
const tmp = join(process.env.TEMP || '/tmp', 'lukko-sfx');
if (existsSync(tmp)) for (const f of readdirSync(tmp)) rmSync(join(tmp, f));
mkdirSync(tmp, { recursive: true });
for (const [name, s] of Object.entries(SOUNDS)) {
  const src = s.expr ? `aevalsrc='${s.expr}':d=${s.d}:s=${SR}` : `anoisesrc=color=pink:d=${s.d}:a=0.6:r=${SR},${s.noise}`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', src, '-ac', '2', join(tmp, `${name}.wav`)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${name} を作れなかった: ${r.stderr}`);
}

// ---- 重ねる ----
const vdur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' }).stdout.trim());
const args = ['-y', '-loglevel', 'error', '-i', video];
const names = Object.keys(SOUNDS);
for (const n of names) args.push('-i', join(tmp, `${n}.wav`));
// 同じ音を何度も使うので、音ごとに asplit で分けてから、きっかけの秒へ遅らせる
const uses = Object.fromEntries(names.map((n) => [n, cues.filter((c) => c.s === n).length]));
const graph = [];
names.forEach((n, i) => { if (uses[n]) graph.push(`[${i + 1}:a]asplit=${uses[n]}${Array.from({ length: uses[n] }, (_, k) => `[${n}${k}]`).join('')}`); });
const seen = {};
cues.forEach((c, j) => {
  const k = (seen[c.s] = (seen[c.s] ?? -1) + 1);
  const at = start[c.scene] + c.at;
  graph.push(`[${c.s}${k}]volume=${c.gain ?? 1},adelay=${Math.round(at * 1000)}:all=1[c${j}]`);
});
graph.push(`${cues.map((_, j) => `[c${j}]`).join('')}amix=inputs=${cues.length}:normalize=0,volume=0.9,alimiter=limit=0.9,apad,atrim=0:${vdur.toFixed(3)}[sfx]`);
const out = join(DIR, 'lukko-promo-sfx.mp4');
args.push('-filter_complex', graph.join(';'), '-map', '0:v', '-map', '[sfx]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out);
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status !== 0) throw new Error('ffmpeg が失敗した');
console.log(`できた ${out}（${vdur.toFixed(1)} 秒、効果音 ${cues.length} か所）`);
