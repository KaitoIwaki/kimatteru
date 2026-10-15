import Foundation

/// 月表示の中身（Web 版 renderVals の buildWeeks・pillView・見出しの写し）。
/// 画面（SwiftUI）は、ここで決めた「何列目から何列・何段目・字・印・色」をそのまま描く。
/// 色は Web 版と同じ書き方（"rgb(…)"・"var(--ink)" など）で返し、画面の側で色にする
public enum MonthCore {
    public static let maxLanes = 4
    public static let barH = 15.0
    public static let barFS = 10.0
    static let fillSoft = 0.32
    static let darkCell = "#12151A"
    static let holidayRed = "var(--sun)"
    static let saturdayBlue = "var(--sat)"
    public static let somedayLabel = ["week": "今週のどこか", "month": "今月のどこか", "next": "来月あたり", "someday": "いつか"]

    public struct Slot: Equatable {
        public var day: Int, blank: Bool, color: String, today: Bool, todayBg: String?, bg: String, weight: Int
    }
    public struct Bar: Equatable {
        public var key: String, id: JSONValue, text: String, mark: String
        public var c0: Int, span: Int, lane: Int
        /// 帯の見た目（Web 版の style のうち、色と形を決める値）
        public var style: [String: JSONValue]
    }
    public struct More: Equatable { public var n: Int, col: Int }
    public struct Week: Equatable {
        public var slots: [Slot], bars: [Bar], more: [More]
        public var lanes: Int
    }
}

extension AppCore {
    // MARK: 色（Web 版の dark・softFill・softLine・paperShow・typeInk・inkDash・inkOn）

    /// 暗い画面か。"auto" は iPhone の設定（sysDark）に合わせる
    public func isDark(sysDark: Bool) -> Bool {
        let th = JS.truthy(settings["theme"]) ? JS.string(settings["theme"]) : (JS.truthy(settings["dark"]) ? "dark" : "light")
        if th == "auto" { return sysDark }
        return th == "dark"
    }
    static func rgb(_ l: [String]) -> String { "rgb(\(l[0]),\(l[1]),\(l[2]))" }
    public func softFill(_ hex: String, dark: Bool) -> String {
        Self.rgb(dark ? TypeDefs.mixHex(hex, MonthCore.darkCell, 0.76) : TypeDefs.mixHex(hex, "#ffffff", MonthCore.fillSoft))
    }
    public func softLine(_ hex: String, dark: Bool) -> String {
        Self.rgb(dark ? TypeDefs.mixHex(hex, "#ffffff", 0) : TypeDefs.mixHex(hex, "#ffffff", MonthCore.fillSoft * 0.5))
    }
    public func paperShow(_ paper: JSONValue?, dark: Bool) -> JSONValue { dark ? "transparent" : (paper ?? .null) }
    public func typeInk(_ t: [String: JSONValue], dark: Bool) -> JSONValue {
        if !dark { return t["dark"] ?? .null }
        return .string(Self.rgb(TypeDefs.mixHex(JS.string(t["color"]), "#ffffff", 0.45)))
    }
    public func inkDash(_ hex: String, dark: Bool) -> String {
        Self.rgb(dark ? TypeDefs.mixHex(hex, "#ffffff", 0.88) : TypeDefs.mixHex(hex, "#000000", 0.66))
    }
    public func inkOn(_ hex: String, dark: Bool) -> String {
        Self.rgb(dark ? TypeDefs.mixHex(hex, "#ffffff", 0.78) : TypeDefs.mixHex(hex, "#000000", 0.66))
    }
    /// 予定の字の倍率（設定の「予定の文字の大きさ」か、iPhone の文字の大きさ）
    public func evScale(sysZoom: Double = 1) -> Double {
        if case .number(let f)? = settings["fontScale"] { return max(1, min(1.4, f)) }
        return sysZoom
    }

    // MARK: 帯（Web 版の pillStyle・pillParts・segShape・pillView）

    public func pillStyle(_ ev: [String: JSONValue], dark: Bool) -> [String: JSONValue] {
        if JS.truthy(ev["overlay"]) {
            return ["height": 16, "background": "var(--bg2)", "color": "var(--ink-mut)", "borderLeft": "2px solid var(--ink-faint)"]
        }
        let t = T(ev["type"]) ?? [:]
        let hex = JS.string(t["color"])
        if JS.truthy(ev["ake"]) {
            return ["height": 16, "background": "transparent", "color": .string(inkDash(hex, dark: dark)), "borderBottom": .string("2px solid " + softLine(hex, dark: dark)), "opacity": 0.8]
        }
        switch ev["status"]?.string {
        case "kakutei": return ["height": 16, "background": .string(softFill(hex, dark: dark)), "color": .string(inkOn(hex, dark: dark))]
        case "mikakutei": return ["height": 17, "background": paperShow(t["paper"], dark: dark), "color": .string(inkDash(hex, dark: dark)),
                                  "border": .string("1.5px dashed " + softLine(hex, dark: dark)), "lineHeight": "13px"]
        case "jisseki": return ["height": 16, "background": .string(softFill(hex, dark: dark)), "color": .string(inkOn(hex, dark: dark)), "opacity": 0.92]
        default: return ["height": 16, "background": "transparent", "color": "#9AA0A6", "textDecoration": "line-through", "opacity": 0.5]
        }
    }

    /// マスが狭いので、印（？ ✓ 記号）と名前を分ける。compact（月のマス）では「？」を出さない
    public func pillParts(_ ev: [String: JSONValue], wageOn: Bool, compact: Bool) -> (mark: String, body: String) {
        var hh = ""
        if compact && JS.truthy(settings["barTime"]) && !JS.truthy(ev["allDay"]) && JS.truthy(ev["start"]) && !JS.truthy(ev["ake"]) {
            let s = JS.string(ev["start"])
            if s.hasSuffix(":00") {
                // JS：String(parseInt(start, 10))
                let digits = s.prefix { $0.isASCII && $0.isNumber }
                hh = (Int(digits).map { String($0) } ?? "NaN") + " "
            } else {
                hh = (s.hasPrefix("0") ? String(s.dropFirst()) : s) + " "
            }
        }
        let title = JS.string(ev["title"])
        if JS.truthy(ev["ake"]) { return ("", title) }
        if JS.truthy(ev["sym"]) && compact { return (JS.string(ev["sym"]), title) }
        if JS.truthy(ev["overlay"]) { return ("", hh + title) }
        switch ev["status"]?.string {
        case "mikakutei": return (compact ? (JS.truthy(settings["kariMark"]) ? "仮" : "") : "？", hh + title)
        case "jisseki":
            if wageOn && ev["type"] == "baito" { return ("", fmtWage(wage(ev))) }
            return ("✓", hh + title)
        default: return ("", hh + title)
        }
    }

    /// 月表示の帯 1 本の見た目。端だけ丸めて、続きがある側は切り落とす
    public func pillView(_ ev: [String: JSONValue], wageOn: Bool, startsHere: Bool, endsHere: Bool, dark: Bool, sysZoom: Double = 1) -> (text: String, mark: String, style: [String: JSONValue]) {
        let L = startsHere, R = endsHere
        let es = evScale(sysZoom: sysZoom)
        let H = JS.round(MonthCore.barH * es)
        var st = pillStyle(ev, dark: dark)
        st["marginLeft"] = .number(L ? 1 : 0)
        st["marginRight"] = .number(R ? 1 : 0)
        st["borderRadius"] = .string("\(L ? 3 : 0)px \(R ? 3 : 0)px \(R ? 3 : 0)px \(L ? 3 : 0)px")
        st["height"] = .number(H)
        st["lineHeight"] = .string(JS.numberToString(ev["status"] == "mikakutei" ? H - 3 : H) + "px")
        if st["border"] != nil {
            if !L { st["borderLeft"] = "none" }
            if !R { st["borderRight"] = "none" }
        }
        let p = pillParts(ev, wageOn: wageOn, compact: true)
        return (p.body, p.mark, st)
    }

    // MARK: 週ごとの組み立て（Web 版の buildWeeks）

    /// Y 年 M 月の週。日をまたぐ予定は、週の中で列をまたぐ 1 本の帯にする。入らない予定は「+N件」
    public func buildWeeks(_ Y: Int, _ M: Int, lanes lanesN: Int = MonthCore.maxLanes, overlay: [[String: JSONValue]] = [], wageOn: Bool, dark: Bool, sysZoom: Double = 1) -> [MonthCore.Week] {
        let ws = JS.number(settings["weekStart"])
        guard ws.isFinite else { return [] }
        let wFirst = Civil.weekday(Y, M, 1), dim = Civil.daysInMonth(Y, M)
        let t = state["today"]
        let today = (t?["y"] == .number(Double(Y)) && t?["m"] == .number(Double(M))) ? JS.int(t?["d"]) : 0
        let first = ((wFirst - Int(ws)) % 7 + 7 + 7) % 7
        let weekCount = Int((Double(first + dim) / 7).rounded(.up))
        let monthA = Civil.dayNo(Y, M, 1), monthB = Civil.dayNo(Y, M, dim)
        let hideCanceled = JS.truthy(settings["hideCanceled"])
        var pool = events.filter { e in !(hideCanceled && e["status"] == "nakunatta") && Self.evTo(e) >= monthA && Self.evFrom(e) <= monthB }
        pool += overlay
        var weeks: [MonthCore.Week] = []
        for w in 0..<weekCount {
            let slotDays: [Int?] = (0..<7).map { i in let d = w * 7 + i - first + 1; return (d >= 1 && d <= dim) ? d : nil }
            let real = slotDays.compactMap { $0 }
            let weekA = Civil.dayNo(Y, M, real.first!), weekB = Civil.dayNo(Y, M, real.last!)
            func colOf(_ n: Int) -> Int { (n - monthA) + first - w * 7 }
            let inWeek = JS.stableSorted(pool.filter { Self.evTo($0) >= weekA && Self.evFrom($0) <= weekB }) { a, b in
                let d1 = Double(Self.evSpan(b) - Self.evSpan(a)); if d1 != 0 { return JS.sign(d1) }
                let d2 = Double(Self.evFrom(a) - Self.evFrom(b)); if d2 != 0 { return JS.sign(d2) }
                let d3 = mins(JS.string(a["start"])) - mins(JS.string(b["start"])); if JS.truthy(.number(d3)) { return JS.sign(d3) }
                return Self.localeCompare(JS.string(a["id"]), JS.string(b["id"]))
            }
            var lanes: [[(Int, Int)]] = []
            var bars: [MonthCore.Bar] = []
            var overflow: [Int: Int] = [:]
            for ev in inWeek {
                let a = max(Self.evFrom(ev), weekA), b = min(Self.evTo(ev), weekB)
                var li = 0
                while li < lanes.count && lanes[li].contains(where: { a <= $0.1 && b >= $0.0 }) { li += 1 }
                if li >= lanesN { for n in a...max(a, b) where n <= b { overflow[n, default: 0] += 1 }; continue }
                if li == lanes.count { lanes.append([]) }
                lanes[li].append((a, b))
                let c0 = colOf(a), c1 = colOf(b)
                let v = pillView(ev, wageOn: wageOn, startsHere: a == Self.evFrom(ev), endsHere: b == Self.evTo(ev), dark: dark, sysZoom: sysZoom)
                bars.append(.init(key: JS.string(ev["id"]) + "-\(w)", id: ev["id"] ?? .null, text: v.text, mark: v.mark, c0: c0, span: c1 - c0 + 1, lane: li, style: v.style))
            }
            let slots: [MonthCore.Slot] = slotDays.enumerated().map { i, d in
                guard let d else {
                    let out = Civil.fromDayNo(monthA + (w * 7 + i - first))
                    return .init(day: out.d, blank: true, color: "var(--ink-faint)", today: false, todayBg: nil, bg: "var(--card)", weight: 500)
                }
                let dow = (wFirst + d - 1) % 7, isToday = d == today
                let hol = Holidays.name(Y, M, d)
                let dayColor = (hol != nil || dow == 0) ? MonthCore.holidayRed : dow == 6 ? MonthCore.saturdayBlue : "var(--ink)"
                if isToday { return .init(day: d, blank: false, color: "var(--card)", today: true, todayBg: dayColor, bg: "var(--today-bg)", weight: 700) }
                return .init(day: d, blank: false, color: dayColor, today: false, todayBg: nil, bg: "var(--card)", weight: (hol != nil || dow == 0 || dow == 6) ? 600 : 500)
            }
            let more = overflow.keys.sorted().map { MonthCore.More(n: overflow[$0]!, col: colOf($0)) }
            weeks.append(.init(slots: slots, bars: bars, more: more, lanes: lanesN))
        }
        return weeks
    }

    /// JS の localeCompare（予定の番号どうし。日本語の並びの決まりで比べる）
    static func localeCompare(_ a: String, _ b: String) -> Int {
        switch a.compare(b, options: [], range: nil, locale: Locale(identifier: "ja_JP")) {
        case .orderedAscending: return -1
        case .orderedDescending: return 1
        case .orderedSame: return 0
        }
    }
}

/// 月表示の見出しの段（まだの数・日にち未定の棚・ベルの数・今日へ戻る・曜日）
public struct MonthHead: Equatable {
    public var monthLabel: String, year: String, todayBtnShown: Bool
    public var undecidedCount: Int, shelfCount: Int, shelfLabel: String
    public var bellCount: Int, bellBadge: String
    public var weekdays: [(label: String, color: String)]
    public var stampChipShown: Bool, wageToggleShown: Bool, calView: String
    public static func == (a: MonthHead, b: MonthHead) -> Bool {
        a.monthLabel == b.monthLabel && a.year == b.year && a.todayBtnShown == b.todayBtnShown && a.undecidedCount == b.undecidedCount
            && a.shelfCount == b.shelfCount && a.shelfLabel == b.shelfLabel && a.bellCount == b.bellCount && a.bellBadge == b.bellBadge
            && a.weekdays.map { [$0.label, $0.color] } == b.weekdays.map { [$0.label, $0.color] }
            && a.stampChipShown == b.stampChipShown && a.wageToggleShown == b.wageToggleShown && a.calView == b.calView
    }
}

extension Engine {
    /// 給料の機能を出すか（勤務先があるか、バイトの記録があるとき。設定で on/off もできる）
    public func wageFeatureOn() -> Bool {
        let f = settings["wageFeature"]
        if f == "off" { return false }
        if f == "on" { return true }
        return jobsList.contains { !JS.truthy($0["retired"]) } || events.contains { $0["type"] == "baito" && $0["status"] == "jisseki" }
    }

    public func monthHead() -> MonthHead {
        let ym = state["ym"]?.object ?? [:], t = today
        let ymY = JS.int(ym["y"]), ymM = JS.int(ym["m"])
        let todayN = Civil.dayNo(t.y, t.m, t.d)
        let und = events.filter { $0["status"] != "nakunatta" && $0["status"] == "mikakutei" }
        let someday = (state["someday"]?.array ?? []).compactMap { $0.object }
        let undecided = und.filter { AppCore.evTo($0) >= todayN }.count + someday.count
        let shelf = someday.filter { it in
            if it["when"] == "someday" { return ymY == t.y && ymM == t.m }
            let base = it["when"] == "next" ? Self.shiftMonth(["y": it["y"] ?? .null, "m": it["m"] ?? .null], 1) : JSONValue.object(["y": it["y"] ?? .null, "m": it["m"] ?? .null])
            return base["y"] == ym["y"] && base["m"] == ym["m"]
        }
        let shelfLabel = shelf.isEmpty ? "" : (shelf.count == 1 ? "\(MonthCore.somedayLabel[JS.string(shelf[0]["when"])] ?? "undefined")：\(JS.string(shelf[0]["title"]))" : "日にち未定 \(shelf.count)件")
        let unread = NoticesCore.unreadCount(state["notices"]?.array ?? [])
        let ws = JS.int(settings["weekStart"])
        let wl = ["日", "月", "火", "水", "木", "金", "土"]
        let weekdays: [(String, String)] = (0..<7).map { i in
            let dw = (i + ws) % 7
            return (wl[dw], dw == 0 ? MonthCore.holidayRed : dw == 6 ? MonthCore.saturdayBlue : "#9AA0A6")
        }
        return MonthHead(monthLabel: JS.string(.number(JS.number(ym["m"]) + 1)), year: JS.string(ym["y"]),
                         todayBtnShown: !(ymY == t.y && ymM == t.m),
                         undecidedCount: undecided, shelfCount: shelf.count, shelfLabel: shelfLabel,
                         bellCount: unread, bellBadge: unread > 9 ? "9+" : String(unread),
                         weekdays: weekdays.map { (label: $0.0, color: $0.1) },
                         stampChipShown: !stampTemplates().isEmpty && state["screen"] == "month",
                         wageToggleShown: wageFeatureOn(),
                         calView: settings["calView"] == "week" ? "week" : "month")
    }
}
