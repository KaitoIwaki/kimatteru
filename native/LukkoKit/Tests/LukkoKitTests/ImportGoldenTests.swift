import XCTest
@testable import LukkoKit

/// 取り込み（新しい・直った・消えた の分け方、重なりの取り除き、種類の当て方）が Web 版と同じか（golden/import.json）
final class ImportGoldenTests: XCTestCase {
    func testImport() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/import", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        func check(_ got: JSONValue?, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != want { fails += 1; if fails <= 30 { XCTFail("\(what())：\(String(describing: got)) ≠ \(String(describing: want))") } }
        }
        for (i, c) in cases.enumerated() {
            let inc = (c["incoming"]?.array ?? []).compactMap { $0.object }
            let ex = (c["existing"]?.array ?? []).compactMap { $0.object }
            let types = (c["types"]?.array ?? []).compactMap { $0.object }
            var range: (from: Int, to: Int, cals: [JSONValue]?)? = nil
            if let r = c["range"]?.object { range = (r["from"]!.int!, r["to"]!.int!, r["cals"]?.array) }
            let d = ImportCore.diffImport(inc, ex, range: range)
            let num = { (a: [Int]) -> JSONValue in .array(a.map { .number(Double($0)) }) }
            let got: JSONValue = .object(["fresh": num(d.fresh), "changed": .array(d.changed.map { num([$0.0, $0.1]) }), "gone": num(d.gone)])
            check(got, c["diff"], "#\(i) diffImport")
            check(num(ImportCore.dedupe(inc, ex)), c["dedupe"], "#\(i) dedupe")
            check(.array(ImportCore.guessTypes(inc, types)), c["guess"], "#\(i) guessTypes")
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
