import XCTest
@testable import LukkoKit

final class StoreFileTests: XCTestCase {
    /// Web 版が書いたファイルを読み、書き戻しても中身が1つも変わらない（知らない項目も残る）
    func testRoundTripKeepsEverything() throws {
        let url = Bundle.module.url(forResource: "Fixtures/store-sample", withExtension: "json")!
        let data = try Data(contentsOf: url)
        let s = try StoreFile.decode(data)
        XCTAssertGreaterThan(s.events.count, 0)
        let back = try StoreFile.decode(try s.encode())
        XCTAssertEqual(s, back)
        // 元の JSON と、意味として同じか（キーの順番は問わない）
        let a = try JSONSerialization.jsonObject(with: data) as! NSDictionary
        let b = try JSONSerialization.jsonObject(with: try s.encode()) as! NSDictionary
        XCTAssertEqual(a, b)
    }
}
