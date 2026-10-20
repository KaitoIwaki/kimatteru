import XCTest

/// ストア画像のもとになる写真。学生の 1 か月（バイト・ゼミ・飲み会の候補日・予約待ち など）を、今月に入れて撮る。
/// 名前は誰か分からないものだけにする（公開する画像なので）
final class StoreShots: XCTestCase {
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

    /// [日, 名前, 種類, 状態, 始まり, 終わり, 終日, 何日, 候補の群れ]
    private typealias E = (d: Int, t: String, ty: String, st: String, s: String, e: String, all: Bool, days: Int, cand: String)
    private let month: [E] = [
        (3, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (5, "ゼミ", "yoji", "kakutei", "13:00", "14:30", false, 1, ""),
        (6, "飲み会", "asobi", "mikakutei", "19:00", "21:00", false, 1, "k1"),
        (7, "飲み会", "asobi", "mikakutei", "19:00", "21:00", false, 1, "k1"),
        (8, "飲み会", "asobi", "mikakutei", "19:00", "21:00", false, 1, "k1"),
        (9, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (10, "旅行", "asobi", "mikakutei", "00:00", "23:59", true, 2, ""),
        (12, "歯医者", "yoji", "mikakutei", "10:00", "11:00", false, 1, ""),
        (13, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (14, "美容院", "yoji", "kakutei", "11:00", "12:30", false, 1, ""),
        (15, "シフト希望", "baito", "mikakutei", "17:00", "22:00", false, 1, ""),
        (16, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (17, "映画", "asobi", "kakutei", "18:30", "21:00", false, 1, ""),
        (19, "面接", "yoji", "mikakutei", "15:00", "16:00", false, 1, ""),
        (20, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (20, "レポート締切", "other", "kakutei", "00:00", "23:59", true, 1, ""),
        (21, "ライブ", "asobi", "kakutei", "18:00", "21:00", false, 1, ""),
        (23, "シフト希望", "baito", "mikakutei", "17:00", "22:00", false, 1, ""),
        (24, "誕生日会", "asobi", "mikakutei", "19:00", "22:00", false, 1, ""),
        (26, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (27, "健康診断", "yoji", "kakutei", "09:00", "10:00", false, 1, ""),
        (28, "ごはん", "asobi", "mikakutei", "19:00", "21:00", false, 1, ""),
        (30, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
    ]

    private func store() -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: Date())
        let y = c.year!, m = c.month! - 1
        let evs = month.enumerated().map { i, e -> String in
            var o = "\"id\":\"st\(i)\",\"y\":\(y),\"m\":\(m),\"day\":\(e.d),\"start\":\"\(e.s)\",\"end\":\"\(e.e)\",\"title\":\"\(e.t)\",\"type\":\"\(e.ty)\",\"status\":\"\(e.st)\",\"updatedAt\":1"
            if e.all { o += ",\"allDay\":true" }
            if e.days > 1 { o += ",\"days\":\(e.days)" }
            if !e.cand.isEmpty { o += ",\"candId\":\"\(e.cand)\"" }
            if e.ty == "baito" { o += ",\"jobId\":\"j1\"" }
            return "{" + o + "}"
        }
        let jobs = "[{\"id\":\"j1\",\"name\":\"カフェ\",\"hourly\":1200}]"
        return "{\"savedAt\":9000000000000,\"events\":[\(evs.joined(separator: ","))],\"jobs\":\(jobs),\"settings\":{\"onboarded\":true,\"profile\":\"student\"}}"
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    func testStoreMonth() {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoSeedLocalStorage", b64(store())]
        app.launch()
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 60), "月の見出しが出ない")
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可", "Don’t Allow", "許可しない"] where springboard.buttons[label].waitForExistence(timeout: 2) {
            springboard.buttons[label].tap()
            break
        }
        sleep(2)
        snap(app, "store-01-month")
        // まとめ（バイトの時間と給料の目安）
        app.tabBars.buttons["まとめ"].tap()
        sleep(2)
        snap(app, "store-04-report")
        // 給料の目安が見えるところまで下へ
        app.swipeUp()
        sleep(1)
        snap(app, "store-04b-report-wage")
    }

    /// 「この用事、どうなりました？」（点線の予定を、決まったにする瞬間）。12 日の歯医者から開く
    func testStoreDialog() {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoSeedLocalStorage", b64(store())]
        app.launch()
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 60), "月の見出しが出ない")
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可", "Don’t Allow", "許可しない"] where springboard.buttons[label].waitForExistence(timeout: 2) {
            springboard.buttons[label].tap()
            break
        }
        sleep(1)
        let cell = app.buttons["month.day.12"]
        XCTAssertTrue(cell.waitForExistence(timeout: 10), "12 日のマスが無い")
        for _ in 0..<3 {
            cell.tap()
            if app.buttons["予定を追加"].firstMatch.waitForExistence(timeout: 3) { break }
        }
        let row = app.descendants(matching: .any).matching(identifier: "day.row.st7").firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5), "歯医者の行が無い")
        sleep(1)
        snap(app, "store-02-day")
        // 点線の予定は、押すとすぐ「この用事、どうなりました？」が出る
        row.tap()
        sleep(2)
        snap(app, "store-03-dialog")
    }

    /// 空き状況と、空いてる日をシェアの画面（送る文・送る画像）
    func testStoreShare() {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoShowSharePNG", "-lukkoSeedLocalStorage", b64(store())]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["空き状況"].waitForExistence(timeout: 60), "下のタブが出ない")
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可", "Don’t Allow", "許可しない"] where springboard.buttons[label].waitForExistence(timeout: 2) {
            springboard.buttons[label].tap()
            break
        }
        app.tabBars.buttons["空き状況"].tap()
        sleep(2)
        snap(app, "store-05-free")
        let share = app.buttons["free.share"]
        XCTAssertTrue(share.waitForExistence(timeout: 10), "シェアのボタンが無い")
        share.tap()
        XCTAssertTrue(app.descendants(matching: .any)["share.card"].waitForExistence(timeout: 10), "シェアの画面が出ない")
        sleep(2)
        snap(app, "store-06-share")
        app.swipeUp()
        sleep(1)
        snap(app, "store-07-share-text")
        let png = app.images["share.png"]
        for _ in 0..<4 where !(png.exists && png.isHittable) { app.swipeUp() }
        sleep(1)
        snap(app, "store-08-share-png")
    }

    /// iPhone のカレンダーから取り込む（見本の予定をシミュレーターのカレンダーに入れてから）
    func testStoreImport() {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoSeedLocalStorage", b64(store()), "-lukkoSeedPhoneCalendar"]
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        app.launch()
        // カレンダーと通知の許可（出たら許す）
        for _ in 0..<3 {
            var tapped = false
            for label in ["Allow Full Access", "フルアクセスを許可", "Allow", "許可"] where springboard.buttons[label].waitForExistence(timeout: 4) {
                springboard.buttons[label].tap(); tapped = true; break
            }
            if !tapped { break }
            sleep(1)
        }
        XCTAssertTrue(app.tabBars.buttons["設定"].waitForExistence(timeout: 60), "下のタブが出ない")
        app.tabBars.buttons["設定"].tap()
        sleep(1)
        let row = app.staticTexts["iPhone のカレンダー"].firstMatch
        for _ in 0..<4 where !(row.exists && row.isHittable) { app.swipeUp(); sleep(1) }
        XCTAssertTrue(row.waitForExistence(timeout: 5), "iPhone のカレンダーの行が無い")
        row.tap()
        sleep(1)
        let imp = app.buttons["iPhone のカレンダーから取り込む"].firstMatch
        XCTAssertTrue(imp.waitForExistence(timeout: 5), "取り込むボタンが無い")
        imp.tap()
        sleep(2)
        if app.buttons["import.scan"].waitForExistence(timeout: 3) { app.buttons["import.scan"].tap(); sleep(3) }
        if app.buttons["import.read"].waitForExistence(timeout: 5) {
            snap(app, "store-09-import-cals")
            app.buttons["import.read"].tap()
            sleep(3)
        }
        snap(app, "store-10-import-found")
    }
}
