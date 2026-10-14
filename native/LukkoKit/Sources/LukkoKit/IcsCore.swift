import Foundation

/// .ics（iCalendar）の書き出しと読み込み（Web 版 app/src/ics.js の写し）。
/// 時刻はタイムゾーン無しの「その土地の時刻」で書く。読むときは Z（UTC）だけ端末の時刻に直す。
public enum IcsCore {
    public typealias Ev = [String: JSONValue]

    static func pad(_ s: String) -> String { s.count >= 2 ? s : String(repeating: "0", count: 2 - s.count) + s }
    static func pad(_ n: Int) -> String { pad(String(n)) }
    static func ymd(_ y: Int, _ m: Int, _ d: Int) -> String { "\(y)" + pad(m + 1) + pad(d) }

    /// .ics の中の「\」「;」「,」「改行」の書き方（RFC 5545 の TEXT）
    public static func esc(_ v: JSONValue?) -> String {
        let s = JS.truthy(v) ? JS.string(v) : ""
        return s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: ";", with: "\\;")
            .replacingOccurrences(of: ",", with: "\\,").replacingOccurrences(of: "\r\n", with: "\\n").replacingOccurrences(of: "\n", with: "\\n")
    }
    public static func unesc(_ s: String) -> String {
        var t = s
        t = t.replacingOccurrences(of: #"\\n"#, with: "\n", options: [.regularExpression, .caseInsensitive])
        t = t.replacingOccurrences(of: "\\,", with: ",")
        t = t.replacingOccurrences(of: "\\;", with: ";")
        t = t.replacingOccurrences(of: "\\\\", with: "\\")
        return t
    }

    /// 1行は75オクテットまで。超えたら次の行の頭に空白を置いて続ける（UTF-8 のバイトで数える）
    static func fold(_ line: String) -> String {
        var out: [String] = []
        var cur = "", bytes = 0
        for ch in line.unicodeScalars {
            let b = String(ch).utf8.count
            if bytes + b > 74 { out.append(cur); cur = " "; bytes = 1 }
            cur.unicodeScalars.append(ch); bytes += b
        }
        out.append(cur)
        return out.joined(separator: "\r\n")
    }

    static func addDays(_ y: Int, _ m: Int, _ d: Int, _ n: Int) -> (Int, Int, Int) {
        let c = Civil.fromDayNo(Civil.dayNo(y, m, d + n)); return (c.y, c.m, c.d)
    }
    static func mins(_ t: JSONValue?) -> Double {
        let p = JS.string(JS.or(t, .string("0:0"))).components(separatedBy: ":")
        return JS.number(p[0]) * 60 + (p.count > 1 ? JS.number(p[1]) : .nan)
    }
    static func splitHM(_ v: JSONValue?) -> (String, String) {
        let p = JS.string(v).components(separatedBy: ":")
        return (p[0], p.count > 1 ? p[1] : "undefined")
    }

    /// 予定の一覧を .ics の文字列にする（無くなった予定は書かない）。stampUTC は書き出した時刻（UTC の年月日時分秒）
    public static func toIcs(_ events: [JSONValue], name: String = "LUKKO", stampUTC: (Int, Int, Int, Int, Int, Int)) -> String {
        let s = stampUTC
        let stamp = "\(s.0)" + pad(s.1 + 1) + pad(s.2) + "T" + pad(s.3) + pad(s.4) + pad(s.5) + "Z"
        var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LUKKO//LUKKO//JA", "CALSCALE:GREGORIAN", "X-WR-CALNAME:" + esc(.string(name))]
        for item in events {
            guard JS.truthy(item), case .object(let e) = item else { continue }
            if JS.string(e["status"]) == "nakunatta" && e["status"]?.string != nil { continue }
            let y = Int(JS.number(e["y"])), m = Int(JS.number(e["m"])), d = Int(JS.number(e["day"]))
            lines.append("BEGIN:VEVENT")
            lines.append("UID:" + esc(JS.or(e["id"], .string("x"))) + "@lukko")
            lines.append("DTSTAMP:" + stamp)
            lines.append("SUMMARY:" + esc(JS.or(e["title"], .string("無題"))))
            if JS.truthy(e["allDay"]) {
                let v = Int(JS.toInt32(e["days"]))
                let span = max(1, min(60, v != 0 ? v : 1))
                let (ey, em, ed) = addDays(y, m, d, span)
                lines.append("DTSTART;VALUE=DATE:" + ymd(y, m, d))
                lines.append("DTEND;VALUE=DATE:" + ymd(ey, em, ed))
            } else {
                let (sh, sm) = splitHM(JS.or(e["start"], .string("00:00")))
                let end: JSONValue? = (JS.truthy(e["actualEnd"]) && e["status"] == .string("jisseki")) ? e["actualEnd"] : JS.or(JS.or(e["end"], e["start"]), .string("00:00"))
                let (eh, emn) = splitHM(end)
                let (ey, em, ed) = mins(end) < mins(e["start"]) ? addDays(y, m, d, 1) : (y, m, d)
                lines.append("DTSTART:" + ymd(y, m, d) + "T" + pad(sh) + pad(sm) + "00")
                lines.append("DTEND:" + ymd(ey, em, ed) + "T" + pad(eh) + pad(emn) + "00")
            }
            lines.append("STATUS:" + (e["status"] == .string("mikakutei") ? "TENTATIVE" : "CONFIRMED"))
            if JS.truthy(e["type"]) { lines.append("X-LUKKO-TYPE:" + esc(e["type"])) }
            if JS.truthy(e["status"]) { lines.append("X-LUKKO-STATUS:" + esc(e["status"])) }
            if JS.truthy(e["place"]) { lines.append("LOCATION:" + esc(e["place"])) }
            if JS.truthy(e["memo"]) { lines.append("DESCRIPTION:" + esc(e["memo"])) }
            lines.append("END:VEVENT")
        }
        lines.append("END:VCALENDAR")
        return lines.map(fold).joined(separator: "\r\n") + "\r\n"
    }

    // MARK: 読む

    struct Prop { let name: String; let params: [String: String]; let value: String }

    static func blocks(_ text: String) -> [[Prop]] {
        var t = text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
        // 折り返しを戻す（JS の /\n[ \t]/g と同じく、元の文字列の上で一度だけ置き換える）
        t = t.replacingOccurrences(of: "\n[ \t]", with: "", options: .regularExpression)
        var out: [[Prop]] = []
        var cur: [Prop]? = nil
        for line in t.components(separatedBy: "\n") {
            if line == "BEGIN:VEVENT" { cur = []; continue }
            if line == "END:VEVENT" { if let c = cur { out.append(c) }; cur = nil; continue }
            guard cur != nil else { continue }
            let u = Array(line.utf16)
            var i = 0, q = false
            while i < u.count { let c = u[i]; if c == 34 { q.toggle() } else if c == 58 && !q { break }; i += 1 }
            if i >= u.count { continue }
            let headStr = String(utf16CodeUnits: Array(u[0..<i]), count: i)
            let value = String(utf16CodeUnits: Array(u[(i + 1)...]), count: u.count - i - 1)
            let head = headStr.components(separatedBy: ";")
            var params: [String: String] = [:]
            for p in head.dropFirst() {
                guard let k = p.firstIndex(of: "="), k != p.startIndex else { continue }
                var v = String(p[p.index(after: k)...])
                if v.hasPrefix("\"") { v.removeFirst() }
                if v.hasSuffix("\"") { v.removeLast() }
                params[String(p[..<k]).uppercased()] = v
            }
            cur!.append(Prop(name: head[0].uppercased(), params: params, value: value))
        }
        return out
    }

    struct Dt { var y: Int, m: Int, d: Int, hh: Int, mm: Int, allDay: Bool }
    static let dtRe = try! NSRegularExpression(pattern: "^([0-9]{4})([0-9]{2})([0-9]{2})(?:T([0-9]{2})([0-9]{2})([0-9]{2})?(Z)?)?$")

    static func parseDt(_ value: String, _ params: [String: String], tz: TimeZone) -> Dt? {
        let s = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let ns = s as NSString
        guard let m = dtRe.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return nil }
        func g(_ i: Int) -> String? { let r = m.range(at: i); return r.location == NSNotFound ? nil : ns.substring(with: r) }
        let Y = Int(g(1)!)!, M = Int(g(2)!)! - 1, D = Int(g(3)!)!
        let allDay = params["VALUE"] == "DATE" || g(4) == nil
        if allDay { return Dt(y: Y, m: M, d: D, hh: 0, mm: 0, allDay: true) }
        let h = Int(g(4)!)!, mi = Int(g(5)!)!, sec = Int(g(6) ?? "0")!
        if g(7) != nil {
            // UTC。端末の時刻に直す
            var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
            var dc = DateComponents(); dc.year = Y; dc.month = M + 1; dc.day = D; dc.hour = h; dc.minute = mi; dc.second = sec
            guard let date = cal.date(from: dc) else { return nil }
            var lc = Calendar(identifier: .gregorian); lc.timeZone = tz
            let c = lc.dateComponents([.year, .month, .day, .hour, .minute], from: date)
            return Dt(y: c.year!, m: c.month! - 1, d: c.day!, hh: c.hour!, mm: c.minute!, allDay: false)
        }
        return Dt(y: Y, m: M, d: D, hh: h, mm: mi, allDay: false)
    }

    static let durRe = try! NSRegularExpression(pattern: "^-?P(?:([0-9]+)W)?(?:([0-9]+)D)?(?:T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?)?$")
    static func parseDuration(_ s: String) -> Int {
        let ns = s as NSString
        guard let m = durRe.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return 0 }
        func g(_ i: Int) -> Int { let r = m.range(at: i); return r.location == NSNotFound ? 0 : Int(ns.substring(with: r)) ?? 0 }
        return g(1) * 7 * 1440 + g(2) * 1440 + g(3) * 60 + g(4)
    }

    static let DOW: [String: Int] = ["SU": 0, "MO": 1, "TU": 2, "WE": 3, "TH": 4, "FR": 5, "SA": 6]
    static func dayKey(_ y: Int, _ m: Int, _ d: Int) -> String { "\(y)-\(m)-\(d)" }

    /// くり返し（RRULE）を実際の日に広げる（DAILY / WEEKLY（BYDAY）/ MONTHLY（同じ日）/ YEARLY、COUNT・UNTIL。終わりが無ければ1年先まで、多くても120回）
    static func expand(_ start: Dt, _ rrule: String, _ exdates: Set<String>, limitDay: Int, tz: TimeZone) -> [(Int, Int, Int)] {
        var r: [String: String] = [:]
        for p in rrule.components(separatedBy: ";") {
            guard let k = p.firstIndex(of: "="), k != p.startIndex else { continue }
            r[String(p[..<k]).uppercased()] = String(p[p.index(after: k)...]).uppercased()
        }
        let freq = r["FREQ"] ?? ""
        let iv = JS.truthy(r["INTERVAL"].map { .string($0) }) ? JS.number(r["INTERVAL"]!) : 1
        let interval = iv.isNaN ? 1 : max(1, Int(iv))
        guard ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].contains(freq) else { return [(start.y, start.m, start.d)] }
        let count: Double = JS.truthy(r["COUNT"].map { .string($0) }) ? JS.number(r["COUNT"]!) : .infinity
        let until = JS.truthy(r["UNTIL"].map { .string($0) }) ? parseDt(r["UNTIL"]!, [:], tz: tz) : nil
        let untilDay = until.map { Civil.dayNo($0.y, $0.m, $0.d) } ?? limitDay
        let byday: [Int]? = (freq == "WEEKLY" && JS.truthy(r["BYDAY"].map { .string($0) })) ? r["BYDAY"]!.components(separatedBy: ",").compactMap { DOW[String($0.suffix(2))] } : nil
        var out: [(Int, Int, Int)] = []
        let first = Civil.dayNo(start.y, start.m, start.d)
        let firstDow = Civil.weekday(start.y, start.m, start.d)
        var guardN = 0, done = false, seen = 0.0, i = 0
        while !done && guardN < 2000 {
            var cands: [Int] = []
            switch freq {
            case "WEEKLY":
                let base = first - firstDow + i * 7 * interval
                for dow in (byday ?? [firstDow]) { let t = base + dow; if t >= first { cands.append(t) } }
            case "DAILY":
                cands.append(first + i * interval)
            case "MONTHLY":
                let t = Civil.dayNo(start.y, start.m + i * interval, start.d)
                if Civil.fromDayNo(t).d == start.d { cands.append(t) }
            default:
                cands.append(Civil.dayNo(start.y + i * interval, start.m, start.d))
            }
            for t in cands.sorted() {
                if t > untilDay { done = true; break }
                seen += 1
                let c = Civil.fromDayNo(t)
                if !exdates.contains(dayKey(c.y, c.m, c.d)) { out.append((c.y, c.m, c.d)) }
                if seen >= count || out.count >= 120 { done = true; break }
            }
            if cands.isEmpty && freq != "MONTHLY" { break }
            i += 1; guardN += 1
        }
        return out.isEmpty ? [(start.y, start.m, start.d)] : out
    }

    /// .ics の文字列を、取り込みの一覧に渡せる形にする（today は端末の今日。終わりの無いくり返しは1年先まで）
    public static func parseIcs(_ text: String, today: (y: Int, m: Int, d: Int), tz: TimeZone) -> [JSONValue] {
        let limitDay = Civil.dayNo(today.y + 1, today.m, today.d)
        let evs = blocks(text)
        var overridden: [String: Set<String>] = [:]
        for ev in evs {
            guard let rid = ev.first(where: { $0.name == "RECURRENCE-ID" }), let uid = ev.first(where: { $0.name == "UID" }) else { continue }
            guard let d = parseDt(rid.value, rid.params, tz: tz) else { continue }
            overridden[uid.value, default: []].insert(dayKey(d.y, d.m, d.d))
        }
        struct Item { let y: Int, m: Int, d: Int; let start: String; let obj: JSONValue }
        var out: [Item] = []
        var k = 0
        for ev in evs {
            func get(_ n: String) -> Prop? { ev.first { $0.name == n } }
            func val(_ n: String) -> String { get(n)?.value ?? "" }
            guard let ds = get("DTSTART"), let start = parseDt(ds.value, ds.params, tz: tz) else { continue }
            let st = val("STATUS").uppercased()
            if st == "CANCELLED" { continue }
            var end: Dt? = get("DTEND").flatMap { parseDt($0.value, $0.params, tz: tz) }
            if end == nil, get("DURATION") != nil {
                let t = NotifyCore.LocalTime(start.y, start.m, start.d, start.hh, start.mm + parseDuration(val("DURATION")))
                end = Dt(y: t.y, m: t.m, d: t.d, hh: t.h, mm: t.min, allDay: start.allDay)
            }
            let t0 = unesc(val("SUMMARY")).trimmingCharacters(in: .whitespacesAndNewlines)
            let title = t0.isEmpty ? "無題" : t0
            let uid = val("UID").isEmpty ? "u\(k)" : val("UID")
            var exdates = overridden[uid] ?? []
            for ex in ev.filter({ $0.name == "EXDATE" }) {
                for v in ex.value.components(separatedBy: ",") { if let d = parseDt(v, ex.params, tz: tz) { exdates.insert(dayKey(d.y, d.m, d.d)) } }
            }
            let days = (get("RRULE") != nil && get("RECURRENCE-ID") == nil) ? expand(start, val("RRULE"), exdates, limitDay: limitDay, tz: tz) : [(start.y, start.m, start.d)]
            var span = 1
            if start.allDay, let end { span = max(1, min(60, Civil.dayNo(end.y, end.m, end.d) - Civil.dayNo(start.y, start.m, start.d))) }
            let sameDay = end.map { $0.y == start.y && $0.m == start.m && $0.d == start.d } ?? false
            let endHm = (!start.allDay && end != nil && sameDay) ? pad(end!.hh) + ":" + pad(end!.mm) : "23:59"
            for (y, m, d) in days {
                let s = start.allDay ? "00:00" : pad(start.hh) + ":" + pad(start.mm)
                let o: [String: JSONValue] = [
                    "srcId": .string("\(uid)#\(y)-\(m)-\(d)"), "title": .string(title), "y": .number(Double(y)), "m": .number(Double(m)), "day": .number(Double(d)),
                    "start": .string(s), "end": .string(start.allDay ? "23:59" : endHm), "allDay": .bool(start.allDay), "days": .number(Double(span)),
                    "tentative": .bool(st == "TENTATIVE"), "ltype": .string(val("X-LUKKO-TYPE")), "lstatus": .string(val("X-LUKKO-STATUS")),
                    "place": .string(unesc(val("LOCATION"))), "memo": .string(unesc(val("DESCRIPTION"))),
                ]
                out.append(Item(y: y, m: m, d: d, start: s, obj: .object(o)))
                k += 1
            }
        }
        return JS.stableSorted(out) { a, b in
            if a.y != b.y { return a.y - b.y }
            if a.m != b.m { return a.m - b.m }
            if a.d != b.d { return a.d - b.d }
            return a.start == b.start ? 0 : (a.start < b.start ? -1 : 1)
        }.map { $0.obj }
    }
}
