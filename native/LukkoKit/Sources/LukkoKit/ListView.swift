import Foundation

/// これから・まだ・探す（Web 版 renderVals の list の写し）と、日にち未定の予定に日を決める小窓
public struct ListView: Equatable {
    public struct Row: Equatable {
        public var key: JSONValue, title: String, place: String, date: String, dow: String, time: String
        public var dashed: Bool, word: String, pill: [String: JSONValue], goneLabel: String
    }
    public struct Group: Equatable { public var head: String; public var rows: [Row] }
    public struct Shelf: Equatable { public var key: JSONValue; public var title: String; public var when: String; public var dot: String }
    public var tab = "upcoming"
    public var seg: [(key: String, label: String, sel: Bool)] = []
    public var groups: [Group] = []
    public var empty = ""
    public var dashOnly = false
    public var shelf: [Shelf] = []
    public var searchQ = ""
    public static func == (a: ListView, b: ListView) -> Bool {
        a.tab == b.tab && a.seg.map { [$0.key, $0.label] } == b.seg.map { [$0.key, $0.label] } && a.groups == b.groups && a.empty == b.empty && a.shelf == b.shelf
    }
}

public struct SomedayPickView: Equatable {
    public struct Cell: Equatable { public var day: Int?; public var color: String; public var busy: Bool }
    public var title = "", label = ""
    public var weekdays: [String] = []
    public var cells: [Cell] = []
}

extension Engine {
    public func listView(dark: Bool) -> ListView {
        var v = ListView()
        let c = core()
        let t = today
        let todayN = Civil.dayNo(t.y, t.m, t.d)
        let alive = events.filter { $0["status"] != "nakunatta" }
        let und = alive.filter { $0["status"] == "mikakutei" }
        let someday = (state["someday"]?.array ?? []).compactMap { $0.object }
        let undecided = und.filter { AppCore.evTo($0) >= todayN }.count + someday.count
        let tab = JS.string(JS.or(state["listTab"], "upcoming"))
        v.tab = tab
        v.seg = [("upcoming", "これから"), ("undecided", "まだ"), ("search", "探す")].map { k, label in
            (k, k == "undecided" && undecided > 0 ? "まだ \(undecided)" : label, tab == k)
        }
        let dw = Self.dw
        func rowOf(_ e: Obj) -> ListView.Row {
            let ty = c.T(e["type"]) ?? [:]
            let hex = JS.string(ty["color"])
            let pill: [String: JSONValue] = e["status"] == "mikakutei"
                ? ["background": c.paperShow(ty["paper"], dark: dark), "color": .string(c.inkDash(hex, dark: dark)), "border": .string("1.5px dashed " + c.softLine(hex, dark: dark))]
                : ["background": .string(c.softFill(hex, dark: dark)), "color": .string(c.inkOn(hex, dark: dark)), "border": "1.5px solid transparent"]
            let end = JS.string(e["status"] == "jisseki" ? JS.or(e["actualEnd"], e["end"]) : e["end"])
            let y = JS.int(e["y"]), m = JS.int(e["m"]), d = JS.int(e["day"])
            return .init(key: e["id"] ?? .null, title: JS.string(e["title"]), place: JS.string(JS.or(e["place"], "")),
                         date: "\(JS.string(.number(JS.number(e["m"]) + 1)))/\(JS.string(e["day"]))", dow: dw[Civil.weekday(y, m, d)],
                         time: JS.truthy(e["allDay"]) ? (AppCore.evSpan(e) > 1 ? c.spanLabel(e) : "終日") : JS.string(e["start"]) + "–" + end,
                         dashed: e["status"] == "mikakutei", word: c.statusWord(e), pill: pill, goneLabel: JS.string(JS.or(ty["gone"], "無くなった")))
        }
        func sortD(_ list: [Obj]) -> [Obj] {
            JS.stableSorted(list) { a, b in
                let d1 = AppCore.evFrom(a) - AppCore.evFrom(b); if d1 != 0 { return d1 < 0 ? -1 : 1 }
                let d2 = (JS.truthy(a["allDay"]) ? 0 : 1) - (JS.truthy(b["allDay"]) ? 0 : 1); if d2 != 0 { return d2 < 0 ? -1 : 1 }
                return JS.sign(c.mins(JS.string(a["start"])) - c.mins(JS.string(b["start"])))
            }
        }
        let ws = JS.int(settings["weekStart"])
        let wk0 = todayN - ((Civil.weekday(t.y, t.m, t.d) - ws) % 7 + 7) % 7
        func headOf(_ n: Int) -> String {
            if n < todayN { return "過ぎた日" }
            if n == todayN { return "今日" }
            if n == todayN + 1 { return "明日" }
            if n < wk0 + 7 { return "今週" }
            if n < wk0 + 14 { return "来週" }
            let o = Civil.fromDayNo(n)
            return (o.y != t.y ? "\(o.y)年" : "") + "\(o.m + 1)月"
        }
        func group(_ list: [Obj]) -> [ListView.Group] {
            var out: [ListView.Group] = []
            for e in list {
                let f = AppCore.evFrom(e)
                let h = headOf(max(f, f < todayN && AppCore.evTo(e) >= todayN ? todayN : f))
                if out.last?.head == h { out[out.count - 1].rows.append(rowOf(e)) } else { out.append(.init(head: h, rows: [rowOf(e)])) }
            }
            return out
        }
        if tab == "upcoming" {
            let onlyDash = JS.truthy(state["listDashOnly"])
            let list = Array(sortD(alive.filter { AppCore.evTo($0) >= todayN && (!onlyDash || $0["status"] == "mikakutei") }).prefix(150))
            v.groups = group(list)
            v.empty = list.isEmpty ? "この先の予定はまだありません" : ""
            v.dashOnly = onlyDash
        } else if tab == "undecided" {
            let past = Array(sortD(und.filter { AppCore.evTo($0) < todayN }).reversed().prefix(30))
            let next = sortD(und.filter { AppCore.evTo($0) >= todayN })
            v.groups = (past.isEmpty ? [] : [.init(head: "日が過ぎて、まだ点線のまま", rows: past.map(rowOf))]) + group(next)
            v.empty = past.count + next.count + someday.count == 0 ? "まだ決まっていない予定はありません" : ""
            v.shelf = someday.map { it in .init(key: it["id"] ?? .null, title: JS.string(it["title"]), when: MonthCore.somedayLabel[JS.string(it["when"])] ?? "undefined",
                                                 dot: JS.string(c.T(it["type"])?["color"])) }
        } else {
            v.searchQ = JS.string(JS.or(state["searchQ"], ""))
            let q = v.searchQ.jsTrimmed.lowercased()
            if !q.isEmpty {
                let hit = events.filter { e in [e["title"], e["place"], e["memo"]].contains { ImportCore.includes(JS.string(JS.or($0, "")).lowercased(), q) } }
                let fut = sortD(hit.filter { AppCore.evTo($0) >= todayN })
                let past = Array(sortD(hit.filter { AppCore.evTo($0) < todayN }).reversed())
                v.groups = (fut.isEmpty ? [] : [.init(head: "これから \(fut.count)件", rows: fut.prefix(100).map(rowOf))])
                    + (past.isEmpty ? [] : [.init(head: "過去 \(past.count)件", rows: past.prefix(100).map(rowOf))])
                v.empty = hit.isEmpty ? "見つかりませんでした" : ""
            } else { v.empty = "題名・場所・メモから探せます" }
        }
        return v
    }

    /// 一覧の「流れた」等（無くなったにして、取り消しの帯）
    public func listGone(_ id: JSONValue?) {
        guard let e = events.first(where: { $0["id"] == id }), e["status"] == "mikakutei" else { return }
        let ty = core().T(e["type"]) ?? [:]
        haptic("light")
        undoPrevKeys = ["status"]
        updateEvent(e["id"], ["status": "nakunatta"])
        showUndo("「\(JS.string(e["title"]))」を\(JS.string(JS.or(ty["gone"], "無くなった")))にしました", ["kind": "status", "id": e["id"] ?? .null, "prev": ["status": e["status"] ?? .null]])
    }
    public func setListTab(_ k: String) { haptic("light"); set(["listTab": .string(k)]) }
    public func toggleDashOnly() { haptic("light"); set(["listDashOnly": .bool(!JS.truthy(state["listDashOnly"]))]) }
    public func setSearchQ(_ s: String) { set(["searchQ": .string(s)]) }

    // MARK: 日にち未定の予定に日を決める
    public func openSomedayPick(_ id: JSONValue?) {
        haptic("light")
        let t = today
        set(["somedayPick": ["id": id ?? .null, "y": .number(Double(t.y)), "m": .number(Double(t.m))]])
    }
    public func shiftSomedayPick(_ n: Int) {
        guard let sp = state["somedayPick"]?.object else { return }
        let o = Self.shiftMonth(["y": sp["y"] ?? .null, "m": sp["m"] ?? .null], n)
        set(["somedayPick": .object(Self.with(sp, ["y": o["y"], "m": o["m"]]))])
    }
    public func somedayPickView() -> SomedayPickView? {
        guard let sp = state["somedayPick"]?.object else { return nil }
        var v = SomedayPickView()
        let it = (state["someday"]?.array ?? []).compactMap { $0.object }.first { $0["id"] == sp["id"] }
        v.title = it.map { "「\(JS.string($0["title"]))」の日を決める" } ?? ""
        let y = JS.int(sp["y"]), m = JS.int(sp["m"])
        v.label = "\(y)年\(m + 1)月"
        let ws = JS.int(settings["weekStart"])
        v.weekdays = (0..<7).map { Self.dw[($0 + ws) % 7] }
        let first = ((Civil.weekday(y, m, 1) - ws) % 7 + 7) % 7
        v.cells = Array(repeating: .init(day: nil, color: "", busy: false), count: first)
        for d in 1...Civil.daysInMonth(y, m) {
            let dw2 = Civil.weekday(y, m, d)
            let n = Civil.dayNo(y, m, d)
            let busy = events.contains { $0["status"] != "nakunatta" && AppCore.evFrom($0) <= n && AppCore.evTo($0) >= n }
            v.cells.append(.init(day: d, color: (Holidays.name(y, m, d) != nil || dw2 == 0) ? "var(--sun)" : dw2 == 6 ? "var(--sat)" : "var(--ink-soft)", busy: busy))
        }
        return v
    }
    public func pickSomedayDay(_ d: Int) {
        guard let sp = state["somedayPick"]?.object else { return }
        placeSomeday(sp["id"], JS.int(sp["y"]), JS.int(sp["m"]), d)
    }
}
