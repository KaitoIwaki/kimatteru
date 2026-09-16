// ブラウザ版を作る。出るのはリポジトリ直下の web/。
//
//   npm run build:web
//
// 中身は iPhone のアプリと同じ。違うのは置く場所だけ（vite.config.js の OUT）。
// web/ をそのまま静的なホスティング（GitHub Pages、Netlify、Cloudflare Pages…）に
// 置けば動く。相対パス（base './'）なので、どのサブパスに置いても動く。
//
// ブラウザでは使えないもの（iPhone だけ）：
//   iPhone のカレンダーからの取り込み／通知（リマインド）／応援（課金）／ウィジェット。
//   それぞれの画面は、ブラウザでは出ない作りになっている。
// 保存は端末の中（localStorage）。iPhone と PC のあいだで中身は共有されない——
// 共有したいなら .ics で書き出して渡す（設定 → 予定の出し入れ）。
process.env.LUKKO_OUT = 'web';   // vite.config.js がこれを見て出す先を変える
const { build } = await import('vite');
await build();
console.log('\nできた: web/  （そのまま静的なホスティングに置ける）');
