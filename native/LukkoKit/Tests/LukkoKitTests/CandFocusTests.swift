import XCTest
@testable import LukkoKit

/// 候補日をまとめて見る（candFocus）
final class CandFocusTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Tokyo")!

    private func engine() -> Engine {
        let n = JSDate.make(2026, 10, 19, 9, 0, 0, tz)
        var st = Engine.defaultState(now: n, tz: tz)
        func ev(_ id: String, _ m: Int, _ d: Int, cand: String?, status: String = "mikakutei", title: String = "飲み会") -> JSONValue {
            var e: [String: JSONValue] = ["id": .string(id), "type": "asobi", "title": .string(title), "y": 2026, "m": .number(Double(m)), "day": .number(Double(d)),
                                          "start": "19:00", "end": "21:00", "status": .string(status), "updatedAt": 1]
            if let cand { e["candId"] = .string(cand) }
            return .object(e)
        }
        st["events"] = .array([ev("a", 11, 3, cand: "k1"), ev("b", 10, 28, cand: "k1"), ev("c", 11, 5, cand: "k1"),
                               ev("x", 10, 28, cand: "k2", title: "打ち合わせ"), ev("y", 10, 28, cand: nil)])
        st["screen"] = "detail"; st["detailId"] = "a"
        return Engine(state: st, now: n, timeZone: tz)
    }

    func testFocusFromDetail() {
        let e = engine()
        XCTAssertNil(e.candFocus())
        e.focusCandidates("a")
        XCTAssertEqual(e.state["screen"], "month")
        XCTAssertEqual(e.state["ym"], ["y": 2026, "m": 10], "いちばん早い候補（11月28日）の月へ行かない")
        XCTAssertEqual(e.candFocus(), Engine.CandFocus(title: "飲み会", ids: ["a", "b", "c"]), "別の候補や候補でない予定まで入る")
        e.clearCandFocus()
        XCTAssertNil(e.candFocus())
    }

    func testEndsWhenAllResolved() {
        let e = engine()
        e.focusCandidates("a")
        // 1 つ決めて、残りを消した：まだの候補が無いので、まとめ表示は自然に消える
        var list = (e.state["events"]?.array ?? []).compactMap { $0.object }
        for i in list.indices where list[i]["candId"] == "k1" { list[i]["status"] = list[i]["id"] == "a" ? "kakutei" : "nakunatta" }
        e.set(["events": .array(list.map { .object($0) })])
        XCTAssertNil(e.candFocus())
    }

    func testNotCandidateDoesNothing() {
        let e = engine()
        e.focusCandidates("y")
        XCTAssertNil(e.candFocus())
        XCTAssertEqual(e.state["screen"], "detail")
    }
}
