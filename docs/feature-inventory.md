# LUKKO 機能・ふるまい一覧（SwiftUI 作り直しの照合用）

いまの Web 版（React + Capacitor）がしていることを、1項目ずつ確かめられる形で並べたもの。SwiftUI 版はこの表の全項目を満たしてから出す。

- 対象：`C:\Users\yyuuk\lukko-swiftui\app`（コミット b0ba826 の時点）。`src/` 以下のファイルはファイル名だけで書く（例：`App.jsx:341`）。iOS 側は `ios/App/App/…`、ウィジェットは `ios/App/KimatteruWidget/…`
- 書いてあるのは**コードが実際にしていること**だけ。おかしく見えるふるまいも、直さずにそのまま書いた（直すかどうかは「7. 読んでいて気づいた食い違い」で判断する）
- 月 `m` は**すべて 0 始まり**（1月＝0）。日付のキー `"y-m-d"` も 0 始まりの月
- 触覚の名前：`tapLight`＝Light、`penTick`＝Rigid、`settleSuccess`＝成功の通知、`stampHeavy`＝Heavy（`haptics.js:14-23`）
- 行番号は CRLF のまま数えたもの。コードを直すと行はずれるので、ずれたら関数名で探す
- 正解表（ゴールデンテスト）の手がかり：`tools/eventctx-test.mjs`、`tools/pricetext-test.mjs`、`tools/test-ics.mjs` が既にある。見本データは `demo.js`、`tools/make-demo-backup.mjs`

## 目次

1. データの形
2. 画面ごとの機能
3. 計算と判定のルール
4. 外部とのつながり
5. 文言（どこにあるか）
6. 既知の注意点（コードの「前は…」コメント）
7. 読んでいて気づいた食い違い（要判断）

## 1. データの形

### 1.1 保存の入れ物（本体）
- [ ] 保存するキーは `PERSISTED` の 11 個：events / types / overrides / settings / notices / lastSeenVersion / jobs / supports / trash / someday / gone（`store.js:37`）
- [ ] 保存の形 = `{ savedAt: Date.now(), ...PERSISTED の各キー }`（`store.js:38-42`）。版番号のフィールドは持たない（キー名 `kimatteru.v2` の「v2」が版。予定に y/m を持たせた v2 以前の形は読まない `App.jsx:125`）
- [ ] 置き場は2か所：localStorage キー `kimatteru.v2`（`store.js:19`）と、ファイル `Library/kimatteru-store.json`（UTF-8 JSON、`store.js:20-23`。Library は iCloud バックアップに入る）
- [ ] ファイルはネイティブでだけ書く／読む。ブラウザでは何もしない（`store.js:55-56,84`）
- [ ] saveLocal は書けたかを true/false で返す（失敗を握りつぶさない `store.js:45-52`）
- [ ] 起動時はまず localStorage を同期で読む（最初の描画に間に合わせる `store.js:71-80`, `App.jsx:456-481`）
- [ ] 起動時の読み込みで必ずふるいを通す：events→sanitizeEvents、types→typesOk なら mergeTypes さもなくば既定、overrides/notices はそのまま（無ければ既定）、jobs→sanitizeJobs、supports→sanitizeSupports、trash→sanitizeTrash、someday→sanitizeSomeday、gone→sanitizeGone、lastSeenVersion（無ければ null）（`App.jsx:462-476`）
- [ ] 保存データがある人の settings は `{既定, onboarded:true, ...保存値}`（既存利用者に案内を出さない `App.jsx:468`）
- [ ] 読み込みで例外が出ても起動は止めない（`App.jsx:478-480`）

### 1.2 保存のタイミングと勝ち負け
- [ ] componentDidUpdate で PERSISTED のどれかが参照で変わったときだけ `_persist()`（描き直しのたびには保存しない `App.jsx:5304-5309`）
- [ ] `_persist`：localStorage へ即時書き → 失敗なら `saveFailed:true`（成功で false に戻す）→ ファイル保存を予約（`App.jsx:5842-5848`）
- [ ] saveFailed のとき画面に知らせを出し、押すと 設定 > 控え（setPage 'backup'）へ（`App.jsx:2769-2770`）
- [ ] ファイル保存は 1200ms の debounce（`App.jsx:5852-5855`）
- [ ] 背景に回るとき（visibilitychange hidden / Capacitor `pause`）は待たずに `_flushFile()`（`App.jsx:5082,5084-5089`）
- [ ] `_flushFile`：`_fileOk` が立つまで（起動時の確認が済むまで）ファイルに書かない。続けてウィジェットへ渡す（`App.jsx:5856-5862`）
- [ ] 起動時 `_checkFile`（`App.jsx:5765-5786`）：
  - [ ] ブラウザは即 `_fileOk=true`
  - [ ] ファイルに events が1件以上あり、localStorage が無かった（`_hadLocal` false）かつ現在の events が空 → ファイルを採用し `recovered=件数`（「保存されていた◯件の予定を戻しました」`App.jsx:2772-2774`）
  - [ ] 両方ある：ファイルの savedAt が新しく、かつ [events, jobs, types] の JSON が違う → localStorage 側を `before` 控えに書いてからファイルを採用、トースト「新しいほうの保存から開きました（古いほうは控えに残しました）」4200ms
  - [ ] 最後に `_fileOk=true` → ファイル保存予約 → 自動控え
- [ ] `_adoptSaved`：events が空なら何もしない。events/types/overrides/settings(onboarded:true)/notices/jobs/supports/trash/someday/gone を置き換え（lastSeenVersion は置き換えない）（`App.jsx:5788-5805`）
- [ ] 起動時に `_pruneTrash()`：30日たった trash を捨てる（`App.jsx:5094,5834-5838`）

### 1.3 予定（event）のフィールド
- [ ] `id` 文字列。無い／空なら読み込み時に `uid('x')` を振る（`App.jsx:357`）
- [ ] id の作り方 `uid(prefix)` = prefix + Date.now() の36進 + 乱数5文字（`App.jsx:330`）。接頭辞：新規 `n…-i`（tag+'-'+連番 `App.jsx:2197,2202`）、取り込み `i…-i`（`App.jsx:1652-1654`）、シフト入力 `t…`（`App.jsx:2053`）、棚から置いた中身 `n…`（`App.jsx:1818,2185`）、見本 `demo0…`（`demo.js:70`）、壊れ補修 `x…`
- [ ] `y`（西暦）・`m`（0始まりの月）・`day`（日）：数でなければ・m が 0〜11 外・day が 1〜31 外ならその予定だけ捨てる（`App.jsx:346-347`）
- [ ] `days`：その日から何日続くか。終日のときだけ、2以上のときだけ持つ（`App.jsx:2135-2136`）。読むときは 1〜60 に丸める（`evSpan` `App.jsx:139`）
- [ ] `type`：種類の key
- [ ] `status`：`'mikakutei'`（まだ・点線）/ `'kakutei'`（決まった・塗り）/ `'jisseki'`（働いた記録・✓）/ `'nakunatta'`（無くなった・打ち消し線）（`App.jsx:995-998,1104-1110`）
- [ ] `start` / `end`：`HH:MM`。不正なら start→'09:00'、end→start（`App.jsx:339-340,348-349`）。end<=start は翌日に終わる（`whenlib.js:14-18`）
- [ ] `allDay`：真偽。`00:00〜23:59` の予定は読み込み時に allDay=true にする（`App.jsx:353`）
- [ ] `title`：文字列でなければ '無題'（`App.jsx:358`）。保存時も空なら '無題'（`App.jsx:2155,2202`）
- [ ] `place` / `memo` / `link`：前後の空白を落として空なら持たない（undefined）（`App.jsx:2139-2141`）
- [ ] `secret`：名前を隠す予定。true のときだけ持つ（`App.jsx:2142`）。通知・ウィジェット・書き出しカレンダー・朝晩まとめで「予定あり／予定の時間です／予定」に置き換わる（`notify.js:75,94`, `widgetdata.js:95`, `iphonecal.js:140-142`）
- [ ] `remindMin`：何分前に知らせるか（数のときだけ）。時刻あり：10/30/60…、終日：0=当日の朝（9:00 基準）・1440=前日（`App.jsx:2137`, `notify.js:37,42-45,117`）
- [ ] `jobId`：バイト先 id。種類が baito のときだけ持つ（`App.jsx:2157,2205`）
- [ ] `jobName`：勤務先を消したとき、実績に名前を書き込んで残す（`App.jsx:1527`）
- [ ] `hourly`：実績を記録した時点の時給を書き込む（`App.jsx:1762-1764`, `5050`）。勤務先の時給を変えたら、書き込みの無い実績に旧時給を書く（`App.jsx:1500-1507`）。「数え直す」で外す（`App.jsx:1509-1513`）。勤務先削除時も残す（`App.jsx:1526-1527`）
- [ ] `actualEnd`：実績の実際の終わり（`HH:MM` 以外は捨てる `App.jsx:361`）。実績以外に保存し直すと undefined（`App.jsx:2159`）
- [ ] `breakMin`：休憩分。>0 のときだけ持つ。読むときは最大 600（`App.jsx:788,1764,2055`）
- [ ] `want`：まだのときの希望時刻 `[start,end]`（長さ2の配列以外は捨てる `App.jsx:362`）。新規でまだなら付ける（`App.jsx:2206`）、確定ダイアログは want を初期値にし、確定時に `[origS,origE]` を書く（`App.jsx:1732,1769`）
- [ ] `repId`：くり返しで作った群れの印 `uid('r')`（`App.jsx:2199`）。コピーには持っていかない（`App.jsx:1209`）
- [ ] `candId`：候補日の群れ `uid('k')`。まだ＋候補ON＋複数日のときだけ（`App.jsx:2201`）
- [ ] `movedFrom`：延期元 `{y,m,day}`。最初の元の日を保つ（`App.jsx:1795`）。詳細に「◯月◯日から延期」（`App.jsx:4595`）
- [ ] `noReport`：まとめに入れない（true のときだけ）（`App.jsx:4665-4666,5464`）。まとめの集計から外れる（`App.jsx:3350,3386`）
- [ ] `srcId` / `srcCal`：取り込み元の iPhone 予定 id とカレンダー id（`App.jsx:1657`, `calendarimport.js:120-121`）。.ics は `UID#y-m-d`（`ics.js:210`）
- [ ] `sym`：シフトの型の記号（月表示の帯の頭に出す `App.jsx:1015,2055`）
- [ ] `stampKey`：どの型で置いたか（`jobId:型id or 番号`）（`App.jsx:2028,2055`）
- [ ] `updatedAt`：書き換えのたびに Date.now()（`updateEvent` `App.jsx:1752`、save `2157,2206`、ほか一括変更）。iCloud 同期・控えの「足す」で新しいほうを選ぶ基準
- [ ] sanitizeEvents は上記以外のキーを `...e` でそのまま残す（`App.jsx:355`）
- [ ] 実行時だけの印（保存されない）：`overlay`（重ねて表示の灰色帯 `iphonecal.js:72`）、`ake`（夜勤明けの薄い帯。読む所 `App.jsx:990,1012-1013` はあるが、付ける所は src 内に見つからない）

### 1.4 予定を作る・変える所でのフィールドの扱い
- [ ] openNew の下書き：種類＝前回（`settings.lastType`、隠していれば先頭の見える種類）、時刻＝種類の defStart/defEnd（無ければ 10:00–11:00）、今日なら次の30分区切り（22:00 まで）、時刻つきで開いたらその時刻＋60分、終日＝opts か種類の allDayDefault、remindMin＝設定の remindTimed/remindAllDay、jobId＝辞めていない先頭の勤務先（`App.jsx:1160-1189`）
- [ ] 下書きのキー：editingId,title,type,status,start,end,y,m,day,pickY,pickM,extraDays,jobId,allDay,days,remindMin,place,memo,link,repEvery,repSpan(3),repDows,repNth,added,picking,someday,cand,secret（`App.jsx:1187,4418-4437`）
- [ ] openEdit：実績なら end に actualEnd を入れて直す。入っている項目（place/link/memo）だけ行を出す（`App.jsx:1191-1200`）
- [ ] openCopy：status は まだ→まだ、それ以外→kakutei。actualEnd・repId は持っていかない。日付えらびを開いた状態（`App.jsx:1215-1226`）
- [ ] save（編集）：type/title/y/m/day/start/status/allDay/days/remindMin/place/memo/link/secret/jobId/updatedAt を上書き。実績なら actualEnd=下書きの end、それ以外は end=下書き・actualEnd 消す（`App.jsx:2154-2160`）
- [ ] save（くり返しの1件を編集）：後ろに同じ repId があれば「この予定だけ／これ以降すべて」を聞く。これ以降：変えた項目だけ後ろへ当て、日付を動かしたら同じ日数ずらす（`App.jsx:2150-2178`）
- [ ] save（新規）：本体の日＋extraDays（`"y-m-d"` 文字列）＋くり返しの日を、同じ tag で一括作成（`App.jsx:2192-2207`）
- [ ] save（日にち未定）：棚（someday）に置く（`App.jsx:2182-2191`）
- [ ] 保存後に `settings.lastType` を記録（`App.jsx:2144`）
- [ ] くり返しは規則を持たず、実体を並べる（最大 200 件 `App.jsx:179-181,208`）。単位 day/weekday/week/biweek/month/nth/monthEnd/year、期間は月数（`App.jsx:183-205`）。その月に無い日は置かない（`App.jsx:269`）
- [ ] moveEvent：y/m/day/status/movedFrom を書く（`App.jsx:1790-1799`）
- [ ] toSomeday：予定を events から外し、棚に `ev:{...元, status:'mikakutei'}` で置く。gone に元 id（`App.jsx:1804-1813`）
- [ ] placeSomeday：棚の ev（無ければ新規 `n…`、種類の既定時刻）を status 'mikakutei'・updatedAt 付きで指定日に置く。gone に棚 id（`App.jsx:1815-1823`）
- [ ] dropSomeday：棚から外す。gone に棚 id、ev があれば trash に `{ev, someday:棚item, at}`（`App.jsx:1824-1829`）
- [ ] 取り込み（doImport）：新規は id/type/title/y/m/day/start/end/status/allDay/updatedAt＋（days>1, memo, place, link, srcId, srcCal があるときだけ）。直ったもの：title/日付/時刻/allDay/days/place/memo/link を元に合わせ、種類と状態はこちらのまま。元で消えたもの：trash へ（`App.jsx:1645-1669`）
- [ ] 取り込み前に events があれば `before` 控え（`App.jsx:1651`）。`settings.lastImport={tag,at}`（`App.jsx:1666`）
- [ ] シフト入力（stampDay）：型から type=baito（終日なら off）, title, start/end（終日は 00:00/23:59）, jobId, breakMin, sym, stampKey, want(まだのとき) で作る。同じ型が同じ日にあれば外して trash へ（実績は外さない）。休みの型で off 種類が無ければ足す（`App.jsx:2038-2058`）
- [ ] 種類を消す：その種類の予定を別の種類へ移す（予定は消さない）＋gone に `type:key`（`App.jsx:2098-2105`）
- [ ] 取り込みの整理（tidy）：対象は id が `i` で始まる終日で noReport でないもの。「まとめから外す」= noReport:true、「消す」= trash に入れずに削除（`App.jsx:5447-5474`）

### 1.5 種類（type）
- [ ] 既定の4つ（並び＝チップの並び）：yoji 用事 #8B7AB8 / baito バイト #7FAE85（defStart 17:00, defEnd 22:00）/ asobi 遊び #D2916A / other その他 #8A8A8A。各 paper・dark・uWord・cWord 付き（`App.jsx:527-534`）
- [ ] 足せる3つ（EXTRA_TYPES）：work 仕事 #6E85BE（仮押さえ/確定）、off 休み #5FA8A2（希望休/休み、free:true, allDayDefault:true）、family 家族 #D0A0BC（`App.jsx:56-64`）
- [ ] フィールド：key, name, color, paper（`rgba(白へ.62寄せ,.72)`）, dark（黒へ.5寄せ）, uWord/cWord（まだ／決まった の呼び名）, uLabel/cLabel（作成画面の切替の言葉）, ask（点線を押したときの問い）, gone（無くなったの言い方）, celeb（確定の一言）, free（空き状況で空き扱い）, allDayDefault, defStart/defEnd, hidden（`App.jsx:44-55,38-41,604-605`）
- [ ] 自分で足した種類：key=`uid('c')`、uWord='未確定の'+名前、cWord=名前（`App.jsx:2123-2129`）。名前変更で uWord/cWord も作り直す（c で始まる種類だけ `App.jsx:1744-1749`）
- [ ] 呼び名の手入力は 12 字まで、uWord と uLabel（cWord と cLabel）を同時に書く（`App.jsx:2107-2110`）
- [ ] 色は 12 色のパレット PAL から選ぶ。選ぶと paper/dark も作り直す（`App.jsx:483,1739`）
- [ ] 隠す：hidden=true（予定は残り、カレンダーには出る。選ぶ所には出ない）。最後の1つは隠せない（`App.jsx:541,2088-2096`）
- [ ] 並べ替え：配列の順を入れ替える（`App.jsx:2083-2087`）
- [ ] 種類を引けないときは extraType(key)、それも無ければ先頭の種類（`App.jsx:539`）
- [ ] typesOk：配列・1件以上・全件 key/name/color が文字列。だめなら既定に戻す（`App.jsx:369-371`）
- [ ] mergeTypes：保存側に組み込みの項目を埋め戻す（保存側優先）。色が OLD_DEFAULT_COLORS（yoji #534AB7, baito #1D9E75, asobi #D85A30, other #5A6570）のままなら新しい既定の color/paper/dark に入れ替え。並びは組み込み順、足した種類は後ろに足した順（`App.jsx:401-430`）
- [ ] 使い方（profile）の反映 applyProfile：PROFILES の並びに種類を並べ、無ければ EXTRA から足す。名前は既定名か、どれかの使い方の名前のままなら付け替え。並びに無い種類は hidden（c 始まりは触らない）。settings に profile/weekStart/freeWd/freeHd/workHours/kariMark（work・free で true）（`App.jsx:573-595`）
- [ ] PROFILES：student（学校とバイト・週日曜・空き 9-22/9-22）、work（会社・週月曜・空き 平日19-23/休日10-22・勤務 月〜金 9-18）、shift（シフト勤務：バイト→勤務, off…）、free（フリーランス：baito→副業・週月曜・10-22）、family（子育て：family→子ども・家族・9-21）（`App.jsx:75-93`）

### 1.6 勤務先（job）
- [ ] フィールド：id（`uid('j')`）, name, hourly（数）, retired（true のときだけ）, closeDay（締め日 1〜28/31=月末、0/未設定=なし）, payDay（給料日）, templates（`App.jsx:1494-1495,2336-2338,1517`）
- [ ] sanitizeJobs：id が文字列かつ hourly が有限数のものだけ残す（`App.jsx:377-379`）
- [ ] addJob：名前空・時給=settings.hourly で足して編集を開く（`App.jsx:1492-1496`）。作成画面からの追加は名前空なら「バイト先／勤務先」（`App.jsx:1547-1558`）
- [ ] 時給入力は数字だけ・最大 99999、±10 ボタン（`App.jsx:2330-2332`）
- [ ] patchJob：時給が変わったら、その勤務先の書き込みの無い実績へ旧時給を書く→「数え直す」の案内（rateNote）（`App.jsx:1500-1507`）
- [ ] retireJob：retired の付け外し。一覧・選ぶ所から消え、記録は残る（`App.jsx:1515-1518`）
- [ ] removeJob：勤務先を消す。実績には hourly と jobName を書き込み jobId は残す、実績以外は jobId を外す。gone に `job:id`（`App.jsx:1519-1531`）
- [ ] シフトの型 template：id（`uid('p')`）, sym（2字まで・必須）, name（12字まで）, from/to（分）, brk（休憩分 0/15/30/45/60/90/120）, allDay（`App.jsx:2343,2366-2373`）。消すとき、id の無い型に今の番号を id として持たせてから外す（`App.jsx:2340-2342`）
- [ ] 使い方を変えるとき、学生→社会人でバイト先をまとめて retired にでき、そのとき wageFeature='auto'（`App.jsx:2073-2081`）

### 1.7 設定（settings）の全キー
既定値は `App.jsx:520-522`。それ以外は無ければ undefined。
- [ ] `hourly` 既定 1120：勤務先の無い予定の時給（設定画面からは外した `App.jsx:3216-3217,785`）
- [ ] `weekStart` 既定 0（0=日曜／1=月曜）（`App.jsx:3219`）。ウィジェットにも渡す
- [ ] `remind` 既定 true：シフトの終わりに「記録しますか？」を通知（`notify.js:98`, `settingsview.jsx:242`）
- [ ] `hideCanceled` 既定 false：無くなった予定を月・週・日の表示から隠す（`App.jsx:3669,3823,3884,4025`）
- [ ] `dark` 既定 false：旧ダークモードのスイッチ。`theme` が無いときだけ見る（`App.jsx:619`）
- [ ] `theme`：'auto'（iPhone に合わせる）/'light'/'dark'。選ぶと dark も同期（`App.jsx:2277`）
- [ ] `onboarded` 既定 false：案内を出すか（`App.jsx:2594`）。「使い方をもう一度見る」で false（`App.jsx:2436`）
- [ ] `priorWage` 既定 `{}`：年ごとの使い始める前の額 `{'2026':120000}`。0〜99,999,999、0 ならキーを消す（`App.jsx:808-822`）
- [ ] `profile`：student/work/shift/free/family。無効なら student（`App.jsx:542`）
- [ ] `freeWd` / `freeHd`：空き状況で見る時間 [開始分, 終了分]、既定 [540,1320]。終了>開始のときだけ受け付け（`App.jsx:2284-2287`）
- [ ] `workHours`：いつもの勤務時間 `{days:[0-6], from, to}`（分）。オンで既定 `{days:[1..5], from:540, to:1080}`、null でオフ（`App.jsx:2288-2296`）
- [ ] `kariMark`：月表示のまだの帯の頭に「仮」（`App.jsx:1018,2281`）
- [ ] `barTime`：月表示の帯に開始時刻（`App.jsx:1012,2280`）
- [ ] `fontScale`：undefined=iPhone に合わせる / 1 / 1.12 / 1.25。1〜1.4 に丸める（`App.jsx:2278-2279,5633-5637`）
- [ ] `calView`：'month'（既定）/'week'（`App.jsx:3786,3792`）
- [ ] `dayView`：'list'（既定）/'time'（`App.jsx:4017,4022`）
- [ ] `overlayFree`：重ねて表示の予定も空き状況に数える（`App.jsx:861,2300`）
- [ ] `overlayOn`：iPhone のカレンダーを重ねて表示（`App.jsx:1873-1883`）
- [ ] `overlayIds`：重ねるカレンダー id の配列。最初は購読以外の全部（`App.jsx:1881,2420`）
- [ ] `exportCal` / `exportCalId`：決まった予定を iPhone の「LUKKO」カレンダーへ書く、その id（`App.jsx:1900-1918,1928`）
- [ ] `notifyOff`：全部の通知を止める（`App.jsx:2239`, `notify.js:90`）
- [ ] `morning` / `morningAt`（既定 450＝7:30）：朝のまとめ（`App.jsx:2304-2306`）。案内で選べば morning:true（`App.jsx:1485-1486`）
- [ ] `evening`：前の晩 21:00 に明日のまとめ（`notify.js:148-149`）
- [ ] `weekly`：日曜 20:00 に来週のまだの数（`notify.js:158-159`）
- [ ] `remindTimed`：時刻あり予定の既定お知らせ null/10/30/60（`App.jsx:2309`）
- [ ] `remindAllDay`：終日予定の既定お知らせ null/0/1440（`App.jsx:2310`）
- [ ] `hideTitles`：通知・ウィジェット・書き出しで名前を隠す（`App.jsx:2311`）
- [ ] `wageFeature`：'auto'（既定。勤務先か実績があれば）/'on'/'off'（`App.jsx:2322,2447-2452`）
- [ ] `paidLeave`：`{grant:付与日数(0〜60), start:付く月(0始まり)}`。オンで `{grant:10, start:3}`（`App.jsx:2377-2384`）
- [ ] `lastType`：前回の種類（`App.jsx:2144`）
- [ ] `importCals`：`{カレンダーid:{on, type}}` 取り込みの選び方の記憶（`App.jsx:1601-1602,1619-1622`）
- [ ] `lastImport`：`{tag, at}` 最後の取り込み（取り消し用）。取り消すと null（`App.jsx:1666,2020`）
- [ ] `lastAutoBackup`：自動控えを書いた時刻（`App.jsx:5826`）
- [ ] `lastExportAt`：控えを書き出した時刻（`App.jsx:5388`）
- [ ] `sync` / `deviceId`（`uid('d')`）/ `lastSyncAt`：iCloud 同期（`App.jsx:1946,1960`）
- [ ] `lock`：開くときの Face ID（`App.jsx:2008`）
- [ ] `firstUseAt`：初回起動時刻（無ければ起動時に入れる `App.jsx:5064`）
- [ ] `confirmCount`：点線→塗りにした回数（`App.jsx:1777`）
- [ ] `lastReviewAsk`：評価の小窓を出した時刻（`App.jsx:1999`）
- [ ] `supporterName`：サポーターカードの名前（20字まで `App.jsx:2960`）
- [ ] `hintClosed`：予定0件のときの案内を閉じた（`App.jsx:3866-3867`）
- [ ] settings は iCloud 同期で渡さない（端末ごと `sync.js:283`）

### 1.8 そのほかの保存されるもの
- [ ] `overrides`：空き状況の手動の印 `{ "y-m-d"（m は0始まり）: '○'|'△'|'×' }`。○→△→×で回し、自動判定と同じになったらキーを消す（`App.jsx:442-443,983`）
- [ ] `notices`：`{id, kind:'shift'|'info', eventId?, title, body, at, read}`（`notices.js:5-6,308-316,348`）
  - [ ] shift：id `shift-<予定id>`。終わったのに実績にしていない時刻ありバイト（kakutei）ごと。記録済み・削除済みになったら消す（`notices.js:284,291-319`）
  - [ ] info：id `info-<版>`。lastSeenVersion より新しく現在版以下の RELEASE_NOTES を足す。初回（lastSeenVersion なし）は足さない（`notices.js:285,337-351`）。開いたときは今の文で見せる（`notices.js:278-282`）
  - [ ] 開いた時点で read:true、「すべて既読」あり（`App.jsx:5582-5593`）
  - [ ] 版の比較は数で（`notices.js:326-334`）
- [ ] `lastSeenVersion`：起動時に `__APP_VERSION__` を入れる（`App.jsx:5015-5019`）
- [ ] `supports`：応援の記録 `{id:商品id, yen, at}`。yen と at が数のものだけ残す（`App.jsx:373-375,1335`）。商品は tip300/600/1000（`tipjar.js:25-29`）。合計でカードの段 normal(0)/gold(1000)/black(3000)（`App.jsx:298-328`）
- [ ] `trash`：`{ev, at, someday?}`。30日（TRASH_DAYS）を過ぎたら捨てる、最大 400 件、新しい順（`App.jsx:382-385`）。削除・取り込みで消えたもの・取り込み取消・シフト入力で外したもの・棚から消したもの（`App.jsx:1689,1665,2019,2047,1828`）
  - [ ] 戻す：events へ戻すときは sanitize し updatedAt を今に。someday 付きは棚へ戻す（at を今に）（`App.jsx:1715-1728`）
- [ ] `someday`：`{id:uid('s'), when, title, type, y,m,day（置いた日）, at, ev}`。when は 'week'（今週のどこか）/'month'（今月のどこか）/'next'（来月あたり）/'someday'（いつか）。id・title 文字列・when が正しいものだけ残す（`App.jsx:394-399,1808,2184`）
- [ ] `gone`：消した印 `[[id, 消した時刻], …]`。id は 予定 id（棚へ移したとき）・棚 id・`job:<id>`・`type:<key>`。30日・最大 800 件（`App.jsx:387-392`）

### 1.9 保存の外にある置き場
- [ ] localStorage `lukko.exportMap`：書き出しの対応表 `{予定id: iPhone側id, '#予定id': 書いた中身の署名JSON}`（`App.jsx:1919-1920`, `iphonecal.js:118-166`）
- [ ] localStorage `lukko.backups`：ブラウザ用の控え `[{name, at, text}]` 最大3件（`backup.js:110,134-139`）
- [ ] localStorage `lukko.lastError`：最後のエラー1件 `{at, where, message, stack, version, componentStack?}`（`guard.jsx:12-29,45-50`）
- [ ] sessionStorage・Capacitor Preferences は使っていない
- [ ] UserDefaults.standard `lukko.shield`：切り替え画面でぼかすか（ロックと同じ値を setShield で書く）（`ios/App/App/LukkoNative.swift:40,104-107,137-141`, `App.jsx:2009`）
- [ ] App Group `group.com.kimatteru.app` の UserDefaults、キー `widget` に JSON 文字列（`widgetbridge.js:11-12`, `ios/App/App/WidgetBridge.swift:42-46`, 両 entitlements）。書いたら `WidgetCenter.reloadAllTimelines()`（`WidgetBridge.swift:50-52`）
- [ ] iCloud KVS（NSUbiquitousKeyValueStore、entitlement `ubiquity-kvstore-identifier`）：目次 `lukko.sync.meta` = `{parts, at, device}`、中身 `lukko.sync.0`… に 60000 字ずつ（`sync.js:231-233,267-281`）

### 1.10 控え（バックアップ）
- [ ] 中身の形：`{app:'kimatteru', format:2, appVersion, exportedAt(ISO), data:{PERSISTED 11キー}}`（`App.jsx:5376-5378,5807-5814`）
- [ ] 自動控え：ネイティブは `Library/backups/auto-YYYY-MM-DD.json`（1日1回）、戻す・取り込む前は `before-YYYY-MM-DD-HHMMSS.json`（`backup.js:109,123-128,142-156`）
- [ ] 残す数：毎日のぶん新しい7つ＋月初（-01）のぶん3か月＋before 新しい5つ。それ以外は deleteFile（`backup.js:186-203`）。ブラウザは prune しない
- [ ] 自動控えを取るとき：起動時（_checkFile の後）・戻ってきたとき・予定が変わって5秒後（今日の分が無いとき）。予定0件なら取らない（`App.jsx:5312-5316,5819-5832,5137`）
- [ ] `before` 控え：戻す直前・取り込み直前（予定があるとき）、起動時にファイルを採用する直前（`App.jsx:5534,1651,5778`）
- [ ] 書き出し：`LUKKO-控え-YYYYMMDD.json`（インデント2）を共有シートへ。`lastExportAt` を記録（`App.jsx:5380-5390`）
- [ ] 読み込み：ファイル選択（5MB まで `App.jsx:5399,5489`）・貼り付け・端末内の控え一覧から（`App.jsx:5483-5578`）
- [ ] 検査：JSON でない／app≠'kimatteru'／format>2／data.events が配列でない → それぞれの文言でエラー。件数は sanitize 後で数え、落ちた数 dropped も返す（`App.jsx:5504-5520`）
- [ ] 戻し方2つ：置き換え（events/types(mergeTypes)/jobs/supports/trash/someday/overrides/notices/settings(現在に上書き)/lastSeenVersion。gone は置き換えない）、足りない予定だけ足す（id で混ぜ、同じなら updatedAt が新しいほう）（`App.jsx:5529-5565`）
- [ ] 古い名前（kimatteru-backup-…）の控えも中の印で戻せる（`App.jsx:5386`）

### 1.11 iCloud 同期のデータ
- [ ] 渡すもの `{v:1, events, types, jobs, someday, tomb}`。tomb = trash の [ev.id, at] ＋ gone（`sync.js:284-294`）
- [ ] 混ぜ方：予定は id ごとに updatedAt が新しいほう。こちらに無い予定は、墓標の時刻 >= updatedAt なら入れない。墓標の時刻 >= こちらの updatedAt の予定は消す（こちらの trash にあるものは除く）（`sync.js:300-326`）
- [ ] 種類・勤務先・棚は足りないものを足す（食い違いはこちら優先）。`type:`/`job:`/棚 id の墓標があるものは消し、足さない（`sync.js:327-344`）
- [ ] 変化が無ければ null（`sync.js:345-346`）
- [ ] 900,000 字を超えたら書かない。書いた後、余った切れ端を5つ先まで消す（`sync.js:271,274-275`）
- [ ] 取り込むタイミング：起動 800ms 後・戻ってきたとき・kvsChanged、取り込んだ後に書く（`App.jsx:5067-5068,5138,1949-1964`）
- [ ] 書くタイミング：events/types/jobs/someday/trash が変わって 4000ms 後。同期で入った直後の変化は書き戻さない（`App.jsx:5325-5329`）
- [ ] 取り込み結果の types は typesOk のときだけ採用（mergeTypes は通さない）（`App.jsx:1957`）
- [ ] オンにするとき available（synchronize 成功かつサインイン済み）でなければトーストで止める（`App.jsx:1936-1948`, `LukkoNative.swift:66-71`）

### 1.12 ウィジェットに渡す中身
- [ ] 形 `{v:1, at, weekStart(0|1), from:'YYYY-MM-DD', to, hol:[祝日の日付], days:{'YYYY-MM-DD':[item…]}}`（`widgetdata.js:139-147`）
- [ ] 範囲：前日〜今日+20日、かつ今月の1日〜月末を必ず含む（`widgetdata.js:24-25,83-85`）
- [ ] item：`t` 開始（終日 null）、`e` 終わり（終日 null、0時をまたぐ日は '24:00'、実績は actualEnd）、`n` 名前（24字で切る。隠すなら '予定あり'）、`c` 種類の色（無ければ #8A8A8A）、`s` 1=決まった/実績 0=まだ、`k` 予定 id、`p` 0=1日だけ 1=初日 2=途中 3=最終日（0 のときは付けない）、`x` 1=伏せた、`m` メモの行（6行・各20字まで、伏せたら無し）（`widgetdata.js:27-32,96-115`）
- [ ] 無くなった予定は渡さない。1日8件まで。並び＝終日→時刻→名前（`widgetdata.js:91,121-129`）
- [ ] 日をまたぐ時刻の予定は始まった日だけ（`widgetdata.js:117`）
- [ ] Swift 側は `Item{t,e,n,c,s,m,k,p,x}` と `Payload{weekStart, days, hol}` を decode（`past` は CodingKeys に入れない）（`ios/App/KimatteruWidget/KimatteruWidget.swift:35-60`）。読めなければ loaded:false（`KimatteruWidget.swift:222-240`）
- [ ] 渡すタイミング：ファイル保存と同じ間合い（_flushFile）、戻ってきたとき（強制）、診断の手動送信。events の JSON＋events数/types数/weekStart が前と同じなら送らない。名前を隠す設定を変えたら強制（`App.jsx:5867-5875,5139-5140,1296-1302,2311`）
- [ ] ウィジェットの描き直し予約：今日の予定の終わる時刻ごと＋翌0時、policy `.after(明日)`（`KimatteruWidget.swift:195-219`）。kind `KimatteruWidget`、大きさ small/medium/large と ロック画面 rectangular/circular/inline（`KimatteruWidget.swift:1032-1046`）

### 1.13 通知の id と中身
- [ ] 通知 id は文字列から作る正の整数ハッシュ（31倍、2,000,000,000 で割った余り、0 なら 1）（`notify.js:14-19`）
- [ ] 種類と id の元：worked=`'w'+予定id`（シフトの終わる瞬間、actionType WORKED）、remind=`'r'+予定id`（開始−remindMin、終日は 9:00 基準、まだなら UNDECIDED）、朝=`'m'+日付.toDateString()`、前の晩=`'e'+…`（extra.kind は 'morning'）、週=`'wk'+…`（`notify.js:104,124,144,153,166`）
- [ ] extra：`{eventId, kind:'worked'|'remind'}` / `{kind:'morning', day:'y-m-d'(m 0始まり)}` / `{kind:'weekly'}`
- [ ] ボタン：UNDECIDED= yes「決まった」/no「無くなった」、WORKED= asplanned「予定どおり記録する」/open「開いて直す」（`notify.js:182-191`）
- [ ] 予約は近い順に最大 60 件。毎回、保留中を全部消して貼り直す。出すものがあるときだけ許可を聞く（`notify.js:39,172-173,198-215`）
- [ ] 貼り直しのタイミング：events か notifyOff/remind/morning/morningAt/evening/weekly/hideTitles が変わって 400ms 後、起動時、戻ってきたとき（`App.jsx:5317-5324,5021,5136`）
- [ ] 無くなった予定は通知しない。実績には remind を出さない（`notify.js:96,116`）

### 1.14 App の初期 state（保存しないものも含む）
- [ ] 初期値（`App.jsx:505-536`）：screen 'month', wageOn false, dialog null, detailId null, dayNum null, returnTo 'month', newType null, overrides {}, notif null, editTypeKey null, docKey null, confirmDelete null, imp {phase:'idle', found:[], type:'yoji', error:''}, swipe {dx:0, animating:false}, swipeRow null, notices [], lastSeenVersion null, noticeOpen null, trash [], someday [], gone [], jobs [], editJobId null, newJob null, supports [], ym 今月, freeYM 今月, freeDir 0, today 今日, shareChoices {o1,o2,o3:null}, shareSubmitted false, shareToast false, shareMsg '', morph null, settings（1.7）, onboard {step:0, demo:'dash'}, draft {title:'', type:'yoji', status:'kakutei', start:'10:00', end:'11:00', 今日, allDay:false, picking:null}, types（既定4つ）, events []
- [ ] `state.screen` の値：month / day / detail / new / list / free / report / settings / import / notices / summary / card / share / doc（`App.jsx:1123,1125,1187,2035,2479,2491-2494,2557-2560,2927,3449,3462,5030,1573,5370`）
- [ ] `state.setPage`（設定の中の画面）：support / display / free / notify / wage / iphone / data / help / types / work / jobs / leave / overlay / backup / files。親は work→free, jobs→wage, leave→wage, overlay→iphone, backup→data, files→data（`App.jsx:2234,433`）
- [ ] listTab：upcoming / undecided / search（`App.jsx:3462-3464`）。cardKind：month / year（`App.jsx:2494,3450`）。dayFrom：month / free（`App.jsx:1125,4930`）
- [ ] onboard：step（0 から）, demo（dash→asking→fill→done）, picked, fast, replay, morning（`App.jsx:524,1448-1488,2436,2623`）
- [ ] imp：phase（idle/scanning/cals/found/done）, found[], type, error, denied, cals, range（month/year/back）, source（cal/ics/tidy）, otherOpen, added, updated, removed, withPlace, multi, dashed, tidied（`App.jsx:1585-1669,5439,5456`）
- [ ] 保存しない UI の state（setState で使うもの）：undo{text,data,key}（5秒）, candAsk, repEditAsk, discardAsk, detailMenu, ctxMenu, confirmJob, confirmRestore, deleteRest, typeDelete, tplNew, profileSheet, stamp{key,status}, somedayPick, weekAnchor, flashToday, ymSheet, cardAngle/cardTilt/cardFrom/cardPng, tips, tipBusy, tipThanks, tipOpen, probe, pressed, kbOpen, locked, saveFailed, recovered, backupList/backupListOpen/backupText/backupError/pasteOpen, trashOpen, migrateOpen, showRetired, rateNote, priorOpen, overlayCals, searchQ, listDashOnly, typeListOpen, bulkOpen, askOpen, repTab, shareOpt（空いてる日を送る選び方：range '2w'・only 'all'・polite・name・sign。state にあり保存しない `App.jsx:910`）

## 2. 画面ごとの機能

並び：2-0〜2-13 はカレンダーまわり（まとめ・週・月・日・一覧・いつか・空き状況・遷移・タブ・色）、2-B1〜2-B9 は作成・詳細・確認・取り消し・お祝い、2-S〜2-X は設定・案内・取り込み・規約・カード・お知らせ。開くときのロック画面は 3.23、通知の設定は 2-S6 と 3.19.9。

### 2-0. 共通の部品（view.jsx 先頭）
- [ ] `Fold`：見出しを押すと開閉。▶ が 90° 回る（.2s）。中身は riseUp .22s で出る `view.jsx:31-41`
- [ ] `ImportPic`：取り込みの絵（iPhone のカレンダー「16」→「読むだけ」→ LUKKO の点と点線の輪）。説明文3段落の代わり `view.jsx:6-28`
- [ ] `OtherCal`「Outlook や Yahoo! の予定が出てこないときは」：押すと開閉（`onToggleOther`、tapLight、`imp.otherOpen`）`view.jsx:329-358`, `App.jsx:2869`
  - [ ] 開くと説明文＋番号つき手順（`impOtherSteps`）＋「TimeTree・ジョルテはアプリ内だけ → .ics を設定の『ファイルから取り込む』で」 `view.jsx:338-354`
  - [ ] 設定アプリの特定の場所は開かない（非公開 URL は審査で落ちる）。手順を書くだけ `view.jsx:326-327`

### 2-1. まとめ（Report）
- [ ] 入り方：下のタブ「まとめ」（`onNavReport` → screen='report'）`App.jsx:2492`。iPhone の本物のタブからも同じ（`onTabTap` の report）`App.jsx:4995`
- [ ] 見出し「まとめ」（30px 細字、戻るボタン無し・ルート画面）`view.jsx:80-82`
- [ ] 数える予定：確定と実績だけ。`noReport`（まとめに入れない）は確定でも除く。未確定・無くなったは数えない `App.jsx:3348-3350`
- [ ] 空の状態（`repEmpty`＝数える予定が全期間で0件）：「まだ何もありません。予定を確定すると、何にどれだけ時間を使ったかが、ここに積み上がっていきます。」。月｜年 の切替も出さない `view.jsx:84-87`, `App.jsx:3357`
- [ ] 月｜年 の切替（`repSeg`）：押すと tapLight＋`repTab` 切替。既定は月 `App.jsx:3359-3362`, `view.jsx:90-93`
- [ ] 見ている年月は月表示と同じ `st.ym`（まとめで月を送るとカレンダーの月も変わる）`App.jsx:3347,3363`

#### 月のタブ（ReportMonth）
- [ ] 「‹ 2026年 9月 ›」：`onRepPrevMonth`/`onRepNextMonth` で ym を1か月送る（触感なし）`view.jsx:158`, `App.jsx:3363-3365`
- [ ] その月に確定予定が無い：「この月には、確定した予定がありません。」`view.jsx:160-163`, `App.jsx:3368`
- [ ] 大きな数字（`_spentHead`）：時間があれば「42 時間 30分」、1時間未満は「30 分」、時間0で終日だけなら「2 日」、何も無ければ「0 時間」。下に「N件の予定」`view.jsx:113-124`, `App.jsx:732-740,3369-3370`
- [ ] 種類ごとの内訳（`Kinds`）：色の点・種類名・「N件」・量（「6時間30分」「2日」「6時間・2日」）。多かった順 `view.jsx:46-67`, `App.jsx:695-730`
  - [ ] 下の段（tops）は、その種類の中に名前が2つ以上あるときだけ、上位3件。名前ごとに束ねる（バイトはバイト先名で束ねる）`App.jsx:704-723`
  - [ ] 終日は時間にせず日数で数える。バイトは休憩を引いた実働（`spentHours`→`paidHours`）`App.jsx:690-694`
- [ ] 残業・有給のカード：`repOverMonth`（「予定より延びた時間 X（N回）」バイトと仕事の実績で actualEnd が予定終わりより後）か `repLeave`（有給の残り）があるときだけ `view.jsx:173-178`, `App.jsx:3420-3428`
- [ ] 「給料日ごと」：締め日のある勤務先ごとに「10月25日に入る分」（給料日なし→「10/15締め」）＋「名前・9/16〜10/15・N回」＋金額 `view.jsx:180-195`, `App.jsx:3431-3443`
  - [ ] 締め日31＝月末。給料日31＝その月の末日。給料日が締め日より後なら同じ月、そうでなければ翌月 `App.jsx:3433-3441`
- [ ] 給料ブロックは「その年にバイトの実績がある」ときだけ（`repWageShown`）`view.jsx:197`, `App.jsx:3387`
  - [ ] 「¥ 金額」大、下に「働いた ◯時間・N日」`view.jsx:199-205`
  - [ ] バイト先が2つ以上の月だけ内訳（`JobRows`：色の点・名前・時間・金額）。色はバイトの色の濃淡 `view.jsx:207-211`, `App.jsx:749-775`
  - [ ] 注記「金額は時給から出した目安で、割増や交通費は入っていません。」`view.jsx:213-215`
  - [ ] 「シェア」＋「9月のまとめカード ›」行 → `onOpenMonthCard`（tapLight、screen='summary', cardKind='month', cardFrom='report'）`view.jsx:216`, `App.jsx:3449`

#### 年のタブ（ReportYear）
- [ ] 「‹ 2026年 ›」：`onRepPrevYear`/`onRepNextYear`（月はそのまま、年だけ ±1、触感なし）`view.jsx:227`, `App.jsx:3444-3445`
- [ ] 「月ごとの時間」12本の棒：全種類の時間（働いた時間ではない）。高さは最大月比で最大74px・最低3px。見ている月は墨色＋太字ラベル、時間ありは薄墨、無しは線色。高さ変化 .3s `App.jsx:3373-3383`, `view.jsx:228-241`
  - [ ] 棒を押すとその月へ（ym 設定＋`repTab:'month'`）。下に「押すと、その月へ」`App.jsx:3382`, `view.jsx:240`
- [ ] 「2026年の合計」：`Head`(32px)＋「N件の予定」＋種類の内訳 `view.jsx:243-247`
- [ ] 年の給料（`ReportYearWage`、`repWageShown` のときだけ）`view.jsx:249,255-315`
  - [ ] 行：働いた時間／働いた日数（N日）／稼いだ額「およそ ¥…」（使い始める前の額を足した値）`view.jsx:260-271`, `App.jsx:3401`
  - [ ] バイト先が2つ以上なら内訳行（pad・soft）`view.jsx:273`
  - [ ] 注記「時間は記録したそのものです。金額は…目安…」`view.jsx:277-279`
  - [ ] 前の額があるとき「うち ¥X は使い始める前の分として手で入れた額で、時間と日数には入っていません。」`view.jsx:280-282`, `App.jsx:3404-3406`
  - [ ] 「使い始める前の額」行：押すと開閉（`onTogglePrior`、tapLight）。右に「¥X」か「未設定」、開閉で › / ⌄。説明「2026年の、記録を始める前に稼いだぶん」`view.jsx:288-296`, `App.jsx:3407-3411`
    - [ ] 開くと「2026年のぶん ¥[入力]」：数字のみ・8桁まで（inputMode numeric, maxLength 8）。年ごとに保存（`setPrior(Y,n)`、0 で消す、上限 99,999,999）`view.jsx:297-305`, `App.jsx:3412-3413,808-820`
    - [ ] 注記「上の『稼いだ額』とまとめカードに足します。働いた時間と日数には入りません。」`view.jsx:306-308`
  - [ ] 「2026年のまとめカード ›」→ `onOpenYearCard`（cardKind='year'）`view.jsx:312`, `App.jsx:3450`
- [ ] 計算はするが年タブに出していない値：`repOverYear`, `repYearWageParts`（view で未使用）`App.jsx:3402,3426`

### 2-2. 時刻の目盛り（TimeGrid／週の帯 WeekStrip）共通
- [ ] 1時間 44px（`HOUR_H`）×24、左に時刻（0時は空、1〜23）`App.jsx:1073`, `App.jsx:3828,4028`
- [ ] 終日の段：予定があるときだけ。1日2件まで＋「+N」。押すと `openFor`（day 画面なら戻り先 day、他は month）`view.jsx:382-392`, `App.jsx:1095-1103`
- [ ] 箱：重なりは列に分ける（`layoutColumns`）。高さ最低16px。確定・実績＝塗り、まだ＝点線、無くなった＝取り消し線＋枠、iPhone の予定＝灰色＋左線 `App.jsx:1074-1094`
  - [ ] 箱の高さが 28×倍率 以上なら「10:00–11:00」を出す。実績は actualEnd を終わりに `App.jsx:1089-1091`
  - [ ] 前日から続く部分は題名の頭に「↳ 」`App.jsx:1091`
  - [ ] 箱を押す → `openFor(e, day|month)`。iPhone の予定（overlay）は押しても何もしない `App.jsx:1092`
- [ ] 何もない所を押す → 押した位置を30分単位に丸めた時刻で新規作成（`openNew(d, from, {y,m,start})`）`App.jsx:3842-3843,4032`
- [ ] 今日の列：薄い地（週は常に、TimeGrid は列が2つ以上のときだけ）＋現在時刻の赤線と点（--sun）`view.jsx:401,409-413,600,608-612`

### 2-3. 日付の帯（DayDateStrip、日の画面の上）
- [ ] 前後 42 週ぶん（PADW=42、計 91 日）を横に並べ、1日ずつ止まる（scroll-snap）`view.jsx:429-443,500-503`
- [ ] 各日：曜日（その月の1日は「11月」と太字）・日付（選んだ日＝墨の丸で白字、今日＝墨の輪）・予定がある日に点（選んだ日は点なし）`view.jsx:502-507`, `App.jsx:3941-3948`
  - [ ] 曜日色：祝日・日曜＝赤、土曜＝青、他＝薄墨 `App.jsx:3946-3947`
- [ ] 日を押す → 選んだ日なら何もしない、他は tapLight＋その日へ（`dayDir` で左右から滑り込む）`App.jsx:3948`
- [ ] 流している間だけ：上の真ん中に見えている月（「11月」、今年以外は「2027年11月」）の黒い札、下に幅いっぱいのスクロール位置バー。止めて 900ms で消える `view.jsx:470-477,497-498,511-514`
- [ ] 並べ直し（最初・幅変化・範囲外）で位置を合わせたときはバーを出さない（quiet）`view.jsx:451-459,471-472`
- [ ] 止まった位置が日の区切りから1px以上ずれていたら 180ms 後に合わせ直す `view.jsx:485-491`
- [ ] 選んだ日が見えていなければその週まで滑らかに流す。範囲外ならその週を中心に並べ直す `view.jsx:460-469`

### 2-4. 週表示（WeekStrip）
- [ ] 7列＝1画面、横に指で流す。離すと日の区切りに止まる（scroll-snap、scroll-padding-left 30）`view.jsx:519-567`
- [ ] 上の曜日・日付・終日の段は縦に送っても残る（sticky）。左の時刻は横に流しても残る `view.jsx:569-598`
- [ ] 描くのは基準日の前28日〜後35日（WIN_BACK/WIN_AHEAD）。流し終わって 160ms 後 `onWeekSettle(n)` で weekAnchor＝左端の日、ym＝その4日目の月に更新し描き直す（見た目の位置は維持）`view.jsx:556-563`, `App.jsx:3801-3822`
- [ ] 最初は朝7時あたり、見えている7日にもっと早い予定があればそこから（-12px）`view.jsx:538-541`, `App.jsx:3846-3848`
- [ ] 初期位置：weekAnchor があればそこ、今月なら今日の週、他の月はその月1日の週 `App.jsx:3801-3802`
- [ ] 見出しの月：見えている7日に今日があれば今日の月、無ければ4日目の月 `App.jsx:3806-3808`
- [ ] ‹ › ：tapLight＋7日ぶん smooth で流す（要素が無ければ weekAnchor を ±7）`App.jsx:3811-3817`
- [ ] 「今日」ボタン：見えている7日に今日が無いときだけ。押すと今日の週・今月・今日のマスを光らせる `App.jsx:3809-3810`
- [ ] 列見出し（曜日・日付）を押すとその日の画面へ（ym をその月にしてから `openDay`）`App.jsx:3838`
- [ ] 今日の日付は曜日色の丸で白抜き `App.jsx:3836`

### 2-5. 月表示（MONTH）

#### 見出し
- [ ] 「‹ ［10月 2026］ ›」：‹ › は `onPrevMonth`/`onNextMonth`（ym ±1、dayNum 解除、触感なし）`view.jsx:639-645`, `App.jsx:2468-2469`
- [ ] 月名を押す → 年月えらび（`onTapMonthHead`、tapLight、開いていれば閉じる）`view.jsx:641`, `App.jsx:2473`
- [ ] 幅に合わせて見出しを3段階に詰める（矢印・字の大きさ・アイコン幅・余白）。年は一番広い形では常に、詰めた形では今年以外のときだけ出す。折り返し禁止 `App.jsx:4971-4987`
- [ ] 「今日」ボタン：今月以外を見ているときだけ（出るとき capRise .2s）。押すと `goToday`：tapLight・今月へ・weekAnchor 解除・今日のマスを光らせる（todayFlash 1.2s、1.5秒以内）`view.jsx:649-651`, `App.jsx:1127-1131,3638-3639,3747-3748`
- [ ] 虫めがね → `onOpenSearch`（tapLight、list の「探す」、戻り先 month）`view.jsx:652`, `App.jsx:3464`
- [ ] 一覧アイコン → `onOpenAgenda`（list の「これから」）`view.jsx:658`, `App.jsx:3462`
- [ ] ベル → `openNotices`（tapLight、screen='notices'）。未読があれば緑の数字バッジ、10以上は「9+」`view.jsx:664-671`, `App.jsx:2487,3161-3162,5368-5371`

#### 見出しの下の段
- [ ] 月｜週 の切替（`viewSeg`）：tapLight、`settings.calView` に保存（次回も維持）、weekAnchor 解除 `view.jsx:679-681`, `App.jsx:3786-3793`
- [ ] 「まだ N ›」点線の札：これからの未確定（終わりが今日以降）＋日にち未定の数が1以上のとき。→ list の「まだ」`view.jsx:682-686`, `App.jsx:3461,3463`
- [ ] 日にち未定の棚の札：見ている月にかかる未定の予定があるとき。1件なら「今月のどこか：題名」、複数は「日にち未定 N件」。→ list の「まだ」`view.jsx:687-691`, `App.jsx:3547-3556`
  - [ ] 「いつか」は今月を見ているときだけ。「来月あたり」は登録月の翌月に出す `App.jsx:3549-3553`
- [ ] 「シフト入力」札：シフトの型（辞めていない勤務先の templates）が1つ以上あり、月の画面のとき。オンで黒地 `view.jsx:693-695`, `App.jsx:3621-3622,2026-2030`
- [ ] 「給料」スイッチ：`wageFeatureOn()`（設定 on／off／auto＝辞めていない勤務先かバイト実績がある）のときだけ。押すと `wageOn` 反転（触感なし）`view.jsx:696-701`, `App.jsx:2447-2452,2470,3619`

#### マス（月のグリッド）
- [ ] 曜日の見出し：週のはじまり設定で回す。日曜赤・土曜青・他灰色。下に線 `view.jsx:715-719`, `App.jsx:3643-3646`
- [ ] 週ごとの行。週の区切りだけ線、マスの縦線はもっと薄い色（帯が覆うと「続いている」に見える）`App.jsx:3706-3711,3766-3775`
- [ ] 前後の月のマス：面を敷かず日付だけ薄く。押しても何もしない `App.jsx:3713-3721`
- [ ] 日付の色：祝日・日曜＝赤、土曜＝青、他＝墨。今日は曜日色の丸で白抜き＋マスの地を薄く色付け `App.jsx:3723-3753`
- [ ] マスのどこを押してもその日の画面（`openDay`）。帯自体はタップを受けない（pointerEvents none）。開くのは押したマスの月の日（ym をそのマスの月にしてから）`App.jsx:3699-3703,3757`
- [ ] シフト入力中はマスを押すと `stampDay`（日の画面は開かない）`App.jsx:3754-3757`
- [ ] 帯（bars）：日をまたぐ予定は1本の帯。長い予定から段を決め、同じ段に居続ける `App.jsx:3685-3704`
  - [ ] 1週の段数は画面の高さから計算（2〜7段）。測れないときは4段。入らない予定は日ごとに「+N件」`App.jsx:3659-3666,3695,3761-3764`
  - [ ] 帯の高さ 15px・字 10px ×予定の文字倍率（evScale）`App.jsx:171-172,1055`
  - [ ] 帯の端：続きがある側は角を落とし枠線も消す（隣の週・月へ地続きに見える）。端は 1px 空ける、角丸3 `App.jsx:1025-1047`
  - [ ] 「無くなった」を隠す設定（hideCanceled）なら出さない `App.jsx:3669`
  - [ ] iPhone のカレンダーを重ねる設定（overlayOn）なら灰色の帯で混ぜる `App.jsx:3675,1894-1898,988`
  - [ ] 夜勤の「明け」は月のマスには出さない（始まった日に1本だけ）`App.jsx:3671-3673`
- [ ] 帯の見た目（`pillStyle`/`pillParts`）`App.jsx:986-1021`
  - [ ] 確定＝塗り（softFill＋inkOn）、まだ＝点線枠1.5px＋薄い紙（暗い時は地なし）、実績＝塗り＋不透明度.92、無くなった＝透明・灰字・取り消し線・.5 `App.jsx:995-998`
  - [ ] 月のマスでは「？」を付けない。設定 kariMark で点線の頭に「仮」。実績は「✓」。給料オン中のバイト実績は題名の代わりに「¥金額」`App.jsx:1009-1020`
  - [ ] シフトの型で置いた予定は記号（日・夜・休）を頭に `App.jsx:1014-1015`
  - [ ] 設定 barTime なら「10 定例」「10:30 定例」のように開始時刻を添える（終日・明けは除く）`App.jsx:1011-1012`
  - [ ] 色・背景・枠の切替は .28s で変わる `App.jsx:994`
- [ ] 確定したときの帯の動き（morph）：小窓で確定 → 予定の月の月表示へ → 点線（dash）→150ms で左から右へ塗り（sweepFill .3s、penTick）→470ms で少し膨らむ（pillSettle .2s、settleSuccess）→ その後に確定を保存 `App.jsx:1058-1071,1766-1777`

#### 月の横スワイプ
- [ ] 前・今・次の3か月を横に並べ、指についてくる（描き直さず transform を直接動かす）`view.jsx:731-761`, `App.jsx:1139-1144,2508-2525`
- [ ] 最初の 6px で縦か横かを決める（横＝|dx|>|dy|×1.2）`App.jsx:2512-2515`
- [ ] 幅を越えて引くと重くなる（0.3倍）`App.jsx:2517-2519`
- [ ] 離したとき |dx| > min(72px, 幅22%) なら隣の月へ .3s で滑り、滑り終わって（300ms）月を差し替え。足りなければ戻る `App.jsx:2526-2541,1149-1156`
- [ ] 滑り終わる前に次を払っても、前の1回ぶんを先に確定（払った回数ぶん動く）`App.jsx:2499-2501`
- [ ] 触り始めに日付が変わっていないか確かめる（`_checkToday`）`App.jsx:2502,5104-5108`
- [ ] タッチが取り消されたら月は変えず元へ滑らせる `App.jsx:2542-2555`
- [ ] 描き直しのあと、指が離れていれば帯の位置を必ず state に戻す `App.jsx:5296-5303`
- [ ] 月の高さを測り、6px 以上変わったら描き直して段数を決め直す `App.jsx:3855-3856`
- [ ] 下の余白：シフト入力中 ナビ上端+134、給料オン ナビ上端+66、他 +2（最終週が隠れない）`App.jsx:3861`

#### はじめての案内（予定0件）
- [ ] 予定が0件で、まだ ✕ で閉じていないときだけ浮かせて出す（riseUp .4s、.2s 遅れ）`view.jsx:770-787`, `App.jsx:3866`
- [ ] 塗りと点線の見本＋「決まっている予定は塗り、まだ分からない予定は点線で並びます。」「下の ＋ から、最初の予定を置いてみてください」`view.jsx:773-780`
- [ ] 取り込みが使えるとき「iPhone のカレンダーから取り込む」→ `openImport` `view.jsx:781-785`, `App.jsx:2785-2786,1573`
- [ ] ✕：tapLight、`hintClosed` を保存。予定を全部消して0件に戻っても二度と出さない `view.jsx:772`, `App.jsx:3862-3867`

#### シフト入力（スタンプ）
- [ ] 札を押す `toggleStamp`：tapLight。型があれば最初の型・「決まってる」でオン、もう一度でオフ。型が無ければ 設定→勤務先 へ移り「設定の勤務先から『シフトの型』を足すと使えます」(3.2秒) `App.jsx:2031-2037`
- [ ] パレット（下に浮く、riseUp .26s）：型の札（「記号 名前」＋「10:00–15:00」か「休み」）を横に並べ、押すと選ぶ（tapLight）`view.jsx:790-799`, `App.jsx:3626-3630`
- [ ] 「決まってる｜希望（点線）」切替（tapLight）`view.jsx:801-803`, `App.jsx:3631-3633`
- [ ] 「おわる」→ `toggleStamp` でオフ `view.jsx:804`
- [ ] 「10月の希望をまとめて確定」→ `confirmMonthShifts`：その月のバイト・休みの未確定を全部確定、stampHeavy、取り消しの帯「10月の希望N件を確定にしました」。無ければ「この月の希望は、もう全部決まっています」`view.jsx:806`, `App.jsx:3634-3635,2060-2069`
- [ ] マスを押す `stampDay`：tapLight。同じ型がその日にあれば外す（実績は外さず「働いた記録は、シフト入力では外せません」）→ 最近消した予定へ＋取り消しの帯「10/5の「…」を外しました」`App.jsx:2038-2051`
  - [ ] 置く予定：終日の型＝「休み」種類（無ければ種類を足す）、他＝バイト。題名は型名→休み/勤務先名/勤務。休憩・記号・stampKey を持つ。希望なら want に時刻 `App.jsx:2052-2058`
- [ ] シフト入力中は給料バーを出さない `view.jsx:810`

#### 給料バー
- [ ] 給料オンかつシフト入力でないとき下に浮く（riseUp .3s）：「10月の実績合計 ¥金額 ›」（その月の実績の給料）。押すと `onOpenSummary`（まとめカード、cardKind='month'、戻り先は今の画面）`view.jsx:810-821`, `App.jsx:2494,3868-3870`

#### 年月えらび（月表示）
- [ ] 暗い幕の上の小窓（dlgIn .28s）。幕を押すと閉じる（`onYmSheetClose`）`view.jsx:1730-1732`, `App.jsx:3236`
- [ ] 「‹ 2026 ›」：tapLight＋年 ±1、月の並びが送った向きから滑り込む（.24s）`view.jsx:1733-1737`, `App.jsx:3237-3239,3257-3261`
- [ ] 月の並びを横に払っても年が変わる：8px で方向決め、離して |dx|≥60 で tapLight＋年送り `view.jsx:1738-1745`, `App.jsx:3240-3256`
- [ ] 12か月（4列）：見ている月は墨地白字、今月は薄墨の枠。押すと tapLight＋その年月へ・閉じる `App.jsx:3265-3275`
- [ ] 下の「今月（2026年10月）」：tapLight＋今月へ・閉じる `view.jsx:1750`, `App.jsx:3262-3264`

### 2-6. 日の画面（DAY）
- [ ] 入り方：月のマス・週の列見出し（`openDay`、戻り先 month、`dayFrom:'month'`）／空き状況の日付（`dayFrom:'free'`）`App.jsx:1125,3838,4930`
- [ ] 見出し：「←」（`onDayBack`：dayFrom が free なら空き状況、他は月表示へ）・「10月5日」（祝日・日曜赤、土曜青）・「日曜日」・祝日名（赤）・一覧｜時間 `view.jsx:829-839`, `App.jsx:2478,3931-3934`
- [ ] 一覧｜時間：tapLight、`settings.dayView` に保存 `App.jsx:4016-4022`
- [ ] 日を送ったときだけ中身が左右から滑り込む（.22s）。画面に入るときの動きは画面遷移側 `App.jsx:4013-4015`
- [ ] ‹ › の前日／翌日（`onDayPrev`/`onDayNext`、tapLight）は値はあるが view に置かれていない。日の送りは日付の帯で行う `App.jsx:4009-4012`

#### 一覧モード
- [ ] 上に「予定 N件・まだ N件」（まだが0なら省略）`view.jsx:847`, `App.jsx:3935-3936`
- [ ] 空：カレンダーの絵＋「この日の予定はまだありません」`view.jsx:848-853`
- [ ] 並び：終日が先 → 長い予定 → その日始まりでないもの → 開始時刻。その日を覆う予定すべて（hideCanceled なら無くなったを隠す）`App.jsx:3884-3885`
- [ ] 行：左に開始／終了の2段（終日は「終日」＋複数日は期間、前日から続くものは「〜」）、種類の色の縦棒（まだは点線の棒）、題名、長さ＋場所（リンクだけなら「Web会議」）、右に状態の札（まだ＝点線札、無くなった＝灰、他＝塗り）`view.jsx:875-895`, `App.jsx:3896-3963`
  - [ ] 状態の言葉（`statusWord`）：まだ＝種類の uWord、実績＝「実績」、無くなった＝種類の gone か「無くなった」、確定＝cWord `App.jsx:1104-1110`
  - [ ] 無くなったは題名が薄く取り消し線、棒は線色 `App.jsx:3905-3907`
  - [ ] まだの行は枠全体が点線 `App.jsx:3981`
- [ ] 予定と予定の間が1時間以上空いていれば、行の前に「14:00〜16:00 空き」（その日始まりの時刻ありの予定だけで計算）`view.jsx:856`, `App.jsx:4036-4042`
- [ ] 行を押す → `openFor(ev,'day')`。左に開いている行があるときは、押しても開かずまず閉じる `App.jsx:3911-3912`
  - [ ] `openFor`：まだの予定で今日以前の日なら「どうなった？」の小窓、先の日付なら詳細を開く。無くなったも詳細を開ける `App.jsx:1113-1124`
- [ ] 左スワイプで削除：削除ボタン幅 84px（赤 #B4453A）を行の下に敷き、本文をずらす `App.jsx:1343-1376,3918-3927`
  - [ ] 6px で縦横判定（横＝|dx|>|dy|×1.2）。右には開かない。84px を越えると重く（0.25倍）`App.jsx:1355-1365`
  - [ ] 離して半分（42px）を越えていれば開く、でなければ閉じる（.22s）。取り消し時も同じ `App.jsx:1368-1375,3916-3917`
  - [ ] 開くのは一度に1行だけ（swipeRow は1つ）`App.jsx:1344-1345`
  - [ ] 赤は動いているときだけ見せる（角のすき間から赤がのぞかないよう）`App.jsx:3964-3966`
  - [ ] ゴミ箱を押す → tapLight＋`askDelete`（削除の確認。iPhone では本物の確認画面）`App.jsx:3922,1227,5900-5906`
- [ ] 長押し（450ms、8px 以上動いたら取り消し）→ stampHeavy＋メニュー。開いていたスワイプは閉じる。長押し後 600ms 以内の click は無視 `App.jsx:3968-3979`
- [ ] iPhone のカレンダーの予定（重ね表示）：薄い行＋右に「iPhone」。押すと「iPhone のカレンダーの予定です。直すのは元のアプリで」のお知らせ `view.jsx:901-911`, `App.jsx:4005-4008`
- [ ] 「＋ 予定を追加」→ `openNew(d,'day')`。その下に小さく「時間を決めずに入れる」→ `openNew(d,'day',{allDay:true})` `view.jsx:912-916`, `App.jsx:3985,4004`

#### 時間モード
- [ ] TimeGrid 1列（左の時刻幅40）。今日なら現在時刻の線 `view.jsx:841-844`, `App.jsx:4023-4035`
- [ ] 最初は 8時か、その日いちばん早い予定から（-12px）。日が変わったときだけ合わせ直す `App.jsx:4033-4034`
- [ ] 空いた所を押す → その時刻（30分単位）から新規 `App.jsx:4032`

#### 長押しメニュー
- [ ] 後ろはぼかし＋暗く（scrimIn .2s）。押した予定の札（色の線・題名・時刻）が浮き（menuIn）、その下（足りなければ上）にすりガラスのメニュー `view.jsx:922-948`, `App.jsx:3986-3995`
- [ ] 項目：開く（詳細を開くのと同じ）／編集（`openEdit(ev,'day')`）／削除（赤、`askDelete`）。押すと先に閉じる `App.jsx:3998-4002`
- [ ] 幕を押すと閉じる `view.jsx:925`

### 2-7. これから・まだ・探す（list）
- [ ] 入り方：月の見出しの一覧アイコン（これから）・虫めがね（探す）・「まだ N」札と未定の棚の札（まだ）。どれも tapLight `App.jsx:3462-3464,3556`
- [ ] 見出し「← 予定の一覧」。← は月表示へ `view.jsx:953-957`, `App.jsx:3471`
- [ ] これから｜まだ｜探す の切替（tapLight）。まだがあれば「まだ N」と数を出す `App.jsx:3469-3470`
- [ ] 行：日付「10/5」＋曜日、時刻（終日／複数日は期間／実績は実際の終わり）、題名の札（まだは点線、他は塗り）、場所。押すと `openFor(e,'list')` `view.jsx:995-1004`, `App.jsx:3473-3488`
- [ ] まだの行だけ「決まった」（確定の小窓、戻り先 list）と「流れた」等（tapLight＋無くなったにして取り消しの帯「『…』を流れたにしました」）。ボタンを押しても行は開かない（stop）`view.jsx:1005-1010`, `App.jsx:3485-3487`
- [ ] 見出し：過ぎた日／今日／明日／今週／来週／それ以降は「11月」（今年以外は「2027年11月」）。週は週のはじまり設定に従う。前から続いて今日にかかるものは「今日」に `App.jsx:3490-3496`
- [ ] これから：終わりが今日以降の生きている予定、150件まで。「点線（まだ）だけ」の札で絞る（tapLight、黒地で選択）。空「この先の予定はまだありません」`view.jsx:966-970`, `App.jsx:3497-3503`
- [ ] まだ：上に「日にちが、まだ決まっていない」の棚（各行に「日を決める」「消す」）→「日が過ぎて、まだ点線のまま」（新しい順30件）→ これからの未確定。空「まだ決まっていない予定はありません」`view.jsx:973-990`, `App.jsx:3504-3512`
  - [ ] 「日を決める」→ tapLight＋日を決める小窓（今月から）`App.jsx:3511`
  - [ ] 「消す」→ `dropSomeday`：tapLight、棚から外す。元の予定があれば最近消した予定へ `App.jsx:3512,1824-1828`
- [ ] 探す：入力欄（自動でフォーカス、「題名・場所・メモで探す」、検索キー）。題名・場所・メモを大文字小文字を区別せず部分一致。無くなったも含む `view.jsx:962-965`, `App.jsx:3513-3518`
  - [ ] 結果「これから N件」（近い順）と「過去 N件」（新しい順）、各100件まで。空欄時「題名・場所・メモから探せます」、0件「見つかりませんでした」`App.jsx:3519-3524`

### 2-8. 日にち未定の予定に日を決める
- [ ] 暗い幕の小窓（dlgIn）。題「『題名』の日を決める」、「‹ 2026年10月 ›」で月送り（触感なし）`view.jsx:1024-1033`, `App.jsx:3530-3536`
- [ ] 曜日（週のはじまり設定、日曜赤・土曜青）、日付（祝日・日曜赤、土曜青）。ほかの予定がある日は灰色の地 `App.jsx:3537-3545`
- [ ] 日を押す → `placeSomeday`：tapLight、点線（未確定）で置き、棚から外し、その月を見る。お知らせ「10月5日に置きました」`App.jsx:3542,1815-1823`
- [ ] 注記「灰色の日は、ほかの予定が入っています。点線で置きます」、「やめる」と幕で閉じる `view.jsx:1040-1041`

### 2-9. いつ空いてる？（空き状況）
- [ ] 入り方：下のタブ「空き状況」（`onNavFree`）`App.jsx:2491`
- [ ] 見出し「いつ空いてる？」、右に「シェア」→ `onOpenShare`（tapLight、share 画面、戻り先＝今の画面）。左は空（戻るなし）`view.jsx:1051-1055`, `App.jsx:2557`
- [ ] 「◀ 10月 ▶」：`shiftFree`（tapLight、送った向きから一覧が滑り込む .26s）`view.jsx:1056-1061`, `App.jsx:1133-1137,4939-4943`
- [ ] 右に「○N △N ×N」の数（手で直した印を含む）`view.jsx:1062-1066`, `App.jsx:4909`
- [ ] 一覧を横に払っても月送り：8px で方向決め、離して |dx|≥60（指にはついてこない）`App.jsx:2564-2589`
- [ ] 予定0件（はじめての案内中を除く）：「まだ予定がありません」＋説明、取り込めれば「iPhone のカレンダーから取り込む」`view.jsx:1076-1089`, `App.jsx:2780-2782`
- [ ] 1日1行：左に曜日と日（日曜・祝日赤、土曜青、○の日はふつうの日付を薄く）、祝日名。押すと tapLight＋その日の画面（戻りは空き状況）`view.jsx:1090-1096`, `App.jsx:4922-4931`
- [ ] 中央：その日の予定を2件まで（札＋時刻）と一言 `view.jsx:1097-1107`, `App.jsx:4932-4934`
  - [ ] 一言：△（自動）なら「19:00以降なら空いてます」等、○でも見る時間を絞っていれば「19:00以降」`App.jsx:4919-4921`
- [ ] 右の印：○緑／△橙／×薄灰。△は 調整できる（点線の輪）・一部空き（薄い地）・手動 の3種。×の行は .5 に薄く `App.jsx:4911-4918,4926`
- [ ] 印を押す → `cycleMark`：○→△→×→○ と回す。自動の判定と同じになったら手動を消す。手動の印は輪の影で示す（触感なし）`App.jsx:983,4918,4935`
- [ ] 判定（`dayFree`）：見る時間（平日 freeWd／休日 freeHd、既定 9:00–22:00）内で1時間以上空きがあるか。確定の終日・iPhone の終日→×。いつもの勤務時間は平日かつ休みの予定が無い日だけふさぐ。夜勤の翌朝も含む。未確定だけ→△「まだ候補なので調整できます」（バイトは「まだ希望を出しただけです」）`App.jsx:853-891`

### 2-10. 空いてる日をシェア（share 画面）
- [ ] 暗い地。見出し「閉じる」（`onShareClose`：cardFrom の画面へ、無ければ設定）・「空いてる日をシェア」`view.jsx:1963-1969`, `App.jsx:2558`
- [ ] 見本カード（固定色、テーマに従わない）：先頭の札（名前ありで「山田の空いてる日」／無しで「わたしの空いてる日」、ていねいは「…の空き状況」）、題「10月のあいてる日」（ていねい「10月の空き状況」）、「予定の中身は出していません」`view.jsx:1971-1980`, `App.jsx:912-917`
- [ ] 月は空き状況で見ている月（freeYM）。判定も空き状況と同じ（手で直した印も入る）`App.jsx:3587-3594`
- [ ] マス：空いてる（実線枠）／時間による（点線枠＋「19時〜」）／予定あり（灰）／過ぎた日（ごく薄く）。○でも見る時間を絞っていれば「時間による」扱い `App.jsx:3599-3603,922-938`
- [ ] 凡例3つ（ふつう：空いてる・時間による・予定あり／ていねい：終日可・時間によって可・予定あり）＋注記「埋まっている日は灰色のマスだけ。何の予定かは相手に伝わりません。」`view.jsx:1989-2005`
- [ ] 範囲の札：今週／来週／2週間（既定）／10月。平日休日：すべて／平日だけ／休日だけ。言い回し：ふつう／ていねい（既定は学生以外ていねい）。押すと tapLight＋保存 `view.jsx:2009-2014`, `App.jsx:3604-3610,910`
- [ ] 名前の入力（16字まで、「名前を入れる（例：山田）」）`view.jsx:2015-2016`, `App.jsx:3611-3612`
- [ ] 送る文の見本（`freeTextBlock`）：「10/3（金）19時以降」「終日」など1日1行。ていねいは「・」付き、前後に一言。空なら「この期間は空いてる日がありません」（ていねい版あり）`view.jsx:2017`, `App.jsx:892-909,940-962`
- [ ] 「画像の下に『LUKKO で作成』の一言を入れる」チェック（tapLight）`view.jsx:2018-2021`, `App.jsx:3615-3616`
- [ ] 「文字でコピー」→ tapLight＋コピー、結果をお知らせ、レビュー依頼の機会 `view.jsx:2025`, `App.jsx:3614`
- [ ] 「画像で送る」→ `_shareCard('free')`：tapLight、PNG（`LUKKO-空いてる日-2026-10.png`）を共有シートへ。署名オンなら一言を足す。失敗時「画像を作れませんでした」。レビュー依頼の機会 `view.jsx:2026-2032`, `App.jsx:2556,5716-5754`
- [ ] お知らせはこの画面の中に出す（`shareToast`）`view.jsx:2034-2036`, `App.jsx:3566`

### 2-11. 画面遷移と端からの戻り
- [ ] ルート画面＝month／free／report／settings。ルートへの移動は動かさない（履歴を捨てる）`App.jsx:5154-5167`
- [ ] 進む（push）：新画面が右から（460ms、cubic-bezier(.32,.72,0,1)、左に影）、前の画面は左へ30%、薄い黒幕 0→.1 `App.jsx:5223-5239`
- [ ] 戻る（pop）：その逆 `App.jsx:5235-5239`
- [ ] 新しい予定：下からカード（480ms）、後ろを .28 暗く残す。閉じると下へ（420ms）。カードの形（上のすき間・角丸38）`App.jsx:5197-5222`
- [ ] 暗くするのは黒幕を重ねる（filter はすりガラスが白くなるので使わない）`App.jsx:5185-5189`
- [ ] 前の画面の写し（スクロール位置ごと）を取り、進んだときの写しは5枚まで取っておく（端から戻るときに下へ敷く）`App.jsx:5156-5181,5246-5247`
- [ ] 動いている間（_navBusy）は端からの戻りを受けない `App.jsx:4957`
- [ ] 左端から戻る：画面左 22px 以内で触り始め、8px 右へ動いたら指についてくる。縦に 12px 以上で縦優先なら取り消し `App.jsx:4957-4963`
  - [ ] 下の写しは -30%→0、幕 .1→0 を指の量に比例 `App.jsx:5264-5266`
  - [ ] 離したとき 幅の1/3 を越えるか速さ>0.5px/ms なら戻る（240ms）、足りなければ元へ（260ms）。戻ったら tapLight `App.jsx:4964-4967,5267-5288`
  - [ ] 指につけていない場合（新しい予定の画面）は dx>70 かつ |dy|<70 で戻る `App.jsx:4955-4956,4968`
  - [ ] 戻り先：day→onDayBack、detail、new、list、notices、import、doc、card、summary、share、設定の下の階層→親の階層 `App.jsx:4948-4950`
  - [ ] 覆いが出ているとき（長押しメニュー・小窓・削除確認・年月えらび・日を決める 等）は効かない `App.jsx:4951-4952`

### 2-12. 下のタブ（TAB BAR）
- [ ] 4つのタブを1枚の板に（カレンダー／空き状況（○△×の字）／まとめ／設定）、右に離した丸い「＋」`view.jsx:2674-2711`
- [ ] 選んでいるタブは板の中に明るい丸い面（--tab-sel）。色 .2s・地 .25s `App.jsx:3205-3211`
- [ ] 出す画面：month・free・report・settings（控えの貼りつけ中を除く）。キーボードが出ている間と、サポートのお礼の小窓の間は隠す `App.jsx:2481-2486`
- [ ] カレンダー：月表示中にもう一度押すと `goToday`（今日の月へ、今日を光らせる）。他の画面からは月表示へ（dayNum・detailId 解除）`App.jsx:2489-2490`
- [ ] 空き状況・まとめ：画面を切り替えるだけ（再タップで何もしない）`App.jsx:2491-2492`
- [ ] 設定：設定のスクロールを先頭へ・下の階層を閉じてトップへ・投げ銭の値段を読み込み `App.jsx:2493`
- [ ] ＋：今月を見ていれば今日、別の月ならその月の1日で新規（戻り先 month）`App.jsx:2474-2475`
- [ ] タブ自体の切替は画面遷移の動きを付けない `App.jsx:5151,5166`
- [ ] iPhone のアプリでは本物のタブ（LukkoTabBar プラグイン）を使い、Web のタブは描かない。押されたら同じ処理（month/free/report/settings/add）`tabbar.js:1-21`, `App.jsx:4995,5882`
  - [ ] 本物のタブに渡すのは 出す/隠す・選んでいるタブ・暗い表示か。変わったときだけ送る `App.jsx:5927-5938`
  - [ ] 全面の覆い（inset 0 で z-index 80 以上）が出ている間は本物のタブを隠す `App.jsx:5930-5931`
  - [ ] タブにバッジは無い（お知らせの数は月の見出しのベルに出す）`tabbar.js:11-15`, `view.jsx:669-671`

### 2-13. 色・暗い表示・字の大きさ
- [ ] 表示のテーマ：settings.theme（auto＝iPhone に合わせる／light／dark）。theme が無い古い人は settings.dark に従う `App.jsx:615-622`
- [ ] iPhone の暗い表示の変化を監視して描き直す `App.jsx:5638-5644`
- [ ] html 要素の data-theme とステータスバーの色を暗さに合わせる（変わったときだけ）`App.jsx:5596-5602`
- [ ] 塗り：明るい時は白へ 32% 寄せ、暗い時は地 #12151A に 76% 混ぜる（色は24%）`App.jsx:33-35,624-628`
- [ ] 枠：明るい時は白へ16%、暗い時は色そのもの `App.jsx:629-634`
- [ ] 点線の紙：白へ62%寄せ＋.72 透け。暗い時は敷かない（透明）`App.jsx:598-605,640`
- [ ] 字：塗りの上は 明るい時 黒へ66%／暗い時 白へ78%。点線の字は 黒へ66%／白へ88%。種類の色の小さな字は暗い時 白へ45% `App.jsx:645-664`
- [ ] 祝日・日曜＝var(--sun)、土曜＝var(--sat) `App.jsx:29-30`
- [ ] 予定の字の倍率（evScale）：設定 fontScale（1〜1.4）か、iPhone の本文の大きさ ÷17（1〜1.35、0.05刻み）。予定の字（帯・時間の箱・日の一覧の題名・印）だけに効く `App.jsx:5603-5607,5632-5637,5645-5654`
- [ ] ナビ上端の高さは CSS の --nav-top を測る（既定 83）。月の下余白と段数に使う `App.jsx:5614-5629`

### 2-B1. 新しい予定／予定を編集（screen='new'）
開き方
- [ ] openNew（`App.jsx:1170`）：種類＝設定の lastType（見えている種類にあれば）→無ければ見えている先頭→無ければ 'yoji'（`App.jsx:1171-1173`）
- [ ] openNew の時刻：opts.start（数値・分）があればその時刻から1時間（開始は 0〜1410 に丸め、終わりは最大 1439）（`App.jsx:1177`）
- [ ] openNew の時刻：今日の予定で種類に defStart が無いとき、いま＋1分を 30分刻みで切り上げた時刻から1時間。22:00 を超えるなら種類の既定（`App.jsx:1178-1181`）
- [ ] defTimes：種類の defStart/defEnd、無ければ 10:00–11:00（`App.jsx:1160`）
- [ ] openNew の終日：opts.allDay があればそれ、無ければ種類の allDayDefault（opts.start があるときは時間指定）（`App.jsx:1184`）
- [ ] openNew のお知らせ：終日なら設定 remindAllDay、時間指定なら remindTimed（数値でなければなし）（`App.jsx:1185`）
- [ ] openNew の初期値：status='kakutei'、jobId＝引退していない最初のバイト先、repSpan=3、title/place/memo/link 空、secret=false、cand=false、someday=null、added=[]（`App.jsx:1186-1187`）
- [ ] openEdit：既存の値で開く。実績（jisseki）は終わり＝actualEnd（無ければ end）。触覚なし（`App.jsx:1191-1194`）
- [ ] openEdit：中身のある項目（場所・リンク・メモ）だけ行を出す（added）（`App.jsx:1198-1199`）
- [ ] openCopy：tapLight。editingId=null（新規扱い）。状態は「まだ」ならまだ、それ以外は kakutei。actualEnd・repId は持っていかない。日付えらびを最初から開いた状態（picking:'date'）（`App.jsx:1215-1225`）

見出し
- [ ] 左上 ✕（丸ボタン）＝onCancel、右上 ✓（丸・地は種類の色）＝onSave（`view.jsx:1120,1124`）
- [ ] 見出しの文言：編集なら「予定を編集」、新規（コピー含む）は「新しい予定」（`App.jsx:4139`）
- [ ] 画面下にも「保存」バー（すりガラス・地は種類の色を35%暗くした色）。キーボードが出たらそのすぐ上（`view.jsx:1550-1554`, `App.jsx:4052`）

題名
- [ ] 題名入力。プレースホルダは利用者の使い方で変わる（work/family/shift/free/その他）（`view.jsx:1128`, `App.jsx:559-562`）
- [ ] 新規で題名が空のときだけ自動フォーカス（`App.jsx:4054`）
- [ ] Enter キーで保存（IME 変換中の Enter／keyCode 229 は無視）。押すと blur してから save（`App.jsx:4055`）

よく入れる予定（候補チップ）
- [ ] 新規のときだけ出す。編集中は出さない（`App.jsx:4059,4081`）
- [ ] 対象：無くなった以外・開始日が今日の92日前以降・題名が空/「無題」でない予定。種類＋題名でまとめて数える（`App.jsx:4060-4070`）
- [ ] 題名が空なら2回以上のものだけ。題名を打ったら、その字を含み完全一致ではないものに絞る（回数1でも出る）（`App.jsx:4071-4072`）
- [ ] 多い順に最大6個、横スクロールの丸チップ。頭に種類色の点（`App.jsx:4073-4080`, `view.jsx:1131-1139`）
- [ ] 押す：tapLight。題名・種類・（終日ならallDay、そうでなければ開始/終了）・場所・リンク・jobId・お知らせを最後の回からコピー、メモは空にする。場所/リンクがあれば行を足す（`App.jsx:4075-4079`）

この予定は（決まってる／まだ）
- [ ] 2択のセグメント。文言は種類の cLabel/uLabel、無ければ「決まってる」「まだ不確定」。押しても触覚なし（`App.jsx:4572-4575`）
- [ ] 下に説明1行：まだ→「◯◯として、点線で置かれます」、決まった→「◯◯として、塗りで置かれます」＋見本の小四角（点線／塗り）（`App.jsx:4578-4579`）

種類
- [ ] 「種類」行を押すと開閉（行にたたむ：開けるのは一度に1行、tapLight）（`App.jsx:4278-4284`）
- [ ] 開くと種類チップ：隠した種類は出さない（ただし今の種類なら出す）。選ぶと塗り（`App.jsx:4550-4553`）
- [ ] 種類を選ぶ（selectType）：時刻が今の種類の既定のままなら、新しい種類の既定時刻に変える。いじっていたら残す。触覚なし（`App.jsx:2115-2121`）
- [ ] 「＋ 種類」チップ：新しい種類の入力欄を開閉（初期色 #2F72C4）（`App.jsx:4555`, `view.jsx:1169`）
- [ ] 新しい種類の欄：名前入力（例はプロフィールで変わる）・12色の見本（PAL）・「やめる」・「この種類を追加」（地は選んだ色）。出るとき riseUp .24s（`view.jsx:1195-1208`, `App.jsx:483,4560-4568`）
- [ ] addType：名前が空なら「新しい種類」。key=uid('c')、uWord「未確定の◯◯」、cWord「◯◯」。追加と同時に予定の種類にする（`App.jsx:2123-2129`）
- [ ] 作成画面では種類の色は変えられない（設定画面に一本化）（`App.jsx:4557`）

バイト先（種類が baito のときだけ）
- [ ] 種類の下に「バイト先／勤務先」行（プロフィールが学生なら「バイト先」）。値＝選んだ名前、無ければ「設定の時給」（`App.jsx:4204-4205,4288-4289`, `App.jsx:551`）
- [ ] 開くとチップ：「名前　¥時給」（全バイト先。引退済みも除外していない）・「バイト先なし」・「＋ バイト先」（`App.jsx:4206-4216`, `view.jsx:1182-1190`）
- [ ] pickJob：tapLight。題名が空か前のバイト先名のままなら、題名をバイト先名に置き換える（`App.jsx:1533-1541`）
- [ ] clearJob：jobId を外す。触覚なし（`App.jsx:1542`）
- [ ] 「＋ バイト先」（startNewJob）：tapLight。その場に入力欄（名前・時給、時給初期値は設定の時給）。画面を離れないので入力が消えない（`App.jsx:1545`, `view.jsx:1212-1231`）
- [ ] 時給入力：数字以外を捨て、空なら0、上限 99999、最大5文字、数字キーボード（`App.jsx:4222-4223`, `view.jsx:1221`）
- [ ] 時給の −／＋：10円ずつ（−は0未満にしない、＋は上限なし）（`App.jsx:4224-4225`）
- [ ] 「やめる」（cancelNewJob）／「このバイト先を追加」（commitNewJob：tapLight、名前空なら「バイト先/勤務先」、追加して選択、題名の置き換えは pickJob と同じ規則）（`App.jsx:1546-1558`）

日にち
- [ ] 「日にち」行：値「YYYY年M月D日（曜）」、複数日があれば緑字「ほかN日」。押すと日付えらびを開閉（開くと表示月を予定の月に戻す）（`App.jsx:4142-4148`, `view.jsx:1236-1243`）
- [ ] 日付えらび：‹ › で1か月ずつ（触覚なし）（`App.jsx:4153-4154`）
- [ ] 「YYYY年M月 ▾」ボタン：tapLight。年と月の直接えらびに切り替え（ボタン黒地・▾が180°回転、‹ › は透明化して押せない）（`App.jsx:4157-4158`, `view.jsx:1249-1254`）
- [ ] 年月えらび：年 ‹ ›、12か月の4列グリッド。月を押す（tapLight）と月表示に戻る（`App.jsx:4160-4166`）
- [ ] 日のマス：週のはじまり設定に従う。日・祝は赤、土は青。選んだ日は黒地白字、今日は細枠（`App.jsx:4167-4190`）
- [ ] 日のマスを押す：tapLight。押した日だけを本体の日にし、複数日（extraDays）を空にする。すでに本体の日なら何もしない。カレンダーは開いたまま（`App.jsx:4196-4198`）
- [ ] ヒント「日をえらんでください」、複数日があれば「ほかの日を外す」（extraDays を空に）（`App.jsx:4149-4150`, `view.jsx:1280-1285`）
- [ ] 日にちをまだ決めない：新規のときだけ、日付えらびの下に4チップ「今週のどこか／今月のどこか／来月あたり／いつか」（`App.jsx:4110-4114`, `App.jsx:395-396`）
- [ ] 上のチップを押す：tapLight。同じものならオフ、違えばそれに。同時に status を mikakutei・日付えらびを閉じる・複数日を空にする（オフに戻しても status はまだのまま）（`App.jsx:4111`）
- [ ] someday を選ぶと日にち行の下に「◯◯（日が決まったら、棚からカレンダーへ移せます）」（`App.jsx:4115-4116`, `view.jsx:1299-1301`）

終日・時刻
- [ ] 「終日予定」トグル：tapLight。お知らせ値が切替先で選べる一覧（終日 [0,1440]／時間 [10,30,60,1440]）に無ければ「なし」へ。開いている行を閉じる（`App.jsx:4267-4272`）
- [ ] 時間指定のとき「開始」「終了」の2行。左に日付、右に時刻（`App.jsx:4524`, `view.jsx:1308-1323`）
- [ ] 開始の日付を押すと日付えらびを開閉。終了の日付は押せない（翌日になるときだけ緑で強調）（`App.jsx:4544-4546`, `view.jsx:1317-1320`）
- [ ] 時刻を押すとドラム（時・分の2列、高さ170、中央に34pxの枠線）を開閉。開くと値が緑・太字（`view.jsx:1321-1335`, `App.jsx:4515-4523`）
- [ ] ドラム：時 00–23、分は5分刻み（MIN_STEP=5）、1項目 34px（ITEM）、scroll-snap、上下フェードのマスク（`App.jsx:177,484,4511-4514`）
- [ ] ドラムの初期位置：DOMに付いた最初の1回だけ値の位置へスクロール（dataset.pos）（`App.jsx:490`）
- [ ] ドラムを回す：rAF で間引き、位置から値を出す。開始を動かすと終わりも同じ分だけ動く（長さを保つ）。終了だけ動かすのは自由（`App.jsx:494`）
- [ ] 終わりが開始以前（同時刻でない）なら翌日扱い。「日をまたぐので、終わりは翌日です」を緑で出す（`App.jsx:4538-4543`）
- [ ] 長さのボタン：時間指定のとき「30分／1時間／1時間半／2時間／3時間」。今の長さと同じものは黒地。押すと tapLight、終わり＝開始＋長さ、ドラムを閉じる（`App.jsx:4084-4090`）
- [ ] 時間の重なり：新規/編集画面・時間指定・someday でないとき。同じ開始日の、無くなった/終日/自分以外の予定と時間が重なれば橙字で「この時間は「◯◯」（まだの予定）と重なっています（ほかN件）」。保存は止めない（`App.jsx:4093-4101`）
- [ ] 注意の文が無いときは高さ8の余白（`view.jsx:1351`）
- [ ] 何日間（終日のときだけ）：−／＋（tapLight）で1〜60日。端では薄く（.35）押しても変わらない。2日以上で「8/25〜8/27」の範囲を緑で（`App.jsx:4249-4263`, `view.jsx:1353-1365`）

お知らせ
- [ ] 「お知らせ」行：値＝設定で通知オフなら「通知はオフ」、それ以外は選んだ値（「10分前」「1時間前」「1日前」「当日の朝」など）か「なし」（`App.jsx:4486`, `App.jsx:827-833`）
- [ ] 開くとチップ（折り返し）：終日＝なし/当日の朝/前日の朝/2日前/3日前/1週間前、時間指定＝なし/10分前/30分前/1時間前/3時間前/前日/2日前/3日前/1週間前。押すと tapLight（`App.jsx:4493-4502`）
- [ ] 選んだときの説明：終日「当日の朝9時に…」「N日前の朝9時に…」、時間指定 1日以上「N日前の同じ時刻に…」、未満「始まるN分/時間前に…」（`App.jsx:4503-4507`）

名前を隠す
- [ ] トグル「名前を隠す」＋小さな説明「ウィジェットと通知では「予定あり」とだけ出します」。tapLight（`view.jsx:1388-1395`, `App.jsx:4118-4121`）

＋で足す項目
- [ ] 下に「＋」と点線チップ：くり返し・複数日（どちらも編集中は出さない）・場所・Web会議・リンク・メモ。足したものはチップから消える（`App.jsx:4298-4318`）
- [ ] チップを押す：tapLight。行を足して、その行を開く（`App.jsx:4313-4314`）
- [ ] 足した行の並びはいつも固定：複数日→くり返し→Web会議・リンク→場所→メモ（`view.jsx:1398-1533`）
- [ ] 各行の ✕：tapLight。行を消し、値も捨てる（くり返し→repEvery/repDows、複数日→extraDays、場所/メモ/リンク→空）（`App.jsx:4320-4327`）
- [ ] 行の名前・値を押すと開閉（複数日以外は openRow で tapLight）（`App.jsx:4335,4348,4356,4414`）

複数日
- [ ] 行の値「ほかN日」か「なし」。押すと tapLight、開閉、表示月を予定の月へ（`App.jsx:4368-4373`）
- [ ] 小さなカレンダー：‹ › で月移動。本体の日は黒地・半透明（.55）で押しても何もしない。ほかの日は押すたびに足す／外す（tapLight）（`App.jsx:4381-4409`, `App.jsx:1561-1569`）
- [ ] ヒント：「同じ予定を置きたい日を、タップしてえらんでください」／「この予定を、ぜんぶでN日に置きます」。1日以上あれば「ぜんぶ外す」（tapLight）（`App.jsx:4374-4378`）
- [ ] 候補日トグル「どれか1日に決まる（候補日）」：新規・status まだ・複数日1日以上のときだけ、複数日の行の中に出る。tapLight（`App.jsx:4104-4108`, `view.jsx:1434-1443`）

くり返し
- [ ] 行の値：なし／毎日／平日（月〜金）／毎週◯・◯／2週ごと ◯／毎月D日／毎月 第N 曜／毎月 月末／毎年M月D日（`App.jsx:4425-4433`）
- [ ] 単位チップ：なし・毎日・平日・毎週・2週ごと・毎月◯日・毎月 第◯曜日・月末・毎年。押すと tapLight、今の長さがその単位で選べなければ一覧の2番目（無ければ先頭）へ（`App.jsx:183-192,4448-4458`）
- [ ] 第N（毎月 第◯曜日のとき）：第1〜第4・最終の複数選択。未選択時は本体の日の第N。最後の1つは外せない（`App.jsx:4434-4442`）
- [ ] 曜日（毎週・2週ごと・第◯曜日のとき）：日〜土の複数選択。未選択時は本体の曜日。最後の1つは外せない（`App.jsx:4461-4473`）
- [ ] いつまで（単位を選んだとき）：単位ごとの長さ（毎日/平日 1か月・3か月・半年、毎週 +1年、2週ごと 3か月〜1年、毎月系 半年〜2年、毎年 3/5/10年）（`App.jsx:194-205,4474-4475`）
- [ ] ヒント：「（年）M月D日まで、ぜんぶでN件つくります」／置ける日が無ければ「この長さでは、ほかに置ける日がありません」（`App.jsx:4476-4479`）

Web会議・リンク／場所／メモ
- [ ] リンク：URL 入力（url キーボード・自動大文字/補正なし）。値は http(s):// を除いて22字（30字超で…）。説明「予定を開くと「参加する」ですぐ開けます」（`App.jsx:4336-4338`, `view.jsx:1490-1495`）
- [ ] 場所：入力（例はプロフィールで変わる）。値はそのまま or「なし」。説明「入れておくと、予定を開いたときに地図で開けます」（`App.jsx:4347-4352`, `view.jsx:1508-1513`）
- [ ] メモ：4行の textarea。値は1行目の12字（長い/改行ありで…）（`App.jsx:4357-4360`, `view.jsx:1526-1530`）

キャンセル／書きかけを捨てるか
- [ ] onCancel：書きかけがあれば tapLight して確認を出す。無ければそのまま開く前の画面（returnTo）へ（`App.jsx:4123`）
- [ ] 書きかけの判定（新規）：題名・場所・メモ・リンクのどれかに空白以外の文字（`App.jsx:1246`）
- [ ] 書きかけの判定（編集）：題名・種類・開始・終了（実績は actualEnd）・年月日・状態・終日・場所・メモ・リンクのどれかが元と違う（お知らせ・隠す・バイト先・日数は見ない）（`App.jsx:1247-1251`）
- [ ] 確認「書きかけの予定を捨てますか？／入れた内容は保存されません。」ボタン「捨てる」（赤字）・「書きつづける」。外側タップ＝書きつづける（`view.jsx:1555-1566`, `App.jsx:4124-4126`）
- [ ] 左端から右へなぞる（22px以内開始）：この画面は指に付いてこない。70px以上・縦ずれ70未満で tapLight → onCancel（確認ありの閉じ方）（`App.jsx:4955-4969`）

保存（save）
- [ ] 検証はしない。題名が空なら「無題」（`App.jsx:2155,2202`）
- [ ] 終日だけ日数（1〜60）を持つ。時間指定は1日に畳む。空文字の場所/メモ/リンクは持たない。secret は true のときだけ（`App.jsx:2135-2142`）
- [ ] 保存のたび lastType を今の種類に（`App.jsx:2144`）
- [ ] 戻り先：returnTo が day/list/free/month ならそこ、detail なら month、それ以外 month（`App.jsx:2146`）
- [ ] 編集・くり返しの1件で後ろにまだ同じくり返しがあれば、保存せずに確認「くり返しの予定です／どこまで変えますか？」：「この予定だけ」「これ以降すべて（ほかN件）」「やめる」（外側タップ＝やめる）（`App.jsx:2150-2153,4128-4134`, `view.jsx:1567-1579`）
- [ ] 編集の保存：実績なら終了を actualEnd に、それ以外は end に入れ actualEnd を消す。種類が baito 以外なら jobId を外す（`App.jsx:2154-2160`）
- [ ] これ以降すべて：変えた項目だけ後ろの回にも当てる（実績の終了は除く）。日付を動かした分だけ後ろの回も同じ日数ずらす（`App.jsx:2162-2172`）
- [ ] 編集の保存後：戻り先へ、日の画面なら dayNum を予定の日に、表示月を予定の月に（`App.jsx:2173`）
- [ ] someday を選んだ新規：カレンダーではなく棚へ（ev は mikakutei）。トースト「「◯◯」を「今月のどこか」に置きました」（`App.jsx:2182-2190`）
- [ ] 新規の保存：本体の日＋複数日＋くり返しの日に1件ずつ作る。くり返しがあれば共通 repId、候補日オン・まだ・複数日ありなら共通 candId。まだの予定は want に希望時刻（`App.jsx:2193-2206`）
- [ ] 新規の保存後：戻り先へ、表示月を本体の月に。トースト・お祝いは出さない（`App.jsx:2207`）
- [ ] 保存ボタンを押すと tapLight（`App.jsx:2133`）

### 2-B2. 予定の詳細（screen='detail'）
開き方
- [ ] openFor：まだの予定で今日か過去の日 → 詳細ではなく「どうなった？」の小窓。未来のまだ・決まった・実績・無くなった → 詳細（`App.jsx:1113-1122`）

見出し
- [ ] 左「←」＝戻る（returnTo へ、detailId と「···」を閉じる）（`App.jsx:2477`, `view.jsx:1590`）
- [ ] 右「···」：tapLight。操作メニューを開閉。見出しに題名は出さない（`view.jsx:1586-1591`, `App.jsx:4651`）
- [ ] 左端から右へなぞると、画面が指に付いてきて 1/3 超か速い払いで戻る（tapLight → onBack）（`App.jsx:4946-4969`）

カード
- [ ] 状態バッジ：決まった/実績＝種類色の塗り「✓」、まだ/無くなった＝点線「？」（`App.jsx:4598-4600`）
- [ ] 状態の言葉：まだ＝uWord、実績＝「実績」、無くなった＝種類の gone か「無くなった」、決まった＝cWord（`App.jsx:1104-1110`）
- [ ] 候補日なら「候補 i/n」（日付順）の点線の札（`App.jsx:4622`）
- [ ] 題名（21px）（`view.jsx:1601`）
- [ ] 日付：予定自身の年月日。今年でなければ年を付ける。曜日つき。複数日なら「〜」で終わりの日（`App.jsx:4589-4593`）
- [ ] 祝日名（赤）、延期した予定なら「M月D日から延期」（`App.jsx:4594-4595`）
- [ ] 時刻：終日「終日」（複数日は「8/25〜8/27　終日」）、時間指定「開始–終了」（実績は actualEnd）（`App.jsx:4601-4602`）
- [ ] 実績で actualEnd が予定の終わりと違えば「→ 変更あり」（橙）＋「予定 開始–終了」。まだの予定で want があれば「希望 開始–終了」（`App.jsx:4623-4624`）
- [ ] お知らせ（ベルの絵＋「1時間前にお知らせ」）：設定で通知オフなら出さない（`App.jsx:4604-4605`）
- [ ] 場所：押すと Apple マップ（maps.apple.com/?q=）を開くリンク。右に「地図」。場所が URL だけなら出さずリンク扱い（`App.jsx:4608-4620`）
- [ ] Web会議ボタン（黒地・大）：リンク欄、無ければ場所かメモの中の最初の URL。http が無ければ https:// を付ける。文言 Zoom/Teams/Meet に参加する、それ以外「リンクを開く」（`App.jsx:4615-4618`）
- [ ] メモ：改行を保つ。中の URL と電話番号（0始まりのハイフン付き・携帯11桁・10桁）を押せるリンクに（電話は tel:）（`App.jsx:4611-4613`, `App.jsx:149-163`）
- [ ] 給料欄（実績・バイトのときだけ、riseUp .32s）：実働時間・休憩「休憩N分を引いています」・給料（`App.jsx:4625-4627`, `view.jsx:1652-1666`）

主ボタン（カードの下）
- [ ] 無くなった → 「予定として戻す」：tapLight、status を kakutei に（`App.jsx:4630`）
- [ ] 決まった・バイトか仕事（work）・時間指定 → 「働いた記録をつける」：worked の小窓（`App.jsx:4632`）
- [ ] まだ → 種類の ask か「この予定、どうなった？」：confirm の小窓（`App.jsx:4633`）
- [ ] それ以外（実績、終日の決まった仕事など）は主ボタンなし（`App.jsx:4634`）
- [ ] 主ボタンの見た目：種類の paper 地・種類の色の枠・dark 字（`App.jsx:4628-4629`）

「···」メニュー（上から順）
- [ ] 実績のときだけ「働いた時間を直す」→ worked の小窓（`App.jsx:4657-4658`）
- [ ] 「編集」→ openEdit（`App.jsx:4659`）
- [ ] 決まった・まだのときだけ「日にちを変える」→ move の小窓（`App.jsx:4661`）
- [ ] 「この予定を送る」→ sendEvent（`App.jsx:4663`）
- [ ] 「まとめに入れない」／「まとめに入れる」：noReport を切り替え（トーストなし）（`App.jsx:4665-4666`）
- [ ] 決まった・まだのときだけ「コピー」→ openCopy（`App.jsx:4649,4667`）
- [ ] 赤字「この予定を削除」（実績なら「この実績を削除」）→ 削除の確認（`App.jsx:4668-4669`）
- [ ] 行を押す：まずメニューを閉じてから動作。押している間は背景 var(--press)（setPressed）（`App.jsx:4670-4677`）
- [ ] Web版メニュー：「···」の真下右上から、すりガラス・角丸22・menuIn .34s（拡大＋フェード）。外側（薄い覆い）タップで閉じる（`App.jsx:4679-4683`, `view.jsx:1714-1725`）
- [ ] iPhone ではアクションシート（題＝予定の題名、赤い行は destructive、最後に「キャンセル」）（`App.jsx:5895-5897`）

この予定を送る（sendEvent）
- [ ] tapLight。文「M/D（曜） 開始〜終了 題名 @場所（まだ仮）」（終日は「 終日」、複数日は「からN日間」）（`App.jsx:1232-1236`）
- [ ] 2行目以降：リンク、場所が URL でなければ「地図：https://maps.apple.com/?q=…」（`App.jsx:1237-1238`）
- [ ] その1件の .ics（ファイル名「LUKKO-M月D日.ics」）と一緒に共有シートへ。ブラウザでは文をコピー。返ってきた文があればトースト（`App.jsx:1239-1240`, `shareimg.js:85-97`）

カードの下の2つ
- [ ] 「M月D日の、ほかの予定」：その日を覆う無くなった以外の予定を、終日→時刻順で最大3件。あふれは「ほか N件」。無ければ「この日は、これだけです」（`App.jsx:4699-4703`, `eventctx.js:76-83`, `view.jsx:1676-1691`）
- [ ] ほかの予定の行：時刻（終日は「終日」）＋月表示と同じピル（まだ＝点線、？は付けない）。押すと openFor（戻り先は変えない）。押している間は var(--press)（`App.jsx:4704-4722`）
- [ ] 「これまでの「題名」」：同じ種類＋題名完全一致（無くなった除く）で「今年 N回目」「今月 N回目」「前回 M月D日（曜）」「◯日前／前の日／同じ日／◯か月前／◯年前」。先の予定は数えない。初回なら「これが、はじめてです」（`App.jsx:4724-4727`, `eventctx.js:51-66,89-96`）

### 2-B3. 削除の確認
- [ ] askDelete：confirmDelete=id、deleteRest=false（`App.jsx:1227`）
- [ ] 題「「◯◯」を削除しますか？」、本文「30日間は、設定の「最近消した予定」から戻せます。」（実績は先頭に「働いた記録も一緒に消えます。」）（`App.jsx:4759-4763`）
- [ ] くり返しの予定でその日以降に2件以上あれば、チェック「この日から先のくり返しも消す（N件）」：tapLight で切替、オンなら赤い ✓、ボタンが「N件を削除する」（`App.jsx:4769-4781`）
- [ ] ボタン「削除する」（赤字）・「やめる」。外側タップ＝やめる（`view.jsx:1755-1773`）
- [ ] doDelete：対象（と、オンなら同じ repId でその日以降の回）を消してゴミ箱へ（新しい順・最大400）。開いていた小窓・スワイプ行も閉じる（`App.jsx:1674-1689`）
- [ ] 詳細で開いていた予定を消したら、戻り先（detail なら month）へ（`App.jsx:1690`）
- [ ] 消したあと取り消しの帯「「◯◯」を削除しました」／「N件を削除しました」（`App.jsx:1691-1692`）
- [ ] 同じ覆いを「控えから戻しますか？」にも使う（置き換え／足すのチェック「置き換えずに、足りない予定だけ足す」、ボタン「戻す」「足す」）（`App.jsx:4734-4756`）
- [ ] iPhone では標準の確認：くり返しなら「この予定だけ削除」「この日から先も削除（N件）」（両方 destructive）、それ以外「削除」、＋「キャンセル」（`App.jsx:5898-5905`）

### 2-B4. 中央の小窓（dialog：confirm／worked／move）
- [ ] openDialog：confirm で want があれば元時刻＝want、worked で実績の記録し直しなら終わり＝actualEnd。休憩は今の breakMin（`App.jsx:1729-1736`）
- [ ] 外側タップ＝閉じる（何もしない）（`App.jsx:4888`）
- [ ] 見出し：worked「何時まで働いた？」、それ以外は種類の ask、組み込み（遊び「約束、決まった？」用事「この用事、どうなりました？」バイト「このシフト、どうなりました？」）、無ければ「この予定、どうなりました？」（`App.jsx:4807-4809`）
- [ ] 副題「M月D日 ・ 題名」（`App.jsx:4812`）
- [ ] 開始・終了の2行：押すとドラム（高さ150、時/5分刻み）。開いた行は種類の色（`App.jsx:4824-4831`）
- [ ] 小窓のドラム：開始を動かすと終わりも同じだけ。ただし worked は終わりを動かさない（`App.jsx:500-503`）
- [ ] 休憩（worked のときだけ）：なし/15/30/45/60/90分。tapLight。「実働 H時間（休憩N分を引いた）」をその場で（`App.jsx:4836-4847`）
- [ ] 時刻が元と違えば「希望 a–b（worked は 確定 a–b） → 変更あり」（`App.jsx:4814-4815`, `view.jsx:1843-1847`）
- [ ] 主ボタン：confirm「確定した」／worked「記録する」。地は種類の色を35%暗く（`App.jsx:4816-4820`）
- [ ] 赤字ボタン：種類の gone か「無くなった」（worked でも出る）（`App.jsx:4810`, `view.jsx:1851`）
- [ ] confirm のときだけ「別の日になった」（`App.jsx:4851`）
- [ ] 「まだ分からない」（種類 work は「まだ仮のまま」）＝閉じるだけ（`App.jsx:4811,4887`）
- [ ] 下に細字「予定の内容を直す」（worked は「この予定を編集」）：閉じて openEdit（`App.jsx:4890-4891`）

dlgPrimary（確定した）
- [ ] tapLight。時刻を反映し、want に元の時刻を残す（`App.jsx:1756,1769`）
- [ ] 小窓を閉じて月表示へ、その予定の月を開く（`App.jsx:1771-1772`）
- [ ] 月表示のピルが点線→塗りに：0ms dash、150ms fill＋penTick、470ms settle＋settleSuccess、760ms status=kakutei・confirmCount+1（`App.jsx:1771-1777`）
- [ ] その600ms後、条件を満たせば App Store のレビュー依頼（確定5・10・25回目、使い始め7日以上、前回から60日以上）（`App.jsx:1778,1991-2000`）
- [ ] 候補日の1つなら、ほかのまだの候補を片づけるか聞く。そうでなければ取り消しの帯「「◯◯」を確定しました」（戻すと状態・時刻・want が元へ）（`App.jsx:1780-1783`）

dlgPrimary（記録する＝worked）
- [ ] tapLight＋stampHeavy。status=jisseki、start、actualEnd、休憩（0なら持たない）。バイトなら記録時点の時給を書き込む。小窓を閉じるだけ（画面移動・取り消し帯なし）（`App.jsx:1758-1765`）

無くなった（dlgNakunatta）
- [ ] status=nakunatta。詳細で開いていた予定なら戻り先へ。取り消しの帯「「◯◯」を無くなったにしました」。触覚なし（`App.jsx:1840-1843`）

別の日になった／日にちを変える（move）
- [ ] 「別の日になった」：tapLight、同じ小窓の中で日えらびへ（表示月＝予定の月、選択なし）（`App.jsx:4852`）
- [ ] 「···」の「日にちを変える」は最初から日えらび。題は move なら「日にちを変える」、confirm から来たら「別の日になった」（`App.jsx:4853,4883`）
- [ ] 月 ‹ ›、週のはじまり設定、日・祝赤/土青。元の日は取り消し線で押せない。押した日は黒地（tapLight）（`App.jsx:4855-4876`）
- [ ] 下に「M月D日（曜）へ」か「新しい日をえらんでください」（`App.jsx:4878`）
- [ ] 「この日で決まった」（黒地）・「この日に、まだ仮で置く」：日を選ぶまで薄く押せない（`view.jsx:1796-1797`）
- [ ] moveEvent：tapLight。日付と状態を変え、movedFrom に最初の元の日を残す。表示月を移動先へ。取り消しの帯「「◯◯」をM月D日に動かしました」（`App.jsx:1790-1798`）
- [ ] 「日にちはまだ決めない（今月のどこか）」：toSomeday('month')。カレンダーから外して棚へ（状態まだ）、詳細なら月表示へ、トースト「「◯◯」を「今月のどこか」に置きました」（`App.jsx:1804-1812,4881`）
- [ ] 「もどる」：move なら小窓を閉じる、confirm から来たなら元の3択へ（`App.jsx:4882`）

### 2-B5. 候補日の片づけ
- [ ] 確定した予定に同じ candId のまだの候補があれば出る。題「「◯◯」が決まりました」、本文「同じ予定の、ほかの候補がN件あります。片づけると「無くなった」になります（あとから戻せます）。」（`App.jsx:3578-3586`）
- [ ] 「ほかの候補N件を片づける」（黒地）：tapLight、残りを nakunatta に、取り消しの帯「ほかの候補N件を片づけました」（`App.jsx:1831-1838`）
- [ ] 「残しておく」：tapLight、閉じるだけ。外側タップでは閉じない（`App.jsx:1834`, `view.jsx:1868-1879`）
- [ ] iPhone では標準の確認（片づける＝preferred、残しておく＝cancel）（`App.jsx:5915-5916`）

### 2-B6. 取り消しの帯
- [ ] showUndo：画面の下に5秒だけ（前のタイマーは消して出し直す）（`App.jsx:1699-1703`）
- [ ] 位置：下のナビがあれば下から96px、無ければ24px。黒地・角丸14・capRise .24s。key で出し直すたびにアニメ（`App.jsx:3575-3576`, `view.jsx:1893-1898`）
- [ ] 文は1行で…省略。右に緑字「元に戻す」（`view.jsx:1895-1896`）
- [ ] undoLast：tapLight。del＝ゴミ箱から戻す（トーストなし）、status＝その予定を前の値に（morph も止める）、many＝複数の予定を前の値に（`App.jsx:1704-1713`）
- [ ] この範囲から出るもの：削除・確定した・日を動かした・候補の片づけ・無くなった（`App.jsx:1691,1783,1798,1838,1843`）
- [ ] ゴミ箱から戻すとき updatedAt を付け直す。棚から消したものは棚へ戻す（`App.jsx:1715-1727`）

### 2-B7. 「決まった」お祝い（celebrate）
- [ ] 表示条件は dialog.phase があるとき（celebShown）（`App.jsx:2466`）
- [ ] 見た目：暗い覆い、中央に種類色のピル（点線→塗り・1.06倍、.6s）、？が消えて ✓ がはねる（qFade .42s／checkPop .5s 遅れ.18s）、枠が広がって消える輪（haloOut .85s）、下に「約束、決まった／シフト確定／決まった」（種類の celeb 優先）と「M月D日 ・ 開始–終了」（capRise .34s）（`App.jsx:4789-4804`, `view.jsx:1900-1920`）
- [ ] 注意：今のコードには dialog.phase を入れる所が無い（grep で確認）。確定の演出は月表示のピルの morph（2-B4）で行っている

### 2-B8. トースト・押している見た目
- [ ] toast(msg, ms=2400)：画面の下に一言。呼ぶたびに消える時刻を延ばす（`App.jsx:1314-1318`）
- [ ] 位置：ナビがあればナビの上＋8、無ければ下から30。黒地・角丸14・capRise。押せない（pointer-events:none）。まとめ／空きシェア画面では出さない（`App.jsx:3566-3569`, `view.jsx:2668-2670`）
- [ ] setPressed(key)：押している間だけ背景を沈ませる（key が同じなら再描画しない）（`App.jsx:1310-1312`）

### 2-B9. iPhone 標準の確認画面（native alert）
- [ ] iPhone（ネイティブ）では次の Web の小窓を出さず、標準の確認に置き換える：「···」メニュー、削除、控えから戻す、候補の片づけ、バイト先の削除、書きかけを捨てる、くり返しの編集（`App.jsx:5880,5884`）
- [ ] 優先順：···メニュー → 削除 → 控え → 候補 → バイト先 → 捨てる → くり返し編集（`App.jsx:5895-5923`）
- [ ] 控えから戻す：「置き換えて戻す」（destructive）「足りない予定だけ足す」、または「戻す」＋キャンセル（`App.jsx:5906-5913`）
- [ ] バイト先の削除：「消す」（destructive）「キャンセル」（`App.jsx:5917-5918`）
- [ ] 書きかけ：「捨てる」（destructive）「書きつづける」（cancel）（`App.jsx:5919-5920`）
- [ ] くり返し編集：「この予定だけ」「これ以降すべて（ほかN件）」「キャンセル」（`App.jsx:5921-5923`）
- [ ] 同じ key のあいだは出し直さない。閉じた・出せない（-1）ときは cancel のボタンの処理を呼ぶ（`App.jsx:5939-5948`, `native.js:42-49`）
- [ ] 中央の小窓（confirm/worked/move）は Web のまま（native に置き換えていない）

### 2-S. 設定（共通のしくみ）
- [ ] 設定の値は `_settingsVals(v)` が作る。renderVals の最後、`settingsShown` のときだけ呼び、先に作った同名の値（typeRows・jobRows など）を上書きする（`App.jsx:4988-4989`）
- [ ] 画面は「最初の画面（Main）」と中の画面 15 種：support / display / free / notify / wage / iphone / data / help / types / work / jobs / leave / overlay / backup / files（`settingsview.jsx:587`）
- [ ] 親子関係 `SET_PARENT`：work→free、jobs→wage、leave→wage、overlay→iphone、backup→data、files→data（`App.jsx:433`）。そのほかの親は最初の画面
- [ ] 中の画面へ：`onSetPage(p)` = tapLight ＋ setPage=p、editTypeKey・editJobId・typeDelete を空にする（`App.jsx:2229`）
- [ ] 戻る：`onSetBack` = tapLight ＋ 1 段だけ上（SET_PARENT か最初の画面）、editTypeKey・editJobId・typeDelete・newType を空にする（`App.jsx:2232`）
- [ ] 戻るボタンの字：親が中の画面なら「戻る」、最初の画面なら「設定」。support だけ字なし（‹ のみ）（`App.jsx:2233`、`settingsview.jsx:592`）
- [ ] 中の画面の題（真ん中固定・左右 72px 空け・…で切る）：応援する / カレンダーと表示 / 空き状況 / 通知 / （words().wageHead） / iPhone のカレンダー / 保存と安全 / ヘルプ / 予定の種類 / 勤務時間 / （words().job） / 有給 / 重ねて表示 / 控えと機種変更 / ファイルで出し入れ（`App.jsx:2234`、`settingsview.jsx:594`）。support の題だけ手書き書体 16px
- [ ] 最初の画面の見出し「設定」30px 細字（`settingsview.jsx:597-599`）
- [ ] 最初の画面のスクロール位置を覚える（部品の外の SAVED.main）。中の画面・規約・取り込みから戻ると同じ位置（`settingsview.jsx:511-516,584-586,602`）
- [ ] 下のタブから設定を開いたときは先頭へ戻す（resetSettingsScroll）＋ setPage=null・editTypeKey=null ＋ `_loadTips()`（`App.jsx:2493`）
- [ ] 中の画面はページごとに key を変え、スクロールは毎回先頭から（`settingsview.jsx:601`）
- [ ] 下に 110px の余白（タブに隠れない）（`settingsview.jsx:603`）
- [ ] 下のナビは設定画面では出る。ただし「貼り付けで戻す」を開いている間・キーボード表示中・応援のお礼の小窓表示中は隠す（`App.jsx:2485-2486`）
- [ ] 行（Row）：左に名前・右に値（…で切る、名前に最低半分の幅を残す）・› かスイッチ。最後の行以外は左 16px からの区切り線（`settingsview.jsx:29-44`）
- [ ] 選ぶ行（PickRow）：右に今の値と ⌃⌄ の絵。行全体に見えない `<select>` を重ね、押すと iPhone 標準のホイール。選ぶと item.onClick（`settingsview.jsx:51-67`）
- [ ] 時刻（TimePick）：字だけの小さな箱。見えない `<select>` を重ねてホイール。表示は先頭の 0 を落とす（09:00→9:00）（`settingsview.jsx:69-79`）
- [ ] 時刻の選択肢 timeOpts：0〜1440 を 30 分きざみ（49 個）、1440 は「24:00」（`App.jsx:2223`）
- [ ] スイッチ（Toggle）：押すと伝播を止めて onClick。見た目は 51×31・つまみ 27・オン色 #7FAE85（`settingsview.jsx:45-47`、`App.jsx:116-119,2217`）
- [ ] 例外：「無くなった予定を隠す」「働いたあとに記録を聞く」のスイッチは別の小さい形（44×26・つまみ 22）（`App.jsx:3290-3296`）
- [ ] seg（選ぶ行の中身）を押すと tapLight ＋ 値を入れる（`App.jsx:2218`）。週のはじまりだけは tapLight なし（`App.jsx:3219`）
- [ ] シート（Sheet）：下から出る。背景を押すか「閉じる」で閉じる。上につまみ（`settingsview.jsx:114-128`）
- [ ] 説明（NOTE）はカードの下に小さく 1 つだけ（`settingsview.jsx:18`）

### 2-S1. 設定：最初の画面（Main）`settingsview.jsx:139-189`
- [ ] 1 枚目のカード：応援とレビュー（いちばん上）
  - [ ] 「サポーターカード」行：応援したことがある（supports が 1 件以上）ときだけ。✓ の緑丸・題・「¥合計・n回・YYYY年M月から」・›（`settingsview.jsx:145-156`、`App.jsx:2920-2926`）
  - [ ] 押すと tapLight ＋ カードの回転を止めて screen='card'・cardAngle=0（`App.jsx:2927`）
  - [ ] 指が触れている間は沈んだ色（pressed='sup'）。離す・取り消し・指が外れたら戻る（`App.jsx:2929-2934`）
  - [ ] 下に応援の行が続くときだけ下線（`App.jsx:2931`）
  - [ ] 「LUKKO を応援する」（芽の絵）：App Store から値段が取れたとき（tips が 1 件以上）だけ。押すと support 画面（`settingsview.jsx:157`、`App.jsx:3080`）
  - [ ] 「App Store でレビューする」（星の絵）：外部リンク `https://apps.apple.com/app/id6794792375?action=write-review`（`settingsview.jsx:158`、`App.jsx:3135`、`docs.js:7`）
- [ ] 2 枚目のカード
  - [ ] 「使い方」：値＝今の使い方の名前。押すと使い方のシート（`settingsview.jsx:163`、`App.jsx:2243-2244`）
  - [ ] 「予定の種類」：右に色の丸（最大 6 個、狭いと右から切れる）と「nつ」（種類の数、いつも出す）。押すと types 画面（`settingsview.jsx:164-171`、`App.jsx:3285-3288`）
- [ ] 3 枚目のカード（絵つきの行）
  - [ ] 「カレンダーと表示」→ display
  - [ ] 「空き状況」→ free
  - [ ] 「通知」：値「オン／オフ」（notifyOff の逆）→ notify（`settingsview.jsx:177`）
  - [ ] words().wageHead（学校とバイト＝「バイトと給料」、ほか＝「働いた時間と給料」）→ wage（`App.jsx:557`）
  - [ ] 「iPhone のカレンダー」：取り込みが使える端末（canImport）だけ → iphone（`settingsview.jsx:179`）
  - [ ] 「保存と安全」→ data
- [ ] 4 枚目のカード：「ヘルプ」→ help
- [ ] いちばん下に「LUKKO 1.3.3（0.xx.x）」（ストアの版＋中の版）。5 回叩くと診断（`settingsview.jsx:187`、`App.jsx:2438`）

### 2-S2. 使い方のシート `settingsview.jsx:629-650`、`App.jsx:2242-2253,2073-2081`
- [ ] 題「ふだんの予定に近いのは？」
- [ ] 5 つ：学校とバイト（授業・サークル・バイト）／会社の仕事（会議・打ち合わせ・出張）／シフト勤務（看護・介護・販売・飲食など）／フリーランス・副業（案件・打ち合わせ・納期）／子育て・家族（保育園・学校行事・通院）（`App.jsx:75-93`）
- [ ] 今のものは枠が濃く、右に「いま」
- [ ] 「バイト先をまとめて「辞めた」にする（記録は残ります）」のチェック：今が学校とバイトで、辞めていないバイト先があるときだけ。押すと tapLight ＋ 切り替え（`App.jsx:2249-2251`）
- [ ] 下に箇条書き「予定の種類・呼び名・空きを見る時間が変わります」「予定はそのまま残ります」
- [ ] 選ぶと setProfile(k, retire && k!=='student')：tapLight、applyProfile（種類の並び・名前・隠す、空き状況の時間帯、勤務時間、仮の印、週のはじまり）。案内を終えた人は週のはじまりを今のまま残す。辞めたにするなら全バイト先を retired、wageFeature='auto'。シートを閉じ、知らせ「「◯◯」に合わせました。予定はそのままです」（`App.jsx:2073-2081`）
- [ ] 同じ使い方を選び直しても applyProfile は走る（早期 return なし）（`App.jsx:2075`）
- [ ] applyProfile：名前が既定か、どれかの使い方が付けた名前のときだけ付け替える。並びに無い組み込みの種類は隠す（消さない）。自分で足した種類（key が c で始まる）は触らない。kariMark は会社の仕事・フリーランスで true（`App.jsx:573-595`）

### 2-S3. カレンダーと表示（display）`settingsview.jsx:191-207`
- [ ] 「週のはじまり」：日曜日／月曜日（weekStart 0/1）（`App.jsx:3219`）
- [ ] 「帯に時刻を出す」スイッチ（barTime）（`App.jsx:2280`）
- [ ] 「点線に「仮」を付ける」スイッチ（kariMark）（`App.jsx:2281`）
- [ ] 「無くなった予定を隠す」スイッチ（hideCanceled、既定オフ）（`App.jsx:3295-3296,520`）
- [ ] 見出し「表示」
- [ ] 「表示モード」：iPhoneに合わせる／明るい／暗い。theme を入れ、dark=(暗い) も同時に入れる。theme が無い昔の人は dark から決める（`App.jsx:2276-2277`）
- [ ] 「予定の文字の大きさ」：iPhoneに合わせる（fontScale を消す）／標準 1／大きめ 1.12／特大 1.25（`App.jsx:2278-2279`）

### 2-S4. 空き状況（free）`settingsview.jsx:208-221`
- [ ] 上に説明「空き状況の○△×を決める時間です」
- [ ] 「平日」〜「休日」：開始〜終了の時刻 2 つ（既定 9:00〜22:00＝540〜1320）。終わりが始まり以下になる選び方は黙って入れない（`App.jsx:2284-2287`）
- [ ] 「勤務時間」：値（なし／曜日なし／「月〜金 9:00〜18:00」— 3 日以上の連続なら「〜」、ほかは曜日を並べる）→ work 画面（`App.jsx:2315-2318`）
- [ ] 「重ねた予定もふさがり扱い」スイッチ（overlayFree）：重ねて表示のカレンダー一覧（overlayCals）が読めているときだけ（`settingsview.jsx:215-217`）

### 2-S5. 勤務時間（work）`settingsview.jsx:366-377`、`App.jsx:2288-2299`
- [ ] 「勤務時間を入れる」スイッチ：オンで {月〜金, 9:00〜18:00}、オフで null
- [ ] オンのとき：日〜土の 7 つの曜日ボタン（押すと tapLight ＋ 足し外し、選んでいるのは黒地）
- [ ] 「時間」：開始〜終了。開始は終了より前、終了は開始より後のときだけ入る
- [ ] 下の説明「空き状況で、この時間を「ふさがり」にします」

### 2-S6. 通知（notify）`settingsview.jsx:222-248`
- [ ] 「通知」スイッチ（notifyOff の逆、全部まとめて止める）（`App.jsx:2238-2239`）
- [ ] オンのときだけ下の行が出る
  - [ ] 「予定の通知」：なし／10分前／30分前／1時間前（remindTimed）（`App.jsx:2309`）
  - [ ] 「終日の予定の通知」：なし／当日の朝(0)／前日の朝(1440)（remindAllDay）（`App.jsx:2310`）
  - [ ] 「朝のまとめ」スイッチ（morning）。オンなら「時刻」（morningAt、既定 450＝7:30）（`App.jsx:2304-2306`）
  - [ ] 「前の晩に明日の予定」スイッチ（evening）
  - [ ] 「日曜の夜にまだの予定」スイッチ（weekly）
  - [ ] 「働いたあとに記録を聞く」スイッチ（remind、既定オン）：勤務先が 1 つでもある（辞めたも含む）かつ通知が使える環境のときだけ（`App.jsx:4245,3292-3294`）
- [ ] 通知の設定（notifyOff・remind・morning・morningAt・evening・weekly・hideTitles）が変わると 0.4 秒後に予約を貼り直す（`App.jsx:5319-5323`）

### 2-S7. 給料（wage）`settingsview.jsx:249-258`
- [ ] words().job（バイト先／勤務先）：値＝辞めていない最初の名前（無名は「（名前なし）」）＋「 ほかn」、無ければ「なし」→ jobs（`App.jsx:2350`）
- [ ] 「給料の表示」：記録があれば(auto、既定)／いつも(on)／使わない(off)（`App.jsx:2322`）
- [ ] wageFeatureOn：off→出さない、on→出す、auto→辞めていない勤務先があるか、バイトの実績が 1 件でもあれば出す（月表示の給料スイッチ）（`App.jsx:2447-2452`）
- [ ] 「有給」：値＝「あとn日」（有給の要約から「有給 」と（…）を除いたもの）、オフなら「オフ」→ leave（`App.jsx:2387`）

### 2-S8. 勤務先（jobs）`settingsview.jsx:378-440`、`App.jsx:2321-2361`
- [ ] 一覧：辞めたところは「辞めたところを出す」にしたときだけ。名前（無名は「（名前なし）」、辞めたは「（辞めた）」付きで薄く）・「¥時給」・›／⌄
- [ ] 行を押すと開閉（1 つだけ開く）
- [ ] 開いた中身
  - [ ] 名前の入力（placeholder：学校とバイト「バイト先の名前（例：マクド、塾）」／ほか「勤務先の名前（例：〇〇病院、駅前店）」）（`App.jsx:556`）
  - [ ] 時給：− ／ ¥入力 ／ ＋。±10 円（0 未満にしない）。入力は数字だけ、最大 99999、5 桁（`App.jsx:2330-2332`）
  - [ ] 時給を変えると、その勤務先の実績のうち時給をまだ持っていないものに前の時給を書き込む（過去の給料は変わらない）。rateNote にその勤務先を立てる（`App.jsx:1500-1507`）
  - [ ] rateNote のときだけ下線の「これまでの記録も新しい時給で数え直す」→ recountJob：tapLight、書き込んだ時給を外す、知らせ「これまでの記録を、いまの時給で数え直しました」（`App.jsx:1509-1513`）
  - [ ] 「締め日」：なし（月末まで）／1日〜28日／月末(31)（`App.jsx:2323`）
  - [ ] 「給料日」：なし／1日〜28日／月末(31)（`App.jsx:2324`）。0 を選ぶと undefined で保存（`App.jsx:2337-2338`）
  - [ ] 「シフトの型」：一覧「記号　名前 08:30–17:30」（休みは「（休み）」）、それぞれ「外す」（tapLight。外す前に残る型へ今の番号を id として持たせる）（`App.jsx:2339-2342`）
  - [ ] 「＋ 型を足す」→ tapLight ＋ 型のシート（既定：8:30〜17:30、休憩 60 分、終日オフ）（`App.jsx:2343`）
  - [ ] 「n件の予定で使っています」／「まだ使っていません」
  - [ ] 「辞めた（しまう）」／「辞めたを取り消す」→ retireJob：tapLight、閉じる（`App.jsx:1515-1518`）
  - [ ] 「削除」（赤）→ tapLight ＋ 消す確認（`App.jsx:2333`）
- [ ] 「＋ バイト先を追加／勤務先を追加」→ addJob：tapLight、名前空・時給は settings.hourly（既定 1120）の新しい勤務先を足して開く（`App.jsx:1492-1496`）
- [ ] 辞めたところがあるときだけ「辞めたところ（n）も出す」／「辞めたところを隠す」（tapLight）（`settingsview.jsx:435-437`）
- [ ] 下の説明「時給を変えても、記録済みの金額は変わりません」
- [ ] 消す確認：題「◯◯を消しますか？」、本文＝実績があれば「・働いた記録n件と金額は残ります／・やめただけなら「辞めた」にすると、あとで戻せます」、無ければ「この勤務先を使っている予定はありません」。「消す」（赤）／「やめる」、背景を押すと閉じる（`App.jsx:2352-2361`、`settingsview.jsx:705-716`）
- [ ] iPhone では Web の小窓を描かず、iPhone の確認（題・本文・「消す」破壊的・「キャンセル」）（`App.jsx:5880-5884,5917-5918`）
- [ ] removeJob：勤務先を消し、消した印（job:id）を残す。実績には時給と勤務先の名前を書き込んで残す。実績以外の予定は jobId を外す（`App.jsx:1519-1531`）

#### シフトの型を足すシート `settingsview.jsx:688-702`、`App.jsx:2363-2375`
- [ ] 「記号（1〜2文字）」例：日・夜・早・遅・休（2 文字まで）
- [ ] 「名前」placeholder 日勤（12 文字まで）
- [ ] 「休み（終日）」スイッチ。オフのときだけ「時間」（終わりが早ければ翌日まで（夜勤））と「いつもの休憩」（なし／15／30／45／60／90／120分）
- [ ] 「この型を足す」：記号が空なら薄く、押しても何もしない。押すと tapLight、id 付きで勤務先の templates の後ろへ足して閉じる
- [ ] 背景か「閉じる」でやめる

### 2-S9. 有給（leave）`settingsview.jsx:441-453`、`App.jsx:2376-2387,1850-1870`
- [ ] 「有給の残りを数える」スイッチ：オンで {1年10日, 4月(start=3)}、オフで null
- [ ] オンのとき「1年にもらう日数」（数字と小数点だけ、最大 60）、「付く月」（1月〜12月）
- [ ] オンのとき下に要約「有給 あとn日（YYYY年M月から：n日のうち n日使用・希望 n日）」
- [ ] 説明「名前に「有給」「半休」がある休みを数えます」
- [ ] 数え方：休みの種類（free か off）の予定で、名前に 有給/有休/年休→1 日、半休/午前休/午後休/半日→0.5 日。決まった＝使用、まだ＝希望。無くなったは数えない。年度は付く月から 1 年

### 2-S10. iPhone のカレンダー（iphone）`settingsview.jsx:259-270`
- [ ] 取り込みが使える端末のときだけ中身が出る
- [ ] 「予定を取り込む」→ openImport（取り込みの画面）
- [ ] 「重ねて表示」：値「nつ」／「オフ」→ overlay（`App.jsx:2422`）
- [ ] 「決まった予定を書き出す」スイッチ → toggleExportCal（`App.jsx:2421,1900-1918`）
  - [ ] オフにする：書いた予定を消し、知らせ「iPhone のカレンダーに書いた予定を消しました」
  - [ ] オンにする：許可が無ければ知らせ（使えない端末／許可が必要）3.2 秒。「LUKKO」カレンダーを作れなければ知らせ。できれば知らせ「決まった予定を、iPhone のカレンダーの「LUKKO」に入れます」

### 2-S11. 重ねて表示（overlay）`settingsview.jsx:454-468`、`App.jsx:2418-2420,1873-1883`
- [ ] 「重ねて表示」スイッチ → toggleOverlay：tapLight。オフは即。オンは許可を聞き、断られたら知らせ 3.2 秒。カレンダー一覧を読み、選んだものが無ければ購読以外を全部選ぶ
- [ ] カレンダーの行：色の点・名前・チェック。押すと tapLight ＋ 選ぶ／外す、読み直し
- [ ] 説明「選んだカレンダーを灰色で表示します（保存はしません）」

### 2-S12. 保存と安全（data）`settingsview.jsx:271-289`
- [ ] 見出し「予定の保存」
- [ ] 「iCloud で同期」スイッチ：ネイティブのときだけ。下に「最後に合わせた時刻 H:MM」か「合わせています…」（`App.jsx:2425-2427`）
  - [ ] toggleSync：tapLight。オンにするとき iCloud が使えなければ知らせ（サインイン済みなら「この版では、まだ iCloud の同期を使えません」、未サインインなら「iPhone の設定で iCloud にサインインすると使えます」3.6 秒）。オンで deviceId が無ければ作り、すぐ読みに行く（`App.jsx:1936-1948`）
- [ ] 「最近消した予定」：値「n件」→ tapLight ＋ シート（`App.jsx:2400-2402`）
- [ ] 「控えと機種変更」：値＝最後の自動の控えの日「M月D日」→ backup
- [ ] 「ファイルで出し入れ」→ files
- [ ] 説明：同期が出るとき「予定は、この iPhone とあなたの iCloud にだけ保存します」、出ないとき「予定は、この iPhone の中にだけ保存します」
- [ ] 見出し「安全」
- [ ] 「Face ID でロック」（Touch ID／パスコード の名前は端末による）：使えるときだけ（`App.jsx:2431-2433,1974`）
  - [ ] toggleLock：tapLight。オンにするとき一度本人確認し、失敗なら知らせ「確かめられなかったので、入れませんでした」3 秒。通れば lock を入れて覆い（shield）も入れる（`App.jsx:2003-2010`）
- [ ] 「予定の名前を隠す」（下に「通知・ウィジェット」）スイッチ。切り替えるとウィジェットへ送り直す印を消す（`App.jsx:2311`）

#### 最近消した予定のシート `settingsview.jsx:666-686`、`App.jsx:2403-2408`
- [ ] 最大 100 件。左に「M/D」（日にち未定の棚は「日にち未定」）、名前、「M月D日に削除」、右に黒い「戻す」
- [ ] 「戻す」→ tapLight ＋ restoreTrash（知らせ「n件を戻しました」）（`App.jsx:1727`）
- [ ] 空なら「消した予定はありません」
- [ ] 30 日たったものは読み込み時に捨てる（`App.jsx:382-385`）

### 2-S13. 控えと機種変更（backup）`settingsview.jsx:469-497`
- [ ] 「端末の中の控え」：値＝最後の自動の控えの日 → openBackups（tapLight、一覧を読んでシート）（`App.jsx:5567-5571`）
- [ ] 「控えをファイルに保存」：値＝最後に書き出した日 → exportBackup：tapLight、JSON（2 段字下げ）を共有シートへ「LUKKO-控え-YYYYMMDD.json」、lastExportAt を記録、メッセージがあれば知らせ（`App.jsx:5380-5390`）
- [ ] 「ファイルから戻す」→ pickBackupFile：tapLight、隠した file input（.json）を開く。input が無ければ貼り付けを開いて「ファイルをえらべませんでした。貼り付けで戻してください。」（`App.jsx:5475-5481`）
- [ ] ファイルを読む：同じファイルを選び直せるよう値を空に戻す。5MB 超は「このファイルは控えにしては大きすぎます…」、読めなければ「ファイルを読めませんでした…」、中身の確かめで NG ならその理由。OK なら tapLight ＋ 戻す確認（`App.jsx:5483-5501`）
- [ ] 確かめ（parseBackup）の理由：JSON でない／app が 'kimatteru' でない「このアプリの控えではないようです。」／format が 2 より新しい「…アプリを最新にしてから戻してください。」／予定が無い「控えに予定が入っていません。」（`App.jsx:5504-5520`）
- [ ] 説明「毎日1回、自動でとります（7日分）」
- [ ] エラーがあれば赤字で表示（`settingsview.jsx:478-480`）
- [ ] 見出し「機種変更のとき」：1「クイックスタート」か「iCloud バックアップから復元」で移る／2 移らなかったら前の iPhone で保存→新しい iPhone で戻す
- [ ] 下線の「ファイルをえらべないときは、貼り付けで戻す」→ tapLight ＋ 開閉（中身・エラーを空にする）（`App.jsx:3148`）
- [ ] 貼り付け欄（4 行、placeholder「控えの中身を貼り付け」）。入力でエラーを消す
- [ ] 「この控えから戻す」：空なら薄く押せない。押すと askRestore（NG なら理由、OK なら tapLight ＋ 戻す確認）（`App.jsx:5522-5527`）

#### 端末の中の控えのシート `settingsview.jsx:652-664`、`App.jsx:2394-2399,5572-5578`
- [ ] 行：「日付（自動）」か「日付（戻す・取り込む前）」・›
- [ ] 押すと読んで確かめる。NG なら backupError を出してシートを閉じる。OK なら tapLight ＋ シートを閉じて戻す確認
- [ ] 空なら「まだ控えはありません」
- [ ] 箇条書き「毎日1回、自動でとります」「7日分と、月初めの3か月分を残します」

#### 戻す確認（控えから）`App.jsx:4733-4756,5906-5913,5529-5565`
- [ ] 題「控えから戻しますか？」。本文：置き換え「いま入っているn件は、控えのn件に置き換わります。」／足す「控えのn件のうち、いま入っていない予定だけを足します。同じ予定は新しいほうを残します。」＋（控えの日付）＋（読めない予定n件は戻せない）＋（予定があれば「戻す前のいまの状態は、控えとして端末に残します。」）
- [ ] 予定が 1 件以上あるときだけ「置き換えずに、足りない予定だけ足す」の選択（Web はチェック、iPhone は「置き換えて戻す」破壊的／「足りない予定だけ足す」の 2 ボタン）。予定が無いときは「戻す」1 つ
- [ ] doRestore：stampHeavy。予定があれば戻す前の状態を控え（before）に残す。足す＝ID で混ぜ、同じなら updatedAt の新しいほう、知らせ「n件の予定を足しました」。置き換え＝予定・種類・勤務先・応援・ごみ箱・棚・上書き・お知らせ・設定・既読版を入れ替え、知らせ「n件の予定を戻しました」。どちらも月表示へ

### 2-S14. ファイルで出し入れ（files）`settingsview.jsx:498-509`
- [ ] 「ファイルから取り込む」値 .ics → pickIcsFile（tapLight、隠した file input .ics/text/calendar）。読んだら取り込みの画面の「found」段へ（既にある予定を除き、種類を名前から当て、TENTATIVE は「まだ」、LUKKO が書いた実績は実績）（`App.jsx:5411-5440`）
- [ ] 「ファイルに書き出す」値 .ics → exportIcs：tapLight、「LUKKO-YYYYMMDD.ics」を共有シートへ（`App.jsx:5403-5410`）
- [ ] 「取り込んだ予定を整理する」値「n件」：取り込みで入った終日の予定（ID が i で始まる・まとめから外していない）があるときだけ → openTidy（`App.jsx:5447-5457`）
- [ ] 「最後の取り込みを取り消す（n件）」：最後の取り込みの予定が残っているときだけ → undoImport（`App.jsx:2409-2414`）
- [ ] 説明「TimeTree・Google カレンダーのファイルを取り込めます」

### 2-S15. ヘルプ（help）`settingsview.jsx:290-302`
- [ ] 「よくある質問」→ 外部 `https://kaitoiwaki.github.io/kimatteru/legal/support.html`（`App.jsx:2437`）
- [ ] 「使い方をもう一度見る」→ tapLight、onboarded=false、onboard={step0, demo:'dash', picked:今の使い方, replay:true}（`App.jsx:2436`）
- [ ] 「機能をリクエストする」→ Google フォーム（種類「機能のリクエスト」、端末「iPhone・iOS x.y」、版を事前入力）（`App.jsx:3133,101-111`）
- [ ] 「お問い合わせ」→ 同じフォーム（種類なし）（`App.jsx:3130`）
- [ ] 「利用規約」→ screen='doc', docKey='terms'（`App.jsx:2559`）
- [ ] 「プライバシーポリシー」→ docKey='privacy'（`App.jsx:2560`）

### 2-S16. 予定の種類（types）`settingsview.jsx:304-365`、`App.jsx:2256-2273,1739-1749,2083-2110,2123-2129`
- [ ] 行：色の丸・名前・ヒント（閉じているとき「名前と色」、隠していれば「隠している」）・›／⌄。隠した種類は閉じているとき薄く（.55）
- [ ] 行を押すと開閉（1 つだけ）。削除の確認は閉じる
- [ ] 開いた中身
  - [ ] 名前の入力。自分で足した種類（c…）は uWord「未確定の◯◯」・cWord「◯◯」も作り直す。組み込みは名前だけ
  - [ ] 色 12 色（#8B7AB8 #7FAE85 #D2916A #A85C6B #C7A24A #6FA8B8 #6E85BE #D0A0BC #9C7F6E #5FA8A2 #8A8A8A #55555F）。今の色は二重の輪。押すと color・paper・dark を作り直す（`App.jsx:483,1739`）
  - [ ] 呼び名 2 つ「まだのとき（点線）」例：仮押さえ／「決まったとき（塗り）」例：確定。12 文字まで、uLabel/cLabel にも入れる
  - [ ] 「n件の予定で使っています」／「まだ使っていません」
  - [ ] ↑（先頭以外）↓（末尾以外）：tapLight ＋ 1 つ入れ替え
  - [ ] 「隠す」／「出す」：tapLight。見えている最後の 1 つは隠せない（黙って何もしない）
  - [ ] 「消す」（赤）：種類が 2 つ以上のときだけ。tapLight ＋ 「予定をどの種類へ移しますか？」とほかの種類のチップ・「やめる」
  - [ ] チップを押すと deleteType：stampHeavy、予定をその種類へ移して種類を消す、消した印（type:key）、知らせ「予定を「◯◯」へ移して、種類を消しました」
- [ ] 「＋ 種類を追加」→ tapLight、新しい種類の欄を開閉（既定色 #2F72C4・名前空）、開いている種類は閉じる（`App.jsx:3279`）
- [ ] 新しい種類の欄：名前（placeholder：学校とバイト「種類の名前（例：ジム、勉強）」／ほか「種類の名前（例：通院、習い事）」）、色 12 色、「やめる」／「この種類を追加」（ボタンは選んだ色の地）（`App.jsx:4560-4569,564`）
- [ ] addType：名前が空なら「新しい種類」。key=c…、uWord「未確定の◯◯」・cWord「◯◯」。末尾に足し、作成中の予定の種類にも入れる（`App.jsx:2123-2129`）

### 2-S17. 応援する（support）`settingsview.jsx:518-578`、`App.jsx:2911-3122,1254-1268,1320-1341`、`tipjar.js`
- [ ] 上に手書き書体で「いつも使ってくださって、ありがとうございます。」「あなたの応援が、これからの開発の力になります。」
- [ ] 芽の線画（GreenStock40）150px
- [ ] 見出し「応援する」（緑）
- [ ] 3 行（App Store から取れたものだけ）：コーヒー1杯（ちょっとした応援を、気軽に。）／ランチ1回（次のアイデアのために。）／しっかり応援（もっと良いものをつくるために。）。絵・題・小さな説明・値段（緑）・›（`settingsview.jsx:523-527`）
- [ ] 商品：com.kimatteru.app.tip300（¥300）、tip600（¥600）、tip1000（¥1,000）（`tipjar.js:25-29`）
- [ ] 値段はストアの文字そのまま。円で返らないときだけ「¥300」などに置き換え（`tipjar.js:111-118`）
- [ ] 指が触れている間と、購入の返事を待つ間は沈んだ色。待つ間は値段が「…」（`App.jsx:3112-3121`）
- [ ] 押すと buyTip：返事待ちの間は二度押しを無視。tapLight。成功→ supports に {id, yen, at} を足し、お礼の小窓、settleSuccess。キャンセル→何も言わない。失敗→下に「購入できませんでした。時間をおいて試してください。」2.4 秒（`App.jsx:1320-1341`、`tipjar.js:124-148`）
- [ ] 値段は設定を開いたとき（下のタブ）に 1 回だけ取りに行く。失敗したら次に開いたときまた取りに行く。取れなければ応援の行ごと出さない（`App.jsx:1257-1268`）
- [ ] 下に手書きふうの「いつも ありがとう」（-6°傾け）と波の絵
- [ ] お礼の小窓：芽の絵・「応援、ありがとうございます！」・買ったもの（絵・題・値段）・緑の「サポーターカードを見る」（tapLight、カードへ角度 0）・「閉じる」（tapLight）。背景を押しても閉じる（`settingsview.jsx:608-626`、`App.jsx:3104-3111`）

### 2-O. はじめての案内（onboarding）`view.jsx:2185-2390`、`App.jsx:2593-2764,1442-1489`
- [ ] 出す条件：settings.onboarded が false（新しい人の既定は false、保存がある人は true）（`App.jsx:2594,520,468`）
- [ ] 画面いっぱいの覆い（z 95）。左上「←」（0 枚目では見えない）→ onboardBack（1 枚戻る、0 未満にしない、fast を解く）。右上「スキップ」→ finishOnboard(false)
- [ ] 中身を押すと演出を飛ばす（fast：全部の遅れ 0・長さ .12 秒）。ページを進めた同じ押し下げでは fast を立てない（`App.jsx:2606,1463`、`styles.css:273`）
- [ ] 下に 5 つの点（今のページは幅 18 の黒）（`App.jsx:2598-2599`）
- [ ] 見出しは一字ずつ「inkRise」で現れる。明朝 27px、折り返さない（`App.jsx:2633-2645`）
- [ ] 0 枚目：「ふだんの予定に／近いのは？」＋ 使い方 5 つ（ずらして出る、選んだものは枠が濃い）＋「予定の種類や呼び方がこれに合わせて決まります。あとから設定の「使い方」で変えられます。」。「つぎへ」は無く、選ぶと進む
- [ ] 使い方を選ぶ onboardPick：tapLight、step=1・demo='dash'。見直し（replay）で同じ答えなら何も変えない。違う答えなら applyProfile、ただし見直しのときは週のはじまり・勤務時間・空き状況の時間帯・仮の印を今のまま残す（`App.jsx:1471-1482`）
- [ ] 1 枚目：「決まった予定も、／まだの予定も。」＋ 紙のカード（今日の日付「M月D日（曜）」、塗りの予定 1 本＝遊びの色、点線の予定 1 本＝緑で「？◯◯」）
  - [ ] 見本の言葉（使い方ごと）：学校とバイト［カフェバイト／映画／このシフト、どうなりました？］、会社［打ち合わせ／定例／この仮押さえ、どうなった？］、シフト［希望休／日勤／この休み、通りましたか？］、フリー［〇〇社 打ち合わせ／納品／この仮押さえ、どうなった？］、家族［保育園の面談／歯医者／この予定、どうなりました？］（`App.jsx:2616-2619`）
  - [ ] 点線は押されるまで 2.9 秒後から息をする（tapBreath）（`App.jsx:2660-2661`）
  - [ ] 点線を押す → tapLight、demo='asking'、問いと緑の「確定した」が出る（`App.jsx:1448-1452`）
  - [ ] 「確定した」→ tapLight、demo='fill'（左から塗りが走る .3 秒）、120ms で penTick、430ms で settleSuccess ＋ demo='done'（ピルが跳ねる）（`App.jsx:1453-1459`）
  - [ ] 説明の字：まだ「↑ 点線の予定をタップしてみてください」／聞いている「押すと、この予定が塗りに変わります。」／済み「決まった、が形になりました。」（緑）（`App.jsx:2688-2691`）
  - [ ] 済みなら「もう一度みる」→ demo='dash'
  - [ ] 下に「決まっている予定は塗り、まだ分からない予定は点線です。」
  - [ ] 「つぎへ」：いつも押せる。済みなら黒、まだなら控えめな地（`App.jsx:2696-2702`）。押すと tapLight ＋ 次へ
- [ ] 2 枚目：「空いてる日が、／ひと目でわかる。」＋ 見本の一覧（3 月 ○ まる1日あいてます／4 火 △ 17:00 以降なら空いてます／5 水 × ふさがっています）＋ 説明。「つぎへ」（黒）
- [ ] 3 枚目：「予定は見せずに、／空きだけ送れる。」＋ 送る画像の見本（わたしの空いてる日、1〜21 のマス、空いてる／予定あり）＋ 説明。「つぎへ」（黒）
- [ ] 4 枚目：「いまの予定を、／持っていきますか？」＋ 説明 ＋ 箇条書き（読むだけです。書き込みはしません／入れるものは1件ずつ選べます／あとから設定でもできます）＋「アカウント登録は要りません。予定はこの iPhone の中だけにあり、どこにも送りません。」
  - [ ] 「毎朝、今日の予定をお知らせ」スイッチ（7:30 に「今日3件（うち まだ1件）」のように届きます）。押すと tapLight ＋ 切り替え（`App.jsx:2622-2624`）
  - [ ] 取り込みが使える端末：「カレンダーから取り込む」（黒）→ finishOnboard(true)、「空のまま はじめる」（白）→ finishOnboard(false)。使えない端末：「はじめる」（黒）だけ
- [ ] finishOnboard：stampHeavy、onboarded=true。毎朝をオンにしていたら morning=true・morningAt（無ければ 450）。取り込むなら screen='import'・imp を idle にして許可を聞きに行く、そうでなければ月表示（`App.jsx:1483-1489`）

### 2-N. 保存についての知らせ `view.jsx:2168-2183`、`App.jsx:2766-2774`
- [ ] 保存に失敗しているとき：上に濃い赤の帯「予定を保存できていません」「端末の空き容量を確かめてください。念のため、いま控えを書き出しておくことをおすすめします。」。押すと設定の backup 画面（貼り付けは閉じる）。必ず出す
- [ ] ファイルから戻ったとき：黒い帯「保存されていたn件の予定を戻しました」「端末の保存領域が整理されたようです。中身を確かめてください。」。押すと閉じる
- [ ] どちらも上から落ちてくる（notifDrop）

### 2-E. 何も無いときの案内
- [ ] 空き状況：予定 0 件・案内が出ていない・空き状況の画面のとき、「まだ予定がありません」＋説明 ＋（取り込める端末なら）「iPhone のカレンダーから取り込む」→ openImport（`App.jsx:2776-2782`、`view.jsx:1079-1088`）
- [ ] 月表示：予定 0 件で ✕ で閉じていないとき、浮いた案内（塗りと点線の見本・「下の ＋ から、最初の予定を置いてみてください」・取り込める端末なら「iPhone のカレンダーから取り込む」）。✕ は tapLight ＋ hintClosed=true（二度と出さない）（`App.jsx:3866-3867`、`view.jsx:770-787`）

### 2-I. 予定の取り込み（UI）`view.jsx:2392-2571`、`App.jsx:2784-2898,1572-1608`
- [ ] 開く：openImport＝screen='import'、imp={phase:'idle', found:[], type:'yoji'}。まだ許可を聞いていない人には説明を挟まずすぐ iPhone の許可を出す（runScan）（`App.jsx:1573-1584`）
- [ ] 上に「←」（設定へ）と題「予定の取り込み」
- [ ] 段 idle／scanning（最初の画面）
  - [ ] 「いま使っているカレンダーの予定を持ってくる」＋ 絵（iPhone のカレンダー → 読むだけ → LUKKO）＋「iPhone のカレンダーから読んで、ここに並べます。」（`view.jsx:9-28`）
  - [ ] エラーがあれば赤字（使えない端末「この端末では取り込みを使えません。」／断った「カレンダーを読む許可が下りませんでした。…」）。断ったときだけ「設定アプリを開く」→ tapLight、戻ったら自動でもう一度読む印を立てて設定アプリへ（`App.jsx:1590-1594,2882`）
  - [ ] 「続ける」（黒）→ runScan（tapLight、scanning、許可を聞く）。読み込み中は「読み込んでいます…」で押せない
  - [ ] 「やめる」→ 設定へ
  - [ ] たたみ「次に iPhone が聞くこと」（「追加のみ」と「フルアクセス」の 2 つ、読めるのはフルアクセス）（tapLight で開閉）
  - [ ] たたみ「Outlook や Yahoo! の予定が出てこないときは」：説明・4 手順（設定アプリ→「アプリ」→「カレンダー」（iOS 17 以前はそのまま「カレンダー」）→「カレンダーアカウント」（または「アカウント」）→「アカウントを追加」→戻って「続ける」）・TimeTree などは .ics で（`view.jsx:329-360`、`App.jsx:2873-2878`）
  - [ ] Fold の開閉は ▶ が 90°回り、中身が riseUp（`view.jsx:31-41`）
- [ ] 段 cals（どのカレンダーを読むか）
  - [ ] 「どのカレンダーを読みますか？」＋ 説明（右の札で種類、選んだ内容は次も使う）
  - [ ] 行：チェック・色の点・名前・種類の札（初めは「名前から当てる」）。行を押す＝tapLight＋選ぶ／外す（外すと薄く）。札を押す＝tapLight＋「名前から当てる」→見えている種類…と順に回す（`App.jsx:2843-2849`）
  - [ ] 「いつからの予定を読むか」：先月から（既定）／今年のはじめから／1年前から（tapLight）（`App.jsx:2852-2853`）
  - [ ] 「読み込む」：選んだカレンダーが 0 なら押せない。押すと runRead
  - [ ] 「やめる」
- [ ] 段 found（見つかった予定）
  - [ ] 題「n件の予定が見つかりました」／「予定が見つかりませんでした」
  - [ ] 説明：整理／.ics（0 件・あり）／iPhone（0 件「iPhone のカレンダーに読める予定がありませんでした。」・あり「1年先までの予定です。もう入っているものは除いてあります。…「変わった」と出ます。」）
  - [ ] 0 件で .ics 以外なら「Outlook や Yahoo!…」のたたみを出す
  - [ ] 「右の札を押すと、種類が変わります」（整理は「押すと選べます」）と「すべて選ぶ」／「すべて外す」
  - [ ] 行：チェック（緑）・（2 回目の取り込みなら「変わった（前は ◯）」か「元で消えた・消すなら選ぶ」の札）・「M/D　開始–終了」（終日は「終日」か「n日間」、まだなら「　まだ」）・名前・場所。外すと薄く（.45）。押すと選ぶ／外す
  - [ ] 種類の札（整理以外）：押すと tapLight ＋ 見えている種類の次へ（`App.jsx:2822-2828`）
  - [ ] 「n件を取り込む」：0 件なら押せない → doImport
  - [ ] 整理のとき：「n件をまとめから外す」（予定はカレンダーに残ります）→ tidySkip（tapLight、noReport を付ける）／赤の「n件をカレンダーから消す」→ tidyDelete（stampHeavy）。0 件なら押せない（`App.jsx:5459-5474`）
  - [ ] 「やめる」
  - [ ] たたみ「まとめて種類を変える」（整理以外・1 件以上）：見えている種類のチップ。選んでいるものがまとめてその種類に（`App.jsx:2803-2805`）
  - [ ] 整理の対象：取り込みで入った終日の予定。名前が誕生日・祝日などに当たるものだけ初めから選んでおく（`App.jsx:5446-5456`）
- [ ] 段 done
  - [ ] 緑の ✓ が弾んで出る（checkPop）
  - [ ] 「n件を取り込みました」／「n件をまとめから外しました」／「n件を消しました」
  - [ ] 説明：外した／消した／取り込み（「仮」「候補」の付いたものを点線で置いたならその件数、無ければ塗りと点線の説明）
  - [ ] 取り込みのとき詳細「n件を元に合わせて直しました・元で消えたn件を消しました（最近消した予定から戻せます）・場所つき n件・何日も続く予定 n件」（`App.jsx:2833-2839`）
  - [ ] 取り込みのとき「新しい予定は、下の ＋ から入れられます。」
  - [ ] 「カレンダーを見る」→ 月表示
  - [ ] 「取り込む前に戻す」：取り込み（整理でない）で 1 件以上入り、lastImport があるとき → undoImport：stampHeavy、その取り込みの予定を最近消した予定へ移し、知らせ「取り込んだn件を取り消しました」、取り込みの画面なら設定へ（`App.jsx:2841,2013-2022`）

### 2-D. 規約・プライバシーポリシー `view.jsx:2573-2598`、`App.jsx:2900-2908`、`docs.js`
- [ ] 「←」で設定へ（docKey を空に）、題＝文書の題
- [ ] 本文：導入 → 節ごとに見出しと段落（両端そろえ）→ 区切り線 →「最終更新：2026年9月29日」
- [ ] プライバシーポリシーの節：集めていない情報／入力した予定の扱い／地図を開くときについて／iPhone のカレンダーについて／iCloud での同期について／顔認証（Face ID）について／通知について／画像の共有について／子どもの利用について／方針の変更／お問い合わせ（`docs.js:10-93`）
- [ ] 利用規約の節：第1条（適用）〜第9条（準拠法）／お問い合わせ（`docs.js:95-158`）
- [ ] 連絡先 voidlabs.work@gmail.com（`docs.js:4`）

### 2-C. サポーターカード `view.jsx:2046-2142`、`App.jsx:2938-3055,1378-1440,298-328,5658-5684`、`cardflip.js`
- [ ] 「←」→ 回転を止めて設定へ。題「サポーターカード」
- [ ] 入ってくるとき cardIn の動き。下のナビは出ない（`App.jsx:2485`）
- [ ] 表：「LUKKO」「SUPPORTER」・右上 ✓（緑）？（段の色）・名前（未入力は「名前を入れる」を薄く）・「MEMBER SINCE YYYY.MM」・合計「¥n」・「n回」
- [ ] 裏：「RECORD」と 1 回ずつ「YYYY.MM.DD ¥n」（新しい順、はみ出すとスクロール）
- [ ] 段（合計金額で決まる）：ノーマル ¥0〜／ゴールド ¥1,000〜／ブラック ¥3,000〜。紙・箔・印・光・縁・粒が段ごとに違う（`App.jsx:298-311`）
- [ ] 下に「◯◯カード」「指でなぞると回せます」、次の段まで「あと ¥n で◯◯カードになります」／いちばん上「いちばん上の段です。ありがとうございます。」
- [ ] 「支えてくれて、ありがとう。」「広告なし・通信なしのままで作りつづけます。」
- [ ] 「カードに載せる名前」入力（20 文字まで、空でもよい）、「この名前も端末の中だけに保存されます。」
- [ ] 「カードをシェア」→ tapLight、カードを画像にして共有「LUKKO-サポーターカード.png」。失敗は知らせ「カードを作れませんでした」
- [ ] 押すと裏返る：tapLight ＋ 今の角度 +180 へ落ち着かせる。なぞった直後 400ms の click は無視（`App.jsx:2950-2954`）
- [ ] なぞる：6px 動くまで待ち、横が縦の 1.2 倍より大きければ回転、ほかは傾き（`App.jsx:1393-1412`）
  - [ ] 回転：カード幅いっぱいで 180°（`cardflip.js:21`）
  - [ ] 傾き：1px あたり 0.08°、上下 8°まで、下へなぞると手前が下がる（`cardflip.js:27-30`）
  - [ ] 離す：近いほうの面（180 の倍数）へ。260°/秒以上で払ったら払った向きの次の面へ（`cardflip.js:34-48`）
  - [ ] 面が変わるときだけ tapLight（`App.jsx:1421`）
  - [ ] 落ち着く時間：残り角度に比例（半回転 0.56 秒、0.16〜0.6 秒）。傾きだけ戻すときは 0.3 秒（`cardflip.js:51-55`、`App.jsx:1430`）
  - [ ] 曲線は減衰ばね（約 4% 行き過ぎて戻る）（`cardflip.js:69-75`）
  - [ ] 縦だけなぞったときも傾きは戻す（`App.jsx:1418`）
  - [ ] 触れ始めたら進行中の落ち着きを止める（`App.jsx:1385`）
- [ ] 表裏は角度ひとつから出す（90°〜270° が裏）。向こうを向いた面は opacity 0（backface-visibility は使わない）（`App.jsx:2989-3015`、`cardflip.js:14-17`）
- [ ] 影も角度から（真横でいちばん深い、2 枚の影＋縁の面取り）（`cardflip.js:86-103`）
- [ ] 斜めに流れる光（4.6 秒で一定に流れる）と、角度・傾きに連れて動く光（ジャイロは使わない）（`App.jsx:3017-3032`）
- [ ] 箔の粒（ゴールド・ブラックだけ、12 粒の決まった位置）（`App.jsx:314-317,3034-3039`）
- [ ] 箔の字は沈んで見える（上に影・下に明かり）（`App.jsx:3042-3054`）
- [ ] カードを開く入口：設定の「サポーターカード」行、応援のお礼の小窓。どちらも角度 0 から

### 2-P. 課金の診断（開発用）`view.jsx:2144-2166`、`App.jsx:3057-3078,1269-1302`
- [ ] 設定の版の字を 5 回叩くと出る（叩くたびに 1.5 秒のタイマーを張り直し、切れたら数を 0 に）
- [ ] runProbe：tapLight、「読み込み中…」→ 結果。落ちたら「診断そのものが落ちた: …」を必ず出す。値段が取れたら応援の行にも入れる
- [ ] 題「課金の状態」。行：ネイティブか／課金が使えるか／聞いた製品ID／返ってきた数／返ってきたID／エラー／ウィジェットの窓口（ある・ない）／ウィジェットへ渡した結果（渡せた（n日ぶん・n文字）・渡せなかった：理由・まだ渡していない）
- [ ] 「ウィジェットに送る」→ tapLight、前と同じでも送り直す
- [ ] 「もう一度読む」「閉じる」。背景を押しても閉じる

### 2-Bell. お知らせ（ベル）`view.jsx:2600-2664`、`App.jsx:3158-3204,5368-5371,5582-5593`、`notices.js`
- [ ] ベル（月表示の見出し）を押す → tapLight、screen='notices'。未読があれば緑の丸に数（10 以上は「9+」）（`view.jsx:664-672`、`App.jsx:3161-3162`）
- [ ] 上に「←」（月表示へ、開いた詳細も閉じる）・題「お知らせ」・右に「すべて既読」（未読があるときだけ見えて押せる、tapLight で全部既読）
- [ ] 0 件なら「お知らせはまだありません。」
- [ ] 行（新しい順）：未読の緑の点・種類の札（シフトの記録＝緑／アップデート＝灰）・相対時刻・題（未読は太字）・›。既読の行は薄く（.7）
- [ ] 相対時刻：たった今／n分前／n時間前／n日前（7 日未満）／M月D日（`notices.js:359-370`）
- [ ] 行を押す → tapLight、真ん中に詳細を開き、その時点で既読にする（`App.jsx:5582-5588`）
- [ ] 詳細：札・「YYYY年M月D日」・相対時刻・題・本文（行ごと、「・」で始まる行は点を左に出した箇条書き）・「閉じる」。シフトの知らせは緑の「実働を記録する」→ 詳細を閉じ、その予定があれば実働の記録を開く（戻り先は notices）。背景を押しても閉じる（`App.jsx:3182-3203`）
- [ ] アップデートの知らせは、開くと今の文（RELEASE_NOTES の最新の書き方）で見せる（`notices.js:278-282`）
- [ ] シフトの知らせの作り方：バイト・決まった・終日でない予定で、終わる瞬間（日またぎも正しく）を過ぎたもの。題「◯◯、おつかれさまでした」本文「働いた時間を記録しますか？（予定 開始–終了）」、時刻＝終わる瞬間。実績になった・消えたものの知らせは取り除く（`notices.js:291-319`）
- [ ] アップデートの知らせの作り方：起動時、前に見た版より新しく今の版以下の RELEASE_NOTES を足す。初めて使う人（前に見た版が無い）には出さない。版は数として比べる（0.10 > 0.9）（`notices.js:326-351`、`App.jsx:5014-5019`）
- [ ] RELEASE_NOTES の版：0.32.2／0.32.1／0.32.0／0.31.0／0.30.0／0.29.0／0.26.0／0.24.0／0.23.1／0.22.3／0.20.0／0.19.0／0.18.0／0.17.0／0.16.0／0.15.0／0.14.0／0.13.0／0.12.2／0.12.1／0.12.0／0.11.2／0.11.1／0.11.0／0.10.0／0.9.0／0.5.0／0.3.0（`notices.js:17-275`）
- [ ] 未読＝read が false のもの（`notices.js:353`）

### 2-T. 知らせのひとこと（トースト）`view.jsx:2666-2672`、`App.jsx:3560-3569,1313-1318`
- [ ] 黒い角丸の 1 行。画面をふさがず、タップも受けない（下を押せる）。capRise で出る
- [ ] まとめカード・空き共有の画面では出さない（それらは画面の中に出す）
- [ ] 位置：下のナビが出ていればナビの上 8px、無ければ下から 30px
- [ ] toast(msg, ms=2400)：呼ぶたびに消える時刻を延ばす

### 2-K. まとめカード（月／年）のプレビュー `view.jsx:1922-1960`、`App.jsx:3298-3342,5336-5347,5686-5752`
- [ ] 開く：まとめから「今月」（cardKind='month'）か「今年」（'year'）。どちらも tapLight。戻り先を覚える（`App.jsx:3449-3450,2494`）
- [ ] 地は暗色固定（#1A1A1A）。左上「閉じる」→ 来た画面へ。題「今月のまとめ」／「今年のまとめ」
- [ ] プレビューは書き出す PNG そのもの（最大幅 340px、角丸・影）。できるまでは 1080:680 の薄い箱
- [ ] PNG は [種類・年・月・予定の数・勤務先の数] が変わったときだけ作り直す（`App.jsx:5340-5346`）
- [ ] 「画像にしてシェア」→ tapLight、「LUKKO-まとめ-YYYY-M.png」／「LUKKO-まとめ-YYYY.png」を共有。失敗は「画像を作れませんでした」（`App.jsx:5716-5751`）
- [ ] 説明「金額は時給と実働から出した目安です。割増や交通費は入っていません。」
- [ ] 知らせはこの画面の中に小さく出す
- [ ] 中身（sharecard.js）：月＝「YYYY年 M月」・バイトの実績の金額・時間・日数・勤務先ごと／年＝金額（使い始める前の額を足し「うち ¥n は使い始める前の分」）・時間・勤務先ごと・月ごとの時間（`App.jsx:5687-5714`）

### 2-R. まとめ（働いた時間）
- [ ] `v.reportShown`（screen='report'）のとき `<Report v={v} />` を出す（`view.jsx:2043-2044`）。中身は別の部（Report・ReportMonth・ReportYear・ReportYearWage `view.jsx:77-255`）

### 2-X. 値は作っているが画面に出ていないもの（作り直しで要否を決める）
- [ ] まとめカード：cardWhen・cardWageParts・cardSub・cardJobs・cardEmpty・cardAspect・cardBars・cardIsYear（プレビューは PNG だけを使う）（`App.jsx:3308-3339`）
- [ ] 取り込み：impTypeChips・impPreview・impMore・impGuessText（`App.jsx:2797-2800,2887-2897`）
- [ ] 設定：supportGroupShown・tipOpen・tipHeadStyle・onToggleTip・supportThanks・contactEmail・typeListOpen・typeMoreLabel・lastBackupText・lastExportText・migrateOpen・darkTrack/onToggleDark・jobsEmpty・各種 Label（themeLabel・freeWdLabel など）・canNotify（`App.jsx:2303,2312-2314,2390-2392,2415-2416,3082-3102,3124-3128,3282-3289,3293`）
- [ ] renderVals の typeRows（`App.jsx:3220-3228`）と jobRows（`App.jsx:4231-4241`、削除が確認なしで removeJob）は、設定画面では `_settingsVals` が上書きする

## 3. 計算と判定のルール

### 3.1 日付と複数日
- [ ] 日番号 `dayNo(y,m,d)=floor(Date.UTC(y,m,d)/86400000)`（UTC で数えるので夏時間・時差の影響なし。月日のあふれは Date.UTC 任せ）`App.jsx:133`
- [ ] `fromDayNo(n)` は UTC で y/m/d に戻す `App.jsx:134`
- [ ] 続く日数 `evSpan = max(1, min(60, days|0 || 1))`。days 無し・0・不正は 1、上限 60 `App.jsx:139`（timegrid.js:14・eventctx.js:12 も同じ式）
- [ ] `evFrom`=開始日番号、`evTo`=evFrom+span-1、`evCovers(e,n)` は from≤n≤to `App.jsx:140-143`
- [ ] 日またぎ（days>1）は終日の予定だけ。保存時、時間指定なら span=1 に畳む。span>1 のときだけ `days` を持たせ、1 なら undefined `App.jsx:130,2135-2136`
- [ ] 範囲ラベル `spanLabel`：「8/25〜8/27」。年をまたぐときだけ終わり側に「2027/」を添える `App.jsx:835-838`
- [ ] `dayKey(y,m,d)` = `y-m-d`（m は 0 始まりのまま）。手動○△×のキー `App.jsx:443`
- [ ] `shiftMonth(ym,n)` は `new Date(y, m+n, 1)` で年をまたいで繰る `App.jsx:445-448`
- [ ] `todayParts()` は端末ローカル時刻の y/m/d `App.jsx:434-437`
- [ ] 月表示の帯の段数 `MAX_LANES=4`（超えたら「+N件」）、帯高 15・字 10・段高 17 `App.jsx:168-173`
- [ ] 時刻の分の刻み `MIN_STEP=5` 固定。ホイールの分は 0〜55、時は 0〜23 にクランプ `App.jsx:177,494`
- [ ] 作成画面で開始を動かすと、終わりも同じ差だけ動く（長さを保つ。`addMin` で 24h 折り返し）。終わりを動かしたときは終わりだけ `App.jsx:491-494`
- [ ] 「確定した」小窓でも開始を動かすと終わりが付いてくる。ただし worked（働いた記録）モードでは終わりは動かない `App.jsx:501-503`
- [ ] URL・電話番号の切り出し `linkify`：`https?://` から空白（半角/全角）まで／電話は `0\d{1,4}-\d{1,4}-\d{3,4}`・`0[5789]0\d{8}`・`0\d{9}`。電話の href は `tel:`＋ハイフン除去 `App.jsx:149-162`
- [ ] 予定 id は `prefix + Date.now().toString(36) + 乱数5文字` `App.jsx:330`

### 3.2 読み込み時の整形（sanitize）
- [ ] `sanitizeEvents`：配列でなければ []。y/m/day が有限数でない・m が 0〜11 外・day が 1〜31 外のものだけ捨てる（月の日数との整合は見ない）`App.jsx:341-347`
- [ ] 時刻の形 `^([01]?\d|2[0-3]):[0-5]\d$`（「9:00」も可）。start 不正→`09:00`、end 不正→start と同じ `App.jsx:339-349`
- [ ] `00:00〜23:59` の予定は終日扱い（allDay=true にする）`App.jsx:350-353`
- [ ] id が空/非文字列→`uid('x')`、title 非文字列→「無題」、actualEnd は形が正しいときだけ残す、want は長さ2の配列のときだけ残す `App.jsx:354-363`
- [ ] 種類 `typesOk`：空でない配列で、全要素が key/name/color を文字列で持つ。崩れていれば既定の種類に戻す `App.jsx:369-371,465`
- [ ] 応援 `sanitizeSupports`：yen と at が有限数のものだけ `App.jsx:373-375`
- [ ] 勤務先 `sanitizeJobs`：id が文字列・hourly が有限数のものだけ `App.jsx:377-379`
- [ ] 棚 `sanitizeSomeday`：id/title が文字列、when が week/month/next/someday のものだけ `App.jsx:395-399`
- [ ] 種類の合成 `mergeTypes`：保存側を優先して組み込みの項目を埋め戻す。旧既定色（yoji #534AB7 / baito #1D9E75 / asobi #D85A30 / other #5A6570）のままなら color/paper/dark を新しい既定に入れ替える。並びは組み込み順、自作の種類（組み込みに無い key）は足した順で後ろ `App.jsx:407-430`
- [ ] 起動時：保存があれば settings に `onboarded:true` を先に入れ、保存値で上書き（既存ユーザーには案内を出さない）`App.jsx:468`
- [ ] 既定 settings：hourly 1120・weekStart 0・remind true・hideCanceled false・dark false・priorWage {} `App.jsx:520-522`
- [ ] 組み込みの種類と既定の言い回し：用事(uWord まだ分からない用事/cWord 確定した用事)・バイト(希望シフト/確定シフト、既定 17:00–22:00)・遊び(候補日/約束)・その他(未確定の予定/予定) `App.jsx:527-534`
- [ ] 追加の種類 work（仮押さえ/確定・gone「流れた」）・off（希望休/休み・gone「通らなかった」・free:true・allDayDefault:true）・family（まだの家族の予定/家族の予定）`App.jsx:56-63`
- [ ] 種類の色から paper=白へ .62 寄せ＋透明度 .72、dark=黒へ .5 寄せ（四捨五入）`App.jsx:40-41,604-605`

### 3.3 くり返し
- [ ] くり返しは規則で持たず、保存時に実体の予定を並べて作る（1回ずつ確定/未確定が違うため）`App.jsx:179-181`
- [ ] 単位：day 毎日 / weekday 平日 / week 毎週 / biweek 2週ごと / month 毎月◯日 / nth 毎月 第◯曜日 / monthEnd 月末 / year 毎年 `App.jsx:183-192`
- [ ] 期間の選択肢（月数）：day・weekday 1/3/6、week 1/3/6/12、biweek 3/6/12、month・nth・monthEnd 6/12/24、year 36/60/120。未知の単位は week の表 `App.jsx:195-207`
- [ ] 第◯の表示：1〜4=第1〜第4、5=「最終」`App.jsx:206`
- [ ] 本体のあとに作る数の上限 `MAX_REPEAT=200`（本体は数えない）`App.jsx:208`
- [ ] `repeatAfter` は本体を含まない日番号の配列。未知の単位は [] `App.jsx:214-215`
- [ ] 終わり `limitN = dayNo(y, m+spanMonths, d)`（Date.UTC のあふれ：1/31＋1か月→3/3 など）。fromN<n≤limitN だけ入れる `App.jsx:217-219`
- [ ] day：翌日から limitN まで毎日 `App.jsx:224-227`
- [ ] weekday：月〜金だけ（祝日は除かない）`App.jsx:228-231`
- [ ] week/biweek：曜日を選んでいればその曜日、無ければ本体の曜日。biweek は「本体の週（日曜はじまり固定：week0=fromN−本体の曜日）」を 0 として `floor((n-week0)/7)` が偶数の週だけ `App.jsx:232-242`
- [ ] nth：第◯の既定は `min(5, floor((d-1)/7)+1)`（29〜31日→5＝最終）。複数の曜日×複数の第◯を選べる。第k=`first+7(k-1)`、最終=`first+7*floor((dim-first)/7)`。その月に無い第5（k≤4以外）は置かない。月は i=0〜spanMonths+1 を見て limitN で切る。月内は重複除去・昇順、最後に全体を昇順 `App.jsx:243-263`
- [ ] monthEnd：各月の末日（本体が月末かどうかは見ない）`App.jsx:250`
- [ ] month/year：暦で 1 か月／12 か月ずつ進める。その月に無い日（31日の2月、2/29 の平年）は飛ばす（近い日に寄せない）。月初が limitN を超えたら終わり `App.jsx:264-273`
- [ ] 保存：くり返しの日が1つでもあれば全件に同じ `repId=uid('r')` を付ける。本体の日＋複数日（extraDays）＋くり返しの日をまとめて置く（くり返しは本体の日からだけ。重複除去はしない）`App.jsx:2193-2199`
- [ ] 新規の既定：repEvery null・repSpan 3・repDows []（repNth は未設定）`App.jsx:1187`
- [ ] 編集・コピーではくり返しを付け直せない（repEvery null で開く）`App.jsx:1197,1224`
- [ ] くり返しの1件を編集して保存：同じ repId で自分より後（evFrom が大きい）が1件以上あれば「この予定だけ／これ以降すべて」を聞く（repEditAsk.rest に件数）`App.jsx:2150-2153`
- [ ] 「これ以降すべて」：後ろの予定には、元の予定から変わった項目（type/title/start/end/allDay/days/remindMin/place/memo/link/secret/status）だけを当てる。比較は JSON 文字列（null と undefined は同じ）。実績を直しているときの end は当てない。日付を動かした日数ぶん、後ろも同じだけずらす。jobId は後ろに当てない `App.jsx:2161-2177`
- [ ] 削除の「これ以降ぜんぶ」：同じ repId で evFrom が自分以上のものを消す（前の分は残す）`App.jsx:1678-1684`

### 3.4 種類と使い方（profiles）
- [ ] 使い方は student/work/shift/free/family。未設定・不明は student `App.jsx:75-93,542`
- [ ] student：種類 用事・バイト・遊び・その他／週はじまり 日(0)／空きを見る時間 平日・休日とも 9:00–22:00（540–1320）／勤務時間なし `App.jsx:76-78`
- [ ] work：仕事・用事・遊び→「プライベート」・家族・その他／週 月(1)／平日 19:00–23:00（1140–1380）・休日 10:00–22:00（600–1320）／勤務時間 月〜金 9:00–18:00（540–1080）`App.jsx:79-81`
- [ ] shift：バイト→「勤務」・休み・用事・遊び→「プライベート」・その他／週 日／9:00–22:00 両方／勤務時間なし `App.jsx:82-84`
- [ ] free：仕事・バイト→「副業」・用事・遊び→「プライベート」・その他／週 月／10:00–22:00 両方／勤務時間なし `App.jsx:85-88`
- [ ] family：家族→「子ども・家族」・仕事・用事・遊び→「自分」・その他／週 日／9:00–21:00 両方（540–1260）／勤務時間なし `App.jsx:89-91`
- [ ] `applyProfile`：並びの種類を先頭に順に並べ、無ければ追加の種類から足す。隠していたら表に出す。名前は「既定名か、どれかの使い方が付けた名前」のときだけ付け替え（本人が変えた名前は残す）`App.jsx:573-587`
- [ ] 並びに無い種類は隠す（消さない）。自作（key が `c` で始まる）は隠さない。隠すものの名前は手つかずなら既定名に戻す `App.jsx:588-590`
- [ ] 使い方の設定値：profile・weekStart・freeWd・freeHd・workHours（無ければ null）・kariMark（work と free だけ true）`App.jsx:591-593`
- [ ] `setProfile`：すでに onboarded の人は週のはじまりを今のまま保つ。「バイト先をまとめて辞めた」を選ぶと全勤務先 retired＋wageFeature 'auto'。トースト「「◯◯」に合わせました。予定はそのままです」`App.jsx:2073-2081`
- [ ] `words()`：student だけ「バイト先／バイト先なし／バイト先を追加／このバイト先を追加／バイトと給料／おつかれさま」、ほかは「勤務先／…／働いた時間と給料／お疲れさまでした」`App.jsx:547-566`
- [ ] `words().shift`：baito の名前が「バイト」以外ならその名前、そうでなければ student→「バイト」・ほか→「勤務」`App.jsx:549-550`
- [ ] 例文：titleEg は work/family/shift/free で別、student は「タイトル」。placeEg・typeEg・jobEg は student と それ以外で2種 `App.jsx:556-564`
- [ ] `T(key)`：種類→無ければ追加の種類→無ければ先頭の種類 `App.jsx:539`
- [ ] `visibleTypes`：hidden 以外。全部隠れていたら全部 `App.jsx:541`
- [ ] 最後の1つの見えている種類は隠せない `App.jsx:2088-2095`
- [ ] 種類の並べ替えは隣と入れ替え（端では何もしない）`App.jsx:2083-2087`
- [ ] 種類を消す：その種類の予定を別の種類へ移してから消す（予定は消さない）。消した印 `type:<key>` `App.jsx:2098-2105`
- [ ] 呼び名（まだ/決まった）は 12 文字まで。uWord と uLabel（または cWord と cLabel）を同じ値にする `App.jsx:2107-2110`
- [ ] 名前を変える：自作の種類だけ uWord=「未確定の」＋名前、cWord=名前 も作り直す。組み込みは名前だけ `App.jsx:1744-1749`
- [ ] 種類を足す：名前が空なら「新しい種類」、key=`uid('c')`、uWord/cWord を名前から作る。作りかけの予定の種類にする `App.jsx:2123-2129`
- [ ] 種類を変えたとき、時刻が「前の種類の既定」のままなら新しい種類の既定に合わせる（本人がいじっていれば残す）`App.jsx:2115-2122`
- [ ] 種類の既定時刻は defStart/defEnd、無ければ 10:00–11:00 `App.jsx:1160-1161`

### 3.5 時間・給料・休憩・深夜・明け
- [ ] `mins("HH:MM")`=h*60+m、`addMin` は (分+d+1440)%1440 で 24 時折り返し、`fmtMin` は 2 桁ゼロ埋め `App.jsx:667-668,825`
- [ ] `hoursBetween(a,b)`：差が負なら +1440（翌日終わり）。同時刻は 0 時間 `App.jsx:669`
- [ ] 翌日終わり `endsNextDay`：終日以外で、（actualEnd||end）が start より前（同時刻は対象外）`whenlib.js:14-18`
- [ ] 翌日に「続き」を出すか `spillsNextDay`：endsNextDay かつ終わりが 0:00 より後（17:00–0:00 は翌日に出さない）`whenlib.js:24`
- [ ] 実際に終わる瞬間 `endMoment`：翌日終わりなら day+1 の終わり時刻 `whenlib.js:27-31`
- [ ] その日のふさがり終わり `busyEndMin`：翌日終わりなら 1440、そうでなければ終わりの分 `whenlib.js:38`
- [ ] 時刻の区間 `segmentsForDay`：終日は除く。終わりは実績なら actualEnd||end、それ以外は end。開始日には [start, 終わり]（折り返し・同時刻なら [start,1440]）。前日に始まった折り返しは [0,end]、同時刻（=24時間・当直とみなす）は [0,start]。0 になる続きは出さない `timegrid.js:24-38`
- [ ] 休憩 `breakMin`：正の数のときだけ、上限 600 分。無ければ 0 `App.jsx:788`
- [ ] 給料の対象時間 `paidHours = max(0, hoursBetween(start, actualEnd||end) − 休憩/60)`（状態にかかわらず actualEnd があれば使う）`App.jsx:794-797`
- [ ] 給料 `wage`：バイト（type 'baito'）だけ。`round(paidHours × 時給)`、ほかは 0 `App.jsx:798`
- [ ] 時給 `hourlyFor`：予定に書き込んだ hourly（有限数）→勤務先の今の時給→設定の時給 の順 `App.jsx:782-786`
- [ ] 働いた記録を付けるとき（worked）：その時点の時給（hourlyFor）を ev.hourly に書き込む。記録し直すときは前に書き込んだ時給がそのまま使われる `App.jsx:1758-1765`
- [ ] worked で保存するもの：status 'jisseki'・start・actualEnd=小窓の終わり・休憩（>0 のときだけ）・hourly（バイトのとき）。予定の end は変えない `App.jsx:1763-1764`
- [ ] 小窓を開くとき：worked で既に実績なら終わりは actualEnd||end から。confirm で want があれば want[0]/want[1] から `App.jsx:1729-1736`
- [ ] 勤務先の時給を変えたとき：その勤務先の実績で hourly を持たないものに「前の時給」を書き込んでから変える（最初の1回だけ）。rateNote を立てる `App.jsx:1500-1507`
- [ ] 「いまの時給で数え直す」：その勤務先の実績から hourly を外す（本人が選んだときだけ）`App.jsx:1509-1513`
- [ ] 勤務先を辞めた（retired）：選ぶ所から消えるが記録・時給は残る `App.jsx:1515-1518`
- [ ] 勤務先を消す：実績は jobId を残したまま hourly（無ければ勤務先の時給）と jobName を書き込む。実績以外は jobId を外す。消した印 `job:<id>` `App.jsx:1519-1531`
- [ ] 勤務先を足す：時給の既定は設定の時給。作成画面から足すとき名前が空なら words().job `App.jsx:1492-1496,1547-1558`
- [ ] 勤務先を選ぶと題名をその名前にする。ただし本人が前の勤務先名と違う題名を書いていたら残す `App.jsx:1533-1541`
- [ ] 保存時、jobId は種類がバイトのときだけ持たせる `App.jsx:2157,2205`
- [ ] 使い始める前の額 `priorFor(y)`：年ごとの値。正の有限数だけ、四捨五入、上限 99,999,999。0 を入れると消す。金額だけに足し、時間・日数には足さない `App.jsx:808-822,3400-3406`
- [ ] 入力欄は数字以外を除き 8 桁まで `App.jsx:3412-3413`
- [ ] 時間の書き方 `fmtHours`：H=floor、M=round(端数×60)。1時間未満で分があれば「30分」、分が 0 なら「6時間」、それ以外「6時間30分」。0 は「0時間」`App.jsx:824`
- [ ] 金額の書き方 `fmtWage`：「¥」＋ ja-JP の 3 桁区切り。主役表示は記号と数字を分ける `App.jsx:670-674`
- [ ] お知らせの言い方 `remindLabel`：数でなければ「なし」。終日は 0→「当日の朝」、それ以外 min/1440「日前」。時間指定は ≥1440→日前、≥60→round(min/60)「時間前」、それ未満「分前」`App.jsx:827-833`
- [ ] 時間の箱（週・日の時間表示）：1 時間 44px、上 = a/60×44+1、高さ = max(16, (b−a)/60×44−2)、高さ ≥28×文字倍率なら「開始–終わり」（実績は actualEnd）を出す、続きは題名の頭に「↳ 」`App.jsx:1073-1093`
- [ ] 重なりの列 `layoutColumns`：各区間を最低 15 分に伸ばし、開始の早い順（同じなら長い順）。かたまり（前の終わり以後に始まるまで）ごとに列数を決め、空いている左の列から詰める `timegrid.js:45-70`
- [ ] 終日の帯は最大 2 本、残りは数だけ `App.jsx:1095-1103`
- [ ] 週のはじまりの日番号 `weekStartNo = dayNo − ((曜日 − weekStart + 7) % 7)` `timegrid.js:79-82`

### 3.6 状態（kakutei / mikakutei / jisseki / nakunatta）
- [ ] kakutei＝決まった（塗り）、mikakutei＝まだ（点線）、jisseki＝実績（働いた記録・塗りで少し薄い）、nakunatta＝無くなった（取り消し線・薄い）`App.jsx:995-998`
- [ ] 状態の言葉 `statusWord`：まだ→種類の uWord、実績→「実績」、無くなった→種類の gone か「無くなった」、決まった→cWord `App.jsx:1104-1110`
- [ ] 帯の文字 `pillText`：まだ→「？」＋題名、実績→給料表示オンかつバイトなら金額、それ以外「✓」＋題名 `App.jsx:1000-1004`
- [ ] `pillParts`：月表示（compact）でまだの印は kariMark オンなら「仮」、オフなら無し。詳細側は「？」。実績は「✓」。帯の開始時刻設定（barTime）オンなら時刻を頭に（:00 は時だけ「10」、それ以外は先頭 0 を落として「9:30」）。明け（ake）は題名だけ。シフトの型（sym）は月表示で記号を印に `App.jsx:1009-1021`
- [ ] 新規の既定状態は kakutei。コピーは まだ→まだ、それ以外→kakutei（実績・無くなったは決まったにして写す）`App.jsx:1187,1219`
- [ ] 保存で状態がまだなら want=[start,end] を書く（新規だけ。編集では want を変えない）`App.jsx:2206,2155`
- [ ] 編集の保存：実績なら end は変えず actualEnd=入力の終わり。実績以外は end を入力の終わりにし actualEnd を消す `App.jsx:2158-2159`
- [ ] 「確定した」：まず start/end を小窓の値に、want=[元の開始, 元の終わり]。約 760ms 後に status 'kakutei'、confirmCount+1。月表示へ移り、その予定の月を開く `App.jsx:1766-1784`
- [ ] 「無くなった」：status 'nakunatta'。取り消しの帯「「◯◯」を（gone）にしました」`App.jsx:1840-1843`
- [ ] まだの予定を押したとき：その日が今日以前なら「どうなった？」小窓、先の日付なら詳細を開く（無くなった予定も詳細を開ける）`App.jsx:1113-1124`
- [ ] この月の希望をまとめて確定：表示中の月（開始の y/m）で まだ かつ バイト or 休み を kakutei に。無ければ「この月の希望は、もう全部決まっています」`App.jsx:2060-2069`

### 3.7 空き状況 ○△×
- [ ] `dayFree(y,m,d)`：祝日・土・日は休日の時間（freeHd）、それ以外は平日の時間（freeWd）。無ければ 540–1320 `App.jsx:853-858`
- [ ] 見る予定：無くなった以外で、その日を覆うもの＋前日に始まって翌日にはみ出す時間指定（spillsNextDay）`App.jsx:860`
- [ ] 重ねて表示中の iPhone の予定も数える（設定 overlayFree オンのとき）。overlay の範囲は endsNextDay なら翌日まで `App.jsx:861,1894-1898`
- [ ] 「休み」の種類（free:true）は空いている扱いでふさがりに入れない。決まった/実績の休みがある日は勤務時間も外す `App.jsx:859,862-864,871`
- [ ] 決まった（kakutei/jisseki）終日の予定がその日を覆う、または overlay に終日があれば × `App.jsx:865`
- [ ] ふさがり＝決まった予定の区間＋overlay の区間＋いつもの勤務時間（休日でなく・休みの日でなく・その曜日が days に含まれるとき）。見る時間で切り、開始順に並べて重なり・接するものを合併 `App.jsx:867-873`
- [ ] 空き＝見る時間の中で 60 分以上のすき間だけ。1つも無ければ × `App.jsx:874-878`
- [ ] ふさがりが無い：まだ（mikakutei）が見る時間にかかる（または まだの終日がある）なら △ adjust（先頭のまだがバイトなら「まだ希望を出しただけです」、それ以外「まだ候補なので調整できます」）、無ければ ○（full）`App.jsx:879-883`
- [ ] ふさがりがある：△ partial。空き1つなら 終わりが窓の端→「HH:MM以降なら空いてます」、始まりが窓の端→「HH:MMまでなら空いてます」、それ以外「HH:MM〜HH:MM なら空いてます」。複数なら「以降／まで／〜」を「・」でつなぎ「 なら空いてます」 `App.jsx:884-888`
- [ ] 手動の○△×：overrides[dayKey] が自動判定より優先。押すたび ○→△→×→○。次が自動と同じなら上書きを消す `App.jsx:983`
- [ ] 文字の1日ぶん `freeText`：× は出さない。○（上書き or 自動 full）は 窓が 10:00 以前〜21:00 以降を含めば「終日」、窓の終わりが 22:00 以降なら「19時以降」、それ以外「9時〜21時」。上書き△で空きが無ければ「時間しだい」（ていねい版「時間によっては可」）。それ以外は空きを「、」でつなぐ。形は「10/3（金）19時以降」。時刻は分が 0 なら「19時」、それ以外「19:30」`App.jsx:891-908`
- [ ] 送る設定の既定：範囲 2w・全部・ていねい版は student 以外で既定オン・名前空・署名なし（保存値で上書き）`App.jsx:910`
- [ ] 言い回し：ていねい版「◯◯の空き状況」「N月の空き状況」凡例 終日可/時間によって可/予定あり、ふつう版「わたしの空いてる日」「N月のあいてる日」凡例 空いてる/時間による/予定あり `App.jsx:912-917`
- [ ] 画像のマス `freeCells`：週のはじまりに合わせて空白を置く。今日より前は past。○→free、△→part、×→busy。上書きの無い○で窓が 10:00–21:00 を覆わなければ part にして「開始時刻〜」、△は最初の空きの開始を「〜」で添える `App.jsx:922-938`
- [ ] 文字でまとめる範囲 `freeTextBlock`：2w＝今日〜13日後、week＝今日〜今週末、next＝来週の頭〜来週末、month＝空き状況で見ている月（今日より前は除く）。only wd/hd で平日・休日（祝日含む）に絞る `App.jsx:940-955`
- [ ] 1行も無ければ「この期間は空いてる日がありません」（ていねい版「この期間は、あいにく空いている日がありません。」）。ていねい版は各行頭「・」、前に「（名前の）空いている日程です。」、後に「ご都合のよい日をお知らせください。」。ふつう版は先頭「空いてる日」`App.jsx:956-960`
- [ ] `freeJudge(evs)`（旧式・固定 9:00–22:00。App.jsx 内では呼ばれていない）：予定無し○／決まった無し△adjust／決まった終日×／合併1つで窓を覆えば×／開始≤10:00→「以降」、終わり≥20:00→「まで」、それ以外「〜 以外なら」／複数「一部の時間なら空いてます」`App.jsx:962-982`

### 3.8 候補日
- [ ] 候補日：状態がまだ・「どれか1日に決まる」(cand) オン・ほかの日（extraDays）が1つ以上のとき、全件に同じ `candId=uid('k')` `App.jsx:2200-2201`
- [ ] 候補の1つを確定したら、同じ candId で まだ のほかの予定があれば「ほかの候補を片づけるか」を聞く（勝手には消さない）。無ければ確定の取り消し帯 `App.jsx:1779-1783`
- [ ] 片づける：残りを nakunatta にする。取り消し帯「ほかの候補N件を片づけました」（kind many で まだ に戻せる）`App.jsx:1831-1839`
- [ ] 複数日えらび：本体の日は外せない。ほかの日は `y-m-d` キーで出し入れ `App.jsx:1561-1570`

### 3.9 移動・延期・いつか（棚）
- [ ] 延期 `moveEvent`：日付を移し状態は押したボタンの値。movedFrom は最初の元の日を保つ（2回目以降も変えない）。表示月を移動先に。取り消し帯「「◯◯」をM月D日に動かしました」`App.jsx:1790-1799`
- [ ] 棚へ `toSomeday`：予定をカレンダーから外し、when・題名・種類・今日の日付・中身（状態は まだ）を持つ棚の項目にする。消した印に予定 id を入れる（最近消した予定には入らない）`App.jsx:1804-1813`
- [ ] 新規で日にち未定を選んで保存：棚に置く（状態 まだ）`App.jsx:2182-2191`
- [ ] 棚から日を決める `placeSomeday`：中身があればそのまま（id も保つ）、無ければ種類の既定時刻で作る。状態は まだ（点線）。表示月をその月に。棚の id を消した印へ `App.jsx:1815-1823`
- [ ] 棚から捨てる `dropSomeday`：中身があれば最近消した予定へ（someday 付き）`App.jsx:1824-1829`
- [ ] 棚の呼び名：今週のどこか／今月のどこか／来月あたり／いつか `App.jsx:396`
- [ ] 月表示の上の棚に出す条件：someday は今の月を見ているときだけ、next は置いた月の翌月、week・month は置いた月 `App.jsx:3549-3553`
- [ ] 棚が1件なら「（呼び名）：題名」、複数なら「日にち未定 N件」`App.jsx:3555`
- [ ] 日を決める小さなカレンダー：無くなった以外の予定が覆う日は地を灰色に `App.jsx:3541-3544`

### 3.10 削除・ゴミ箱・取り消し
- [ ] 削除：消したものは「最近消した予定」（trash）に {ev, at} で先頭に足し、最大 400 件 `App.jsx:1686-1689`
- [ ] 詳細で開いていた予定を消したら、戻り先へ（戻り先が detail なら月表示）`App.jsx:1690`
- [ ] 取り消し帯：1件「「題名」を削除しました」、複数「N件を削除しました」。5 秒で消える `App.jsx:1691-1703`
- [ ] 取り消し：del は最近消した予定から戻す、status は前の値に戻す、many は件ごとの前の値に戻す `App.jsx:1704-1713`
- [ ] 戻す `restoreTrash`：予定はもう一度 sanitize し updatedAt を今に（iCloud の消した印に負けないため）。同じ id があれば置き換え。棚から消したものは棚へ戻す。トースト「N件を戻しました」 `App.jsx:1715-1728`
- [ ] 保持期間 `TRASH_DAYS=30`。30日たったものは捨てる（起動時の _pruneTrash と読み込み時）`App.jsx:382-385,5834-5838`
- [ ] 消した印 gone：[id, 時刻]、30日・最大 800 件。新しい印を先頭に `App.jsx:389-392`
- [ ] シフト入力で同じ型を同じ日にもう一度押すと外す（最近消した予定へ、取り消し帯付き）。実績は外せない（「働いた記録は、シフト入力では外せません」）`App.jsx:2042-2050`
- [ ] 取り込みの取り消し：id が `tag-` で始まる予定をまとめて最近消した予定へ `App.jsx:2013-2022`

### 3.11 シフト入力（型）
- [ ] 型は辞めていない勤務先の templates から。キー `勤務先id:(型id か 番号)` `App.jsx:2026-2030`
- [ ] 型が無ければ設定の勤務先へ案内（トースト）`App.jsx:2031-2037`
- [ ] 置く予定：終日の型→種類 off（題名 既定「休み」・00:00–23:59）、それ以外→バイト（題名 型名→勤務先名→「勤務」、時刻は from%1440・to%1440）。休憩 brk、記号 sym、stampKey。まだで置くなら want も。off の種類が無ければ足す `App.jsx:2051-2058`

### 3.12 作成・編集・コピーの初期値
- [ ] 新規：種類は前回の種類（lastType、隠れていれば見えている先頭）`App.jsx:1171-1173`
- [ ] 時刻の空き所を押したとき：開始=押した分（0〜1410 にクランプ）、終わり=開始+60（最大 23:59）`App.jsx:1177`
- [ ] 今日の予定で種類に既定時刻が無いとき：次の 30 分区切り `ceil((今の分+1)/30)*30`（いまちょうど区切りでも次へ）。22:00 を超えるなら既定 10:00–11:00 のまま `App.jsx:1178-1181`
- [ ] 終日の初期値：明示があればそれ、無ければ種類の allDayDefault（時刻を押して開いたときは終日にしない）`App.jsx:1184`
- [ ] お知らせの初期値：終日なら remindAllDay、時間指定なら remindTimed（数のときだけ）`App.jsx:1185`
- [ ] 勤務先の初期値：辞めていない最初の勤務先 `App.jsx:1186`
- [ ] 編集：実績なら終わり欄は actualEnd||end。場所・リンク・メモは入っているものだけ行を出す `App.jsx:1191-1200`
- [ ] コピー：実績の記録（actualEnd）・repId・want・candId・hourly・休憩は持っていかない。日付えらびを開いた状態で開く `App.jsx:1201-1226`
- [ ] 書きかけ判定 `draftDirty`：新規は題名・場所・メモ・リンクのどれかが空白以外なら。編集は題名/種類/開始/終わり（実績は actualEnd）/日付/状態/終日/場所/メモ/リンク のどれかが元と違えば `App.jsx:1243-1252`
- [ ] 保存：題名が空なら「無題」。場所・メモ・リンクは前後空白を落として空なら持たない。secret は true のときだけ。lastType を覚える `App.jsx:2139-2144,2155`
- [ ] 保存後の戻り先：day/list/detail/free/month のうち開く前の画面（detail は月表示へ）。それ以外は月表示。表示月は予定の月 `App.jsx:2146,2173,2207`
- [ ] 保存時の入力チェック（終わり<開始 など）は save の中には無い `App.jsx:2131-2208`
- [ ] 予定を書き換えるときは必ず updatedAt を今にする `App.jsx:1752`
- [ ] 予定を送る文：「10/3（金）19:00〜21:00 題名 @場所（まだ仮）」、終日は「 終日」/「からN日間」。場所が URL でなければ Apple マップのリンクも、.ics 1件を添える `App.jsx:1232-1241`

### 3.13 まとめ集計
- [ ] 数える予定：kakutei と jisseki。まとめに入れない（noReport）は除く。月・年は開始日の y/m で振り分け `App.jsx:3350-3352`
- [ ] 種類ごとの時間 `spentHours`：終日は 0（日数で別に数える）、バイトは paidHours（休憩引き・actualEnd 優先）、ほかは hoursBetween(start,end)（actualEnd は見ない）`App.jsx:690-694`
- [ ] 終日は日数 = evSpan（月をまたいでも開始月に全日数）`App.jsx:707`
- [ ] `_timeBreakdown`：state.types の順に種類ごと。中は同じ名前で束ねる（バイトは勤務先名→書き込み jobName→題名、題名が空なら「（名前なし）」）。上位3つ（時間→日→回数の多い順）、名前が2つ以上のときだけ内訳。種類の並びは時間→日の多い順 `App.jsx:695-723`
- [ ] 量の書き方 `fmtSpent`：「6時間30分」「2日」「6時間・2日」、無ければ「0時間」`App.jsx:725-730`
- [ ] 大きい数字 `_spentHead`：時間があれば時（分は小さく添える）、1時間未満なら分、時間が無ければ日、全部 0 なら「0 時間」`App.jsx:732-740`
- [ ] 月ごとの棒：その年の12か月の時間合計（日数は入れない）。高さ max(3, round(h/peak×74))、peak は最低 1 `App.jsx:3374-3383`
- [ ] 給料の欄は、その年にバイトの実績（noReport 以外）が1件でもあるときだけ `App.jsx:3386-3387`
- [ ] 給料の合計：時間＝paidHours の和、金額＝各件の wage（件ごとに四捨五入）の和、日数＝件数。年の金額だけ使い始める前の額を足し、その旨の文を出す `App.jsx:3388-3407`
- [ ] 勤務先ごとの内訳：jobId（無ければまとめて1つ）で束ね、勤務先の並び順（不明は最後）→給料の多い順。色はバイトの色を白へ 0 / 0.22 / 0.42 / …（上限 0.62）寄せ。消した勤務先は書き込んだ名前、それも無ければ「バイト先なし／勤務先なし」 `App.jsx:749-777`
- [ ] 予定より延びた時間：実績で バイト or 仕事、actualEnd あり・終日以外。予定=(end−start+1440)%1440、実際=(actualEnd−start+1440)%1440、実際>予定のぶんだけ足し回数を数える（noReport は見ない）「予定より延びた時間 X（N回）」`App.jsx:3420-3426`
- [ ] 締め日ごとの給料：締め日のある勤務先ごと。締め 31 以上＝月末締め（表示月の1日〜末日）、それ以外＝前月の締め日+1〜表示月の締め日。その期間に開始した実績の wage の和を四捨五入 `App.jsx:3431-3437`
- [ ] 給料日：給料日>締め日（月末締め以外）なら締めた月、それ以外は翌月。給料日 31 以上はその月の末日。見出し「M月D日に入る分」、給料日が無ければ「M/D締め」`App.jsx:3438-3442`
- [ ] 有給の残り `leaveSummary`：設定 paidLeave がある時だけ。年度は付く月（start）から1年。休みの種類（free か off）で、題名に 半休/午前休/午後休/半日 → 0.5日、有給/有休/年休 → 1日（半日が優先）、日数は年度内に入る日だけ。まだは「希望」、それ以外（無くなった以外）は「使用」。残り=max(0, 付与−使用)。整数でなければ小数1桁 `App.jsx:1850-1870`
- [ ] 月の送り（まとめ）：月 −1/+1 で年をまたぐ。年の送りは y±1 `App.jsx:3363-3365,3444-3445`

### 3.14 検索・一覧（これから・まだ・探す）
- [ ] 「まだ」の数：無くなった以外の まだ で終わりが今日以降の件数＋棚の件数 `App.jsx:3461`
- [ ] 並び：開始日→終日が先→開始時刻 `App.jsx:3489`
- [ ] 見出し：今日／明日／今週（週のはじまり設定から7日）／来週／それより先は「M月」（年が違えば「YYYY年M月」）。始まりが過去で続いている予定は今日に入れる `App.jsx:3491-3496`
- [ ] これから：無くなった以外で終わりが今日以降、最大 150 件。「点線だけ」で まだ に絞れる。空なら「この先の予定はまだありません」`App.jsx:3497-3503`
- [ ] まだ：日が過ぎてまだ点線のまま（終わり<今日）を新しい順に最大 30 件、見出し「日が過ぎて、まだ点線のまま」を上に。その下に先の まだ を見出しごと。全部無ければ「まだ決まっていない予定はありません」`App.jsx:3504-3512`
- [ ] 探す：前後空白を落として小文字化。題名・場所・メモに部分一致（大小文字無視）。無くなった予定も含む。これから（昇順）と過去（新しい順）に分け、見出しは全件数、表示は各 100 件まで。空語なら「題名・場所・メモから探せます」、0 件なら「見つかりませんでした」`App.jsx:3513-3524`
- [ ] 行の時刻：終日は複数日なら範囲、1日なら「終日」。時間指定は「開始–終わり」（実績は actualEnd）`App.jsx:3478-3481`
- [ ] 行から：まだなら「確定」（小窓）と「無くなった」（取り消し帯付き）`App.jsx:3485-3487`

### 3.15 予定の画面の下（これまで・ほかの予定）
- [ ] 同じ予定＝種類が同じ＋題名が前後空白を落として完全一致 `eventctx.js:26`
- [ ] 何回目 `historyFor`：無くなった以外、日付→時刻順。自分を含めて数え、先の予定は数えない。はじめてなら null。yearNth・monthNth・前回・何日前 `eventctx.js:51-66`
- [ ] その日のほかの予定 `othersOnDay`：開始日を覆う無くなった以外の予定、終日が先→時刻→題名→id、3 件まで＋残り数 `eventctx.js:76-83`
- [ ] 何日前の言い方 `agoText`：≤0「同じ日」、1「前の日」、<45「N日前」、<365「round(N/30.4)か月前」、それ以上「round(N/365)年前」`eventctx.js:89-96`

### 3.16 レビュー依頼
- [ ] 使い始め（firstUseAt）から 7 日未満は出さない。前回から 60 日未満も出さない `App.jsx:1991-1994`
- [ ] 出す時：空いてる日を送った直後（share）／確定の回数が 5・10・25 回目（confirm）／アプリに戻ったとき使い始めから 14 日超かつ予定 20 件以上（open）`App.jsx:1995-1997,3614,5134`
- [ ] 出すと lastReviewAsk を今にし、1.2 秒後に iOS の評価を求める `App.jsx:1999-2000`

### 3.17 祝日
- [ ] 通信なしで年ごとに計算しキャッシュ。春分・秋分は近似式（1980〜2099 で一致）`holidays.js:1-2,72-78`
- [ ] 春分 = floor(20.8431 + 0.242194(y−1980) − floor((y−1980)/4))（3月）、秋分 = 23.2488 の同式（9月）`holidays.js:9-10`
- [ ] 固定：元日 1/1、建国記念の日 2/11、天皇誕生日 2/23（2020年以降だけ）、昭和の日 4/29、憲法記念日 5/3、みどりの日 5/4、こどもの日 5/5、文化の日 11/3、勤労感謝の日 11/23 `holidays.js:17-39`
- [ ] ハッピーマンデー：成人の日 1月第2月曜、海の日 7月第3月曜、スポーツの日（2019年まで「体育の日」）10月第2月曜、敬老の日 9月第3月曜 `holidays.js:18,31,33,36`
- [ ] 山の日 8/11（2016年以降）`holidays.js:32`
- [ ] 2020年：海の日 7/23・スポーツの日 7/24・山の日 8/10。2021年：7/22・7/23・8/8（10月の祝日・7月第3月曜は無し）`holidays.js:28-29`
- [ ] 国民の休日：前後が祝日の日（日曜は除く・土曜は対象）。振替休日より先に判定 `holidays.js:41-50`
- [ ] 振替休日：日曜の祝日のあと、祝日でない最初の日（7日まで追う、月をまたぐ、年はまたがない）`holidays.js:52-68`
- [ ] 対応年の制限は無し（どの年でも計算する）。2019年の即位関連の休日は無い `holidays.js:13-70`
- [ ] 祝日は 空き状況・文字で送る範囲 で休日扱い `App.jsx:856,950`

### 3.18 その他
- [ ] サポーターカードの段：ノーマル 0円〜、ゴールド 1,000円〜、ブラック 3,000円〜。「達したら」上がる。次の段は total<min の最初、最上段なら null `App.jsx:298-328`
- [ ] 設定の詳しい画面の戻り先：work→free、jobs→wage、leave→wage、overlay→iphone、backup→data、files→data `App.jsx:433`
- [ ] 今日の更新 `_checkToday`：1分ごと（と操作時）に端末の日付と比べて変わっていれば today を進める `App.jsx:5097-5108`
- [ ] アプリに戻ったとき `_onReturn`：1.5 秒以内の重複は1回に。日付が変わっていれば today を更新。30 分以上離れていて画面が month/day/detail/free/report なら今月の月表示へ戻す。ロック有効で 30 秒以上離れていたらロック。ほか 通知・同期・控え・ウィジェットを更新 `App.jsx:5117-5142`
- [ ] 今日へ戻る `goToday`：表示月を今日の月に、今日のマスを光らせる `App.jsx:1127-1131`
- [ ] 日を開く `openDay`：日画面・戻り先 month `App.jsx:1125`
- [ ] 空き状況の月送り `shiftFree`：freeYM を ±1、向きを覚える `App.jsx:1134-1137`
- [ ] スワイプ確定：払った回数ぶん月を進める（次のスワイプ開始時にも前の1回を確定）`App.jsx:1149-1156`
- [ ] 見本データ：URL に `?demo=1`（学生の1か月）か `?demo=work`（社会人の1か月）のときだけ、表示中の月に流し込む。その月に無い日は捨てる。id は `demo`＋番号 `demo.js:1-82`
- [ ] カードの肌理は決め打ちの擬似乱数 `frac(sin(n×12.9898)×43758.5453)`、刷り目 150 本・粒 900 個（描画のみ）`cardtexture.js:14-20`

### 3.19 通知（ローカル通知）

#### 3.19.1 しくみ・上限
- [ ] 使うのは `@capacitor/local-notifications` のローカル通知だけ。native でないとき（ブラウザ）は何もしない `notify.js:5-11,22,199`
- [ ] `canNotify()` = native かどうか。ブラウザでは通知が無いものとして扱う `notify.js:21-22`
- [ ] 通知 id は数値。予定 id などの文字列から `h=h*31+charCode`（32bit）→ `abs(h) % 2000000000`、0 なら 1 `notify.js:14-19`
- [ ] id の元の文字列: 勤務の記録 `'w'+e.id` / 予定のお知らせ `'r'+e.id` / 朝 `'m'+日付.toDateString()` / 前の晩 `'e'+toDateString()` / 日曜 `'wk'+toDateString()` `notify.js:104,124,144,153,166`
- [ ] 予約の上限 60 件（iOS の保留上限 64 件に余裕）。全部を時刻順に並べて近いものから 60 件 `notify.js:38-39,172-173`
- [ ] 貼り直し方: 保留中の通知を全部取り消してから、組み直したものを予約する `notify.js:197-211`
- [ ] 例外が出てもアプリの動きは止めない（握りつぶす） `notify.js:212-214`
- [ ] 設定 `notifyOff` が true なら、予定ごとのお知らせも含めて何も予約しない（取り消しだけ行う） `notify.js:89-90`

#### 3.19.2 許可（5.1.1(iv) への対応）
- [ ] 許可を聞くのは `syncReminders` の中だけ。予約するものが1件以上あるときだけ `ensurePermission()` を呼ぶ（起動しただけでは出さない） `notify.js:205-209`
- [ ] `ensurePermission`: `checkPermissions().display==='granted'` なら聞かない。そうでなければいきなり OS の `requestPermissions()` を出す `notify.js:24-34`
- [ ] アプリ側の事前説明画面・「やめる／あとで」ボタンは無い（コード上、許可の前に挟む画面が存在しない）。許可が得られなければ黙って予約しない `notify.js:208-209`
- [ ] 初回案内の取り込みの段に「毎朝、今日の予定をお知らせ」トグル（説明「7:30 に「今日3件（うち まだ1件）」のように届きます」）。押してもその場では許可を聞かない `view.jsx:2355-2362`, `App.jsx:2622-2624`
- [ ] 案内を終える（`finishOnboard`）と、トグルがオンなら `settings.morning=true, morningAt=既存値||450` を入れる → 設定の変化で `_syncReminders` が走り、朝のまとめを予約するものがあれば、そこで初めて OS の許可が出る `App.jsx:1483-1487,5319-5322`
- [ ] 許可が拒否されたときの案内・再要求の画面は無い（`ensurePermission` が false を返すだけ）

#### 3.19.3 予定ごとのお知らせ（remind）
- [ ] 対象: `remindMin` が 0 以上の数の予定。`status` が `nakunatta`（無くなった）・`jisseki`（記録済み）は除く `notify.js:42-45,96,114-116`
- [ ] 時刻指定: 開始時刻 −`remindMin` 分。終日: その日の 9:00（`ALLDAY_ANCHOR_H=9`）−`remindMin` 分 `notify.js:37,117-119`
- [ ] 過去になる時刻は予約しない `notify.js:120`
- [ ] 複数日の予定でも、お知らせは初日（`e.y,e.m,e.day`）基準の1回だけ `notify.js:118`
- [ ] 題: 予定名。`secret` または設定 `hideTitles` なら「予定の時間です」。`mikakutei`（まだ）なら末尾に「（まだ）」 `notify.js:94,125`
- [ ] 本文 `whenText`: `rm>=1440` なら日数 = round(rm/1440)、1→「明日」2→「あさって」それ以外→「N日後」 `notify.js:50-51`
  - [ ] 終日: 日数あり「{明日}は終日の予定です」/ なし「今日は終日の予定です」 `notify.js:52`
  - [ ] 時刻指定: 日数あり「{明日} 10:00–11:00」/ 60分以上「N時間後 10:00–11:00」（round）/ 1〜59分「まもなく（N分後） 10:00–11:00」/ 0分「10:00–11:00」 `notify.js:53-57`
  - [ ] 場所があり、隠す設定でなければ本文末尾に「・{場所}」 `notify.js:122,126`
- [ ] extra: `{ eventId: String(e.id), kind: 'remind' }`。`mikakutei` のときだけ actionType `UNDECIDED` `notify.js:128-129`
- [ ] 予定の編集画面の選択肢（時刻指定）: なし/10分前/30分前/1時間前/3時間前/前日/2日前/3日前/1週間前（値 null,10,30,60,180,1440,2880,4320,10080） `App.jsx:4495`
- [ ] 予定の編集画面の選択肢（終日）: なし/当日の朝/前日の朝/2日前/3日前/1週間前（null,0,1440,2880,4320,10080） `App.jsx:4494`
- [ ] 選択肢は折り返すチップ。選ぶと緑 `#1D9E75` 地・白字・太字 `App.jsx:4497-4502`
- [ ] 補足文: 終日 0→「当日の朝9時にお知らせします」、他→「N日前の朝9時にお知らせします」/ 時刻指定 1440以上→「N日前の同じ時刻にお知らせします」、他→「始まるN時間前／N分前にお知らせします」 `App.jsx:4503-4507`
- [ ] 行の値（たたんだとき）: `notifyOff` なら「通知はオフ」、値があれば `remindLabel`、無ければ「なし」 `App.jsx:4486`
- [ ] `remindLabel`: 終日 0→「当日の朝」、他→「N日前」/ 時刻 1440以上→「N日前」、60以上→「N時間前」（round）、他→「N分前」 `App.jsx:827-833`
- [ ] 詳細画面: 値があり通知オンなら「{remindLabel}にお知らせ」、それ以外は出さない `App.jsx:4604-4605`
- [ ] 終日の切り替え時、残せる値は 終日→[0,1440] / 時刻→[10,30,60,1440] のみ。それ以外（180, 2880 など）は null（なし）に戻る `App.jsx:4267-4272`
- [ ] 新しい予定の既定値: 終日なら設定 `remindAllDay`、時刻指定なら `remindTimed`（数でなければ null） `App.jsx:1185-1187`
- [ ] 既存予定を開いたとき `remindMin` を引き継ぐ `App.jsx:1196,1223`

#### 3.19.4 勤務が終わったら記録を聞く（worked）
- [ ] 条件: 設定 `remind`（既定 true）かつ `type==='baito'` かつ `status==='kakutei'` かつ時刻指定 `notify.js:98`, `App.jsx:520`
- [ ] 時刻: `endMoment(e)`（`actualEnd||end`、日をまたぐ勤務は翌日） `notify.js:99-101`, `whenlib.js:27-31`
- [ ] 題「{予定名}、おつかれさまでした」/ 隠すとき「おつかれさまでした」。本文「記録しますか？（予定 {start}–{end}）」 `notify.js:105-106`
- [ ] extra `{ eventId, kind:'worked' }`、actionType `WORKED` `notify.js:108-109`
- [ ] 設定の行「働いたあとに記録を聞く」は、勤務先が1件以上（このときの `jobsEmpty` は辞めた勤務先も含めた数）かつ通知が使える環境のときだけ出る `App.jsx:4243-4245`, `settingsview.jsx:240-243`

#### 3.19.5 まとめのお知らせ（今日から7日分を先に予約）
- [ ] ループは今日 i=0〜6 の7日 `notify.js:136-138`
- [ ] 朝のまとめ（設定 `morning`）: その日の `morningAt` 分（既定 450 = 7:30）に予約。題「今日 N件」+ まだがあれば「（うち まだN件）」。本文は `dayDigest` の文 `notify.js:139-146`
- [ ] 前の晩（設定 `evening`）: 各日の 21:00 に翌日のまとめ。題「明日 N件（うち まだN件）」 `notify.js:148-156`
- [ ] 朝・前の晩とも extra `{ kind:'morning', day:'Y-M(0始まり)-D' }`（前の晩の day は翌日） `notify.js:145,154`
- [ ] 予定0件の日は送らない（`dayDigest` が null）。過去時刻も送らない `notify.js:73,143,152`
- [ ] `dayDigest`: 無くなったを除き、その日にかかる予定（複数日は最大60日まで）を、終日→開始時刻順。最初の4件を「10:00 名前」（終日は時刻なし）、まだなら名前末尾「？」、「、」でつなぎ、5件以上なら「 ほかN件」 `notify.js:70-78`
- [ ] `dayDigest` の名前: `secret` または隠す設定なら「予定あり」、名前が空なら「予定」 `notify.js:75`
- [ ] 日曜の見直し（設定 `weekly`）: 7日のうち日曜の 20:00。翌日〜7日後に「開始日がその日」の `mikakutei` を数える（複数日の途中は数えない）。0件なら送らない `notify.js:157-169`
- [ ] 日曜の文: 題「来週、まだ決まっていない予定がN件」本文「開いて、決まった・無くなった を片づけられます」、extra `{ kind:'weekly' }` `notify.js:166-167`

#### 3.19.6 通知の上のボタン
- [ ] 登録は1回だけ（失敗したら次回再試行） `notify.js:177-195`
- [ ] `UNDECIDED`: 「決まった」(id `yes`, foreground) /「無くなった」(id `no`, destructive, foreground) `notify.js:183-186`
- [ ] `WORKED`: 「予定どおり記録する」(`asplanned`) /「開いて直す」(`open`)、どちらも foreground `notify.js:187-190`

#### 3.19.7 通知を押したとき（`onNotificationTap`）
- [ ] リスナーは `localNotificationActionPerformed`。extra に eventId か kind が無ければ無視。kind 無しは 'worked' 扱い、actionId 無しは 'tap' `notify.js:218-229`
- [ ] kind `morning`（朝・前の晩）: その日の一覧（`screen:'day'`, `dayNum`, `ym`, `returnTo/dayFrom:'month'`） `App.jsx:5024-5028`
- [ ] kind `weekly`: 一覧の「まだ」タブ（`screen:'list', listTab:'undecided', returnTo:'month'`） `App.jsx:5030`
- [ ] 予定が見つからなければ何もしない `App.jsx:5031-5032`
- [ ] `yes`（まだの予定のとき）: 確定にし、その月のカレンダーへ。取り消し帯「「{名前}」を確定にしました」 `App.jsx:5034-5040`
- [ ] `no`（まだの予定のとき）: 無くなったにし、その月へ。帯「「{名前}」を{種類の gone 語 or 無くなった}にしました」 `App.jsx:5041-5047`
- [ ] `asplanned`（確定のとき）: `jisseki`・`actualEnd=end`・バイトなら `hourly=hourlyFor(ev)`。帯「「{名前}」を予定どおりで記録しました」 `App.jsx:5048-5053`
- [ ] kind `remind` のふつうのタップ: その予定の月にして `openFor(ev,'month')`（予定そのものを開く） `App.jsx:5054-5059`
- [ ] それ以外（worked のタップ・`open`・条件外のボタン）: `openDialog(ev,'worked','month')` `App.jsx:5060`

#### 3.19.8 予約を貼り直すタイミング
- [ ] 起動時（`componentDidMount`）すぐ `App.jsx:5021`
- [ ] 予定（`events` の参照）または設定 `notifyOff, remind, morning, morningAt, evening, weekly, hideTitles` が変わったら 400ms 後（連続は最後の1回） `App.jsx:5317-5322`
- [ ] アプリに戻ってきたとき（`_onReturn`） `App.jsx:5136`
- [ ] 設定 `remindTimed` / `remindAllDay` の変更では貼り直さない（新しい予定の既定値にしか使わないため。コード上 NK に無い） `App.jsx:5319`

#### 3.19.9 通知の設定画面（設定 > 通知 `setPage:'notify'`）
- [ ] 1枚目のカード: 「通知」トグル（= `!notifyOff`）。オフのとき下の行は全部隠れる `settingsview.jsx:222-230`, `App.jsx:2238-2239`
- [ ] オンのとき「予定の通知」選択 なし/10分前/30分前/1時間前（`remindTimed`）、「終日の予定の通知」なし/当日の朝/前日の朝（`remindAllDay`: null/0/1440） `App.jsx:2309-2310`
- [ ] 2枚目: 「朝のまとめ」トグル、オンなら「時刻」（0:00〜24:00 を30分刻み 49個） `settingsview.jsx:232-237`, `App.jsx:2223,2304-2306`
- [ ] 3枚目: 「前の晩に明日の予定」「日曜の夜にまだの予定」「働いたあとに記録を聞く」（条件つき） `settingsview.jsx:238-244`
- [ ] 「予定の名前を隠す」（sub「通知・ウィジェット」）は 設定 > 保存と安全 にある。切り替えるとウィジェットの送り直し印もリセット `settingsview.jsx:285`, `App.jsx:2311`

#### 3.19.10 アプリ内のお知らせ（ベル）への勤務の催促 `_refreshNotif`
- [ ] `syncShiftNotices`: 終わった（`endMoment<=now`）のに `kakutei` のままのバイト（時刻指定）ごとに、id `shift-{eventId}`・kind `shift`・題「{名前}、おつかれさまでした」本文「働いた時間を記録しますか？（予定 {start}–{end}）」・`at=終わる瞬間`・未読 を足す `notices.js:291-319`
- [ ] 記録済み・削除済みになったシフトのお知らせは消す `notices.js:302-303`
- [ ] setState は関数形で、最新の notices を読む。変わったときだけ書く `App.jsx:5358-5366`
- [ ] 呼ぶ時: 起動時・60秒ごと・予定/通知設定の変更時・戻ってきたとき `App.jsx:5020,5099,5323,5135`
- [ ] 注: こちらは `hideTitles` を見ない（名前をそのまま書く） `notices.js:312`

### 3.20 ウィジェット

#### 3.20.1 受け渡し（アプリ側）
- [ ] App Group `group.com.kimatteru.app`、キー `widget`（UserDefaults suite に JSON 文字列） `widgetbridge.js:11-12`, `KimatteruWidget.swift:30-31`, `App.entitlements`, `KimatteruWidget.entitlements`
- [ ] プラグインは `registerPlugin('WidgetBridge')`。使えるのは native かつ `isPluginAvailable('WidgetBridge')` のとき `widgetbridge.js:17-26`
- [ ] `pushWidget`: payload を作り `WidgetBridge.save({group,key,json})`。結果 `{ok,size,days}` / 失敗 `{ok:false, why}`、投げない `widgetbridge.js:33-44`
- [ ] Swift `save`: suite を開けなければ reject「共有の置き場を開けませんでした（App Group の名前を確かめてください）」。書いたあと `WidgetCenter.shared.reloadAllTimelines()`、`{size}` を返す `WidgetBridge.swift:33-54`
- [ ] プラグイン登録は `ViewController.capacitorDidLoad` で `WidgetBridgePlugin`・`LukkoNativePlugin`・`TabBarPlugin` を `registerPluginInstance` `ViewController.swift:22-29`
- [ ] `_pushWidget` の送り直し判定: 印 = `JSON(events)` + `events.length/types.length/weekStart`。前回と同じなら送らない `App.jsx:5867-5875`
- [ ] 送る時: `_flushFile` のたび（ファイル保存の 1200ms 後・背景に回るとき） `App.jsx:5852-5862`
- [ ] 戻ってきたときは印を null にして必ず送る `App.jsx:5139-5140`
- [ ] 名前を隠す設定の切り替えで印を null に（次の保存で送られる） `App.jsx:2311`
- [ ] 注: 種類の色だけを変えた場合は印が変わらないので送られない（コード上の挙動）
- [ ] 診断（設定のバージョンを、間を1.5秒以内で続けて5回タップ）に「ウィジェットの窓口 ある/ない」「ウィジェットへ渡した結果 渡せた（N日ぶん・N文字）/渡せなかった：理由/（まだ渡していない）」と手で送るボタン（`sendWidgetNow`：印を null にして即送る） `App.jsx:1272-1302,3071-3077`

#### 3.20.2 payload（`buildWidgetPayload`） `widgetdata.js`
- [ ] 形: `{ v:1, at:今日ms, weekStart:0|1, from:'YYYY-MM-DD', to, hol:[日付], days:{ 'YYYY-MM-DD':[item] } }` `widgetdata.js:139-147`
- [ ] 窓: (今日−1日) と 今月1日 の早いほう 〜 (今日+20日) と 今月末 の遅いほう `widgetdata.js:24-25,83-85`
- [ ] 「今日」は書き出さない。どの日が今日かはウィジェットが決める `widgetdata.js:7-10`
- [ ] 無くなった予定は出さない `widgetdata.js:91`
- [ ] item: `t`=開始（終日 null）/ `e`=終わり（終日 null、日をまたぐなら "24:00"、記録済みは `actualEnd||end`）/ `n`=名前（24字で…切り、空なら「予定」、隠すなら「予定あり」）/ `c`=種類の色（無ければ `#8A8A8A`）/ `s`=1（kakutei・jisseki）or 0 / `k`=予定 id / `x`=1（隠したとき）/ `m`=持ち物 / `p`=複数日の位置（1初日 2途中 3最終日、1日だけは付けない） `widgetdata.js:96-115`
- [ ] 隠す条件: 予定の `secret` または設定 `hideTitles`。隠すと持ち物も渡さない `widgetdata.js:94-95,108`
- [ ] 持ち物: メモを改行で分け、空行除去、最大6行、各20字（超えたら19字+…） `widgetdata.js:29-31,56-60`
- [ ] 複数日（最大60日）は窓の中の各日に入れる。日をまたぐ時刻指定の予定は開始日にだけ入る `widgetdata.js:110-117`
- [ ] 1日の並び: 終日→時刻の早い順→名前順。1日最大8件 `widgetdata.js:28,121-129`
- [ ] 祝日: 窓の中で `holidayName` がある日を `hol` に `widgetdata.js:133-137`
- [ ] `weekStart` は設定が 1 なら 1、それ以外 0 `widgetdata.js:142`

#### 3.20.3 ウィジェット本体（Swift） `KimatteruWidget.swift`
- [ ] 1種類（kind `KimatteruWidget`、StaticConfiguration、表示名「LUKKO」、説明「今日の予定と、まだ決まっていないものが出ます。ロック画面にも置けます。」） `:1033-1043`
- [ ] 大きさ: systemSmall / systemMedium / systemLarge / accessoryRectangular / accessoryCircular / accessoryInline `:1044-1045`
- [ ] `contentMarginsDisabled()`。ウィジェットは iOS 17 以上（追加スクリプトで 17.0、本体は 15.0） `:1047,20-24`, `tools/add-widget-target.rb:46,79`
- [ ] 押したときの行き先（`widgetURL`/`Link`）の指定は無い（コード上なし）。押すとアプリが開くだけ
- [ ] 読み込み: suite からキー `widget` を読み `Payload{weekStart, days, hol?}` に decode。失敗・無しなら「未読込」の Entry `:222-240`
- [ ] Item の `past` は JSON から読まない（CodingKeys に入れない） `:45-49`
- [ ] 日付キーは en_US_POSIX・グレゴリオ暦固定の `yyyy-MM-dd` `:106-114`
- [ ] 時刻 "HH:MM" → 分。"24:00"=1440、読めなければ nil（終わらない扱い） `:124-133`

#### 3.20.4 タイムライン（描き直し）
- [ ] エントリー: いま / 今日の各予定の終わる時刻（いまより後・明日0時より前・重複なし・昇順）/ 明日0時。policy `.after(明日0時)` `:195-220`
- [ ] 中身が変わったときはアプリ側から `reloadAllTimelines` で起こす `WidgetBridge.swift:48-52`
- [ ] placeholder・snapshot はいまの時刻で build `:191-194`

#### 3.20.5 Entry の組み立て
- [ ] 今日: 終わり ≤ いまの分 のものを `past` にして後ろへ。順は元のまま `:242-257`
- [ ] 終日（t なし）は `past` にならない `:54`
- [ ] この先: 明日〜21日後を順に見て「ahead（何でも）」最大3件・「undecidedAhead（s=0）」最大3件 `:259-275`
- [ ] 今週のまだ: 設定の週はじまりで今週7日の s=0 の数（終わったものも含む） `:277-284`
- [ ] 今月のマス: 前の空き＋月の日数を7の倍数に。各マスに今日フラグとその日の予定 `:286-304`
- [ ] 曜日見出しは週はじまりから「日月火水木金土」 `:305`
- [ ] 今月の祝日の日の集合、今日の色（祝日・日曜=1 赤、土曜=2 青、他0） `:306-316`
- [ ] `undecided` = 今日の s=0 かつ past でない数。`head` = 最初の past でない予定。`rest` = head があり2件以上なら先頭以外（past も含む）。`allDone` = 今日が空でなく全部 past `:174-180`
- [ ] `next`: head があれば「{時刻 or 終日} {名前}」、無ければ ahead 先頭で「{明日 or 曜 日日} {時刻} {名前}」 `:181-187,141-146`

#### 3.20.6 色・部品
- [ ] 色の混ぜ方: 塗りの地 = 種類色を白へ .32、点線の地 = 白へ .62、文字 = 黒へ .66（アプリと同じ） `:65-85`
- [ ] 固定色: INK(0.149,0.145,0.122) INK_MUT(0.549,0.533,0.486) INK_FAINT(0.718,0.702,0.651) LINE(0.902,0.886,0.839) BG(0.984,0.984,0.992) UNDECIDED 藤色(0.545,0.478,0.722) SUMI(0.353,0.341,0.314) HOLIDAY_RED(0.706,0.271,0.227) SATURDAY_BLUE(0.239,0.431,0.612) `:87-102`
- [ ] Pill: 時刻 9.5pt＋名前 10.5pt（1行・末尾…）、角丸5、決まった=塗り、まだ=点線（線幅1.5 dash[3,2.5]）、past は不透明度 .45 `:331-364`
- [ ] Head（中）:「M月D日（曜）」11pt INK_MUT、右に「まだ N件」（藤色）。短い形は「M/D 曜」 `:385-409`
- [ ] 持ち物の行: 小さな丸＋10.5pt 1行 `:412-422`
- [ ] Empty: 読めていれば「予定なし」、読めなければ「アプリを一度開いてください」。今週のまだが1件以上なら「今週 まだN件」「決まっていません」 `:439-455`
- [ ] 月の小カレンダー（中）: 曜日8pt、行高20、数字10pt、今日は INK の丸に白数字、予定の無い日は数字 INK_FAINT、点は最大3つ（決まった=塗りの点、まだ=輪）、半径2.4。行数は cells.count/7（空なら0行） `:462-527`

#### 3.20.7 小（systemSmall）
- [ ] 左上に大きな日付 46pt light、細い縦線、縦書き「{曜}曜日」12pt。色は祝日・日曜=赤、土曜=青、他=INK `:542-563`
- [ ] 右上: 今日が3件以上なら「N件」、まだがあれば「まだ N」（藤色） `:572-583`
- [ ] head があれば Pill（高さ24）。head に持ち物があれば最初の4つを「・」でつないだ1行、無ければ2件目の Pill `:586-603`
- [ ] 全部終わった日:「今日はおしまい」14pt＋次の1件「{明日 or 曜 日日} {時刻} {名前}」 `:604-614`
- [ ] それ以外:「今日の予定なし」/ 未読込「アプリを開いてください」 `:615-619`
- [ ] この先の予定は（全部終わった日を除き）出さない `:531-534`

#### 3.20.8 中（systemMedium）
- [ ] 左（幅134）: Head＋head の Pill（高さ26）。持ち物があれば最初の2行、無ければ残り最大2件の Pill（22）＋3件以上なら「ほか N件」、残りも無ければ「このあと」＋「{曜 日日}　{時刻} {名前}」 `:631-660`
- [ ] 全部終わった日:「今日はおしまい」17pt light＋「このあと」＋「{明日 or 曜 日日}　{時刻} {名前}」 `:661-672`
- [ ] 予定なし: Empty(17)＋ahead があれば「このあと　{曜 日日}　{名前}」 `:673-679`
- [ ] 右: 月の小カレンダー `:684-685`

#### 3.20.9 大（systemLarge）
- [ ] 上の行:「M月」14pt semibold、右に今月のまだの数「まだ N件」（同じ予定 k は1回、k 無しはマスごと） `:871-896`
- [ ] 未読込なら Empty、読めていれば月のカレンダー `:897-903`
- [ ] 曜日見出し: 日曜=赤、土曜=青、他 INK_FAINT。週ごとの上に 0.5pt の線 `:840-869`
- [ ] 週の行: 予定を帯にする。同じ k が隣の列に続けば1本、帯の長い順→左→時刻順に段を決める。段は最大3、あふれは列ごとに「+N」（7pt） `:733-781,824-826`
- [ ] 帯: 高さ11、段の間1.5、数字の高さ12、文字7.5pt medium、角丸2.5（初日 p0/1 のとき左を、最終日 p0/3 のとき右を丸める）、まだは点線（線1 dash[2,1.5]） `:709-730,737,776-778`
- [ ] 数字は左上。祝日・日曜=赤、土曜=青、他 INK。今日はその色の丸（12pt）に白数字 8.5pt semibold `:802-837`
- [ ] 余白: 大16、小・中14。ホーム画面の地は BG `:1013-1030`

#### 3.20.10 ロック画面
- [ ] 地も余白も付けない（`containerBackground` は clear） `:1000-1012`
- [ ] 長方形: 1行目に塗り/点線の印＋next（13pt semibold）、2行目（11pt secondary）＝ まだがあれば「まだ N件」→ 今日0件「今日は予定なし」→ 全部終わり「今日はおしまい」→「今日 N件」。next が無ければ「予定なし」/「アプリを開いてください」 `:930-962`
- [ ] 丸: `AccessoryWidgetBackground` の上に「まだ」or「今日」（10pt）と数（20pt semibold） `:965-980`
- [ ] 1行: next の文。無ければ「今日の予定なし」/「アプリを開いてください」 `:983-992`
- [ ] 色は .primary / .secondary のみ `:910-928`

### 3.21 iCloud 同期

#### 3.21.1 置き場とキー
- [ ] `NSUbiquitousKeyValueStore`（entitlement `com.apple.developer.ubiquity-kvstore-identifier`） `App.entitlements`, `LukkoNative.swift:52-100`
- [ ] キー: 目次 `lukko.sync.meta` = `{parts, at:Date.now(), device}`、本体 `lukko.sync.0` 〜 `lukko.sync.{parts-1}`（JSON 文字列を 60000 字ずつ） `sync.js:22-24,58-72`
- [ ] 書く順: 本体を全部 → 余った切れ端 `parts`〜`parts+4` を消す（値なしの kvsSet = removeObject）→ 最後に目次 `sync.js:64-67`, `LukkoNative.swift:93-97`
- [ ] JSON が 900000 字を超えたら書かない（false） `sync.js:62`
- [ ] 読む: 目次が無ければ null。切れ端が1つでも欠けたら null。戻り値に `at, device` を足す `sync.js:38-55`
- [ ] kvsGet / kvsSet のたびに `synchronize()` を呼ぶ `LukkoNative.swift:79,98`
- [ ] `kvsInfo`: `available = synchronize() && ubiquityIdentityToken != nil`、`signedIn = token != nil`、`entitled = synchronize()` `LukkoNative.swift:66-71`
- [ ] 向こうから変わった通知（`didChangeExternallyNotification`）→ JS へ `kvsChanged {keys}` `LukkoNative.swift:47-49,58-64`, `sync.js:32-35`

#### 3.21.2 送る中身（`packForSync`）
- [ ] `{ v:1, events, types, jobs, someday, tomb }`。設定は送らない（端末ごと） `sync.js:74-85`
- [ ] tomb = 最近消した予定（trash）の `[ev.id, at]` ＋ `gone` の `[id, at]`（棚の項目 id、`job:{id}`、`type:{key}`、棚へ移した予定 id） `sync.js:82-83`, `App.jsx:392,1523,1810,1821,1827,2102`
- [ ] `gone` は30日より古いもの・形の違うものを捨て、最大800件 `App.jsx:387-392`。trash は30日・最大400件 `App.jsx:381-385`

#### 3.21.3 混ぜ方（`mergeSync`）
- [ ] remote が無い・events が配列でなければ何もしない（null） `sync.js:92`
- [ ] 墓標 = remote の tomb ＋ ローカル trash ＋ ローカル gone を id ごとに最大時刻でまとめる `sync.js:93-97`
- [ ] 予定: ローカルに無い remote 予定は、墓標時刻 ≥ その `updatedAt` なら入れない、それ以外は足す。両方にあれば `updatedAt` が新しいほう `sync.js:98-112`
- [ ] 墓標による削除: ローカルの予定で `updatedAt ≤ 墓標時刻` かつローカル trash に同じ id が無いものを消す `sync.js:113-117`
- [ ] 種類: ローカルのうち `type:{key}` の墓標があるものを消す。remote にしか無く墓標の無い種類を足す。名前・色の食い違いはローカル優先 `sync.js:124-125`
- [ ] 勤務先: 同じく `job:{id}` で `sync.js:126-127`
- [ ] 日にち未定の棚: 墓標時刻 ≥ 項目の `at` なら消す／足さない。remote にしか無いものを足す `sync.js:128-135`
- [ ] 何も変わらなければ null。変われば `{events, types, jobs, someday}` `sync.js:136-137`
- [ ] 取り込むとき events/jobs/someday は sanitize、types は `typesOk` なら混ぜた結果そのまま（だめならローカル） `App.jsx:1955-1958`
- [ ] 注: remote の墓標はローカルの `gone` に保存されない（混ぜる時に使うだけ）

#### 3.21.4 いつ動くか
- [ ] 設定 `sync` がオンのときだけ（既定オフ） `sync.js:14`, `App.jsx:1950,1966`
- [ ] 設定 > 保存と安全「iCloud で同期」行は native のときだけ表示。sub は「最後に合わせた時刻 H:MM」/ 未同期「合わせています…」 `App.jsx:2425-2427`, `settingsview.jsx:275`
- [ ] 下の注記: 同期の行があるとき「予定は、この iPhone とあなたの iCloud にだけ保存します」、無いとき「予定は、この iPhone の中にだけ保存します」 `settingsview.jsx:280`
- [ ] オンにするとき `syncInfo` を見て、使えなければトースト（3.6秒）: サインイン済み「この版では、まだ iCloud の同期を使えません」/ 未サインイン「iPhone の設定で iCloud にサインインすると使えます」。オンにしない `App.jsx:1939-1944`
- [ ] オンにすると `deviceId`（無ければ `uid('d')`）を作り、すぐ `_pullSync(true)` `App.jsx:1946-1947`
- [ ] オフにするときは確認なし・何も消さない `App.jsx:1936-1948`
- [ ] 起動 800ms 後に `_pullSync(true)`（読む→混ぜる→書く） `App.jsx:5067`
- [ ] 向こうの変更通知で `_pullSync(false)`（書き戻さない） `App.jsx:5068`
- [ ] 戻ってきたとき `_pullSync(true)` `App.jsx:5138`
- [ ] こちらで `events, types, jobs, someday, trash` が変わったら 4秒後に `_pushSync`（連続は最後の1回）。同期で取り込んだ直後の1回は書かない（`_fromSync`） `App.jsx:5325-5329`
- [ ] `_pullSync` は同時に1つだけ（`_syncing`）。成否にかかわらず `lastSyncAt` を更新 `App.jsx:1949-1964`
- [ ] 失敗は握りつぶす（次の機会にやり直す） `App.jsx:1961,1967`

### 3.22 保存・控え（バックアップ）と復元

#### 3.22.1 ふだんの保存（`_checkFile` の前提）
- [ ] 保存する中身 PERSISTED = events, types, overrides, settings, notices, lastSeenVersion, jobs, supports, trash, someday, gone ＋ `savedAt` `store.js:37-42`
- [ ] localStorage キー `kimatteru.v2`（毎回すぐ）、ファイル `Library/kimatteru-store.json`（1200ms 待って、背景に回るときは即） `store.js:19-23,45-68`, `App.jsx:5852-5862`
- [ ] 保存は PERSISTED のどれかの参照が変わったときだけ `App.jsx:5304-5309`
- [ ] localStorage に書けなければ `saveFailed` を立てる（画面に出す） `App.jsx:5842-5848`
- [ ] ファイルへは `_checkFile` が終わる（`_fileOk`）まで書かない `App.jsx:5856-5861`

#### 3.22.2 起動時の確かめ（`_checkFile` / `_adoptSaved`）
- [ ] ブラウザでは確かめず `_fileOk=true` で終わる（このとき起動時の自動控えも呼ばない） `App.jsx:5766`
- [ ] ファイルに予定が1件以上あり、localStorage が空だった（`_hadLocal` なし）: 起動後に何も作っていなければファイルから戻す（`recovered` = 件数） `App.jsx:5771-5773`
- [ ] 両方あり、ファイルの `savedAt` が新しく、`[events,jobs,types]` の JSON が違う: localStorage 側を `before` 控えに書いてから、ファイルから始める。トースト「新しいほうの保存から開きました（古いほうは控えに残しました）」4.2秒 `App.jsx:5774-5780,5804`
- [ ] 終わったら `_fileOk=true` → ファイル保存を予約 → `_autoBackup()` `App.jsx:5783-5785`
- [ ] `_adoptSaved`: 予定0件なら何もしない。events/jobs/supports/trash/someday/gone は sanitize、types は混ぜる、overrides/notices は無ければ現状、settings は `onboarded:true` ＋ 保存値 `App.jsx:5788-5803`

#### 3.22.3 控えの形式
- [ ] `{ app:'kimatteru', format:2, appVersion, exportedAt: ISO文字列, data:{PERSISTED の11項目} }` `App.jsx:5376-5378,5807-5814`

#### 3.22.4 自動の控え（端末の中）
- [ ] 置き場: native は `Library/backups/`、ブラウザは localStorage `lukko.backups` に新しい3つ `backup.js:16-19,41-46`
- [ ] 名前: 毎日 `auto-YYYY-MM-DD.json`、戻す・取り込む前 `before-YYYY-MM-DD-HHMMSS.json` `backup.js:29-35`
- [ ] 1日1回: 今日の `auto-` が無ければ書く。予定0件なら書かない。同時実行しない `App.jsx:5819-5832`, `backup.js:112-116`
- [ ] 書けたら `settings.lastAutoBackup=Date.now()`、そのあと古いものを消す `App.jsx:5825-5828`
- [ ] 残す数: auto の新しい7つ＋ auto のうち毎月1日（`-01.json`）の新しい3つ＋ before の新しい5つ。それ以外は `Filesystem.deleteFile`（ブラウザでは消さない） `backup.js:93-110`
- [ ] 呼ぶ時: `_checkFile` の終わり（起動）・戻ってきたとき・予定が変わって今日の控えがまだなら5秒後（`_fileOk` 後のみ） `App.jsx:5785,5137,5310-5316`
- [ ] `before` 控えを書く時: 戻す直前（予定があれば）・カレンダー取り込み直前（予定があれば）・`_checkFile` でファイル側を採るとき `App.jsx:5534,1651,5778`
- [ ] 一覧: 名前から種類と日付を読む（中身は読まない）、新しい順。表示「M月D日（自動）」/「M月D日（戻す・取り込む前）」 `backup.js:65-81`, `App.jsx:2396`
- [ ] 一覧のシート「端末の中の控え」、空なら「まだ控えはありません」、下に「・毎日1回、自動でとります」「・7日分と、月初めの3か月分を残します」 `settingsview.jsx:652-664`
- [ ] 一覧の行を押す → 読んで `parseBackup` → 確認へ。読めなければ「控えを読めませんでした。」 `App.jsx:5572-5578`

#### 3.22.5 書き出し（ファイルに保存）
- [ ] 中身は整形 JSON（2スペース）。名前 `LUKKO-控え-YYYYMMDD.json` `App.jsx:5380-5387`
- [ ] native: `Cache` に書いて共有シート。ブラウザ: ダウンロード（「控えを保存しました」/「控えを作れませんでした」） `shareimg.js:29-57`
- [ ] 書き出すと `settings.lastExportAt` を更新（共有を閉じても更新される） `App.jsx:5388`

#### 3.22.6 読み込み・確かめ
- [ ] 「ファイルから戻す」は隠した `<input id="backup-file" type="file" accept=".json,application/json">` を押す。無ければ貼り付けを開き「ファイルをえらべませんでした。貼り付けで戻してください。」 `App.jsx:5475-5481`, `settingsview.jsx:477`
- [ ] 5MB 超は「このファイルは控えにしては大きすぎます。書き出した控えをえらんでください。」 `App.jsx:5399,5489-5492`
- [ ] 読めない「ファイルを読めませんでした。もう一度えらんでください。」。同じファイルを選び直せるよう値を空に `App.jsx:5487,5494-5495`
- [ ] 貼り付け: 「ファイルをえらべないときは、貼り付けで戻す」で開く textarea、「この控えから戻す」（空なら押せない） `settingsview.jsx:486-494`, `App.jsx:3148-3153`
- [ ] `parseBackup` のエラー文: JSON でない「控えの中身を読めませんでした。全文が貼れているか確かめてください。」/ `app!=='kimatteru'`「このアプリの控えではないようです。」/ `format>2`「この控えは新しい版のアプリで作られています。アプリを最新にしてから戻してください。」/ events が無い「控えに予定が入っていません。」 `App.jsx:5504-5515`
- [ ] 予定は先にふるい（sanitize）にかけ、件数 `count`・落とした数 `dropped`・`at=exportedAt` を返す `App.jsx:5516-5519`

#### 3.22.7 確認と復元
- [ ] 確認の題「控えから戻しますか？」。本文: 置き換え「いま入っているN件は、控えのM件に置き換わります。」/ 足す「控えのM件のうち、いま入っていない予定だけを足します。同じ予定は新しいほうを残します。」＋「（控えは YYYY年M月D日 のもの）」＋ 落とした数があれば「 読めない予定がN件あり、それは戻せません。」＋ 予定があれば「 戻す前のいまの状態は、控えとして端末に残します。」 `App.jsx:4733-4743`
- [ ] いま予定があるときだけ「置き換えずに、足りない予定だけ足す」を選べる `App.jsx:4747-4756`
- [ ] iPhone では本物のアラート: 予定あり →「置き換えて戻す」(destructive)「足りない予定だけ足す」「キャンセル」/ 予定なし →「戻す」(destructive)「キャンセル」 `App.jsx:5906-5913`
- [ ] 置き換え: events/jobs/supports/trash/someday は sanitize、types は `typesOk` なら混ぜる、overrides・notices は控えのもの（無ければ空）、settings はいま＋控え、lastSeenVersion。カレンダーへ。トースト「N件の予定を戻しました」 `App.jsx:5550-5564`
- [ ] 注: 置き換えでも `gone` は戻さない（コード上、doRestore に gone が無い）
- [ ] 足す: id ごとに、無ければ足す・あれば `updatedAt` が新しいほう。予定以外は変えない。トースト「N件の予定を足しました」 `App.jsx:5536-5548`
- [ ] 戻す直前に予定があれば `before` 控え `App.jsx:5533-5534`

#### 3.22.8 設定の画面（控えと機種変更）
- [ ] 保存と安全: 「最近消した予定 N件」「控えと機種変更 {最後の自動控えの M月D日}」「ファイルで出し入れ」 `settingsview.jsx:271-280`
- [ ] 控えと機種変更: 「端末の中の控え」「控えをファイルに保存 {最後の書き出し日}」「ファイルから戻す」、注記「毎日1回、自動でとります（7日分）」 `settingsview.jsx:469-476`
- [ ] 機種変更の説明 1「「クイックスタート」か「iCloud バックアップから復元」で、予定も移ります」2「移らなかったら：前の iPhone で「控えをファイルに保存」→ 新しい iPhone で「ファイルから戻す」」 `settingsview.jsx:481-485`

### 3.23 開くときのロック
- [ ] `lockInfo`（native）: 生体が使えれば `faceID`/`touchID`（他は passcode）、生体なしでパスコードがあれば `passcode`。`available` = `.deviceOwnerAuthentication` が使えるか `LukkoNative.swift:145-164`
- [ ] 呼び名: faceID→「Face ID」touchID→「Touch ID」他→「パスコード」 `App.jsx:1974`
- [ ] 設定の行「{呼び名} でロック」は使えるときだけ表示 `settingsview.jsx:284`, `App.jsx:2431-2433`
- [ ] オンにするとき `authenticate('LUKKO のロックを入れます')`。失敗ならトースト「確かめられなかったので、入れませんでした」3秒で入れない。オフは確かめない `App.jsx:2003-2010`
- [ ] 切り替えると `setShield(on)`（UserDefaults `lukko.shield`） `App.jsx:2009`, `LukkoNative.swift:137-141`
- [ ] ぼかし: `willResignActive` で `lukko.shield` が true ならウィンドウ全体に `UIBlurEffect(.systemMaterial)`、`didBecomeActive` で外す `LukkoNative.swift:104-135`
- [ ] 起動時 `_initLock`: ロックがオンで使えるなら `setShield(true)`・`locked=true`・`unlock()` `App.jsx:1971-1977`
- [ ] `unlock`: 二重に呼ばない。`authenticate('LUKKO を開きます')` が成功したら `locked=false`、失敗ならロック画面のまま `App.jsx:1978-1984`
- [ ] 確かめは `.deviceOwnerAuthentication`（生体→パスコードへ落ちる）、取り消しボタン名「やめる」。確かめる手段の無い端末は `ok:true`（締め出さない）。ブラウザも `ok:true` `LukkoNative.swift:166-181`, `native.js:24-27`
- [ ] 戻ってきたとき: ロックがオン・使える・30秒より長く離れていたら `locked=true`、50ms 後に `unlock()` `App.jsx:5131-5132`
- [ ] ロック画面: 全面（z-index 99、地 `--bg`）に「✓」（緑 `#1D9E75`）「？」（薄い色）・「LUKKO」20pt・ボタン「{呼び名}で開く」 `view.jsx:1881-1889`, `App.jsx:3570-3573`
- [ ] Face ID の利用目的文「アプリを開くときに、本人かどうかを確かめるために使います。」 `Info.plist:52-53`

### 3.24 起動・復帰・更新の副作用

#### 3.24.1 constructor
- [ ] localStorage を同期で読む。あれば `_hadLocal=true`、`_localSaved` に保持。settings に `onboarded:true` を足す `App.jsx:456-477`

#### 3.24.2 componentDidMount（上から順に） `App.jsx:4993-5101`
- [ ] 本物の下のタブの押下を Web のナビ処理につなぐ（month/free/report/settings/add） `:4995`
- [ ] 0ms 後に `_syncTabBar`、`_readSystemLook`、`_applyTheme` `:4996-4998`
- [ ] focusin（INPUT/TEXTAREA、file・checkbox 以外）で `kbOpen=true`、focusout は 60ms 後に確かめて `kbOpen=false` `:5001-5003`
- [ ] `?demo=` で予定0件なら見本の予定を入れる `:5005-5013`
- [ ] 版が上がっていたらアップデートのお知らせを足し `lastSeenVersion` 更新 `:5015-5019`
- [ ] `_refreshNotif`、`_syncReminders`、通知タップの登録 `:5020-5061`
- [ ] `_initLock` `:5063`
- [ ] `firstUseAt` が無ければ今を入れる `:5064`
- [ ] 重ねて表示がオンなら 300ms 後 `_loadOverlay` `:5065`
- [ ] 同期オンなら 800ms 後 `_pullSync(true)`、`onRemoteChange` → `_pullSync(false)` `:5067-5068`
- [ ] `_onResume`（取り込み画面で設定アプリから戻ったらカレンダー許可を確かめて読み込みを続ける）を定義 `:5070-5076`
- [ ] Capacitor `resume` → `_onResume`＋`_onReturn`、`pause` → `_hiddenAt` 記録＋`_flushFile` `:5080-5083`
- [ ] `visibilitychange`: 見えたら `_onResume`＋`_onReturn`、隠れたら `_hiddenAt` 記録＋`_flushFile` `:5084-5089`
- [ ] `_checkFile`、`_pruneTrash`（30日超を捨てる） `:5093-5094,5834-5838`
- [ ] 60秒ごとに `_checkToday`＋`_refreshNotif` `:5097-5100`

#### 3.24.3 `_checkToday`
- [ ] 今日の年月日が `state.today` と違えば `today` を更新。月の帯を触り始めたときにも呼ぶ `App.jsx:5104-5108,2502`

#### 3.24.4 `_onReturn`（戻ってきたとき） `App.jsx:5117-5142`
- [ ] 1.5秒以内の重複は1回にまとめる `:5119-5120`
- [ ] 払う途中の状態（`_dragging` 等）を捨て、`swipe` を 0 に `:5122`
- [ ] 日付が変わっていれば `today` 更新 `:5127`
- [ ] 30分より長く離れていて、画面が month/day/detail/free/report なら、今月のカレンダーへ戻す（書きかけの new などは戻さない） `:5128-5130`
- [ ] ロックの確かめ直し（E 参照） `:5132`
- [ ] `maybeAskReview('open')`（使い始め14日以上・予定20件以上・前回から60日以上など） `:5134`, `App.jsx:1991-2001`
- [ ] `_refreshNotif`、`_syncReminders`、`_autoBackup`、同期オンなら `_pullSync(true)`、ウィジェット強制送信、`_loadOverlay`（あれば） `:5135-5141`

#### 3.24.5 componentDidUpdate（描き直しのたび） `App.jsx:5290-5348`
- [ ] `_applyTheme`、画面遷移アニメ、本物アラートの表示、本物タブの同期 `:5291-5295`
- [ ] 月の帯の位置を state に戻す（払っていないとき） `:5299-5303`
- [ ] PERSISTED が変われば `_persist`（localStorage＋ファイル予約→ウィジェット） `:5309`
- [ ] 予定が変わり今日の自動控えがまだなら5秒後 `_autoBackup` `:5312-5316`
- [ ] 予定・通知設定の変化で 400ms 後に通知の貼り直し＋`_refreshNotif` `:5319-5324`
- [ ] 同期オンで events/types/jobs/someday/trash が変われば4秒後に `_pushSync`（同期由来は除く） `:5326-5329`
- [ ] iPhone カレンダーへの書き出しがオンで、予定か `hideTitles` が変われば3秒後 `_syncExport` `:5331-5334`
- [ ] まとめカード画面ならプレビュー画像を作り直す `:5339-5347`

#### 3.24.6 componentWillUnmount
- [ ] `_tick`（60秒）と `_settle` を止めるだけ。イベントリスナーは外さない `App.jsx:5144-5147`

### 3.25 iPhone カレンダーからの取り込み

#### 3.25.1 入口・使える条件
- [ ] 取り込みは実機（Capacitor ネイティブ）だけ。`?import=1` を付けるとブラウザでも画面だけ出せる（読むと「この端末では使えません」） `calendarimport.js:14-24`
- [ ] 入口は4つ：設定 >「iPhone のカレンダー」>「予定を取り込む」 `settingsview.jsx:263`／空き状況が空のときの「iPhone のカレンダーから取り込む」 `view.jsx:1085`, `App.jsx:2780-2782`（予定0件・案内非表示・screen==='free' のとき）／はじめての案内4枚目「カレンダーから取り込む」 `view.jsx:2381`, `App.jsx:1483-1488`／`.ics` 読み込み・整理（下記）
- [ ] 設定の「iPhone のカレンダー」行・ページの中身は `canImport()` のときだけ出る `settingsview.jsx:179,261`
- [ ] `openImport()`：screen='import'、`imp={phase:'idle', found:[], type:'yoji', error:''}` にしてから `_askImportNow()` `App.jsx:1573`
- [ ] 案内から入るときは settings.onboarded=true、screen='import'、imp を初期化し `setTimeout(_askImportNow,0)` `App.jsx:1483-1488`

#### 3.25.2 許可の流れ（5.1.1(iv) 対策）
- [ ] `_askImportNow`：`canImport()` でなければ何もしない。`checkCalendarAccess()`（ダイアログを出さない確認）が 'prompt' で、まだ import 画面なら即 `runScan()`＝OS の許可ダイアログを出す。独自の説明画面は挟まない `App.jsx:1574-1584`
- [ ] 許可済み（granted）・拒否済み（denied）の人には自動では何もしない → 画面は idle（絵＋「iPhone のカレンダーから読んで、ここに並べます。」＋「続ける」＋「やめる」） `view.jsx:2524-2553`
- [ ] `checkCalendarAccess`：`CapacitorCalendar.checkPermission({scope:'readCalendar'})` の result が granted→'granted'、denied→'denied'、それ以外・例外→'prompt'。非ネイティブ→'unavailable' `calendarimport.js:41-49`
- [ ] `askCalendarAccess`：granted なら即返す。そうでなければ `requestFullCalendarAccess()`（iOS17+ は読むにも Full Access が要る。readOnly は Android 専用） → granted 以外・例外は 'denied' `calendarimport.js:51-66`
- [ ] runScan で許可が下りない：phase='idle'、denied=(perm!=='unavailable')、error 文言「この端末では取り込みを使えません。」／「カレンダーを読む許可が下りませんでした。設定アプリで「カレンダー」を許可すると取り込めます。」 `App.jsx:1588-1595`
- [ ] denied のとき「設定アプリを開く」ボタン → `_retryImportOnReturn=true` → `openAppSettings()`（`capacitor-native-settings` の `NativeSettings.openIOS({option: IOSSettings.App})`、動的 import） `App.jsx:2882`, `calendarimport.js:29-38`, `view.jsx:2538-2542`
- [ ] アプリに戻ったら（Capacitor `resume` と `visibilitychange` の両方）`_onResume`：フラグが立っていて import 画面で、`checkCalendarAccess()==='granted'` なら `runScan()` `App.jsx:5070-5085`
- [ ] idle 画面のたたみ「次に iPhone が聞くこと」：「追加のみ」と「フルアクセス」の2つを聞かれる、読めるのはフルアクセスのとき（事実だけ・誘導しない） `view.jsx:2555-2563`
- [ ] scanning 中はボタンが「読み込んでいます…」で押せない。「やめる」はそのまま出ている `view.jsx:2550-2553`
- [ ] 「やめる」「←」は screen='settings' へ（`onImportBack`） `App.jsx:2884`

#### 3.25.3 カレンダーを選ぶ段（phase 'cals'）
- [ ] runScan：許可後 `listImportCalendars()`。行 = {id,title,color, on, type}。on は settings.importCals に記録があればその on（false 以外は true）、無ければ true。type は記録の type または '' `App.jsx:1599-1602`
- [ ] 一覧が0件なら即 `runRead([])`（=全カレンダー）。例外なら `runRead(null)` `App.jsx:1603-1607`
- [ ] `listImportCalendars`：type 3（購読）・4（誕生日）・isSubscribed・title==='LUKKO' を除く。title 無しは「（名前なし）」、color 無しは '#999' `calendarimport.js:139-150`
- [ ] 画面：「どのカレンダーを読みますか？」、行タップで on/off（tapLight）、右の札でカレンダーごとの種類を循環（'' =「名前から当てる」→ 表示中の種類…） `App.jsx:2843-2849`, `view.jsx:2430-2446`
- [ ] 読む範囲チップ3つ：'month'「先月から」（既定）／'year'「今年のはじめから」／'back'「1年前から」 `App.jsx:2852-2853`
- [ ] 「読み込む」は on のカレンダーが0件なら押せない（pointer-events:none） `view.jsx:2451`
- [ ] 選んだ内容（on・type）は settings.importCals={id:{on,type}} に覚え、次回の初期値にする `App.jsx:1618-1622`

#### 3.25.4 読む（runRead）
- [ ] 期間の始まり：month=前月1日／year=今年1月1日／back=前年同月1日。終わり：今月+12か月の月末 23:59:59（=13か月ぶん） `App.jsx:1615-1616`, `calendarimport.js:77-79`
- [ ] calIds：引数があればそれ、無ければ on のカレンダー id。空なら null（全部読む） `App.jsx:1617,1623`
- [ ] `readCalendarEvents`：`listCalendars()` で type 3/4/isSubscribed のカレンダーを skip（取れなくても続行）→ `listEventsInRange({from,to})` → skip カレンダー除外 → calIds で絞る → description==='LUKKO から'（書き出しで書いた予定）を除外 `calendarimport.js:75-96`
- [ ] 祝日除外：その日の `holidayName` と題名が空白無視で一致したら終日かどうかに関わらず除外 `calendarimport.js:102-111`
- [ ] status==='canceled' は除外 `calendarimport.js:112`
- [ ] 形は `toAppShape(e)`（重ね表示と共用）：
  - [ ] allDay は `e.allDay`（読み出し）優先、無ければ `e.isAllDay` `iphonecal.js:47-48`
  - [ ] 終日：start '00:00' end '23:59' allDay:true、days = 終わりが翌日0:00ちょうどならその日を含めない、1〜60 に丸め `iphonecal.js:49-53`
  - [ ] 時刻つき・同じ日：start/end を HH:MM `iphonecal.js:55`
  - [ ] 時刻つき・翌日にかかり24時間以内：「22:00–6:00」のまま（終わり<始まりは翌日として読む） `iphonecal.js:56`
  - [ ] それより長い時刻つき：終日の何日間（spanDays+1、1〜60）に変換 `iphonecal.js:57`
- [ ] 1件の中身：srcId=String(e.id)、srcCal=calendarId、title（trim、空なら「無題」）、place=location（trim・200字まで）、memo=description（trim・2000字まで）、link=url、status、updatedFrom=lastModifiedDate `calendarimport.js:117-130`
- [ ] status：iPhone 側 tentative、または題名が TENTATIVE 正規表現（`（仮）`・頭の「仮 」「仮:」・仮押さえ・候補・未定・調整中・末尾 ?／？・TBD）に当たれば 'mikakutei'（点線）、他は 'kakutei' `calendarimport.js:127-128,136-137`
- [ ] 並び：y→m→day→start `calendarimport.js:133`
- [ ] 例外時：phase='idle'、error「予定を読めませんでした。時間をおいて試してください。」 `App.jsx:1641-1643`

#### 3.25.5 差分（diffImport：新しい／変わった／元で消えた）
- [ ] 既存の予定を srcId ごとに配列で持つ（くり返しは全回が同じ srcId） `calendarimport.js:163-166`
- [ ] 受け取った各件：同じ srcId の未使用の既存から「同じ日」を優先して対応づけ。同じ日が無いときは、既存も受け取りもその srcId が1件ずつのときだけ別日の1件を対応とみなす `calendarimport.js:174-178`
- [ ] 対応あり：y/m/day/start/end/title/place/allDay/days（終日のみ）のどれかが違えば changed。memo・link・status の違いは見ない `calendarimport.js:179-184`
- [ ] 対応なし：`y-m-day-start-title` キーが既存（または今回の新規）に既にあれば捨てる。無ければ fresh `calendarimport.js:170-171,186-189`
- [ ] gone：srcId を持ち、対応がつかず、status!=='nakunatta'、(読んだカレンダーに含まれる か srcCal 無し か cals=null)、日付が読んだ範囲内 の既存予定 `calendarimport.js:191-193`
- [ ] 一覧の行：fresh は key 'k'+i・on:true・kind 'new'・type=カレンダーごとの種類 > 名前当て、guessed=カレンダー指定なしで当たったとき。changed は 'c'+i・on:true・type=既存の type・was=「M/D 開始（終日なら終日）」。gone は 'g'+i・on:false `App.jsx:1627-1636`
- [ ] 0件のときは「ほかのカレンダーの案内」（Outlook や Yahoo! が出ないとき）を開いた状態で出す `App.jsx:1637-1640`, `view.jsx:2469`
- [ ] 案内の手順4つ（iOS 18 以降と 17 以前の両方の言い方） `App.jsx:2870-2878`, `view.jsx:329-350`

#### 3.25.6 種類の当て（guessTypes）
- [ ] 1. 種類の名前（2文字以上）が題名に含まれる → その種類（隠した種類も対象） why 'name' `calendarimport.js:267-271`
- [ ] 2. キーワード（隠していない種類だけ）。順：off → work → baito → yoji → asobi。最初に当たったもの why 'word' `calendarimport.js:221-238,273-277`
  - [ ] off：有給・有休・年休・公休・希望休・半休・午前休・午後休・夜勤明け・明け休み・振休・代休
  - [ ] work：会議・打ち合わせ・打合せ・ミーティング・mtg・1on1・面談・商談・来客・出張・定例・研修・在宅・テレワーク・残業・業務・納品・締切・締め切り・レビュー・朝会・夕会・セミナー・勉強会・勤務・出勤・出社
  - [ ] baito：バイト・アルバイト・シフト・パート・勤務・出勤・早番・遅番・中番・日勤・夜勤・準夜・深夜・当直・宿直
  - [ ] yoji：病院・歯医者・歯科・クリニック・医院・通院・診察・健診・健康診断・予防接種・銀行・役所・郵便局・美容院・美容室・床屋・サロン・ネイル・提出・締切・締め切り・面接・面談・手続き・車検・引っ越し・引越・打ち合わせ・打合せ・会議・ミーティング・mtg・説明会・授業・講義・試験・テスト・塾・部活・ジム・練習・習い事・レッスン・稽古・サークル・ゼミ
  - [ ] asobi：飲み・のみ会・ランチ・ディナー・ごはん・ご飯・映画・ライブ・コンサート・フェス・旅行・温泉・誕生日・誕生会・カラオケ・bbq・バーベキュー・花火・デート・観光・買い物・ショッピング・遊び・遊ぶ・パーティ
- [ ] 比較は全角英数→半角・小文字化（MTG＝ｍｔｇ） `calendarimport.js:240-243`
- [ ] 3. くり返し：baito が見えていて work が見えていない・終日でない・今回の新規の中で「同じ名前@同じ開始-終了」が3回以上・長さ180分以上（終わり≦始まりは+1440） → baito why 'repeat' `calendarimport.js:279-291`
- [ ] 当たらなければ yoji（見えていれば）、無ければ types[0].key、why '' `calendarimport.js:255,293`
- [ ] 当てた件数の文「名前から{g}件の種類を当てました。ちがっていたら押して直せます。」 `App.jsx:2797-2800`

#### 3.25.7 一覧の操作（phase 'found'）
- [ ] 見出し「{n}件の予定が見つかりました」／「予定が見つかりませんでした」。説明文はソース（カレンダー／.ics／整理）で変わる `view.jsx:2456-2466`
- [ ] 行：チェック（✓・緑 #1D9E75）、札（changed「変わった（前は M/D 時刻）」、gone「元で消えた・消すなら選ぶ」）、「M/D　開始–終了／終日／N日間（まだ）」、題名、場所、右に種類の札1つ `App.jsx:2807-2829`
- [ ] 行タップで on/off（`toggleImportRow`、触覚なし）、off は半透明 0.45 `App.jsx:1670,2815-2817`
- [ ] 種類の札タップで表示中の種類を順に循環（tapLight、行の on/off は伝わらない） `App.jsx:2826-2828,1671`
- [ ] 「すべて選ぶ／すべて外す」 `App.jsx:1672,2801`, `view.jsx:2475-2477`
- [ ] たたみ「まとめて種類を変える」：表示中の種類チップ、押すと on の行だけその種類に `App.jsx:1673,2803`, `view.jsx:2513-2521`
- [ ] 「{n}件を取り込む」（on が0なら押せない） `view.jsx:2495-2498`

#### 3.25.8 取り込む（doImport）
- [ ] on が0なら何もしない。stampHeavy `App.jsx:1646-1648`
- [ ] 予定が1件以上あれば、取り込み前の状態を控え（`writeBackup('before', …)`）に残す `App.jsx:1650-1651`
- [ ] 新規：id = `uid('i')+'-'+連番`、type・title・y/m/day・start/end・status（無ければ kakutei）・allDay・updatedAt。days は終日で2日以上のときだけ、memo/place/link/srcId/srcCal はあるときだけ `App.jsx:1652-1657`
- [ ] changed：既存の title・日付・start/end・allDay・days を元に合わせる。place/memo/link は「新しい値が空なら既存のまま」。種類と status はこちらのまま（行の種類札を変えても反映されない） `App.jsx:1658-1664`
- [ ] gone で on のもの：予定から外し「最近消した予定」（trash、先頭に追加、400件まで）へ `App.jsx:1660-1665`
- [ ] settings.lastImport = {tag, at}（新規が1件以上のときだけ更新） `App.jsx:1666`
- [ ] 完了画面（phase 'done'）：✓、「{n}件を取り込みました」、点線で入れた件数の文 or 既定の文、詳細（直した件数・消した件数・場所つき・何日も続く）、「新しい予定は、下の ＋ から入れられます。」、「カレンダーを見る」（screen='month'）、「取り込む前に戻す」 `App.jsx:1667-1668,2831-2841,2885`, `view.jsx:2402-2429`

#### 3.25.9 取り消し（undoImport）
- [ ] lastImport.tag で始まる id の予定（=最後の取り込みの新規分だけ）を trash へ移す。changed・gone の変更は戻さない。stampHeavy、lastImport=null、import 画面にいたら settings へ、トースト「取り込んだ{n}件を取り消しました」 `App.jsx:2012-2022`
- [ ] 完了画面の「取り込む前に戻す」は phase done・整理でない・lastImport あり・added>0 のとき `App.jsx:2841`
- [ ] 設定「ファイルで出し入れ」に「最後の取り込みを取り消す（N件）」（その tag の予定が残っている間） `App.jsx:2409-2414`, `settingsview.jsx:504`

#### 3.25.10 整理（tidy）
- [ ] 対象：終日・id が 'i' で始まる（取り込みで入った）・noReport でない予定 `App.jsx:5447-5449`
- [ ] 設定「ファイルで出し入れ」に「取り込んだ予定を整理する（N件）」（N>0 のとき） `settingsview.jsx:503`
- [ ] 一覧は日付順。TIDY_WORDS（誕生日・birthday・七夕・七五三・バレンタイン・ホワイトデー・ハロウィン・クリスマス・イブ・母の日・父の日・敬老の日・節分・ひな祭り・ひなまつり・こどもの日・大晦日・正月・元日・成人の日・建国記念・春分・昭和の日・憲法記念・みどりの日・海の日・山の日・秋分・スポーツの日・文化の日・勤労感謝・天皇誕生日・祝日・休日・振替）に当たるものだけ最初から on `App.jsx:5446,5450-5457`
- [ ] 種類の札は出さない。「押すと選べます」 `view.jsx:2474,2489`
- [ ] 「{n}件をまとめから外す」→ noReport:true（予定は残る、tapLight） `App.jsx:5459-5466`
- [ ] 「{n}件をカレンダーから消す」（赤・小さく）→ 予定から削除（trash には入れない）、stampHeavy `App.jsx:5468-5474`, `view.jsx:2507-2509`
- [ ] 完了文「{n}件をまとめから外しました」「予定はカレンダーに残っています。時間には数えません。」／「{n}件を消しました」 `view.jsx:2406-2412`
- [ ] noReport の予定は集計から外れる（`App.jsx:3350,3386`）、予定の「···」で「まとめに入れる／入れない」を切り替えられる `App.jsx:4665-4666`

### 3.26 .ics 書き出し・読み込み

#### 3.26.1 書き出し
- [ ] 設定 > 保存と安全 >「ファイルで出し入れ」>「ファイルに書き出す .ics」 `settingsview.jsx:502`
- [ ] 全予定を `toIcs` → `shareText(text, 'LUKKO-YYYYMMDD.ics', 'text/calendar')`（Cache に書いて共有シート）。非ネイティブはダウンロード `App.jsx:5403-5410`, `shareimg.js:177-205`
- [ ] VCALENDAR：VERSION:2.0、PRODID:-//LUKKO//LUKKO//JA、CALSCALE:GREGORIAN、X-WR-CALNAME:LUKKO `ics.js:45`
- [ ] status==='nakunatta' は書かない `ics.js:47`
- [ ] UID=`{id}@lukko`、DTSTAMP=今の UTC（…Z）、SUMMARY（無ければ「無題」） `ics.js:50-52`
- [ ] 終日：DTSTART;VALUE=DATE、DTEND;VALUE=DATE=開始+days（1〜60） `ics.js:53-57`
- [ ] 時刻つき：タイムゾーン無しの浮動時刻（YYYYMMDDTHHMM00）。jisseki は actualEnd を終わりに。終わり<始まりなら DTEND を翌日に `ics.js:11-13,58-66`
- [ ] STATUS：mikakutei→TENTATIVE、他→CONFIRMED。X-LUKKO-TYPE、X-LUKKO-STATUS、LOCATION（place）、DESCRIPTION（memo）。link・secret・名前を隠す設定は書かない（実名で出る） `ics.js:67-71`
- [ ] TEXT のエスケープ：`\`→`\\`、`;`→`\;`、`,`→`\,`、改行→`\n` `ics.js:17-18`
- [ ] 1行74バイトで折り返し（UTF-8 のバイトで数える、続きは先頭空白）、改行は CRLF、最後も CRLF `ics.js:22-34,75`

#### 3.26.2 読み込み
- [ ] 「ファイルから取り込む .ics」→ 隠した `<input id="ics-file" type="file" accept=".ics,text/calendar">` を click `App.jsx:5411-5415`, `settingsview.jsx:501,507`
- [ ] `file.text()` で読む（失敗は空文字）。input の value はすぐ空に戻す。大きさの上限なし `App.jsx:5416-5424`
- [ ] 注記「TimeTree・Google カレンダーのファイルを取り込めます」 `settingsview.jsx:506`
- [ ] 折り返し復元（改行＋空白/タブを詰める）、VEVENT ごとに name;params:value（引用符内の : は区切りにしない） `ics.js:80-99`
- [ ] 日時：VALUE=DATE または時刻なし→終日。末尾 Z は UTC→端末時刻。TZID は無視して壁時計の時刻として読む `ics.js:101-113`
- [ ] DTEND が無く DURATION があれば足して終わりを出す（W/D/H/M。秒は無視） `ics.js:115-120,191-195`
- [ ] STATUS:CANCELLED は捨てる。TENTATIVE は tentative `ics.js:189-190,214`
- [ ] RRULE 展開：DAILY／WEEKLY（BYDAY 可）／MONTHLY（同じ日。その日が無い月は飛ばす）／YEARLY、INTERVAL・COUNT・UNTIL。終わり無しは今日から1年先まで、最大120回、反復2000回で打ち切り。他の FREQ は初回だけ。COUNT は EXDATE で除く前の回数 `ics.js:125-161`
- [ ] EXDATE（カンマ区切り）と、RECURRENCE-ID を持つ差し替え回の元の日は除く。RECURRENCE-ID を持つ VEVENT 自体は1件として入る `ics.js:173-182,198-202`
- [ ] 終日の日数：DTEND−DTSTART（1〜60）。時刻つきで終わりが別の日なら end='23:59'（日またぎを保たない） `ics.js:203-207`
- [ ] 1件：srcId=`{UID}#{y}-{m}-{d}`（UID 無しは 'u'+連番）、title（unescape・trim・空なら「無題」）、ltype/lstatus（X-LUKKO-*）、place、memo `ics.js:209-217`
- [ ] 並び：日付→開始 `ics.js:221`
- [ ] `runIcs`：`dedupe`（同じ日・開始・題名、または同じ srcId が既にあるものを除く）→ guessTypes → type は X-LUKKO-TYPE が既存の種類ならそれ、無ければ当て。status は TENTATIVE→mikakutei、X-LUKKO-STATUS jisseki→jisseki、他 kakutei。screen='import'、phase 'found'、source 'ics' `App.jsx:5426-5440`, `calendarimport.js:198-211`
- [ ] 取り込みは doImport（A と同じ。lastImport・取り消しも効く）。0件なら「このファイルに読める予定がありませんでした。」 `view.jsx:2462-2463`

### 3.27 iPhone のカレンダーへ書き出し（決まった予定を「LUKKO」へ）
- [ ] 設定 > iPhone のカレンダー >「決まった予定を書き出す」トグル（既定オフ） `settingsview.jsx:265`, `iphonecal.js:1-10`
- [ ] オンにする：tapLight → `askCalendarAccess()`（説明画面なし）。不可なら toast「この端末では使えません」／「カレンダーの許可が必要です（設定アプリで許可できます）」3.2秒 `App.jsx:1911-1912`
- [ ] `ensureExportCalendar(exportCalId)`：覚えている id が今もあればそれ → 題名「LUKKO」のカレンダーがあればそれ → 無ければ作る（色 #6E85BE、置き場は題名に icloud を含むソース > type 0/'local' > 既定） `iphonecal.js:81-101`
- [ ] 作れなければ toast「「LUKKO」カレンダーを作れませんでした」。成功で settings.exportCal=true・exportCalId 保存、すぐ同期、toast「決まった予定を、iPhone のカレンダーの「LUKKO」に入れます」 `App.jsx:1913-1917`
- [ ] オフにする：exportCal=false → `clearExport(map)`（書いた予定を全部 deleteEvent。カレンダー自体は消さない）→ map を {} に → toast「iPhone のカレンダーに書いた予定を消しました」 `App.jsx:1903-1909`, `iphonecal.js:170-177`
- [ ] 同期のきっかけ：オンにした直後／events か settings.hideTitles が変わって3秒後（デバウンス）。起動時・復帰時には走らない `App.jsx:1916,5330-5334`
- [ ] `_syncExport`：exportCal・ネイティブ・同期中でないとき。カレンダー id が変わっていたら保存し直す。例外は握りつぶし次の変更で `App.jsx:1921-1934`
- [ ] 対象：overlay でない、status が kakutei か jisseki の予定すべて（日付の範囲制限なし。まだ・無くなったは書かない） `iphonecal.js:124-129`
- [ ] map は localStorage `lukko.exportMap`：{予定id: iPhone 側id, '#予定id': 書いた中身の署名(JSON)} `App.jsx:1919-1920`, `iphonecal.js:118,132`
- [ ] 対象でなくなった予定（消えた・まだに戻った）は deleteEvent して map から外す `iphonecal.js:130-137`
- [ ] 書く中身：title（secret か「名前を隠す」なら「予定」）、calendarId、location（隠すなら ''、無ければ ''）、description「LUKKO から」、url（隠さず link があるとき）、日時 `iphonecal.js:139-146`
- [ ] 日時：終日は開始日0:00〜（開始+days−1）日23:59 isAllDay:true（days 1〜60）。時刻つきは jisseki なら actualEnd、終わり≦始まりは翌日 `iphonecal.js:103-114`
- [ ] 署名が同じならスキップ。前回 url ありで今回 url 無しなら消して作り直す（modify では消せない）。既存は modifyEvent、無ければ createEvent({commit:true})。modify 失敗は作り直し `iphonecal.js:147-163`
- [ ] 署名だけ残ったキーを片づける `iphonecal.js:165-166`
- [ ] 取り込み時は description==='LUKKO から' の予定を読まない／取り込み一覧に「LUKKO」カレンダーを出さない `calendarimport.js:95-96,145`

### 3.28 重ねて見る（overlay）
- [ ] 設定 > iPhone のカレンダー >「重ねて表示」（値：オン時「{n}つ」／「オフ」）→ OverlayPage：トグル＋カレンダー一覧（色の点・✓）、注記「選んだカレンダーを灰色で表示します（保存はしません）」 `App.jsx:2422`, `settingsview.jsx:264,454-468`
- [ ] オン：tapLight → `askCalendarAccess()`。不可なら toast「この端末では使えません」／「カレンダーを読む許可が必要です（設定アプリで許可できます）」3.2秒 `App.jsx:1873-1878`
- [ ] 一覧は `listPhoneCalendars()`：誕生日（type 4）と「LUKKO」を除く。購読（type 3/isSubscribed）は sub:true で含む `iphonecal.js:23-34`
- [ ] 初めてオンにしたとき（overlayIds 空）は購読でないカレンダー全部を選ぶ。以前の選択があればそれ `App.jsx:1880-1881`
- [ ] カレンダー行タップで overlayIds に足す／外す（tapLight）→ 読み直し `App.jsx:2419-2420`
- [ ] オフ：`_overlay=[]`、overlayOn=false（overlayIds は残す） `App.jsx:1876`
- [ ] 読む期間：今月−2 の1日〜今月+13 の月末 23:59 `App.jsx:1889`
- [ ] 読み直すとき：オンにした直後／カレンダー選択の変更／起動 300ms 後（オンなら）／アプリに戻るたび（`_onReturn`） `App.jsx:1882,2420,5065,5141`
- [ ] `readOverlay`：選んだ calendarId だけ、canceled 除外、形は toAppShape、id `ov-{元id}-{y}{m}{day}`、title（空なら「予定」）、overlay:true、status 'kakutei'、type '__overlay'、place。保存しない（メモリの `_overlay` だけ） `iphonecal.js:60-79`, `App.jsx:1890`
- [ ] `_overlayFor(a,b)`：オンのときだけ、日番号 a〜b にかかるもの（翌日にかかる時刻つきは終わりを+1日） `App.jsx:1894-1898`
- [ ] 月表示：その月の予定の pool に足す。帯は灰色（bg2・文字 ink-mut・左に 2px の線）、記号なし、時刻表示設定なら時を添える `App.jsx:3675,988,1016`
- [ ] 週・日の時間表示：灰色の箱（左 2.5px 線）。押しても何も開かない `App.jsx:3824,4026,1076-1092`
- [ ] 日の一覧：dayOverlay（題名・場所・終日 or 開始–終了）。押すと toast「iPhone のカレンダーの予定です。直すのは元のアプリで」 `App.jsx:4005-4008`
- [ ] 空き状況：設定 > 空き状況 に「重ねた予定もふさがり扱い」トグル（overlayCals があるときだけ表示）。オンなら終日の重ね予定でその日は ×、時刻つきはふさがり時間に入る。オフなら空き状況に影響しない `settingsview.jsx:214-217`, `App.jsx:2300,861,865,869`

## 4. 外部とのつながり

権限（カレンダー・通知・Face ID）をいつ聞くかは 4.2 にまとめた。通知の許可は 3.19.2、カレンダーの許可は 3.25.2 も見る。**App Store 5.1.1(iv)：OS の許可ダイアログの前に「やめる／あとで」を置かない**（3回リジェクトされた）。

### 4.1 ネイティブ連携

#### 4.1.1 package.json（dependencies・ロック上の実バージョン）
- [ ] @capacitor/app ^8.1.1（8.1.1）／@capacitor/cli ^8.4.2／@capacitor/core ^8.4.2／@capacitor/ios ^8.4.2／@capacitor/filesystem ^8.1.2／@capacitor/haptics ^8.0.2／@capacitor/local-notifications ^8.2.1／@capacitor/share ^8.0.1／@capacitor/status-bar ^8.0.3／@capgo/native-purchases ^8.6.5／@ebarooni/capacitor-calendar ^8.2.0／capacitor-native-settings ^8.1.0／react ^18.3.1／react-dom ^18.3.1 `package.json`
- [ ] devDependencies：@vitejs/plugin-react ^4.3.4、html2canvas ^1.4.1、sharp ^0.35.3、vite ^6.0.11。name "kimatteru"、version 0.32.2、marketing 1.3.3 `package.json`
- [ ] capacitor.config.json：appId com.kimatteru.app、appName Kimatteru、webDir dist、ios.contentInset never、ios.backgroundColor #FAF9F4、StatusBar overlaysWebView:true style DEFAULT

#### 4.1.2 プラグインの呼び出し箇所（src 全体）
- [ ] @capacitor/core（isNativePlatform／registerPlugin／isPluginAvailable）：backup・calendarimport・iphonecal・native・notify・shareimg・statusbar・store・sync・tabbar・tipjar・widgetbridge
- [ ] @capacitor/app：`CapApp.addListener('resume'|'pause')` だけ `App.jsx:3,5080-5083`
- [ ] @capacitor/filesystem：store.js（Library に kimatteru-store.json）、backup.js、shareimg.js（Cache に書いて共有）
- [ ] @capacitor/haptics：haptics.js だけ
- [ ] @capacitor/local-notifications：notify.js だけ
- [ ] @capacitor/share：shareimg.js だけ
- [ ] @capacitor/status-bar：statusbar.js だけ
- [ ] @capgo/native-purchases：tipjar.js（静的 import）
- [ ] @ebarooni/capacitor-calendar：calendarimport.js・iphonecal.js（checkPermission／requestFullCalendarAccess／listCalendars／listEventsInRange／fetchAllCalendarSources／createCalendar／createEvent／modifyEvent／deleteEvent）
- [ ] capacitor-native-settings：calendarimport.js の動的 import だけ
- [ ] 自前プラグイン（registerPlugin）：'LukkoNative'（native.js・sync.js）、'LukkoTabBar'（tabbar.js）、'WidgetBridge'（widgetbridge.js）。`Plugins.` 経由の呼び出しは無い

#### 4.1.3 自前プラグインの登録
- [ ] `ViewController: CAPBridgeViewController` の `capacitorDidLoad` で WidgetBridgePlugin・LukkoNativePlugin・TabBarPlugin を `registerPluginInstance`（npm でないので自分で登録） `ViewController.swift:1-30`
- [ ] AppDelegate は Capacitor 既定（URL・Universal Link を ApplicationDelegateProxy へ渡すだけ） `AppDelegate.swift`

#### 4.1.4 LukkoNative.swift（jsName "LukkoNative"）
- [ ] `lockInfo` → {available: deviceOwnerAuthentication が可能か, kind: faceID/touchID/passcode/none}（生体が無くパスコードだけなら passcode） `LukkoNative.swift:145-164`
- [ ] `authenticate({reason})` → `.deviceOwnerAuthentication`（生体＋パスコード）、キャンセル文言「やめる」。評価できない端末は {ok:true, why:'unavailable'}（締め出さない） `LukkoNative.swift:166-181`
- [ ] `setShield({on})` → UserDefaults 'lukko.shield'。willResignActive でオンならウィンドウ全体に UIBlurEffect(.systemMaterial)、didBecomeActive で外す `LukkoNative.swift:40,104-141`
- [ ] `requestReview` → 前面のシーンで `SKStoreReviewController.requestReview(in:)` `LukkoNative.swift:227-241`
- [ ] `alert({title,message,sheet,buttons:[{label,style,preferred}]})` → UIAlertController（alert／actionSheet）、cancel/destructive/default、preferredAction、シートで cancel が無ければ「キャンセル」を足して -1、iPad は画面下中央から吹き出し。返り値 {index} `LukkoNative.swift:190-225`
- [ ] `kvsInfo` → {available: synchronize() && iCloud サインイン, signedIn, entitled} ／ `kvsGet({key})` → {value} ／ `kvsSet({key,value})`（value 無しは削除）→ {ok}。外部変更で `kvsChanged` {keys} を通知 `LukkoNative.swift:43-100`
- [ ] JS 側：窓口が無い（ブラウザ・古いビルド）ときは lockInfo={available:false}、authenticate={ok:true}、alert=-1、requestReview=false で静かに何もしない `native.js:13-55`
- [ ] sync.js の KVS キー：'lukko.sync.meta'、'lukko.sync.{i}'（60000字ずつに分割、余りの5キーを消す） `sync.js:22-24,64-67`

#### 4.1.5 確認画面をネイティブで出す（Native.alert）
- [ ] ネイティブでは Web の確認を描かず UIAlertController を出す：予定の「···」メニュー（アクションシート＋キャンセル）、削除確認（くり返しなら「この予定だけ削除」「この日から先も削除」）、控えから戻す（「置き換えて戻す」「足りない予定だけ足す」or「戻す」）、候補の片づけ（「残しておく」）、勤務先を消す（「消す」）、書きかけを捨てる（「捨てる」「書きつづける」）、くり返しの編集（「この予定だけ」「…」「キャンセル」） `App.jsx:5879-5925`
- [ ] key が変わったときだけ出し直す。-1 は cancel ボタンの処理を実行 `App.jsx:5939-5948`

#### 4.1.6 下のタブ（TabBar.swift、jsName "LukkoTabBar"）
- [ ] JS→`set({visible, selected, dark})`、Swift→イベント 'tap' {tab: month|free|report|settings|add} `TabBar.swift:9-11,32-50`, `tabbar.js:11-21`
- [ ] 4タブ：カレンダー（SF "calendar"）・空き状況（○緑#1D9E75 △#B9770F ×#C1C5CC を描いた画像）・まとめ（"chart.bar"）・設定（"gearshape"）。文字 10pt semibold、選択中 .label・他 .secondaryLabel。バッジは無い `TabBar.swift:56-57,118-136,188-207,237-241`
- [ ] 右に離した丸い「＋」（SF "plus" 22pt、accessibility「予定を追加」）→ 'add' `TabBar.swift:138-151`
- [ ] 材質：iOS 26 は UIGlassEffect（Liquid Glass。Xcode 26 未満ではコンパイルしない）、それ以前は UIBlurEffect(.systemChromeMaterial)。角丸 31 continuous `TabBar.swift:74-95`
- [ ] 選択インジケーター：高さ52・角丸26・label 7%、iOS 26 はガラスのレンズ。移動時 1.16×1.12 にふくらみ→ばね（0.5s, 0.74）で移動→戻る `TabBar.swift:97-111,215-250`
- [ ] 位置：左右21、高さ62、下は safeArea 下端+13（優先度 high）かつ画面下端から最低8 `TabBar.swift:174-186`
- [ ] 出し入れ：0.28s easeOut、透明度と下へ12px `TabBar.swift:257-268`
- [ ] dark は overrideUserInterfaceStyle に反映 `TabBar.swift:45`
- [ ] JS 側：ネイティブタブがあると Web のタブは描かない（navShown=false） `App.jsx:5881-5882`
- [ ] 表示条件：Web 側で出したい（navShown）かつ「inset:0 で z-index≥80 の覆い」が無いとき。selected は screen が month/free/report/settings のときだけ、他は ''。前回と同じなら送らない。didMount と毎回の didUpdate で呼ぶ `App.jsx:5926-5938,4996,5294`
- [ ] タップは Web のタブと同じ処理（onNavCal/onNavFree/onNavReport/onNavSettings/onFab） `App.jsx:4994-4995`

#### 4.1.7 ウィジェットの受け渡し（WidgetBridge）
- [ ] `WidgetBridge.save({group:'group.com.kimatteru.app', key:'widget', json})` → UserDefaults(suiteName) に保存し `WidgetCenter.reloadAllTimelines()` `widgetbridge.js:11-12,33-44`, `WidgetBridge.swift:381-402`

#### 4.1.8 触覚（haptics.js）
- [ ] tapLight=impact Light／penTick=impact Rigid／settleSuccess=notification Success／stampHeavy=impact Heavy。失敗は握りつぶす `haptics.js:13-23`
- [ ] 使用数（App.jsx だけ）：tapLight 151か所（ほぼ全ボタン）
- [ ] penTick 2：案内の点線デモ `App.jsx:1457`、確定のモーフ fill `App.jsx:1773`
- [ ] settleSuccess 3：応援の購入成功 `App.jsx:1336`、案内デモ `App.jsx:1458`、確定のモーフ settle `App.jsx:1774`
- [ ] stampHeavy 9：案内を終える `1484`、取り込む `1648`、実績の記録 `1758`、取り込みの取り消し `2015`、月の希望をまとめて確定 `2064`、種類を消す `2101`、長押しメニュー `3973`、整理で消す `5471`、控えから戻す `5532`
- [ ] カードの面が裏表で入れ替わるとき tapLight `App.jsx:1421`

#### 4.1.9 ステータスバー・起動・ガード
- [ ] `applyStatusBarTheme(dark)`：暗い表示なら Style.Dark、他は Style.Light（ネイティブのみ） `statusbar.js:13-20`, `App.jsx:5601`
- [ ] main.jsx：`watchErrors()`、`touchstart` の空リスナー（:active を効かせる）、`<Guard><App/></Guard>` `main.jsx:7-11`
- [ ] Guard：描画エラーで「うまく表示できませんでした」「予定は消えていません。…」「もう一度開く」（location.reload）とエラー要約を表示。localStorage 'lukko.lastError' に1件（message 500字・stack 12行2000字・version・where・componentStack 8行）。window error/unhandledrejection も記録だけ `guard.jsx:12-82`
- [ ] jp.jsx：意味のかたまりごとに inline-block で包む `Jp` `jp.jsx:4-14`
- [ ] style.js：CSS 文字列→style オブジェクト（キャッシュ付き、--変数はそのまま） `style.js:1-22`

#### 4.1.10 Info.plist・entitlements
- [ ] CFBundleDisplayName「LUKKO」、開発言語 ja・ローカライズ ja のみ、縦向きだけ、UIViewControllerBasedStatusBarAppearance true、UIRequiredDeviceCapabilities armv7、ITSAppUsesNonExemptEncryption false `Info.plist`
- [ ] NSCalendarsUsageDescription と NSCalendarsFullAccessUsageDescription（同文）：「いま使っているカレンダーの予定を、取り込みと「重ねて表示」のために読み込みます。書き込むのは、設定で「決まった予定を iPhone のカレンダーにも入れる」をオンにしたときだけで、「LUKKO」という名前のカレンダーにだけ書きます。外部への送信は行いません。」 `Info.plist`
- [ ] NSFaceIDUsageDescription：「アプリを開くときに、本人かどうかを確かめるために使います。」 `Info.plist`
- [ ] URL スキーム（CFBundleURLTypes）・UIBackgroundModes・写真ライブラリの説明文は無い `Info.plist`
- [ ] entitlements：App Group `group.com.kimatteru.app`（ウィジェット拡張 KimatteruWidget.entitlements も同じ）、iCloud KVS `com.apple.developer.ubiquity-kvstore-identifier = $(TeamIdentifierPrefix)$(CFBundleIdentifier)` `App.entitlements`

### 4.2 権限（いつ・どう聞くか）
- [ ] カレンダー（Full Access）：①取り込み画面を開いた瞬間、未確認（prompt）なら説明なしで OS ダイアログ（`_askImportNow`→`runScan`）。入口ボタンは「予定を取り込む」「iPhone のカレンダーから取り込む」「カレンダーから取り込む」（案内4枚目、並びに「空のまま はじめる」） ②「重ねて表示」をオンにしたとき ③「決まった予定を書き出す」をオンにしたとき。②③も説明画面なしで直接 `askCalendarAccess` `App.jsx:1573-1584,1877,1911`
- [ ] カレンダーを断った後：取り込みは赤字＋「設定アプリを開く」→戻ったら自動で再試行。重ね・書き出しは toast だけ（トグルは変わらない） `App.jsx:1589-1595,2882,5070-5076,1878,1912`
- [ ] 通知：起動時や予定・通知設定の変更時に `syncReminders` が走り、予約するものが1件以上あるときだけ `checkPermissions`→未許可なら `requestPermissions`（独自の説明なし）。起動しただけでは聞かない（予約が無ければ） `notify.js:24-34,197-215`, `App.jsx:5021,5319-5324,5136`
- [ ] Face ID：設定「{Face ID|Touch ID|パスコード} でロック」（lockAvailable のときだけ表示）をオンにする時に `authenticate('LUKKO のロックを入れます')`。失敗なら toast「確かめられなかったので、入れませんでした」でオンにしない。起動時の lockInfo は canEvaluatePolicy だけ（ダイアログなし） `App.jsx:2003-2010,1971-1977`, `settingsview.jsx:284`
- [ ] ロック中：起動時にオンなら shield＋locked＋unlock（理由「LUKKO を開きます」）。30秒以上離れて戻ると再ロック `App.jsx:1975,1978-1984,5132`
- [ ] iCloud：許可ダイアログなし。オン時 kvsInfo が使えなければ toast（サインイン済みなら「この版では、まだ iCloud の同期を使えません」、未サインインなら「iPhone の設定で iCloud にサインインすると使えます」3.6秒） `App.jsx:1936-1948`
- [ ] 写真・連絡先・位置などは求めない（画像は共有シートで渡すだけ）
- [ ] 5.1.1(iv)：許可ダイアログの前に「やめる」付きの独自説明を出さない。現状、取り込み画面は「続ける／やめる」を持つが、未確認の人には開いた時点で OS ダイアログが自動で出る（ボタンを待たない）。許可済み・拒否済みの人にだけボタンで進ませる `App.jsx:1574-1584`, `view.jsx:2546-2549`

### 4.3 応援（投げ銭）
- [ ] 商品ID（消耗型）：com.kimatteru.app.tip300（¥300「コーヒー1杯」）、tip600（¥600「ランチ1回」）、tip1000（¥1000「しっかり応援」） `tipjar.js:25-29`
- [ ] 画面上の題と一言：コーヒー1杯「ちょっとした応援を、気軽に。」、ランチ1回「次のアイデアのために。」、しっかり応援「もっと良いものをつくるために。」 `settingsview.jsx:525-529`
- [ ] 値段は起動時ではなく設定を開いたとき（onNavSettings）に1回だけ取る（失敗したら次にまた取る） `App.jsx:1254-1268,2493`
- [ ] `probeTips`：isBillingSupported と getProducts をそれぞれ8秒で打ち切り。取れた商品だけ並べる。0件・不一致は tips=null `tipjar.js:38-46,64-94`
- [ ] 値段の表示：StoreKit の priceString/displayPrice が円（通貨コード JPY、無ければ ¥/￥/円）ならそのまま、円でなければ '¥'+TIPS の yen `tipjar.js:112-120`
- [ ] 値段が取れないと応援の行ごと出さない。設定の最初の画面に「サポーターカード」（応援済みのとき）・「LUKKO を応援する」（値段が取れたとき）・「App Store でレビューする」 `App.jsx:2912-2919,3080-3082`, `settingsview.jsx:143-158`
- [ ] 応援の画面：「いつも使ってくださって、ありがとうございます。」「あなたの応援が、これからの開発の力になります。」・芽の絵・「応援する」・3行・手書き風「いつも ありがとう」 `settingsview.jsx:539-575`
- [ ] 見本撮影（?demo=）でブラウザのときは TIPS を '¥'+yen で並べる `App.jsx:1261-1262`
- [ ] 購入：返事待ちの間は二度押し不可（tipBusy）、値段のかわりに「…」、行は押した色のまま。tapLight は押し切ったとき `App.jsx:1320-1329,3112-3122`
- [ ] `purchaseProduct({productIdentifier})` に時間制限なし。成功 → supports に {id, yen(TIPS), at:Date.now()} を追加、tipThanks を出す、settleSuccess `tipjar.js:126-136`, `App.jsx:1330-1337`
- [ ] キャンセル（message に cancel/キャンセル、code 2）は何も言わない。他の失敗は「購入できませんでした。時間をおいて試してください。」（2.4秒） `tipjar.js:137-147`, `App.jsx:1339-1340`
- [ ] 復元は無い（消耗型・権利を持たない）。supports は予定と同じ保存（PERSISTED）に入り、控えにも入る `tipjar.js:3-5`, `store.js:37`, `App.jsx:1331-1332`
- [ ] お礼の小窓：芽の絵、「応援、ありがとうございます！」、題＋値段、「サポーターカードを見る」「閉じる」（背景タップでも閉じる） `settingsview.jsx:608-625`, `App.jsx:3103-3111`
- [ ] サポーターカード：合計・回数・「YYYY年M月から」。段は合計で ノーマル(0)／ゴールド(1000〜)／ブラック(3000〜)、「あと ¥N で{段}カードになります」／「いちばん上の段です。ありがとうございます。」 `App.jsx:298-328,2917-2984`
- [ ] カード画面：名前（20字まで、settings.supporterName、空は「名前を入れる」）、MEMBER SINCE YYYY.MM、裏面に1回ずつの記録（新しい順 YYYY.MM.DD ¥）、押すか横になぞると裏返る（縦は最大8度傾くだけ）、速く払う（260度/秒以上）と次の面へ、ばねで落ち着く `App.jsx:2938-3055,1378-1440`, `cardflip.js`
- [ ] 診断：設定いちばん下の「LUKKO {1.3.3}（{0.32.2}）」を1.5秒以内に5回 → 課金の状態（ネイティブか・課金が使えるか・聞いた製品ID・返ってきた数/ID・エラー・ウィジェットの窓口・渡した結果）、「ウィジェットへ送る」「もう一度」「閉じる」。診断自体が落ちたら「診断そのものが落ちた: …」 `App.jsx:1269-1302,3057-3078`, `settingsview.jsx:187`, `view.jsx:2147-2163`

### 4.4 共有
- [ ] 1件の予定を送る（予定の「···」>「この予定を送る」）：文「M/D（曜） 開始〜終了 題名 @場所（まだ仮）」（終日は「 終日」／「からN日間」、場所が URL なら @ を付けない、点線なら（まだ仮））、link があれば次の行、場所があれば「地図：https://maps.apple.com/?q=…」。.ics（その1件）を `LUKKO-{M}月{D}日.ics` で添えて共有シート。非ネイティブはコピー `App.jsx:1228-1241,4663`, `shareimg.js:233-246`
- [ ] 画像の共有は Cache に PNG を書いて `Share.share({files:[uri]})`（text は付けない）。非ネイティブはダウンロード（「画像を保存しました」）。閉じただけ・失敗は黙る `shareimg.js:252-283`
- [ ] 今月のまとめ：1080×680（バイト先が3つ以上なら1つごとに+88）。年月・概算の金額・「およそ　{時間}・{日数}日」・バイト先ごとの行（時給・回数・時間・金額）・記録が無ければ「働いた記録がありません」・署名「✓？ LUKKO」。対象は今月の jisseki かつ baito `sharecard.js:82-109`, `App.jsx:5703-5713`
- [ ] 今年のまとめ：1080×1440（使い始める前の分の注記で+44、バイト先3つ以上で+116ずつ）、月ごとの棒（いちばん多い月を濃くして時間を添える） `sharecard.js:117-165`, `App.jsx:5690-5701`
- [ ] ファイル名：`LUKKO-まとめ-{Y}-{M}.png`／`LUKKO-まとめ-{Y}.png` `App.jsx:5724`
- [ ] まとめ画面のプレビューは実物の canvas の PNG（cardKind・年月・件数が変わったときだけ描き直す） `App.jsx:5335-5347`
- [ ] 空いてる日：幅1080、高さ 430+行数×106+300。マスは free（塗り）/part（点線＋「H時〜」）/busy（灰）/past（薄い）。見出しはふつう版「わたしの空いてる日」「{M}月のあいてる日」凡例「空いてる・時間による・予定あり」／ていねい版（使い方が学生以外で既定）「空き状況」「{M}月の空き状況」「終日可・時間によって可・予定あり」、名前を入れると「{名前}の…」。署名の一言（選んだときだけ）「空いてる日だけを送れるカレンダー（App Store で「LUKKO」）」。ファイル名 `LUKKO-空いてる日-{Y}-{MM}.png`。共有後に評価の小窓の候補 `sharecard.js:295-420`, `App.jsx:910-938,5725-5747`
- [ ] 空いてる日を文字で送る：クリップボードへコピー（「コピーしました。LINE やメールに貼り付けてください」）、できなければ共有シート `App.jsx:940-960,3614`, `shareimg.js:212-230`
- [ ] サポーターカード画像：1080×681（1080/1.586）、段ごとの紙・肌理（cardtexture の刷り目150本・粒900個、決め打ち乱数）・光・箔の粒・面取り・箔押しの字（LUKKO / S U P P O R T E R / ✓？ / 名前 / MEMBER SINCE / 合計 / 回数）。`LUKKO-サポーターカード.png`、失敗は「カードを作れませんでした」 `sharecard.js:427-556`, `cardtexture.js:19-27,104-117`, `App.jsx:5657-5684`
- [ ] まとめ・空いてる日の画像が作れないと「画像を作れませんでした」2.4秒 `App.jsx:5748-5751`

### 4.5 外部リンク・文書
- [ ] FORM_URL（Google フォーム）`https://docs.google.com/forms/d/e/1FAIpQLSewSGJ40HFVLD_Ogylt1NfyJ5Ek1w2j0vNudQo5A6PzBIzArw/viewform`、事前入力 entry：kind=entry.282144982、device=entry.2064364294、version=entry.581874367 `App.jsx:98-99`
- [ ] formHref：`usp=pp_url`＋kind（あれば）＋端末「iPhone・iOS 18.1」形式（UA から）＋版「1.3.3（0.32.2）」 `App.jsx:101-111`
- [ ] ヘルプ：「よくある質問」→ `https://kaitoiwaki.github.io/kimatteru/legal/support.html`、「使い方をもう一度見る」、「機能をリクエストする」（kind=機能のリクエスト）、「お問い合わせ」（kind 空）、「利用規約」「プライバシーポリシー」（アプリ内の doc 画面） `settingsview.jsx:290-297`, `App.jsx:2437,3130-3133,2559-2561`
- [ ] 「App Store でレビューする」→ `https://apps.apple.com/app/id6794792375?action=write-review` `App.jsx:3135`, `docs.js:7`
- [ ] 外部リンクは `<a target="_blank" rel="noreferrer">` `settingsview.jsx:84-102`
- [ ] 評価の小窓（requestReview）：使い始め7日未満は出さない、こちらからは60日に1回まで。条件＝空いてる日を送った（画像・文字）／確定が5・10・25回目／戻ったとき（使い始め14日超かつ予定20件以上）。出すときは lastReviewAsk を記録し1.2秒後に要求 `App.jsx:1985-2001,1778,3614,5134,5747`
- [ ] 連絡先メール CONTACT = voidlabs.work@gmail.com、APP_NAME 'LUKKO'、EFFECTIVE「2026年9月29日」（doc 画面の「最終更新：」） `docs.js:4-8`, `view.jsx:2595`
- [ ] プライバシーポリシー節：集めていない情報／入力した予定の扱い（ウィジェットへ20日先まで、隠す予定は「予定あり」）／地図を開くときについて／iPhone のカレンダーについて／iCloud での同期について／顔認証（Face ID）について／通知について／画像の共有について／子どもの利用について／方針の変更／お問い合わせ `docs.js:10-94`
- [ ] 利用規約節：第1条（適用）〜第9条（準拠法：日本法）＋お問い合わせ。第2条で応援は機能を増やさない・返金は原則不可 `docs.js:96-158`
- [ ] DOCS = {privacy, terms}。doc 画面：題・リード・節（両端揃え）・最終更新 `docs.js:160`, `App.jsx:2900-2908`, `view.jsx:2573-2597`
- [ ] APP_MARKETING：vite の `__APP_MARKETING__`（package.json marketing）、無ければ '1.3.3'。版の表示は「1.3.3（0.32.2）」 `App.jsx:112,2438`, `vite.config.js:39`

### 4.6 AppDelegate / ViewController
- [ ] AppDelegate は Capacitor の雛形のまま。起動・前後の切り替えで独自処理なし `AppDelegate.swift:9-34`
- [ ] URL で開かれたとき・ユニバーサルリンクは `ApplicationDelegateProxy` に渡すだけ `AppDelegate.swift:36-47`
- [ ] Info.plist に `CFBundleURLTypes`（独自 URL スキーム）は無い。通知のデリゲート設定も Swift 側には無い（プラグイン任せ）
- [ ] ViewController: `CAPBridgeViewController` を継承し、`WidgetBridgePlugin`・`LukkoNativePlugin`・`TabBarPlugin` を登録。Main.storyboard の画面クラスもこれに差し替え済み `ViewController.swift:15-29`
- [ ] LukkoNative の他の窓口: `alert`（UIAlertController、シートで cancel が無ければ「キャンセル」を足す、iPad は下中央から吹き出し、`preferred`）、`requestReview`（前面のシーンで SKStoreReviewController） `LukkoNative.swift:190-241`

## 5. 文言（どこにあるか）

**画面・通知・ウィジェット・共有の文はすべて一字一句そのまま移す。** 言い換え・要約・句読点の変更もしない（`notices.js:8-15` の「アプリの文章のきまり」に合わせて書かれている）。ここでは文の置き場所だけを挙げる。移したあとは、各置き場の文字列を機械的に突き合わせて漏れを確かめる。

### 5.1 画面の文
- [ ] `view.jsx` 全体：月・週・日・一覧・空き状況・作成/編集・詳細・確認・お祝い・まとめ・カード・案内・取り込み・規約・お知らせ・タブの、JSX に直接書いた見出し・ボタン・説明（`{/* */}` のコメントは文言ではない）
- [ ] `settingsview.jsx` 全体：設定の各画面の行の名前・説明（NOTE）・シートの見出し・箇条書き（`bullets()` `settingsview.jsx:25`）
- [ ] `App.jsx` の `renderVals()`（`App.jsx:2453-4993`）：`v.*` に入れる文。とくに量が多い所
  - [ ] はじめての案内 `App.jsx:2593-2766`
  - [ ] 保存についての知らせ・何も無いときの案内 `App.jsx:2766-2784`
  - [ ] 取り込み画面（手順・エラー・札）`App.jsx:2784-2900`
  - [ ] 規約・応援・サポーターカード `App.jsx:2900-3137`
  - [ ] 控え・お知らせ（ベル）`App.jsx:3137-3213`
  - [ ] まとめ・一覧・空き状況シェア・知らせのひとこと `App.jsx:3298-3620`
  - [ ] 作成画面（よく入れる予定・長さ・重なり・候補日・いつか・名前を隠す・捨てるか・くり返し・お知らせ）`App.jsx:4045-4581`
  - [ ] 詳細・取り返しのつかない操作の確認・小窓・いつ空いてる？ `App.jsx:4581-4993`
- [ ] `App.jsx` の `_settingsVals()`（`App.jsx:2215-2453`）：設定の値の文（選択肢の名前、`seg([...])` の札など）
- [ ] `App.jsx` の `this.toast(…)` 呼び出し（26か所。`grep -n "toast(" App.jsx` で全部出る）と `showUndo(text, …)` の文
- [ ] `App.jsx` の `_nativeAlertSpec()`（`App.jsx:5892-5926`）：iPhone 標準の確認画面の題・本文・ボタン名

### 5.2 使い方・種類で変わる言葉
- [ ] `words()`（`App.jsx:547-572`）：使い方ごとの言い換え（バイト先／勤務先、例文、「おつかれさま／お疲れさまでした」など）
- [ ] `PROFILES`（`App.jsx:75-93`）：使い方の名前・説明・種類名
- [ ] 既定の種類（`App.jsx:527-534`）と `EXTRA_TYPES`（`App.jsx:56-64`）の name / uWord / cWord / uLabel / cLabel / ask / gone / celeb
- [ ] くり返しの単位・期間・第N（`REPEAT_UNITS` `REPEAT_SPANS` `NTH_LABEL` `App.jsx:183-206`）、いつか（`SOMEDAY_LABEL` `App.jsx:396`）、カードの段（`CARD_TIERS` `App.jsx:298-313`）
- [ ] `remindLabel`（`App.jsx:827`）、`spanLabel`（`App.jsx:835`）、`statusWord`（`App.jsx:1104`）、`fmtHours`/`fmtSpent`（`App.jsx:725-747,824`）
- [ ] 空き状況の送る文（`freeText` `freeWords` `freeTextBlock` `App.jsx:891-960`。ていねい／くだけた の2通り）

### 5.3 本体の外の文
- [ ] 通知：`notify.js:94-191`（おつかれさまの記録、予定のお知らせの「（まだ）」・時刻の言い方、朝「今日 N件（うち まだN件）」、前の晩「明日 …」、週「来週、まだ決まっていない予定がN件」、通知のボタン「決まった／無くなった／予定どおり記録する／開いて直す」）
- [ ] お知らせ（ベル）：`notices.js` の `RELEASE_NOTES`（`notices.js:17-`、版ごとの題と箇条書き）とシフトの催促の文（`notices.js:284-320`）
- [ ] 規約・プライバシーポリシー：`docs.js` の `PRIVACY`（`docs.js:10`）・`TERMS`（`docs.js:95`）・`EFFECTIVE`・`CONTACT`。**同じ原稿から公開用 HTML も作っている**（`tools/build-legal.mjs`）ので、置き場を2つに分けない
- [ ] 画像に描く文：`sharecard.js`（まとめカード・空いてる日の画像）、`cardflip.js` / `cardtexture.js`（サポーターカード）、`shareimg.js:40-68`（共有の結果のひとこと「控えを保存しました」など）
- [ ] 応援：`tipjar.js:25-29`（コーヒー1杯／ランチ1回／しっかり応援）、`tipjar.js:136-146`（ありがとう・失敗の文）、診断の文 `tipjar.js:45-91`
- [ ] 取り込み：`calendarimport.js`（「無題」「（名前なし）」、種類当ての言葉の表 `calendarimport.js:219-237`）、`iphonecal.js:72,142-145`（「予定」、書き出した予定の説明「LUKKO から」＝取り込みで弾く印なので変えてはいけない）
- [ ] `.ics`：`ics.js:52,196`（「無題」）
- [ ] ウィジェット：`ios/App/KimatteruWidget/KimatteruWidget.swift`（「まだ N件」「今週 まだN件」「決まっていません」「今日はおしまい」「このあと」「ほか N件」など。表示名「LUKKO」と説明 `KimatteruWidget.swift:1042-1043`）と `widgetdata.js:95`（名前を隠したときの「予定あり」）
- [ ] 本物のタブ：`ios/App/App/TabBar.swift:57`（カレンダー／空き状況／まとめ／設定）、`TabBar.swift:149`（「予定を追加」）、空き状況タブの ○△× の色 `TabBar.swift:198-200`
- [ ] ロック：`ios/App/App/LukkoNative.swift:167-169`（既定の理由「LUKKO を開きます」、取り消しボタン「やめる」）、標準の確認画面の「キャンセル」`LukkoNative.swift:215`
- [ ] 描画エラーの画面：`guard.jsx`
- [ ] 権限の利用目的：`ios/App/App/Info.plist:47-53`（カレンダー2つ・Face ID）。アプリ名 `CFBundleDisplayName` は「LUKKO」（`Info.plist:14`）、言語は ja

### 5.4 文字・見た目の素材
- [ ] 丸い字体 `LukkoYomogi`（`public/yomogi-lukko.woff2`、ライセンス `public/Yomogi-OFL.txt`、`styles.css:6-7`、`settingsview.jsx:522`）
- [ ] 画像 `src/assets/sprout-line.png`（`public/` にも同じもの）、アイコン `public/icon-192.png` `icon-512.png`、字体の実体は `src/assets/yomogi-lukko.woff2`
- [ ] 色の値：`App.jsx:29-60,116,483`、`styles.css` の CSS 変数（`--sun` `--sat` `--ink` など。明るい／暗いの2組）、`sharecard.js:6-20`

## 6. 既知の注意点（コードの「前は…」コメント）

コードのコメントに残っている、過去の不具合・決めごと。どれも「いまのふるまいを守る理由」なので、SwiftUI 版でも同じふるまいにする。ファイルごと・行の順に並べた（同じ行を別の見方で書いた項目が並ぶことがある）。

### App.jsx
- [ ] `App.jsx:94-95` 前は中の番号だけでストアの版と食い違った → 「1.3（0.31.0）」形式
- [ ] `App.jsx:95`（コメント）設定の版は「1.3（0.31.0）」のようにストアの番号を先に出す（前は中の番号だけで食い違っていた）
- [ ] `App.jsx:176` 分の刻みは 5 分固定（以前の 30 分刻みでは 17:20 が選べなかった）
- [ ] `App.jsx:177` 分は5分刻みで固定（以前は設定の刻み幅で、既定30分だと17:20が選べなかった）
- [ ] `App.jsx:194` / `208` くり返しは上限で黙って切られる → 単位ごとに現実的な期間だけ選ばせる（最大 200）
- [ ] `App.jsx:194-195` くり返しの長さは単位ごとに現実的な範囲だけ（毎日2年＝730件を上限で黙って切らないため）
- [ ] `App.jsx:212-213` 「毎月31日」で無い月は近い日に寄せず置かない
- [ ] `App.jsx:276-279` id が時刻だけだと混ぜたとき衝突して黙って消える → 乱数5文字を足す
- [ ] `App.jsx:332-337` 壊れた予定1件で描画が落ち続けた → 読むとき必ず sanitize。捨てるのは日付が読めないものだけ、ほかは直して残す
- [ ] `App.jsx:332-337` 壊れた予定は日付が読めないものだけ捨て、ほかは直して残す（落ちて起動できなくなった）
- [ ] `App.jsx:350-353` 0:00〜23:59 の取り込み予定が「23時間59分」と数えられた → 終日として扱う
- [ ] `App.jsx:350-353` 0:00–23:59 は終日扱い（まとめで「23時間59分」と数えていた）
- [ ] `App.jsx:367-368` 種類の形が1つ違うと月表示が丸ごと落ちる → 揃っていなければ既定に戻す
- [ ] `App.jsx:367` 種類が1つでも崩れていたら既定に戻す（月表示が丸ごと落ちた）
- [ ] `App.jsx:387-388` 消した印が無いと、もう1台が持っているものを送り返して消したものが戻った → gone を持つ
- [ ] `App.jsx:387-388` 棚・勤務先・種類・棚へ移した予定にも消した印（gone）を持つ（無いともう1台が送り返して消したものが戻った）
- [ ] `App.jsx:388` 消した印を持つ（無いと別の端末から消したものが戻ってきた）
- [ ] `App.jsx:402-406,415-416` 新しい種類の項目・新しい既定色が既存利用者に届かなかった → mergeTypes で埋め戻し、旧既定色のままなら差し替え
- [ ] `App.jsx:405-421` 旧既定色のままの種類だけ新しい色にする（保存の古い色が勝っていた）
- [ ] `App.jsx:491-494` 開始を動かすと終わりも同じだけ動かす（前は 10–11時の開始を14時にすると「14:00〜翌11:00」の21時間になった）
- [ ] `App.jsx:491-494` 開始を動かしたら終わりも動かす（前は「14:00〜翌11:00」の 21 時間の予定ができた）
- [ ] `App.jsx:501-503` 小窓でも開始に終わりを付いてこさせる。ただし worked は終わりを動かさない
- [ ] `App.jsx:528-529` 種類の paper を手で書いたら式とずれた → 必ず paperFrom の値にする
- [ ] `App.jsx:598-603` 点線の紙は白へ .62（.84 だと 用事 と その他 が見分けにくい）
- [ ] `App.jsx:607-613` 暗い表示は専用の式（明るい式のままだと 決まってる/まだ の差が 1.22 に落ちた）
- [ ] `App.jsx:616` 表示は iPhone に合わせる／明るい／暗い（以前はスイッチだけで既定オフ）
- [ ] `App.jsx:657-659` 色の地の字は黒へ .66（.58 だと暗い点線ピルで 4.4 まで落ちた）
- [ ] `App.jsx:676-688` まとめは昔バイト実績しか数えず、他の人には空だった。全種類を数える。終日は24時間にせず日数
- [ ] `App.jsx:778-781` 前は表示のたびに今の時給を掛け、時給を上げると過去の給料まで上がった → 記録時の時給を書き込む
- [ ] `App.jsx:780` 時給は記録時のものを使う（前は時給を上げると過去の給料まで上がった）
- [ ] `App.jsx:842` 空き状況は時間帯を平日/休日で分け勤務時間を数える（前は 9〜22 時固定で役に立たなかった）
- [ ] `App.jsx:969-971` 日をまたぐ勤務はその日 24:00 までふさがり扱い（[22:00,1:00] のままだと重なりの計算が崩れる）
- [ ] `App.jsx:1005-1008` 月のマスでは「？」を付けない（点線が言っている）。「✓」は塗り同士の唯一の手がかりなので残す
- [ ] `App.jsx:1030` 帯の角丸は3（4だと1つだけ丸くて浮く）
- [ ] `App.jsx:1113-1121` 未来のまだの予定は先に詳細を開く（前はいつも「どうなりました？」が先で、場所もメモも見られなかった）。今日・過去は小窓
- [ ] `App.jsx:1115-1118` まだの予定は先の日付なら先に詳細（以前はいつも「どうなりました？」が先で中身が見られなかった）
- [ ] `App.jsx:1115-1121` 先の日付のまだの予定は詳細を先に開く（前はいつも「どうなりました？」が先に出た）
- [ ] `App.jsx:1148` 素早く続けて払っても払った回数ぶん動く（以前は1回ぶん消えていた）
- [ ] `App.jsx:1157-1159` 既定の種類は用事（前は何もしなければシフトになった）。時刻も種類の既定から
- [ ] `App.jsx:1157-1169` 新規の種類は前回の種類、今日なら次の30分区切りから（前はいつも 用事 10:00–11:00）
- [ ] `App.jsx:1164-1169` 新規の初期値は前回の種類・次の30分の区切り・押した時刻・いつものお知らせ（前はいつも用事 10:00–11:00）
- [ ] `App.jsx:1204-1213` コピーは実績・無くなった・actualEnd・repId を持っていかない。日付えらびを開けて始める
- [ ] `App.jsx:1229-1231` 1件を送る形（前は全部まとめて書き出す形しかなかった）。まだの予定に「（まだ仮）」
- [ ] `App.jsx:1230` 前は全予定をまとめて書き出すしかなかった → 1件だけ送る
- [ ] `App.jsx:1242` キャンセルで書きかけを確かめる（前は確かめずに捨てていた）
- [ ] `App.jsx:1290-1292` 診断が落ちても「読み込み中…」で固めず、必ず理由を出す
- [ ] `App.jsx:1290` 診断そのものが落ちても必ず何か出す（「読み込み中…」で固まらない）
- [ ] `App.jsx:1290` 診断が落ちると「読み込み中…」で固まる → 必ず何か出す
- [ ] `App.jsx:1321-1323` 応援の購入は返事待ちの間の二度押しを止める。触覚は押せたあとに出す
- [ ] `App.jsx:1321-1323` App Store の画面が出るまで1〜2秒、二度押しできた → tipBusy で止める。触覚は押せたときだけ
- [ ] `App.jsx:1331-1332` 応援（消耗型）は Apple 側で復元できない → supports として予定と同じ入れ物（控えにも入る）
- [ ] `App.jsx:1331-1332` 消耗型は Apple で復元できない → supports を自前で保存（控えにも入る）
- [ ] `App.jsx:1334` 前は買えたあと下に 2 秒字が出るだけ。お礼の小窓（カードへの入口つき）を出す
- [ ] `App.jsx:1334` 前は下に2秒字が出るだけで、サポーターカードに気づかれなかった → お礼の小窓
- [ ] `App.jsx:1361-1362` 縦スクロールとの両立は touch-action:pan-y（React の touchmove は passive で preventDefault が効かない）
- [ ] `App.jsx:1443-1447` 案内の見本も本物と同じ 2 手（押す→「確定した」）。1 回で変えると実物で一手多く感じる
- [ ] `App.jsx:1461-1463` 案内のページ送りの押し下げで fast が立ち、次のページが速送りで始まっていた。印で見送る
- [ ] `App.jsx:1475-1476` 「使い方をもう一度見る」で同じ答えなら何も変えない。違っても自分で直した週のはじまり・勤務時間・空き状況の時間帯・仮の印は残す
- [ ] `App.jsx:1497-1499` 時給を変える前に、その勤務先の実績へ前の時給を書き込む（最初の 1 回だけ）
- [ ] `App.jsx:1520-1521` 勤務先を消すと設定の時給 1,120 円で数え直されていた → 名前と時給を実績に書き込む
- [ ] `App.jsx:1520-1521` 勤務先を消すと、前は設定の時給 1,120 円で数え直されて過去の給料が変わっていた。実績に時給と名前を書き込んで残す
- [ ] `App.jsx:1521` 勤務先を消しても実績には名前と時給を書き込んで残す（前は設定の時給 1,120 円で数え直された）
- [ ] `App.jsx:1543-1544` バイト先はその場で足す（設定画面へ飛ばすと入力が消える）
- [ ] `App.jsx:1564` 複数日で本体の日付は外せない
- [ ] `App.jsx:1574-1578`, `view.jsx:2546-2549` 1.3（110）で 5.1.1(iv) リジェクト：許可前の独自説明に「やめる」があった → 未確認なら開いた時点で OS ダイアログ。ボタン名は「続ける」（v1.0 で指摘）
- [ ] `App.jsx:1576-1578`、`view.jsx:2546-2549` 1.3（110）で 5.1.1(iv) リジェクト。まだ許可を聞いていない人には説明を挟まず即 iPhone の許可。ボタンは「続ける」（v1.0 指摘）
- [ ] `App.jsx:1597` 前は購読と誕生日以外を全部読んでいた。読むカレンダーを先に選ばせ、選択と種類を覚える
- [ ] `App.jsx:1597` 前は購読・誕生日以外の全カレンダーを読んでいた → 先に選ばせ、選択を覚える
- [ ] `App.jsx:1678-1679` 「これ以降ぜんぶ」はその日以降だけ消す（済んだ回は残す）
- [ ] `App.jsx:1694-1698` 確認を増やすより、やったあとで戻せる帯にする
- [ ] `App.jsx:1720` 戻した予定は updatedAt を付け直す（iCloud の「消した」印に負けてまた消える）
- [ ] `App.jsx:1720` 戻すとき updatedAt を付け直す（古いままだと iCloud の「消した」印に負けてまた消える）
- [ ] `App.jsx:1720` 戻した予定は updatedAt を付け直す（古いままだと iCloud の消した印に負けてまた消える）
- [ ] `App.jsx:1770` 確定したら予定の月の月表示を開く（以前は見ている月に戻り塗りが見えなかった）
- [ ] `App.jsx:1770` 確定したら予定の月を開く（前はいつも見ている月に戻り、別の月だと塗りが見えなかった）
- [ ] `App.jsx:1770` 確定したらその予定の月を開く（前はいま見ている月に戻り、塗りが見えなかった）
- [ ] `App.jsx:1779` 候補日のほかの候補は勝手に消さず聞く（`view.jsx:1866-1867` も同じ）
- [ ] `App.jsx:2113-2114` 種類を変えると時刻も既定に。ただし本人がいじった時刻は残す
- [ ] `App.jsx:2145-2146` 保存後は開く前の画面に戻す（前はどこから開いても月表示）
- [ ] `App.jsx:2145` 保存後は開く前の画面に戻る（前はいつも月表示）
- [ ] `App.jsx:2341` シフトの型を消すと番号が詰まり、置いたシフトが別の型に化けた → 残る型に今の番号を id として持たせる
- [ ] `App.jsx:2341` シフトの型を外すとき、残る型へ今の番号を id として持たせる（番号が詰まると置いたシフトが別の型に化ける）
- [ ] `App.jsx:2481-2484` キーボードが出ている間はナビを隠す（入力欄に乗った、TestFlight 実機）
- [ ] `App.jsx:2481-2484` 貼り付け中とキーボード表示中は下のナビを隠す（入力欄に乗った）
- [ ] `App.jsx:2499-2501`, `App.jsx:1147-1148` 素早く続けて払っても回数ぶん動く（以前は1回ぶん消えた）
- [ ] `App.jsx:2520-2522` 払っている間は setState しない（900件で指についてこなかった）
- [ ] `App.jsx:2536-2538` 戻すときは帯を自分でも動かす（React が同じ値を書かず位置が残った）
- [ ] `App.jsx:2542-2546` タッチ取り消しで月を変えず元へ（ずれたまま止まり白い所が出た）
- [ ] `App.jsx:2600,2693-2696` 案内の 1 枚目は押さなくても「つぎへ」で進める（押すまで進めないのは重かった）
- [ ] `App.jsx:2637-2639` 「予定を、少しだけ書いておきました。」は嘘だった。最初の一文はアプリが何かを言う
- [ ] `App.jsx:2642-2643` 一字ずつの見出しは折り返させない（「、」「。」が行頭に来る）
- [ ] `App.jsx:2649-2650` 案内の日付は --ink-mut（--ink-faint はコントラスト不足）
- [ ] `App.jsx:2675-2676` 案内の点線ピルは本物と同じ地色（直書きの色でダークモードの文字が沈んでいた）
- [ ] `App.jsx:2714-2715` 案内の時給の画面はやめた。時給は勤務先を作るときに聞く
- [ ] `App.jsx:2717-2719` 空き状況とシェアは 1 枚ずつ（1 枚に押し込むと読みにくかった）
- [ ] `App.jsx:2738-2740` シェアの見本にも日付の数字を入れる（抜くとカレンダーと分からなかった）
- [ ] `App.jsx:2822`、`view.jsx:2472` 取り込みの行の種類の札は前は 4 つ。1 つにして押すと次へ
- [ ] `App.jsx:2822` 行ごとの種類札は4つ並べていた → 1つで循環
- [ ] `App.jsx:2870-2872` 設定アプリの言い方は iOS の版で違う。両方書く
- [ ] `App.jsx:2939-2941` 通し番号と「◯人の1人」は出さない（サーバーを持たない）
- [ ] `App.jsx:2985-2988`、`cardflip.js:3-8` 角度と面を別に持って v0.21.2 で回転中にカードが消えた。角度ひとつから表裏を出す。CSS transition を使わない
- [ ] `App.jsx:2997-3000` backface-visibility は使わない（Safari で鏡文字が透ける・二重に消える）。向こうの面は opacity 0
- [ ] `App.jsx:2997-3000` Safari で backface-visibility が効かず鏡文字が透けた → 向こう側の面は opacity:0
- [ ] `App.jsx:3025-3027` 光の背景はまとめ書きを使わない（片方が落ちうる）
- [ ] `App.jsx:3040-3041` 箔は前は下に明かり 1 本（浮き出し）。上に影・下に明かりで沈める
- [ ] `App.jsx:3086-3095` tap-highlight を切っていて押しても無反応に見えた → 触れた瞬間に沈め、返事まで沈めたまま。振動は押し切ったときだけ
- [ ] `App.jsx:3093-3095` 応援の行の触覚は押し切ったときだけ（触れた瞬間に鳴らすと、スクロールでも鳴る）。沈む色は触れた瞬間
- [ ] `App.jsx:3240-3241` 年月えらびは横払いでも年送り（‹ › の的が小さい）
- [ ] `App.jsx:3403` 前の額を足したら必ず文で断る（時間と金額が合わない理由が分からなくなる）
- [ ] `App.jsx:3446-3448` まとめカードを開くとき cardFrom を必ず渡す（渡さないと閉じたとき別の画面へ戻った）
- [ ] `App.jsx:3454-3455` 先の予定を並べて見る所が無かった → これから一覧
- [ ] `App.jsx:3562-3565` 知らせは前はまとめ／空き共有の中だけ。控えから戻すと月表示へ移るので、どの画面でも出す
- [ ] `App.jsx:3563-3565` お知らせはまとめ／シェア画面以外でも出す（控えから戻したとき何も出なかった）
- [ ] `App.jsx:3563-3565` トーストはまとめ／空きシェアの外でも出す（前は控えから戻しても何も出なかった）
- [ ] `App.jsx:3588-3589` 画像も文字も空き状況と同じ判定・同じ月（以前は画像だけ別判定・カレンダーの月）
- [ ] `App.jsx:3659-3666,3769-3770` 段数は画面の高さから（固定4段だと白いまま「+N件」、字を大きくした6週の月で最終週がナビに隠れた）。「+N件」行は auto
- [ ] `App.jsx:3671-3673` 夜勤の明けは月のマスに出さない（予定が2つに見えた）
- [ ] `App.jsx:3699-3703` 帯はタップを受けない。マスのどこでもその日を開く
- [ ] `App.jsx:3729-3746` 今日の印：面は「選択状態」に見える／黒丸は赤青を潰す／点は紛れる／上辺の線は見つけにくい → 曜日色の丸＋薄い地＋戻ったとき一度光る
- [ ] `App.jsx:3755-3756` マスを押したら、そのマスの月の日を開く（見えている月と ym がずれて違う日が開いた）
- [ ] `App.jsx:3795-3796` 週表示は指で流す形に（以前は7日ずつパッと切り替わり途中で止められなかった）
- [ ] `App.jsx:3862-3865` 最初の案内は ✕ で消したら、予定が 0 件に戻っても出さない
- [ ] `App.jsx:3863-3865` ✕で閉じた案内は、予定が0件に戻っても二度と出さない
- [ ] `App.jsx:3881` 月で隠す「無くなった」は日の画面でも隠す（画面ごとに違うと混乱）
- [ ] `App.jsx:3883` 前の日から続く夜勤は翌日の一覧に出さない（予定は始まった日に1つ）。`evCovers` は日数（evSpan）で判定するので、日をまたぐ時刻だけの夜勤は翌日に入らない `App.jsx:143`
- [ ] `App.jsx:3893-3894` 日の行は時刻2段＋色の棒＋場所（以前は札の中に題名・時刻は右端・場所なし）
- [ ] `App.jsx:3964` 削除の赤は動いているときだけ（角のすき間から赤がのぞいた）
- [ ] `App.jsx:4009` 日の送りは払いではしない（行の左払い＝削除とぶつかる）
- [ ] `App.jsx:4051`／`App.jsx:4817-4818` 白字の地は種類の色を35%暗く（コントラスト4.5以上）
- [ ] `App.jsx:4053-4055` Enter で保存。変換中の Enter は無視
- [ ] `App.jsx:4155-4156`／`view.jsx:1246-1247` 年月を直接えらべる（1か月ずつだと来年3月まで8回タップ）
- [ ] `App.jsx:4191-4195` 日のマスは押した日だけ選ぶ（以前は2回目以降を追加の日にしていて、押し間違いを直せなかった）
- [ ] `App.jsx:4255` 何日間の−/＋は state から読む（連打の取りこぼし防止）
- [ ] `App.jsx:4265-4266` 終日切替で選べないお知らせ値は「なし」へ（選択が消えた見た目を避ける）
- [ ] `App.jsx:4276-4277` 行は既定で全部閉じ、一度に1つだけ開く
- [ ] `App.jsx:4293-4304` くり返し・場所・メモは＋で足す。編集中はくり返し・複数日を出さない
- [ ] `App.jsx:4319` ✕で行を消すと値も捨てる（中身だけ残って保存されるのを防ぐ）
- [ ] `App.jsx:4364-4366`／`view.jsx:1402-1403` 複数日は専用の入口。もう一度押せば外せる
- [ ] `App.jsx:4401-4402` 複数日のカレンダーで本体の日は外させない
- [ ] `App.jsx:4452`／`App.jsx:4467` 単位を変えたら長さを寄せる。曜日・第Nは最後の1つを残す
- [ ] `App.jsx:4526-4530`／`view.jsx:1310-1313` 終了日は選ばせない。日をまたぐときだけ「翌日」と言う
- [ ] `App.jsx:4549` 隠した種類は出さない（今の種類だけは出す）
- [ ] `App.jsx:4557` 作成画面では種類の色を変えない（設定に一本化）
- [ ] `App.jsx:4577` 3マスの見本はやめ、説明1行だけ
- [ ] `App.jsx:4586-4588` 詳細の日付は予定自身の年月日から（前は見ている月＋日で「9月30日」と出た）
- [ ] `App.jsx:4619-4620` 場所が URL だけなら地図でなくリンク扱い
- [ ] `App.jsx:4631` 働いた記録はバイトと仕事に付けられる。給料はバイトだけ
- [ ] `App.jsx:4635-4648` 編集・コピー・削除は「···」に（v0.27.0 でカード下に並べたら実績の画面が詰まった。混んでいるほうに合わせる）。コピーはこれからの予定だけ
- [ ] `App.jsx:4654-4656` 「働いた時間を直す」はメニューへ（緑の主ボタンは次の状態へ進むときの色）
- [ ] `App.jsx:4671` メニューは押したらまず閉じる（開いたまま次へ行くと、戻ったとき開いている）
- [ ] `App.jsx:4709`／`App.jsx:4715-4716` ほかの予定のピルに？を付けない。戻り先は変えない
- [ ] `App.jsx:4760` 削除の本文で「元に戻せません」と脅さない（30日は戻せる）
- [ ] `App.jsx:4767-4768` くり返しは「この日から先も」を選べる（90件を1件ずつ消させない）
- [ ] `App.jsx:4849-4850` 「別の日になった」を足した（前は延期に編集画面まで行くしかなかった）
- [ ] `App.jsx:4889` 3択のどれでもないときの逃げ道（予定の内容を直す）
- [ ] `App.jsx:4922` 空き状況の日付は日曜・祝日赤、土曜青（以前は薄くなるだけで祝日が分からなかった）
- [ ] `App.jsx:4946-4947` 左端から戻る（以前は ← しかなく大きい iPhone で親指が届かなかった）
- [ ] `App.jsx:4946-4947` 左端からなぞって戻る（前は「←」しかなく親指が届かなかった）。新規画面は指に付けず、なぞりきったら閉じる
- [ ] `App.jsx:4971-4973` 月の見出しは折り返し禁止＋3段階に詰める（「10／月」「今／日」と縦に折れた）
- [ ] `App.jsx:5055` 通知からは予定そのものを開く（前はその日の一覧だった）
- [ ] `App.jsx:5077-5079` iPhone で長く開いたままだと visibilitychange が来ず「今日」が数日前のままになった（2026-10）→ Capacitor の resume/pause でも同じ処理、1.5秒で重複を1回に
- [ ] `App.jsx:5077-5079` 長く開きっぱなしで visibilitychange が届かず「今日」がずれた（2026-10）→ Capacitor resume/pause でも同じ処理、1.5秒以内の二重呼び出しはまとめる
- [ ] `App.jsx:5086` 背景に回ったら待たずにファイルへ書く（そのまま終了されることがある）
- [ ] `App.jsx:5112-5113` 戻った瞬間に日付を確かめ直す（朝ひらくと今日が昨日のままだった）
- [ ] `App.jsx:5112-5114` アプリに戻ったら即日付を確かめる（前は1分ごとだけで、朝「今日」が昨日のままのことがあった）
- [ ] `App.jsx:5121` 払う途中で離れたら、戻ったときに払う途中の状態を捨てる
- [ ] `App.jsx:5185-5186` 暗くするのは黒幕（filter だとすりガラスを含む画面が真っ白に写った、2026-10）
- [ ] `App.jsx:5296-5298` 描き直しのあと帯の位置を state に戻す（途中でアプリを離れると隣の月を見せたままだった）
- [ ] `App.jsx:5304-5308` 前は描き直すたびに全予定を保存して重かった → PERSISTED の参照が変わったときだけ。直に書き換えず常に新しい配列/オブジェクトにすること（参照比較が前提）
- [ ] `App.jsx:5304-5307` 保存は保存対象が変わったときだけ（払うたびに全予定を書いていた）
- [ ] `App.jsx:5304-5307` 保存は PERSISTED が入れ替わったときだけ（払うたびに全予定を保存して重かった）
- [ ] `App.jsx:5310-5311` 初めての日は控えが1つも無かった → 予定が変わったら5秒後に今日の控え
- [ ] `App.jsx:5310-5311` 初めての日も控えが取れるよう、予定が変わって5秒後にも自動控え
- [ ] `App.jsx:5325` 同期で来た変更をそのまま書き戻さない（`_fromSync`）
- [ ] `App.jsx:5336-5338` プレビューを JSX で組み直していて書き出しと食い違った → 実物の画像を見せる
- [ ] `App.jsx:5354-5357` 起動時に shift と info のお知らせが同時に走り、古い配列で上書きして消えた → notices は必ず setState の updater の中で読む
- [ ] `App.jsx:5355-5357` `_refreshNotif` は setState の関数形で最新 notices を読む（同じ tick のアップデートのお知らせが消えていた）
- [ ] `App.jsx:5361-5363,5352-5358` お知らせは setState の中で今の notices を読む（古い配列で上書きしてアップデートの知らせが消えていた）
- [ ] `App.jsx:5386` 控えの名前は LUKKO-控え-…。古い kimatteru-backup-… も中の印で戻せる
- [ ] `App.jsx:5386` 古い名前（kimatteru-backup-…）の控えも中の印で戻せる
- [ ] `App.jsx:5386` 書き出し名は LUKKO。古い名前（kimatteru-backup-…）の控えも中の印 `app:'kimatteru'` で戻せる
- [ ] `App.jsx:5393-5395,5478` 戻すのはファイル選択（input file）が本筋。選べないときは貼り付けへ
- [ ] `App.jsx:5442-5444` 以前の取り込みで誕生日・祝日が予定として入っている → 整理で本人が選ぶ（勝手に消さない）
- [ ] `App.jsx:5478-5479` ファイルを選べない環境なら黙らず貼り付けを開く
- [ ] `App.jsx:5486-5487` 同じファイルを選び直せるよう input の値を空に戻す
- [ ] `App.jsx:5487` 同じファイルを選び直せるよう input の値を空に戻す
- [ ] `App.jsx:5508-5510` 新しい版の控えは読まない（黙って読むと壊れた予定が並ぶ）
- [ ] `App.jsx:5508-5512` 先の版で書かれた控えは読まない（理由を出す）
- [ ] `App.jsx:5516` 確認で出す件数と実際に戻る件数を合わせる（sanitize 後に数える）
- [ ] `App.jsx:5516` 確認に出す件数は、ふるいにかけたあとの数（実際に戻る数）
- [ ] `App.jsx:5516` 確認に出す件数と実際に戻る件数を合わせるため、先にふるいにかける
- [ ] `App.jsx:5603-5605` 字の大きさは予定の字だけ（以前は画面ごと拡大で見出しが折れた）。前の版の zoom は消す
- [ ] `App.jsx:5615-5616` ナビ上端は測る（104 決め打ちでずれた）
- [ ] `App.jsx:5757-5762` 前は localStorage だけを信じて、書けない日が続くとファイルの新しい中身まで古い中身で上書きした → savedAt と中身で比べ、古いほうは控えに残す
- [ ] `App.jsx:5757-5763` 起動時は localStorage とファイルの新しいほうから始める（古い localStorage でファイルを上書きして予定が消えた）。古いほうは控えに残す
- [ ] `App.jsx:5772-5773` localStorage が消えていても、起動後に何か作っていたらファイルで上書きしない
- [ ] `App.jsx:5850-5851` 背景に回るときは debounce を待たずに書く（そのまま終了されることがある）
- [ ] `App.jsx:5858-5860` 起動時の確かめが済むまでファイルに書かない（新しいファイルを古い中身で潰さない）
- [ ] `App.jsx:5858-5859` `_checkFile` が済むまでファイルに書かない

### view.jsx
- [ ] `view.jsx:6-8,2529` 取り込みの画面は前は 3 段落＋箱 2 つで読む気が失せると言われた。絵 1 枚と 2 行
- [ ] `view.jsx:7-8` 取り込みの説明は文3段落をやめ絵＋2行に（説明が一気に出ると押すボタンが分からないという指摘）
- [ ] `view.jsx:44-45`, `App.jsx:722` 種類の内訳の下段は名前が2つ以上のときだけ（同じことを二度言わない）
- [ ] `view.jsx:71-73` 「入れ子が深いと rollup が落ちる」は誤り。原因は Node 24.13 の rmSync
- [ ] `view.jsx:75-76`, `App.jsx:3358` 月と年をタブに分ける（1枚だとバイトの人は2.5画面で給料まで遠かった）
- [ ] `view.jsx:196`, `App.jsx:3385-3387` 給料はバイト実績がその年にある人だけ。金の話は要らない人に出さない
- [ ] `view.jsx:285-287` 「使い始める前の額」は設定でなくまとめの年タブに置く（気づくのがこの画面）
- [ ] `view.jsx:640`, `App.jsx:2471-2472` 月名を押して年月えらび（‹ › だけだと来年3月まで7回）
- [ ] `view.jsx:711-713` 曜日見出しとマスの左右余白を同じに（以前は左7px・右-5pxずれた）
- [ ] `view.jsx:767-769` はじめての案内は浮かせる（列の中だと最終週を切っていた）
- [ ] `view.jsx:768-769` 月表示の最初の案内は前は列の中で最終週を切っていた。上に浮かせる
- [ ] `view.jsx:1049-1050` シェアは空き状況の画面に置く（まとめタブだと見ている月と送る月が別だった）
- [ ] `view.jsx:1076-1078` 取り込みを勧めるのは空き状況が空のとき（最初の画面で許可を求めると断られる）
- [ ] `view.jsx:1122-1123` 右上の保存だけ太さを残す（キャンセルと強さを分ける）
- [ ] `view.jsx:1398-1399` 足した行の並びは足した順でなく固定
- [ ] `view.jsx:1539-1541` 「＋」の高さはチップと同じ（チップの寸法を変えたら合わせる）
- [ ] `view.jsx:1550-1551` 保存は下にも置く（片手で親指が届くように）
- [ ] `view.jsx:1926-1927` まとめカードの地は明色固定（テーマに従うと白地に白文字）
- [ ] `view.jsx:1936-1938`、`App.jsx:5336-5339` まとめカードのプレビューを JSX で組み直していて、書き出しと寸法が食い違った。実物の PNG をそのまま見せる
- [ ] `view.jsx:1971-1973` シェアの見本カードは固定色（テーマに従うと書き出す PNG と食い違う）
- [ ] `view.jsx:2418-2419` 前は取り込んだあと追加のしかたがどこにも無かった。「下の ＋ から」を出す
- [ ] `view.jsx:2555-2559` 許可の話は事実だけ。緑で目立たせ「選んでください」と書いて v1.0(49) でリジェクト
- [ ] `view.jsx:2555-2559` v1.0(49) で 5.1.1(iv)：緑で目立たせ「選んでください」と許可を促していた → 事実だけ書く

### settingsview.jsx
- [ ] `settingsview.jsx:9-14,141` 設定は前は 1 枚に 40 行。最初の画面は名前と値だけ、中身は押して開く画面に分ける
- [ ] `settingsview.jsx:30` 値のある行は名前に半分の幅を残す（文字を大きくすると名前が 2 行に折れていた）
- [ ] `settingsview.jsx:49-50` 選ぶ行は前は独自メニュー。iPhone 標準のホイール（時刻と同じ）にそろえる
- [ ] `settingsview.jsx:143` 応援とレビューは前はいちばん下で気づかれにくかった。いちばん上に置く
- [ ] `settingsview.jsx:511-513` 前は戻るたびに先頭へ戻っていた。最初の画面の位置を、取り込み・規約から戻っても残す

### backup.js
- [ ] `backup.js:3-4` 前は手で書き出すしかなかった → 毎日の自動控え
- [ ] `backup.js:96` 消すのは `Filesystem.deleteFile`（rmSync を使わない）

### calendarimport.js
- [ ] `calendarimport.js:26-28` 設定アプリを開くのに App.openUrl('app-settings:') は canOpenURL に弾かれる → 専用プラグインを使う
- [ ] `calendarimport.js:53-54` iOS 17 以降は読み取り専用の権限が無い。requestReadOnlyCalendarAccess は Android 専用で iOS では何も起きない → Full Access を求める
- [ ] `calendarimport.js:82-84` 誕生日・購読カレンダーを読むと七夕・誕生日が予定として数えられた → 読まない
- [ ] `calendarimport.js:82-85` 誕生日・購読カレンダー（七夕・七五三・誕生日が23時間59分ずつ）を読んでいた → 読まない
- [ ] `calendarimport.js:95-96` 書き出しで LUKKO が書いた予定（description 'LUKKO から'）は取り込まない
- [ ] `calendarimport.js:95` 書き出しで LUKKO が書いた予定を取り込むと二重になる → description「LUKKO から」を除外
- [ ] `calendarimport.js:105-107` 祝日を終日かどうかで判定していて山の日が二重に出た → 名前一致なら終日でなくても除外
- [ ] `calendarimport.js:113-114`, `iphonecal.js:38-39` 日をまたぐ予定を 23:59 で切り、何日も続く終日を1日にしていた（夜勤が途中で消えた）→ toAppShape で保つ
- [ ] `calendarimport.js:117` 前は題名と時刻だけで会議のリンクが落ちた → 場所・メモ・URL も写す
- [ ] `calendarimport.js:155-157` 前は「日・開始・題名」だけで同一判定し、元で時刻を変えると2件残り、元で消えても残った → srcId で changed/gone
- [ ] `calendarimport.js:163-164` くり返しは srcId が同じ → 番号ごとに全件持つ（前は毎週のシフトが別の日へ動いた）
- [ ] `calendarimport.js:163-164` くり返しの srcId を1件しか持たず、毎週のシフトが1件ずつ別の日へ動いた → srcId→配列、同じ日を優先
- [ ] `calendarimport.js:224-225` 「勤務」を含む予定がみなバイトに（在宅勤務・研修）→ work を先に、work が見えている人にはくり返し当てをしない
- [ ] `calendarimport.js:283` 日をまたぐ勤務の長さがマイナスになって当たらなかった → +1440

### cardflip.js
- [ ] `cardflip.js:3-8`, `App.jsx:2985-2988` 角度と面を別に持ち回転中にカードが消えた（v0.21.2）→ 角度ひとつから出す、CSS transition を使わない
- [ ] `cardflip.js:92-94` カードの縁は前は四辺同じ線で「描いた四角」に見えた。面取りにする

### guard.jsx
- [ ] `guard.jsx:3-9` 描画エラーで真っ白のまま動かなかった → 受け止めて「もう一度開く」、`lukko.lastError` に1件残す（予定の保存とは別の鍵）
- [ ] `guard.jsx:3-4` 描画エラーで真っ白のまま動かなくなった → Guard

### ics.js
- [ ] `ics.js:11-13` アプリは時差を扱わないので Z・TZID を付けない（付けると狂う）

### ios/App/App/LukkoNative.swift
- [ ] `LukkoNative.swift:13-14` ぼかしの要否は Swift 側（UserDefaults）で決める（背景に回る瞬間は JS が動かないことがある）
- [ ] `LukkoNative.swift:13-14` 背景に回る瞬間は JS が動かないことがある → ぼかしの可否は UserDefaults で Swift 側が決める
- [ ] `LukkoNative.swift:171` パスコードも無い端末は締め出さない
- [ ] `LukkoNative.swift:171` パスコード未設定の端末は締め出さない（ok:true）

### ios/App/App/TabBar.swift
- [ ] `TabBar.swift:76-81` Xcode 26（Swift 6.2）未満では UIGlassEffect を書かない（#if compiler）

### ios/App/App/ViewController.swift
- [ ] `ViewController.swift:12-13` 自前プラグインは `registerPluginInstance` が要る（無いと `isPluginAvailable` が false）

### ios/App/App/WidgetBridge.swift
- [ ] `WidgetBridge.swift:12-16`, `App.entitlements` App Group 名は3か所でそろえないと黙って届かない
- [ ] `ios/App/App/WidgetBridge.swift:14-18` App Group 名は3か所でそろえる（違うと黙って届かない）
- [ ] `WidgetBridge.swift:14-18`, `widgetbridge.js:10`, `App.entitlements` App Group 名は JS・App・拡張の3か所でそろえる（違うと黙って届かない）
- [ ] `WidgetBridge.swift:48-49` 保存後に `reloadAllTimelines` を呼ぶ（呼ばないと古いまま。回数上限あり）

### ios/App/KimatteruWidget/KimatteruWidget.swift
- [ ] `KimatteruWidget.swift:20-24` ウィジェットだけ iOS 17 以上（16 以前との両対応はしない）
- [ ] `ios/App/KimatteruWidget/KimatteruWidget.swift:48` `past` を CodingKeys に入れると全体の decode が失敗する
- [ ] `KimatteruWidget.swift:48` `past` を CodingKeys に入れない（無いキーで全体の decode が失敗）
- [ ] `KimatteruWidget.swift:65-66` 色の寄せ量 .32/.62/.66 はアプリとそろえる
- [ ] `KimatteruWidget.swift:94-98,806-807` 今日の丸は background（高さを取らず、点・帯を押し下げない）
- [ ] `KimatteruWidget.swift:106-107` 日付キーは西暦固定（和暦設定で毎日「予定なし」になった）
- [ ] `KimatteruWidget.swift:174` 終わった予定は「まだ」に数えない
- [ ] `KimatteruWidget.swift:470,845` 行数は `cells.count/7`（`max(1,…)` だと空配列の [0] で落ちる）
- [ ] `KimatteruWidget.swift:747,874,880` `k` が無い古い中身も読めるようにする（日ごとの別扱い）
- [ ] `KimatteruWidget.swift:1046` iOS 17 の自動余白を切る（二重余白）

### iphonecal.js
- [ ] `iphonecal.js:6-10` 書き出し・重ねは既定オフ。「読むだけ」と約束してきたので黙って書かない
- [ ] `iphonecal.js:38-39` 日をまたぐ予定を 23:59 で切って夜勤が消えていた → 24時間以内はそのまま、超えたら終日の何日間
- [ ] `iphonecal.js:47` 読み出しは `allDay`、書き込みは `isAllDay`（前は1日の終日が 0:00–23:59 の時刻予定になった）
- [ ] `iphonecal.js:47` 読み出しは allDay、書き込みは isAllDay。isAllDay だけ見ていて1日の終日が 0:00–23:59 の時刻予定になった
- [ ] `iphonecal.js:132` '#id' は署名。予定 id と取り違えて消さない
- [ ] `iphonecal.js:143` 場所は undefined でなく '' を送る（隠した後も前の場所が残った）
- [ ] `iphonecal.js:143` location を undefined にすると送られず、隠したあとも前の場所が残った → '' を送る
- [ ] `iphonecal.js:149` リンクは modify で消せない → 消して作り直す
- [ ] `iphonecal.js:149` リンクは modifyEvent で消せない → url が無くなったら消して作り直す

### main.jsx
- [ ] `main.jsx:9` touchstart を聞かないと :active が効かない

### notices.js
- [ ] `notices.js:11-15` お知らせの本文は短く箇条書き（前は 1 段落で見にくいと言われた）
- [ ] `notices.js:292-295` 深夜勤務（22:00–1:00）で始まる前の朝に催促が出ていた。終わる瞬間で比べる
- [ ] `notices.js:292-295` ベルの催促も同じ理由で終わる瞬間（`endMoment`）と比べる（朝に催促が出ていた）
- [ ] `notices.js:321-325` 版を文字で比べると 0.10.0 < 0.9.0 になる。数で比べる
- [ ] `notices.js:322-325` 版を文字列で比べると 0.10 < 0.9 になる → 数で比べる
- [ ] `notices.js:338-339` 初めて使う人に過去のお知らせを出さない
- [ ] `notices.js:344-345` まだ配っていない版のお知らせは出さない

### notify.js
- [ ] `notify.js:38-39` iOS の保留は64件 → 近い順に60件
- [ ] `notify.js:38-39,171` iOS 保留上限64件 → 近いものから60件。遠い予定に枠を食わせない
- [ ] `notify.js:49` 1日以上前の通知は「N日後」で言う（7日前に「明日」と言わない）
- [ ] `notify.js:99-100` / `notices.js:292-295` 22:00–1:00 の勤務で始まる前に「おつかれさま」が出た → 終わる瞬間（endMoment、翌日へ繰り越し）で判定
- [ ] `notify.js:99-101` 深夜勤務は終わりが翌日。`endMoment` で日をまたがないと、シフト前に「おつかれさま」が飛ぶ
- [ ] `notify.js:207` 出すものがあるときだけ許可を聞く（起動しただけでダイアログを出さない）

### sharecard.js
- [ ] `sharecard.js:74-77`, `App.jsx:5704-5705` 「果たした約束」「流れた予定」は数えていないのでやめた
- [ ] `sharecard.js:177-178` WKWebView の版によって ctx.letterSpacing が無い → 1文字ずつ置く

### shareimg.js
- [ ] `shareimg.js:275-276` text を一緒に渡すと Slack などが画像を落とす → 画像だけ渡す

### store.js
- [ ] `store.js:7-9` WKWebView の localStorage は OS に消されうる → ファイルと二重に書く
- [ ] `store.js:7-9,21-22` WKWebView の localStorage は OS に消されうるので Library のファイルにも書く（Library は iCloud バックアップに入る）
- [ ] `store.js:21-23` ファイルは Library（iCloud バックアップに入る。Data/Cache は使わない）

### sync.js
- [ ] `sync.js:62` 1MB 上限に近い（900000字超）なら書かない
- [ ] `sync.js:65` 前より短くなったら余った切れ端を消す
- [ ] `sync.js:274-275` 前より短くなったら余った切れ端を消す

### timegrid.js
- [ ] `timegrid.js:18-20` 夜勤は翌日 0:00–終わり を続きとして出す（前は明けの朝が空いて見えた）

### tipjar.js
- [ ] `tipjar.js:31-35` プラグインの動的 import が実機で返ってこず止まった → 静的 import
- [ ] `tipjar.js:38-41` ネイティブが返事をしないことがある → 商品取得は8秒で打ち切り
- [ ] `tipjar.js:96-110` 値段はストアの文字。円以外が返ったら TIPS の円に（記録の合計と食い違わないため）
- [ ] `tipjar.js:103-110` テスト用 Apple ID の国でドルが返る → 円以外は TIPS の円で表示（世界展開時は記録ごと作り直し）
- [ ] `tipjar.js:130-135` 購入に待ち時間の上限をかけない（かけていたら成功なのに「購入できませんでした」と出ていた）
- [ ] `tipjar.js:130-134` 購入に時間制限をかけていて、完了したのに「購入できませんでした」と出た → 購入は無制限

### whenlib.js
- [ ] `whenlib.js:3-6` 日またぎの判定は whenlib に集約（前は通知と空き状況が見落としていた）
- [ ] `whenlib.js:21-24` 0:00 ちょうどに終わる予定は翌日に続きを出さない（前は翌日にも出て2つに見えた）

### widgetbridge.js
- [ ] `widgetbridge.js:14-16` Capacitor.Plugins から拾うと見つからないことがあった → registerPlugin
- [ ] `widgetbridge.js:14-16` `registerPlugin` で受け取る（`Capacitor.Plugins` 経由だと「まだ何も届いていません」のままになった）
- [ ] `widgetbridge.js:14-16`, `ViewController.swift:9-14` Capacitor.Plugins から拾うと見つからず、自前登録しないと isPluginAvailable が false だった → registerPlugin＋registerPluginInstance

### widgetdata.js
- [ ] `widgetdata.js:7-10` 「今日のぶん」を書かない（日付ごとに書き、今日はウィジェットが決める）
- [ ] `widgetdata.js:7-10` 「今日のぶん」を書き出さない。今日はウィジェットが決める（数日開かなくても古い日を指さない）
- [ ] `widgetdata.js:53-54` 持ち物は改行でだけ分ける（読点で切らない）
- [ ] `widgetdata.js:80-82` 月末に月初が「予定なし」に見えた → 今月まるごとを必ず含める
- [ ] `widgetdata.js:80-82` 今月まるごとを必ず入れる（月末に月初が「予定なし」に見えた）
- [ ] `widgetdata.js:94` ロック画面にも出るので、隠す予定は名前も持ち物も渡さない
- [ ] `widgetdata.js:117` 日をまたぐ勤務を翌日にも出すと予定が2つに見えた → 始まった日だけ
- [ ] `widgetdata.js:117` 日をまたぐ勤務は開始日だけ（翌日に 0:00–0:30 を足すと2件に見えた）

## 7. 読んでいて気づいた食い違い（要判断）

コードを読んで見つけた、意図と違いそうな所・使われていない所。**いまのふるまいとして記録してある**（2〜6 の項目はこれを含む）。SwiftUI 版で「そのまま写す／直す」を1つずつ決める。直す場合は、正解表（ゴールデンテスト）の期待値もそこだけ変える。

### 7.1 App Store の審査に関わるもの
- [ ] 取り込み画面の idle には「続ける」「やめる」がある。未確認（prompt）の人は画面を開いた瞬間に OS の許可が自動で出るので、許可の**前**に「やめる」を押す場面は無い。ただし許可の後ろで「やめる」が画面に残っている（scanning 中も）`App.jsx:1574-1584`, `view.jsx:2524-2553`。SwiftUI 版も「許可の前にやめる・あとでを置かない」（5.1.1(iv)）を守る
- [ ] 通知の許可は、予約するものが1件以上あるときに `syncReminders` の中で直接 OS に聞くだけ。断られたあとの案内・聞き直しの画面は無い `notify.js:24-34,205-209`

### 7.2 計算
- [ ] 開始と終わりが同じ時刻：`hoursBetween` は 0 時間（給料 0）、`segmentsForDay` は 24 時間（当直）、`endsNextDay`/`spillsNextDay` は false（空き状況の翌日には続きが出ない）。3通りに扱いが分かれる `App.jsx:669`, `timegrid.js:33-35`, `whenlib.js:17`
- [ ] `fmtHours` は端数の分を丸めて 60 になっても繰り上げないので「1時間60分」が出うる `App.jsx:824`
- [ ] `spentHours` はバイト以外では `actualEnd` を見ない（仕事の実績で延びた分は、まとめの時間に入らない。「予定より延びた時間」には入る）`App.jsx:693,3420-3423`
- [ ] 締め日・給料日は JS の Date のあふれをそのまま使う（締め 30 日の2月 → 3/2 など）`App.jsx:3433-3440`
- [ ] 2週ごとのくり返しの週の区切りは、週のはじまりの設定によらず日曜 `App.jsx:235`
- [ ] `save()` は入力を確かめない（終わりが始まりより前でも保存する。end<=start は翌日に終わる扱い）
- [ ] `freeJudge`（9:00–22:00 固定の古い ○△× の判定）は定義だけで呼ばれていない `App.jsx:962`
- [ ] `ake`（夜勤明けの薄い帯）は読む所 `App.jsx:990,1012-1013` はあるが、付ける所が src に無い（死んだ道）

### 7.3 画面
- [ ] 「決まった」お祝い（celebrate、`view.jsx:1900-1922`）は `dialog.phase` があるときだけ出るが、`phase` を入れるコードが無い → 実際には出ない。いまの「決まった」の演出は月表示の帯が点線→塗りに変わる morph（`App.jsx:1771-1777`、150ms で fill＋penTick、470ms で settle＋settleSuccess）
- [ ] 作成画面のバイト先の札は辞めた勤務先も並ぶ（`App.jsx:4206`）。一方 `openNew` の既定は辞めていない先頭
- [ ] 作成画面で「終日」を切り替えると、お知らせが [0,1440]（終日）／[10,30,60,1440]（時刻あり）以外なら「なし」に戻る。選べる 180/2880/4320/10080 などが消える `App.jsx:4269`
- [ ] `draftDirty`（書きかけを捨てるか聞く判定）は、編集のとき お知らせ・名前を隠す・バイト先・何日間 の変更を見ない `App.jsx:1247-1251`
- [ ] 「記録する」（worked）の小窓にも「無くなった」「まだ分からない」が出る
- [ ] ふつうの保存ではトーストもお祝いも出ない（いつか に置いたときだけトースト）
- [ ] 暗い表示：画面の根の `data-theme`（`v.theme`）は `settings.dark` だけで決まり theme='auto' を見ない。html 側は `dark()` で auto を見る。本物のタブの暗さも `v.theme` から取る `App.jsx:3156,615-623,5933`, `view.jsx:626`
- [ ] 週表示を払ったあと、年月えらびで月を選んでも `weekAnchor` を消さないので、週の位置が変わらない可能性 `App.jsx:3269,3801`（読んだだけで、動かしては確かめていない）
- [ ] 値は作るが画面で使っていない：`onDayPrev`/`onDayNext`・`repOverYear`・`repYearWageParts`、まとめカードの cardBars など（プレビューは PNG だけ）、取り込みの impTypeChips・impPreview、設定の tipOpen・supportGroupShown ほか（詳しくは 2 の「2-X」）
- [ ] `_settingsVals` が最後に走り、renderVals の `typeRows`・`jobRows` を上書きする。renderVals 側の jobRows（`App.jsx:4239`）は確認なしで勤務先を消すが、設定画面では確認つきの方だけが効く
- [ ] 週のはじまりの選択だけ触覚が無い。「無くなった予定を隠す」「働いたあとに記録を聞く」のスイッチだけ小さい形（44×26。ほかは 51×31）
- [ ] 使い方で同じものを選び直しても、もう一度当て直す（`setProfile`）

### 7.4 保存・同期・控え
- [ ] 控えから「置き換え」で戻しても `gone`（消した印）は戻さない `App.jsx:5529-5565`
- [ ] iCloud 同期は、相手の消した印で予定を消すが、その印を自分の `gone` には保存しない `sync.js:300-326`
- [ ] iCloud 同期で受けた種類は `typesOk` だけ見て、`mergeTypes` を通さない `App.jsx:1957`
- [ ] 取り込みの整理（tidy）の「消す」は 最近消した予定（trash）に入れずに消す（取り込みの取り消し・元で消えた分は trash に入れる）`App.jsx:5467-5474`
- [ ] `App.jsx:5304` のコメントは「pack と同じ 8 つ」だが、`PERSISTED` はいま 11 個

### 7.5 取り込み・書き出し
- [ ] `.ics` で取り込んだ予定は srcId を持ち srcCal を持たないので、あとで iPhone のカレンダーから取り込むと、範囲内なら「元で消えた」（既定で選ばない）に並ぶ `calendarimport.js:191-193`, `App.jsx:1657`
- [ ] 種類当て（guessTypes）の「名前が同じ」は隠した種類も当てる（言葉・くり返しでは隠した種類を除く）`calendarimport.js:253-271`
- [ ] `.ics` の戻し（unescape）は `\n` を先に置き換えるので、`\\n` が改行になる `ics.js:19`
- [ ] `this._overlayCache=null` はほかで使っていない `App.jsx:2420`
- [ ] iPhone のカレンダーへの書き出しは、オンにしたときと、予定・名前を隠すが変わって 3 秒後だけ。起動時・戻ってきたときには走らない

### 7.6 ウィジェット・iOS の設定
- [ ] ウィジェットを押しても特定の画面は開かない（widgetURL・Link・URL スキームが無い）→ アプリが開くだけ
- [ ] ウィジェットへ送り直すかの判定は 予定・件数・週のはじまり だけ。種類の色だけ変えても送り直さない `App.jsx:5867-5875`
- [ ] ウィジェットの最低 iOS 17 は `tools/add-widget-target.rb` で入れている。リポジトリの pbxproj にはウィジェットの target が無い（ビルド時に足す）
- [ ] Info.plist に URL スキーム・バックグラウンド動作・写真の利用目的は無い。本物のタブにバッジは無い
