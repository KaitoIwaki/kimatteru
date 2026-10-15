import XCTest
@testable import LukkoKit

/// 壊れた中身でも落ちないか。保存されている予定には、昔の版や手で直した控えから入った、形の崩れたものが混じることがある。
/// Web 版は NaN のまま描いて先へ進む。Swift 版は数を整数にするところで落ちうるので、ここで確かめる
final class RobustnessTests: XCTestCase {
    var seed: UInt64 = 12345
    func rnd() -> Double { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return Double(seed >> 11) / Double(1 << 53) }
    func pick<T>(_ a: [T]) -> T { a[Int(rnd() * Double(a.count)) % a.count] }

    func odd() -> JSONValue {
        pick([.null, .bool(true), .number(.infinity), .number(-1e300), .number(1e300), .number(0.5), .number(-3), .string(""), .string("x"), .string("25:99"),
              .array([]), .object([:]), .number(13), .number(99), .string("2026"), .array([.number(1)])])
    }

    func testNoCrashOnBrokenData() {
        let tz = TimeZone(identifier: "Asia/Tokyo")!
        for _ in 0..<300 {
            var events: [JSONValue] = []
            for i in 0..<Int(rnd() * 8) {
                var e: [String: JSONValue] = ["id": .string("e\(i)"), "type": pick(["yoji", "baito", "zzz", odd()]), "title": pick(["定例", odd()]),
                                              "y": pick([2026, odd()]), "m": pick([9, odd()]), "day": pick([3, 15, odd()]),
                                              "start": pick(["10:00", odd()]), "end": pick(["11:00", odd()]), "status": pick(["kakutei", "mikakutei", "jisseki", odd()])]
                if rnd() < 0.3 { e["allDay"] = odd() }
                if rnd() < 0.3 { e["days"] = odd() }
                if rnd() < 0.2 { e["remindMin"] = odd() }
                if rnd() < 0.2 { e["actualEnd"] = odd() }
                events.append(.object(e))
            }
            var settings: [String: JSONValue] = ["weekStart": pick([0, 1, odd()]), "hourly": pick([1100, odd()]), "theme": pick(["dark", odd()])]
            if rnd() < 0.3 { settings["fontScale"] = odd() }
            if rnd() < 0.3 { settings["paidLeave"] = pick([odd(), ["start": odd(), "grant": odd()]]) }
            let state: [String: JSONValue] = [
                "events": .array(events), "types": pick([.array(Loader.builtinTypes.map { .object($0) }), .array([odd()]), odd()]),
                "settings": .object(settings), "today": pick([["y": 2026, "m": 9, "d": 15], odd()]),
                "ym": pick([["y": 2026, "m": 9], odd()]), "dayNum": pick([15, odd()]), "screen": pick(["month", "new", "day"]),
                "draft": pick([["y": 2026, "m": 9, "day": 3, "start": "10:00", "end": "11:00", "type": "yoji", "status": "kakutei"], odd(),
                               ["y": odd(), "m": odd(), "day": odd(), "start": odd(), "end": odd(), "days": odd(), "repEvery": "week", "repSpan": odd(), "repDows": odd(), "pickY": odd()]]),
                "jobs": pick([.array([["id": "j1", "name": "x", "hourly": odd()]]), odd()]), "someday": pick([.array([]), odd()]), "notices": pick([.array([]), odd()]),
                "confirmDelete": pick([.null, "e0"]), "confirmRestore": pick([.null, ["count": odd(), "at": odd(), "merge": odd()]]),
            ]
            let eng = Engine(state: state, now: 1_790_000_000_000, timeZone: tz)
            let core = AppCore(state: state)
            for dark in [false, true] {
                _ = core.buildWeeks(2026, 9, wageOn: true, dark: dark)
                _ = core.dayView(2026, 9, 15, dark: dark)
                _ = core.timeGridBoxes(events.compactMap { $0.object }, over: [], 2026, 9, 15, dark: dark)
                _ = core.timeGridAllDay(events.compactMap { $0.object }, 2026, 9, 15, dark: dark)
            }
            _ = core.dayStripCell(20500, selected: 20510)
            _ = eng.monthHead()
            _ = eng.formView()
            _ = eng.alertSpec()
            _ = eng.leaveSummary()
            _ = eng.draftDirty()
            _ = NoticesCore.syncShiftNotices([], events, now: 1_790_000_000_000, tz: tz)
            _ = NotifyCore.buildSchedule(events.compactMap { $0.object }, eng.state["settings"]?.object ?? [:], now: NotifyCore.LocalTime(2026, 9, 15, 10, 0))
            _ = WidgetCore.buildPayload(eng.state, today: (2026, 9, 15), atMs: 1_790_000_000_000)
            eng.refreshNotif()
            eng.checkToday()
            eng.save()
        }
    }
}
