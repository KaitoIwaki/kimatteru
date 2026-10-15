import Foundation

/// 週表示の中身（Web 版 renderVals の calView==='week' と WeekStrip の写し）。
///
/// 日を横一列に並べて指で流す。weekAnchor は「いちばん左に見えている日」の日番号。
/// Web 版は前後の数週間だけを描いて、流し終わったら描き直す。SwiftUI 版は、見えている所だけを作る並べ方（Lazy）で
/// 長い範囲を並べるので描き直しは要らないが、1 日ぶんの中身（weekCol）と見出しの決め方は同じ
public struct WeekView: Equatable {
    public struct Col: Equatable {
        public var n: Int, key: String, y: Int, m: Int, d: Int
        public var dow: String, isToday: Bool, hol: String
        /// 曜日の字の色・日付の字の色・日付の丸（今日だけ）
        public var dowColor: String, numColor: String, numBg: String?
        public var allDay: DayCore.AllDay
        public var boxes: [DayCore.Box]
    }
    /// 描く範囲の最初の日（Web 版の weekBase）と、いちばん左に見えている日（weekFirst）
    public var base = 0, first = 0, len = 0
    public var monthLabel = "", year = "", todayBtnShown = false
    /// 縦の最初の位置（朝 7 時あたり。見えている 7 日にもっと早い予定があればそこから）
    public var startTop = 0.0
    public var cols: [Col] = []
}

public enum WeekCore {
    /// Web 版の WIN_BACK・WIN_AHEAD（基準日の前 28 日〜後 35 日を描く）
    public static let winBack = 28, winAhead = 35
    /// 左の時刻の幅
    public static let gutter = 30.0
    static let wl = ["日", "月", "火", "水", "木", "金", "土"]
}

extension AppCore {
    var weekStartSetting: Int { JS.int(settings["weekStart"]) }

    /// いちばん左に見えている日：weekAnchor があればそこ、今月なら今日の週、ほかの月はその月 1 日の週
    public func weekFirst() -> Int {
        if case .number(let n)? = state["weekAnchor"] { return Int(n) }
        let t = state["today"], ym = state["ym"]
        let ty = JS.int(t?["y"]), tm = JS.int(t?["m"]), td = JS.int(t?["d"])
        let y = JS.int(ym?["y"]), m = JS.int(ym?["m"])
        let inThis = y == ty && m == tm
        return inThis ? TimeGrid.weekStartNo(ty, tm, td, weekStartSetting) : TimeGrid.weekStartNo(y, m, 1, weekStartSetting)
    }

    /// 見出しの月：見えている 7 日に今日があれば今日の月、無ければ 4 日目の月。「今日」は今日が見えていないときだけ
    public func weekHead(first: Int) -> (monthLabel: String, year: String, todayBtnShown: Bool) {
        let t = state["today"]
        let ty = JS.int(t?["y"]), tm = JS.int(t?["m"]), td = JS.int(t?["d"])
        let tN = Civil.dayNo(ty, tm, td)
        let seen = tN >= first && tN < first + 7
        let lab: (y: Int, m: Int) = seen ? (ty, tm) : { let o = Civil.fromDayNo(first + 3); return (o.y, o.m) }()
        return (String(lab.m + 1), String(lab.y), !seen)
    }

    /// 週表示に出す予定（「無くなった」を隠す設定ならそれを除く）。日 n の列に要るぶんだけ（始まりが n-59〜n）
    public func weekPool(_ n: Int) -> [Obj] {
        let hide = JS.truthy(settings["hideCanceled"])
        // 前の日から続く時刻の予定（n-1）と、何日も続く終日の予定（最長 60 日）まで
        return EventDayIndex.of(state["events"]?.array ?? []).overlapping(n - 1, n).filter { !(hide && $0["status"] == "nakunatta") }
    }

    /// 1 日ぶんの列。over は重ねて表示している iPhone の予定（その日にかかるもの）。
    /// withBoxes が false なら時刻の箱を作らない（見出しと終日の段だけ要るとき）
    public func weekCol(_ n: Int, over: [Obj] = [], dark: Bool, sysZoom: Double = 1, withBoxes: Bool = true) -> WeekView.Col {
        let o = Civil.fromDayNo(n)
        let dw = Civil.weekday(o.y, o.m, o.d), hol = Holidays.name(o.y, o.m, o.d)
        let t = state["today"]
        let isToday = n == Civil.dayNo(JS.int(t?["y"]), JS.int(t?["m"]), JS.int(t?["d"]))
        let color = (hol != nil || dw == 0) ? MonthCore.holidayRed : dw == 6 ? MonthCore.saturdayBlue : "var(--ink)"
        let pool = weekPool(n)
        return WeekView.Col(n: n, key: String(n), y: o.y, m: o.m, d: o.d, dow: WeekCore.wl[dw], isToday: isToday, hol: hol ?? "",
                            dowColor: dw == 0 ? MonthCore.holidayRed : dw == 6 ? MonthCore.saturdayBlue : "var(--ink-faint)",
                            numColor: isToday ? "var(--card)" : color, numBg: isToday ? color : nil,
                            allDay: timeGridAllDay(pool, o.y, o.m, o.d, dark: dark, sysZoom: sysZoom),
                            boxes: withBoxes ? timeGridBoxes(pool, over: over, o.y, o.m, o.d, dark: dark, sysZoom: sysZoom) : [])
    }

    /// 縦の最初の位置。朝 7 時あたり、見えている 7 日にもっと早い予定があればそこから（-12px）
    public func weekStartTop(_ cols: [WeekView.Col]) -> Double {
        var m0 = 7.0 * 60
        for c in cols { for b in c.boxes { m0 = Swift.min(m0, b.a) } }
        return Swift.max(0, m0 / 60 * DayCore.hourH - 12)
    }

    /// Web 版と同じ範囲（前 28 日〜後 35 日）の週表示。over は重ねて表示している iPhone の予定（範囲にかかるもの）
    public func weekView(over: [Obj] = [], dark: Bool, sysZoom: Double = 1) -> WeekView {
        var v = WeekView()
        let first = weekFirst()
        v.first = first
        v.base = first - WeekCore.winBack
        v.len = WeekCore.winBack + WeekCore.winAhead
        let h = weekHead(first: first)
        v.monthLabel = h.monthLabel; v.year = h.year; v.todayBtnShown = h.todayBtnShown
        v.cols = (0..<v.len).map { weekCol(v.base + $0, over: over, dark: dark, sysZoom: sysZoom) }
        v.startTop = weekStartTop(Array(v.cols[(first - v.base)..<(first - v.base + 7)]))
        return v
    }
}

extension Engine {
    /// 流し終わった：いちばん左に見えている日を覚える。見出しの月はその 4 日目の月
    public func weekSettle(_ n: Int) {
        if state["weekAnchor"] == .number(Double(n)) { return }
        let o = Civil.fromDayNo(n + 3)
        set(["weekAnchor": num(Double(n)), "ym": ["y": num(Double(o.y)), "m": num(Double(o.m))]])
    }
    /// ‹ › ：7 日ぶん送る（画面はその日まで滑らかに流す）
    public func weekShift(_ d: Int) {
        haptic("light")
        let n = core().weekFirst() + d * 7
        let o = Civil.fromDayNo(n + 3)
        set(["weekAnchor": num(Double(n)), "ym": ["y": num(Double(o.y)), "m": num(Double(o.m))]])
    }
    /// 「今日」：今日の週・今月へ。今日のマスを光らせる
    public func weekGoToday() {
        haptic("light")
        let t = today
        set(["weekAnchor": num(Double(TimeGrid.weekStartNo(t.y, t.m, t.d, JS.int(settings["weekStart"])))),
             "ym": ["y": num(Double(t.y)), "m": num(Double(t.m))], "flashToday": num(now)])
    }
    /// 週の列の見出し（曜日・日付）を押した：その月にしてから、その日の画面へ
    public func weekOpenDay(_ n: Int) {
        let o = Civil.fromDayNo(n)
        set(["ym": ["y": num(Double(o.y)), "m": num(Double(o.m))]])
        openDay(o.d)
    }
    /// 週の何もない所を押した：押した位置を 30 分単位に丸めた時刻から新しい予定
    public func weekOpenNew(_ n: Int, minute: Int) {
        let o = Civil.fromDayNo(n)
        openNew(o.d, "month", ["y": num(Double(o.y)), "m": num(Double(o.m)), "start": num(Double(minute))])
    }
}
