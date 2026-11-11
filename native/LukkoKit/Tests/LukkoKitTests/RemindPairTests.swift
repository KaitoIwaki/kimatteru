import XCTest
@testable import LukkoKit

/// 予定のお知らせを 2 つまで（remindMin と remindMin2）
final class RemindPairTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Tokyo")!
    private let now = NotifyCore.LocalTime(2026, 10, 1, 9, 0)

    private func ev(_ id: String = "a", day: Int = 10, start: String = "18:00", allDay: Bool = false, r1: JSONValue? = 60, r2: JSONValue? = 1440) -> [String: JSONValue] {
        var e: [String: JSONValue] = ["id": .string(id), "type": "yoji", "title": "ゼミ", "y": 2026, "m": 10, "day": .number(Double(day)),
                                      "start": .string(start), "end": "19:00", "status": "kakutei", "updatedAt": 1]
        if allDay { e["allDay"] = true }
        if let r1 { e["remindMin"] = r1 }
        if let r2 { e["remindMin2"] = r2 }
        return e
    }
    private func reminds(_ events: [[String: JSONValue]]) -> [NotifyCore.Notif] {
        NotifyCore.buildSchedule(events, [:], now: now).filter { $0.extra["kind"] == "remind" }
    }

    // MARK: 予約

    func testTwoRemindersBothScheduled() {
        let r = reminds([ev()])
        XCTAssertEqual(r.count, 2, "2 つとも出ない")
        XCTAssertNotEqual(r[0].id, r[1].id, "同じ ID だと上書きされて 1 つしか出ない")
        XCTAssertEqual(r.map { $0.at }, [NotifyCore.LocalTime(2026, 10, 9, 18, 0), NotifyCore.LocalTime(2026, 10, 10, 17, 0)])
        XCTAssertEqual(r[1].id, NotifyCore.numericId("ra"), "1 つ目の ID が今までと変わった")
    }

    func testSecondIgnoredWhenInvalid() {
        XCTAssertEqual(reminds([ev(r1: nil)]).count, 0, "1 つ目が無いのに 2 つ目が鳴る（古い版で「なし」にした予定）")
        XCTAssertEqual(reminds([ev(r2: 60)]).count, 1, "同じ値が 2 回鳴る")
        XCTAssertEqual(reminds([ev(allDay: true, r1: 0, r2: 10)]).count, 1, "終日なのに時刻ありの値で鳴る")
        XCTAssertEqual(reminds([ev(r2: 7)]).count, 1, "選択肢に無い値で鳴る")
        XCTAssertEqual(reminds([ev(r2: "1440")]).count, 1, "数でない値で鳴る")
        XCTAssertEqual(reminds([ev(r2: -60)]).count, 1)
    }

    func testPastOneDropped() {
        // 今日 9:00 の時点で、今日 10:00 の予定の「前日」は過ぎている → 10分前だけ
        let r = reminds([ev(day: 1, start: "10:00", r1: 10, r2: 1440)])
        XCTAssertEqual(r.map { $0.at }, [NotifyCore.LocalTime(2026, 10, 1, 9, 50)])
    }

    func testCapStillNearestSixty() {
        let events = (0..<40).map { ev("e\($0)", day: 2 + $0 % 25, start: String(format: "%02d:00", 10 + $0 % 10)) }
        let all = NotifyCore.buildSchedule(events, [:], now: now)
        XCTAssertEqual(all.count, NotifyCore.maxPending)
        XCTAssertEqual(all.map { $0.at }, all.map { $0.at }.sorted(), "近い順になっていない")
    }

    // MARK: 予定を作る画面

    private func engine(_ events: [[String: JSONValue]] = []) -> Engine {
        let n = JSDate.make(2026, 10, 1, 9, 0, 0, tz)
        var st = Engine.defaultState(now: n, tz: tz)
        st["events"] = .array(events.map { .object($0) })
        return Engine(state: st, now: n, timeZone: tz)
    }
    private func draft(_ e: Engine) -> [String: JSONValue] { e.state["draft"]?.object ?? [:] }

    func testToggleUpToTwo() {
        let e = engine()
        e.openNew(10, "month")
        e.toggleRemind(1440); e.toggleRemind(60)
        XCTAssertEqual(e.formView().remindValue, "前日・1時間前")
        XCTAssertEqual(e.formView().remindSeg.filter { $0.sel }.map { $0.label }, ["1時間前", "前日"])
        // 3 つ目を押すと、先に付けたほう（前日）が外れる
        e.toggleRemind(10)
        XCTAssertEqual(RemindPair.picked(draft(e)), [60, 10])
        // 付いているのを押すと外れる
        e.toggleRemind(60)
        XCTAssertEqual(RemindPair.picked(draft(e)), [10])
        XCTAssertNil(draft(e)["remindMin2"])
        XCTAssertEqual(e.formView().remindValue, "10分前")
        // 「なし」で全部外れる
        e.toggleRemind(1440)
        e.toggleRemind(.null)
        XCTAssertEqual(draft(e)["remindMin"], .null)
        XCTAssertNil(draft(e)["remindMin2"])
    }

    func testSaveNearFirstAndEditRoundTrip() {
        let e = engine()
        e.openNew(10, "month")
        e.toggleRemind(60); e.toggleRemind(1440)
        e.save()
        guard let saved = e.state["events"]?.array?.first?.object else { return XCTFail("保存されない") }
        XCTAssertEqual(saved["remindMin"], 60, "近いほうが remindMin でない（古い版で直前の通知が鳴らない）")
        XCTAssertEqual(saved["remindMin2"], 1440)
        // 開き直すと 2 つとも付いている
        e.openEdit(saved, "month")
        XCTAssertEqual(RemindPair.picked(draft(e)), [1440, 60])
        // 1 つに減らして保存すると、2 つ目の項目は消える
        e.toggleRemind(1440)
        e.save()
        let after = e.state["events"]?.array?.first?.object ?? [:]
        XCTAssertEqual(after["remindMin"], 60)
        XCTAssertNil(after["remindMin2"], "1 つにしたのに 2 つ目が残る")
    }

    func testOneReminderKeepsOldShape() {
        let e = engine()
        e.openNew(10, "month")
        e.toggleRemind(30)
        e.save()
        let saved = e.state["events"]?.array?.first?.object ?? [:]
        XCTAssertEqual(saved["remindMin"], 30)
        XCTAssertNil(saved["remindMin2"], "1 つだけなのに新しい項目が付く")
    }

    func testToggleAllDayKeepsWhatFits() {
        let e = engine()
        e.openNew(10, "month")
        e.toggleRemind(60); e.toggleRemind(1440)
        e.toggleAllDay()   // 終日：前日の朝（1440）は残り、1時間前は外れる → 前日の朝が 1 つ目に
        XCTAssertEqual(draft(e)["remindMin"], 1440)
        XCTAssertNil(draft(e)["remindMin2"])
        XCTAssertEqual(e.formView().remindValue, "1日前")
        e.toggleRemind(0)
        XCTAssertEqual(e.formView().remindValue, "前日の朝・当日の朝")
        e.toggleAllDay()   // 時刻あり：0 は選べない → 前日だけ
        XCTAssertEqual(RemindPair.picked(draft(e)), [1440])
    }

    func testDetailText() {
        let e = engine([ev()])
        e.set(["detailId": "a"])
        XCTAssertEqual(e.detailView().remindText, "前日・1時間前にお知らせ")
    }

    // MARK: 読み込み・同期で消えない

    func testKeptThroughLoadAndSync() {
        let list = Loader.sanitizeEvents(.array([.object(ev())]), makeId: { "x" })
        XCTAssertEqual(list.first?["remindMin2"], 1440, "読み込みで 2 つ目が消える")
        var newer = ev(); newer["updatedAt"] = 5
        let local: [String: JSONValue] = ["events": .array([.object(ev(r2: nil))])]
        let merged = SyncCore.mergeSync(local: local, remote: .object(["events": .array([.object(newer)])]))
        XCTAssertEqual(merged?["events"]?.array?.first?["remindMin2"], 1440, "同期で 2 つ目が届かない")
    }
}
