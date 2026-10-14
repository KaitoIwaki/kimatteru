import XCTest
@testable import LukkoKit

/// iCloud の同期（渡す中身・混ぜ方）が Web 版と同じか（golden/sync.json）
final class SyncGoldenTests: XCTestCase {
    func testSync() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/sync", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        for (i, c) in cases.enumerated() {
            let local = c["local"]?.object ?? [:]
            let pack = SyncCore.packForSync(local)
            if pack != c["pack"] { fails += 1; if fails <= 20 { XCTFail("#\(i) pack：\(pack) ≠ \(String(describing: c["pack"]))") } }
            let merged = SyncCore.mergeSync(local: local, remote: c["remote"]).map { JSONValue.object($0) } ?? .null
            if merged != (c["merged"] ?? .null) { fails += 1; if fails <= 20 { XCTFail("#\(i) merge：\(merged) ≠ \(String(describing: c["merged"]))") } }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
