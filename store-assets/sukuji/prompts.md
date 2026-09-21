# ChatGPT の画像生成で、sukuji 風の紹介画像を作るためのプロンプト

> **2026-09-21**：いまは ChatGPT の絵は「机の下地」としてだけ使っている。見出し・小見出し・スマホは
> `app/tools/sukuji-fill.mjs` が消して描き直す（ChatGPT のスマホは幅の 4 割で小さすぎた）。
> なので下のプロンプトで描き直すときも、Headline の文言やスマホの大きさは結果に影響しない。
> 大事なのは机・小物・葉の雰囲気だけ。

## いまの作り方（2026-09-21〜）：机と小物だけ描いてもらう

スマホも文字もこちらで描くので、ChatGPT には**下地だけ**を頼む。空けておく場所を伝えると、
小物がスマホの裏に隠れない。5 枚は**同じ会話の中で続けて**出すと、光と机の色が揃いやすい。
出た絵は `gen/gen-N.png` に上書きして `node app/tools/sukuji-fill.mjs`。

**共通（毎回、先頭に貼る）**

```
Background plate for an app promotional image, portrait 1290x2796 (9:19.5).
A desk seen from directly above. Soft off-white paper / light wood surface with a very subtle
warm gradient and gentle studio light from the top-left. Soft, natural shadows.
One accent color only: muted green (#6E9E78). No other saturated colors. Calm, minimal, Japanese
stationery-store feeling.

IMPORTANT — leave these areas completely empty (plain surface, nothing on them):
- the top 30% of the image (a headline will be placed there later)
- a vertical band in the middle, 70% of the width, from 30% down to the bottom (a phone will be placed there later)
Props may appear only along the left and right edges (outer 15% of the width) and the bottom edge.
A few leaves with soft shadows may peek in from the top corners only.
No phone. No text. No letters or numbers anywhere. No app UI.
```

**1 枚目**（未定のまま、置ける）：`Props: a green pen and a wooden pencil along the bottom edge; a corner of graph paper at the bottom-left.`
**2 枚目**（決まったら、押すだけ）：`Props: a green pen at the bottom-right; a corner of a notebook at the bottom-left.`
**3 枚目**（ウィジェット）：`Props: a notebook corner at the bottom-left and a green pen at the bottom-right.` ＋ 白い角丸 3 つ（下の「大・中・小」の指定をそのまま。3 つの四角だけは中央に置いてよい）
**4 枚目**（いつ空いてる？）：`Props: three small square paper cards along the LEFT and RIGHT edges only, drawn with a thin green circle, a thin amber triangle, and a thin grey cross. A pen at the bottom.`
**5 枚目**（何に時間を）：`Props: three small square paper cards along the RIGHT edge only, with simple line icons: a coffee cup, a ticket, a dumbbell. A notebook corner at the bottom-left.`

うまく空けてくれないときは、「Think of it as a photo of an empty desk; the props are only at the edges」と言い足す。

---

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

---

## 縦型カレンダー風（2026-09-22〜。いまの本命）

1〜2 枚目は 2 ページもの（`gen/gen-wide.png` → `node app/tools/sukuji-wide-gen.mjs`）。
3 枚目以降は 1 枚ずつ。ChatGPT の縦長は 2:3 なので **左右 15% ずつ切る**。中央 70% に収めさせる。
同じ会話で、1〜2 枚目の絵を貼ってから「この続き」で出すと揃う。

並び：3 決まったら、押すだけ（ダイアログ・まっすぐ）／4 いつ空いてる？（空き状況・まっすぐ）／
5 ウィジェット（白い角丸 3 つ、スマホ無し）／6 何に時間を（まとめ・まっすぐ）

共通：
```
Same visual system as the previous image (this is page N of the same App Store set):
flat vector style, background off-white with a faint green tint (#F3F7F1), one soft
sage-green band (#D3E4CF) crossing diagonally, calm and minimal, Japanese app promo style.
Portrait 2:3 canvas. IMPORTANT: the outer 15% on the left and right will be cropped away,
so keep every element (text, phone, stickers) inside the central 70% of the width.
The phone is a white iPhone with a thin light-grey edge and a black pill Dynamic Island.
THE SCREEN IS COMPLETELY BLANK WHITE — no UI, no text, nothing on the screen.
Headline in a bold rounded gothic font, near-black; one key word in deep green (#3E7A4D).
Only sage green, lavender, and soft orange as accents. No people, no hands.
```
3：`Headline top-left: 「決まったら、」「押すだけ。」(押すだけ green). Sub: 「点線が、塗りに変わる」. Phone upright in the center, bottom off canvas. Near the phone's lower edge: a dashed-orange/cream chip, an arrow, and a solid sage chip with a check — both blank.`
　（傾けるのは 1〜2 だけ。3 以降はまっすぐ。「3 枚目斜める必要ある？」→ 無い。ダイアログの文字を読ませる絵なので）
4：`Headline top-left: 「いつ空いてる？」「すぐ答える。」(すぐ答える green). Sub: 「○△× で、空きがひと目」. Phone upright in the center, bottom off canvas. Three small square paper cards: green circle, amber triangle, grey cross.`
5：`Headline top-left: 「ウィジェットで」「表示。」(ウィジェット green). Sub: 「小・中・大、好きな大きさで」. No phone. Three blank white rounded rectangles (small square upper-left, 2:1 wide upper-right, large ~1:1.05 below, centered), soft shadows, slightly tilted, same corner radius.`
6：`Headline top-left: 「何に時間を」「使ったか、見える。」(見える green). Sub: 「バイトも、遊びも、用事も」. Phone upright in the center, bottom off canvas. Tiny line icons in sage: coffee cup, ticket, dumbbell.`
