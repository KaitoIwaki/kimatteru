import XCTest
@testable import LukkoKit

/// 空き状況（○△×・空いている時間・文字で送る形・画像のマス）が、Web 版と 1 つ残らず同じか（golden/free.json）
final class FreeGoldenTests: XCTestCase {
    func testFree() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/free", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        func check(_ got: JSONValue?, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != want { fails += 1; if fails <= 40 { XCTFail("\(what())：\(String(describing: got)) ≠ \(String(describing: want))") } }
        }
        for (i, c) in cases.enumerated() {
            let core = AppCore(state: try XCTUnwrap(c["st"]?.object))
            let Y = c["Y"]!.int!, M = c["M"]!.int!
            for (dk, dv) in try XCTUnwrap(c["days"]?.object) {
                let d = Int(dk)!
                check(core.dayFree(Y, M, d).json, dv["free"], "#\(i) \(M + 1)/\(d) dayFree")
                check(core.freeText(Y, M, d, false).map { .string($0) } ?? .null, dv["text"] ?? .null, "#\(i) \(M + 1)/\(d) freeText")
                check(core.freeText(Y, M, d, true).map { .string($0) } ?? .null, dv["polite"] ?? .null, "#\(i) \(M + 1)/\(d) freeText polite")
            }
            check(.array(core.freeCells(Y, M)), c["cells"], "#\(i) freeCells")
            for b in c["blocks"]?.array ?? [] {
                check(.string(core.freeTextBlock(b["so"]?.object ?? [:])), b["out"], "#\(i) freeTextBlock \(String(describing: b["so"]))")
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
