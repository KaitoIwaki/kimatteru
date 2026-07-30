// アプリ内と同じ原稿から、公開用のHTMLを書き出す。
// App Store Connect には「プライバシーポリシーのURL」が必須なので、
// 出来上がった legal/ をGitHub Pagesなどに置いて、そのURLを登録する。
// 実行: node tools/build-legal.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const { PRIVACY, TERMS, APP_NAME, EFFECTIVE } = await import(pathToFileURL(join(root, 'src', 'docs.js')).href);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = (doc, other) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)} — ${esc(APP_NAME)}</title>
<style>
  :root{--bg:#FAF9F4;--card:#FFFDF8;--line:#E6E2D6;--ink:#26251F;--ink-soft:#55524A;--ink-mut:#8C887C;--ink-faint:#B7B3A6}
  @media (prefers-color-scheme: dark){
    :root{--bg:#1A1A17;--card:#26251F;--line:#3A392F;--ink:#EDEBE1;--ink-soft:#B6B2A6;--ink-mut:#8C887C;--ink-faint:#5E5C51}
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",-apple-system,system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;line-height:1.95}
  main{max-width:37rem;margin:0 auto;padding:4rem 1.5rem 5rem}
  .mark{display:inline-flex;align-items:center;gap:.15em;font-size:1rem;font-weight:700;letter-spacing:-.08em;margin-bottom:1.6rem}
  .mark .c{color:#1D9E75}
  .mark .q{color:#C1C5CC}
  .mark span.name{font-size:.8rem;font-weight:600;color:var(--ink-soft);letter-spacing:0;margin-left:.5em}
  h1{font-size:1.6rem;font-weight:700;letter-spacing:-.01em;margin:0 0 1rem;text-wrap:balance}
  /* 長い日本語の本文は両端揃え。左揃えだと行末がそろわず左に寄って見える。
     text-wrap:pretty は行を短くする方向に働くので、本文では使わない。 */
  .lead{color:var(--ink-soft);font-size:.94rem;margin:0 0 2.4rem;text-align:justify}
  h2{font-size:.94rem;font-weight:700;margin:2.2rem 0 .5rem}
  p{font-size:.9rem;color:var(--ink-soft);margin:0 0 .7rem;text-align:justify}
  hr{border:0;border-top:1px solid var(--line);margin:2.6rem 0 1.2rem}
  .meta{font-size:.78rem;color:var(--ink-faint);margin:0}
  a{color:var(--ink-soft)}
  nav{margin-top:.6rem;font-size:.82rem}
</style>
</head>
<body>
<main>
  <div class="mark"><span class="c">✓</span><span class="q">？</span><span class="name">${esc(APP_NAME)}</span></div>
  <h1>${esc(doc.title)}</h1>
  <p class="lead">${esc(doc.lead)}</p>
  ${doc.sections
    .map((s) => `<h2>${esc(s.h)}</h2>\n  ${s.p.map((t) => `<p>${esc(t)}</p>`).join('\n  ')}`)
    .join('\n  ')}
  <hr>
  <p class="meta">最終更新：${esc(EFFECTIVE)}</p>
  <nav><a href="./${other.key}.html">${esc(other.title)}</a></nav>
</main>
</body>
</html>
`;

const out = join(root, '..', 'legal');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'privacy.html'), page(PRIVACY, TERMS));
writeFileSync(join(out, 'terms.html'), page(TERMS, PRIVACY));
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(APP_NAME)}</title>
<meta http-equiv="refresh" content="0; url=./privacy.html"></head>
<body><a href="./privacy.html">プライバシーポリシー</a></body></html>\n`
);
console.log('wrote', out);
