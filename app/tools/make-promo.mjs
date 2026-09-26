// TikTok / X 用のプロモーション動画を書き出す。
//
//   node app/tools/make-promo.mjs                 ← 動画（store-assets/promo/lukko-promo.mp4）
//   node app/tools/make-promo.mjs stills 1.5,5,9  ← その秒の静止画だけ（確認用。promo/stills/）
//   PROMO_TIMING=none PROMO_OUT=lukko-promo-base.mp4 node app/tools/make-promo.mjs
//                                                 ← ナレーション用の伸ばし（timing.json）を使わず、元の速さで
//
// 中身は store-assets/promo/promo.html。時間 t を渡すと、その瞬間の絵になる（window.render）。
// ブラウザで 1 コマずつ撮って、ffmpeg で 30fps の MP4（H.264、yuv420p）にまとめる。
// TikTok も X も、この形式なら変換なしで上がる。音は入れない（アプリ側で音源を付ける）。
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, '..', '..', 'store-assets', 'promo');
const FPS = 30;
const url = pathToFileURL(join(DIR, 'promo.html')).href + '?frame=1';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// 画像（スクショとウィジェット）が読み終わるのを待つ
await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
const stage = page.locator('#stage');
// ナレーションに合わせて場面を伸ばす倍率（make-narration.mjs が書く）。無ければ伸ばさない
const timingFile = join(DIR, 'timing.json');
if (existsSync(timingFile) && process.env.PROMO_TIMING !== 'none') {
  const { knots, total } = JSON.parse(readFileSync(timingFile, 'utf8'));
  await page.evaluate((k) => window.setTiming(k), knots);
  console.log(`timing.json のとおり伸ばす（全体 ${total} 秒）`);
}
const duration = await page.evaluate(() => window.DURATION);

if (process.argv[2] === 'stills') {
  const out = join(DIR, 'stills');
  mkdirSync(out, { recursive: true });
  for (const s of (process.argv[3] || '1.5,5,9,14,22,33,41,50').split(',').map(Number)) {
    await page.evaluate((t) => window.render(t), s);
    await stage.screenshot({ path: join(out, `t${String(s).replace('.', '_')}.png`) });
    console.log(`静止画 ${s}s`);
  }
} else {
  // 一時的なコマの置き場。OneDrive の中に何百枚も置くと同期が走るので、OS の一時フォルダに
  const tmp = join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'lukko-promo-frames');
  if (existsSync(tmp)) for (const f of readdirSync(tmp)) rmSync(join(tmp, f));
  mkdirSync(tmp, { recursive: true });
  const n = Math.round(duration * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await stage.screenshot({ path: join(tmp, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (i % 60 === 0) console.log(`  ${i}/${n}`);
  }
  const mp4 = join(DIR, process.env.PROMO_OUT || 'lukko-promo.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%04d.jpg'),
    // JPEG のコマは色の幅が「全域」なので、そのままだと yuvj420p になる。SNS で色がずれないよう、ふつうの幅（tv）に直す
    '-vf', 'scale=out_range=tv,format=yuv420p', '-c:v', 'libx264', '-color_range', 'tv', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg が失敗した');
  // 表紙（締めの画面）。TikTok の「カバー」や X の画像に使える
  await page.evaluate((t) => window.render(t), duration - 0.5);
  await stage.screenshot({ path: join(DIR, 'lukko-promo-cover.png') });
  console.log(`できた ${mp4}（${n} コマ、${duration} 秒）`);
}
await browser.close();
