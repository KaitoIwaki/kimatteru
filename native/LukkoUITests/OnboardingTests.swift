import XCTest

/// はじめての案内のまわり：見直しの途中で閉じても案内が戻ってこない・月の案内から取り込みを開いて閉じたら月へ戻る
final class OnboardingTests: XCTestCase {
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

    private func launch(_ store: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoClearLocalStorage", "-lukkoSeedFile", b64(store)]
        app.launch()
        allowAlerts()
        return app
    }

    /// iPhone の許可が出ていたら閉じる（許しても断ってもよい）
    private func allowAlerts() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可", "Don’t Allow", "許可しない"] where springboard.buttons[label].waitForExistence(timeout: 2) {
            springboard.buttons[label].tap()
            break
        }
    }

    private func gone(_ e: XCUIElement, _ timeout: TimeInterval = 5) -> Bool {
        let ex = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: e)
        return XCTWaiter().wait(for: [ex], timeout: timeout) == .completed
    }

    private var pickPredicate: NSPredicate { NSPredicate(format: "label BEGINSWITH %@", "学校とバイト") }

    func testReplayInterruptedDoesNotComeBack() {
        let store = "{\"savedAt\":8000,\"events\":[{\"id\":\"a\",\"y\":2026,\"m\":0,\"day\":5,\"start\":\"10:00\",\"end\":\"11:00\",\"title\":\"見本\",\"type\":\"yoji\",\"status\":\"kakutei\",\"updatedAt\":1}],\"settings\":{\"onboarded\":true}}"
        let app = launch(store)
        XCTAssertTrue(app.tabBars.buttons["設定"].waitForExistence(timeout: 60), "下のタブが出ない")
        openReplay(app)
        let pick = app.buttons.matching(pickPredicate).firstMatch
        XCTAssertTrue(pick.waitForExistence(timeout: 5), "見直しで案内が出ない")

        // 見直しの途中でアプリを閉じて、開き直す
        sleep(2)
        app.terminate()
        app.launchArguments = []
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["設定"].waitForExistence(timeout: 60), "開き直したら下のタブが出ない")
        sleep(2)
        XCTAssertFalse(app.buttons.matching(pickPredicate).firstMatch.exists, "見直しの途中で閉じたら、次に開いたとき案内が出た")

        // 見直しを「スキップ」で終えると閉じる
        openReplay(app)
        XCTAssertTrue(pick.waitForExistence(timeout: 5))
        app.buttons["スキップ"].tap()
        XCTAssertTrue(gone(pick), "スキップで案内が閉じない")
    }

    /// 設定 → ヘルプ → 使い方をもう一度見る
    private func openReplay(_ app: XCUIApplication) {
        app.tabBars.buttons["設定"].tap()
        let help = app.staticTexts["ヘルプ"].firstMatch
        for _ in 0..<8 where !(help.exists && help.isHittable) { app.swipeUp(); sleep(1) }
        XCTAssertTrue(help.waitForExistence(timeout: 5), "ヘルプの行が無い")
        help.tap()
        let replay = app.staticTexts["使い方をもう一度見る"].firstMatch
        XCTAssertTrue(replay.waitForExistence(timeout: 5), "使い方をもう一度見るの行が無い")
        replay.tap()
    }

    func testImportFromMonthHintReturnsToMonth() {
        let app = launch("{\"savedAt\":8000,\"events\":[],\"settings\":{\"onboarded\":true}}")
        let hint = app.staticTexts["month.firstRunHint"]
        XCTAssertTrue(hint.waitForExistence(timeout: 60), "予定が 0 件なのに月の案内が出ない")
        app.buttons["iPhone のカレンダーから取り込む"].tap()
        // 押した時点で iPhone の許可が出る
        allowAlerts()
        let close = app.buttons["閉じる"]
        XCTAssertTrue(close.waitForExistence(timeout: 10), "取り込みの画面が出ない")
        sleep(1)
        close.tap()
        XCTAssertTrue(gone(close), "閉じるで取り込みが閉じない")
        XCTAssertTrue(hint.waitForExistence(timeout: 5), "取り込みを閉じたら月の画面に戻らない")
        XCTAssertFalse(app.tabBars.buttons["設定"].isSelected, "取り込みを閉じたら設定に着いた")
    }
}
