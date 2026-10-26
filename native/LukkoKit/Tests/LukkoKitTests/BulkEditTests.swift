import XCTest
@testable import LukkoKit

/// 一覧で選んだ予定を、まとめて同じ時間にする・消す。どちらも「元に戻す」でそっくり戻る
final class BulkEditTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Tokyo")!

    private func engine() -> Engine {
        let now = JSDate.make(2026, 9, 20, 9, 0, 0, tz)
        var st = Engine.defaultState(now: now, tz: tz)
        st["events"] = .array([
            .object(["id": "a", "y": 2026, "m": 9, "day": 21, "start": "10:00", "end": "11:00", "title": "ゼミ", "type": "yoji", "status": "kakutei", "updatedAt": 1]),
            .object(["id": "b", "y": 2026, "m": 9, "day": 22, "start": "00:00", "end": "23:59", "allDay": true, "days": 2, "title": "旅行", "type": "asobi", "status": "mikakutei", "updatedAt": 1]),
            .object(["id": "c", "y": 2026, "m": 9, "day": 19, "start": "17:00", "end": "22:00", "actualEnd": "21:30", "title": "バイト", "type": "baito", "status": "jisseki", "updatedAt": 1]),
            .object(["id": "d", "y": 2026, "m": 9, "day": 25, "start": "13:00", "end": "14:00", "title": "残す", "type": "yoji", "status": "kakutei", "updatedAt": 1]),
        ])
        return Engine(state: st, now: now, timeZone: tz)
    }
    private func ev(_ e: Engine, _ id: String) -> [String: JSONValue]? {
        (e.state["events"]?.array ?? []).compactMap { $0.object }.first { $0["id"] == .string(id) }
    }
    private func noStamp(_ o: [String: JSONValue]?) -> [String: JSONValue]? { o.map { var r = $0; r.removeValue(forKey: "updatedAt"); return r } }

    func testSetTimeAndUndo() {
        let e = engine()
        let before = (e.state["events"]?.array ?? []).compactMap { $0.object }
        e.bulkSetTime(["a", "b", "c"], start: "17:00", end: "22:00")
        // ふつうの予定：start・end が変わる
        XCTAssertEqual(ev(e, "a")?["start"], "17:00"); XCTAssertEqual(ev(e, "a")?["end"], "22:00")
        // 終日の予定：時間のある 1 日の予定になる
        XCTAssertEqual(ev(e, "b")?["allDay"], .bool(false)); XCTAssertNil(ev(e, "b")?["days"]); XCTAssertEqual(ev(e, "b")?["end"], "22:00")
        XCTAssertEqual(ev(e, "b")?["status"], "mikakutei", "点線は点線のまま")
        // 働いた記録：終わりは actualEnd（予定の end はそのまま）
        XCTAssertEqual(ev(e, "c")?["actualEnd"], "22:00"); XCTAssertEqual(ev(e, "c")?["end"], "22:00"); XCTAssertEqual(ev(e, "c")?["start"], "17:00")
        // 選んでいない予定は変わらない
        XCTAssertEqual(ev(e, "d"), before.first { $0["id"] == "d" })
        XCTAssertEqual(e.state["undo"]?["text"], "3件を 17:00〜22:00 にしました")
        e.undoLast()
        for o in before { XCTAssertEqual(noStamp(ev(e, JS.string(o["id"]))), noStamp(o), "元に戻す：\(JS.string(o["id"]))") }
    }

    func testSameTimeDoesNothing() {
        let e = engine()
        e.bulkSetTime(["a"], start: "10:00", end: "10:00")
        XCTAssertEqual(ev(e, "a")?["end"], "11:00")
        XCTAssertFalse(JS.truthy(e.state["undo"]))
    }

    func testDeleteAndUndo() {
        let e = engine()
        let before = (e.state["events"]?.array ?? []).compactMap { $0.object }
        e.bulkDelete(["a", "c"])
        XCTAssertNil(ev(e, "a")); XCTAssertNil(ev(e, "c")); XCTAssertNotNil(ev(e, "b")); XCTAssertNotNil(ev(e, "d"))
        let trashIds = (e.state["trash"]?.array ?? []).map { JS.string($0["ev"]?["id"]) }
        XCTAssertEqual(Set(trashIds), ["a", "c"], "消した予定は最近消した予定へ")
        XCTAssertEqual(e.state["undo"]?["text"], "2件を削除しました")
        e.undoLast()
        XCTAssertEqual((e.state["events"]?.array ?? []).count, before.count)
        for o in before {
            let id = JS.string(o["id"])
            for k in ["y", "m", "day", "start", "end", "actualEnd", "title", "type", "status"] { XCTAssertEqual(ev(e, id)?[k], o[k], "元に戻す：\(id) の \(k)") }
        }
        XCTAssertTrue((e.state["trash"]?.array ?? []).isEmpty, "戻した予定は最近消した予定から外れる")
    }

    /// 400 件より多く消しても、今消した分は全部戻せる
    func testDeleteMany() {
        let e = engine()
        let many: [JSONValue] = (0..<450).map { i in .object(["id": .string("m\(i)"), "y": 2026, "m": 10, "day": .number(Double(i % 28 + 1)), "start": "10:00", "end": "11:00",
                                                              "title": "見本", "type": "yoji", "status": "kakutei", "updatedAt": 1]) }
        e.set(["events": .array((e.state["events"]?.array ?? []) + many)])
        e.bulkDelete(many.map { $0["id"]! })
        XCTAssertEqual((e.state["events"]?.array ?? []).count, 4)
        e.undoLast()
        XCTAssertEqual((e.state["events"]?.array ?? []).count, 454)
    }
}
