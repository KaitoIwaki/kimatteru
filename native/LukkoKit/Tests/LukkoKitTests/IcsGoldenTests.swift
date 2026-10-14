import XCTest
@testable import LukkoKit

/// .ics の書き出しと読み込みが、Web 版と 1 つ残らず同じか（golden/ics.json）
final class IcsGoldenTests: XCTestCase {
    func testIcs() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/ics", withExtension: "json"))
        let g = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
        let tz = TimeZone(identifier: "Asia/Tokyo")!
        let n = (g["now"]?.array ?? []).compactMap { $0.int }
        // 書き出した時刻（UTC）。日本の 2026-10-15 10:30:05 は UTC で 01:30:05
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        let date = cal.date(from: DateComponents(year: n[0], month: n[1] + 1, day: n[2], hour: n[3], minute: n[4], second: n[5]))!
        var uc = Calendar(identifier: .gregorian); uc.timeZone = TimeZone(identifier: "UTC")!
        let u = uc.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        let stamp = (u.year!, u.month! - 1, u.day!, u.hour!, u.minute!, u.second!)
        var fails = 0
        func check(_ got: JSONValue?, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != want { fails += 1; if fails <= 20 { XCTFail("\(what())：\n\(String(describing: got))\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in (g["exportCases"]?.array ?? []).enumerated() {
            let evs = c["events"]?.array ?? []
            // 書き出しの名前は、正解表を作ったときと同じものを使う（X-WR-CALNAME の行から読む）
            let want = c["text"]?.string ?? ""
            let name = want.contains("X-WR-CALNAME:私の\\,予定") ? "私の,予定" : "LUKKO"
            let text = IcsCore.toIcs(evs, name: name, stampUTC: stamp)
            check(.string(text), c["text"], "#\(i) toIcs")
            check(.array(IcsCore.parseIcs(want, today: (n[0], n[1], n[2]), tz: tz)), c["parsed"], "#\(i) parse(toIcs)")
        }
        for (i, c) in (g["parseCases"]?.array ?? []).enumerated() {
            check(.array(IcsCore.parseIcs(c["text"]?.string ?? "", today: (n[0], n[1], n[2]), tz: tz)), c["parsed"], "sample #\(i) parseIcs")
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
