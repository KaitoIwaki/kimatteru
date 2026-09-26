// プロモーション動画にナレーションを付ける（VOICEVOX）。
//
//   node app/tools/make-narration.mjs          ← 声を作る → 場面を伸ばす → 動画を書き出す → 声を重ねる
//   node app/tools/make-narration.mjs voice    ← 声を作って、伸ばし方（timing.json）を決めるところまで
//
// 原稿は store-assets/promo/narration.json。行ごとに、どの場面（scene）の何秒目（cue、伸ばす前）に話し始めるか。
// 声は字幕を読むより時間がかかるので、場面ごとに「声が収まる長さ」を出して、足りない場面だけ伸ばす。
// 伸ばした場面は、中の動き・説明の出る時刻も同じ倍率でゆっくりになる（promo.html の setTiming）。
// 出力：store-assets/promo/timing.json（倍率と各行の開始秒）、lukko-promo.mp4（伸ばした動画）、
//       lukko-promo-voice.mp4（声つき。これを投稿する）
//
// VOICEVOX は PC の中で動く（原稿を外に送らない）。エンジンは http://127.0.0.1:50021。
// 商用利用は、動画の説明に「VOICEVOX:（声の名前）」と書くのが条件。
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, '..', '..', 'store-assets', 'promo');
const { lines, voice } = JSON.parse(readFileSync(join(DIR, 'narration.json'), 'utf8'));
const API = 'http://127.0.0.1:50021';
// promo.html の BASE と同じ（場面の、伸ばす前の長さ）
const BASE = { s1: 3.4, s2: 3.4, s3: 4.4, s4: 8.0, s5: 6.0, s6a: 3.0, s6b: 10.4, s7: 5.4, s8: 3.2, s9: 5.4, s10: 4.0 };
const ORDER = Object.keys(BASE);
const GAP = 0.2;        // 行と行のあいだの息つぎ
const TAIL = { default: 0.45, s10: 1.2 };   // 場面の最後の行のあと、次の場面へ移るまでの余白。締めは長めに

const tmp = join(process.env.TEMP || '/tmp', 'lukko-narration');
if (existsSync(tmp)) for (const f of readdirSync(tmp)) rmSync(join(tmp, f));
mkdirSync(tmp, { recursive: true });
const dur = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim());

try { await fetch(`${API}/version`); } catch {
  console.log('VOICEVOX のエンジンが動いていない。VOICEVOX を開くか、vv-engine/run.exe を起動してから、もう一度。');
  process.exit(1);
}

// 1. 声を作って、長さを測る
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  const q = await fetch(`${API}/audio_query?speaker=${voice.speaker}&text=${encodeURIComponent(L.read || L.text)}`, { method: 'POST' });
  if (!q.ok) throw new Error(`audio_query が失敗: ${q.status}`);
  const query = await q.json();
  query.speedScale = voice.speed || 1.1;
  query.prePhonemeLength = 0.05; query.postPhonemeLength = 0.08;
  const s = await fetch(`${API}/synthesis?speaker=${voice.speaker}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
  if (!s.ok) throw new Error(`synthesis が失敗: ${s.status}`);
  L.file = join(tmp, `l${i}.wav`);
  writeFileSync(L.file, Buffer.from(await s.arrayBuffer()));
  L.dur = dur(L.file);
}

// 2. 場面ごとの伸ばし方（折れ線）。行は、ふつうは cue（その説明が画面に出る時刻）に置く。
//    前の行がまだ終わっていなければ、その後ろへずらし、ずれたぶんだけ画面の時間もそこで止めて待つ。
//    こうすると、声と画面の動き（「丸は」と言った瞬間に ○ の行に枠）が合ったまま、伸びるのは声が収まらない所だけ。
//    一律に倍率をかけると、後ろの説明ほど遅れが積み上がって伸びすぎた（70 秒になった）
const knots = {};
let at = 0;
for (const id of ORDER) {
  const mine = lines.filter((l) => l.scene === id).sort((a, b) => a.cue - b.cue);
  const k = [[0, 0]];
  let end = 0, delay = 0;
  for (const l of mine) {
    const real = Math.max(l.cue + delay, end + (end ? GAP : 0));
    if (real > l.cue + delay) k.push([l.cue, l.cue + delay]);   // ここまでは今までの遅れのまま進み、
    delay = real - l.cue;                                         // この行の前で時間を止めて待つ
    k.push([l.cue, real]);
    l.local = real; end = real + l.dur; l.at = at + real;
  }
  const len = Math.max(BASE[id] + delay, mine.length ? end + (TAIL[id] ?? TAIL.default) : 0);
  // 最後の行のあとも足りなければ、場面の終わりまでをなだらかに伸ばす
  k.push([BASE[id], len]);
  knots[id] = k.map(([b, r]) => [+b.toFixed(3), +r.toFixed(3)]);
  console.log(`${id.padEnd(4)} ${BASE[id].toFixed(1)}s → ${len.toFixed(1)}s`);
  at += len;
}
const total = at;
writeFileSync(join(DIR, 'timing.json'), JSON.stringify({
  _: 'make-narration.mjs が書く。場面ごとの伸ばし方（折れ線。promo.html の setTiming に渡す）と、各行を話し始める秒',
  voice: `VOICEVOX:${voice.name}`, total: +total.toFixed(2), knots,
  lines: lines.map((l) => ({ at: +l.at.toFixed(2), dur: +l.dur.toFixed(2), text: l.text })),
}, null, 2));
for (const l of lines) console.log(`  ${l.at.toFixed(1).padStart(5)}s  ${l.dur.toFixed(2)}s  ${l.text}`);
console.log(`全体 ${total.toFixed(1)} 秒`);
if (process.argv[2] === 'voice') process.exit(0);

// 3. 伸ばした動画を書き出す（make-promo.mjs が timing.json を読む）
const r1 = spawnSync('node', [join(here, 'make-promo.mjs')], { stdio: 'inherit' });
if (r1.status !== 0) throw new Error('make-promo.mjs が失敗した');

// 4. 声を重ねる。行ごとに遅らせて足し合わせる。声は少し持ち上げ、ピークを抑える
const video = join(DIR, 'lukko-promo.mp4');
const vdur = dur(video);
const args = ['-y', '-loglevel', 'error', '-i', video];
for (const l of lines) args.push('-i', l.file);
const parts = lines.map((l, i) => `[${i + 1}:a]aresample=48000,adelay=${Math.round(l.at * 1000)}:all=1[a${i}]`);
const mix = `${lines.map((_, i) => `[a${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,volume=1.3,alimiter=limit=0.95,apad,atrim=0:${vdur.toFixed(3)}[voice]`;
const out = join(DIR, 'lukko-promo-voice.mp4');
args.push('-filter_complex', [...parts, mix].join(';'), '-map', '0:v', '-map', '[voice]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out);
const r2 = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r2.status !== 0) throw new Error('ffmpeg が失敗した');
console.log(`できた ${out}（${vdur.toFixed(1)} 秒、VOICEVOX:${voice.name}）`);
