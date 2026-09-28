// アプリ内と同じ原稿から、公開用のHTMLを書き出す。
// App Store Connect には「プライバシーポリシーのURL」が必須なので、
// 出来上がった legal/ をGitHub Pagesなどに置いて、そのURLを登録する。
// 実行: node tools/build-legal.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const { PRIVACY, TERMS, APP_NAME, EFFECTIVE, CONTACT } = await import(pathToFileURL(join(root, 'src', 'docs.js')).href);

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

// ---- サポートページ ----
// App Store の「サポート URL」と「マーケティング URL」の行き先。
// 前はサポートの URL がプライバシーポリシーへ飛ぶだけで、よくある質問も、作っている人も書いていなかった。
// ここに書くのは、いまの版でできること だけ（まだ無い機能は書かない）。
const SUPPORT = {
  title: `${APP_NAME}（ルッコ）— 予定と未定のカレンダー`,
  lead: '決まった予定は塗り、まだの予定は点線。会議の仮押さえも、飲み会の候補日も、歯医者の予約待ちも、そのまま置けるカレンダーです。アカウント登録はいりません。予定はあなたの iPhone の中だけにあります。',
  uses: [
    ['会社員の方', '会議の仮押さえを点線で置き、決まったら塗りに。空き状況は平日の夜と休日だけで判定し、「10/3（金）19時以降」のように文字でも送れます。会社のカレンダーを重ねて表示することもできます（読むだけ）。'],
    ['シフト勤務の方（看護・介護・販売など）', 'シフトの型（日勤・夜勤・休）を選んで、日付を押すだけで勤務表を写せます。希望は点線、決まったら塗り。夜勤明けも空き状況に入り、締め日と給料日ごとの給料の目安も出ます。'],
    ['学生の方', 'バイトのシフトと給料の目安、遊びの候補日。決まっていない予定が、ひと目で分かります。'],
    ['子育て中の方', '保育園や学校の行事で「まだ決まっていない」ものを、点線のまま置いておけます。日にちが決まっていない用事は「今月のどこか」に置けます。'],
  ],
  promises: [
    '予定を外に送りません（開発者のサーバーはありません。アカウント登録もありません）',
    '広告を入れません',
    'いまある機能は、これからも無料です',
    '月額（定期購読）にはしません',
    'やめるときも、予定を持ち出せます（.ics ファイルと控え）',
  ],
  faq: [
    ['機種変更のときは？', 'iPhone を「クイックスタート」か「iCloud バックアップから復元」で移せば、予定もそのまま移ります。念のため、移す前に 設定 →「機種変更用に保存する（控え）」でファイルを取っておくと安心です。移らなかったときは、新しい iPhone で「控えから戻す」を押してファイルを選んでください。'],
    ['Google カレンダーや Outlook と同期できますか？', '同期はしていません。iPhone のカレンダーに入っている予定（Google・Outlook・会社のカレンダーなど）は「取り込む」か「重ねて表示（読むだけ）」で使えます。設定で「決まった予定を iPhone のカレンダーにも入れる」をオンにすると、決まった予定を「LUKKO」というカレンダーに書き出せます（はじめはオフ）。'],
    ['2台の iPhone で同じ予定にできますか？', '設定の「iCloud で同期」をオンにすると、同じ Apple ID の iPhone どうしで予定をそろえます。使うのはあなた本人の iCloud だけで、開発者は中身を見られません。'],
    ['会社の予定を入れても大丈夫ですか？', '予定は端末の中だけに保存され、外部へ送られることはありません。ウィジェットや通知に名前を出したくない予定は「名前を隠す」をオンにしてください。設定で「開くときに Face ID」も使えます。'],
    ['予定を消してしまいました', '消してから30日間は、設定 →「最近消した予定」から戻せます。消した直後なら、画面の下の「元に戻す」でも戻せます。'],
    ['通知が来ません', 'iPhone の 設定 → 通知 → LUKKO で、通知が許可されているか確かめてください。集中モード中は届かないことがあります。'],
    ['取り込んだら予定が二重になりました', '1.3 から、同じ予定を取り込み直したときは「新しい予定」ではなく「変わった予定」として扱います。それより前に二重になったものは、予定を左に払って消してください。直後なら 設定 →「最後の取り込みを取り消す」も使えます。'],
    ['できないことは？', 'ほかの人とカレンダーを共有する機能はありません（空いている日だけを画像や文字で送れます）。iPad・Android の専用版もまだありません。'],
  ],
  history: [
    ['1.3', '2026年', '使い方の1問（会社員・シフト勤務・学生・子育て）、週表示と時間の表示、仮押さえの呼び名、空き状況の時間帯、空いてる日を文字で送る、候補日・延期・日にち未定、取り消しと「最近消した予定」、毎日の自動の控え、iCloud での同期、重ねて表示、ロック画面のウィジェット、Face ID'],
    ['1.2', '2026年9月', 'まとめ（何に時間を使ったか）、.ics の出し入れ、大きいウィジェットの月のカレンダー'],
    ['1.1', '2026年9月', '名前を LUKKO に'],
    ['1.0', '2026年8月', '公開'],
  ],
  maker: '個人で作っています（VOID LABS）。いただいたご意見は、ひとつずつ読んでいます。お返事には数日いただくことがあります。',
};

const supportPage = () => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(APP_NAME)} — サポート</title>
<meta name="description" content="${esc(SUPPORT.lead)}">
<style>
  :root{--bg:#FAF9F4;--card:#FFFDF8;--line:#E6E2D6;--ink:#26251F;--ink-soft:#55524A;--ink-mut:#8C887C;--ink-faint:#B7B3A6}
  @media (prefers-color-scheme: dark){
    :root{--bg:#1A1A17;--card:#26251F;--line:#3A392F;--ink:#EDEBE1;--ink-soft:#B6B2A6;--ink-mut:#8C887C;--ink-faint:#5E5C51}
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.9}
  main{max-width:40rem;margin:0 auto;padding:3.5rem 1.4rem 5rem}
  .mark{display:inline-flex;align-items:center;gap:.15em;font-size:1rem;font-weight:700;letter-spacing:-.08em;margin-bottom:1.4rem}
  .mark .c{color:#1D9E75}.mark .q{color:#C1C5CC}
  h1{font-size:1.5rem;font-weight:700;margin:0 0 .8rem;text-wrap:balance}
  h2{font-size:1rem;font-weight:700;margin:2.4rem 0 .8rem}
  p,li,dd{font-size:.92rem;color:var(--ink-soft)}
  .lead{margin:0 0 1.6rem}
  .pill{display:inline-block;padding:.1rem .6rem;border-radius:.4rem;font-size:.85rem;margin-right:.4rem}
  .solid{background:#C9D4E8;color:#2A3550}.dash{border:1.5px dashed #6E85BE;color:#2A3550}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;margin:.6rem 0}
  .card b{display:block;color:var(--ink);font-size:.95rem;margin-bottom:.2rem}
  ul{padding-left:1.2rem;margin:.4rem 0}
  dt{font-weight:700;color:var(--ink);font-size:.95rem;margin-top:1.1rem}
  dd{margin:.25rem 0 0}
  table{width:100%;border-collapse:collapse;font-size:.88rem;color:var(--ink-soft)}
  td{border-top:1px solid var(--line);padding:.55rem .3rem;vertical-align:top}
  td:first-child{white-space:nowrap;color:var(--ink);font-weight:700}
  .badge{display:inline-block;margin-top:.6rem;padding:.6rem 1rem;border-radius:12px;background:var(--ink);color:var(--bg);text-decoration:none;font-weight:700;font-size:.92rem}
  a{color:var(--ink-soft)}
  .meta{font-size:.78rem;color:var(--ink-faint)}
</style>
</head>
<body>
<main>
  <div class="mark"><span class="c">✓</span><span class="q">？</span></div>
  <h1>${esc(SUPPORT.title)}</h1>
  <p class="lead">${esc(SUPPORT.lead)}</p>
  <p><span class="pill solid">決まった予定</span><span class="pill dash">まだの予定</span></p>
  <a class="badge" href="https://apps.apple.com/jp/app/id6794792375">App Store で見る</a>

  <h2>こんな使い方</h2>
  ${SUPPORT.uses.map(([h, t]) => `<div class="card"><b>${esc(h)}</b>${esc(t)}</div>`).join('\n  ')}

  <h2>LUKKO の約束</h2>
  <ul>${SUPPORT.promises.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>

  <h2>よくある質問</h2>
  <dl>${SUPPORT.faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('\n  ')}</dl>

  <h2>更新の記録</h2>
  <table>${SUPPORT.history.map(([v, d, t]) => `<tr><td>${esc(v)}</td><td>${esc(d)}</td><td>${esc(t)}</td></tr>`).join('')}</table>

  <h2>作っている人・お問い合わせ</h2>
  <p>${esc(SUPPORT.maker)}</p>
  <p><a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a></p>
  <p><a href="./privacy.html">プライバシーポリシー</a>　<a href="./terms.html">利用規約</a></p>
  <p class="meta">最終更新：${esc(EFFECTIVE)}</p>
</main>
</body>
</html>
`;

const out = join(root, '..', 'legal');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'privacy.html'), page(PRIVACY, TERMS));
writeFileSync(join(out, 'terms.html'), page(TERMS, PRIVACY));
writeFileSync(join(out, 'support.html'), supportPage());
// サポート URL（legal/index.html）はサポートページへ。前はプライバシーポリシーへ飛ぶだけだった
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(APP_NAME)}</title>
<meta http-equiv="refresh" content="0; url=./support.html"></head>
<body><a href="./support.html">${esc(APP_NAME)} のサポート</a></body></html>\n`
);
console.log('wrote', out);
