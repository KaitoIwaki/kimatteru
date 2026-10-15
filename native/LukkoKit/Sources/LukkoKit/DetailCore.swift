import Foundation

/// 予定の詳細と「どうなった？」の小窓の中身（Web 版 renderVals の DETAIL・DIALOG と eventctx.js・linkify の写し）
public struct DetailView: Equatable {
    public struct Part: Equatable { public var t: String; public var href: String? }
    public struct MenuRow: Equatable { public var key: String; public var label: String; public var red: Bool }
    public struct Other: Equatable { public var id: JSONValue; public var title: String; public var when: String; public var pill: [String: JSONValue] }
    public struct Hist: Equatable { public var year: String, month: String, prev: String, ago: String }

    public var title = "", typeDark = "", dateText = "", holText = "", movedText = ""
    public var statusLabel = "", badgeChar = "", badgeBg = "", badgeColor = "", badgeBorder = ""
    public var timeText = "", spanText = "", remindText = ""
    public var place = "", placeHref = "", memo = ""
    public var memoParts: [Part] = []
    public var link = "", linkLabel = ""
    public var candText = "", timeChanged = false, wantText = ""
    public var wageShown = false, workHours = "", wage = "", breakText = ""
    /// 主ボタン（nil なら出さない）と、その動き（"restore" / "worked" / "confirm"）
    public var primaryLabel: String? = nil, primaryAction = ""
    public var primaryBg = "", primaryColor = "", primaryBorder = ""
    public var menuRows: [MenuRow] = []
    public var othersLabel = "", othersRest = 0
    public var others: [Other] = []
    public var histLabel = ""
    public var hist: Hist? = nil
}

public struct DialogView: Equatable {
    public struct Cell: Equatable { public var day: Int?; public var orig: Bool; public var sel: Bool; public var color: String; public var bg: String; public var weight: Int }
    public var heading = "", goneLabel = "", maybeLabel = "", sub = ""
    public var start = "", end = "", startOpen = false, endOpen = false, openColor = ""
    public var changed = false, origText = "", primaryLabel = "", primaryBg = ""
    public var breakShown = false
    public var breakChips: [(val: Int, label: String, sel: Bool)] = []
    public var paidText = ""
    public var moveShown = false, moving = false
    public var moveLabel = "", moveTitle = "", moveChosen = false, moveChosenText = ""
    public var moveWeekdays: [(label: String, color: String)] = []
    public var moveCells: [Cell] = []
    public var editLabel = "", typeColor = ""
    public static func == (a: DialogView, b: DialogView) -> Bool {
        a.heading == b.heading && a.goneLabel == b.goneLabel && a.maybeLabel == b.maybeLabel && a.sub == b.sub && a.start == b.start && a.end == b.end
            && a.changed == b.changed && a.origText == b.origText && a.primaryLabel == b.primaryLabel && a.primaryBg == b.primaryBg && a.paidText == b.paidText
            && a.moving == b.moving && a.moveCells == b.moveCells && a.moveChosenText == b.moveChosenText && a.editLabel == b.editLabel
    }
}

public enum EventCtx {
    public typealias Ev = [String: JSONValue]
    static func norm(_ v: JSONValue?) -> String { (v == nil || v == .null) ? "" : JS.string(v).jsTrimmed }
    public static func sameKind(_ a: Ev?, _ b: Ev?) -> Bool { guard let a, let b else { return false }; return a["type"] == b["type"] && norm(a["title"]) == norm(b["title"]) }
    static func alive(_ e: Ev) -> Bool { e["status"] != "nakunatta" }
    /// JS の文字の大小（UTF-16 の単位で比べる）。undefined どうしなどは「どちらでもない」
    static func lt(_ a: JSONValue?, _ b: JSONValue?) -> Bool {
        if case .string(let x)? = a, case .string(let y)? = b { return x.utf16.lexicographicallyPrecedes(y.utf16) }
        let x = a.map { JS.number($0) } ?? .nan, y = b.map { JS.number($0) } ?? .nan
        return x < y   // NaN（undefined など）は、どちらでもない
    }
    static func byTime(_ x: Ev, _ y: Ev) -> Int {
        let ax: JSONValue = JS.truthy(x["allDay"]) ? "" : (JS.or(x["start"], "") ?? "")
        let ay: JSONValue = JS.truthy(y["allDay"]) ? "" : (JS.or(y["start"], "") ?? "")
        if ax != ay { return lt(ax, ay) ? -1 : 1 }
        if x["title"] != y["title"] { return lt(x["title"], y["title"]) ? -1 : 1 }
        return lt(x["id"], y["id"]) ? -1 : (lt(y["id"], x["id"]) ? 1 : 0)
    }
    static func byDate(_ x: Ev, _ y: Ev) -> Int {
        let d = AppCore.evFrom(x) - AppCore.evFrom(y)
        return d != 0 ? (d < 0 ? -1 : 1) : byTime(x, y)
    }
    /// この予定が何回目か（先の予定は数えない）。はじめてなら nil
    public static func historyFor(_ events: [Ev], _ ev: Ev) -> (yearNth: Int, monthNth: Int, prev: Ev, daysAgo: Int)? {
        let mine = JS.stableSorted(events.filter { alive($0) && sameKind($0, ev) }, byDate)
        guard let i = mine.firstIndex(where: { $0["id"] == ev["id"] }) else { return nil }
        let upto = Array(mine[0...i]), before = Array(mine[0..<i])
        guard let prev = before.last else { return nil }
        return (upto.filter { $0["y"] == ev["y"] }.count, upto.filter { $0["y"] == ev["y"] && $0["m"] == ev["m"] }.count, prev, AppCore.evFrom(ev) - AppCore.evFrom(prev))
    }
    /// その日の、ほかの予定（多すぎるぶんは数だけ）
    public static func othersOnDay(_ events: [Ev], _ ev: Ev, limit: Int = 3) -> (list: [Ev], rest: Int) {
        let n = AppCore.evFrom(ev)
        let all = JS.stableSorted(events.filter { alive($0) && $0["id"] != ev["id"] && AppCore.evFrom($0) <= n && AppCore.evTo($0) >= n }, byTime)
        return (Array(all.prefix(limit)), max(0, all.count - limit))
    }
    public static func agoText(_ days: Int) -> String {
        let n = days
        if n <= 0 { return "同じ日" }
        if n == 1 { return "前の日" }
        if n < 45 { return "\(n)日前" }
        if n < 365 { return JS.numberToString(JS.round(Double(n) / 30.4)) + "か月前" }
        return JS.numberToString(JS.round(Double(n) / 365)) + "年前"
    }
    static let linkRe = try! NSRegularExpression(pattern: "(https?://[^\\s　]+)|((?:0\\d{1,4}-\\d{1,4}-\\d{3,4})|(?:0[5789]0\\d{8})|(?:0\\d{9}))")
    /// 文の中の URL と電話番号を、押せるかたまりに分ける
    public static func linkify(_ text: String) -> [DetailView.Part] {
        let s = text as NSString
        var out: [DetailView.Part] = []
        var last = 0
        for m in linkRe.matches(in: text, range: NSRange(location: 0, length: s.length)) {
            if m.range.location > last { out.append(.init(t: s.substring(with: NSRange(location: last, length: m.range.location - last)), href: nil)) }
            if m.range(at: 1).location != NSNotFound {
                let u = s.substring(with: m.range(at: 1)); out.append(.init(t: u, href: u))
            } else {
                let tel = s.substring(with: m.range(at: 2)); out.append(.init(t: tel, href: "tel:" + tel.replacingOccurrences(of: "-", with: "")))
            }
            last = m.range.location + m.range.length
        }
        if last < s.length { out.append(.init(t: s.substring(from: last), href: nil)) }
        return out
    }
}

extension Engine {
    static let dw = ["日", "月", "火", "水", "木", "金", "土"]

    public func detailEvent() -> Obj? { events.first { $0["id"] == state["detailId"] } }

    public func detailView(sysDark: Bool = false) -> DetailView {
        var v = DetailView()
        guard let ev = detailEvent() else { return v }
        let c = core()
        let t = c.T(ev["type"]) ?? [:]
        let tt = today
        v.title = JS.string(ev["title"])
        v.typeDark = JS.string(c.typeInk(t, dark: c.isDark(sysDark: sysDark)))
        func one(_ y: Int, _ m: Int, _ d: Int) -> String { "\(y != tt.y ? "\(y)年" : "")\(m + 1)月\(d)日（\(Self.dw[Civil.weekday(y, m, d)])）" }
        let y = JS.int(ev["y"]), m = JS.int(ev["m"]), d = JS.int(ev["day"])
        let b = Civil.fromDayNo(AppCore.evTo(ev))
        v.dateText = AppCore.evSpan(ev) > 1 ? one(y, m, d) + "〜" + one(b.y, b.m, b.d) : one(y, m, d)
        v.holText = Holidays.name(y, m, d) ?? ""
        if let mf = ev["movedFrom"], JS.truthy(mf) { v.movedText = "\(JS.string(.number(JS.number(mf["m"]) + 1)))月\(JS.string(mf["day"]))日から延期" }
        v.statusLabel = c.statusWord(ev)
        let st = ev["status"]
        v.badgeChar = (st == "jisseki" || st == "kakutei") ? "✓" : "？"
        if v.badgeChar == "✓" { v.badgeBg = JS.string(t["color"]); v.badgeColor = "#fff" }
        else { v.badgeBg = JS.string(t["paper"]); v.badgeColor = JS.string(t["dark"]); v.badgeBorder = "1.5px dashed " + JS.string(t["color"]) }
        let endShown = JS.string(st == "jisseki" ? JS.or(ev["actualEnd"], ev["end"]) : ev["end"])
        v.timeText = JS.truthy(ev["allDay"]) ? (AppCore.evSpan(ev) > 1 ? c.spanLabel(ev) + "　終日" : "終日") : JS.string(ev["start"]) + "–" + endShown
        v.spanText = AppCore.evSpan(ev) > 1 ? "\(AppCore.evSpan(ev))日間" : ""
        let drm = ev["remindMin"]?.number
        v.remindText = (drm == nil || JS.truthy(settings["notifyOff"])) ? "" : c.remindLabel(ev["remindMin"], ev["allDay"]) + "にお知らせ"
        v.place = JS.string(JS.or(ev["place"], "")).jsTrimmed
        v.placeHref = v.place.isEmpty ? "" : "https://maps.apple.com/?q=" + JS.encodeURIComponent(v.place)
        v.memo = JS.string(JS.or(ev["memo"], "")).jsTrimmed
        v.memoParts = EventCtx.linkify(v.memo)
        func urlIn(_ x: JSONValue?) -> String {
            let s = JS.string(JS.or(x, ""))
            guard let r = s.range(of: "https?://[^\\s　]+", options: .regularExpression) else { return "" }
            return String(s[r])
        }
        var L = JS.string(JS.or(ev["link"], "")).jsTrimmed
        if L.isEmpty { L = urlIn(ev["place"]) }
        if L.isEmpty { L = urlIn(ev["memo"]) }
        v.link = L.isEmpty ? "" : (L.range(of: "^https?://", options: .regularExpression) != nil ? L : "https://" + L)
        let low = L.lowercased()
        v.linkLabel = low.contains("zoom.") ? "Zoom に参加する" : low.contains("teams.") ? "Teams に参加する" : low.contains("meet.google") ? "Meet に参加する" : "リンクを開く"
        if !v.place.isEmpty && v.place.range(of: "^https?://", options: .regularExpression) != nil { v.place = ""; v.placeHref = "" }
        if JS.truthy(ev["candId"]) {
            let g = JS.stableSorted(events.filter { $0["candId"] == ev["candId"] }) { a, b in JS.sign(Double(AppCore.evFrom(a) - AppCore.evFrom(b))) }
            v.candText = "候補 \((g.firstIndex { $0["id"] == ev["id"] } ?? -1) + 1)/\(g.count)"
        }
        v.timeChanged = st == "jisseki" && JS.truthy(ev["actualEnd"]) && ev["actualEnd"] != ev["end"]
        if let w = ev["want"], JS.truthy(w) { v.wantText = "希望 " + JS.string(w.array?.first) + "–" + JS.string((w.array?.count ?? 0) > 1 ? w.array?[1] : nil) }
        else if v.timeChanged { v.wantText = "予定 " + JS.string(ev["start"]) + "–" + JS.string(ev["end"]) }
        v.wageShown = st == "jisseki" && ev["type"] == "baito"
        if v.wageShown {
            v.workHours = c.fmtHours(c.paidHours(ev)); v.wage = c.fmtWage(c.wage(ev))
            let bm = c.breakMin(ev)
            v.breakText = bm != 0 ? "休憩 \(JS.numberToString(bm))分を引いています" : ""
        }
        func primary(_ label: String, _ act: String) {
            v.primaryLabel = label; v.primaryAction = act
            v.primaryBg = JS.string(t["paper"]); v.primaryColor = JS.string(t["dark"]); v.primaryBorder = "1px solid " + JS.string(t["color"])
        }
        if st == "nakunatta" { primary("予定として戻す", "restore") }
        else if st == "kakutei" && (ev["type"] == "baito" || ev["type"] == "work") && !JS.truthy(ev["allDay"]) { primary("働いた記録をつける", "worked") }
        else if st == "mikakutei" { primary(JS.string(JS.or(t["ask"], "この予定、どうなった？")), "confirm") }
        var rows: [DetailView.MenuRow] = []
        if st == "jisseki" { rows.append(.init(key: "fix", label: "働いた時間を直す", red: false)) }
        rows.append(.init(key: "edit", label: "編集", red: false))
        if st == "kakutei" || st == "mikakutei" { rows.append(.init(key: "move", label: "日にちを変える", red: false)) }
        rows.append(.init(key: "send", label: "この予定を送る", red: false))
        rows.append(.init(key: "rep", label: JS.truthy(ev["noReport"]) ? "まとめに入れる" : "まとめに入れない", red: false))
        if st == "kakutei" || st == "mikakutei" { rows.append(.init(key: "copy", label: "コピー", red: false)) }
        rows.append(.init(key: "del", label: st == "jisseki" ? "この実績を削除" : "この予定を削除", red: true))
        v.menuRows = rows
        let dark = c.isDark(sysDark: sysDark)
        let oth = EventCtx.othersOnDay(events, ev, limit: 3)
        v.othersLabel = "\(m + 1)月\(d)日の、ほかの予定"
        v.othersRest = oth.rest
        v.others = oth.list.map { o in
            let ot = c.T(o["type"]) ?? [:]
            let hex = JS.string(ot["color"])
            let pill: [String: JSONValue] = o["status"] == "mikakutei"
                ? ["background": c.paperShow(ot["paper"], dark: dark), "color": .string(c.inkDash(hex, dark: dark)), "lineHeight": "21px", "border": .string("1.5px dashed " + c.softLine(hex, dark: dark))]
                : ["background": .string(c.softFill(hex, dark: dark)), "color": .string(c.inkOn(hex, dark: dark)), "lineHeight": "24px"]
            return .init(id: o["id"] ?? .null, title: JS.string(o["title"]), when: JS.truthy(o["allDay"]) ? "終日" : JS.string(JS.or(o["start"], "")), pill: pill)
        }
        v.histLabel = "これまでの「\(JS.string(ev["title"]))」"
        if let h = EventCtx.historyFor(events, ev) {
            let p = h.prev
            let py = JS.int(p["y"]), pm = JS.int(p["m"]), pd = JS.int(p["day"])
            v.hist = .init(year: "今年 \(h.yearNth)回目", month: "今月 \(h.monthNth)回目", prev: "\(pm + 1)月\(pd)日（\(Self.dw[Civil.weekday(py, pm, pd)])）", ago: EventCtx.agoText(h.daysAgo))
        }
        return v
    }

    /// 詳細の「···」の行を押した（先にメニューを閉じる）
    public func runDetailMenu(_ key: String) {
        set(["detailMenu": false, "pressed": .null])
        guard let ev = detailEvent() else { return }
        let ret = state["returnTo"]
        switch key {
        case "fix": openDialog(ev, "worked", ret)
        case "edit": openEdit(ev, ret)
        case "move": openDialog(ev, "move", ret)
        case "rep": updateEvent(ev["id"], ["noReport": JS.truthy(ev["noReport"]) ? nil : .bool(true)])
        case "copy": openCopy(ev, ret)
        case "del": askDelete(ev["id"] ?? .null)
        default: break   // "send" は画面の側で共有シートを出す
        }
    }
    /// 詳細の主ボタン
    public func runDetailPrimary(_ action: String) {
        guard let ev = detailEvent() else { return }
        switch action {
        case "restore": haptic("light"); updateEvent(ev["id"], ["status": "kakutei"])
        case "worked": openDialog(ev, "worked", state["returnTo"])
        case "confirm": openDialog(ev, "confirm", state["returnTo"])
        default: break
        }
    }
    /// 詳細から戻る
    public func detailBack() { set(["screen": state["returnTo"], "detailId": .null, "detailMenu": false]) }

    // MARK: 「どうなった？」の小窓

    public func dialogView() -> DialogView {
        var v = DialogView()
        guard let d = state["dialog"]?.object else { return v }
        let c = core()
        let t = c.T(d["type"]) ?? [:]
        let ask = ["asobi": "約束、決まった？", "yoji": "この用事、どうなりました？", "baito": "このシフト、どうなりました？"]
        let mode = JS.string(d["mode"])
        v.heading = mode == "worked" ? "何時まで働いた？" : JS.string(JS.or(t["ask"], .string(ask[JS.string(d["type"])] ?? "この予定、どうなりました？")))
        v.goneLabel = JS.string(JS.or(t["gone"], "無くなった"))
        v.maybeLabel = t["key"] == "work" ? "まだ仮のまま" : "まだ分からない"
        v.sub = "\(JS.string(.number(JS.number(d["m"]) + 1)))月\(JS.string(d["day"]))日 ・ \(JS.string(d["title"]))"
        v.start = JS.string(d["start"]); v.end = JS.string(d["end"])
        v.startOpen = d["picking"] == "start"; v.endOpen = d["picking"] == "end"
        v.typeColor = JS.string(t["color"]); v.openColor = v.typeColor
        v.changed = d["start"] != d["origS"] || d["end"] != d["origE"]
        v.origText = (mode == "worked" ? "確定 " : "希望 ") + JS.string(d["origS"]) + "–" + JS.string(d["origE"])
        v.primaryLabel = mode == "worked" ? "記録する" : "確定した"
        v.primaryBg = AppCore.rgb(TypeDefs.mixHex(JS.string(t["color"]), "#000000", 0.35))
        v.breakShown = mode == "worked"
        if v.breakShown {
            let cur = JS.truthy(d["breakMin"]) ? JS.number(d["breakMin"]) : 0
            v.breakChips = [(0, "なし"), (15, "15分"), (30, "30分"), (45, "45分"), (60, "60分"), (90, "90分")].map { ($0.0, $0.1, cur == Double($0.0)) }
            let paid = max(0, c.hoursBetween(JS.string(d["start"]), JS.string(d["end"])) - cur / 60)
            v.paidText = cur != 0 ? "実働 \(c.fmtHours(paid))（休憩 \(JS.numberToString(cur))分を引いた）" : "実働 \(c.fmtHours(paid))"
        }
        v.moveShown = mode == "confirm" && !JS.truthy(d["moving"])
        v.moving = JS.truthy(d["moving"]) || mode == "move"
        if v.moving {
            let y = JS.int(d["y"]), m = JS.int(d["m"]), day = JS.int(d["day"])
            let pY = (d["pickY"] == nil || d["pickY"] == .null) ? y : JS.int(d["pickY"])
            let pM = (d["pickM"] == nil || d["pickM"] == .null) ? m : JS.int(d["pickM"])
            v.moveLabel = "\(pY)年\(pM + 1)月"
            let ws = JS.int(settings["weekStart"])
            v.moveWeekdays = (0..<7).map { i in let dw = ((i + ws) % 7 + 7) % 7; return (Self.dw[dw], dw == 0 ? "var(--sun)" : dw == 6 ? "var(--sat)" : "var(--ink-faint)") }
            let first = ((Civil.weekday(pY, pM, 1) - ws) % 7 + 7) % 7, dim = Civil.daysInMonth(pY, pM)
            let to = d["moveTo"]?.object
            var cells: [DialogView.Cell] = Array(repeating: .init(day: nil, orig: false, sel: false, color: "", bg: "", weight: 0), count: first)
            for d2 in 1...dim {
                let orig = pY == y && pM == m && d2 == day
                let sel = to != nil && to!["y"] == .number(Double(pY)) && to!["m"] == .number(Double(pM)) && to!["d"] == .number(Double(d2))
                let dw2 = Civil.weekday(pY, pM, d2)
                let red = Holidays.name(pY, pM, d2) != nil || dw2 == 0
                cells.append(.init(day: d2, orig: orig, sel: sel, color: sel ? "var(--card)" : orig ? "var(--ink-faint)" : (red ? "var(--sun)" : dw2 == 6 ? "var(--sat)" : "var(--ink-soft)"),
                                   bg: sel ? "var(--ink)" : "transparent", weight: sel ? 700 : 500))
            }
            v.moveCells = cells
            v.moveChosen = to != nil
            if let to { let ty = JS.int(to["y"]), tm = JS.int(to["m"]), td = JS.int(to["d"]); v.moveChosenText = "\(tm + 1)月\(td)日（\(Self.dw[Civil.weekday(ty, tm, td)])）へ" }
            else { v.moveChosenText = "新しい日をえらんでください" }
            v.moveTitle = mode == "move" ? "日にちを変える" : "別の日になった"
        }
        v.editLabel = mode == "worked" ? "この予定を編集" : "予定の内容を直す"
        return v
    }

    func patchDialog(_ p: [String: JSONValue?]) { if let d = state["dialog"]?.object { set(["dialog": .object(Self.with(d, p))]) } }
    /// 開始・終了の行（ドラムを開閉）
    public func dlgTapRow(_ field: String) { patchDialog(["picking": state["dialog"]?["picking"] == .string(field) ? .null : .string(field)]) }
    /// 小窓のドラム。開始を動かすと終わりも同じだけ（働いた記録のときは終わりを動かさない）
    public func dlgSetWheel(_ field: String, unit: String, index idx: Int) {
        guard let d = state["dialog"]?.object else { return }
        let parts = JS.string(d[field]).components(separatedBy: ":").map { JS.number($0) }
        var h = parts.count > 0 ? parts[0] : .nan, m = parts.count > 1 ? parts[1] : .nan
        if unit == "h" { h = Double(min(23, max(0, idx))) } else { m = Double(min(55, max(0, idx * 5))) }
        func two(_ x: Double) -> String { let s = JS.numberToString(x); return s.count >= 2 ? s : String(repeating: "0", count: 2 - s.count) + s }
        let nv = two(h) + ":" + two(m)
        if d[field] == .string(nv) { return }
        if field != "start" || d["mode"] == "worked" { patchDialog([field: .string(nv)]); return }
        let c = core()
        let diff = c.mins(nv) - c.mins(JS.string(d["start"]))
        patchDialog(["start": .string(nv), "end": .string(c.addMin(JS.string(d["end"]), diff))])
    }
    public func dlgSetBreak(_ val: Int) { haptic("light"); patchDialog(["breakMin": .number(Double(val))]) }
    /// 「別の日になった」：同じ小窓の中で日えらびへ
    public func dlgStartMove() {
        haptic("light")
        let d = state["dialog"]?.object ?? [:]
        patchDialog(["moving": true, "pickY": d["y"], "pickM": d["m"], "moveTo": .null])
    }
    public func dlgShiftMove(_ n: Int) {
        guard let d = state["dialog"]?.object else { return }
        let pY = (d["pickY"] == nil || d["pickY"] == .null) ? d["y"] : d["pickY"]
        let pM = (d["pickM"] == nil || d["pickM"] == .null) ? d["m"] : d["pickM"]
        let o = Self.shiftMonth(["y": pY ?? .null, "m": pM ?? .null], n)
        patchDialog(["pickY": o["y"], "pickM": o["m"]])
    }
    public func dlgPickMoveDay(_ d2: Int) {
        guard let d = state["dialog"]?.object else { return }
        let pY = (d["pickY"] == nil || d["pickY"] == .null) ? JS.int(d["y"]) : JS.int(d["pickY"])
        let pM = (d["pickM"] == nil || d["pickM"] == .null) ? JS.int(d["m"]) : JS.int(d["pickM"])
        if pY == JS.int(d["y"]) && pM == JS.int(d["m"]) && d2 == JS.int(d["day"]) { return }
        haptic("light")
        patchDialog(["moveTo": ["y": .number(Double(pY)), "m": .number(Double(pM)), "d": .number(Double(d2))]])
    }
    /// 「この日で決まった」「この日に、まだ仮で置く」
    public func dlgMoveTo(_ status: String) {
        guard let d = state["dialog"]?.object, let to = d["moveTo"]?.object else { return }
        moveEvent(d["id"], to: (JS.int(to["y"]), JS.int(to["m"]), JS.int(to["d"])), status: status)
    }
    public func dlgMoveSomeday() { if let id = state["dialog"]?["id"] { toSomeday(id, "month") } }
    public func dlgMoveBack() {
        guard let d = state["dialog"]?.object else { return }
        set(["dialog": d["mode"] == "move" ? .null : .object(Self.with(d, ["moving": false]))])
    }
    public func dlgDismiss() { set(["dialog": .null]) }
    /// 「予定の内容を直す」
    public func dlgEdit() {
        let id = state["dialog"]?["id"]
        let ev = events.first { $0["id"] == id }
        set(["dialog": .null])
        if let ev { openEdit(ev, state["returnTo"]) }
    }
}
