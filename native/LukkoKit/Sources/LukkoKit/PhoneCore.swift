import Foundation

/// JS の Date を、端末の時刻の数え方（タイムゾーン）で写すもの
public enum JSDate {
    public struct Parts: Equatable { public var y: Int, m: Int, d: Int, h: Int, min: Int, s: Int, ms: Int }
    /// new Date(ms) の getFullYear() など（地元の時刻）
    public static func local(_ ms: Double, _ tz: TimeZone) -> Parts {
        // 範囲外（Invalid Date）は 1970-01-01 として落ちずに返す（呼ぶ側で NaN を先に除いている）
        let t = ms.isFinite && abs(ms) <= 8.64e15 ? ms.rounded(.towardZero) : 0
        let off = Double(tz.secondsFromGMT(for: Date(timeIntervalSince1970: t / 1000))) * 1000
        let lm = t + off
        let dn = (lm / 86_400_000).rounded(.down)
        var rest = Int(lm - dn * 86_400_000)
        let c = Civil.fromDayNo(Int(dn))
        let h = rest / 3_600_000; rest -= h * 3_600_000
        let mi = rest / 60_000; rest -= mi * 60_000
        return Parts(y: c.y, m: c.m, d: c.d, h: h, min: mi, s: rest / 1000, ms: rest % 1000)
    }
    /// new Date(y, m, d, h, mi, s).getTime()（はみ出しは繰り上げる）
    public static func make(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 0, _ mi: Int = 0, _ s: Int = 0, _ tz: TimeZone) -> Double {
        let lm = (Double(Civil.dayNo(y, m, d)) * 86_400_000) + Double(h) * 3_600_000 + Double(mi) * 60_000 + Double(s) * 1000
        let g = lm - Double(tz.secondsFromGMT(for: Date(timeIntervalSince1970: lm / 1000))) * 1000
        return lm - Double(tz.secondsFromGMT(for: Date(timeIntervalSince1970: g / 1000))) * 1000
    }
    /// new Date(v) の時刻（数でなければ NaN。null は 0）
    public static func ms(_ v: JSONValue?) -> Double {
        switch v {
        case .number(let n)?: return n.isFinite && abs(n) <= 8.64e15 ? n.rounded(.towardZero) : .nan   // JS の Date の範囲を超えたら Invalid Date
        case .null?: return 0
        case .bool(let b)?: return b ? 1 : 0
        default: return .nan
        }
    }
}

/// iPhone のカレンダー（EventKit）。予定とカレンダーは、Web 版が使っていたプラグインと同じ形の JSON でやりとりする。
/// こうしておけば、読み方・書き方の決まりを Web 版と 1 つ残らず同じにでき、試験では代わりのものを置ける
public protocol PhoneCalendar: AnyObject {
    /// "granted" / "denied" / "prompt"
    func checkPermission() async throws -> String
    /// "granted" / "denied"
    func requestFullAccess() async throws -> String
    /// { id, title, color, type（0 ローカル・1 CalDAV・2 Exchange・3 購読・4 誕生日）, isSubscribed }
    func listCalendars() async throws -> [JSONValue]
    /// { id, title, calendarId, location, startDate, endDate, allDay, url, description, status, lastModifiedDate }
    func listEventsInRange(from: Double, to: Double) async throws -> [JSONValue]
    func fetchAllCalendarSources() async throws -> [JSONValue]
    func createCalendar(title: String, color: String, sourceId: String?) async throws -> String?
    func createEvent(_ body: [String: JSONValue]) async throws -> String?
    func modifyEvent(id: String, _ body: [String: JSONValue]) async throws
    func deleteEvent(id: String) async throws
}

/// iPhone のカレンダーとのやりとり（Web 版 iphonecal.js・calendarimport.js の写し）
public enum PhoneCal {
    public static let exportTitle = "LUKKO"
    static func pad(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

    /// iPhone の予定を、このアプリの形にする（取り込みと重ね表示で共用）
    public static func toAppShape(_ e: JSONValue, _ tz: TimeZone) -> [String: JSONValue]? {
        let sms = JSDate.ms(e["startDate"])
        if sms.isNaN { return nil }
        let ems = JSDate.ms(JS.or(e["endDate"], e["startDate"]))
        let sd = JSDate.local(sms, tz)
        let base: [String: JSONValue] = ["y": .number(Double(sd.y)), "m": .number(Double(sd.m)), "day": .number(Double(sd.d))]
        let ed: JSDate.Parts? = ems.isNaN ? nil : JSDate.local(ems, tz)
        let spanDays: Double = ed.map { Double(Civil.dayNo($0.y, $0.m, $0.d) - Civil.dayNo(sd.y, sd.m, sd.d)) } ?? .nan
        let ad = (e["allDay"] != nil && e["allDay"] != .null) ? e["allDay"] : e["isAllDay"]
        func hhmm(_ p: JSDate.Parts?) -> String { p.map { pad($0.h) + ":" + pad($0.min) } ?? "NaN:NaN" }
        func allDayShape(_ n: Double) -> [String: JSONValue] {
            var o = base
            o["start"] = .string("00:00"); o["end"] = .string("23:59"); o["allDay"] = .bool(true)
            o["days"] = n.isNaN ? .null : .number(max(1, min(60, n)))  // JS は NaN（保存すると null）
            return o
        }
        if JS.truthy(ad) {
            let endIncl = (ed?.h == 0 && ed?.min == 0 && spanDays > 0) ? spanDays : spanDays + 1
            return allDayShape(endIncl)
        }
        let dur = ems - sms
        if spanDays == 0 || (spanDays == 1 && dur <= 24 * 3_600_000) {
            var o = base
            o["start"] = .string(hhmm(sd)); o["end"] = .string(hhmm(ed)); o["allDay"] = .bool(false)
            return o
        }
        return allDayShape(spanDays + 1)
    }

    // MARK: 許可
    public static func checkAccess(_ cal: PhoneCalendar?) async -> String {
        guard let cal else { return "unavailable" }
        do { let r = try await cal.checkPermission(); return r == "granted" ? "granted" : r == "denied" ? "denied" : "prompt" } catch { return "prompt" }
    }
    public static func askAccess(_ cal: PhoneCalendar?) async -> String {
        guard let cal else { return "unavailable" }
        do {
            if await checkAccess(cal) == "granted" { return "granted" }
            return try await cal.requestFullAccess() == "granted" ? "granted" : "denied"
        } catch { return "denied" }
    }

    // MARK: 取り込み

    /// 題名から「まだ決まっていない」と読める言葉
    static let tentative = try! NSRegularExpression(pattern: "[（(]\\s*仮\\s*[)）]|^仮[ 　:：]|仮押さえ|候補|未定|調整中|[?？]\\s*$|\\bTBD\\b", options: [.caseInsensitive])
    static func isSkipCal(_ c: JSONValue) -> Bool { c["type"] == .number(3) || c["type"] == .number(4) || JS.truthy(c["isSubscribed"]) }

    /// 取り込みに使えるカレンダーの一覧（誕生日と購読と LUKKO は除く）
    public static func listImportCalendars(_ cal: PhoneCalendar?) async -> [JSONValue] {
        guard let cal else { return [] }
        guard let list = try? await cal.listCalendars() else { return [] }
        return list.filter { c in JS.truthy(c) && !isSkipCal(c) && c["title"] != .string(exportTitle) }.map { c in
            .object(["id": .string(JS.string(c["id"])), "title": JS.or(c["title"], .string("（名前なし）")) ?? .null, "color": JS.or(c["color"], .string("#999")) ?? .null])
        }
    }

    /// 前後の期間ぶんの予定を読み、このアプリの形にして返す（読むだけ）
    public static func readCalendarEvents(_ cal: PhoneCalendar?, monthsBack: Int = 1, monthsAhead: Int = 12, calIds: [String]? = nil, fromDate: Double? = nil, now: Double, tz: TimeZone) async throws -> [JSONValue] {
        guard let cal else { return [] }
        let n = JSDate.local(now, tz)
        let from = fromDate ?? JSDate.make(n.y, n.m - monthsBack, 1, 0, 0, 0, tz)
        let to = JSDate.make(n.y, n.m + monthsAhead + 1, 0, 23, 59, 59, tz)
        let pick: [String]? = (calIds?.isEmpty == false) ? calIds : nil
        var skip: [String] = []
        if let cals = try? await cal.listCalendars() {
            for c in cals where JS.truthy(c) && isSkipCal(c) { skip.append(JS.string(c["id"])) }
        }
        let res = try await cal.listEventsInRange(from: from, to: to)
        let list = res
            .filter { e in !(JS.truthy(e) && e["calendarId"] != nil && e["calendarId"] != .null && skip.contains(JS.string(e["calendarId"]))) }
            .filter { e in pick == nil || (JS.truthy(e) && pick!.contains(JS.string(e["calendarId"]))) }
            .filter { e in !(JS.truthy(e) && e["description"] == .string("LUKKO から")) }
        var out: [[String: JSONValue]] = []
        for e in list {
            let sms = JSDate.ms(e["startDate"])
            if sms.isNaN { continue }
            let title = JS.string(JS.or(e["title"], .string(""))).jsTrimmed
            let sd = JSDate.local(sms, tz)
            if let hol = Holidays.name(sd.y, sd.m, sd.d), squash(title) == squash(hol) { continue }
            if e["status"] == .string("canceled") { continue }
            guard let sh = toAppShape(e, tz) else { continue }
            let memo = JS.string(JS.or(e["description"], .string(""))).jsTrimmed
            var o: [String: JSONValue] = ["srcId": .string(JS.string(e["id"])), "title": .string(title.isEmpty ? "無題" : title)]
            if let c = e["calendarId"], c != .null { o["srcCal"] = .string(JS.string(c)) }
            for (k, v) in sh { o[k] = v }
            if JS.truthy(e["location"]) { o["place"] = .string(JS.slice16(JS.string(e["location"]).jsTrimmed, 200)) }
            if !memo.isEmpty { o["memo"] = .string(JS.slice16(memo, 2000)) }
            if JS.truthy(e["url"]) { o["link"] = .string(JS.string(e["url"])) }
            let tent = e["status"] == .string("tentative") || tentative.firstMatch(in: title, range: NSRange(location: 0, length: (title as NSString).length)) != nil
            o["status"] = .string(tent ? "mikakutei" : "kakutei")
            o["updatedFrom"] = JS.or(e["lastModifiedDate"], .null) ?? .null
            out.append(o)
        }
        let sorted = JS.stableSorted(out) { a, b in
            for k in ["y", "m", "day"] {
                let d = JS.number(a[k]) - JS.number(b[k])
                if JS.truthy(.number(d)) { return JS.sign(d) }
            }
            let x = JS.string(a["start"]), y = JS.string(b["start"])
            return x < y ? -1 : (x > y ? 1 : 0)
        }
        return sorted.map { .object($0) }
    }
    /// 比べるときだけ空白を無視する（JS の \s と同じ文字）
    static func squash(_ s: String) -> String { String(String.UnicodeScalarView(s.unicodeScalars.filter { !JS.isTrimSpace($0) })) }

    // MARK: 重ね表示

    /// 選べるカレンダーの一覧（誕生日・LUKKO 自身は除く）
    public static func listPhoneCalendars(_ cal: PhoneCalendar?) async -> [JSONValue] {
        guard let cal else { return [] }
        guard let list = try? await cal.listCalendars() else { return [] }
        return list.filter { c in JS.truthy(c) && c["type"] != .number(4) && c["title"] != .string(exportTitle) }.map { c in
            .object(["id": .string(JS.string(c["id"])), "title": JS.or(c["title"], .string("（名前なし）")) ?? .null, "color": JS.or(c["color"], .string("#999")) ?? .null,
                     "sub": .bool(c["type"] == .number(3) || JS.truthy(c["isSubscribed"]))])
        }
    }
    /// 重ねて表示する予定を読む
    public static func readOverlay(_ cal: PhoneCalendar?, ids: [JSONValue]?, from: Double, to: Double, tz: TimeZone) async -> [JSONValue] {
        guard let cal, let ids, !ids.isEmpty else { return [] }
        let want = ids.map { JS.string($0) }
        guard let list = try? await cal.listEventsInRange(from: from, to: to) else { return [] }
        var out: [JSONValue] = []
        for e in list {
            if !JS.truthy(e) || !want.contains(JS.string(e["calendarId"])) { continue }
            if e["status"] == .string("canceled") { continue }
            guard var sh = toAppShape(e, tz) else { continue }
            sh["id"] = .string("ov-" + JS.string(e["id"]) + "-" + JS.string(sh["y"]) + JS.string(sh["m"]) + JS.string(sh["day"]))
            sh["title"] = .string(JS.string(JS.or(e["title"], .string("予定"))).jsTrimmed)
            sh["overlay"] = .bool(true); sh["status"] = .string("kakutei"); sh["type"] = .string("__overlay")
            sh["place"] = JS.or(e["location"], .string("")) ?? .string("")
            out.append(.object(sh))
        }
        return out
    }

    // MARK: 書き出し（決まった予定を「LUKKO」カレンダーにも入れる）

    /// 「LUKKO」カレンダーを探す。無ければ作る（iCloud か、この iPhone の中に）
    public static func ensureExportCalendar(_ cal: PhoneCalendar?, knownId: JSONValue?) async -> String? {
        guard let cal else { return nil }
        do {
            let all = try await cal.listCalendars()
            if JS.truthy(knownId), all.contains(where: { JS.string($0["id"]) == JS.string(knownId) }) { return JS.string(knownId) }
            if let found = all.first(where: { $0["title"] == .string(exportTitle) }) { return JS.string(found["id"]) }
            var sourceId: String? = nil
            if let src = try? await cal.fetchAllCalendarSources() {
                let icloud = try! NSRegularExpression(pattern: "icloud", options: [.caseInsensitive])
                let pick = src.first { s in let t = JS.string(JS.or(s["title"], .string(""))); return icloud.firstMatch(in: t, range: NSRange(location: 0, length: (t as NSString).length)) != nil }
                    ?? src.first { $0["type"] == .number(0) || $0["type"] == .string("local") }
                if let pick { sourceId = JS.string(pick["id"]) }
            }
            let made = try await cal.createCalendar(title: exportTitle, color: "#6E85BE", sourceId: sourceId)
            return (made?.isEmpty == false) ? made : nil
        } catch { return nil }
    }

    /// 予定の時刻（iPhone の予定の形）
    static func toTimes(_ ev: [String: JSONValue], _ tz: TimeZone) -> [(String, JSONValue)] {
        func parts(_ v: JSONValue?) -> (Int, Int) {
            let p = JS.string(JS.or(v, .string("0:0"))).components(separatedBy: ":").map { JS.number($0) }
            let a = p.count > 0 ? JS.orZero(p[0]) : 0, b = p.count > 1 ? JS.orZero(p[1]) : 0
            return (JS.int(.number(a)), JS.int(.number(b)))
        }
        let (sh, sm) = parts(ev["start"])
        let (eh, em) = parts(ev["status"] == .string("jisseki") ? JS.or(ev["actualEnd"], ev["end"]) : ev["end"])
        let y = JS.int(ev["y"]), m = JS.int(ev["m"]), d = JS.int(ev["day"])
        if JS.truthy(ev["allDay"]) {
            let di = Int(JS.toInt32(ev["days"]))
            let days = max(1, min(60, di != 0 ? di : 1))
            return [("startDate", .number(JSDate.make(y, m, d, 0, 0, 0, tz))), ("endDate", .number(JSDate.make(y, m, d + days - 1, 23, 59, 0, tz))), ("isAllDay", .bool(true))]
        }
        let s = JSDate.make(y, m, d, sh, sm, 0, tz)
        var e = JSDate.make(y, m, d, eh, em, 0, tz)
        if e <= s { e = JSDate.make(y, m, d + 1, eh, em, 0, tz) }
        return [("startDate", .number(s)), ("endDate", .number(e)), ("isAllDay", .bool(false))]
    }

    /// 書いた中身の控え（署名）。Web 版の JSON.stringify(body) と 1 文字も違わないように、同じ順番で書く
    /// （違うと、引っ越した直後に全部の予定を書き直してしまう）
    static func signature(_ body: [(String, JSONValue)]) -> String {
        "{" + body.map { JSJSON.quote($0.0) + ":" + JSJSON.stringify($0.1) }.joined(separator: ",") + "}"
    }

    /// 決まった予定を「LUKKO」カレンダーにそろえる。map は { 予定の id: iPhone 側の id, "#id": 署名 }。返すのは新しい map
    public static func syncExport(_ cal: PhoneCalendar?, events: [JSONValue], calId: String?, map: [String: JSONValue], hideAll: Bool, tz: TimeZone) async -> JSObjectMap {
        var out = JSObjectMap(map)
        guard let cal, let calId, !calId.isEmpty else { return out }
        // 決まった予定（同じ番号が何度出ても、場所は最初・中身は最後）
        var wantIds: [String] = [], want: [String: [String: JSONValue]] = [:]
        for v in events {
            guard let ev = v.object, JS.truthy(v), !JS.truthy(ev["overlay"]) else { continue }
            if ev["status"] != .string("kakutei") && ev["status"] != .string("jisseki") { continue }
            let id = JS.string(ev["id"])
            if want[id] == nil { wantIds.append(id) }
            want[id] = ev
        }
        // 消す：もう決まっていない・消えた予定（'#id' は署名なので、ここでは消さない）
        for id in out.keys {
            if id.hasPrefix("#") || want[id] != nil { continue }
            if let nid = out[id] { try? await cal.deleteEvent(id: JS.string(nid)) }
            out.remove(id); out.remove("#" + id)
        }
        // 作る・直す
        for id in wantIds {
            let ev = want[id]!
            // 日付が数でない予定は、Web 版でも書けずに終わる（こちらは呼ぶ前にやめる）
            if !["y", "m", "day"].allSatisfy({ JS.number(ev[$0]).isFinite }) { continue }
            let hidden = JS.truthy(ev["secret"]) || hideAll
            var body: [(String, JSONValue)] = [
                ("title", hidden ? .string("予定") : (JS.or(ev["title"], .string("予定")) ?? .null)),
                ("calendarId", .string(calId)),
                ("location", hidden ? .string("") : (JS.or(ev["place"], .string("")) ?? .null)),
                ("description", .string("LUKKO から")),
            ]
            if !hidden, let link = ev["link"], JS.truthy(link) { body.append(("url", link)) }
            body += toTimes(ev, tz)
            let sig = signature(body)
            let dict = Dictionary(body, uniquingKeysWith: { a, _ in a })
            if JS.truthy(out[id]), out["#" + id] == .string(sig) { continue }
            // リンクは直す（modify）では消せない。前はリンクがあって今は無いときは、消して作り直す
            var prevUrl = false
            if let old = out["#" + id], JS.truthy(old) {
                // JS：JSON.parse(…).url。読めない・null のときは投げて true になる
                if let o = try? JSJSON.parse(JS.string(old)), o != .null { prevUrl = JS.truthy(o["url"]) } else { prevUrl = true }
            }
            if let nid = out[id], JS.truthy(nid), prevUrl, dict["url"] == nil {
                try? await cal.deleteEvent(id: JS.string(nid))
                out.remove(id)
            }
            do {
                if let nid = out[id], JS.truthy(nid) {
                    try await cal.modifyEvent(id: JS.string(nid), dict)
                } else if let r = try await cal.createEvent(dict), !r.isEmpty {
                    out[id] = .string(r)
                }
                out["#" + id] = .string(sig)
            } catch {
                // 向こうで消されていた：作り直す
                if let r = try? await cal.createEvent(dict), !r.isEmpty { out[id] = .string(r); out["#" + id] = .string(sig) }
            }
        }
        // 署名（#id）だけ残ったものを片づける
        for k in out.keys where k.hasPrefix("#") {
            if !JS.truthy(out[String(k.dropFirst())]) { out.remove(k) }
        }
        return out
    }

    /// 書き出しをやめたとき、「LUKKO」カレンダーに書いた予定を消す
    public static func clearExport(_ cal: PhoneCalendar?, map: [String: JSONValue]) async {
        guard let cal else { return }
        for (k, id) in JSObjectMap(map).pairs where !k.hasPrefix("#") { try? await cal.deleteEvent(id: JS.string(id)) }
    }
}

/// JS のオブジェクト（{ 鍵: 値 }）。鍵の順番も JS と同じ：番号の形の鍵が小さい順に先、ほかは入れた順
public struct JSObjectMap: Equatable {
    private var order: [String] = []
    private var dict: [String: JSONValue] = [:]
    public init(_ d: [String: JSONValue] = [:]) { for k in d.keys.sorted() { self[k] = d[k] } }
    public subscript(k: String) -> JSONValue? {
        get { dict[k] }
        set {
            guard let v = newValue else { remove(k); return }
            if dict[k] == nil { order.append(k) }
            dict[k] = v
        }
    }
    public mutating func remove(_ k: String) { if dict.removeValue(forKey: k) != nil { order.removeAll { $0 == k } } }
    static func arrayIndex(_ k: String) -> UInt32? {
        guard let n = UInt32(k), n != UInt32.max, String(n) == k else { return nil }
        return n
    }
    public var keys: [String] {
        let idx = order.compactMap { k in Self.arrayIndex(k).map { (k, $0) } }.sorted { $0.1 < $1.1 }.map { $0.0 }
        return idx + order.filter { Self.arrayIndex($0) == nil }
    }
    public var pairs: [(String, JSONValue)] { keys.map { ($0, dict[$0]!) } }
    public var object: [String: JSONValue] { dict }
}

/// JSON.stringify と 1 文字も違わない書き方（署名のため）
public enum JSJSON {
    public static func quote(_ s: String) -> String {
        var r = "\""
        for u in s.unicodeScalars {
            switch u {
            case "\"": r += "\\\""
            case "\\": r += "\\\\"
            case "\u{08}": r += "\\b"
            case "\u{0C}": r += "\\f"
            case "\n": r += "\\n"
            case "\r": r += "\\r"
            case "\t": r += "\\t"
            default:
                if u.value < 0x20 { r += String(format: "\\u%04x", u.value) } else { r.unicodeScalars.append(u) }
            }
        }
        return r + "\""
    }
    public static func stringify(_ v: JSONValue) -> String {
        switch v {
        case .null: return "null"
        case .bool(let b): return b ? "true" : "false"
        case .number(let n): return n.isFinite ? JS.numberToString(n) : "null"
        case .string(let s): return quote(s)
        case .array(let a): return "[" + a.map(stringify).joined(separator: ",") + "]"
        case .object(let o): return "{" + o.keys.sorted().map { quote($0) + ":" + stringify(o[$0]!) }.joined(separator: ",") + "}"
        }
    }
}

extension JSJSON {
    struct SyntaxError: Error {}
    /// JS の JSON.parse と同じ決まりで読む（末尾のカンマやコメントは読まない。同じ鍵はあとのほうが勝つ）。
    /// Swift の JSONDecoder は、末尾のカンマなどを黙って読んでしまうことがあるので、控えの読み込みはこちらを使う
    public static func parse(_ text: String) throws -> JSONValue {
        var p = Parser(u: Array(text.utf16))
        p.ws()
        let v = try p.value()
        p.ws()
        guard p.i == p.u.count else { throw SyntaxError() }
        return v
    }
    struct Parser {
        let u: [UInt16]
        var i = 0
        mutating func ws() { while i < u.count, [0x20, 0x09, 0x0A, 0x0D].contains(u[i]) { i += 1 } }
        mutating func eat(_ c: UInt16) throws { guard i < u.count, u[i] == c else { throw SyntaxError() }; i += 1 }
        mutating func lit(_ s: String, _ v: JSONValue) throws -> JSONValue {
            for c in s.utf16 { try eat(c) }
            return v
        }
        mutating func value() throws -> JSONValue {
            guard i < u.count else { throw SyntaxError() }
            switch u[i] {
            case 0x7B: // {
                i += 1; ws()
                var o: [String: JSONValue] = [:]
                if i < u.count, u[i] == 0x7D { i += 1; return .object(o) }
                while true {
                    ws()
                    guard i < u.count, u[i] == 0x22 else { throw SyntaxError() }
                    let k = try string()
                    ws(); try eat(0x3A); ws()
                    o[k] = try value()
                    ws()
                    guard i < u.count else { throw SyntaxError() }
                    if u[i] == 0x2C { i += 1; continue }
                    if u[i] == 0x7D { i += 1; return .object(o) }
                    throw SyntaxError()
                }
            case 0x5B: // [
                i += 1; ws()
                var a: [JSONValue] = []
                if i < u.count, u[i] == 0x5D { i += 1; return .array(a) }
                while true {
                    ws()
                    a.append(try value())
                    ws()
                    guard i < u.count else { throw SyntaxError() }
                    if u[i] == 0x2C { i += 1; continue }
                    if u[i] == 0x5D { i += 1; return .array(a) }
                    throw SyntaxError()
                }
            case 0x22: return .string(try string())
            case 0x74: return try lit("true", .bool(true))
            case 0x66: return try lit("false", .bool(false))
            case 0x6E: return try lit("null", .null)
            default: return .number(try number())
            }
        }
        mutating func string() throws -> String {
            try eat(0x22)
            var out: [UInt16] = []
            while true {
                guard i < u.count else { throw SyntaxError() }
                let c = u[i]; i += 1
                if c == 0x22 { break }
                if c < 0x20 { throw SyntaxError() }
                if c != 0x5C { out.append(c); continue }
                guard i < u.count else { throw SyntaxError() }
                let e = u[i]; i += 1
                switch e {
                case 0x22: out.append(0x22)
                case 0x5C: out.append(0x5C)
                case 0x2F: out.append(0x2F)
                case 0x62: out.append(0x08)
                case 0x66: out.append(0x0C)
                case 0x6E: out.append(0x0A)
                case 0x72: out.append(0x0D)
                case 0x74: out.append(0x09)
                case 0x75:
                    guard i + 4 <= u.count, let v = UInt16(String(decoding: u[i..<i + 4], as: UTF16.self), radix: 16) else { throw SyntaxError() }
                    out.append(v); i += 4
                default: throw SyntaxError()
                }
            }
            return String(decoding: out, as: UTF16.self)
        }
        mutating func number() throws -> Double {
            let s = i
            func digit(_ c: UInt16) -> Bool { c >= 0x30 && c <= 0x39 }
            if i < u.count, u[i] == 0x2D { i += 1 }
            guard i < u.count, digit(u[i]) else { throw SyntaxError() }
            if u[i] == 0x30 { i += 1 } else { while i < u.count, digit(u[i]) { i += 1 } }
            if i < u.count, u[i] == 0x2E {
                i += 1
                guard i < u.count, digit(u[i]) else { throw SyntaxError() }
                while i < u.count, digit(u[i]) { i += 1 }
            }
            if i < u.count, u[i] == 0x65 || u[i] == 0x45 {
                i += 1
                if i < u.count, u[i] == 0x2B || u[i] == 0x2D { i += 1 }
                guard i < u.count, digit(u[i]) else { throw SyntaxError() }
                while i < u.count, digit(u[i]) { i += 1 }
            }
            let str = String(decoding: u[s..<i], as: UTF16.self)
            // 桁あふれは JS と同じく Infinity（Swift の Double(String) も同じ）
            return Double(str) ?? .nan
        }
    }
}
