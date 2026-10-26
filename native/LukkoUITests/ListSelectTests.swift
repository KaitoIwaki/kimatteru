import XCTest

/// 一覧の「選択」：予定を選んで、まとめて同じ時間にする・消す・元に戻す
final class ListSelectTests: XCTestCase {
    private func b64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

    /// 明日から 5 日、1 日 1 件ずつ
    private func store() -> String {
        let cal = Calendar(identifier: .gregorian)
        var evs: [String] = []
        for i in 1...5 {
            let d = cal.dateComponents([.year, .month, .day], from: cal.date(byAdding: .day, value: i, to: Date())!)
            evs.append("{\"id\":\"s\(i)\",\"y\":\(d.year!),\"m\":\(d.month! - 1),\"day\":\(d.day!),\"start\":\"10:00\",\"end\":\"11:00\",\"title\":\"見本\(i)\",\"type\":\"yoji\",\"status\":\"kakutei\",\"updatedAt\":1}")
        }
        return "{\"savedAt\":8000,\"events\":[\(evs.joined(separator: ","))],\"settings\":{\"onboarded\":true}}"
    }

    private func row(_ app: XCUIApplication, _ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: "list.row.\(id)").firstMatch
    }

    func testSelectTimeDeleteUndo() {
        let app = XCUIApplication()
        app.launchArguments = ["-lukkoTestReset", "-lukkoSeedFile", b64(store())]
        app.launch()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "許可", "Don’t Allow", "許可しない"] where springboard.buttons[label].waitForExistence(timeout: 2) {
            springboard.buttons[label].tap()
            break
        }
        let listBtn = app.buttons["これからの予定の一覧"]
        XCTAssertTrue(listBtn.waitForExistence(timeout: 60), "一覧のボタンが無い")
        listBtn.tap()
        XCTAssertTrue(row(app, "s1").waitForExistence(timeout: 5), "一覧に予定が無い")

        // 選択 → 2 件選ぶ → 時間 → 17:00〜22:00 にする
        app.buttons["list.select"].tap()
        row(app, "s1").tap(); row(app, "s2").tap()
        XCTAssertTrue(app.staticTexts["2件"].waitForExistence(timeout: 3), "選んだ数が 2件 にならない")
        snap(app, "L00-selected")
        // 選んでいるあいだは、押しても予定が開かない
        XCTAssertFalse(app.navigationBars["予定"].exists)
        app.buttons["list.bulkTime"].tap()
        let start = app.buttons["list.bulkTime.start"]
        XCTAssertTrue(start.waitForExistence(timeout: 3), "時間の小窓が出ない")
        // 開始 17:00・終了 22:00（ドラムを回す）
        start.tap()
        app.pickerWheels.element(boundBy: 0).adjust(toPickerWheelValue: "17")
        app.buttons["list.bulkTime.end"].tap()
        app.pickerWheels.element(boundBy: 0).adjust(toPickerWheelValue: "22")
        snap(app, "L01-time-sheet")
        app.buttons["list.bulkTime.done"].tap()
        let undo = app.descendants(matching: .any).matching(identifier: "undo.bar").firstMatch
        XCTAssertTrue(undo.waitForExistence(timeout: 3), "元に戻すの帯が出ない")
        // 「元に戻す」は 5 秒で消えるので、確かめは短く
        // 選んだ 2 件だけが 17:00 から、残りの 3 件は 10:00 から
        XCTAssertEqual(times(app, "17:00"), 2, "選んだ 2 件が 17:00 になっていない")
        XCTAssertEqual(times(app, "10:00"), 3, "選んでいない予定まで変わった")
        snap(app, "L02-after-time")
        // 元に戻す
        app.buttons["undo.button"].tap()
        sleep(1)
        XCTAssertEqual(times(app, "10:00"), 5, "元に戻しても 10:00 に戻らない")

        // 選択 → 全部選ぶ → 消す → 確かめて消す
        app.buttons["list.select"].tap()
        app.buttons["list.selectAll"].tap()
        XCTAssertTrue(app.staticTexts["5件"].waitForExistence(timeout: 3), "全部選ぶで 5件 にならない")
        app.buttons["list.bulkDelete"].tap()
        let confirm = app.buttons["5件を消す"].firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 3), "消す前の確かめが出ない")
        snap(app, "L03-delete-ask")
        confirm.tap()
        XCTAssertTrue(app.staticTexts["5件を削除しました"].waitForExistence(timeout: 3), "消した知らせが出ない")
        XCTAssertFalse(row(app, "s1").exists, "消したのに一覧に残っている")
        app.buttons["undo.button"].tap()
        XCTAssertTrue(row(app, "s1").waitForExistence(timeout: 3) && row(app, "s5").exists, "元に戻しても予定が戻らない")
        snap(app, "L05-restored")
    }

    /// その時刻で始まる予定の数（一覧の「10:00–11:00」の字）
    private func times(_ app: XCUIApplication, _ start: String) -> Int {
        app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", start)).count
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
