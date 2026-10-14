import XCTest

/// 画面を開いて写真を撮る。GitHub の Mac で動かし、写真を取り出して Web 版と比べる
final class ScreenshotTests: XCTestCase {
    func testScreens() throws {
        let app = XCUIApplication()
        app.launch()
        snap(app, "01-month")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
