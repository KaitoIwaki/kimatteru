import XCTest

/// 設定の画面を開いて写真を撮る（設定・応援・サポーターカード・控え・ファイル・ヘルプ・規約・種類・勤務先・診断）
final class SettingsShots: XCTestCase {
    /// 見本：応援したことがある・勤務先 2 つ（型つき）・消した予定 2 件
    private func sample() -> String {
        let now = Int(Date().timeIntervalSince1970 * 1000)
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: Date())
        let y = c.year!, m = c.month! - 1
        let day: Int = 86_400_000
        let evs = [
            "{\"id\":\"a\",\"y\":\(y),\"m\":\(m),\"day\":3,\"start\":\"10:00\",\"end\":\"11:00\",\"title\":\"定例\",\"type\":\"yoji\",\"status\":\"kakutei\",\"updatedAt\":1}",
            "{\"id\":\"b\",\"y\":\(y),\"m\":\(m),\"day\":5,\"start\":\"17:00\",\"end\":\"22:00\",\"title\":\"カフェ\",\"type\":\"baito\",\"status\":\"jisseki\",\"jobId\":\"j1\",\"updatedAt\":1}",
            "{\"id\":\"iX-0\",\"y\":\(y),\"m\":\(m),\"day\":9,\"start\":\"00:00\",\"end\":\"23:59\",\"allDay\":true,\"title\":\"誕生日\",\"type\":\"other\",\"status\":\"kakutei\",\"updatedAt\":1}",
        ]
        let trash = [
            "{\"ev\":{\"id\":\"t1\",\"y\":\(y),\"m\":\(m),\"day\":12,\"start\":\"12:00\",\"end\":\"13:00\",\"title\":\"ランチ\",\"type\":\"asobi\",\"status\":\"kakutei\"},\"at\":\(now - day)}",
            "{\"ev\":{\"id\":\"t2\",\"y\":\(y),\"m\":\(m),\"day\":14,\"start\":\"19:00\",\"end\":\"21:00\",\"title\":\"飲み会\",\"type\":\"asobi\",\"status\":\"mikakutei\"},\"at\":\(now - 3 * day)}",
        ]
        let supports = [
            "{\"id\":\"com.kimatteru.app.tip600\",\"yen\":600,\"at\":\(now - 200 * day)}",
            "{\"id\":\"com.kimatteru.app.tip1000\",\"yen\":1000,\"at\":\(now - 20 * day)}",
        ]
        let jobs = [
            "{\"id\":\"j1\",\"name\":\"カフェ\",\"hourly\":1200,\"closeDay\":15,\"payDay\":25,\"templates\":[{\"id\":\"p1\",\"sym\":\"早\",\"name\":\"早番\",\"from\":540,\"to\":1020,\"brk\":60}]}",
            "{\"id\":\"j2\",\"name\":\"塾\",\"hourly\":1500,\"retired\":true}",
        ]
        let settings = "{\"hourly\":1100,\"weekStart\":0,\"onboarded\":true,\"supporterName\":\"見本\",\"profile\":\"work\",\"lastImport\":{\"tag\":\"iX\",\"at\":1},\"paidLeave\":{\"grant\":10,\"start\":3}}"
        return "{\"savedAt\":9000000000000,\"events\":[\(evs.joined(separator: ","))],\"trash\":[\(trash.joined(separator: ","))],\"supports\":[\(supports.joined(separator: ","))],\"jobs\":[\(jobs.joined(separator: ","))],\"settings\":\(settings)}"
    }

    private func back(_ app: XCUIApplication) {
        app.navigationBars.buttons.element(boundBy: 0).tap()
        sleep(1)
    }
    private func open(_ app: XCUIApplication, _ text: String) {
        let e = app.staticTexts[text].firstMatch
        // 画面の外にある行は、払って探す（上の行が増えると、下の行は最初の画面に入らない）
        _ = e.waitForExistence(timeout: 5)
        var tries = 0
        while !(e.exists && e.isHittable) && tries < 4 { app.swipeUp(); sleep(1); tries += 1 }
        while !(e.exists && e.isHittable) && tries < 9 { app.swipeDown(); sleep(1); tries += 1 }
        XCTAssertTrue(e.waitForExistence(timeout: 5), "\(text) が出ない")
        e.tap()
        sleep(1)
    }

    func testSettingsScreens() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoDemoTips", "-lukkoSeedLocalStorage", Data(sample().utf8).base64EncodedString()]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["設定"].waitForExistence(timeout: 30))
        app.tabBars.buttons["設定"].tap()
        sleep(2)
        snap(app, "S01-settings")

        // 応援する
        open(app, "LUKKO を応援する")
        snap(app, "S02-support")
        back(app)

        // サポーターカード（押すと裏返る）
        let sup = app.buttons["settings.supporter"]
        XCTAssertTrue(sup.waitForExistence(timeout: 10))
        sup.tap()
        sleep(2)
        snap(app, "S03-card")
        let card = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'サポーターカード ¥'")).firstMatch
        if card.waitForExistence(timeout: 5) {
            card.tap()
            sleep(2)
            snap(app, "S04-card-back")
        }
        back(app)

        // 保存と安全 → 最近消した予定（シート）→ 控えと機種変更 → ファイルで出し入れ
        open(app, "保存と安全")
        snap(app, "S05-data")
        let trash = app.buttons["settings.trash"]
        if trash.waitForExistence(timeout: 5) {
            trash.tap()
            sleep(2)
            snap(app, "S06-trash")
            app.buttons["閉じる"].firstMatch.tap()
            sleep(1)
        }
        open(app, "控えと機種変更")
        let paste = app.buttons["backup.paste"]
        if paste.waitForExistence(timeout: 5) { paste.tap(); sleep(1) }
        snap(app, "S07-backup")
        let list = app.buttons["backup.list"]
        if list.waitForExistence(timeout: 5) {
            list.tap()
            sleep(2)
            snap(app, "S08-backup-list")
            app.buttons["閉じる"].firstMatch.tap()
            sleep(1)
        }
        back(app)
        open(app, "ファイルで出し入れ")
        snap(app, "S09-files")
        back(app)
        back(app)

        // ヘルプ → 利用規約
        open(app, "ヘルプ")
        snap(app, "S10-help")
        let terms = app.buttons["help.terms"]
        if terms.waitForExistence(timeout: 5) {
            terms.tap()
            sleep(2)
            snap(app, "S11-terms")
            back(app)
        }
        back(app)

        // 予定の種類（1 つ開く）
        open(app, "予定の種類")
        open(app, "用事")
        snap(app, "S12-types")
        back(app)

        // 勤務先（開いて、型を足すシート）
        open(app, "働いた時間と給料")
        snap(app, "S13-wage")
        open(app, "勤務先")
        open(app, "カフェ")
        snap(app, "S14-jobs")
        let addTpl = app.buttons["＋ 型を足す"].firstMatch
        if addTpl.waitForExistence(timeout: 5) {
            addTpl.tap()
            sleep(2)
            snap(app, "S15-template")
            app.buttons["閉じる"].firstMatch.tap()
            sleep(1)
        }
        back(app)
        back(app)

        // カレンダーと表示・通知
        open(app, "カレンダーと表示")
        snap(app, "S16-display")
        back(app)
        open(app, "通知")
        snap(app, "S17-notify")
        back(app)

        // 診断（版の字を 5 回）
        app.swipeUp()
        let ver = app.staticTexts["settings.version"]
        if ver.waitForExistence(timeout: 5) {
            for _ in 0..<5 { ver.tap() }
            sleep(3)
            snap(app, "S18-probe")
        }
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
