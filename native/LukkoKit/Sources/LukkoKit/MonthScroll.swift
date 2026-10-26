import Foundation

/// 月を縦につなげて動かす表示（設定の「月を縦にスクロール」）の 1 週。
/// 横に払う月表示は「1 か月＝1 枚」で、前後の月の日は薄い数字だけだったが、こちらは週をそのまま続けて並べる。
/// 10/31 と 11/1 が同じ行に入り、どちらの日の予定も描く。同じ週は 1 回しか出ない
extension MonthCore {
    /// 列ごとの日（年・月 0〜11・日）
    public struct DayRef: Equatable {
        public var y: Int, m: Int, d: Int
    }
    public struct ScrollWeek: Equatable {
        public var week: Week
        public var days: [DayRef]
    }
    /// 日番号 n を含む週の、いちばん左の日の番号
    public static func weekStartOf(_ n: Int, weekStart ws: Int) -> Int {
        let dow = ((n % 7) + 7 + 4) % 7
        return n - ((dow - ws) % 7 + 7) % 7
    }
}

/// 縦の表示で作った週を取っておく（予定・設定が同じなら作り直さない）
final class ScrollWeekCache {
    static let shared = ScrollWeekCache()
    private let lock = NSLock()
    private weak var ix: EventDayIndex?
    private var ctx: MonthWeeksKey?
    private var weeks: [Int: (overlay: [[String: JSONValue]], week: MonthCore.ScrollWeek)] = [:]

    func get(_ ix: EventDayIndex, _ ctx: MonthWeeksKey, _ start: Int, _ overlay: [[String: JSONValue]]) -> MonthCore.ScrollWeek? {
        lock.lock(); defer { lock.unlock() }
        guard self.ix === ix, self.ctx == ctx, let hit = weeks[start], hit.overlay == overlay else { return nil }
        return hit.week
    }
    func put(_ ix: EventDayIndex, _ ctx: MonthWeeksKey, _ start: Int, _ overlay: [[String: JSONValue]], _ w: MonthCore.ScrollWeek) {
        lock.lock(); defer { lock.unlock() }
        if self.ix !== ix || self.ctx != ctx { weeks = [:]; self.ix = ix; self.ctx = ctx }
        // 見えている週と、その前後を行き来するぶんだけ
        if weeks.count > 300 { weeks = [:] }
        weeks[start] = (overlay, w)
    }
}

extension AppCore {
    /// start 日（週のいちばん左）から 7 日の週。帯の積み方・色・「+N件」は buildWeeks と同じ
    public func buildScrollWeek(_ start: Int, lanes lanesN: Int = MonthCore.maxLanes, overlay: [[String: JSONValue]] = [], wageOn: Bool, dark: Bool, sysZoom: Double = 1) -> MonthCore.ScrollWeek {
        let ix = EventDayIndex.of(state["events"]?.array ?? [])
        let ctx = MonthWeeksKey(settings: state["settings"], types: state["types"], jobs: state["jobs"], today: state["today"],
                                y: 0, m: 0, lanes: lanesN, wageOn: wageOn, dark: dark, sysZoom: sysZoom, overlay: [])
        if let hit = ScrollWeekCache.shared.get(ix, ctx, start, overlay) { return hit }
        let w = buildScrollWeekRaw(start, lanes: lanesN, overlay: overlay, wageOn: wageOn, dark: dark, sysZoom: sysZoom, index: ix)
        ScrollWeekCache.shared.put(ix, ctx, start, overlay, w)
        return w
    }

    func buildScrollWeekRaw(_ start: Int, lanes lanesN: Int, overlay: [[String: JSONValue]], wageOn: Bool, dark: Bool, sysZoom: Double, index ix: EventDayIndex) -> MonthCore.ScrollWeek {
        let weekA = start, weekB = start + 6
        let t = state["today"]
        let todayN: Int? = t.flatMap { JS.truthy($0) ? Civil.dayNo(JS.int($0["y"]), JS.int($0["m"]), JS.int($0["d"])) : nil }
        let hideCanceled = JS.truthy(settings["hideCanceled"])
        var pool = ix.overlapping(weekA, weekB).filter { e in !(hideCanceled && e["status"] == "nakunatta") }
        pool += overlay
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
            let v = pillView(ev, wageOn: wageOn, startsHere: a == Self.evFrom(ev), endsHere: b == Self.evTo(ev), dark: dark, sysZoom: sysZoom)
            bars.append(.init(key: JS.string(ev["id"]) + "-s\(start)", id: ev["id"] ?? .null, text: v.text, mark: v.mark, c0: a - weekA, span: b - a + 1, lane: li, style: v.style))
        }
        var days: [MonthCore.DayRef] = []
        let slots: [MonthCore.Slot] = (0..<7).map { i in
            let n = start + i
            let c = Civil.fromDayNo(n)
            days.append(.init(y: c.y, m: c.m, d: c.d))
            let dow = Civil.weekday(c.y, c.m, c.d)
            let hol = Holidays.name(c.y, c.m, c.d)
            let dayColor = (hol != nil || dow == 0) ? MonthCore.holidayRed : dow == 6 ? MonthCore.saturdayBlue : "var(--ink)"
            if n == todayN { return .init(day: c.d, blank: false, color: "var(--card)", today: true, todayBg: dayColor, bg: "var(--today-bg)", weight: 700) }
            return .init(day: c.d, blank: false, color: dayColor, today: false, todayBg: nil, bg: "var(--card)", weight: (hol != nil || dow == 0 || dow == 6) ? 600 : 500)
        }
        let more = overflow.keys.sorted().map { MonthCore.More(n: overflow[$0]!, col: $0 - weekA) }
        return .init(week: .init(slots: slots, bars: bars, more: more, lanes: lanesN), days: days)
    }
}
