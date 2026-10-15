import Foundation

/// 日の画面の中身（Web 版 renderVals の DAY・_timeGridBoxes・_timeGridAllDay・statusWord の写し）
public enum DayCore {
    public struct Head: Equatable {
        public var title: String, titleColor: String, holiday: String
        public var bigDate: String, dowFull: String, dateColor: String
        public var summary: String, empty: Bool, view: String
    }
    public struct Row: Equatable {
        public var key: JSONValue
        public var startText: String, endText: String, timeText: String
        public var accent: String, dashed: Bool
        public var titleText: String, titlePlain: String, place: String, statusWord: String
        public var durText: String?, gapBefore: String?
        /// 状態の札（まだ＝点線、無くなった＝灰、ほか＝塗り）
        public var chip: [String: JSONValue]
        public var cardBorder: String, titleColor: String, titleDeco: String, titleSize: Double
        /// 種類の色の縦棒（まだのときは nil。点線の棒を描く）
        public var bar: String?
        public var nakunatta: Bool
    }
    public struct StripCell: Equatable {
        public var key: String, dow: String, date: Int, sel: Bool, today: Bool, has: Bool
        public var monthHead: String, monthFull: String, dowColor: String, numColor: String
        public var n: Int
    }
    public struct Box: Equatable {
        public var key: String, a: Double, b: Double, title: String, time: String
        public var style: [String: JSONValue]
        public var ev: [String: JSONValue]
        public var col: Int, cols: Int
    }
    public struct AllDay: Equatable {
        public var more: Int
        public var pills: [(key: JSONValue, title: String, style: [String: JSONValue], ev: [String: JSONValue])]
        public static func == (a: AllDay, b: AllDay) -> Bool {
            a.more == b.more && a.pills.map { [$0.key, .string($0.title), .object($0.style)] } == b.pills.map { [$0.key, .string($0.title), .object($0.style)] }
        }
    }
    public static let hourH = 44.0
    static let dowFull = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"]
    static let wl = ["日", "月", "火", "水", "木", "金", "土"]
}

extension AppCore {
    /// 状態の言葉（まだ＝種類の uWord、実績＝「実績」、無くなった＝種類の gone か「無くなった」、確定＝cWord）
    public func statusWord(_ ev: [String: JSONValue]) -> String {
        let t = T(ev["type"]) ?? [:]
        switch ev["status"]?.string {
        case "mikakutei": return JS.string(t["uWord"])
        case "jisseki": return "実績"
        case "nakunatta": return JS.string(JS.or(t["gone"], "無くなった"))
        default: return JS.string(t["cWord"])
        }
    }

    func dayColor(_ y: Int, _ m: Int, _ d: Int) -> String {
        let dw = Civil.weekday(y, m, d)
        return (Holidays.name(y, m, d) != nil || dw == 0) ? "var(--sun)" : dw == 6 ? "var(--sat)" : "var(--ink)"
    }

    /// その日の予定（日をまたぐ予定も、覆っている日すべてに出す）。並びは 終日 → 長い → その日始まりでない → 開始時刻
    public func dayEvents(_ Y: Int, _ M: Int, _ d: Int) -> [[String: JSONValue]] {
        let dn = Civil.dayNo(Y, M, d)
        let hide = JS.truthy(settings["hideCanceled"])
        let evs = events.filter { covers($0, dn) && !(hide && $0["status"] == "nakunatta") }
        return JS.stableSorted(evs) { a, b in
            let d1 = (JS.truthy(b["allDay"]) ? 1 : 0) - (JS.truthy(a["allDay"]) ? 1 : 0); if d1 != 0 { return d1 < 0 ? -1 : 1 }
            let d2 = Self.evSpan(b) - Self.evSpan(a); if d2 != 0 { return d2 < 0 ? -1 : 1 }
            let d3 = (Self.evFrom(a) == dn ? 1 : 0) - (Self.evFrom(b) == dn ? 1 : 0); if d3 != 0 { return d3 < 0 ? -1 : 1 }
            return JS.sign(mins(JS.string(a["start"])) - mins(JS.string(b["start"])))
        }
    }

    /// 日の画面の見出しと一覧
    public func dayView(_ Y: Int, _ M: Int, _ d: Int, dark: Bool, sysZoom: Double = 1) -> (head: DayCore.Head, rows: [DayCore.Row]) {
        let dow = Civil.weekday(Y, M, d)
        let hol = Holidays.name(Y, M, d)
        let color = dayColor(Y, M, d)
        let dn = Civil.dayNo(Y, M, d)
        let evs = dayEvents(Y, M, d)
        let und = evs.filter { $0["status"] == "mikakutei" }.count
        let view = settings["dayView"] == "time" ? "time" : "list"
        let head = DayCore.Head(title: "\(M + 1)月\(d)日（\(DayCore.wl[dow])）", titleColor: color, holiday: hol ?? "",
                                bigDate: "\(M + 1)月\(d)日", dowFull: DayCore.dowFull[dow], dateColor: color,
                                summary: evs.isEmpty ? "" : "予定 \(evs.count)件" + (und > 0 ? "・まだ \(und)件" : ""), empty: evs.isEmpty, view: view)
        let es = evScale(sysZoom: sysZoom)
        // 予定と予定のあいだの空き時間（一覧のとき）。「14:00〜16:00 空き」
        var gaps: [String: String] = [:]
        if view == "list" {
            let timed = evs.filter { !JS.truthy($0["allDay"]) && $0["status"] != "nakunatta" && Self.evFrom($0) == dn }
                .map { (mins(JS.string($0["start"])), WhenLib.busyEndMin($0)) }
            let sorted = JS.stableSorted(timed) { a, b in JS.sign(a.0 - b.0) }
            var cur: Double? = nil
            for (a, b) in sorted {
                if let c = cur, a - c >= 60 { gaps[JS.numberToString(a)] = "\(fmtMin(c))〜\(fmtMin(a)) 空き" }
                cur = cur == nil ? b : jsMax(cur!, b)
            }
        }
        let rows: [DayCore.Row] = evs.map { ev in
            let t = T(ev["type"]) ?? [:]
            let hex = JS.string(t["color"])
            let isJ = ev["status"] == "jisseki"
            let endShown = JS.string(isJ ? JS.or(ev["actualEnd"], ev["end"]) : ev["end"])
            let allDay = JS.truthy(ev["allDay"])
            let span = Self.evSpan(ev)
            let cont = !allDay && Self.evFrom(ev) != dn
            let st = ev["status"]?.string
            let nak = st == "nakunatta"
            var dur: String? = nil
            if !allDay {
                var m = mins(endShown) - mins(JS.string(ev["start"]))
                if m <= 0 { m += 1440 }
                dur = fmtHours(m / 60)
            }
            let chip: [String: JSONValue] = st == "mikakutei"
                ? ["border": .string("1px dashed " + softLine(hex, dark: dark)), "color": .string(inkDash(hex, dark: dark)), "background": paperShow(t["paper"], dark: dark)]
                : nak ? ["background": "var(--bg2)", "color": "var(--ink-faint)"]
                : ["background": .string(softFill(hex, dark: dark)), "color": .string(inkOn(hex, dark: dark))]
            var gap: String? = nil
            if !allDay && Self.evFrom(ev) == dn { gap = gaps[JS.numberToString(mins(JS.string(ev["start"])))] }
            let accent = nak ? "var(--line)" : hex
            return DayCore.Row(
                key: ev["id"] ?? .null,
                startText: allDay ? "終日" : (cont ? "〜" : JS.string(ev["start"])),
                endText: allDay ? (span > 1 ? spanLabel(ev) : "") : endShown,
                timeText: allDay ? (span > 1 ? spanLabel(ev) + "（終日）" : "終日") : JS.string(ev["start"]) + "–" + endShown,
                accent: accent, dashed: st == "mikakutei",
                titleText: (st == "mikakutei" ? "？" : isJ ? "✓" : "") + JS.string(ev["title"]),
                titlePlain: JS.string(ev["title"]),
                place: JS.truthy(ev["place"]) ? JS.string(ev["place"]) : (JS.truthy(ev["link"]) ? "Web会議" : ""),
                statusWord: statusWord(ev), durText: dur, gapBefore: gap, chip: chip,
                cardBorder: st == "mikakutei" ? "1.5px dashed " + softLine(hex, dark: dark) : "1px solid var(--line)",
                titleColor: nak ? "var(--ink-faint)" : "var(--ink)", titleDeco: nak ? "line-through" : "none",
                titleSize: JS.round(15 * es), bar: st == "mikakutei" ? nil : accent, nakunatta: nak)
        }
        return (head, rows)
    }
    func jsMax(_ a: Double, _ b: Double) -> Double { (a.isNaN || b.isNaN) ? .nan : max(a, b) }

    /// 日付の帯の 1 日（押すとその日へ。予定のある日に点）
    public func dayStripCell(_ n: Int, selected dn: Int) -> DayCore.StripCell {
        let o = Civil.fromDayNo(n)
        let dw = Civil.weekday(o.y, o.m, o.d)
        let hol = Holidays.name(o.y, o.m, o.d)
        let t = state["today"]
        let tN = Civil.dayNo(Int(JS.number(t?["y"])), Int(JS.number(t?["m"])), Int(JS.number(t?["d"])))
        let has = events.contains { covers($0, n) && $0["status"] != "nakunatta" }
        let sel = n == dn
        let red = hol != nil || dw == 0
        return DayCore.StripCell(key: String(n), dow: DayCore.wl[dw], date: o.d, sel: sel, today: n == tN, has: has,
                                 monthHead: o.d == 1 ? "\(o.m + 1)月" : "",
                                 monthFull: (t?["y"] != .number(Double(o.y)) ? "\(o.y)年" : "") + "\(o.m + 1)月",
                                 dowColor: red ? "var(--sun)" : dw == 6 ? "var(--sat)" : "var(--ink-faint)",
                                 numColor: sel ? "var(--card)" : red ? "var(--sun)" : dw == 6 ? "var(--sat)" : "var(--ink)", n: n)
    }

    // MARK: 時刻の目盛りの上の箱（週表示と、日の「時間」表示）

    public func timeGridBoxes(_ pool: [[String: JSONValue]], over: [[String: JSONValue]], _ y: Int, _ m: Int, _ d: Int, dark: Bool, sysZoom: Double = 1) -> [DayCore.Box] {
        let H = DayCore.hourH, es = evScale(sysZoom: sysZoom)
        let segs = TimeGrid.segmentsForDay(pool, y, m, d) + TimeGrid.segmentsForDay(over, y, m, d)
        return TimeGrid.layoutColumns(segs).enumerated().map { i, sg in
            let e = sg.ev, ov = JS.truthy(e["overlay"])
            let t = ov ? [:] : (T(e["type"]) ?? [:])
            let hex = JS.string(t["color"])
            let h = max(16, (sg.b - sg.a) / 60 * H - 2)
            var st: [String: JSONValue] = [
                "top": .number(sg.a / 60 * H + 1), "height": .number(h),
                "left": .string("calc(\(Self.fixed3(Double(sg.col) / Double(sg.cols) * 100))% + 1px)"),
                "width": .string("calc(\(Self.fixed3(100 / Double(sg.cols)))% - 2px)"),
                "fontSize": .number(Self.fixed1(10.5 * es)), "lineHeight": .string(JS.numberToString(JS.round(13 * es)) + "px"),
            ]
            if ov { st["background"] = "var(--bg2)"; st["color"] = "var(--ink-mut)"; st["borderLeft"] = "2.5px solid var(--ink-faint)" }
            else if e["status"] == "mikakutei" { st["background"] = paperShow(t["paper"], dark: dark); st["color"] = .string(inkDash(hex, dark: dark)); st["border"] = .string("1.5px dashed " + softLine(hex, dark: dark)) }
            else if e["status"] == "nakunatta" { st["background"] = "transparent"; st["color"] = "var(--ink-faint)"; st["textDecoration"] = "line-through"; st["border"] = "1px solid var(--line)" }
            else { st["background"] = .string(softFill(hex, dark: dark)); st["color"] = .string(inkOn(hex, dark: dark)) }
            let end = JS.string(e["status"] == "jisseki" ? JS.or(e["actualEnd"], e["end"]) : e["end"])
            let key = (JS.truthy(e["id"]) ? JS.string(e["id"]) : "o\(i)") + (sg.cont ? "-c" : "")
            return DayCore.Box(key: key, a: sg.a, b: sg.b, title: (sg.cont ? "↳ " : "") + JS.string(JS.or(e["title"], "")),
                               time: h >= 28 * es ? JS.string(e["start"]) + "–" + end : "", style: st, ev: e, col: sg.col, cols: sg.cols)
        }
    }
    public func timeGridAllDay(_ pool: [[String: JSONValue]], _ y: Int, _ m: Int, _ d: Int, dark: Bool, sysZoom: Double = 1) -> DayCore.AllDay {
        let list = TimeGrid.allDayFor(pool, y, m, d)
        let es = evScale(sysZoom: sysZoom)
        let pills = list.prefix(2).map { e -> (key: JSONValue, title: String, style: [String: JSONValue], ev: [String: JSONValue]) in
            let t = T(e["type"]) ?? [:]
            let hex = JS.string(t["color"])
            let lh = JS.round(15 * es)
            var st: [String: JSONValue] = ["fontSize": .number(Self.fixed1(10 * es)), "lineHeight": .string(JS.numberToString(lh) + "px"), "height": .number(JS.round(17 * es))]
            if e["status"] == "mikakutei" {
                st["background"] = paperShow(t["paper"], dark: dark); st["color"] = .string(inkDash(hex, dark: dark))
                st["border"] = .string("1.3px dashed " + softLine(hex, dark: dark)); st["lineHeight"] = .string(JS.numberToString(lh - 2) + "px")
            } else {
                st["background"] = .string(softFill(hex, dark: dark)); st["color"] = .string(inkOn(hex, dark: dark))
            }
            return (e["id"] ?? .null, JS.string(e["title"]), st, e)
        }
        return DayCore.AllDay(more: max(0, list.count - 2), pills: Array(pills))
    }

    /// JS の (x).toFixed(3)
    static func fixed3(_ x: Double) -> String { String(format: "%.3f", x) }
    /// JS の +(x).toFixed(1)
    static func fixed1(_ x: Double) -> Double { Double(String(format: "%.1f", x)) ?? x }
}
