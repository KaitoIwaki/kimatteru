import XCTest

/// 設定の「月を縦にスクロール」：動かした分だけずれる・見出しの月が変わる・日を押して戻っても飛ばない・‹ › と今日で送れる
final class MonthScrollTests: XCTestCase {
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

    /// 今月の前後に予定を入れ、縦の表示をオンにしておく
    private func store() -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: Date())
        let y0 = c.year!, m0 = c.month! - 1
        var evs: [String] = []
        for k in -3...3 {
            let t = y0 * 12 + m0 + k, y = t / 12, m = t % 12
            for d in stride(from: 1, through: 28, by: 2) {
                let st = d % 3 == 0 ? "mikakutei" : "kakutei"
                evs.append("{\"id\":\"v\(k + 3)-\(d)\",\"y\":\(y),\"m\":\(m),\"day\":\(d),\"start\":\"10:00\",\"end\":\"11:00\",\"title\":\"見本\(d)\",\"type\":\"yoji\",\"status\":\"\(st)\",\"updatedAt\":1}")
            }
            // 月の終わりから次の月へまたぐ 3 日の予定
            evs.append("{\"id\":\"trip\(k + 3)\",\"y\":\(y),\"m\":\(m),\"day\":29,\"start\":\"00:00\",\"end\":\"23:59\",\"allDay\":true,\"days\":5,\"title\":\"旅行\",\"type\":\"asobi\",\"status\":\"mikakutei\",\"updatedAt\":1}")
        }
        return "{\"savedAt\":8000,\"events\":[\(evs.joined(separator: ","))],\"settings\":{\"onboarded\":true,\"monthVertical\":true}}"
    }

    private func monthNo(_ app: XCUIApplication) -> Int? {
        guard let v = app.buttons["年と月をえらぶ"].value as? String else { return nil }
        let parts = v.replacingOccurrences(of: "月", with: "").split(separator: "年")
        guard parts.count == 2, let y = Int(parts[0]), let m = Int(parts[1]) else { return nil }
        return y * 12 + m - 1
    }
    private func waitMonth(_ app: XCUIApplication, _ ok: (Int) -> Bool, _ what: String) {
        let deadline = Date().addingTimeInterval(8)
        while Date() < deadline {
            if let n = monthNo(app), ok(n) { return }
            usleep(200_000)
        }
        XCTFail("\(what)：月が \(String(describing: monthNo(app))) のまま")
    }
    private func cell(_ app: XCUIApplication, _ d: Int) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: "month.day.\(d)").firstMatch
    }

    func testVerticalScroll() {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoSeedFile", b64(store())]
        app.launch()
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 60), "月の見出しが出ない")
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可", "Don’t Allow", "許可しない"] where springboard.buttons[label].waitForExistence(timeout: 2) {
            springboard.buttons[label].tap()
            break
        }
        sleep(1)
        guard let start = monthNo(app) else { return XCTFail("見出しの月が読めない") }
        let weekdays = app.descendants(matching: .any).matching(identifier: "month.weekdays").firstMatch
        XCTAssertTrue(weekdays.waitForExistence(timeout: 5) && cell(app, 1).waitForExistence(timeout: 5), "曜日の段か 1 日のマスが無い")
        // はじめは、その月の 1 日の週がいちばん上（曜日の段のすぐ下）
        XCTAssertGreaterThanOrEqual(cell(app, 1).frame.minY, weekdays.frame.maxY - 2, "1 日の週が曜日の段の下にもぐっている")
        XCTAssertLessThan(cell(app, 1).frame.minY, weekdays.frame.maxY + 40, "1 日の週がいちばん上に来ていない")
        snap(app, "v00-top")

        // ゆっくり 120pt 引き上げる：めくらずに、引いた分だけずれる
        let d15 = cell(app, 15)
        XCTAssertTrue(d15.exists, "15 日のマスが無い")
        let y0 = d15.frame.minY
        let from = app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.6))
        let to = from.withOffset(CGVector(dx: 0, dy: -120))
        from.press(forDuration: 0.1, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 0.5)
        sleep(1)
        let moved = y0 - d15.frame.minY
        XCTAssertGreaterThan(moved, 70, "引いたのにほとんど動かない（\(moved)pt）")
        XCTAssertLessThan(moved, 200, "引いた分より大きく動いた（\(moved)pt）")
        XCTAssertEqual(monthNo(app), start, "少し動かしただけで月が変わった")

        // 月の境目が見えるところまで上げる（次の月の 1 日が見える）
        for _ in 0..<2 {
            let a = app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7))
            a.press(forDuration: 0.1, thenDragTo: a.withOffset(CGVector(dx: 0, dy: -160)), withVelocity: .slow, thenHoldForDuration: 0.3)
        }
        sleep(1)
        snap(app, "v01-boundary")

        // 速く何回か上へ：先の月へ進む（引っかからない）
        for _ in 0..<6 { app.windows.firstMatch.swipeUp(velocity: .fast) }
        waitMonth(app, { $0 > start }, "上へ速く 6 回")
        snap(app, "v02-after-fast")
        guard let ahead = monthNo(app) else { return XCTFail("見出しの月が読めない") }

        // 日を押して開き、戻る：見ていた月のまま（飛ばない）
        let d10 = cell(app, 10)
        if d10.waitForExistence(timeout: 3) && d10.isHittable {
            let before = d10.frame.minY
            d10.tap()
            XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "day.viewSeg").firstMatch.waitForExistence(timeout: 5), "日の画面が開かない")
            snap(app, "v03-day")
            app.navigationBars.buttons.element(boundBy: 0).tap()
            sleep(2)
            XCTAssertEqual(monthNo(app), ahead, "日の画面から戻ったら、見出しの月が変わった")
            XCTAssertEqual(cell(app, 10).frame.minY, before, accuracy: 30, "日の画面から戻ったら、見ていた所から飛んだ")
        }

        // ‹ で前の月：その月の 1 日の週がいちばん上
        app.buttons["前の月"].tap()
        waitMonth(app, { $0 == ahead - 1 }, "前の月")
        sleep(1)
        XCTAssertLessThan(cell(app, 1).frame.minY, weekdays.frame.maxY + 40, "前の月の 1 日の週がいちばん上に来ていない")
        snap(app, "v04-prev")

        // 今日で今月へ
        if app.buttons["今日"].waitForExistence(timeout: 3) { app.buttons["今日"].tap() }
        waitMonth(app, { $0 == start }, "今日")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
