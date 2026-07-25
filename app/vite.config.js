import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [react()],
  // 設定画面のバージョン表記は package.json を唯一の出どころにする
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // 相対パスにしておくと、どんなホスティング先のサブパスでもそのまま動く
  base: './',
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
});
