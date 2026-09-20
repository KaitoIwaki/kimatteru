# ChatGPT の画像生成で、sukuji 風の紹介画像を作るためのプロンプト

> **2026-09-21**：いまは ChatGPT の絵は「机の下地」としてだけ使っている。見出し・小見出し・スマホは
> `app/tools/sukuji-fill.mjs` が消して描き直す（ChatGPT のスマホは幅の 4 割で小さすぎた）。
> なので下のプロンプトで描き直すときも、Headline の文言やスマホの大きさは結果に影響しない。
> 大事なのは机・小物・葉の雰囲気だけ。

2026-09-19。サイト（sukuji.com）用。**App Store には出さない**（描いた UI は審査で弾かれる）。

## 進め方（ここを外すと、画面が描き変えられる）

画像生成は、渡したスクリーンショットを**そのまま**は置かない。似た画面を描き直して、
無いボタンや違う文言が混ざる。だから：

1. ChatGPT には**地・小物・見出し・スマホの枠**だけ描かせる。**画面の中は空（白）にさせる**
2. 出てきた画像の、空いた画面の場所に、**本物のスクショを自分で貼る**（Canva や sukuji の枠でよい）
3. 見出しの日本語は、モデルが崩すことがある。崩れたら見出しも空にして、あとで自分で乗せる

渡す画面（この場所にある）：`1-calendar.png` `2-dialog.png` `3-free.png`、まとめは `../screenshots-6.9/ss-5-report.png`。
ウィジェットは**実機のホーム画面のスクショ**を自分で撮る（中サイズ）。

## 共通のテイスト（毎回、先頭に貼る）

```
App Store screenshot style promotional image, portrait 1290x2796.
Soft off-white paper background with a very subtle warm gradient, gentle studio light from top-left.
One accent color only: muted green (#6E9E78). No other saturated colors.
Bold black Japanese headline at the top in a rounded gothic font, large, 2 lines max.
A modern iPhone with a Dynamic Island, slightly tilted, casting a soft shadow.
IMPORTANT: leave the phone screen completely blank white — no UI, no icons, no text on the screen.
Clean, minimal, calm. Photographic props are simple and few. No people's faces.
```

## 1 枚目　未定のまま、置ける

```
[共通のテイスト]
Headline (Japanese, exact text): 「未定のまま、置ける」
Small subline above it: 「たぶんの予定も、そのまま」
Props: a green pen and a wooden pencil lying on graph paper. On the paper, two small checkboxes:
one drawn with a solid green line and checked, one drawn with a dashed grey line and empty.
The dashed one is slightly larger and closer to the camera.
No phone in this image.
```

## 2 枚目　決まったら、押すだけ

```
[共通のテイスト]
Headline: 「決まったら、押すだけ」
Subline: 「点線が、塗りに変わる」
The phone is centered. Screen blank white.
Below the phone, a small graphic: a dashed rounded pill on the left, a short green arrow,
and a solid green rounded pill with a white check mark on the right.
```
→ 画面には `2-dialog.png` を貼る。

## 3 枚目　ホーム画面にも（ウィジェット）
**大・中・小の3つを見せる版**（2026-09-19。こちらを本命にする）：

見出しは絵に焼き込まれるが、`sukuji-fill.mjs` の `HEADLINE` で消して描き直している
（「ホーム画面に、まだ何件か」は文として変だったので「ウィジェットで表示」に。2026-09-21）。
次に描き直すときは、下の Headline も「ウィジェットで表示」にする。

```
[共通のテイスト]
Headline: 「ホーム画面に、まだ何件か」
Subline: 「小・中・大、好きな大きさで」
No phone in this image. Instead, three blank white rounded rectangles floating
above the desk like paper cards, each with a soft drop shadow, slightly overlapping:
- a small square (1:1) at the upper left
- a wide rectangle (2:1, twice the width of the square) at the upper right
- a large near-square rectangle (about 1:1.05, same width as the wide one) at the bottom center
Leave all three rectangles completely blank white. No icons, no text inside them.
Same corner radius on all three (like iOS widgets).
```
→ 出た絵を `gen/gen-3-sizes.png` に。実機のホーム画面を `gen/widget-small.png` `widget-medium.png`
　`widget-large.png` に置く。`node app/tools/sukuji-fill.mjs` が比（横長・正方形・縦長め）で振り分けて貼る。

**1つだけの版**（前のもの）：

```
[共通のテイスト]
Headline: 「ホーム画面に、まだ何件か」
Subline: 「開かなくても、分かる」
The phone shows an iPhone home screen: a plain light wallpaper and a few generic app icons
drawn as soft rounded squares WITHOUT any logos or text.
In the middle of the home screen, leave a blank white rounded rectangle the size of a medium
widget (2 icons tall, 4 icons wide). Nothing inside it.
```
→ 白い長方形の場所に、**実機のウィジェットのスクショ**を切り抜いて貼る。
　（ウィジェットの中身：上に日付と「まだ○件」、その下に今日の予定が塗りと点線で並ぶ）

## 4 枚目　○△× で、空きがひと目

```
[共通のテイスト]
Headline: 「いつ空いてる？に、すぐ答える」
Subline: 「○△× で、空きがひと目」
The phone is centered, screen blank white.
Around the phone, three small floating paper tags with a hand-drawn feel:
a green circle ○, an amber triangle △, and a grey cross ×. Slight shadows under each tag.
```
→ 画面には `3-free.png` を貼る。

## 5 枚目　何に時間を使ったか、見える

```
[共通のテイスト]
Headline: 「何に時間を使ったか、見える」
Subline: 「バイトも、遊びも、用事も」
The phone is centered, screen blank white.
Beside the phone, three small stacked paper slips with simple line icons: a coffee cup,
a movie ticket, a dumbbell. Muted green accent on one of them.
```
→ 画面には `ss-5-report.png` を貼る。

## 6 枚目　（締め）

```
[共通のテイスト]
Headline: 「予定の迷いを、なくす」
Subline: 「無料ではじめる」
No phone. A paper desk calendar (tear-off style) with a green binding at the top,
showing a grid of small circles: most solid green, a few drawn as dashed rings.
Close-up, shallow depth of field.
```

## 文言の決まり

- アプリの言葉は「未定」「まだ」「決まった」。「迷う予定」「仮予定」は使わない（ストアと揃える）
- 見出しは2行まで。説明を足さない
- 「今すぐ」「最強」「革命」のような言葉は使わない。このアプリはそういう声で話さない
