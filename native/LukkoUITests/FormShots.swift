import XCTest

/// 新しい予定・詳細・「どうなった？」・削除の確認・お知らせ・はじめての案内・取り込み の写真（sw-form の受け持ち）。
/// 写真は GitHub の Mac で撮って取り出し、Web 版と見比べる。iPhone の許可の画面のように、こちらで決められないところは確かめずに写すだけ
final class FormShots: XCTestCase {
    override func setUp() { continueAfterFailure = true }

    /// 見本の予定（今月）。今日より後の「まだ」と、今日より前に終わったバイトを入れる
    private func sample() -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: Date())
        let y = c.year!, m = c.month! - 1, today = c.day!
        func ev(_ id: String, _ d: Int, _ title: String, _ type: String, _ status: String, _ s: String = "10:00", _ e: String = "11:00", extra: String = "") -> String {
            "{\"id\":\"\(id)\",\"y\":\(y),\"m\":\(m),\"day\":\(d),\"start\":\"\(s)\",\"end\":\"\(e)\",\"title\":\"\(title)\",\"type\":\"\(type)\",\"status\":\"\(status)\",\"updatedAt\":1\(extra)}"
        }
        let evs = [
            ev("a", 3, "定例", "yoji", "kakutei"),
            ev("b", 1, "カフェ", "baito", "kakutei", "17:00", "22:00", extra: ",\"jobId\":\"j1\""),
            ev("c", 2, "カフェ", "baito", "jisseki", "17:00", "22:00", extra: ",\"actualEnd\":\"22:30\",\"breakMin\":30,\"hourly\":1100,\"jobId\":\"j1\""),
            ev("h", min(today, 28), "面接", "yoji", "mikakutei", "14:00", "15:00", extra: ",\"want\":[\"14:00\",\"15:00\"]"),
            ev("j", 20, "買い物", "other", "kakutei", "11:00", "12:00", extra: ",\"place\":\"渋谷駅\",\"memo\":\"持ち物：傘\\n電話 03-1234-5678\",\"remindMin\":60"),
            ev("k", 20, "映画", "asobi", "kakutei", "18:00", "20:00"),
            ev("r1", 20, "ジム", "yoji", "kakutei", "07:00", "08:00", extra: ",\"repId\":\"R\""),
            ev("r2", 27, "ジム", "yoji", "kakutei", "07:00", "08:00", extra: ",\"repId\":\"R\""),
        ]
        return "{\"savedAt\":9000000000000,\"events\":[\(evs.joined(separator: ","))],\"jobs\":[{\"id\":\"j1\",\"name\":\"カフェ\",\"hourly\":1100}],\"settings\":{\"hourly\":1100,\"weekStart\":0,\"onboarded\":true}}"
    }

    private func launch(seed: String?) -> XCUIApplication {
        let app = XCUIApplication()
        var args = ["-lukkoTestReset"]
        if let seed { args += ["-lukkoSeedLocalStorage", Data(seed.utf8).base64EncodedString()] }
        app.launchArguments = args
        app.launch()
        return app
    }

    /// 新しい予定：開いた形・日にち・時刻のドラム・くり返し・下へ払ったときの確かめ・✕ で捨てる
    func testForm() throws {
        let app = launch(seed: sample())
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 30))
        let day = app.buttons["month.day.20"]
        XCTAssertTrue(day.waitForExistence(timeout: 10))
        day.tap()
        sleep(1)
        app.buttons["予定を追加"].firstMatch.tap()
        sleep(1)
        if app.buttons["Continue"].waitForExistence(timeout: 2) { app.buttons["Continue"].tap(); sleep(1) }
        snap(app, "20-form-new")
        let title = app.textFields["form.title"]
        if title.waitForExistence(timeout: 5) {
            title.tap()
            title.typeText("歯医者")
        }
        let date = app.buttons["form.date"]
        if date.waitForExistence(timeout: 5) { date.tap(); sleep(1) }
        snap(app, "21-form-date")
        if date.exists { date.tap(); sleep(1) }
        let start = app.buttons["form.time.start"]
        if start.waitForExistence(timeout: 5) { start.tap(); sleep(1) }
        snap(app, "22-form-wheel")
        if start.exists { start.tap(); sleep(1) }
        app.swipeUp()
        sleep(1)
        let rep = app.buttons["＋ くり返し"]
        if rep.waitForExistence(timeout: 3) { rep.tap(); sleep(1) }
        snap(app, "23-form-repeat")
        // 書きかけがあるので、下へ払っても閉じず、捨てるか聞く
        app.navigationBars.firstMatch.swipeDown(velocity: .fast)
        sleep(1)
        snap(app, "24-form-swipe-ask")
        if app.alerts.buttons["書きつづける"].waitForExistence(timeout: 3) { app.alerts.buttons["書きつづける"].tap(); sleep(1) }
        app.buttons["閉じる"].firstMatch.tap()
        sleep(1)
        snap(app, "25-form-discard")
        if app.alerts.buttons["捨てる"].waitForExistence(timeout: 3) { app.alerts.buttons["捨てる"].tap() }
        sleep(1)
        XCTAssertFalse(app.textFields["form.title"].exists, "捨てたら閉じる")
    }

    /// 詳細・「···」・削除の確認・くり返しの編集の確かめ・「どうなった？」
    func testDetail() throws {
        let app = launch(seed: sample())
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 30))
        app.buttons["month.day.20"].tap()
        sleep(1)
        let row = app.descendants(matching: .any).matching(identifier: "day.row.j").firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        row.tap()
        sleep(1)
        snap(app, "26-detail")
        let menu = app.buttons["この予定の操作"]
        if menu.waitForExistence(timeout: 5) {
            menu.tap()
            sleep(1)
            snap(app, "27-detail-menu")
            let del = app.buttons["この予定を削除"]
            if del.waitForExistence(timeout: 3) {
                del.tap()
                sleep(1)
                snap(app, "28-delete-ask")
                if app.alerts.buttons["キャンセル"].waitForExistence(timeout: 3) { app.alerts.buttons["キャンセル"].tap() }
                sleep(1)
            }
        }
        // くり返しの予定を編集して保存 →「どこまで変えますか？」
        app.navigationBars.buttons.firstMatch.tap()
        sleep(1)
        let gym = app.descendants(matching: .any).matching(identifier: "day.row.r1").firstMatch
        if gym.waitForExistence(timeout: 5) {
            gym.tap()
            sleep(1)
            if menu.waitForExistence(timeout: 5) {
                menu.tap()
                sleep(1)
                if app.buttons["編集"].waitForExistence(timeout: 3) {
                    app.buttons["編集"].tap()
                    sleep(1)
                    snap(app, "29-form-edit")
                    let title = app.textFields["form.title"]
                    if title.waitForExistence(timeout: 3) { title.tap(); title.typeText("2") }
                    app.buttons["form.saveBar"].firstMatch.tap()
                    sleep(1)
                    snap(app, "30-form-rep-ask")
                    if app.alerts.buttons["キャンセル"].waitForExistence(timeout: 3) { app.alerts.buttons["キャンセル"].tap(); sleep(1) }
                    app.buttons["閉じる"].firstMatch.tap()
                    sleep(1)
                    if app.alerts.buttons["捨てる"].waitForExistence(timeout: 3) { app.alerts.buttons["捨てる"].tap(); sleep(1) }
                }
            }
        }
        // 「まだ」の予定 →「どうなった？」
        app.tabBars.buttons["カレンダー"].tap()
        sleep(1)
        let c = Calendar(identifier: .gregorian).component(.day, from: Date())
        let d = app.buttons["month.day.\(min(c, 28))"]
        if d.waitForExistence(timeout: 5) {
            d.tap()
            sleep(1)
            let mk = app.descendants(matching: .any).matching(identifier: "day.row.h").firstMatch
            if mk.waitForExistence(timeout: 5) {
                mk.tap()
                sleep(1)
                if app.buttons["detail.primary"].waitForExistence(timeout: 2) { app.buttons["detail.primary"].tap(); sleep(1) }
                snap(app, "31-dialog")
                let t = app.buttons["dialog.time.end"]
                if t.waitForExistence(timeout: 3) { t.tap(); sleep(1) }
                snap(app, "32-dialog-wheel")
                if app.buttons["別の日になった"].waitForExistence(timeout: 2) {
                    app.buttons["別の日になった"].tap()
                    sleep(1)
                    snap(app, "33-dialog-move")
                }
            }
        }
    }

    /// 働いた記録（実績の詳細）とベルのお知らせ
    func testWorkedAndNotices() throws {
        let app = launch(seed: sample())
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 30))
        app.buttons["month.day.2"].tap()
        sleep(1)
        let row = app.descendants(matching: .any).matching(identifier: "day.row.c").firstMatch
        if row.waitForExistence(timeout: 5) {
            row.tap()
            sleep(1)
            snap(app, "34-detail-jisseki")
            app.navigationBars.buttons.firstMatch.tap()
            sleep(1)
        }
        app.tabBars.buttons["カレンダー"].tap()
        sleep(1)
        let bell = app.buttons["お知らせ"]
        if bell.waitForExistence(timeout: 5) {
            bell.tap()
            sleep(1)
            snap(app, "35-notices")
            let first = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "おつかれ")).firstMatch
            if first.waitForExistence(timeout: 2) {
                first.tap()
                sleep(1)
                snap(app, "36-notice-open")
                if app.buttons["実働を記録する"].waitForExistence(timeout: 2) {
                    app.buttons["実働を記録する"].tap()
                    sleep(2)
                    snap(app, "37-worked")
                }
            }
        }
    }

    /// はじめての案内（5 枚）と、そこからの取り込み
    func testOnboarding() throws {
        let app = launch(seed: nil)
        let pick = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "学校とバイト")).firstMatch
        XCTAssertTrue(pick.waitForExistence(timeout: 30))
        sleep(2)
        snap(app, "40-onboard-0")
        pick.tap()
        sleep(3)
        snap(app, "41-onboard-1")
        let demo = app.buttons["onboard.demo"]
        if demo.waitForExistence(timeout: 3) {
            demo.tap()
            sleep(1)
            snap(app, "42-onboard-asking")
            if app.buttons["確定した"].waitForExistence(timeout: 3) { app.buttons["確定した"].tap() }
            sleep(1)
            snap(app, "43-onboard-done")
        }
        for (i, name) in ["44-onboard-2", "45-onboard-3", "46-onboard-4"].enumerated() {
            let next = app.buttons["つぎへ"]
            guard next.waitForExistence(timeout: 3) else { break }
            next.tap()
            sleep(i == 0 ? 3 : 3)
            snap(app, name)
        }
        // 取り込み：iPhone の許可の画面が出たら許す（出ない・言葉が違うときは、そのまま写す）
        addUIInterruptionMonitor(withDescription: "calendar") { alert in
            for label in ["Allow Full Access", "フルアクセスを許可", "OK", "Allow"] where alert.buttons[label].exists {
                alert.buttons[label].tap(); return true
            }
            return false
        }
        let imp = app.buttons["カレンダーから取り込む"]
        if imp.waitForExistence(timeout: 3) {
            imp.tap()
            sleep(3)
            let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            for label in ["Allow Full Access", "フルアクセスを許可"] where springboard.buttons[label].waitForExistence(timeout: 2) {
                springboard.buttons[label].tap()
                break
            }
            app.tap()
            sleep(2)
            snap(app, "47-import")
            if app.buttons["import.scan"].waitForExistence(timeout: 2) { app.buttons["import.scan"].tap(); sleep(3) }
            if app.buttons["import.read"].waitForExistence(timeout: 3) {
                snap(app, "48-import-cals")
                app.buttons["import.read"].tap()
                sleep(3)
            }
            snap(app, "49-import-found")
        }
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
