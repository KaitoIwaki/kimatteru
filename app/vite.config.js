import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * dist を自分で空にする。Vite に任せない。
 *
 * Vite の emptyOutDir は fs.rmSync を使う。**Node 24.13.0 の rmSync は、Windows で
 * 日本語を含むパスに対して黙って落ちる**（終了コード 0xC0000409。エラーは1行も出ず、
 * 「84 modules transformed」の直後に死ぬ）。このプロジェクトは
 * `ドキュメント/カレンダーアプリ` の下にあるので、dist がある限り毎回落ちていた。
 * unlinkSync と rmdirSync は同じパスでも無事なので、それで1つずつ消す。
 *
 * 2026-09-16 に見つけた。それまで「JSX の入れ子が深くて rollup が落ちる」と
 * 読み違えていた —— 通ったビルドは全部 rm -rf dist の直後だった、というだけだった。
 * macOS（Codemagic）では起きない。
 */
function emptyDirSafe(dir) {
  if (!existsSync(dir)) return;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${ent.name}`;
    if (ent.isDirectory()) { emptyDirSafe(p); rmdirSync(p); } else unlinkSync(p);
  }
}

export default defineConfig({
  plugins: [
    react(),
    { name: 'empty-outdir-safe', apply: 'build', buildStart() { emptyDirSafe(fileURLToPath(new URL('./dist', import.meta.url))); } },
  ],
  // 設定画面のバージョン表記は package.json を唯一の出どころにする
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // 相対パスにしておくと、どんなホスティング先のサブパスでもそのまま動く
  base: './',
  build: { emptyOutDir: false },
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
});
