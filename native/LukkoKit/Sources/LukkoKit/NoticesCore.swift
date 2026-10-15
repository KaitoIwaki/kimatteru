import Foundation

/// ベルに溜まるお知らせ（Web 版 notices.js の写し）。種類は 2 つだけ：シフトの記録を促すもの・アップデートのお知らせ
public enum NoticesCore {
    public typealias Obj = [String: JSONValue]
    public static let kindShift = "shift"
    public static let kindInfo = "info"

    /// アップデートのお知らせ。新しい版を出すときは、nativeReleaseNotes に上から足していく（version はお知らせを出し始めた版）。
    /// 書き方：短く・内容が 2 つ以上なら「・」の箇条書き・理由や経緯は書かない。
    /// SwiftUI 版から足したお知らせ。0.40.0 は SwiftUI 版（App Store の 2.0）
    public static let nativeReleaseNotes: [(version: String, title: String, body: String)] = [
        ("0.40.0", "iPhone の部品で作り直しました",
         "・画面の動きを iPhone と同じにしました\n・右下の「＋」から、すぐ予定を足せます\n・ほしい機能は、設定の「ご意見・機能のリクエスト」から送ってください\n・みんなの要望と、いまの状況は「みんなの要望を見る」で見られます"),
    ]
    public static let releaseNotes = nativeReleaseNotes + webReleaseNotes
    /// ここからは Web 版（notices.js）の文をそのまま写したもの（golden/phone.json で 1 文字ずつ確かめる）
    public static let webReleaseNotes: [(version: String, title: String, body: String)] = [
        ("0.32.2", "時間を決めない予定を入れやすくしました",
         "・日の画面の「時間を決めずに入れる」から、その日にすることを入れられます\n・設定を項目ごとに分けて、すっきりさせました\n・設定のいちばん上から、応援とレビューができます"),
        ("0.32.1", "不具合を直しました",
         "・カレンダーを開いたままにすると、「今日」が進まない・月の表示がずれる・押した日と違う日が開くことがありました"),
        ("0.32.0", "日の画面を見やすくしました",
         "・日の画面を作り直しました。上の日付の帯は、横に流して日を選べます\n・週表示は、横に流すと日が続けて動くようにしました\n・下のメニューの位置と大きさを、iPhone の標準に合わせました"),
        ("0.31.0", "仕事の予定にも使いやすくしました",
         "・設定の「使い方」で、会社の仕事・シフト勤務・学校とバイト・子育てから選べます\n・選ぶと、予定の種類と呼び名が変わります（仕事の点線は「仮押さえ」）\n・週表示と、日の「時間」表示ができました\n・🔍 で予定を探せます\n・候補日をまとめて置けます。1つ決めると残りを片づけます\n・延期と、日にち未定（今月のどこか など）ができました\n・空いてる日を「10/3（金）19時以降」のような文字でも送れます\n・会社などの iPhone のカレンダーを重ねて見られます\n・消した予定は30日間、「最近消した予定」から戻せます\n・予定を毎日1回、自動で端末に控えます\n・iCloud で、2台の iPhone の予定をそろえられます\n・Face ID でロックできます\n・設定の画面を見やすく作り直しました\n・予定の文字の大きさを変えられます\n・開始時刻を動かすと、終わりも一緒に動くようにしました"),
        ("0.30.0", "まとめで、何に時間を使ったかが見られます",
         "・まとめに、その月に何へどれだけ時間を使ったかを出します\n・月と年で切り替えられます\n・予定をファイル（.ics）で出し入れできます\n・取り込みの画面を短くしました\n・カレンダーを払ったとき、画面がずれて止まる不具合を直しました"),
        ("0.29.0", "名前を LUKKO に変えました",
         "・アプリの名前を「LUKKO（ルッコ）」に変えました。中身は同じです\n・ダークモードで、決まった予定とまだの予定を見分けやすくしました\n・アイコンを少し変えました\n・まとめに「使い始める前の額」を入れられます\n・「働いた時間を直す」は、右上の「···」に移しました"),
        ("0.26.0", "ウィジェットを置けるようになりました",
         "・ホーム画面に今日の予定を置けます（小・中・大）\n・置き方：ホーム画面を長押し →「＋」→「LUKKO」\n・メモに書いた持ち物も並びます\n・iOS 17 以降で使えます"),
        ("0.24.0", "まとめを作り直しました",
         "・まとめに、バイト先ごとの内訳を出します\n・シェアするカードを作り直しました（今月は横長、今年は縦長）\n・金額は時給と実働から出した目安です（割増・交通費は入りません）\n・予定の色をやさしい色にしました"),
        ("0.23.1", "ほかのカレンダーの予定も取り込めます",
         "・Google・Outlook・Yahoo! なども、iPhone の設定にアカウントを足せば取り込めます\n・手順を取り込みの画面に置きました\n・設定の画面を整理しました"),
        ("0.22.3", "サポーターカードに段ができました",
         "・応援の合計で、カードがノーマル・ゴールド（¥1,000〜）・ブラック（¥3,000〜）に変わります\n・見た目だけで、機能は増えません\n・指でなぞると回せます"),
        ("0.20.0", "サポーターカードを作りました",
         "・応援してくださった方に、サポーターカードをお渡しします\n・設定の「応援」から開けます\n・画像にして共有できます"),
        ("0.19.0", "画面の地を白くしました",
         "・画面の地をベージュから白にして、読みやすくしました\n・設定のいちばん下に「開発を応援する」を置きました（機能は増えません）"),
        ("0.18.0", "くり返しと複数日を作り直しました",
         "・くり返しに毎月・毎年が増え、毎週は曜日を選べます\n・同じ予定を別々の日にまとめて置けます（「＋」→「複数日」）\n・日をまたぐ予定は、終わりが翌日だと分かるようにしました"),
        ("0.17.0", "控えをファイルから戻せるようになりました",
         "・設定の「控えから戻す」で、控えのファイルを選ぶだけで戻せます\n・戻したあと、何件戻したかを出します"),
        ("0.16.0", "予定が消えないようにしました",
         "・予定を2か所に保存して、消えにくくしました\n・保存できなかったときは、画面でお知らせします\n・はじめての案内を作り直しました"),
        ("0.15.0", "くり返し・場所・メモを足しました",
         "・毎日・毎週の予定をまとめて置けます\n・場所を入れると、地図で開けます\n・メモに持ち物を書けます\n・年月を押すと、離れた月へ飛べます"),
        ("0.14.0", "予定の控えを取れるようになりました",
         "・予定をまるごとファイルに書き出せます（設定の「控え」）\n・機種変更や紛失にそなえて、ときどき取っておいてください"),
        ("0.13.0", "前後の月の日付が見えるようになりました",
         "・月のはじめと終わりのマスに、前後の月の日付を薄く出します\n・設定からお問い合わせできます"),
        ("0.12.2", "カレンダーの見た目を整えました",
         "・月の形がすっきり見えるようにしました\n・1日に置ける予定を4件に増やしました"),
        ("0.12.1", "カレンダーを画面いっぱいに広げました",
         "・カレンダーを画面の横いっぱいまで広げました\n・予定の名前が6文字まで入ります"),
        ("0.12.0", "休憩を引いて給料を出せます",
         "・働いた記録に休憩を入れられます\n・給料は、休憩を引いた実働で出します"),
        ("0.11.2", "空き状況も横に払って月を送れます",
         "・「いつ空いてる？」を左右に払うと、月が変わります\n・予定の帯を細くして、見渡しやすくしました"),
        ("0.11.1", "規約とプライバシーポリシーを更新しました",
         "・通知について書き足しました\n・給料は目安であることを、はっきり書きました"),
        ("0.11.0", "設定を整理して、種類を足せるようにしました",
         "・時給はバイト先ごとに決めるようにしました\n・予定の種類の名前を変えたり、足したりできます\n・祝日を二重に取り込む不具合を直しました"),
        ("0.10.0", "お知らせと、スワイプで削除ができます",
         "・予定ごとに「30分前」などのお知らせを付けられます\n・一覧で予定を左へなぞると、削除できます\n・時刻は5分きざみで選べます"),
        ("0.9.0", "何日か続く予定を、1本の帯で置けます",
         "・何日か続く予定を、1本の帯で置けます\n・予定の名前を長く出せるようにしました"),
        ("0.5.0", "祝日と、お知らせの一覧を追加しました",
         "・祝日が赤くなりました\n・ベルから、お知らせをまとめて見られます"),
        ("0.3.0", "iPhone のカレンダーから取り込めます",
         "・設定から、iPhone のカレンダーの予定をまとめて取り込めます\n・読むだけで、書き込みはしません"),
    ]
    static func bullets(_ lines: String...) -> String { lines.map { "・" + $0 }.joined(separator: "\n") }

    /// 受け取ったあとに書き直したお知らせも、開いたときは今の文で見せる
    public static func currentNoteText(_ n: JSONValue?) -> JSONValue? {
        guard let n, JS.truthy(n), n["kind"] == .string(kindInfo), var o = n.object else { return n }
        guard let r = releaseNotes.first(where: { "info-" + $0.version == JS.string(n["id"]) && n["id"]?.string != nil }) else { return n }
        o["title"] = .string(r.title); o["body"] = .string(r.body)
        return .object(o)
    }

    /// 終わったのにまだ実績を入れていないバイトについて、お知らせを作る。記録済みになったものは取り除く
    public static func syncShiftNotices(_ notices: [JSONValue], _ events: [JSONValue], now: Double, tz: TimeZone) -> [JSONValue] {
        func endMs(_ e: Obj) -> Double {
            let t = WhenLib.endMoment(e)
            return JSDate.make(t.y, t.m, t.d, t.h, t.min, 0, tz)
        }
        let due = events.compactMap { $0.object }.filter { e in
            if e["type"] != .string("baito") || e["status"] != .string("kakutei") || JS.truthy(e["allDay"]) { return false }
            return endMs(e) <= now
        }
        let dueIds = due.map { "shift-" + JS.string($0["id"]) }
        var out = notices.filter { n in n["kind"] != .string(kindShift) || dueIds.contains { n["id"] == .string($0) } }
        for e in due {
            let id = "shift-" + JS.string(e["id"])
            if out.contains(where: { $0["id"] == .string(id) }) { continue }
            out.append(.object(["id": .string(id), "kind": .string(kindShift), "eventId": e["id"] ?? .null,
                                "title": .string("\(JS.string(e["title"]))、おつかれさまでした"),
                                "body": .string("働いた時間を記録しますか？（予定 \(JS.string(e["start"]))–\(JS.string(e["end"]))）"),
                                "at": .number(endMs(e)), "read": .bool(false)]))
        }
        return out
    }

    /// 版の新しい・古いを数として比べる（'0.10.0' > '0.9.0'）
    public static func cmpVersion(_ a: JSONValue?, _ b: JSONValue?) -> Int {
        let pa = JS.string(a).components(separatedBy: ".").map { JS.number($0) }
        let pb = JS.string(b).components(separatedBy: ".").map { JS.number($0) }
        for i in 0..<3 {
            let x = i < pa.count ? JS.orZero(pa[i]) : 0, y = i < pb.count ? JS.orZero(pb[i]) : 0
            if x != y { return x < y ? -1 : 1 }
        }
        return 0
    }

    /// 版が上がったときに、アップデートのお知らせを足す（初めて使う人には出さない）
    public static func syncInfoNotices(_ notices: [JSONValue], current: String, lastSeen: JSONValue?, now: Double, notes: [(version: String, title: String, body: String)] = releaseNotes) -> [JSONValue] {
        guard let lastSeen, JS.truthy(lastSeen) else { return notices }
        if lastSeen == .string(current) { return notices }
        var out = notices
        for r in notes {
            if cmpVersion(.string(r.version), lastSeen) <= 0 { continue }
            if cmpVersion(.string(r.version), .string(current)) > 0 { continue }
            let id = "info-" + r.version
            if out.contains(where: { $0["id"] == .string(id) }) { continue }
            out.append(.object(["id": .string(id), "kind": .string(kindInfo), "title": .string(r.title), "body": .string(r.body), "at": .number(now), "read": .bool(false)]))
        }
        return out
    }

    public static func unreadCount(_ notices: [JSONValue]) -> Int { notices.filter { !JS.truthy($0["read"]) }.count }
    /// 新しい順
    public static func sortNotices(_ notices: [JSONValue]) -> [JSONValue] {
        JS.stableSorted(notices) { a, b in JS.sign(JS.number(b["at"]) - JS.number(a["at"])) }
    }
    /// 「たった今」「3時間前」のような言い方
    public static func relativeTime(_ ms: Double, now: Double, tz: TimeZone) -> String {
        let diff = max(0, now - ms)
        let min = JS.int(.number((diff / 60000).rounded(.down)))
        if min < 1 { return "たった今" }
        if min < 60 { return "\(min)分前" }
        let hour = min / 60
        if hour < 24 { return "\(hour)時間前" }
        let day = hour / 24
        if day < 7 { return "\(day)日前" }
        let d = JSDate.local(ms, tz)
        return "\(d.m + 1)月\(d.d)日"
    }
}
