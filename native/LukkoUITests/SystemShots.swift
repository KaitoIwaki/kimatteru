import XCTest

/// アプリ全体のしくみの写真と確かめ：保存についての知らせ・開くときのロック・下のタブ（もう一度押す・＋）・ウィジェットへの受け渡し
final class SystemShots: XCTestCase {
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }
    /// 過去の予定だけ（通知の予約が出ないように、ずっと前の日付にする）
    private func store(savedAt: Int, n: Int) -> String {
        let evs = (0..<n).map { "{\"id\":\"s\($0)\",\"y\":2020,\"m\":4,\"day\":\($0 + 3),\"start\":\"10:00\",\"end\":\"11:00\",\"title\":\"見本\($0)\",\"type\":\"yoji\",\"status\":\"kakutei\",\"updatedAt\":1}" }
        return "{\"savedAt\":\(savedAt),\"events\":[\(evs.joined(separator: ","))],\"settings\":{\"onboarded\":true}}"
    }
    private func launch(_ args: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = args + ["-lukkoDebug"]
        app.launch()
        return app
    }
    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
    private func element(_ app: XCUIApplication, _ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    /// localStorage が消えていて、保存ファイルから戻した（いまの版の「保存されていたn件の予定を戻しました」）
    func testRecoveredNotice() {
        let app = launch(["-lukkoTestReset", "-lukkoClearLocalStorage", "-lukkoSeedFile", b64(store(savedAt: 5000, n: 4))])
        let banner = element(app, "system.recovered")
        XCTAssertTrue(banner.waitForExistence(timeout: 60), "戻した知らせが出ない")
        XCTAssertTrue(app.staticTexts["debug.eventCount"].label.hasPrefix("予定 4"))
        snap(app, "s01-recovered")
        banner.tap()
        let gone = NSPredicate(format: "exists == false")
        expectation(for: gone, evaluatedWith: banner)
        waitForExpectations(timeout: 10)
    }

    /// 保存できていないとき：上に濃い赤の帯。押すと 設定 > 控えと機種変更
    func testSaveFailedNotice() {
        // 保存ファイルに書けないようにして、本当に保存に失敗させる
        let app = launch(["-lukkoTestReset", "-lukkoSeedLocalStorage", b64(store(savedAt: 6000, n: 2)), "-lukkoTestBlockWrites"])
        let banner = element(app, "system.saveFailed")
        XCTAssertTrue(banner.waitForExistence(timeout: 60), "保存できていない知らせが出ない")
        snap(app, "s02-save-failed")
        banner.tap()
        sleep(1)
        snap(app, "s03-save-failed-tapped")
    }

    /// 開くときのロック：確かめ終わるまで紙をかぶせる（確かめそのものは iPhone の画面なので、ここでは見た目だけ）
    func testLockCover() {
        let app = launch(["-lukkoTestReset", "-lukkoSeedLocalStorage", b64(store(savedAt: 7000, n: 2)),
                          "-lukkoTestState", b64("{\"locked\":true}")])
        let open = element(app, "lock.open")
        XCTAssertTrue(open.waitForExistence(timeout: 60), "ロックの画面が出ない")
        snap(app, "s04-lock")
    }

    /// 下のタブ：カレンダーをもう一度押すと今日の月へ。「＋」で新しい予定。ウィジェットへ渡せている
    func testTabsAndWidget() {
        let app = launch(["-lukkoTestReset", "-lukkoSeedLocalStorage", b64(store(savedAt: 8000, n: 3))])
        XCTAssertTrue(app.buttons["次の月"].waitForExistence(timeout: 60))
        let widget = app.staticTexts["debug.widget"]
        XCTAssertTrue(widget.waitForExistence(timeout: 10))
        XCTAssertTrue(widget.label.hasPrefix("ウィジェット：渡せた"), widget.label)
        app.buttons["次の月"].tap()
        sleep(1)
        XCTAssertTrue(app.buttons["今日"].waitForExistence(timeout: 5), "別の月なら「今日」が出る")
        app.tabBars.buttons["カレンダー"].tap()
        sleep(1)
        XCTAssertFalse(app.buttons["今日"].exists, "カレンダーをもう一度押すと今日の月へ戻る")
        snap(app, "s05-tab-retap-today")
        app.tabBars.buttons["追加"].tap()
        sleep(2)
        snap(app, "s06-tab-add")
        if app.buttons["Continue"].waitForExistence(timeout: 2) { app.buttons["Continue"].tap(); sleep(1) }
        XCTAssertTrue(app.buttons["閉じる"].firstMatch.waitForExistence(timeout: 5), "「＋」で新しい予定が開く")
        app.buttons["閉じる"].firstMatch.tap()
        sleep(1)
        app.tabBars.buttons["設定"].tap()
        sleep(1)
        app.tabBars.buttons["設定"].tap()
        sleep(1)
        snap(app, "s07-tab-settings-retap")
    }
}
