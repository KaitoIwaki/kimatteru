import XCTest

/// 空いてる日をシェアと、まとめカード（月／年）を開いて写真を撮る（Web 版の share・summary 画面と比べる）
final class ShareShots: XCTestCase {
    /// 見本：今日から先の予定（○△× がひととおり出るように）と、今月・先月のバイトの記録（バイト先 3 つ）
    private func sample() -> String {
        let cal = Calendar(identifier: .gregorian)
        let now = Date()
        func ymd(_ off: Int) -> (y: Int, m: Int, d: Int) {
            let c = cal.dateComponents([.year, .month, .day], from: cal.date(byAdding: .day, value: off, to: now)!)
            return (c.year!, c.month! - 1, c.day!)
        }
        var evs: [String] = []
        func ev(_ id: String, _ off: Int, _ title: String, _ type: String, _ status: String, _ s: String, _ e: String, extra: String = "") {
            let d = ymd(off)
            evs.append("{\"id\":\"\(id)\",\"y\":\(d.y),\"m\":\(d.m),\"day\":\(d.d),\"start\":\"\(s)\",\"end\":\"\(e)\",\"title\":\"\(title)\",\"type\":\"\(type)\",\"status\":\"\(status)\",\"updatedAt\":1\(extra)}")
        }
        ev("f1", 1, "定例", "yoji", "kakutei", "10:00", "18:00")
        ev("f2", 2, "旅行", "asobi", "kakutei", "00:00", "23:59", extra: ",\"allDay\":true")
        ev("f3", 3, "飲み会", "asobi", "mikakutei", "19:00", "21:00")
        ev("f4", 4, "カフェ", "baito", "kakutei", "09:00", "17:00", extra: ",\"jobId\":\"j1\"")
        ev("f5", 6, "歯医者", "yoji", "kakutei", "13:00", "14:30")
        // 記録（今日より前。今月と先月）
        let t = ymd(0)
        func rec(_ id: String, _ m: Int, _ d: Int, _ job: String, _ s: String, _ e: String) {
            var y = t.y, mm = m
            if mm < 0 { mm += 12; y -= 1 }
            evs.append("{\"id\":\"\(id)\",\"y\":\(y),\"m\":\(mm),\"day\":\(d),\"start\":\"\(s)\",\"end\":\"\(e)\",\"title\":\"シフト\",\"type\":\"baito\",\"status\":\"jisseki\",\"jobId\":\"\(job)\",\"breakMin\":30,\"updatedAt\":1}")
        }
        for (i, d) in [1, 2, 3].enumerated() where d < t.d { rec("r\(i)", t.m, d, ["j1", "j2", "j3"][i], "17:00", "22:00") }
        rec("p1", t.m - 1, 5, "j1", "10:00", "18:00")
        rec("p2", t.m - 1, 12, "j2", "17:00", "22:30")
        rec("p3", t.m - 1, 20, "j3", "09:00", "15:00")
        rec("p4", t.m - 1, 21, "j1", "10:00", "19:00")
        let jobs = "[{\"id\":\"j1\",\"name\":\"カフェ\",\"hourly\":1200},{\"id\":\"j2\",\"name\":\"塾の先生\",\"hourly\":1600},{\"id\":\"j3\",\"name\":\"コンビニ\",\"hourly\":1100}]"
        return "{\"savedAt\":9000000000000,\"events\":[\(evs.joined(separator: ","))],\"jobs\":\(jobs),\"settings\":{\"hourly\":1100,\"weekStart\":0,\"onboarded\":true,\"profile\":\"work\",\"priorWage\":{\"\(t.y)\":50000}}}"
    }

    func testShareScreens() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoShowSharePNG", "-lukkoSeedLocalStorage", Data(sample().utf8).base64EncodedString()]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["空き状況"].waitForExistence(timeout: 30))
        app.tabBars.buttons["空き状況"].tap()
        sleep(1)
        snap(app, "S01-free")

        // 空いてる日をシェア
        let share = app.buttons["free.share"]
        XCTAssertTrue(share.waitForExistence(timeout: 10))
        share.tap()
        XCTAssertTrue(app.descendants(matching: .any)["share.card"].waitForExistence(timeout: 10))
        sleep(1)
        snap(app, "S02-share")
        app.buttons["ふつう"].firstMatch.tap()
        app.buttons["来週"].firstMatch.tap()
        let sign = app.buttons["share.sign"]
        if sign.waitForExistence(timeout: 3) { sign.tap() }
        let name = app.textFields["share.name"]
        if name.waitForExistence(timeout: 3) {
            name.tap()
            if app.buttons["Continue"].waitForExistence(timeout: 2) { app.buttons["Continue"].tap() }
            name.typeText("Yamada\n")
        }
        sleep(1)
        snap(app, "S03-share-casual")
        let copy = app.buttons["share.copy"]
        if !copy.isHittable { app.swipeUp() }
        copy.tap()
        sleep(1)
        snap(app, "S04-share-copied")
        // 書き出す画像（試験のときだけ下に出す）
        let png = app.images["share.png"]
        for _ in 0..<4 where !(png.exists && png.isHittable) { app.swipeUp() }
        sleep(1)
        snap(app, "S05-share-png")
        app.buttons["閉じる"].firstMatch.tap()
        sleep(1)

        // まとめカード（月）
        app.tabBars.buttons["まとめ"].tap()
        sleep(1)
        let monthCard = app.buttons["report.monthCard"]
        for _ in 0..<5 where !(monthCard.exists && monthCard.isHittable) { app.swipeUp() }
        XCTAssertTrue(monthCard.waitForExistence(timeout: 5))
        snap(app, "S06-report-month")
        monthCard.tap()
        XCTAssertTrue(app.images["summary.card"].waitForExistence(timeout: 10))
        sleep(1)
        snap(app, "S07-summary-month")
        app.buttons["閉じる"].firstMatch.tap()
        sleep(1)

        // まとめカード（年）
        let yearSeg = app.buttons["年"].firstMatch
        for _ in 0..<5 where !(yearSeg.exists && yearSeg.isHittable) { app.swipeDown() }
        sleep(1)
        yearSeg.tap()
        // 払いの止まり際だと押したことにならないことがあるので、年の行が出るまで押し直す
        if !app.buttons["前の年"].waitForExistence(timeout: 3) { yearSeg.tap() }
        XCTAssertTrue(app.buttons["前の年"].waitForExistence(timeout: 5))
        sleep(1)
        snap(app, "S08-report-year")
        let yearCard = app.buttons["report.yearCard"]
        for _ in 0..<6 where !(yearCard.exists && yearCard.isHittable) { app.swipeUp() }
        snap(app, "S09-report-year-bottom")
        yearCard.tap()
        XCTAssertTrue(app.images["summary.card"].waitForExistence(timeout: 10))
        sleep(1)
        snap(app, "S10-summary-year")
        // iPhone の共有シート（最後に開いて、そのまま終える）
        app.buttons["summary.share"].tap()
        sleep(2)
        snap(app, "S11-share-sheet")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
