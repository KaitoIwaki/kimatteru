import XCTest
@testable import LukkoKit

/// 評価を頼むとき（使い始めて 3 日・前に頼んでから 30 日・確定 3 回目・送ったとき・開いたとき 7 日と 10 件）
final class ReviewAskTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Tokyo")!
    private let day = 86_400_000.0

    private func engine(firstDaysAgo: Double?, lastAskDaysAgo: Double? = nil, confirmCount: Int? = nil, events: Int = 0) -> Engine {
        let now = JSDate.make(2026, 10, 10, 12, 0, 0, tz)
        var st = Engine.defaultState(now: now, tz: tz)
        var s = st["settings"]?.object ?? [:]
        if let f = firstDaysAgo { s["firstUseAt"] = .number(now - f * day) }
        if let l = lastAskDaysAgo { s["lastReviewAsk"] = .number(now - l * day) }
        if let c = confirmCount { s["confirmCount"] = .number(Double(c)) }
        st["settings"] = .object(s)
        st["events"] = .array((0..<events).map { i in .object(["id": .string("e\(i)"), "y": 2026, "m": 10, "day": .number(Double(i % 28 + 1)), "start": "10:00", "end": "11:00", "title": "a", "type": "yoji", "status": "kakutei", "updatedAt": 1]) })
        return Engine(state: st, now: now, timeZone: tz)
    }
    private func asked(_ e: Engine) -> Bool { JS.truthy(e.state["settings"]?["lastReviewAsk"]) }

    func testShareAfterThreeDays() {
        let e2 = engine(firstDaysAgo: 2); e2.maybeAskReview("share"); XCTAssertFalse(asked(e2), "2 日目では頼まない")
        let e3 = engine(firstDaysAgo: 3); e3.maybeAskReview("share"); XCTAssertTrue(asked(e3), "3 日たったら頼む")
    }
    func testThirtyDayGap() {
        let a = engine(firstDaysAgo: 40, lastAskDaysAgo: 20); a.maybeAskReview("share")
        XCTAssertEqual(a.state["settings"]?["lastReviewAsk"], .number(JSDate.make(2026, 10, 10, 12, 0, 0, tz) - 20 * day), "前に頼んでから 30 日たっていない")
        let b = engine(firstDaysAgo: 40, lastAskDaysAgo: 31); b.maybeAskReview("share")
        XCTAssertEqual(b.state["settings"]?["lastReviewAsk"], .number(JSDate.make(2026, 10, 10, 12, 0, 0, tz)), "30 日たったら、また頼める")
    }
    func testConfirmThird() {
        for (n, want) in [(2, false), (3, true), (4, false), (10, true)] {
            let e = engine(firstDaysAgo: 5, confirmCount: n); e.maybeAskReview("confirm")
            XCTAssertEqual(asked(e), want, "確定 \(n) 回目")
        }
    }
    func testOpen() {
        let few = engine(firstDaysAgo: 8, events: 9); few.maybeAskReview("open"); XCTAssertFalse(asked(few), "予定 9 件では頼まない")
        let ok = engine(firstDaysAgo: 8, events: 10); ok.maybeAskReview("open"); XCTAssertTrue(asked(ok), "8 日・10 件なら頼む")
        let early = engine(firstDaysAgo: 6, events: 30); early.maybeAskReview("open"); XCTAssertFalse(asked(early), "7 日たっていない")
    }
    func testNoFirstUse() {
        let e = engine(firstDaysAgo: nil); e.maybeAskReview("share"); XCTAssertFalse(asked(e))
    }
}
