import XCTest
@testable import LukkoKit

/// 起動したときの中身・日付の変わり目・戻ってきたとき・画面の行き来が、Web 版と同じか（golden/boot.json）
final class BootGoldenTests: XCTestCase {
    func testBoot() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/boot", withExtension: "json"))
        let g = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
        let tz = TimeZone(identifier: "Asia/Tokyo")!
        var fails = 0
        func check(_ got: JSONValue?, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if (got ?? .null) != (want ?? .null) { fails += 1; if fails <= 20 { XCTFail("\(what())：\n\(String(describing: got))\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in (g["defaults"]?.array ?? []).enumerated() {
            let got = Engine.defaultState(now: c["now"]?.number ?? 0, tz: tz)
            let want = c["state"]?.object ?? [:]
            for k in Set(got.keys).union(want.keys) { check(got[k], want[k], "defaults #\(i) \(k)") }
        }
        let keys = ["screen", "returnTo", "detailId", "dayNum", "ym", "freeYM", "freeDir", "today", "dialog", "notices", "settings", "flashToday", "weekAnchor", "swipeRow", "dayFrom", "dayDir", "detailMenu", "locked", "noticeOpen"]
        for (i, c) in (g["steps"]?.array ?? []).enumerated() {
            var st = c["init"]?.object ?? [:]
            st["events"] = c["events"]
            let eng = Engine(state: st, now: c["now"]?.number ?? 0, timeZone: tz)
            for (si, s) in (c["steps"]?.array ?? []).enumerated() {
                let op = s["op"] ?? .null
                switch op["call"]?.string {
                case "checkToday": eng.checkToday()
                case "onReturn": eng.onReturn(awayMs: op["away"]?.number ?? 0, lockAvailable: op["lockAvailable"] == .bool(true))
                case "openFor":
                    let ev = (eng.state["events"]?.array ?? []).compactMap { $0.object }.first { $0["id"] == op["id"] } ?? [:]
                    eng.openFor(ev, op["from"])
                case "openDay": eng.openDay(op["d"]?.int ?? 0)
                case "goToday": eng.goToday()
                case "shiftFree": eng.shiftFree(op["dir"]?.int ?? 0)
                case "openNotice": eng.openNotice(op["id"])
                case "markAllRead": eng.markAllRead()
                case "refreshNotif": eng.refreshNotif()
                default: XCTFail("知らない操作 \(op)")
                }
                var o: [String: JSONValue] = [:]
                for k in keys { if let v = eng.state[k] { o[k] = v } }
                check(.object(o), s["state"], "#\(i).\(si) \(op["call"]?.string ?? "")")
            }
            for (di, d) in (c["dirty"]?.array ?? []).enumerated() {
                eng.set(["draft": d["draft"], "screen": d["screen"], "events": d["events"]])
                check(.bool(eng.draftDirty()), d["out"], "#\(i) 書きかけ \(di)")
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    func testShareText() {
        let eng = Engine(state: [:], now: 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
        XCTAssertEqual(eng.shareText(["y": 2026, "m": 9, "day": 3, "start": "19:00", "end": "21:00", "title": "歓迎会", "place": "渋谷", "status": "mikakutei"]),
                       "10/3（土）19:00〜21:00 歓迎会 @渋谷（まだ仮）\n地図：https://maps.apple.com/?q=%E6%B8%8B%E8%B0%B7")
        XCTAssertEqual(eng.shareText(["y": 2026, "m": 9, "day": 3, "allDay": true, "days": 2, "title": "旅行", "place": "https://x.test/a b", "link": "https://zoom.us/j/1", "status": "kakutei"]),
                       "10/3（土）から2日間 旅行\nhttps://zoom.us/j/1")
        XCTAssertEqual(JS.encodeURIComponent("a b&c/d?é'()*~"), "a%20b%26c%2Fd%3F%C3%A9'()*~")
    }
}
