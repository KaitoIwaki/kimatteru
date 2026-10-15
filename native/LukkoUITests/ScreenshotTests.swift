import XCTest

/// 画面を開いて写真を撮る。GitHub の Mac で動かし、写真を取り出して Web 版と比べる
final class ScreenshotTests: XCTestCase {
    /// 見本の予定（今月）。決まった・まだ・記録・何日も続く・無くなった、をひととおり
    private func sample() -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: Date())
        let y = c.year!, m = c.month! - 1, today = c.day!
        func ev(_ id: String, _ d: Int, _ title: String, _ type: String, _ status: String, _ s: String = "10:00", _ e: String = "11:00", extra: String = "") -> String {
            "{\"id\":\"\(id)\",\"y\":\(y),\"m\":\(m),\"day\":\(d),\"start\":\"\(s)\",\"end\":\"\(e)\",\"title\":\"\(title)\",\"type\":\"\(type)\",\"status\":\"\(status)\",\"updatedAt\":1\(extra)}"
        }
        let evs = [
            ev("a", 3, "定例", "yoji", "kakutei"),
            ev("b", 5, "カフェ", "baito", "kakutei", "17:00", "22:00"),
            ev("c", 6, "飲み会", "asobi", "mikakutei", "19:00", "21:00"),
            ev("d", 9, "旅行", "asobi", "kakutei", "00:00", "23:59", extra: ",\"allDay\":true,\"days\":3"),
            ev("e", 12, "カフェ", "baito", "jisseki", "17:00", "22:00"),
            ev("f", 12, "歯医者", "yoji", "kakutei", "09:30", "10:30"),
            ev("g", 15, "ランチ", "asobi", "nakunatta", "12:00", "13:00"),
            ev("h", min(today, 28), "面接", "yoji", "mikakutei", "14:00", "15:00"),
            ev("i", 20, "カフェ", "baito", "mikakutei", "17:00", "22:00"),
            ev("j", 20, "買い物", "other", "kakutei", "11:00", "12:00"),
            ev("k", 20, "映画", "asobi", "kakutei", "18:00", "20:00"),
            ev("l", 20, "勉強会", "yoji", "kakutei", "20:00", "21:00"),
            ev("n", 20, "電話", "other", "kakutei", "21:00", "21:30"),
        ]
        return "{\"savedAt\":9000000000000,\"events\":[\(evs.joined(separator: ","))],\"settings\":{\"hourly\":1100,\"weekStart\":0,\"onboarded\":true}}"
    }

    func testScreens() throws {
        let app = XCUIApplication()
        // 引っ越しの試験が残した localStorage より新しい見本にする（いまの版の普通の状態と同じく localStorage から入る）
        app.launchArguments = ["-lukkoTestReset", "-lukkoSeedLocalStorage", Data(sample().utf8).base64EncodedString()]
        app.launch()
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 30))
        snap(app, "01-month")
        app.swipeLeft()
        sleep(1)
        snap(app, "02-month-next")
        app.swipeRight()
        sleep(1)
        let day = app.buttons["month.day.20"]
        XCTAssertTrue(day.waitForExistence(timeout: 10))
        day.tap()
        sleep(1)
        snap(app, "03-day")
        app.buttons["予定を追加"].firstMatch.tap()
        sleep(1)
        snap(app, "04-form")
        // シミュレーターのキーボードの初回の案内（なぞって入力）が出ていたら閉じる
        if app.buttons["Continue"].waitForExistence(timeout: 2) { app.buttons["Continue"].tap(); sleep(1) }
        app.buttons["閉じる"].firstMatch.tap()
        sleep(1)
        let row = app.buttons["day.row.j"]
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        row.tap()
        sleep(1)
        snap(app, "05-detail")
        app.tabBars.buttons["設定"].tap()
        sleep(1)
        snap(app, "06-settings")
        app.tabBars.buttons["まとめ"].tap()
        sleep(1)
        snap(app, "07-report")
        app.tabBars.buttons["空き状況"].tap()
        sleep(1)
        snap(app, "08-free")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
