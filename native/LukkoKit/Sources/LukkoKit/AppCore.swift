import Foundation

/// 画面に依らない計算（Web 版 App.jsx の App クラスのメソッドの写し）。
/// 中身（state）は JSON のまま持ち、メソッドの名前も Web 版にそろえる（正解表と 1 対 1 で照らし合わせるため）。
public struct AppCore {
    public typealias Obj = [String: JSONValue]
    public var state: Obj

    public init(state: Obj) { self.state = state }

    var settings: Obj { state["settings"]?.object ?? [:] }
    var jobs: [Obj] { (state["jobs"]?.array ?? []).compactMap { $0.object } }
    var types: [Obj] { (state["types"]?.array ?? []).compactMap { $0.object } }

    // MARK: 使い方と言葉
    public static let profileKeys: Set<String> = ["student", "work", "shift", "free", "family"]
    public func profile() -> String {
        if case .string(let p)? = settings["profile"], Self.profileKeys.contains(p) { return p }
        return "student"
    }
    public func jobNone() -> String { profile() == "student" ? "バイト先なし" : "勤務先なし" }

    // MARK: 時刻
    /// mins("H:MM")。読み込みで正しい形にそろえてあるので、そのまま数える
    public func mins(_ s: String) -> Double {
        let p = s.components(separatedBy: ":")
        return JS.number(p[0]) * 60 + (p.count > 1 ? JS.number(p[1]) : .nan)
    }
    public func addMin(_ s: String, _ d: Double) -> String {
        let x = (mins(s) + d + 1440).truncatingRemainder(dividingBy: 1440)
        return pad2((x / 60).rounded(.down)) + ":" + pad2(x.truncatingRemainder(dividingBy: 60))
    }
    public func hoursBetween(_ a: String, _ b: String) -> Double {
        var d = mins(b) - mins(a)
        if d < 0 { d += 1440 }
        return d / 60
    }
    func pad2(_ n: Double) -> String {
        let s = JS.numberToString(n)
        return s.count >= 2 ? s : String(repeating: "0", count: 2 - s.count) + s
    }
    public func fmtWage(_ n: Double) -> String { "¥" + JS.groupedInt(n) }
    public func fmtMin(_ m: Double) -> String { pad2((m / 60).rounded(.down)) + ":" + pad2(m.truncatingRemainder(dividingBy: 60)) }

    /// 「0時間30分」とは言わない。1時間に満たなければ「30分」
    public func fmtHours(_ h: Double) -> String {
        let H = h.rounded(.down)
        let M = JS.round((h - H) * 60)
        if H == 0 && M != 0 { return JS.numberToString(M) + "分" }
        return M != 0 ? JS.numberToString(H) + "時間" + JS.numberToString(M) + "分" : JS.numberToString(H) + "時間"
    }
    public func fmtSpent(_ h: Double, _ d: Double) -> String {
        var parts: [String] = []
        if h > 0 { parts.append(fmtHours(h)) }
        if d > 0 { parts.append(JS.numberToString(d) + "日") }
        return parts.isEmpty ? "0時間" : parts.joined(separator: "・")
    }

    // MARK: 給料
    /// その予定に使う時給（記録した時点の時給 → バイト先の今の時給 → 設定の時給）
    public func hourlyFor(_ ev: Obj) -> JSONValue {
        if case .number(let n)? = ev["hourly"], n.isFinite { return .number(n) }
        if JS.truthy(ev["jobId"]), let j = jobs.first(where: { $0["id"] == ev["jobId"] }) { return j["hourly"] ?? .null }
        return settings["hourly"] ?? .null
    }
    public func breakMin(_ ev: Obj) -> Double {
        if case .number(let n)? = ev["breakMin"], n > 0 { return min(600, n) }
        return 0
    }
    public func paidHours(_ ev: Obj) -> Double {
        let end = JS.string(JS.or(ev["actualEnd"], ev["end"]))
        return max(0, hoursBetween(JS.string(ev["start"]), end) - breakMin(ev) / 60)
    }
    public func wage(_ ev: Obj) -> Double {
        if JS.string(ev["type"]) != "baito" || ev["type"]?.string == nil { return 0 }
        return JS.round(paidHours(ev) * JS.number(hourlyFor(ev)))
    }
    public func spentHours(_ ev: Obj) -> Double {
        if JS.truthy(ev["allDay"]) { return 0 }
        return ev["type"]?.string == "baito" ? paidHours(ev) : hoursBetween(JS.string(ev["start"]), JS.string(ev["end"]))
    }
    /// 使い始める前の額（年ごと）
    public func priorFor(_ y: Int) -> Double {
        guard let p = settings["priorWage"], JS.truthy(p) else { return 0 }
        if case .number(let n)? = p["\(y)"], n.isFinite, n > 0 { return min(99_999_999, JS.round(n)) }
        return 0
    }

    // MARK: 日の範囲
    public static func evSpan(_ e: Obj) -> Int {
        let v = Int(JS.toInt32(e["days"]))
        return max(1, min(60, v != 0 ? v : 1))
    }
    public static func evFrom(_ e: Obj) -> Int { Civil.dayNo(Int(JS.number(e["y"])), Int(JS.number(e["m"])), Int(JS.number(e["day"]))) }
    public static func evTo(_ e: Obj) -> Int { evFrom(e) + evSpan(e) - 1 }
    public func spanLabel(_ ev: Obj) -> String {
        let a = Civil.fromDayNo(Self.evFrom(ev)), b = Civil.fromDayNo(Self.evTo(ev))
        return "\(a.m + 1)/\(a.d)〜" + (b.y != a.y ? "\(b.y)/" : "") + "\(b.m + 1)/\(b.d)"
    }

    // MARK: お知らせの言葉
    public func remindLabel(_ min: JSONValue?, _ allDay: JSONValue?) -> String {
        guard case .number(let m)? = min else { return "なし" }
        if JS.truthy(allDay) { return m == 0 ? "当日の朝" : JS.numberToString(m / 1440) + "日前" }
        if m >= 1440 { return JS.numberToString(m / 1440) + "日前" }
        if m >= 60 { return JS.numberToString(JS.round(m / 60)) + "時間前" }
        return JS.numberToString(m) + "分前"
    }

    // MARK: まとめの内訳
    /// 種類で束ねて、その中で同じ名前の予定をまとめる（時間は使った時間、終日は日数で別に数える）
    public func timeBreakdown(_ list: [Obj]) -> [JSONValue] {
        struct Row { var name: String; var hours: Double; var days: Double; var times: Double }
        struct Out { var obj: Obj; var hours: Double; var days: Double }
        var out: [Out] = []
        for t in types {
            let tkey = t["key"]
            let evs = list.filter { $0["type"] == tkey && tkey != nil }
            if evs.isEmpty { continue }
            var order: [String] = []
            var by: [String: Row] = [:]
            var hours = 0.0, days = 0.0
            for e in evs {
                var name: String
                let isBaito = tkey == .string("baito")
                let job = isBaito && JS.truthy(e["jobId"]) ? jobs.first(where: { $0["id"] == e["jobId"] }) : nil
                if let job { name = JS.truthy(job["name"]) ? JS.string(job["name"]) : "（名前なし）" }
                else if isBaito && JS.truthy(e["jobName"]) { name = JS.string(e["jobName"]) }
                else {
                    let tt = JS.truthy(e["title"]) ? JS.string(e["title"]).trimmingCharacters(in: .whitespacesAndNewlines) : ""
                    name = tt.isEmpty ? "（名前なし）" : tt
                }
                var cur = by[name] ?? { order.append(name); return Row(name: name, hours: 0, days: 0, times: 0) }()
                let h = spentHours(e), d = JS.truthy(e["allDay"]) ? Double(Self.evSpan(e)) : 0
                cur.hours += h; cur.days += d; cur.times += 1
                hours += h; days += d
                by[name] = cur
            }
            let rows = order.map { by[$0]! }
            let tops = JS.stableSorted(rows) { a, b in
                let x = b.hours - a.hours; if x != 0 { return x < 0 ? -1 : 1 }
                let y = b.days - a.days; if y != 0 { return y < 0 ? -1 : 1 }
                let z = b.times - a.times; if z != 0 { return z < 0 ? -1 : 1 }
                return 0
            }.prefix(3).map { r -> JSONValue in
                .object(["name": .string(r.name), "amount": .string(fmtSpent(r.hours, r.days)), "times": .number(r.times)])
            }
            var o: Obj = [:]
            o["key"] = t["key"] ?? .null; o["name"] = t["name"] ?? .null; o["color"] = t["color"] ?? .null
            o["hours"] = .number(hours); o["days"] = .number(days); o["times"] = .number(Double(evs.count))
            o["amount"] = .string(fmtSpent(hours, days))
            o["tops"] = .array(by.count >= 2 ? Array(tops) : [])
            out.append(Out(obj: o, hours: hours, days: days))
        }
        return JS.stableSorted(out) { a, b in
            let x = b.hours - a.hours; if x != 0 { return x < 0 ? -1 : 1 }
            let y = b.days - a.days; if y != 0 { return y < 0 ? -1 : 1 }
            return 0
        }.map { .object($0.obj) }
    }

    /// バイト先ごとの内訳（色は画面の側で付ける）
    public func jobBreakdown(_ list: [Obj]) -> [JSONValue] {
        struct Row { var key: String; var hours: Double; var wage: Double; var times: Double; var jobName: JSONValue? }
        var order: [String] = []
        var by: [String: Row] = [:]
        for e in list {
            let key = JS.truthy(e["jobId"]) ? JS.string(e["jobId"]) : "__none__"
            var cur = by[key] ?? { order.append(key); return Row(key: key, hours: 0, wage: 0, times: 0, jobName: e["jobName"]) }()
            cur.hours += paidHours(e); cur.wage += wage(e); cur.times += 1
            by[key] = cur
        }
        func jobIndex(_ k: String) -> Int { jobs.firstIndex { $0["id"] == .string(k) } ?? 999 }
        let rows = JS.stableSorted(order.map { by[$0]! }) { a, b in
            let x = jobIndex(a.key) - jobIndex(b.key); if x != 0 { return x }
            let y = b.wage - a.wage; if y != 0 { return y < 0 ? -1 : 1 }
            return 0
        }
        return rows.map { r in
            let job = jobs.first { $0["id"] == .string(r.key) }
            let name: String = job.map { JS.truthy($0["name"]) ? JS.string($0["name"]) : "（名前なし）" }
                ?? (JS.truthy(r.jobName) ? JS.string(r.jobName) : jobNone())
            return .object([
                "name": .string(name),
                "hourly": job.map { .number(Double(JS.toInt32($0["hourly"]))) } ?? .null,
                "times": .number(r.times),
                "hours": .string(fmtHours(r.hours)),
                "wage": .string(fmtWage(JS.round(r.wage))),
            ])
        }
    }
}
