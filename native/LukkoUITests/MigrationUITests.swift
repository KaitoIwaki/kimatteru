import XCTest

/// 引っ越しを、本物の iPhone の仕組み（WebKit の localStorage・Library のファイル）で通しで確かめる。
/// いまの版が書いたのと同じ場所に中身を置いてから、SwiftUI 版を開く。
final class MigrationUITests: XCTestCase {
    /// 見本の保存（予定 3 件）。savedAt を変えて、どちらが新しいかを作る
    private func store(savedAt: Int, ids: [String]) -> String {
        let evs = ids.map { "{\"id\":\"\($0)\",\"y\":2026,\"m\":9,\"day\":7,\"start\":\"10:00\",\"end\":\"11:00\",\"title\":\"\($0)\",\"type\":\"yoji\",\"status\":\"kakutei\"}" }
        return "{\"savedAt\":\(savedAt),\"events\":[\(evs.joined(separator: ","))],\"settings\":{\"hourly\":1300},\"unknownTop\":1}"
    }
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

    private func launch(_ args: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        // 引っ越しの記録（debug.*）は、この引数のときだけ画面の隅に出る
        app.launchArguments = args + ["-lukkoDebug"]
        app.launch()
        return app
    }
    private func label(_ app: XCUIApplication, _ id: String) -> String {
        let e = app.staticTexts[id]
        XCTAssertTrue(e.waitForExistence(timeout: 20), "\(id) が出ない")
        return e.label
    }
    private func waitLoaded(_ app: XCUIApplication) {
        let e = app.staticTexts["debug.eventCount"]
        let p = NSPredicate(format: "label BEGINSWITH '予定'")
        expectation(for: p, evaluatedWith: e)
        waitForExpectations(timeout: 150)
    }

    /// localStorage だけにある（いまの版の普通の状態）→ それを使い、保存ファイルに書き、2回目からはファイル
    func testLocalStorageOnly() {
        var app = launch(["-lukkoTestReset", "-lukkoSeedLocalStorage", b64(store(savedAt: 1000, ids: ["a", "b", "c"]))])
        waitLoaded(app)
        XCTAssertEqual(label(app, "debug.eventCount"), "予定 3 件")
        XCTAssertEqual(label(app, "debug.source"), "使った中身：localStorage")
        snap(app, "migration-1-local")
        app.terminate()
        app = launch([])
        waitLoaded(app)
        XCTAssertEqual(label(app, "debug.eventCount"), "予定 3 件")
        XCTAssertEqual(label(app, "debug.source"), "使った中身：file")
        snap(app, "migration-2-relaunch")
    }

    /// 保存ファイルがあるのに読めない（再起動のあと、ロックを解く前など）→ 空で開かず、何も書かない。
    /// 読めるようになって開き直すと、元の予定がそのまま全部ある（上書きされていない）
    func testUnreadableFileIsNeverOverwritten() {
        // 引っ越し済みの人（localStorage は空）。保存ファイルに予定 3 件
        var app = launch(["-lukkoTestReset", "-lukkoClearLocalStorage", "-lukkoSeedFile", b64(store(savedAt: 5000, ids: ["a", "b", "c"])), "-lukkoTestUnreadable"])
        let retry = app.buttons["unreadable.retry"]
        XCTAssertTrue(retry.waitForExistence(timeout: 60), "読めないときの画面が出ない")
        XCTAssertFalse(app.buttons["これからの予定の一覧"].exists, "読めないのに、カレンダーを開いた")
        snap(app, "unreadable-1")
        app.terminate()
        // 読めるように戻して開き直す：予定 3 件がそのまま
        app = launch(["-lukkoTestReadable"])
        waitLoaded(app)
        XCTAssertEqual(label(app, "debug.eventCount"), "予定 3 件", "読めなかったあいだに、保存ファイルが上書きされた")
        snap(app, "unreadable-2-reopened")
    }

    /// ファイルのほうが新しく中身も違う（いまの版の _checkFile と同じ）→ ファイル
    func testFileNewer() {
        let app = launch(["-lukkoTestReset",
                          "-lukkoSeedLocalStorage", b64(store(savedAt: 1000, ids: ["a"])),
                          "-lukkoSeedFile", b64(store(savedAt: 2000, ids: ["a", "b"]))])
        waitLoaded(app)
        XCTAssertEqual(label(app, "debug.eventCount"), "予定 2 件")
        XCTAssertEqual(label(app, "debug.source"), "使った中身：file")
    }

    /// localStorage のほうが新しい → localStorage
    func testLocalNewer() {
        let app = launch(["-lukkoTestReset",
                          "-lukkoSeedLocalStorage", b64(store(savedAt: 3000, ids: ["a", "b", "c", "d"])),
                          "-lukkoSeedFile", b64(store(savedAt: 2000, ids: ["a", "b"]))])
        waitLoaded(app)
        XCTAssertEqual(label(app, "debug.eventCount"), "予定 4 件")
        XCTAssertEqual(label(app, "debug.source"), "使った中身：localStorage")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
