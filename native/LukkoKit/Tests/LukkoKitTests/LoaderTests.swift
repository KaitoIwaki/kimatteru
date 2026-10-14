import XCTest
@testable import LukkoKit

/// 起動したときの読み込みが、Web 版と 1 つ残らず同じになるか（正解表 golden/load.json、401 通り）
final class LoaderTests: XCTestCase {
    func testLoadMatchesWeb() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/load", withExtension: "json"))
        let g = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
        let now = try XCTUnwrap(g["now"]?.number)
        let cases = try XCTUnwrap(g["cases"]?.array)
        let idPrefix = "x" + String(Int64(now), radix: 36)
        for (i, c) in cases.enumerated() {
            let saved = c["saved"]?.object
            var got = Loader.load(saved, now: now) { Loader.uid("x", now: now) }
            var want = try XCTUnwrap(c["state"]?.object)
            // 番号の無い予定に振る番号は乱数を含むので、頭（'x' + いまの 36 進）が同じかだけ確かめ、そろえてから比べる
            if case .array(var ge)? = got["events"], case .array(var we)? = want["events"], ge.count == we.count {
                for j in ge.indices {
                    guard case .object(var go) = ge[j], case .object(var wo) = we[j] else { continue }
                    if let gid = go["id"]?.string, let wid = wo["id"]?.string, gid != wid, gid.hasPrefix(idPrefix), wid.hasPrefix(idPrefix) {
                        go["id"] = .string("generated"); wo["id"] = .string("generated")
                        ge[j] = .object(go); we[j] = .object(wo)
                    }
                }
                got["events"] = .array(ge); want["events"] = .array(we)
            }
            for key in StoreFile.persistedKeys {
                XCTAssertEqual(got[key], want[key], "読み込み #\(i) の \(key) が違う")
            }
        }
    }
}

/// どの保存を使うか（Web 版の起動と同じ決まり）
final class MigrationTests: XCTestCase {
    private func store(_ savedAt: Double, events: Int, extra: String = "") -> Data {
        let evs = (0..<events).map { "{\"id\":\"e\($0)\(extra)\",\"y\":2026,\"m\":9,\"day\":1,\"start\":\"09:00\",\"end\":\"10:00\"}" }.joined(separator: ",")
        return "{\"savedAt\":\(Int(savedAt)),\"events\":[\(evs)]}".data(using: .utf8)!
    }

    func testOnlyFile() {
        let d = Migration.decide(file: store(10, events: 2), localStorage: nil)
        XCTAssertEqual(d.chosen?.source, .file)
        XCTAssertFalse(d.mustWriteFile)
    }
    func testOnlyLocal() {
        let d = Migration.decide(file: nil, localStorage: store(10, events: 2))
        XCTAssertEqual(d.chosen?.source, .localStorage)
        XCTAssertTrue(d.mustWriteFile)
    }
    func testLocalWinsWhenNewer() {
        let d = Migration.decide(file: store(10, events: 2), localStorage: store(20, events: 3))
        XCTAssertEqual(d.chosen?.source, .localStorage)
    }
    func testFileWinsWhenNewerAndDifferent() {
        let d = Migration.decide(file: store(30, events: 3, extra: "f"), localStorage: store(20, events: 3))
        XCTAssertEqual(d.chosen?.source, .file)
    }
    func testLocalKeptWhenFileNewerButSameContent() {
        let d = Migration.decide(file: store(30, events: 3), localStorage: store(20, events: 3))
        XCTAssertEqual(d.chosen?.source, .localStorage)
    }
    func testEmptyFileIgnored() {
        XCTAssertNil(Migration.decide(file: store(30, events: 0), localStorage: nil).chosen)
        XCTAssertEqual(Migration.decide(file: store(30, events: 0), localStorage: store(1, events: 1)).chosen?.source, .localStorage)
    }
    func testBrokenLocalFallsBackToFile() {
        let d = Migration.decide(file: store(10, events: 1), localStorage: "{broken".data(using: .utf8))
        XCTAssertEqual(d.chosen?.source, .file)
        XCTAssertTrue(d.problems.contains(.unreadable(.localStorage, "JSON として読めない")))
    }
    func testNothing() {
        let d = Migration.decide(file: nil, localStorage: nil)
        XCTAssertNil(d.chosen)
    }

    /// 安全な書き込み：書いた中身が読み返して同じ。写しは上書きしない
    func testSafeFileAndCopies() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("lukko-test-\(UUID().uuidString)")
        let url = dir.appendingPathComponent("kimatteru-store.json")
        try SafeFile.write(Data("a".utf8), to: url)
        try SafeFile.write(Data("bb".utf8), to: url)
        XCTAssertEqual(try Data(contentsOf: url), Data("bb".utf8))
        let c1 = try SafeFile.keepCopy(Data("1".utf8), in: dir, name: "before.json")
        let c2 = try SafeFile.keepCopy(Data("2".utf8), in: dir, name: "before.json")
        XCTAssertNotEqual(c1, c2)
        XCTAssertEqual(try Data(contentsOf: c1), Data("1".utf8))
        XCTAssertEqual(try Data(contentsOf: c2), Data("2".utf8))
        try? FileManager.default.removeItem(at: dir)
    }
}
