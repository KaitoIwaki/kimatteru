import XCTest
@testable import LukkoKit

/// 月を縦につなげた表示の週（buildScrollWeek）。横の月表示（buildWeeks）と同じ予定が、同じ日に出るか
final class MonthScrollTests: XCTestCase {
    private func ev(_ id: String, _ y: Int, _ m: Int, _ d: Int, days: Int = 1, status: String = "kakutei") -> JSONValue {
        var o: [String: JSONValue] = ["id": .string(id), "y": .number(Double(y)), "m": .number(Double(m)), "day": .number(Double(d)),
                                      "start": "10:00", "end": "11:00", "title": .string(id), "type": "yoji", "status": .string(status), "updatedAt": 1]
        if days > 1 { o["allDay"] = true; o["days"] = .number(Double(days)) }
        return .object(o)
    }

    private func core(_ events: [JSONValue], weekStart: Int = 0) -> AppCore {
        // 今日は 2026/10/20
        let now = JSDate.make(2026, 9, 20, 9, 0, 0, TimeZone(identifier: "Asia/Tokyo")!)
        var st = Engine.defaultState(now: now, tz: TimeZone(identifier: "Asia/Tokyo")!)
        st["events"] = .array(events)
        var s = st["settings"]?.object ?? [:]
        s["weekStart"] = .number(Double(weekStart))
        st["settings"] = .object(s)
        return AppCore(state: st)
    }

    func testWeekStartOf() {
        // 2026/10/1 は木曜。日曜はじまりなら 9/27、月曜はじまりなら 9/28 の週
        let n = Civil.dayNo(2026, 9, 1)
        XCTAssertEqual(MonthCore.weekStartOf(n, weekStart: 0), Civil.dayNo(2026, 8, 27))
        XCTAssertEqual(MonthCore.weekStartOf(n, weekStart: 1), Civil.dayNo(2026, 8, 28))
        // 週のはじまりの日そのものは、その日から
        XCTAssertEqual(MonthCore.weekStartOf(Civil.dayNo(2026, 8, 27), weekStart: 0), Civil.dayNo(2026, 8, 27))
    }

    /// 月の境目の週：前の月の日も本物の日として並び、月をまたぐ予定は 1 本の帯になる
    func testBoundaryWeek() {
        let c = core([ev("a", 2026, 8, 30), ev("b", 2026, 9, 2), ev("span", 2026, 8, 30, days: 2)])
        let w = c.buildScrollWeek(Civil.dayNo(2026, 8, 27), lanes: 4, wageOn: false, dark: false)
        XCTAssertEqual(w.days.map { $0.d }, [27, 28, 29, 30, 1, 2, 3])
        XCTAssertEqual(w.days[3], MonthCore.DayRef(y: 2026, m: 8, d: 30))
        XCTAssertEqual(w.days[4], MonthCore.DayRef(y: 2026, m: 9, d: 1))
        XCTAssertFalse(w.week.slots.contains { $0.blank }, "縦の表示では、どの日も押せる")
        let span = w.week.bars.first { $0.id == "span" }
        XCTAssertEqual(span?.c0, 3); XCTAssertEqual(span?.span, 2)
        XCTAssertEqual(w.week.bars.first { $0.id == "a" }?.c0, 3)
        XCTAssertEqual(w.week.bars.first { $0.id == "b" }?.c0, 5)
    }

    func testToday() {
        let c = core([])
        let w = c.buildScrollWeek(MonthCore.weekStartOf(Civil.dayNo(2026, 9, 20), weekStart: 0), wageOn: false, dark: false)
        XCTAssertEqual(w.week.slots.filter { $0.today }.map { $0.day }, [20])
        // ほかの月の同じ日（11/20）は今日にしない
        let w2 = c.buildScrollWeek(MonthCore.weekStartOf(Civil.dayNo(2026, 10, 20), weekStart: 0), wageOn: false, dark: false)
        XCTAssertTrue(w2.week.slots.allSatisfy { !$0.today })
    }

    /// 月の中の日については、横の月表示と同じ予定が並ぶ（どちらの週はじまりでも）
    func testSameEventsAsMonth() {
        var evs: [JSONValue] = []
        for d in stride(from: 1, through: 31, by: 2) { evs.append(ev("o\(d)", 2026, 9, d, status: d % 3 == 0 ? "mikakutei" : "kakutei")) }
        evs.append(ev("trip", 2026, 9, 30, days: 4))
        evs.append(ev("sep", 2026, 8, 29, days: 3))
        for ws in [0, 1] {
            let c = core(evs, weekStart: ws)
            let month = c.buildWeeks(2026, 9, lanes: 7, wageOn: false, dark: false)
            func idsByDay(_ weeks: [(slots: [Int?], bars: [MonthCore.Bar])]) -> [Int: Set<String>] {
                var out: [Int: Set<String>] = [:]
                for w in weeks { for b in w.bars { for col in b.c0..<(b.c0 + b.span) { if let d = w.slots[col] { out[d, default: []].insert(JS.string(b.id)) } } } }
                return out
            }
            let fromMonth = idsByDay(month.map { w in (w.slots.map { $0.blank ? nil : $0.day }, w.bars) })
            var scrollWeeks: [(slots: [Int?], bars: [MonthCore.Bar])] = []
            var start = MonthCore.weekStartOf(Civil.dayNo(2026, 9, 1), weekStart: ws)
            while start <= Civil.dayNo(2026, 9, 31) {
                let w = c.buildScrollWeek(start, lanes: 7, wageOn: false, dark: false)
                scrollWeeks.append((w.days.map { $0.m == 9 ? $0.d : nil }, w.week.bars))
                start += 7
            }
            XCTAssertEqual(idsByDay(scrollWeeks), fromMonth, "週のはじまり \(ws)")
        }
    }
}
