import XCTest
@testable import LukkoKit

/// 通知の予約・朝晩のまとめ・通知の ID が、Web 版と 1 つ残らず同じか（golden/notify.json）
final class NotifyGoldenTests: XCTestCase {
    func testNotify() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/notify", withExtension: "json"))
        let g = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
        var fails = 0
        func check(_ got: JSONValue?, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != want { fails += 1; if fails <= 30 { XCTFail("\(what())：\(String(describing: got)) ≠ \(String(describing: want))") } }
        }
        for (i, c) in (g["cases"]?.array ?? []).enumerated() {
            let n = (c["now"]?.array ?? []).compactMap { $0.int }
            let now = NotifyCore.LocalTime(n[0], n[1], n[2], n[3], n[4])
            let events = (c["events"]?.array ?? []).compactMap { $0.object }
            let settings = c["settings"]?.object ?? [:]
            check(.array(NotifyCore.buildSchedule(events, settings, now: now).map { $0.json }), c["schedule"], "#\(i) buildSchedule")
            for d in c["digests"]?.array ?? [] {
                let a = d.array ?? []
                let y = a[0].int!, m = a[1].int!, dd = a[2].int!
                check(NotifyCore.dayDigest(events, y, m, dd, false)?.json ?? .null, a[3], "#\(i) dayDigest \(y)-\(m)-\(dd)")
                check(NotifyCore.dayDigest(events, y, m, dd, true)?.json ?? .null, a[4], "#\(i) dayDigest hide \(y)-\(m)-\(dd)")
            }
        }
        for p in g["ids"]?.array ?? [] {
            let a = p.array ?? []
            check(.number(Double(NotifyCore.numericId(a[0].string ?? ""))), a[1], "numericId \(a[0])")
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
