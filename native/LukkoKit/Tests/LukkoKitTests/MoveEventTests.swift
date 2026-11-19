import XCTest
@testable import LukkoKit

/// 帯を長押しして別の日へ動かす
final class MoveEventTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Tokyo")!

    private func engine() -> Engine {
        let n = JSDate.make(2026, 10, 19, 9, 0, 0, tz)
        var st = Engine.defaultState(now: n, tz: tz)
        func ev(_ id: String, _ d: Int, _ status: String, extra: [String: JSONValue] = [:]) -> JSONValue {
            var e: [String: JSONValue] = ["id": .string(id), "type": "asobi", "title": "ランチ", "y": 2026, "m": 10, "day": .number(Double(d)),
                                          "start": "12:00", "end": "13:00", "status": .string(status), "updatedAt": 1, "remindMin": 60]
            for (k, v) in extra { e[k] = v }
            return .object(e)
        }
        st["events"] = .array([ev("a", 20, "kakutei"), ev("b", 21, "mikakutei"), ev("w", 10, "jisseki"), ev("g", 22, "nakunatta"),
                               ev("t", 28, "kakutei", extra: ["allDay": true, "days": 3])])
        return Engine(state: st, now: n, timeZone: tz)
    }
    private func get(_ e: Engine, _ id: String) -> [String: JSONValue] {
        (e.state["events"]?.array ?? []).compactMap { $0.object }.first { $0["id"] == .string(id) } ?? [:]
    }

    func testMoveKeepsTimeAndUndo() {
        let e = engine()
        e.moveEvent("a", to: 2026, 11, 2)
        let a = get(e, "a")
        XCTAssertEqual(a["m"], 11, "月をまたいで動かない"); XCTAssertEqual(a["day"], 2); XCTAssertEqual(a["y"], 2026)
        XCTAssertEqual(a["start"], "12:00"); XCTAssertEqual(a["remindMin"], 60, "動かしたらお知らせが消えた")
        XCTAssertEqual(e.state["undo"]?["text"], "「ランチ」を12月2日に動かしました")
        e.undoLast()
        XCTAssertEqual(get(e, "a")["day"], 20, "元に戻すで戻らない")
        XCTAssertEqual(get(e, "a")["m"], 10)
    }

    func testMultiDayKeepsLength() {
        let e = engine()
        e.moveEvent("t", to: 2026, 10, 25)
        XCTAssertEqual(get(e, "t")["day"], 25)
        XCTAssertEqual(get(e, "t")["days"], 3, "何日間かが変わった")
    }

    func testOnlyPlannedOnesMove() {
        let e = engine()
        e.moveEvent("b", to: 2026, 10, 24)
        XCTAssertEqual(get(e, "b")["day"], 24, "点線の予定が動かない")
        e.moveEvent("w", to: 2026, 10, 24)
        XCTAssertEqual(get(e, "w")["day"], 10, "働いた記録が動いた")
        e.moveEvent("g", to: 2026, 10, 24)
        XCTAssertEqual(get(e, "g")["day"], 22, "無くなった予定が動いた")
        // 同じ日に置いたら何もしない（元に戻すも出さない）
        let before = e.state["undo"]
        e.moveEvent("a", to: 2026, 10, 20)
        XCTAssertEqual(e.state["undo"], before)
    }

    func testDraggedId() {
        XCTAssertEqual(Engine.draggedId(["lukko-event:a"]), "a")
        XCTAssertNil(Engine.draggedId(["https://example.com"]), "ほかのアプリの文字で予定が動く")
        XCTAssertEqual(Engine.draggedId(["x", "lukko-event:b"]), "b")
    }
}
