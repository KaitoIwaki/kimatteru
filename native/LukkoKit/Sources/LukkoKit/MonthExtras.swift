import Foundation

/// 月表示のまわり（sw-month）：年月えらび・シフト入力のパレット・給料バー・はじめての案内・確定したときの帯（morph）・
/// 日の画面の iPhone の予定の行と、見出しの操作（Web 版 renderVals の写し）

public struct YMSheetView: Equatable {
    public struct Month: Equatable { public var m: Int, label: String, sel: Bool, isThis: Bool }
    public var year: String, todayLabel: String
    public var months: [Month]
    /// 年を送った向き（1 ＝ 次の年・右から、-1 ＝ 前の年・左から、0 ＝ 開いたとき）
    public var dir: Int
}

public struct StampBarView: Equatable {
    public struct Tpl: Equatable { public var key: JSONValue, label: String, sub: String, sel: Bool }
    public struct Seg: Equatable { public var key: String, label: String, sel: Bool }
    public var tpls: [Tpl], seg: [Seg], monthLabel: String
}

public struct WageBarView: Equatable {
    public var label: String, total: String, unit: String, num: String
}

public struct DayOverlayRow: Equatable {
    public var key: JSONValue, title: String, place: String, time: String
}

extension MonthCore {
    /// 確定した瞬間の帯（点線 → 左から塗り → 少し膨らむ）
    public struct Morph: Equatable {
        public var text: String, mark: String
        /// 地（紙の色）・枠・塗りの色・字の色
        public var background: JSONValue, border: String, fill: String, ink: String
        /// 塗りが満ちているか（fill・settle）、膨らむところか（settle）、点線か（dash）
        public var fillOn: Bool, settle: Bool, dashed: Bool
        public var borderLeft: String?, borderRight: String?
    }
}

extension AppCore {
    /// 確定したときの帯の見た目（Web 版 pillView の morph のとき）
    public func morphBar(_ ev: Obj, phase: String, startsHere L: Bool, endsHere R: Bool, dark: Bool) -> MonthCore.Morph {
        let t = T(ev["type"]) ?? [:]
        let hex = JS.string(t["color"])
        let dash = phase == "dash"
        return .init(text: JS.string(ev["title"]), mark: dash ? "?" : "",
                     background: paperShow(t["paper"], dark: dark), border: "1.5px " + (dash ? "dashed" : "solid") + " " + softLine(hex, dark: dark),
                     fill: softFill(hex, dark: dark), ink: inkOn(hex, dark: dark),
                     fillOn: phase == "fill" || phase == "settle", settle: phase == "settle", dashed: dash,
                     borderLeft: L ? nil : "none", borderRight: R ? nil : "none")
    }

    /// 日の画面の下に出す、重ねて表示している iPhone の予定（直すのは元のアプリで）
    public func dayOverlayRows(_ over: [Obj]) -> [DayOverlayRow] {
        over.map { e in
            DayOverlayRow(key: e["id"] ?? .null, title: JS.string(e["title"]), place: JS.string(JS.or(e["place"], "")),
                          time: JS.truthy(e["allDay"]) ? "終日" : JS.string(e["start"]) + "–" + JS.string(e["end"]))
        }
    }
}

extension Engine {
    var isWeekView: Bool { settings["calView"] == "week" }

    // MARK: 見出し（月と週で動きが変わる）

    /// ‹ ：月表示は前の月（触感なし）、週表示は 7 日戻す
    public func headPrev() { if isWeekView { weekShift(-1) } else { shiftMonthBy(-1) } }
    /// › ：月表示は次の月、週表示は 7 日進める
    public func headNext() { if isWeekView { weekShift(1) } else { shiftMonthBy(1) } }
    /// 「今日」
    public func headToday() { if isWeekView { weekGoToday() } else { goToday() } }
    /// 月｜週（次に開いたときも同じほう）
    public func setCalView(_ k: String) {
        haptic("light")
        set(["settings": .object(Self.with(settings, ["calView": str(k)])), "weekAnchor": .null])
    }
    /// 月名を押す：年月えらび（開いていれば閉じる）
    public func tapMonthHead() {
        haptic("light")
        let open = state["ymSheet"].map { JS.truthy($0) } ?? false
        set(["ymSheet": open ? .null : .object(["y": state["ym"]?["y"] ?? .null])])
    }
    /// 「給料」スイッチ（触感なし）
    public func toggleWage() { set(["wageOn": .bool(!JS.truthy(state["wageOn"]))]) }
    /// 給料バーを押す：その月のまとめカード
    public func openWageSummary() {
        set(["screen": "summary", "shareToast": false, "cardKind": "month", "cardFrom": state["screen"] ?? .null])
    }
    /// はじめての案内の ✕（予定を全部消して 0 件に戻っても、もう出さない）
    public func closeFirstRunHint() {
        haptic("light")
        setSetting("hintClosed", true)
    }
    /// はじめての案内を出すか（予定が 0 件で、まだ閉じていない）
    public func showFirstRunHint() -> Bool {
        (state["events"]?.array ?? []).isEmpty && !JS.truthy(settings["hintClosed"])
    }

    // MARK: 年月えらび

    public func ymSheetView() -> YMSheetView? {
        guard let sh = state["ymSheet"], JS.truthy(sh) else { return nil }
        let sy = sh["y"] ?? .null
        let ym = state["ym"] ?? .null
        let t = today
        let months: [YMSheetView.Month] = (0..<12).map { i in
            .init(m: i, label: "\(i + 1)月", sel: sy == ym["y"] && JSONValue.number(Double(i)) == ym["m"],
                  isThis: sy == .number(Double(t.y)) && i == t.m)
        }
        let dir = JS.number(sh["dir"])
        return YMSheetView(year: JS.string(sy), todayLabel: "今月（\(t.y)年\(t.m + 1)月）", months: months,
                           dir: JS.truthy(sh["dir"]) ? (dir > 0 ? 1 : -1) : 0)
    }
    /// ‹ › で年を送る（送った向きから月の並びが滑り込む）
    public func ymSheetShift(_ d: Int) {
        guard let sh = state["ymSheet"], JS.truthy(sh) else { return }
        haptic("light")
        set(["ymSheet": .object(["y": num(JS.number(sh["y"]) + Double(d)), "dir": num(Double(d))])])
    }
    /// 月の並びを横に払った向き（8px で決める。横は |dx| > |dy|×1.2）。まだ決まらないなら nil
    public static func ymSheetAxisIsX(dx: Double, dy: Double) -> Bool? {
        if abs(dx) < 8 && abs(dy) < 8 { return nil }
        return abs(dx) > abs(dy) * 1.2
    }
    /// 払い終わり：横に 60 以上なら年を送る（左へ払うと次の年）
    public func ymSheetSwipeEnd(horizontal: Bool, dx: Double) {
        guard horizontal, abs(dx) >= 60 else { return }
        ymSheetShift(dx < 0 ? 1 : -1)
    }
    public func ymSheetPick(_ i: Int) {
        guard let sh = state["ymSheet"], JS.truthy(sh) else { return }
        haptic("light")
        set(["ym": .object(["y": sh["y"] ?? .null, "m": num(Double(i))]), "dayNum": .null, "ymSheet": .null])
    }
    public func ymSheetToday() {
        haptic("light")
        let t = today
        set(["ym": ["y": num(Double(t.y)), "m": num(Double(t.m))], "dayNum": .null, "ymSheet": .null])
    }
    public func ymSheetClose() { set(["ymSheet": .null]) }

    // MARK: シフト入力のパレット

    public func stampBarView() -> StampBarView? {
        guard let sp = state["stamp"], JS.truthy(sp) else { return nil }
        let c = core()
        let tpls: [StampBarView.Tpl] = stampTemplates().map { t in
            let label = JS.trim(JS.string(t["sym"]) + " " + JS.string(JS.or(t["name"], "")))
            let from = JS.number(t["from"]).truncatingRemainder(dividingBy: 1440), to = JS.number(t["to"]).truncatingRemainder(dividingBy: 1440)
            return .init(key: t["key"] ?? .null, label: label, sub: JS.truthy(t["allDay"]) ? "休み" : c.fmtMin(from) + "–" + c.fmtMin(to), sel: sp["key"] == t["key"])
        }
        let seg: [StampBarView.Seg] = [("kakutei", "決まってる"), ("mikakutei", "希望（点線）")].map { k, label in
            .init(key: k, label: label, sel: sp["status"] == .string(k))
        }
        return StampBarView(tpls: tpls, seg: seg, monthLabel: "\(JS.string(.number(JS.number(state["ym"]?["m"]) + 1)))月の希望をまとめて確定")
    }
    public func stampPick(_ key: JSONValue?) {
        guard let sp = state["stamp"]?.object else { return }
        haptic("light")
        set(["stamp": .object(Self.with(sp, ["key": key ?? .null]))])
    }
    public func stampSetStatus(_ k: String) {
        guard let sp = state["stamp"]?.object else { return }
        haptic("light")
        set(["stamp": .object(Self.with(sp, ["status": str(k)]))])
    }

    // MARK: 給料バー

    /// 「10月の実績合計 ¥金額」（見ている月の実績の給料）
    public func wageBarView() -> WageBarView {
        let ym = state["ym"] ?? .null
        let c = core()
        let sum = events.filter { $0["y"] == ym["y"] && $0["m"] == ym["m"] && $0["status"] == "jisseki" }.reduce(0.0) { $0 + c.wage($1) }
        let total = c.fmtWage(sum)
        return WageBarView(label: "\(monthHead().monthLabel)月の実績合計", total: total, unit: "¥", num: String(total.dropFirst()))
    }
}
