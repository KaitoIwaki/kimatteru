# SwiftUI 版：シェア・まとめ・空き状況（sw-share）の進み具合

対象：`docs/feature-inventory.md` の 2-1・2-R・2-9・2-10・2-K・3.7・3.13・4.4（共有）。

## できたもの

| 節 | 中身 | 状態 |
|---|---|---|
| 2-1 まとめ（入り方・見出し・空のとき・月｜年・ym の共有） | `ReportScreen.swift`（月｜年は一覧の外に置いた） | ✓ |
| 2-1 月のタブ（送り・大きな数字・種類ごと・残業／有給・給料日ごと・給料・注記） | 同上。字の大きさを Web に合わせた | ✓ |
| 2-1 「シェア」＋「◯月のまとめカード ›」 | `openMonthCard`（tapLight・cardFrom='report'） | ✓ |
| 2-1 年のタブ（棒・押すとその月へ・合計・年の給料・注記・使い始める前の額） | 「時間は記録したそのものです…」の注記を足した。「稼いだ額」のかぎ括弧を Web と同じに | ✓ |
| 2-1 「◯年のまとめカード ›」 | `openYearCard` | ✓ |
| 2-R まとめの表示 | ✓ | ✓ |
| 2-9 いつ空いてる？（見出し・シェア・月送り・数・払い・1 日 1 行・印・回す） | `FreeScreen.swift` | ✓ |
| 2-9 予定 0 件の案内＋「iPhone のカレンダーから取り込む」 | 足した（はじめての案内中は出さない） | ✓ |
| 2-9 祝日名を日付の下に・札の幅（中身に合わせ最大 130） | 直した | ✓ |
| 3.7 重ねて表示の予定も数える（overlayFree） | 空き状況・シェアの画像・文字すべて。日ごとに絞る（Web の `_overlayFor(n,n+1)`） | ✓ |
| 2-10 空いてる日をシェア（暗い地・閉じる・見本カード・マス・凡例・注記） | `ShareScreen.swift`（シートで出す。下へ払っても閉じる） | ✓ |
| 2-10 範囲／平日休日／言い回しの札（tapLight）・名前 16 字・送る文の見本・署名 | `ShareCore.swift`（`shareOpt`・`setShareOpt`・`setShareName`） | ✓ |
| 2-10 文字でコピー（クリップボード・知らせ・評価の小窓の候補） | `copyFreeText` | ✓ |
| 2-10 画像で送る（`LUKKO-空いてる日-YYYY-MM.png`・署名の一言・失敗時「画像を作れませんでした」・評価の小窓） | `ShareCardDraw.drawFreeCard`＋共有シート | ✓ |
| 2-10 知らせは画面の中に | ✓ | ✓ |
| 2-K まとめカード（暗い地・閉じる・題・PNG そのものをプレビュー・画像にしてシェア・注記・知らせ） | `SummaryCardScreen.swift` | ✓ |
| 2-K 中身（月：年月・金額・時間・日数・勤務先ごと／年：金額＋前の額の注記・時間・勤務先ごと・月ごとの棒） | `ShareCardDraw.drawMonthCard`・`drawYearCard` | ✓ |
| 3.13 まとめ集計（カードに出す数） | `AppCore.summaryCard`（Web の `_buildCard` と同じ対象） | ✓ |
| 4.4 画像の共有（一時置き場に PNG を書いて、画像だけを渡す） | `ShareImage`・`ShareSheet` | ✓ |
| 4.4 文字＋.ics を一緒に渡す（shareTextAndFile） | `ShareSheet.presentText(_:fileName:fileText:)` を用意（「この予定を送る」は sw-form の画面） | ✓（部品のみ） |

## 確かめ方

- 正解表：`native/golden/gen-share.mjs` → `share.json`（110 件）・`share-cards.json`（90 件）。
  画面の中身・押したあとの選び方・コピーした字・ファイル名に加え、キャンバスに描く手順（字・位置・色・線・点線）を 1 手ずつ照らす（`ShareGoldenTests`）。字の幅は両方で同じ決まった式で測る。
- 写真：`native/LukkoUITests/ShareShots.swift`（S01〜S11。空き状況・シェア・書き出す画像・まとめ・月と年のカード・共有シート）。

## Web 版と違うところ

- 画面の出し方：share・summary は、開いた画面の上の iPhone のシート（Web は全面の画面）。下へ払うと「閉じる」と同じ。
- 月｜年 の切り替えは一覧の上に固定（一覧の行に入れると、切り替えが戻ることがあった）。
- カードの字：Web の "Hiragino Sans" と同じ書体を CoreText で使う（W3／W6／W7。CSS の太さ合わせと同じ選び方）。
- まとめカードの描き直し：Web は [種類・年月・予定の数・勤務先の数] が変わったときだけ。こちらはカードの中身そのものが変わったとき（使い始める前の額を変えたときも描き直す）。
- 試験のときだけ（`-lukkoShowSharePNG`）、シェアの画面の下に書き出す画像を出す。

## 気づいたこと（ほかの担当）

- 時給の入っていない勤務先（`hourly` が無い）の金額：Web は NaN、SwiftUI 版（`AppCore.hourlyFor`）は 0 になる。アプリで作る勤務先にはいつも時給があるので、正解表からは外した。
- 「この予定を送る」（`DetailScreen.swift`）は文字だけを送っている。Web は .ics（`LUKKO-{M}月{D}日.ics`）も添える。`ShareSheet.presentText` が使える。
