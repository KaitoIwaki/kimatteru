import XCTest

/// 月のまわり（sw-month）の写真：年月えらび・週表示・シフト入力・給料バー・一覧・日の時間・長押し・「決まった」の瞬間・はじめての案内
final class MonthShots: XCTestCase {
    private func ymd() -> (y: Int, m: Int, d: Int) {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: Date())
        return (c.year!, c.month! - 1, c.day!)
    }

    /// 見本：今月の予定（決まった・まだ・記録・何日も続く・無くなった）、シフトの型のある勤務先、日にち未定の棚
    private func sample(theme: String? = nil, empty: Bool = false) -> String {
        let (y, m, today) = ymd()
        func ev(_ id: String, _ d: Int, _ title: String, _ type: String, _ status: String, _ s: String = "10:00", _ e: String = "11:00", extra: String = "") -> String {
            "{\"id\":\"\(id)\",\"y\":\(y),\"m\":\(m),\"day\":\(d),\"start\":\"\(s)\",\"end\":\"\(e)\",\"title\":\"\(title)\",\"type\":\"\(type)\",\"status\":\"\(status)\",\"updatedAt\":1\(extra)}"
        }
        let evs = empty ? [] : [
            ev("a", 3, "定例", "yoji", "kakutei"),
            ev("b", 5, "カフェ", "baito", "kakutei", "17:00", "22:00", extra: ",\"jobId\":\"j1\""),
            ev("c", 6, "飲み会", "asobi", "mikakutei", "19:00", "21:00"),
            ev("d", 9, "旅行", "asobi", "kakutei", "00:00", "23:59", extra: ",\"allDay\":true,\"days\":3"),
            ev("e", 12, "カフェ", "baito", "jisseki", "17:00", "22:00", extra: ",\"jobId\":\"j1\""),
            ev("f", 12, "歯医者", "yoji", "kakutei", "09:30", "10:30"),
            ev("g", 15, "ランチ", "asobi", "nakunatta", "12:00", "13:00"),
            ev("h", min(today, 28), "面接", "yoji", "mikakutei", "14:00", "15:00"),
            ev("i", 20, "カフェ", "baito", "mikakutei", "17:00", "22:00", extra: ",\"jobId\":\"j1\""),
            ev("j", 20, "買い物", "other", "kakutei", "11:00", "12:00"),
            ev("k", 20, "映画", "asobi", "kakutei", "18:00", "20:00"),
            ev("l", 20, "勉強会", "yoji", "kakutei", "08:00", "09:30"),
            ev("n", 20, "電話", "other", "kakutei", "21:00", "21:30"),
            ev("o", 22, "合宿", "yoji", "mikakutei", "00:00", "23:59", extra: ",\"allDay\":true,\"days\":2"),
        ]
        let jobs = "[{\"id\":\"j1\",\"name\":\"カフェ\",\"hourly\":1200,\"templates\":[{\"name\":\"早番\",\"from\":540,\"to\":1020,\"sym\":\"早\"},{\"name\":\"遅番\",\"from\":1020,\"to\":1380,\"sym\":\"遅\"},{\"name\":\"\",\"from\":0,\"to\":1439,\"sym\":\"休\",\"allDay\":true}]}]"
        let someday = empty ? "[]" : "[{\"id\":\"s1\",\"title\":\"髪を切る\",\"type\":\"yoji\",\"when\":\"month\",\"y\":\(y),\"m\":\(m),\"day\":1,\"at\":1}]"
        let th = theme.map { ",\"theme\":\"\($0)\"" } ?? ""
        return "{\"savedAt\":9000000000000,\"events\":[\(evs.joined(separator: ","))],\"jobs\":\(empty ? "[]" : jobs),\"someday\":\(someday),\"settings\":{\"hourly\":1100,\"weekStart\":0,\"onboarded\":true\(th)}}"
    }

    private func launch(_ seed: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoSeedLocalStorage", Data(seed.utf8).base64EncodedString()]
        app.launch()
        XCTAssertTrue(app.buttons["年と月をえらぶ"].waitForExistence(timeout: 30))
        allowSystemAlert()
        return app
    }

    /// 起動時の通知の許可（iPhone の確認）が出ていたら閉じる（写真と押す操作の邪魔になる）
    private func allowSystemAlert() {
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可"] where sb.buttons[label].waitForExistence(timeout: 3) {
            sb.buttons[label].tap()
            sleep(1)
            return
        }
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    private func back(_ app: XCUIApplication) {
        let b = app.navigationBars.buttons.element(boundBy: 0)
        if b.waitForExistence(timeout: 3) { b.tap() }
        sleep(1)
    }

    private func seg(_ app: XCUIApplication, _ id: String, _ label: String) {
        let s = app.segmentedControls[id].buttons[label]
        if s.waitForExistence(timeout: 3) { s.tap() } else if app.buttons[label].exists { app.buttons[label].firstMatch.tap() }
        sleep(1)
    }

    func testMonthArea() throws {
        let app = launch(sample())
        sleep(1)

        // 年月えらび
        app.buttons["年と月をえらぶ"].tap()
        sleep(1)
        snap(app, "M01-ym-sheet")
        let next = app.buttons["次の年"]
        if next.waitForExistence(timeout: 3) { next.tap(); sleep(1); snap(app, "M02-ym-sheet-next-year") }
        let thisMonth = app.buttons.matching(NSPredicate(format: "label BEGINSWITH '今月（'")).firstMatch
        if thisMonth.waitForExistence(timeout: 3) { thisMonth.tap() }
        sleep(1)

        // 週表示
        seg(app, "month.viewSeg", "週")
        snap(app, "M03-week")
        if app.buttons["次の週"].waitForExistence(timeout: 5) {
            // 週の本体を指で左へ流す
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.6))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.6)))
            sleep(2)
            snap(app, "M04-week-swiped")
            if app.buttons["今日"].waitForExistence(timeout: 3) { app.buttons["今日"].tap(); sleep(2) }
            app.buttons["次の週"].tap()
            sleep(2)
            snap(app, "M05-week-next")
        }
        seg(app, "month.viewSeg", "月")

        // シフト入力
        let chip = app.buttons["month.stampChip"]
        if chip.waitForExistence(timeout: 5) {
            chip.tap()
            sleep(1)
            let d = app.buttons["month.day.24"]
            if d.waitForExistence(timeout: 3) { d.tap(); sleep(1) }
            snap(app, "M06-stamp")
            let end = app.buttons["stamp.end"]
            if end.waitForExistence(timeout: 3) { end.tap() }
            sleep(1)
        }

        // 給料バー
        let sw = app.buttons["month.wageToggle"]
        if sw.waitForExistence(timeout: 5) {
            sw.tap()
            sleep(1)
            snap(app, "M07-wage-bar")
            sw.tap()
            sleep(1)
        }

        // 一覧（まだ）と、日にち未定に日を決める
        let undecided = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'まだ '")).firstMatch
        if undecided.waitForExistence(timeout: 3) {
            undecided.tap()
            sleep(1)
            snap(app, "M08-list-undecided")
            let pick = app.buttons["日を決める"]
            if pick.waitForExistence(timeout: 3) { pick.tap(); sleep(1); snap(app, "M09-someday-pick"); app.buttons["やめる"].tap(); sleep(1) }
            back(app)
        }
        // 探す
        app.buttons["予定を探す"].tap()
        sleep(1)
        let field = app.textFields["list.search"]
        if field.waitForExistence(timeout: 3) {
            field.typeText("カフェ")
            sleep(1)
            // キーボードの初回の案内（なぞって入力）が出ていたら閉じる
            if app.buttons["Continue"].waitForExistence(timeout: 2) { app.buttons["Continue"].tap(); sleep(1) }
        }
        snap(app, "M10-search")
        back(app)

        // 日の画面：一覧・時間・長押し
        let day = app.buttons["month.day.20"]
        XCTAssertTrue(day.waitForExistence(timeout: 10))
        day.tap()
        sleep(1)
        snap(app, "M11-day-list")
        let row = app.descendants(matching: .any).matching(identifier: "day.row.k").firstMatch
        if row.waitForExistence(timeout: 5) {
            row.press(forDuration: 1.2)
            sleep(1)
            snap(app, "M12-day-longpress")
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.06)).tap()
            sleep(1)
        }
        seg(app, "day.viewSeg", "時間")
        snap(app, "M13-day-time")
        seg(app, "day.viewSeg", "一覧")
        back(app)

        // 「決まった」の瞬間：今日のまだの予定を開いて「確定した」
        let (_, _, today) = ymd()
        let tday = app.buttons["month.day.\(min(today, 28))"]
        if tday.waitForExistence(timeout: 5) {
            tday.tap()
            sleep(1)
            let r = app.descendants(matching: .any).matching(identifier: "day.row.h").firstMatch
            if r.waitForExistence(timeout: 5) {
                r.tap()
                let ok = app.buttons["確定した"]
                if ok.waitForExistence(timeout: 5) {
                    snap(app, "M14-confirm-dialog")
                    ok.tap()
                    snap(app, "M15-morph")
                    sleep(1)
                    snap(app, "M16-confirmed")
                }
            }
        }
    }

    func testFirstRunHint() throws {
        let app = launch(sample(empty: true))
        let hint = app.descendants(matching: .any).matching(identifier: "month.firstRunHint").firstMatch
        XCTAssertTrue(hint.waitForExistence(timeout: 10))
        sleep(1)
        snap(app, "M20-first-run-hint")
        let close = app.buttons["この案内を閉じる"]
        if close.exists { close.tap(); sleep(1) }
        snap(app, "M21-first-run-closed")
    }

    func testDark() throws {
        let app = launch(sample(theme: "dark"))
        sleep(1)
        snap(app, "M30-month-dark")
        seg(app, "month.viewSeg", "週")
        snap(app, "M31-week-dark")
        seg(app, "month.viewSeg", "月")
    }
}
