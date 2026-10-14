import Foundation

/// ベルに溜まるお知らせ（Web 版 notices.js の写し）。種類は 2 つだけ：シフトの記録を促すもの・アップデートのお知らせ
public enum NoticesCore {
    public typealias Obj = [String: JSONValue]
    public static let kindShift = "shift"
    public static let kindInfo = "info"

    /// アップデートのお知らせ。新しい版を出すときは、ここに上から足していく（version はお知らせを出し始めた版）。
    /// 書き方：短く・内容が 2 つ以上なら「・」の箇条書き・理由や経緯は書かない
    public static let releaseNotes: [(version: String, title: String, body: String)] = [
        ("0.32.2", "時間を決めない予定を入れやすくしました",
         bullets("設定から、iPhone のカレンダーの予定をまとめて取り込めます", "読むだけで、書き込みはしません")),
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
    public static func syncInfoNotices(_ notices: [JSONValue], current: String, lastSeen: JSONValue?, now: Double) -> [JSONValue] {
        guard let lastSeen, JS.truthy(lastSeen) else { return notices }
        if lastSeen == .string(current) { return notices }
        var out = notices
        for r in releaseNotes {
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
        let min = Int((diff / 60000).rounded(.down))
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
