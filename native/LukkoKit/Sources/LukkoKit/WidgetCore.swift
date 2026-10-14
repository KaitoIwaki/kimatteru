import Foundation

/// ウィジェットに渡す中身（Web 版 app/src/widgetdata.js の buildWidgetPayload・memoLines の写し）。
/// 今日のぶんではなく、日付ごとの窓（前日から3週間・今月まるごと）を渡す。どれが今日かはウィジェットが決める。
public enum WidgetCore {
    public typealias Obj = [String: JSONValue]
    public static let version = 1
    static let backDays = 1, aheadDays = 20, maxPerDay = 8, maxMemo = 6, memoLen = 20, titleLen = 24

    static func pad2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }
    static func key(_ n: Int) -> String { let c = Civil.fromDayNo(n); return "\(c.y)-\(pad2(c.m + 1))-\(pad2(c.d))" }

    /// JS の文字の長さ（UTF-16）で切って「…」を付ける。
    /// JS は絵文字の途中（UTF-16 の半分）でも切るが、Swift の文字は半分を持てないので、その場合だけ半分を落とす
    static func cut(_ v: JSONValue?, _ n: Int) -> String {
        let t = (JS.truthy(v) ? JS.string(v) : "").jsTrimmed
        let u = Array(t.utf16)
        guard u.count > n else { return t }
        var head = Array(u[0..<(n - 1)])
        if let last = head.last, UTF16.isLeadSurrogate(last) { head.removeLast() }
        return String(decoding: head, as: UTF16.self) + "…"
    }

    /// メモを持ち物の並びにする（書いた人が行を分けたときだけ分ける）
    public static func memoLines(_ memo: JSONValue?) -> [String] {
        let s = JS.truthy(memo) ? JS.string(memo) : ""
        let raw = s.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
            .map { $0.jsTrimmed }.filter { !$0.isEmpty }
        return raw.prefix(maxMemo).map { cut(.string($0), memoLen) }
    }

    /// JS の文字の大小（UTF-16 の並び）
    static func less(_ a: String, _ b: String) -> Bool { Array(a.utf16).lexicographicallyPrecedes(Array(b.utf16)) }

    /// ウィジェットに渡すひとかたまり。today は端末の今日（地元の年・月 0〜11・日）、atMs はその時刻のミリ秒
    public static func buildPayload(_ state: Obj, today: (y: Int, m: Int, d: Int), atMs: Double) -> JSONValue {
        let events = (JS.or(state["events"], .array([]))?.array ?? [])
        let types = (state["types"]?.array ?? []).compactMap { $0.object }
        let settings = state["settings"]?.object ?? [:]
        func colorOf(_ t: JSONValue?) -> String {
            if let x = types.first(where: { $0["key"] == t }), JS.truthy(x["color"]) { return JS.string(x["color"]) }
            return "#8A8A8A"
        }
        let (y, mo, d) = today
        let from = min(Civil.dayNo(y, mo, d) - backDays, Civil.dayNo(y, mo, 1))
        let to = max(Civil.dayNo(y, mo, d) + aheadDays, Civil.dayNo(y, mo + 1, 0))
        var days: [String: [Obj]] = [:]
        var dayOrder: [String] = []
        for item in events {
            guard JS.truthy(item), case .object(let e) = item else { continue }
            if e["status"] == .string("nakunatta") { continue }
            let f = AppCore.evFrom(e), l = AppCore.evTo(e)
            let a = max(from, f), b = min(to, l)
            let hide = JS.truthy(e["secret"]) || JS.truthy(settings["hideTitles"])
            let endT = e["status"] == .string("jisseki") ? JS.or(e["actualEnd"], e["end"]) : e["end"]
            let allDay = JS.truthy(e["allDay"])
            let wraps = !allDay && TimeGrid.toMin(endT) <= TimeGrid.toMin(e["start"])
            var it: Obj = [
                "t": allDay ? .null : (JS.or(e["start"], .null) ?? .null),
                "e": allDay ? .null : (wraps ? .string("24:00") : (JS.or(endT, .null) ?? .null)),
                "n": .string(hide ? "予定あり" : { let c = cut(e["title"], titleLen); return c.isEmpty ? "予定" : c }()),
                "c": .string(colorOf(e["type"])),
                "s": .number((e["status"] == .string("kakutei") || e["status"] == .string("jisseki")) ? 1 : 0),
                "k": .string(JS.truthy(e["id"]) ? JS.string(e["id"]) : ""),
            ]
            if hide { it["x"] = .number(1) }
            let m = hide ? [] : memoLines(e["memo"])
            if !m.isEmpty { it["m"] = .array(m.map { .string($0) }) }
            if a <= b {
                for n in a...b {
                    let k = key(n)
                    let pos = f == l ? 0 : n == f ? 1 : n == l ? 3 : 2
                    var x = it
                    if pos != 0 { x["p"] = .number(Double(pos)) }
                    if days[k] == nil { dayOrder.append(k); days[k] = [] }
                    days[k]!.append(x)
                }
            }
        }
        var outDays: [String: JSONValue] = [:]
        for k in dayOrder {
            let sorted = JS.stableSorted(days[k]!) { x, y in
                let xt = x["t"]?.string, yt = y["t"]?.string
                let xtT = JS.truthy(x["t"]), ytT = JS.truthy(y["t"])
                if !xtT && ytT { return -1 }
                if xtT && !ytT { return 1 }
                if xtT && ytT && xt != yt { return less(xt ?? "", yt ?? "") ? -1 : 1 }
                let xn = x["n"]?.string ?? "", yn = y["n"]?.string ?? ""
                return less(xn, yn) ? -1 : less(yn, xn) ? 1 : 0
            }
            outDays[k] = .array(sorted.prefix(maxPerDay).map { .object($0) })
        }
        var hol: [JSONValue] = []
        if from <= to { for n in from...to { let c = Civil.fromDayNo(n); if Holidays.name(c.y, c.m, c.d) != nil { hol.append(.string(key(n))) } } }
        return .object([
            "v": .number(Double(version)), "at": .number(atMs),
            "weekStart": .number(settings["weekStart"] == .number(1) ? 1 : 0),
            "from": .string(key(from)), "to": .string(key(to)), "hol": .array(hol), "days": .object(outDays),
        ])
    }
}
