// SNS 投稿用の画像を書き出す（毎日の宣伝素材）。
//
//   node app/tools/make-post.mjs store-assets/marketing/posts/2026-10-12
//
// そのフォルダの spec.json を読んで、同じフォルダに
//   feed.png  … 1080×1350（Instagram・X のタイムライン）
//   story.png … 1080×1920（TikTok・リール・ストーリーズ。下と右端は操作ボタンが重なるので文字は上寄せ）
// を書き出す。
//
// spec.json の形:
//   { "headline": "遊びの予定、\n{まだ}決まってない", "sub": "点線で置いておけるカレンダー",
//     "shot": "month", "tag": "学生向け" }
//   ・headline の {…} は点線、[…] は実線の下線。宣伝の文字そのものでアプリの決まり（決まった＝塗り・まだ＝点線）を見せる
//   ・shot は store-assets/marketing/shots/ にある今のアプリのスクショのファイル名（make-post-shots.mjs が撮る。
//     month・week・day・day-time・wage・mada・list・free・share・report・add）。
//     アプリの画面は描き直さない（実際と違う画面を出さない）。古いスクショ（promo/assets・screenshots-6.9）は今の画面と違うので使わない
import { chromium } from 'playwright';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const dir = resolve(process.argv[2] || '');
const specFile = join(dir, 'spec.json');
if (!process.argv[2] || !existsSync(specFile)) { console.error('spec.json が見つかりません：' + specFile); process.exit(1); }
const spec = JSON.parse(readFileSync(specFile, 'utf8'));

const shotFile = spec.shot && !/.png$/.test(spec.shot) ? spec.shot + '.png' : spec.shot;
const shotPath = shotFile && [join(ROOT, 'store-assets', 'marketing', 'shots', shotFile)].find((p) => existsSync(p));
if (spec.shot && !shotPath) { console.error('スクショが見つかりません：' + spec.shot); process.exit(1); }
const icon = pathToFileURL(join(ROOT, 'store-assets', 'promo', 'assets', 'icon.png')).href;

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mark = (s) => esc(s).replace(/\{([^}]*)\}/g, '<span class="dash">$1</span>').replace(/\[([^\]]*)\]/g, '<span class="solid">$1</span>').replace(/\n/g, '<br>');

const html = (w, h) => `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=block" rel="stylesheet">
<style>
  :root { --bg:#F3F7F1; --band:#D3E4CF; --green:#3E7A4D; --sage:#A9C5A6; --ink:#1C1F1B; --soft:#4A5A4E; }
  * { margin:0; box-sizing:border-box; }
  body { width:${w}px; height:${h}px; overflow:hidden; font-family:'Zen Maru Gothic','Yu Gothic UI','Yu Gothic',sans-serif; color:var(--ink);
    background: radial-gradient(120% 80% at 10% 0%, #fff 0%, var(--bg) 45%, var(--band) 100%); position:relative; }
  .grid { position:absolute; inset:0; background-image:linear-gradient(rgba(62,122,77,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(62,122,77,.06) 1px,transparent 1px); background-size:54px 54px; }
  .top { position:absolute; left:84px; right:84px; top:${h > 1500 ? 170 : 96}px; }
  .tag { display:inline-block; font-weight:700; font-size:30px; color:var(--green); border:3px dashed var(--green); border-radius:40px; padding:6px 26px; margin-bottom:30px; }
  h1 { font-weight:900; font-size:${spec.headlineSize || 84}px; line-height:1.32; letter-spacing:.01em; }
  .dash { text-decoration: underline dashed var(--green); text-decoration-thickness:7px; text-underline-offset:14px; }
  .solid { text-decoration: underline solid var(--green); text-decoration-thickness:9px; text-underline-offset:14px; }
  .sub { margin-top:30px; font-weight:700; font-size:38px; color:var(--soft); line-height:1.5; }
  .phone { position:absolute; left:50%; transform:translateX(-50%); width:${h > 1500 ? 680 : 600}px; top:${h}px;
    border-radius:64px; overflow:hidden; box-shadow:0 40px 90px rgba(28,31,27,.22); border:10px solid #fff; }
  .phone img { width:100%; display:block; }
  .fade { position:absolute; left:0; right:0; bottom:0; height:${h > 1500 ? 420 : 300}px; background:linear-gradient(transparent, var(--band) 85%); }
  .brand { position:absolute; left:50%; transform:translateX(-50%); bottom:${h > 1500 ? 320 : 56}px; display:flex; align-items:center; gap:20px; white-space:nowrap;
    font-weight:900; font-size:44px; background:#fff; border-radius:60px; padding:16px 40px 16px 18px; box-shadow:0 16px 40px rgba(28,31,27,.16); }
  .brand img { width:76px; height:76px; border-radius:18px; }
  .brand small { font-weight:700; font-size:28px; color:var(--soft); }
</style></head><body>
<div class="grid"></div>
<div class="top">${spec.tag ? `<div class="tag">${esc(spec.tag)}</div>` : ''}<h1>${mark(spec.headline)}</h1>${spec.sub ? `<div class="sub">${mark(spec.sub)}</div>` : ''}</div>
${shotPath ? `<div class="phone"><img src="${pathToFileURL(shotPath).href}"></div>` : ''}
<div class="fade"></div>
<div class="brand"><img src="${icon}">LUKKO<small>App Store で無料</small></div>
<script>
  // 画面（スクショ）は見出しのすぐ下から始める。見出しの行数で高さが変わるので、置いてから測る
  const t = document.querySelector('.top'), p = document.querySelector('.phone');
  if (p) p.style.top = (t.getBoundingClientRect().bottom + 56) + 'px';
</script>
</body></html>`;

const browser = await chromium.launch();
for (const [name, w, h] of [['feed', 1080, 1350], ['story', 1080, 1920]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  // file:// のスクショを読むため、いったんファイルにして開く（setContent だと読めない）
  const tmp = join(dir, `_${name}.html`);
  writeFileSync(tmp, html(w, h));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  unlinkSync(tmp);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: join(dir, `${name}.png`) });
  await page.close();
  console.log(`${name}.png（${w}×${h}）`);
}
await browser.close();
