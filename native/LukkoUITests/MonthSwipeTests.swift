import XCTest

/// 月を速く続けて払っても、詰まらずに 1 か月ずつ進む・戻る（前は前後 2 か月しか並べておらず、端で止まっていた）
final class MonthSwipeTests: XCTestCase {
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

    /// 今年の前後に、予定をたくさん（1 か月あたり 30 件ほど）入れておく
    private func store() -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: Date())
        let y0 = c.year!, m0 = c.month! - 1
        var evs: [String] = []
        for k in -8...8 {
            let t = y0 * 12 + m0 + k, y = t / 12, m = t % 12
            for d in 1...28 {
                let st = d % 3 == 0 ? "mikakutei" : "kakutei"
                evs.append("{\"id\":\"w\(k + 8)-\(d)\",\"y\":\(y),\"m\":\(m),\"day\":\(d),\"start\":\"1\(d % 10):00\",\"end\":\"1\(d % 10):30\",\"title\":\"見本\(d)\",\"type\":\"yoji\",\"status\":\"\(st)\",\"updatedAt\":1}")
            }
        }
        return "{\"savedAt\":8000,\"events\":[\(evs.joined(separator: ","))],\"settings\":{\"onboarded\":true}}"
    }

    /// 見出しの「2026年10月」から、通しの月の番号
    private func monthNo(_ app: XCUIApplication) -> Int? {
        guard let v = app.buttons["年と月をえらぶ"].value as? String else { return nil }
        let parts = v.replacingOccurrences(of: "月", with: "").split(separator: "年")
        guard parts.count == 2, let y = Int(parts[0]), let m = Int(parts[1]) else { return nil }
        return y * 12 + m - 1
    }
    private func waitMonth(_ app: XCUIApplication, _ want: Int, _ what: String) {
        let deadline = Date().addingTimeInterval(8)
        while Date() < deadline {
            if monthNo(app) == want { return }
            usleep(200_000)
        }
        XCTFail("\(what)：月が \(String(describing: monthNo(app))) のまま（\(want) になるはず）")
    }

    func testFastSwipes() {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoSeedFile", b64(store())]
        app.launch()
        let head = app.buttons["年と月をえらぶ"]
        XCTAssertTrue(head.waitForExistence(timeout: 60), "月の見出しが出ない")
        // 通知の許可が出ていたら閉じる
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可", "Don’t Allow", "許可しない"] where springboard.buttons[label].waitForExistence(timeout: 2) {
            springboard.buttons[label].tap()
            break
        }
        sleep(1)
        // 1 週目が曜日の段の下にもぐっていない（1 日のマスの上が、曜日の段の下より下にある）
        let weekdays = app.descendants(matching: .any).matching(identifier: "month.weekdays").firstMatch
        let day1 = app.descendants(matching: .any).matching(identifier: "month.day.1").firstMatch
        XCTAssertTrue(weekdays.waitForExistence(timeout: 5) && day1.waitForExistence(timeout: 5), "曜日の段か 1 日のマスが無い")
        XCTAssertGreaterThanOrEqual(day1.frame.minY, weekdays.frame.maxY - 1, "1 週目が曜日の段の下にもぐっている")
        // 最後の週が下のタブの裏に隠れていない（月の終わりの日のマスの下が、タブの上より上にある）
        let lastDay = (28...31).reversed().map { app.descendants(matching: .any).matching(identifier: "month.day.\($0)").firstMatch }.first { $0.exists }
        let tabBar = app.tabBars.firstMatch
        if let lastDay, tabBar.exists {
            XCTAssertLessThanOrEqual(lastDay.frame.maxY, tabBar.frame.minY + 2, "最後の週が下のタブの裏に隠れている")
        } else { XCTFail("月の終わりの日のマスか、下のタブが無い") }
        snap(app, "m00-month")
        guard let start = monthNo(app) else { return XCTFail("見出しの月が読めない") }
        let grid = app.windows.firstMatch

        // 速く 5 回、次の月へ
        for _ in 0..<5 { grid.swipeLeft(velocity: .fast) }
        waitMonth(app, start + 5, "次へ 5 回")
        snap(app, "m01-after-5-next")

        // 速く 7 回、前の月へ（はじめの月を越えて 2 か月前まで）
        for _ in 0..<7 { grid.swipeRight(velocity: .fast) }
        waitMonth(app, start - 2, "前へ 7 回")
        snap(app, "m02-after-7-prev")

        // 「今日」で今月へ戻る（払いのあとでも、ボタンで送れる）
        if app.buttons["今日"].waitForExistence(timeout: 3) { app.buttons["今日"].tap() }
        waitMonth(app, start, "今日")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
