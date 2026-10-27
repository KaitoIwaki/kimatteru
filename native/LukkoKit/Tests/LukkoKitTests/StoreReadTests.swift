import XCTest
@testable import LukkoKit

/// 保存ファイルの読み方：「無い」と「あるのに読めない」を分ける（読めないのに空で開いて上書きしないため）
final class StoreReadTests: XCTestCase {
    private var dir: URL!
    override func setUp() {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent("storeread-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }
    override func tearDown() {
        let f = dir.appendingPathComponent("locked.json")
        try? FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: f.path)
        try? FileManager.default.removeItem(at: dir)
    }

    func testMissing() {
        XCTAssertEqual(StoreRead.read(dir.appendingPathComponent("none.json")), .missing)
    }
    func testData() throws {
        let f = dir.appendingPathComponent("ok.json")
        try Data("{\"events\":[]}".utf8).write(to: f)
        XCTAssertEqual(StoreRead.read(f), .data(Data("{\"events\":[]}".utf8)))
    }
    func testDirectoryIsUnreadable() throws {
        let f = dir.appendingPathComponent("dir.json")
        try FileManager.default.createDirectory(at: f, withIntermediateDirectories: true)
        guard case .unreadable = StoreRead.read(f) else { return XCTFail("フォルダを「無い」か「読めた」にした") }
    }
    func testNoPermissionIsUnreadable() throws {
        let f = dir.appendingPathComponent("locked.json")
        try Data("{}".utf8).write(to: f)
        try FileManager.default.setAttributes([.posixPermissions: 0o000], ofItemAtPath: f.path)
        // root で動いているときは読めてしまうので、そのときは確かめない
        if FileManager.default.isReadableFile(atPath: f.path) { return }
        guard case .unreadable = StoreRead.read(f) else { return XCTFail("読めないファイルを「無い」か「読めた」にした") }
    }
}
