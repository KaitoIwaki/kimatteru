import Foundation

/// 週表示と日の「時間」表示の並べ方（Web 版 app/src/timegrid.js の写し）
public enum TimeGrid {
    public typealias Ev = [String: JSONValue]

    public struct Seg: Equatable {
        public let ev: Ev
        public let a: Double
        public var b: Double
        public let cont: Bool
        public var col: Int = 0
        public var cols: Int = 0
        public var id: String { JS.string(ev["id"]) }
    }

    /// timegrid.js の toMin は String(t || '0:0')
    public static func toMin(_ t: JSONValue?) -> Double {
        let v = JS.truthy(t) ? t : .string("0:0")
        let parts = JS.string(v).components(separatedBy: ":")
        let h = JS.orZero(JS.number(parts[0]))
        let m = parts.count > 1 ? JS.orZero(JS.number(parts[1])) : 0
        return h * 60 + m
    }

    private static func dayNoOf(_ e: Ev) -> Int {
        Civil.dayNo(JS.int(e["y"]), JS.int(e["m"]), JS.int(e["day"]))
    }
    private static func span(_ e: Ev) -> Int {
        let v = Int(JS.toInt32(e["days"]))
        return max(1, min(60, v != 0 ? v : 1))
    }

    /// 1日ぶんの、時刻のある予定の区間（日をまたぐ予定は、次の日に 0:00 からの続きとして出す）
    public static func segmentsForDay(_ events: [Ev], _ y: Int, _ m: Int, _ d: Int) -> [Seg] {
        let n = Civil.dayNo(y, m, d)
        var out: [Seg] = []
        for e in events {
            if JS.truthy(e["allDay"]) { continue }
            let start = toMin(e["start"])
            let end = toMin(JS.string(e["status"]) == "jisseki" ? JS.or(e["actualEnd"], e["end"]) : e["end"])
            let f = dayNoOf(e)
            let wraps = end <= start && end != start
            let same = end == start
            if f == n { out.append(Seg(ev: e, a: start, b: wraps || same ? 1440 : end, cont: false)) }
            else if (wraps || same) && f == n - 1 && (same ? start : end) > 0 { out.append(Seg(ev: e, a: 0, b: same ? start : end, cont: true)) }
        }
        return out
    }

    /// 重なった箱を横に並べる（かたまりごとに列の数を決め、空いている左の列から詰める）
    public static func layoutColumns(_ segs: [Seg]) -> [Seg] {
        let list = JS.stableSorted(segs.map { s -> Seg in var t = s; t.b = max(s.b, s.a + 15); return t }) { x, y in
            if x.a != y.a { return x.a < y.a ? -1 : 1 }
            if x.b != y.b { return y.b < x.b ? -1 : 1 }
            return 0
        }
        var out: [Seg] = []
        var group: [Seg] = []
        var groupEnd: Double = -1
        func flush() {
            var cols: [Double] = []
            for i in group.indices {
                var c = 0
                while c < cols.count && cols[c] > group[i].a { c += 1 }
                if c < cols.count { cols[c] = group[i].b } else { cols.append(group[i].b) }
                group[i].col = c
            }
            for i in group.indices { group[i].cols = cols.count }
            out.append(contentsOf: group)
            group = []
        }
        for s in list {
            if !group.isEmpty && s.a >= groupEnd { flush(); groupEnd = -1 }
            group.append(s)
            groupEnd = max(groupEnd, s.b)
        }
        if !group.isEmpty { flush() }
        return out
    }

    /// その日にかかる終日の予定（何日も続くものも）
    public static func allDayFor(_ events: [Ev], _ y: Int, _ m: Int, _ d: Int) -> [Ev] {
        let n = Civil.dayNo(y, m, d)
        return events.filter { e in
            JS.truthy(e["allDay"]) && dayNoOf(e) <= n && dayNoOf(e) + span(e) - 1 >= n
        }
    }

    /// 週のはじまりの日番号（weekStart は 0=日曜 1=月曜）
    public static func weekStartNo(_ y: Int, _ m: Int, _ d: Int, _ weekStart: Int) -> Int {
        let dow = Civil.weekday(y, m, d)
        return Civil.dayNo(y, m, d) - ((dow - weekStart + 7) % 7)
    }
}
