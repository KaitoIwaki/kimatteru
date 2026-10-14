import XCTest
@testable import LukkoKit

/// 控え（バックアップ）を作る・読む・戻すが、Web 版と 1 つ残らず同じか（golden/backup.json）
final class BackupGoldenTests: XCTestCase {
    func testBackup() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/backup", withExtension: "json"))
        let g = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
        let keys = (g["keys"]?.array ?? []).compactMap { $0.string }
        var fails = 0
        func check(_ got: JSONValue?, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != want { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(String(describing: got))\n≠\n\(String(describing: want))") } }
        }
        // 控えの中身を作る
        for (i, c) in (g["make"]?.array ?? []).enumerated() {
            let got = Backup.object(c["state"]?.object ?? [:], appVersion: "0.0.0", now: c["now"]?.number ?? 0)
            check(got, c["backup"], "make #\(i)")
            // 文字にして読み直しても同じ（書き出しの形でも）
            let st = c["state"]?.object ?? [:]
            for pretty in [false, true] {
                let text = Backup.text(st, appVersion: "0.0.0", now: c["now"]?.number ?? 0, pretty: pretty)
                check(try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8)), c["backup"], "make #\(i) 読み直し")
            }
        }
        // 読む・戻す
        var restored = 0
        for (i, c) in (g["cases"]?.array ?? []).enumerated() {
            let eng = Engine(state: c["init"]?.object ?? [:], now: c["now"]?.number ?? 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
            var backups = 0
            eng.onBackup = { _ in backups += 1 }
            var mapG: [String: String] = [:], mapW: [String: String] = [:]
            let r = Backup.parse(c["text"]?.string ?? "", makeId: { eng.uid("x") })
            check(ActionsGoldenTests.normalize(r, &mapG), ActionsGoldenTests.normalize(c["parsed"] ?? .null, &mapW), "#\(i) 読む \(c["text"]?.string?.prefix(40) ?? "")")
            guard r["error"] == nil, let want = c["state"] else { continue }
            var rr = r.object ?? [:]
            if c["merge"] == .bool(true) { rr["merge"] = .bool(true) }
            eng.set(["confirmRestore": .object(rr)])
            eng.doRestore()
            restored += 1
            check(.number(Double(backups)), c["backups"], "#\(i) 戻す前の控え")
            var o: [String: JSONValue] = [:]
            for k in keys { if let v = eng.state[k] { o[k] = v } }
            let got = ActionsGoldenTests.normalize(.object(o), &mapG), w = ActionsGoldenTests.normalize(want, &mapW)
            if got != w {
                let go = got.object ?? [:], wo = w.object ?? [:]
                let diff = keys.filter { go[$0] != wo[$0] }
                check(.object(go.filter { diff.contains($0.key) }), .object(wo.filter { diff.contains($0.key) }), "#\(i) 戻したあと（merge=\(c["merge"] ?? .null)） 違う項目 \(diff)")
            }
        }
        XCTAssertGreaterThan(restored, 100)
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
