import XCTest

/// 予定を作る画面で、お知らせを 2 つまで選ぶ
final class RemindUITests: XCTestCase {
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

    func testPickTwoReminders() {
        let app = XCUIApplication()
        let store = "{\"savedAt\":8000,\"events\":[{\"id\":\"a\",\"y\":2026,\"m\":0,\"day\":5,\"start\":\"10:00\",\"end\":\"11:00\",\"title\":\"見本\",\"type\":\"yoji\",\"status\":\"kakutei\",\"updatedAt\":1}],\"settings\":{\"onboarded\":true}}"
        app.launchArguments = ["-lukkoTestReset", "-lukkoClearLocalStorage", "-lukkoSeedFile", b64(store)]
        app.launch()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可", "Don’t Allow", "許可しない"] where springboard.buttons[label].waitForExistence(timeout: 2) {
            springboard.buttons[label].tap()
            break
        }
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 60), "月の画面が出ない")
        // 日の画面を開いて「予定を追加」（起きたばかりで押し損ねたら、もう一度押す）
        let cell = app.buttons["month.day.20"]
        XCTAssertTrue(cell.waitForExistence(timeout: 10))
        sleep(1)
        let addButton = app.buttons["予定を追加"].firstMatch
        for _ in 0..<3 { cell.tap(); if addButton.waitForExistence(timeout: 3) { break } }
        addButton.tap()
        sleep(1)
        let row = app.staticTexts["お知らせ"].firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5), "お知らせの行が無い")
        for _ in 0..<6 where !row.isHittable { app.swipeUp(); sleep(1) }
        row.tap()
        let dayBefore = app.buttons["form.remind.前日"].firstMatch
        let hour = app.buttons["form.remind.1時間前"].firstMatch
        XCTAssertTrue(dayBefore.waitForExistence(timeout: 5), "お知らせの丸が出ない")
        XCTAssertTrue(app.staticTexts["2つまで選べます"].exists, "「2つまで選べます」が無い")
        dayBefore.tap()
        hour.tap()
        XCTAssertTrue(app.staticTexts["前日・1時間前"].firstMatch.waitForExistence(timeout: 3), "2 つ選んでも「前日・1時間前」にならない")
        XCTAssertTrue(app.staticTexts["前日と1時間前にお知らせします"].exists)
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = "R00-two-reminders"; a.lifetime = .keepAlways; add(a)
        // 3 つ目（10分前）を押すと、先に付けた「前日」が外れる
        app.buttons["form.remind.10分前"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["1時間前・10分前"].firstMatch.waitForExistence(timeout: 3), "3 つ目で先に付けたほうが外れない")
    }
}

/// 点線の予定の「決める期限」
final class AskByUITests: XCTestCase {
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

    func testPickDeadline() {
        let app = XCUIApplication()
        let store = "{\"savedAt\":8000,\"events\":[{\"id\":\"a\",\"y\":2026,\"m\":0,\"day\":5,\"start\":\"10:00\",\"end\":\"11:00\",\"title\":\"見本\",\"type\":\"yoji\",\"status\":\"kakutei\",\"updatedAt\":1}],\"settings\":{\"onboarded\":true}}"
        app.launchArguments = ["-lukkoTestReset", "-lukkoClearLocalStorage", "-lukkoSeedFile", b64(store)]
        app.launch()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可", "Don’t Allow", "許可しない"] where springboard.buttons[label].waitForExistence(timeout: 2) {
            springboard.buttons[label].tap()
            break
        }
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 60), "月の画面が出ない")
        // 来月の 20 日（今日がいつでも、期限の「明日」「3日後」を選べる）
        app.buttons["次の月"].tap()
        sleep(1)
        let cell = app.buttons["month.day.20"]
        XCTAssertTrue(cell.waitForExistence(timeout: 10))
        let addButton = app.buttons["予定を追加"].firstMatch
        for _ in 0..<3 { cell.tap(); if addButton.waitForExistence(timeout: 3) { break } }
        addButton.tap()
        sleep(1)
        let row = app.buttons["form.row.決める期限"]
        XCTAssertFalse(row.exists, "塗りの予定に期限の行が出る")
        // 「まだ」にすると、期限の行が出る
        let seg = app.segmentedControls.buttons.element(boundBy: 1)
        XCTAssertTrue(seg.waitForExistence(timeout: 5))
        seg.tap()
        XCTAssertTrue(row.waitForExistence(timeout: 3), "点線にしても期限の行が出ない")
        row.tap()
        let three = app.buttons["form.askBy.3日後"].firstMatch
        XCTAssertTrue(three.waitForExistence(timeout: 3), "期限の丸が出ない")
        three.tap()
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = "K00-ask-by"; a.lifetime = .keepAlways; add(a)
        // 選ぶと「◯月◯日（◯）の朝9時に…」になる（選ぶ前は「期限の日の朝に…」）
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "の朝9時に、まだ決まっていなければ")).firstMatch.waitForExistence(timeout: 3), "選んでも期限が入らない")
    }
}
