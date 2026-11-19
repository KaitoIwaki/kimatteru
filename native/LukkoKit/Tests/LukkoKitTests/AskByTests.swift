import XCTest
@testable import LukkoKit

/// 点線の予定の「決める期限」（askBy）
final class AskByTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Tokyo")!
    // 今日：2026 年 11 月 19 日（m は 0 始まりで 10）の 9:00
    private let now = NotifyCore.LocalTime(2026, 10, 19, 9, 0)

    private func engine(_ events: [[String: JSONValue]] = []) -> Engine {
        let n = JSDate.make(2026, 10, 19, 9, 0, 0, tz)
        var st = Engine.defaultState(now: n, tz: tz)
        st["events"] = .array(events.map { .object($0) })
        return Engine(state: st, now: n, timeZone: tz)
    }
    private func ev(_ id: String = "a", day: Int = 25, status: String = "mikakutei", askBy: JSONValue? = ["y": 2026, "m": 10, "d": 22]) -> [String: JSONValue] {
        var e: [String: JSONValue] = ["id": .string(id), "type": "asobi", "title": "飲み会", "y": 2026, "m": 10, "day": .number(Double(day)),
                                      "start": "19:00", "end": "21:00", "status": .string(status), "updatedAt": 1]
        if let askBy { e["askBy"] = askBy }
        return e
    }
    private func asks(_ events: [[String: JSONValue]]) -> [NotifyCore.Notif] {
        NotifyCore.buildSchedule(events, [:], now: now).filter { $0.id == NotifyCore.numericId("k" + JS.string($0.extra["eventId"])) }
    }

    // MARK: 選べる期限

    func testChoicesBeforeEventDay() {
        let c = AskBy.choices(today: (2026, 10, 19), event: (2026, 10, 25))
        XCTAssertEqual(c.map { $0.key }, ["tomorrow", "3d", "eve"], "1週間後（26日）は予定より後なので出さない")
        XCTAssertEqual(c.map { $0.d }, [20, 22, 24])
        XCTAssertTrue(AskBy.choices(today: (2026, 10, 19), event: (2026, 10, 20)).isEmpty, "予定が明日なら、選べる期限は無い")
        XCTAssertEqual(AskBy.choices(today: (2026, 10, 19), event: nil).map { $0.key }, ["tomorrow", "3d", "1w"], "日にち未定は予定の日を問わない")
        // 3日後と予定の前日が同じ日なら、1 つにまとめる
        XCTAssertEqual(AskBy.choices(today: (2026, 10, 19), event: (2026, 10, 23)).map { $0.key }, ["tomorrow", "3d"])
        // 月をまたぐ
        XCTAssertEqual(AskBy.choices(today: (2026, 10, 29), event: nil).map { "\($0.m)-\($0.d)" }, ["10-30", "11-2", "11-6"])
    }

    // MARK: 予約

    func testNotifiesOnDeadlineMorning() {
        let r = asks([ev()])
        XCTAssertEqual(r.count, 1)
        XCTAssertEqual(r.first?.at, NotifyCore.LocalTime(2026, 10, 22, 9, 0))
        XCTAssertEqual(r.first?.actionTypeId, "UNDECIDED", "決まった・無くなったのボタンが付かない")
        XCTAssertEqual(r.first?.extra["kind"], "remind", "押したときに予定が開かない")
        XCTAssertEqual(r.first?.title, "飲み会、決まりましたか？")
        XCTAssertEqual(r.first?.body, "決める期限は今日です（11月25日（水）の予定）")
    }

    func testNotScheduledWhenNotNeeded() {
        XCTAssertTrue(asks([ev(status: "kakutei")]).isEmpty, "決まった予定に期限の通知が出る")
        XCTAssertTrue(asks([ev(status: "nakunatta")]).isEmpty)
        XCTAssertTrue(asks([ev(askBy: ["y": 2026, "m": 10, "d": 18])]).isEmpty, "過ぎた期限で出る")
        XCTAssertTrue(asks([ev(day: 22, askBy: ["y": 2026, "m": 10, "d": 23])]).isEmpty, "予定が始まった後の期限で出る")
        XCTAssertTrue(asks([ev(askBy: "2026-11-22")]).isEmpty, "形の違う値で出る")
        XCTAssertTrue(asks([ev(askBy: ["y": 2026, "m": 14, "d": 22])]).isEmpty)
        XCTAssertTrue(asks([ev(askBy: nil)]).isEmpty)
    }

    func testHiddenTitle() {
        var e = ev(); e["secret"] = true
        XCTAssertEqual(asks([e]).first?.title, "まだの予定、決まりましたか？", "名前を隠した予定の名前が通知に出る")
    }

    // MARK: 予定を作る画面

    private func draft(_ e: Engine) -> [String: JSONValue] { e.state["draft"]?.object ?? [:] }

    func testFormPickAndSave() {
        let e = engine()
        e.openNew(25, "month")
        XCTAssertFalse(e.formView().askShown, "塗りの予定に期限の行が出る")
        e.setStatus("mikakutei")
        var v = e.formView()
        XCTAssertTrue(v.askShown)
        XCTAssertEqual(v.askValue, "なし")
        XCTAssertEqual(v.askChips.map { $0.label }, ["なし", "明日", "3日後", "予定の前日"])
        e.setAskBy("3d")
        v = e.formView()
        XCTAssertEqual(v.askValue, "11月22日（日）")
        XCTAssertEqual(v.askChips.filter { $0.sel }.map { $0.label }, ["3日後"])
        // 同じのを押すと外れる
        e.setAskBy("3d")
        XCTAssertNil(draft(e)["askBy"])
        e.setAskBy("eve")
        e.save()
        let saved = e.state["events"]?.array?.first?.object ?? [:]
        XCTAssertEqual(saved["askBy"], ["y": 2026, "m": 10, "d": 24])
        // 開き直すと残っている。決まったにして保存すると消える
        e.openEdit(saved, "month")
        XCTAssertEqual(e.formView().askValue, "11月24日（火）")
        e.setStatus("kakutei")
        e.save()
        XCTAssertNil(e.state["events"]?.array?.first?["askBy"], "決まったにしたのに期限が残る")
    }

    func testDetailText() {
        let e = engine([ev(), ev("b", askBy: ["y": 2026, "m": 10, "d": 18])])
        e.set(["detailId": "a"])
        XCTAssertEqual(e.detailView().askText, "11月22日（日）までに決める")
        XCTAssertFalse(e.detailView().askLate)
        e.set(["detailId": "b"])
        XCTAssertEqual(e.detailView().askText, "決める期限を過ぎています（11月18日（水））")
        XCTAssertTrue(e.detailView().askLate)
    }

    /// 通知の「決まった」で、予定が決まる（期限の通知も、いつもの点線の通知と同じボタン）
    func testNotificationConfirm() {
        let e = engine([ev()])
        e.handleNotificationTap(eventId: "a", kind: "remind", actionId: "yes", extra: [:])
        XCTAssertEqual(e.state["events"]?.array?.first?["status"], "kakutei")
    }

    /// 「まだ」の一覧：期限を付けた予定は、期限の近い順に「そろそろ決める」へ。下の日付の並びには重ねて出さない
    func testUndecidedListSoonGroup() {
        let e = engine([ev("a", day: 25, askBy: ["y": 2026, "m": 10, "d": 22]), ev("b", day: 28, askBy: ["y": 2026, "m": 10, "d": 20]),
                        ev("c", day: 26, askBy: ["y": 2026, "m": 10, "d": 18]), ev("n", day: 24, askBy: nil)])
        e.set(["listTab": "undecided"])
        let g = e.listView(dark: false).groups
        XCTAssertEqual(g.first?.head, "そろそろ決める")
        XCTAssertEqual(g.first?.rows.map { JS.string($0.key) }, ["c", "b", "a"], "期限の近い順でない")
        XCTAssertEqual(g.first?.rows.map { $0.ask }, ["期限を過ぎました", "あと1日", "あと3日"])
        let rest = g.dropFirst().flatMap { $0.rows.map { JS.string($0.key) } }
        XCTAssertEqual(rest, ["n"], "期限のある予定が下にも重ねて出る")
    }

    /// まとめ：その月に決まった数・まだの数
    func testReportCounts() {
        var k = ev("k", status: "kakutei"); k["askBy"] = nil
        let e = engine([ev("a"), ev("b"), k, ev("w", status: "jisseki"), ev("g", status: "nakunatta"), ev("x", status: "kakutei").merging(["m": 9]) { $1 }])
        e.set(["ym": ["y": 2026, "m": 10]])
        let v = e.reportView()
        XCTAssertEqual(v.monthDecided, 2, "決まった・働いた記録を数えない、または別の月まで数える")
        XCTAssertEqual(v.monthUndecided, 2)
    }

    /// 読み込みと同期で消えない
    func testKeptThroughLoadAndSync() {
        let list = Loader.sanitizeEvents(.array([.object(ev())]), makeId: { "x" })
        XCTAssertEqual(list.first?["askBy"], ["y": 2026, "m": 10, "d": 22])
        var newer = ev(); newer["updatedAt"] = 5
        let merged = SyncCore.mergeSync(local: ["events": .array([.object(ev(askBy: nil))])], remote: .object(["events": .array([.object(newer)])]))
        XCTAssertEqual(merged?["events"]?.array?.first?["askBy"], ["y": 2026, "m": 10, "d": 22])
    }
}
