import XCTest
@testable import LukkoKit

/// ウィジェットの「決まった」
final class WidgetConfirmTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Tokyo")!

    private func engine() -> Engine {
        let n = JSDate.make(2026, 10, 19, 9, 0, 0, tz)
        var st = Engine.defaultState(now: n, tz: tz)
        func ev(_ id: String, _ status: String) -> JSONValue {
            .object(["id": .string(id), "type": "asobi", "title": "飲み会", "y": 2026, "m": 10, "day": 25, "start": "19:00", "end": "21:00",
                     "status": .string(status), "updatedAt": 1])
        }
        st["events"] = .array([ev("a", "mikakutei"), ev("b", "mikakutei"), ev("k", "kakutei"), ev("g", "nakunatta")])
        return Engine(state: st, now: n, timeZone: tz)
    }
    private func status(_ e: Engine, _ id: String) -> JSONValue? {
        (e.state["events"]?.array ?? []).first { $0["id"] == .string(id) }?["status"]
    }

    func testEntriesRoundTrip() {
        let s = [WidgetConfirm.entry(id: "a", atMs: 1_790_000_000_000), "壊れた", "123|", WidgetConfirm.entry(id: "n-1|x", atMs: 5)]
        XCTAssertEqual(WidgetConfirm.ids(s), ["a", "n-1|x"], "形の崩れた頼みを読む、または id の中の | で切れる")
    }

    func testApplyOnlyUndecided() {
        let e = engine()
        XCTAssertEqual(e.applyWidgetConfirms(["a", "k", "g", "zz"]), 1)
        XCTAssertEqual(status(e, "a"), "kakutei")
        XCTAssertEqual(status(e, "g"), "nakunatta", "無くなった予定が決まったになった")
        XCTAssertEqual(e.state["undo"]?["text"], "ウィジェットで「飲み会」が決まりました")
        // 同じ頼みがもう一度来ても、何もしない（二重に数えない）
        XCTAssertEqual(e.applyWidgetConfirms(["a"]), 0)
    }

    func testManyAndUndo() {
        let e = engine()
        XCTAssertEqual(e.applyWidgetConfirms(["a", "b"]), 2)
        XCTAssertEqual(e.state["undo"]?["text"], "ウィジェットで2件が決まりました")
        e.undoLast()
        XCTAssertEqual(status(e, "a"), "mikakutei", "元に戻すで戻らない")
        XCTAssertEqual(status(e, "b"), "mikakutei")
    }
}
