import XCTest
@testable import LukkoKit

/// ウィジェットに渡す中身が Web 版と同じか（golden/widget.json）
final class WidgetGoldenTests: XCTestCase {
    func testWidget() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/widget", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        for (i, c) in cases.enumerated() {
            let t = (c["today"]?.array ?? []).compactMap { $0.int }
            let got = WidgetCore.buildPayload(c["state"]?.object ?? [:], today: (t[0], t[1], t[2]), atMs: c["at"]?.number ?? 0)
            if got != c["payload"] { fails += 1; if fails <= 10 { XCTFail("#\(i)：\(got) ≠ \(String(describing: c["payload"]))") } }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
