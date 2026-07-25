# 決まってる？ — iOSアプリ

不確定な予定と決まっている予定が一目でわかるカレンダー。
Windows で開発し、iOS のビルドと署名は Codemagic のクラウド Mac で行う構成（Capacitor）。

## 開発中の確認（Windows）

```bash
npm --prefix app run dev
```

表示された Network のアドレスを iPhone の Safari で開けば、同じ Wi-Fi 上で実機の見え方を確認できる。
※ 触覚フィードバックとOS通知、共有シートはブラウザでは動かない。実機アプリでのみ動く。

サンプルの予定を入れた状態を見たいときは、URLの末尾に `?demo=1` を付ける（通常の利用では現れない）。

## iOSプロジェクトへ反映

Web 側を変更したら、必ずこの2つを実行する。

```bash
npm --prefix app run build
```

```bash
cd app && npx cap sync ios
```

## 構成

| ファイル | 役割 |
|---|---|
| `src/App.jsx` | 状態と表示ロジック。`renderVals()` が画面に渡す値を全部組み立てる |
| `src/view.jsx` | 見た目。`v` を受け取って JSX を返すだけ |
| `src/style.js` | CSS文字列 → React の style オブジェクト変換 |
| `src/styles.css` | 色（紙と墨）、キーフレーム、セーフエリア対応 |
| `src/haptics.js` | 触覚フィードバック。ネイティブ以外では自動的に無効 |
| `src/notify.js` | シフト終了時刻のローカル通知。予定の変更に応じて貼り直す |
| `src/sharecard.js` | シェア画像をキャンバスに直接描く（まとめ／空いてる日） |
| `src/shareimg.js` | 書き出した画像をiOSの共有シートに渡す |
| `src/docs.js` | 利用規約・プライバシーポリシーの原稿（アプリ内と公開HTMLで共用） |
| `src/demo.js` | `?demo=1` のときだけ使うサンプル予定 |
| `ios/` | Xcode プロジェクト（`npx cap add ios` が生成。手で編集しない） |

**直したい場所**：見た目は `view.jsx`、挙動や計算は `App.jsx`。

## ツール

```bash
node tools/build-legal.mjs
```
`src/docs.js` の原稿から、公開用の `legal/*.html` を書き出す。プライバシーポリシーURLに使う。

```bash
npm i -D sharp && node tools/make-icon.mjs
```
アプリアイコンを作り直す（sharp は普段のビルドに不要なので依存に入れていない）。

### App Store 用スクリーンショットの撮り直し

1. `npm --prefix app run dev` でサーバーを立てる
2. ブラウザの表示サイズを **430×932** にする
3. `http://localhost:****/?demo=1` を開く
4. 開発者コンソールで `html2canvas` を読み込み、`#root>div` を `scale:3, width:430, height:932` で描画して保存する

`store-assets/screenshots-6.9/` に 1290×2796 で5枚入っている。

## データの保存

`localStorage` に `kimatteru.v2` として保存。アプリを閉じても残るが、その端末だけ。端末間同期は未実装。

## リリースまでに必要な手続き

`store-assets/app-store-metadata.md` に、説明文・キーワード・審査メモ・チェックリストをまとめてある。

1. **Apple Developer Program の登録**（年額あり）
2. **GitHub リポジトリの用意** — Codemagic はリポジトリを見てビルドする
3. **`src/docs.js` の `CONTACT` を実際の連絡先に書き換える** → `node tools/build-legal.mjs` を再実行
4. **`legal/` を公開**（GitHub Pages など）してプライバシーポリシーURLを取得
5. **App Store Connect でアプリを作成**（バンドルID `com.kimatteru.app`）
6. **App Store Connect API キー**を Codemagic に登録し、`codemagic.yaml` のキー名を差し替え

## 既知の未対応

- 端末間のデータ同期（クラウド）
- 深夜手当・残業割増などの時間帯別時給
- 候補日を相手に送って回答してもらう共有リンク
