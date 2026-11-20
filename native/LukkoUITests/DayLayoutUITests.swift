import XCTest

/// 日の画面で「予定を追加」→ 保存して戻ると、画面全体が上へずれて、日付の帯が時刻の裏に潜ることがある（実機で報告）。
/// 帯の位置を、開いたとき・保存して戻ったとき・予定を開いて戻ったときで比べる
final class DayLayoutUITests: XCTestCase {
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

    func testDayStripStaysBelowBarAfterAdding() {
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
        let cell = app.buttons["month.day.20"]
        XCTAssertTrue(cell.waitForExistence(timeout: 10))
        sleep(1)
        let addButton = app.buttons["予定を追加"].firstMatch
        for _ in 0..<3 { cell.tap(); if addButton.waitForExistence(timeout: 3) { break } }

        // 帯の 1 日（「11月20日（金）」のような名前）。帯の日はどれも同じ高さに並ぶ
        let strip = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "20日（")).firstMatch
        var log: [String] = []
        var bad: [String] = []
        func check(_ name: String) {
            sleep(2)
            let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "D-\(name)"; shot.lifetime = .keepAlways; add(shot)
            let barBottom = app.navigationBars.firstMatch.frame.maxY
            let y = strip.exists ? strip.frame.minY : -1
            log.append("\(name): 帯の上=\(Int(y)) 見出しの下=\(Int(barBottom))")
            if y < barBottom - 2 { bad.append(name) }
        }
        XCTAssertTrue(strip.waitForExistence(timeout: 5), "日付の帯が見つからない")
        check("open")

        // 1. 「予定を追加」→ 題名を打つ（キーボードが出たまま）→ 保存。保存は 下の「保存」・右上の ✓・キーボードの「完了」の 3 通り
        for (round, how) in ["saveBar", "check", "enter"].enumerated() {
            addButton.tap()
            let title = app.textFields["form.title"].firstMatch
            XCTAssertTrue(title.waitForExistence(timeout: 5), "予定の画面が出ない")
            sleep(1)
            title.tap()
            title.typeText("試し\(round)")
            log.append("kb=\(app.keyboards.count)")
            switch how {
            case "saveBar": app.buttons["form.saveBar"].firstMatch.tap()
            case "check": app.navigationBars.buttons["保存"].firstMatch.tap()
            default: title.typeText("\n")
            }
            XCTAssertTrue(addButton.waitForExistence(timeout: 5), "保存しても日の画面に戻らない（\(how)）")
            check("saved-\(how)")
        }
        // 2. 足した予定を押して開き、戻る
        let row = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "day.row.")).firstMatch
        if row.waitForExistence(timeout: 3) {
            row.tap()
            sleep(2)
            let back = app.navigationBars.buttons.element(boundBy: 0)
            if back.exists { back.tap() }
            XCTAssertTrue(addButton.waitForExistence(timeout: 5), "詳細から日の画面に戻らない")
            check("detailBack")
        }
        // 3. 「時間を決めずに入れる」→ 保存
        app.buttons["時間を決めずに入れる"].firstMatch.tap()
        let title = app.textFields["form.title"].firstMatch
        if title.waitForExistence(timeout: 5) {
            sleep(1)
            title.tap()
            title.typeText("終日")
            app.buttons["form.saveBar"].firstMatch.tap()
            XCTAssertTrue(addButton.waitForExistence(timeout: 5))
            check("allDay")
        }
        print("DAYLAYOUT " + log.joined(separator: " / "))
        XCTAssertTrue(bad.isEmpty, "日付の帯が見出しの裏に潜った：\(bad.joined(separator: ",")) ｜ \(log.joined(separator: " / "))")
    }
}
