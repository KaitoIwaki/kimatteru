import Foundation

/// 通知の組み立て（Web 版 app/src/notify.js の buildSchedule・dayDigest・whenText・numericId の写し）。
/// 時刻は「地元の年・月（0〜11）・日・時・分」で扱う（タイムゾーンや夏時間に左右されない計算にする）。
public enum NotifyCore {
    public typealias Ev = [String: JSONValue]

    /// 地元の時刻（分まで）。比べるときは通しの分（dayNo*1440 + 時*60 + 分）で比べる
    public struct LocalTime: Equatable, Comparable {
        public var y: Int, m: Int, d: Int, h: Int, min: Int
        public init(_ y: Int, _ m: Int, _ d: Int, _ h: Int, _ min: Int) {
            // はみ出し（25時、-30分 など）は JS の Date と同じく繰り上げ・繰り下げる
            let total = Civil.dayNo(y, m, d) * 1440 + h * 60 + min
            let dn = Int((Double(total) / 1440).rounded(.down))
            let rest = total - dn * 1440
            let c = Civil.fromDayNo(dn)
            self.y = c.y; self.m = c.m; self.d = c.d; self.h = rest / 60; self.min = rest % 60
        }
        public var serial: Int { Civil.dayNo(y, m, d) * 1440 + h * 60 + min }
        public static func < (a: LocalTime, b: LocalTime) -> Bool { a.serial < b.serial }
        public var array: [Int] { [y, m, d, h, min] }
        public var weekday: Int { Civil.weekday(y, m, d) }
        /// JS の toDateString()（"Wed Oct 14 2026"）
        public var dateString: String {
            let dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            let mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            let dd = d < 10 ? "0\(d)" : "\(d)"
            let yy = y >= 0 ? String(format: "%04d", y) : "-" + String(format: "%06d", -y)
            return "\(dows[weekday]) \(mons[m]) \(dd) \(yy)"
        }
    }

    public struct Notif: Equatable {
        public var id: Int
        public var title: JSONValue
        public var body: String
        public var at: LocalTime
        public var extra: [String: JSONValue]
        public var actionTypeId: String?
        public var json: JSONValue {
            var o: [String: JSONValue] = ["id": .number(Double(id)), "title": title, "body": .string(body), "extra": .object(extra), "at": .array(at.array.map { .number(Double($0)) })]
            if let actionTypeId { o["actionTypeId"] = .string(actionTypeId) }
            return .object(o)
        }
    }

    public static let alldayAnchorH = 9
    public static let maxPending = 60

    /// 通知の ID（予定の id から作る、安定した正の整数）
    public static func numericId(_ id: String) -> Int {
        var h: Int32 = 0
        for c in id.utf16 { h = Int32(truncatingIfNeeded: Int64(h) &* 31 &+ Int64(c)) }
        let a = abs(Int64(h)) % 2_000_000_000
        return a == 0 ? 1 : Int(a)
    }

    /// その予定の「何分前に知らせるか」。設定なしなら nil
    public static func remindMinutes(_ e: Ev) -> Double? {
        if case .number(let n)? = e["remindMin"], n >= 0 { return n }
        return nil
    }

    static func whenText(_ e: Ev, _ rm: Double) -> String {
        let days = rm >= 1440 ? JS.round(rm / 1440) : 0
        let dayWord = days == 1 ? "明日" : days == 2 ? "あさって" : JS.numberToString(days) + "日後"
        if JS.truthy(e["allDay"]) { return days != 0 ? dayWord + "は終日の予定です" : "今日は終日の予定です" }
        let span = JS.string(e["start"]) + "–" + JS.string(e["end"])
        if days != 0 { return dayWord + " " + span }
        if rm >= 60 { return JS.numberToString(JS.round(rm / 60)) + "時間後 " + span }
        if rm > 0 { return "まもなく（" + JS.numberToString(rm) + "分後） " + span }
        return span
    }

    static func span(_ e: Ev) -> Int { let v = Int(JS.toInt32(e["days"])); return max(1, min(60, v != 0 ? v : 1)) }
    static func covers(_ e: Ev, _ y: Int, _ m: Int, _ d: Int) -> Bool {
        let n = Civil.dayNo(y, m, d)
        let f = Civil.dayNo(JS.int(e["y"]), JS.int(e["m"]), JS.int(e["day"]))
        return n >= f && n <= f + span(e) - 1
    }
    static func toMin(_ t: JSONValue?) -> Double { TimeGrid.toMin(t) }

    public struct Digest: Equatable { public var count: Int; public var und: Int; public var text: String
        public var json: JSONValue { .object(["count": .number(Double(count)), "und": .number(Double(und)), "text": .string(text)]) } }

    /// その日の予定を1行にまとめる（朝のまとめ・前の晩のまとめ）。0件なら nil
    public static func dayDigest(_ events: [Ev], _ y: Int, _ m: Int, _ d: Int, _ hideAll: Bool) -> Digest? {
        let list = JS.stableSorted(events.filter { JS.string($0["status"]) != "nakunatta" && covers($0, y, m, d) }) { a, b in
            let x = (JS.truthy(a["allDay"]) ? 0 : 1) - (JS.truthy(b["allDay"]) ? 0 : 1)
            if x != 0 { return x }
            let t = toMin(a["start"]) - toMin(b["start"]); return t == 0 ? 0 : (t < 0 ? -1 : 1)
        }
        if list.isEmpty { return nil }
        let und = list.filter { JS.string($0["status"]) == "mikakutei" }.count
        func name(_ e: Ev) -> String { (JS.truthy(e["secret"]) || hideAll) ? "予定あり" : (JS.truthy(e["title"]) ? JS.string(e["title"]) : "予定") }
        let items = list.prefix(4).map { e in (JS.truthy(e["allDay"]) ? "" : JS.string(e["start"]) + " ") + name(e) + (JS.string(e["status"]) == "mikakutei" ? "？" : "") }
        return Digest(count: list.count, und: und, text: items.joined(separator: "、") + (list.count > 4 ? " ほか\(list.count - 4)件" : ""))
    }

    /// 予約する通知を組み立てる（近いものから 60 件）
    public static func buildSchedule(_ events: [Ev], _ settings: [String: JSONValue], now: LocalTime) -> [Notif] {
        if JS.truthy(settings["notifyOff"]) { return [] }
        var out: [Notif] = []
        let hideAll = JS.truthy(settings["hideTitles"])
        func title(_ e: Ev) -> JSONValue { (JS.truthy(e["secret"]) || hideAll) ? .string("予定の時間です") : (e["title"] ?? .null) }
        for e in events {
            let status = JS.string(e["status"])
            if status == "nakunatta" { continue }
            let idStr = JS.string(e["id"])
            if JS.truthy(settings["remind"]) && e["type"] == .string("baito") && status == "kakutei" && !JS.truthy(e["allDay"]) {
                let em = WhenLib.endMoment(e)
                let at = LocalTime(em.y, em.m, em.d, em.h, em.min)
                if at > now {
                    out.append(Notif(id: numericId("w" + idStr),
                                     title: .string((JS.truthy(e["secret"]) || hideAll) ? "おつかれさまでした" : JS.string(e["title"]) + "、おつかれさまでした"),
                                     body: "記録しますか？（予定 " + JS.string(e["start"]) + "–" + JS.string(e["end"]) + "）",
                                     at: at, extra: ["eventId": .string(idStr), "kind": .string("worked")], actionTypeId: "WORKED"))
                }
            }
            if let rm = remindMinutes(e), status != "jisseki" {
                var hh = alldayAnchorH, mm = 0
                if !JS.truthy(e["allDay"]) {
                    let p = JS.string(e["start"]).components(separatedBy: ":")
                    hh = JS.int(p[0]); mm = p.count > 1 ? JS.int(p[1]) : 0
                }
                let at = LocalTime(JS.int(e["y"]), JS.int(e["m"]), JS.int(e["day"]), hh, Int((Double(mm) - rm).rounded(.towardZero)))
                if at > now {
                    let place = (!JS.truthy(e["secret"]) && !hideAll && JS.truthy(e["place"])) ? "・" + JS.string(e["place"]) : ""
                    out.append(Notif(id: numericId("r" + idStr),
                                     title: .string(JS.string(title(e)) + (status == "mikakutei" ? "（まだ）" : "")),
                                     body: whenText(e, rm) + place, at: at,
                                     extra: ["eventId": .string(idStr), "kind": .string("remind")],
                                     actionTypeId: status == "mikakutei" ? "UNDECIDED" : nil))
                }
            }
        }
        for i in 0..<7 {
            let d = LocalTime(now.y, now.m, now.d + i, 0, 0)
            if JS.truthy(settings["morning"]) {
                let mAt: Double = { if case .number(let n)? = settings["morningAt"] { return n }; return 450 }()
                let at = LocalTime(d.y, d.m, d.d, Int((mAt / 60).rounded(.down)), Int(mAt.truncatingRemainder(dividingBy: 60)))
                if let g = dayDigest(events, d.y, d.m, d.d, hideAll), at > now {
                    out.append(Notif(id: numericId("m" + d.dateString), title: .string("今日 \(g.count)件" + (g.und != 0 ? "（うち まだ\(g.und)件）" : "")),
                                     body: g.text, at: at, extra: ["kind": .string("morning"), "day": .string("\(d.y)-\(d.m)-\(d.d)")]))
                }
            }
            if JS.truthy(settings["evening"]) {
                let at = LocalTime(d.y, d.m, d.d, 21, 0)
                let n = LocalTime(d.y, d.m, d.d + 1, 0, 0)
                if let g = dayDigest(events, n.y, n.m, n.d, hideAll), at > now {
                    out.append(Notif(id: numericId("e" + d.dateString), title: .string("明日 \(g.count)件" + (g.und != 0 ? "（うち まだ\(g.und)件）" : "")),
                                     body: g.text, at: at, extra: ["kind": .string("morning"), "day": .string("\(n.y)-\(n.m)-\(n.d)")]))
                }
            }
            if JS.truthy(settings["weekly"]) && d.weekday == 0 {
                let at = LocalTime(d.y, d.m, d.d, 20, 0)
                var und = 0
                for k in 1...7 {
                    let x = LocalTime(d.y, d.m, d.d + k, 0, 0)
                    und += events.filter { JS.string($0["status"]) == "mikakutei" && $0["y"] == .number(Double(x.y)) && $0["m"] == .number(Double(x.m)) && $0["day"] == .number(Double(x.d)) }.count
                }
                if und != 0 && at > now {
                    out.append(Notif(id: numericId("wk" + d.dateString), title: .string("来週、まだ決まっていない予定が\(und)件"),
                                     body: "開いて、決まった・無くなった を片づけられます", at: at, extra: ["kind": .string("weekly")]))
                }
            }
        }
        let sorted = JS.stableSorted(out) { a, b in a.at.serial - b.at.serial }
        return Array(sorted.prefix(maxPending))
    }
}
