import Foundation

/// 起動したときの読み込み。Web 版 App.jsx の constructor（と、その上にある sanitize… / mergeTypes）の写し。
///
/// 保存されていた中身に壊れた予定が混じっていても、落ちずに開けるようにする。
/// 捨てるのは「日付が読めない予定」だけ。それ以外は直して残す（予定を黙って消さない）。
/// 答えは正解表（golden/load.json）と 1 つ残らず一致させる。
public enum Loader {
    public typealias Obj = [String: JSONValue]

    /// 起動したばかりの状態（保存が無いとき）。App.jsx の state の初期値と同じ
    public static let defaultSettings: Obj = [
        "hourly": .number(1120), "weekStart": .number(0), "remind": .bool(true), "hideCanceled": .bool(false),
        "dark": .bool(false), "onboarded": .bool(false), "priorWage": .object([:]),
    ]

    public static let builtinTypes: [Obj] = [
        ["key": .string("yoji"), "name": .string("用事"), "color": .string("#8B7AB8"), "paper": .string("rgba(211,204,228,.72)"), "dark": .string("#463D5C"), "uWord": .string("まだ分からない用事"), "cWord": .string("確定した用事")],
        ["key": .string("baito"), "name": .string("バイト"), "color": .string("#7FAE85"), "paper": .string("rgba(206,224,209,.72)"), "dark": .string("#405743"), "uWord": .string("希望シフト"), "cWord": .string("確定シフト"), "defStart": .string("17:00"), "defEnd": .string("22:00")],
        ["key": .string("asobi"), "name": .string("遊び"), "color": .string("#D2916A"), "paper": .string("rgba(238,213,198,.72)"), "dark": .string("#694935"), "uWord": .string("候補日"), "cWord": .string("約束")],
        ["key": .string("other"), "name": .string("その他"), "color": .string("#8A8A8A"), "paper": .string("rgba(211,211,211,.72)"), "dark": .string("#454545"), "uWord": .string("未確定の予定"), "cWord": .string("予定")],
    ]

    /// 前の既定色。これのままなら、新しい既定色に入れ替える（自分で選んだ色はそのまま）
    static let oldDefaultColors: [String: String] = ["yoji": "#534AB7", "baito": "#1D9E75", "asobi": "#D85A30", "other": "#5A6570"]

    public static let trashDays: Double = 30
    static let dayMs: Double = 86_400_000

    /// 保存されていた中身（無ければ nil）から、使う中身（PERSISTED の 11 項目）を作る
    public static func load(_ saved: Obj?, now: Double, makeId: () -> String) -> Obj {
        var st: Obj = [
            "events": .array([]), "types": .array(builtinTypes.map { .object($0) }), "overrides": .object([:]),
            "settings": .object(defaultSettings), "notices": .array([]), "lastSeenVersion": .null,
            "jobs": .array([]), "supports": .array([]), "trash": .array([]), "someday": .array([]), "gone": .array([]),
        ]
        guard let saved else { return st }
        st["events"] = .array(sanitizeEvents(saved["events"], makeId: makeId))
        if typesOk(saved["types"]), let list = saved["types"]?.array?.compactMap({ $0.object }) {
            st["types"] = .array(mergeTypes(list, builtinTypes).map { .object($0) })
        }
        st["overrides"] = JS.truthy(saved["overrides"]) ? saved["overrides"]! : .object([:])
        var settings = defaultSettings
        settings["onboarded"] = .bool(true)
        for (k, v) in spread(JS.or(saved["settings"], .object([:]))) { settings[k] = v }
        st["settings"] = .object(settings)
        st["notices"] = JS.truthy(saved["notices"]) ? saved["notices"]! : .array([])
        st["lastSeenVersion"] = JS.truthy(saved["lastSeenVersion"]) ? saved["lastSeenVersion"]! : .null
        st["jobs"] = .array(sanitizeJobs(saved["jobs"]))
        st["supports"] = .array(sanitizeSupports(saved["supports"]))
        st["trash"] = .array(sanitizeTrash(saved["trash"], now: now))
        st["someday"] = .array(sanitizeSomeday(saved["someday"]))
        st["gone"] = .array(sanitizeGone(saved["gone"], now: now))
        return st
    }

    /// JS の `{ ...v }`（オブジェクトは中身、配列と文字は番号の鍵、ほかは何も無い）
    static func spread(_ v: JSONValue?) -> [(String, JSONValue)] {
        guard let v else { return [] }
        switch v {
        case .object(let o): return o.map { ($0.key, $0.value) }
        case .array(let a): return a.enumerated().map { ("\($0.offset)", $0.element) }
        case .string(let s): return s.utf16.enumerated().map { ("\($0.offset)", JSONValue.string(String(decoding: [$0.element], as: UTF16.self))) }  // JS は UTF-16 の 1 単位ずつ
        default: return []
        }
    }

    /// JS の typeof x === 'number' && Number.isFinite(x)
    static func isNum(_ v: JSONValue?) -> Bool { if case .number(let n)? = v { return n.isFinite }; return false }
    /// JS の x && typeof x === 'object'（配列もオブジェクトに入る）
    static func isObj(_ v: JSONValue?) -> Bool {
        switch v { case .object?, .array?: return true; default: return false }
    }
    static func isStr(_ v: JSONValue?) -> Bool { if case .string? = v { return true }; return false }

    static let hhmm = try! NSRegularExpression(pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    static func isHHMM(_ v: JSONValue?) -> Bool {
        guard case .string(let s)? = v else { return false }
        return hhmm.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }

    public static func sanitizeEvents(_ list: JSONValue?, makeId: () -> String) -> [JSONValue] {
        guard case .array(let a)? = list else { return [] }
        var out: [JSONValue] = []
        for item in a {
            guard case .object(let e) = item else { continue }
            guard isNum(e["y"]), isNum(e["m"]), isNum(e["day"]) else { continue }
            let m = e["m"]!.number!, d = e["day"]!.number!
            if m < 0 || m > 11 || d < 1 || d > 31 { continue }
            let start: JSONValue = isHHMM(e["start"]) ? e["start"]! : .string("09:00")
            let end: JSONValue = isHHMM(e["end"]) ? e["end"]! : start
            let allDay = JS.truthy(e["allDay"]) || (start == .string("00:00") && end == .string("23:59"))
            var o = e
            o["allDay"] = .bool(allDay)
            if case .string(let id)? = e["id"], !id.isEmpty {} else { o["id"] = .string(makeId()) }
            o["title"] = isStr(e["title"]) ? e["title"]! : .string("無題")
            o["start"] = start
            o["end"] = end
            if isHHMM(e["actualEnd"]) { o["actualEnd"] = e["actualEnd"]! } else { o.removeValue(forKey: "actualEnd") }
            if case .array(let w)? = e["want"], w.count == 2 { o["want"] = e["want"]! } else { o.removeValue(forKey: "want") }
            out.append(.object(o))
        }
        return out
    }

    public static func typesOk(_ list: JSONValue?) -> Bool {
        guard case .array(let a)? = list, !a.isEmpty else { return false }
        return a.allSatisfy { t in
            guard case .object(let o) = t else { return false }
            return isStr(o["key"]) && isStr(o["name"]) && isStr(o["color"])
        }
    }

    public static func mergeTypes(_ saved: [Obj], _ builtin: [Obj]) -> [Obj] {
        let filled: [Obj] = saved.map { t in
            let key = JS.string(t["key"])
            guard let base = builtin.first(where: { JS.string($0["key"]) == key }) else { return t }
            var merged = base
            for (k, v) in t { merged[k] = v }
            if let old = oldDefaultColors[key], t["color"] == .string(old) {
                merged["color"] = base["color"]; merged["paper"] = base["paper"]; merged["dark"] = base["dark"]
            }
            return merged
        }
        func order(_ t: Obj) -> Int {
            let k = JS.string(t["key"])
            return builtin.firstIndex { JS.string($0["key"]) == k } ?? 999
        }
        return JS.stableSorted(filled) { a, b in order(a) - order(b) }
    }

    static func sanitizeJobs(_ list: JSONValue?) -> [JSONValue] {
        guard case .array(let a)? = list else { return [] }
        return a.filter { j in
            guard JS.truthy(j), case .object(let o) = j else { return false }
            return isStr(o["id"]) && isNum(o["hourly"])
        }
    }

    static func sanitizeSupports(_ list: JSONValue?) -> [JSONValue] {
        guard case .array(let a)? = list else { return [] }
        return a.filter { x in
            guard isObj(x), case .object(let o) = x else { return false }
            return isNum(o["yen"]) && isNum(o["at"])
        }
    }

    static func sanitizeTrash(_ list: JSONValue?, now: Double) -> [JSONValue] {
        guard case .array(let a)? = list else { return [] }
        let kept = a.filter { x in
            guard case .object(let o) = x else { return false }
            guard JS.truthy(o["ev"]), isObj(o["ev"]), isNum(o["at"]) else { return false }
            return now - o["at"]!.number! < trashDays * dayMs
        }
        return Array(kept.prefix(400))
    }

    static func sanitizeGone(_ list: JSONValue?, now: Double) -> [JSONValue] {
        guard case .array(let a)? = list else { return [] }
        let kept = a.filter { x in
            guard case .array(let p) = x, p.count >= 2 || p.count >= 1 else { return false }
            guard p.count >= 1, isStr(p[0]) else { return false }
            guard p.count >= 2, isNum(p[1]) else { return false }
            return now - p[1].number! < trashDays * dayMs
        }
        return Array(kept.prefix(800))
    }

    static let somedayWhen: Set<String> = ["week", "month", "next", "someday"]
    static func sanitizeSomeday(_ list: JSONValue?) -> [JSONValue] {
        guard case .array(let a)? = list else { return [] }
        return a.filter { x in
            guard JS.truthy(x), case .object(let o) = x else { return false }
            guard isStr(o["id"]), isStr(o["title"]) else { return false }
            if case .string(let w)? = o["when"] { return somedayWhen.contains(w) }
            return false
        }
    }

    /// Web 版の uid('x')：'x' + いまのミリ秒（36 進）+ 乱数 5 文字
    public static func uid(_ prefix: String, now: Double) -> String {
        let chars = Array("0123456789abcdefghijklmnopqrstuvwxyz")
        let rand = String((0..<5).map { _ in chars[Int.random(in: 0..<36)] })
        return prefix + String(Int64(now), radix: 36) + rand
    }
}
